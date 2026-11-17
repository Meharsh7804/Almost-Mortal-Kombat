import type Phaser from 'phaser';

/**
 * Fixed-timestep simulation clock.
 *
 * Architecture note:
 * Phaser owns the only requestAnimationFrame loop in the application. `Game`
 * forwards Phaser's PRE_STEP delta into this class, so there is no competing
 * RAF loop or second renderer. Every tick advances the simulation by exactly
 * `FIXED_TIMESTEP_MS`, while scenes continue to render once per Phaser frame.
 *
 * Future combat, AI and physics systems subscribe with `addFixedUpdate`.
 * Render code reads simulation state in a scene's normal update/render pass and
 * may use `interpolationAlpha` to smooth between fixed ticks.
 */

export const FIXED_TIMESTEP_HZ = 60;
export const FIXED_TIMESTEP_MS = 1000 / FIXED_TIMESTEP_HZ;
export const FIXED_STEP_SECONDS = FIXED_TIMESTEP_MS / 1000;

/** Upper bound on catch-up ticks after a long frame or an inactive tab. */
export const MAX_CATCH_UP_STEPS = 5;

/** Frames longer than this are treated as a stall and clamped. */
export const MAX_FRAME_DELTA_MS = 250;

/** Tolerates floating-point drift in the accumulator (e.g. 1s of 1ms frames). */
const STEP_EPSILON_MS = 1e-7;

export interface FixedUpdateFrame {
  /** Simulation tick, starting at 1. */
  readonly tick: number;
  /** Fixed delta applied by this tick, in milliseconds. */
  readonly deltaMs: number;
  /** Total simulated time after this tick, in milliseconds. */
  readonly elapsedMs: number;
  /** Total simulated time after this tick, in seconds. */
  readonly elapsedSeconds: number;
}

export type FixedUpdateHandler = (frame: FixedUpdateFrame) => void;

export interface GameLoopOptions {
  readonly timestepHz?: number;
  readonly maxCatchUpSteps?: number;
  readonly maxFrameDeltaMs?: number;
}

export class GameLoop {
  readonly timestepHz: number;
  readonly fixedDeltaMs: number;
  readonly maxCatchUpSteps: number;
  readonly maxFrameDeltaMs: number;

  private readonly handlers = new Set<FixedUpdateHandler>();
  private accumulatorMs = 0;
  private elapsedSimulationMs = 0;
  private currentTick = 0;

  constructor(options: GameLoopOptions = {}) {
    const timestepHz = options.timestepHz ?? FIXED_TIMESTEP_HZ;
    const maxCatchUpSteps = options.maxCatchUpSteps ?? MAX_CATCH_UP_STEPS;
    const maxFrameDeltaMs = options.maxFrameDeltaMs ?? MAX_FRAME_DELTA_MS;

    if (!Number.isFinite(timestepHz) || timestepHz <= 0) {
      throw new RangeError('timestepHz must be a finite number greater than zero.');
    }
    if (!Number.isInteger(maxCatchUpSteps) || maxCatchUpSteps < 1) {
      throw new RangeError('maxCatchUpSteps must be an integer greater than zero.');
    }
    if (!Number.isFinite(maxFrameDeltaMs) || maxFrameDeltaMs <= 0) {
      throw new RangeError('maxFrameDeltaMs must be a finite number greater than zero.');
    }

    this.timestepHz = timestepHz;
    this.fixedDeltaMs = 1000 / timestepHz;
    this.maxCatchUpSteps = maxCatchUpSteps;
    this.maxFrameDeltaMs = maxFrameDeltaMs;
  }

  get tick(): number {
    return this.currentTick;
  }

  get simulationTimeMs(): number {
    return this.elapsedSimulationMs;
  }

  get simulationTimeSeconds(): number {
    return this.elapsedSimulationMs / 1000;
  }

  /** Unconsumed time as a 0..1 render interpolation factor. */
  get interpolationAlpha(): number {
    return Math.min(this.accumulatorMs / this.fixedDeltaMs, 1);
  }

  /** Time waiting for the next fixed tick, in milliseconds. */
  get pendingTimeMs(): number {
    return this.accumulatorMs;
  }

  /**
   * Advance the simulation from a render-frame delta.
   *
   * @returns The number of fixed ticks executed during this call.
   */
  update(frameDeltaMs: number): number {
    if (!Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0) {
      return 0;
    }

    this.accumulatorMs += Math.min(frameDeltaMs, this.maxFrameDeltaMs);

    let steps = 0;
    while (
      this.accumulatorMs + STEP_EPSILON_MS >= this.fixedDeltaMs &&
      steps < this.maxCatchUpSteps
    ) {
      this.accumulatorMs = Math.max(0, this.accumulatorMs - this.fixedDeltaMs);
      this.elapsedSimulationMs += this.fixedDeltaMs;
      this.currentTick += 1;
      steps += 1;
      this.emitFrame();
    }

    // A capped frame (stall, background tab) can leave a large backlog. Drop it
    // instead of simulating every missed tick on future frames (spiral of death).
    if (
      steps === this.maxCatchUpSteps &&
      this.accumulatorMs + STEP_EPSILON_MS >= this.fixedDeltaMs
    ) {
      this.accumulatorMs %= this.fixedDeltaMs;
    }

    return steps;
  }

  addFixedUpdate(handler: FixedUpdateHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  removeFixedUpdate(handler: FixedUpdateHandler): void {
    this.handlers.delete(handler);
  }

  /** Clears timing state without removing subscribers. */
  reset(): void {
    this.accumulatorMs = 0;
    this.elapsedSimulationMs = 0;
    this.currentTick = 0;
  }

  private emitFrame(): void {
    const frame: FixedUpdateFrame = {
      tick: this.currentTick,
      deltaMs: this.fixedDeltaMs,
      elapsedMs: this.simulationTimeMs,
      elapsedSeconds: this.simulationTimeMs / 1000,
    };

    for (const handler of this.handlers) {
      handler(frame);
    }
  }
}

export const GAME_LOOP_REGISTRY_KEY = 'riftbound:gameLoop';

/**
 * Retrieves the shared loop that `Game` injects into Phaser's registry.
 * Scenes use this instead of importing a mutable global singleton.
 */
export function getGameLoop(scene: Phaser.Scene): GameLoop | null {
  const loop: unknown = scene.registry.get(GAME_LOOP_REGISTRY_KEY);
  return loop instanceof GameLoop ? loop : null;
}

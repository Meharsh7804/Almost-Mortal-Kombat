/**
 * Shared animation contracts.
 *
 * These types are deliberately Phaser-free: the simulation, tests and future
 * sprite-sheet renderers can all use the same animation identifiers,
 * priorities and clock semantics.
 */

export const ANIMATION_IDS = [
  'IDLE',
  'WALK_FORWARD',
  'WALK_BACKWARD',
  'JUMP_START',
  'JUMP_RISE',
  'JUMP_FALL',
  'LANDING',
  'CROUCH',
  'LIGHT_ATTACK',
  'HEAVY_ATTACK',
  'SPECIAL_ATTACK',
  'BLOCK',
  'PERFECT_GUARD',
  'DODGE_FORWARD',
  'DODGE_BACKWARD',
  'HIT_REACTION',
  'KNOCKBACK',
  'KNOCKDOWN',
  'GET_UP',
  'VICTORY',
  'DEFEAT',
] as const;

export type AnimationId = (typeof ANIMATION_IDS)[number];

/** Numeric animation priorities. Higher values win. */
export const ANIMATION_PRIORITY: Readonly<Record<AnimationId, number>> = Object.freeze({
  DEFEAT: 1000,
  VICTORY: 980,
  KNOCKDOWN: 900,
  KNOCKBACK: 880,
  HIT_REACTION: 800,
  SPECIAL_ATTACK: 620,
  HEAVY_ATTACK: 600,
  LIGHT_ATTACK: 580,
  PERFECT_GUARD: 560,
  BLOCK: 520,
  DODGE_FORWARD: 500,
  DODGE_BACKWARD: 500,
  GET_UP: 460,
  LANDING: 430,
  JUMP_START: 410,
  JUMP_RISE: 400,
  JUMP_FALL: 400,
  CROUCH: 300,
  WALK_FORWARD: 200,
  WALK_BACKWARD: 200,
  IDLE: 100,
});

export interface AnimationDefinition {
  readonly id: AnimationId;
  readonly priority: number;
  /** Default tick duration at a fixed 60 Hz simulation step. */
  readonly durationFrames: number;
  readonly loop: boolean;
  /** Render-only cross-fade length used by the procedural visual. */
  readonly transitionFrames: number;
  /** Whether a different clip of equal priority may interrupt this one. */
  readonly interruptible: boolean;
  /** Whether a changed gameplay key may restart this clip mid-animation. */
  readonly restartOnKeyChange: boolean;
  /** Clip to play automatically when a non-looping clip completes. */
  readonly fallback: AnimationId | null;
}

export interface AnimationRequest {
  readonly id: AnimationId;
  /**
   * Stable gameplay identity for this animation instance. A changed key can
   * restart an attack or reaction without restarting it every simulation tick.
   */
  readonly key: string;
  /** Optional duration override, e.g. the actual combat frame length. */
  readonly durationFrames?: number;
  /** Optional fallback override for a one-shot clip. */
  readonly fallback?: AnimationId | null;
  /**
   * Visual-only recovery request. Used when gameplay exits knockdown and
   * explicitly allows the get-up animation to take over.
   */
  readonly force?: boolean;
}

export interface AnimationSnapshot {
  readonly id: AnimationId;
  readonly key: string;
  readonly priority: number;
  readonly elapsedFrames: number;
  readonly durationFrames: number;
  /** 0..1 within the current pass; looping clips wrap back toward zero. */
  readonly normalizedTime: number;
  readonly loop: boolean;
  readonly complete: boolean;
  readonly transitionSerial: number;
}

export interface AnimationTickResult {
  readonly changed: boolean;
  readonly completed: boolean;
  readonly snapshot: AnimationSnapshot;
}

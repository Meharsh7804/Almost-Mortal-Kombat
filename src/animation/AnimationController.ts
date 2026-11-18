import { getAnimationDefinition } from './AnimationDefinitions';
import type {
  AnimationDefinition,
  AnimationId,
  AnimationRequest,
  AnimationSnapshot,
  AnimationTickResult,
} from './AnimationTypes';

interface ClipState {
  definition: AnimationDefinition;
  key: string;
  elapsedFrames: number;
  durationFrames: number;
  complete: boolean;
  fallback: AnimationId | null;
}

/**
 * Deterministic animation clock.
 *
 * The controller only decides which visual clip is active and how far through
 * it we are. It never advances combat, changes hitboxes or ends an attack:
 * gameplay remains the source of truth and simply feeds requests in.
 */
export class AnimationController {
  private clip: ClipState;
  private serial = 0;

  constructor() {
    this.clip = this.createClip('IDLE', 'idle', undefined, undefined);
  }

  get currentId(): AnimationId {
    return this.clip.definition.id;
  }

  get currentKey(): string {
    return this.clip.key;
  }

  get currentDefinition(): AnimationDefinition {
    return this.clip.definition;
  }

  get currentPriority(): number {
    return this.clip.definition.priority;
  }

  get elapsedFrames(): number {
    return this.clip.elapsedFrames;
  }

  get durationFrames(): number {
    return this.clip.durationFrames;
  }

  get isComplete(): boolean {
    return this.clip.complete;
  }

  get transitionSerial(): number {
    return this.serial;
  }

  /**
   * Request a clip. Returns true when the active clip changed.
   *
   * Same-id requests with an unchanged key are ignored, which prevents the
   * common "restart every render frame" bug.
   */
  request(request: AnimationRequest): boolean {
    const current = this.clip;
    const currentId = current.definition.id;

    if (currentId === request.id && current.key === request.key) {
      return false;
    }

    if (currentId === 'DEFEAT' && request.id !== 'DEFEAT') {
      return false;
    }

    const nextDefinition = getAnimationDefinition(request.id);

    if (!this.canInterrupt(current, nextDefinition, request)) {
      return false;
    }

    this.clip = this.createClip(
      request.id,
      request.key,
      request.durationFrames,
      request.fallback,
    );
    this.serial += 1;
    return true;
  }

  /** Advance exactly one fixed simulation tick. */
  tick(): AnimationTickResult {
    const clip = this.clip;
    let changed = false;

    if (clip.definition.loop) {
      clip.elapsedFrames = (clip.elapsedFrames + 1) % clip.durationFrames;
      clip.complete = false;
    } else if (clip.elapsedFrames + 1 >= clip.durationFrames) {
      clip.elapsedFrames = clip.durationFrames;
      clip.complete = true;

      if (clip.fallback) {
        const fallback = clip.fallback;
        this.clip = this.createClip(fallback, `auto:${fallback}:${this.serial + 1}`, undefined, undefined);
        this.serial += 1;
        changed = true;
      }
    } else {
      clip.elapsedFrames += 1;
    }

    return {
      changed,
      completed: clip.complete,
      snapshot: this.snapshot(),
    };
  }

  snapshot(): AnimationSnapshot {
    const clip = this.clip;
    const durationFrames = Math.max(1, clip.durationFrames);
    const normalizedTime = clip.complete
      ? 1
      : Math.min(1, Math.max(0, clip.elapsedFrames / durationFrames));

    return {
      id: clip.definition.id,
      key: clip.key,
      priority: clip.definition.priority,
      elapsedFrames: clip.elapsedFrames,
      durationFrames,
      normalizedTime,
      loop: clip.definition.loop,
      complete: clip.complete,
      transitionSerial: this.serial,
    };
  }

  reset(): void {
    this.clip = this.createClip('IDLE', 'idle', undefined, undefined);
    this.serial = 0;
  }

  private canInterrupt(
    current: ClipState,
    next: AnimationDefinition,
    request: AnimationRequest,
  ): boolean {
    if (request.force === true) {
      return true;
    }

    if (next.id === current.definition.id) {
      // Same clip, new gameplay instance. Only restart when explicitly allowed.
      return next.restartOnKeyChange;
    }

    if (current.complete) {
      return true;
    }

    // Held/looping clips (idle, walk, crouch, block, jump arc, victory) are
    // gameplay-driven silhouettes: the simulation must always be able to move
    // out of them. Committed one-shots (attacks, reactions, landing, dodge)
    // still require a higher or equal priority to interrupt.
    if (current.definition.loop) {
      return true;
    }

    if (next.priority > current.definition.priority) {
      return true;
    }

    if (next.priority === current.definition.priority) {
      return current.definition.interruptible;
    }

    // Lower priority clips must wait for a non-looping clip to finish.
    return false;
  }

  private createClip(
    id: AnimationId,
    key: string,
    durationOverride: number | undefined,
    fallbackOverride: AnimationId | null | undefined,
  ): ClipState {
    const definition = getAnimationDefinition(id);
    const requestedDuration =
      durationOverride === undefined ? definition.durationFrames : durationOverride;
    const durationFrames = Math.max(1, Math.round(requestedDuration));

    return {
      definition,
      key,
      elapsedFrames: 0,
      durationFrames,
      complete: false,
      fallback: fallbackOverride === undefined ? definition.fallback : fallbackOverride,
    };
  }
}

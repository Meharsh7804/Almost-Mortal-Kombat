import { AnimationController } from './AnimationController';
import { resolveFighterAnimation } from './AnimationResolver';
import {
  clonePose,
  createNeutralPose,
  interpolatePose,
  ProceduralPoseSource,
  type FighterPose,
} from './ProceduralPose';
import type { AnimationId, AnimationSnapshot } from './AnimationTypes';
import type { CharacterVisualConfig } from '../data/CharacterVisuals';
import type { FighterAttackView, FacingDirection } from '../entities/Fighter';
import type { FighterState } from '../entities/FighterStateMachine';

/** Read-only observation of the simulation for one fixed tick. */
export interface FighterAnimationObservation {
  readonly state: FighterState;
  readonly facing: FacingDirection;
  readonly grounded: boolean;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly stateFramesElapsed: number;
  readonly stateDurationFrames: number;
  readonly stateRemainingFrames: number;
  readonly simulationTick: number;
  readonly attack: FighterAttackView | null;
  readonly dodgeDirection: FacingDirection;
  readonly isDefeated: boolean;
  readonly isCrouchBlocking: boolean;
  readonly victory: boolean;
}

export interface FighterAnimatorTick {
  readonly pose: FighterPose;
  readonly snapshot: AnimationSnapshot;
  readonly landed: boolean;
  readonly knockdownLanding: boolean;
  readonly recoveringFromKnockdown: boolean;
}

export interface FighterAnimatorDebug {
  readonly animation: AnimationId;
  readonly key: string;
  readonly priority: number;
  readonly elapsedFrames: number;
  readonly durationFrames: number;
  readonly loop: boolean;
  readonly complete: boolean;
}

const PERFECT_GUARD_FRAMES = 14;
const LANDING_FRAMES = 9;
const GET_UP_FRAMES = 14;

/**
 * Headless animation brain for one fighter.
 *
 * It consumes immutable observations from the simulation once per fixed tick
 * and drives the clip controller, cross-fades and procedural pose sampling.
 * Phaser is deliberately absent so the whole animation path is unit-testable
 * and a future sprite/atlas renderer can replace only the final draw step.
 */
export class FighterAnimator {
  private readonly visual: CharacterVisualConfig;
  private readonly controller = new AnimationController();
  private readonly poseSource = new ProceduralPoseSource();

  private currentPose: FighterPose;
  private blendFromPose: FighterPose;
  private blendElapsed = 0;
  private blendDuration = 0;
  private lastSerial = -1;
  private triggerSerial = 0;
  private poseTick = 0;
  private previousState: FighterState = 'IDLE';
  private previousGrounded = true;

  constructor(visual: CharacterVisualConfig) {
    this.visual = visual;
    this.currentPose = createNeutralPose(visual);
    this.blendFromPose = clonePose(this.currentPose);
  }

  get animationId(): AnimationId {
    return this.controller.currentId;
  }

  get pose(): FighterPose {
    return this.currentPose;
  }

  get debug(): FighterAnimatorDebug {
    const definition = this.controller.currentDefinition;
    return {
      animation: this.controller.currentId,
      key: this.controller.currentKey,
      priority: this.controller.currentPriority,
      elapsedFrames: this.controller.elapsedFrames,
      durationFrames: this.controller.durationFrames,
      loop: definition.loop,
      complete: this.controller.isComplete,
    };
  }

  /** Visual reaction to the typed PERFECT_GUARD combat event. */
  playPerfectGuard(): boolean {
    this.triggerSerial += 1;
    return this.controller.request({
      id: 'PERFECT_GUARD',
      key: `perfect-guard:${this.triggerSerial}`,
      durationFrames: PERFECT_GUARD_FRAMES,
    });
  }

  /** Advance exactly one fixed simulation tick. */
  tick(observation: FighterAnimationObservation): FighterAnimatorTick {
    this.poseTick += 1;

    const landed = !this.previousGrounded && observation.grounded;
    const wasKnockdown =
      this.previousState === 'KNOCKDOWN' || this.previousState === 'DEFEATED';
    const knockdownLanding = landed && wasKnockdown;
    const recoveringFromKnockdown =
      this.previousState === 'KNOCKDOWN' &&
      observation.state !== 'KNOCKDOWN' &&
      observation.grounded &&
      !observation.isDefeated &&
      (observation.state === 'IDLE' ||
        observation.state === 'WALKING' ||
        observation.state === 'CROUCHING');

    if (recoveringFromKnockdown) {
      this.triggerSerial += 1;
      this.controller.request({
        id: 'GET_UP',
        key: `get-up:${this.triggerSerial}`,
        durationFrames: GET_UP_FRAMES,
        force: true,
      });
    } else if (landed) {
      this.triggerSerial += 1;
      this.controller.request({
        id: 'LANDING',
        key: `landing:${this.triggerSerial}`,
        durationFrames: LANDING_FRAMES,
      });
    }

    const resolved = resolveFighterAnimation({
      state: observation.state,
      facing: observation.facing,
      grounded: observation.grounded,
      velocityX: observation.velocityX,
      velocityY: observation.velocityY,
      stateFramesElapsed: observation.stateFramesElapsed,
      stateDurationFrames: observation.stateDurationFrames,
      stateRemainingFrames: observation.stateRemainingFrames,
      simulationTick: observation.simulationTick,
      attack: observation.attack,
      dodgeDirection: observation.dodgeDirection,
      isDefeated: observation.isDefeated,
      isVictory: observation.victory,
    });

    this.controller.request(resolved);
    this.controller.tick();

    if (this.controller.transitionSerial !== this.lastSerial) {
      this.lastSerial = this.controller.transitionSerial;
      this.blendFromPose = clonePose(this.currentPose);
      this.blendDuration = Math.max(1, this.controller.currentDefinition.transitionFrames);
      this.blendElapsed = 0;
    }

    const snapshot = this.controller.snapshot();
    const targetPose = this.poseSource.sample(
      {
        animation: snapshot,
        state: observation.state,
        facing: observation.facing,
        velocityX: observation.velocityX,
        velocityY: observation.velocityY,
        grounded: observation.grounded,
        attack: resolved.attack,
        crouchBlocking: observation.isCrouchBlocking,
        simulationTick: this.poseTick,
      },
      this.visual,
    );

    if (this.blendElapsed < this.blendDuration) {
      this.blendElapsed += 1;
      const amount = smoothstep(this.blendElapsed / this.blendDuration);
      this.currentPose = interpolatePose(this.blendFromPose, targetPose, amount);
    } else {
      this.currentPose = targetPose;
    }

    this.previousState = observation.state;
    this.previousGrounded = observation.grounded;

    return {
      pose: this.currentPose,
      snapshot,
      landed,
      knockdownLanding,
      recoveringFromKnockdown,
    };
  }

  reset(): void {
    this.controller.reset();
    this.currentPose = createNeutralPose(this.visual);
    this.blendFromPose = clonePose(this.currentPose);
    this.blendElapsed = 0;
    this.blendDuration = 0;
    this.lastSerial = -1;
    this.triggerSerial = 0;
    this.poseTick = 0;
    this.previousState = 'IDLE';
    this.previousGrounded = true;
  }
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

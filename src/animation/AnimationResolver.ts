import { totalAttackFrames } from '../combat/FrameData';
import type { FighterAttackView, FacingDirection } from '../entities/Fighter';
import type { FighterState } from '../entities/FighterStateMachine';
import type { AnimationRequest } from './AnimationTypes';

export interface FighterAnimationContext {
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
  readonly isVictory: boolean;
}

export interface ResolvedFighterAnimation extends AnimationRequest {
  readonly attack: FighterAttackView | null;
}

/** First frames of a jump are treated as the takeoff/anticipation beat. */
export const JUMP_START_FRAMES = 5;

/**
 * Pure gameplay-to-animation mapping. Only state that already exists in the
 * combat engine is consulted; this function never mutates the fighter.
 */
export function resolveFighterAnimation(
  context: FighterAnimationContext,
): ResolvedFighterAnimation {
  const stateStartTick = Math.max(
    0,
    context.simulationTick - context.stateFramesElapsed,
  );

  if (context.isDefeated) {
    return {
      id: 'DEFEAT',
      key: 'defeat',
      attack: null,
    };
  }

  if (context.isVictory) {
    return {
      id: 'VICTORY',
      key: 'victory',
      attack: null,
    };
  }

  switch (context.state) {
    case 'KNOCKDOWN': {
      if (!context.grounded) {
        return {
          id: 'KNOCKBACK',
          key: `knockback:${stateStartTick}`,
          durationFrames: Math.max(1, context.stateRemainingFrames),
          attack: null,
        };
      }

      return {
        id: 'KNOCKDOWN',
        key: `knockdown:${stateStartTick}`,
        durationFrames: Math.max(1, context.stateRemainingFrames),
        attack: null,
      };
    }

    case 'HITSTUN':
      return {
        id: 'HIT_REACTION',
        key: `hit:${stateStartTick}`,
        durationFrames: Math.max(1, context.stateRemainingFrames),
        attack: null,
      };

    case 'ATTACKING':
    case 'SPECIAL_ATTACK': {
      return resolveAttackAnimation(context, stateStartTick);
    }

    case 'BLOCKING':
    case 'BLOCKSTUN':
      return {
        id: 'BLOCK',
        key: `block:${stateStartTick}`,
        attack: null,
      };

    case 'DODGING':
      return {
        id:
          context.dodgeDirection === context.facing ? 'DODGE_FORWARD' : 'DODGE_BACKWARD',
        key: `dodge:${stateStartTick}`,
        durationFrames: Math.max(1, context.stateRemainingFrames),
        attack: null,
      };

    case 'JUMPING':
      if (context.stateFramesElapsed < JUMP_START_FRAMES) {
        return {
          id: 'JUMP_START',
          key: `jump-start:${stateStartTick}`,
          durationFrames: JUMP_START_FRAMES,
          attack: null,
        };
      }

      return {
        id: 'JUMP_RISE',
        key: `jump-rise:${stateStartTick}`,
        attack: null,
      };

    case 'FALLING':
      return {
        id: 'JUMP_FALL',
        key: `jump-fall:${stateStartTick}`,
        attack: null,
      };

    case 'CROUCHING':
      return {
        id: 'CROUCH',
        key: 'crouch',
        attack: null,
      };

    case 'WALKING': {
      const forward =
        context.velocityX === 0 ||
        Math.sign(context.velocityX) === context.facing;
      return {
        id: forward ? 'WALK_FORWARD' : 'WALK_BACKWARD',
        key: forward ? 'walk-forward' : 'walk-backward',
        attack: null,
      };
    }

    case 'IDLE':
      return {
        id: 'IDLE',
        key: 'idle',
        attack: null,
      };

    case 'DEFEATED':
      return {
        id: 'DEFEAT',
        key: 'defeat',
        attack: null,
      };
  }
}

function resolveAttackAnimation(
  context: FighterAnimationContext,
  stateStartTick: number,
): ResolvedFighterAnimation {
  const attack = context.attack;

  if (!attack) {
    return {
      id: context.state === 'SPECIAL_ATTACK' ? 'SPECIAL_ATTACK' : 'LIGHT_ATTACK',
      key: `attack:empty:${stateStartTick}`,
      attack: null,
    };
  }

  const id =
    attack.definition.category === 'SPECIAL' || attack.definition.category === 'ULTIMATE'
      ? 'SPECIAL_ATTACK'
      : attack.definition.category === 'HEAVY'
        ? 'HEAVY_ATTACK'
        : 'LIGHT_ATTACK';

  return {
    id,
    key: `attack:${attack.definition.id}:${stateStartTick}`,
    fallback: null,
    durationFrames: Math.max(1, totalAttackFrames(attack.definition)),
    attack,
  };
}

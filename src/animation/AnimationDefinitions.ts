import {
  ANIMATION_PRIORITY,
  type AnimationDefinition,
  type AnimationId,
} from './AnimationTypes';

type DefinitionOptions = Omit<AnimationDefinition, 'priority' | 'id'>;

function define(id: AnimationId, options: DefinitionOptions): AnimationDefinition {
  return Object.freeze({
    id,
    priority: ANIMATION_PRIORITY[id],
    ...options,
  });
}

/**
 * Base animation clips. Attack and reaction clips can be given a duration
 * override that matches their current combat lifecycle, but their priority,
 * loop policy and transition behaviour stay data-driven here.
 */
export const ANIMATION_DEFINITIONS: Readonly<Record<AnimationId, AnimationDefinition>> =
  Object.freeze({
    IDLE: define('IDLE', {
      durationFrames: 120,
      loop: true,
      transitionFrames: 8,
      interruptible: true,
      restartOnKeyChange: false,
      fallback: null,
    }),
    WALK_FORWARD: define('WALK_FORWARD', {
      durationFrames: 32,
      loop: true,
      transitionFrames: 6,
      interruptible: true,
      restartOnKeyChange: false,
      fallback: null,
    }),
    WALK_BACKWARD: define('WALK_BACKWARD', {
      durationFrames: 36,
      loop: true,
      transitionFrames: 6,
      interruptible: true,
      restartOnKeyChange: false,
      fallback: null,
    }),
    JUMP_START: define('JUMP_START', {
      durationFrames: 5,
      loop: false,
      transitionFrames: 3,
      interruptible: true,
      restartOnKeyChange: true,
      fallback: 'JUMP_RISE',
    }),
    JUMP_RISE: define('JUMP_RISE', {
      durationFrames: 24,
      loop: true,
      transitionFrames: 4,
      interruptible: true,
      restartOnKeyChange: false,
      fallback: null,
    }),
    JUMP_FALL: define('JUMP_FALL', {
      durationFrames: 24,
      loop: true,
      transitionFrames: 4,
      interruptible: true,
      restartOnKeyChange: false,
      fallback: null,
    }),
    LANDING: define('LANDING', {
      durationFrames: 9,
      loop: false,
      transitionFrames: 2,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: 'IDLE',
    }),
    CROUCH: define('CROUCH', {
      durationFrames: 72,
      loop: true,
      transitionFrames: 6,
      interruptible: true,
      restartOnKeyChange: false,
      fallback: null,
    }),
    LIGHT_ATTACK: define('LIGHT_ATTACK', {
      durationFrames: 21,
      loop: false,
      transitionFrames: 2,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: null,
    }),
    HEAVY_ATTACK: define('HEAVY_ATTACK', {
      durationFrames: 42,
      loop: false,
      transitionFrames: 3,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: null,
    }),
    SPECIAL_ATTACK: define('SPECIAL_ATTACK', {
      durationFrames: 46,
      loop: false,
      transitionFrames: 3,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: null,
    }),
    BLOCK: define('BLOCK', {
      durationFrames: 90,
      loop: true,
      transitionFrames: 4,
      interruptible: false,
      restartOnKeyChange: false,
      fallback: null,
    }),
    PERFECT_GUARD: define('PERFECT_GUARD', {
      durationFrames: 14,
      loop: false,
      transitionFrames: 2,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: 'BLOCK',
    }),
    DODGE_FORWARD: define('DODGE_FORWARD', {
      durationFrames: 12,
      loop: false,
      transitionFrames: 2,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: null,
    }),
    DODGE_BACKWARD: define('DODGE_BACKWARD', {
      durationFrames: 12,
      loop: false,
      transitionFrames: 2,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: null,
    }),
    HIT_REACTION: define('HIT_REACTION', {
      durationFrames: 18,
      loop: false,
      transitionFrames: 2,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: null,
    }),
    KNOCKBACK: define('KNOCKBACK', {
      durationFrames: 26,
      loop: false,
      transitionFrames: 3,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: null,
    }),
    KNOCKDOWN: define('KNOCKDOWN', {
      durationFrames: 32,
      loop: false,
      transitionFrames: 3,
      interruptible: false,
      restartOnKeyChange: true,
      fallback: null,
    }),
    GET_UP: define('GET_UP', {
      durationFrames: 14,
      loop: false,
      transitionFrames: 3,
      interruptible: true,
      restartOnKeyChange: true,
      fallback: 'IDLE',
    }),
    VICTORY: define('VICTORY', {
      durationFrames: 160,
      loop: true,
      transitionFrames: 10,
      interruptible: false,
      restartOnKeyChange: false,
      fallback: null,
    }),
    DEFEAT: define('DEFEAT', {
      durationFrames: 28,
      loop: false,
      transitionFrames: 4,
      interruptible: false,
      restartOnKeyChange: false,
      fallback: null,
    }),
  });

export function getAnimationDefinition(id: AnimationId): AnimationDefinition {
  return ANIMATION_DEFINITIONS[id];
}

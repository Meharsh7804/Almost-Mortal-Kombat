import { describe, expect, it } from 'vitest';

import { resolveFighterAnimation } from '../src/animation/AnimationResolver';
import type { FighterAnimationContext } from '../src/animation/AnimationResolver';
import {
  ENERGY_BLAST,
  HEAVY_PUNCH,
  LIGHT_PUNCH,
  RISING_STRIKE,
} from '../src/combat/FrameData';
import type { FighterAttackView } from '../src/entities/Fighter';

const BASE: FighterAnimationContext = {
  state: 'IDLE',
  facing: 1,
  grounded: true,
  velocityX: 0,
  velocityY: 0,
  stateFramesElapsed: 0,
  stateDurationFrames: 0,
  stateRemainingFrames: 0,
  simulationTick: 100,
  attack: null,
  dodgeDirection: 1,
  isDefeated: false,
  isVictory: false,
};

function context(overrides: Partial<FighterAnimationContext>): FighterAnimationContext {
  return { ...BASE, ...overrides };
}

function attackView(
  definition: FighterAttackView['definition'],
  phase: FighterAttackView['phase'] = 'ACTIVE',
): FighterAttackView {
  return {
    definition,
    phase,
    phaseProgress: 0.5,
    overallProgress: 0.5,
  };
}

describe('resolveFighterAnimation', () => {
  it('maps neutral gameplay states to their visual clips', () => {
    expect(resolveFighterAnimation(context({})).id).toBe('IDLE');
    expect(resolveFighterAnimation(context({ state: 'WALKING', velocityX: 260 })).id).toBe(
      'WALK_FORWARD',
    );
    expect(resolveFighterAnimation(context({ state: 'WALKING', velocityX: -260 })).id).toBe(
      'WALK_BACKWARD',
    );
    expect(resolveFighterAnimation(context({ state: 'CROUCHING' })).id).toBe('CROUCH');
    expect(resolveFighterAnimation(context({ state: 'BLOCKING' })).id).toBe('BLOCK');
    expect(resolveFighterAnimation(context({ state: 'BLOCKSTUN', stateRemainingFrames: 8 })).id).toBe(
      'BLOCK',
    );
    expect(resolveFighterAnimation(context({ state: 'FALLING', grounded: false })).id).toBe(
      'JUMP_FALL',
    );
  });

  it('splits a jump into takeoff, rise and fall', () => {
    const takeoff = resolveFighterAnimation(
      context({ state: 'JUMPING', grounded: false, stateFramesElapsed: 2, simulationTick: 102 }),
    );
    const rise = resolveFighterAnimation(
      context({ state: 'JUMPING', grounded: false, stateFramesElapsed: 9, simulationTick: 109 }),
    );

    expect(takeoff.id).toBe('JUMP_START');
    expect(takeoff.durationFrames).toBe(5);
    expect(rise.id).toBe('JUMP_RISE');
  });

  it('resolves attacks from frame data category and keeps a stable instance key', () => {
    const light = resolveFighterAnimation(
      context({
        state: 'ATTACKING',
        stateFramesElapsed: 4,
        simulationTick: 104,
        attack: attackView(LIGHT_PUNCH),
      }),
    );
    const sameInstance = resolveFighterAnimation(
      context({
        state: 'ATTACKING',
        stateFramesElapsed: 6,
        simulationTick: 106,
        attack: attackView(LIGHT_PUNCH),
      }),
    );
    const heavy = resolveFighterAnimation(
      context({
        state: 'ATTACKING',
        stateFramesElapsed: 4,
        simulationTick: 104,
        attack: attackView(HEAVY_PUNCH),
      }),
    );
    const special = resolveFighterAnimation(
      context({
        state: 'SPECIAL_ATTACK',
        stateFramesElapsed: 4,
        simulationTick: 104,
        attack: attackView(ENERGY_BLAST),
      }),
    );

    expect(light.id).toBe('LIGHT_ATTACK');
    expect(light.durationFrames).toBe(21);
    expect(sameInstance.key).toBe(light.key);
    expect(heavy.id).toBe('HEAVY_ATTACK');
    expect(heavy.durationFrames).toBe(42);
    expect(special.id).toBe('SPECIAL_ATTACK');
    expect(special.durationFrames).toBe(38);
    expect(special.attack?.definition).toBe(ENERGY_BLAST);

    const chained = resolveFighterAnimation(
      context({
        state: 'SPECIAL_ATTACK',
        stateFramesElapsed: 1,
        simulationTick: 105,
        attack: attackView(RISING_STRIKE),
      }),
    );
    expect(chained.key).not.toBe(special.key);
  });

  it('uses remaining hitstun frames for reaction timing', () => {
    const hit = resolveFighterAnimation(
      context({
        state: 'HITSTUN',
        stateFramesElapsed: 3,
        stateRemainingFrames: 13,
        simulationTick: 103,
      }),
    );

    expect(hit.id).toBe('HIT_REACTION');
    expect(hit.durationFrames).toBe(13);
    expect(hit.key).toBe('hit:100');
  });

  it('distinguishes airborne knockback from a grounded knockdown', () => {
    const airborne = resolveFighterAnimation(
      context({
        state: 'KNOCKDOWN',
        grounded: false,
        stateFramesElapsed: 2,
        stateRemainingFrames: 28,
        simulationTick: 102,
      }),
    );
    const grounded = resolveFighterAnimation(
      context({
        state: 'KNOCKDOWN',
        grounded: true,
        stateFramesElapsed: 10,
        stateRemainingFrames: 20,
        simulationTick: 110,
      }),
    );

    expect(airborne.id).toBe('KNOCKBACK');
    expect(airborne.durationFrames).toBe(28);
    expect(grounded.id).toBe('KNOCKDOWN');
    expect(grounded.durationFrames).toBe(20);
  });

  it('maps dodge direction relative to the fighter facing', () => {
    const forward = resolveFighterAnimation(
      context({
        state: 'DODGING',
        facing: 1,
        dodgeDirection: 1,
        stateRemainingFrames: 12,
      }),
    );
    const backward = resolveFighterAnimation(
      context({
        state: 'DODGING',
        facing: 1,
        dodgeDirection: -1,
        stateRemainingFrames: 12,
      }),
    );

    expect(forward.id).toBe('DODGE_FORWARD');
    expect(backward.id).toBe('DODGE_BACKWARD');
  });

  it('gives defeat precedence over every other state, including victory', () => {
    const defeated = resolveFighterAnimation(
      context({ state: 'KNOCKDOWN', grounded: true, isDefeated: true, isVictory: true }),
    );
    const victory = resolveFighterAnimation(context({ isVictory: true }));

    expect(defeated.id).toBe('DEFEAT');
    expect(victory.id).toBe('VICTORY');
  });

  it('changes the key when a new gameplay instance begins', () => {
    const first = resolveFighterAnimation(
      context({ state: 'HITSTUN', simulationTick: 100, stateFramesElapsed: 0 }),
    );
    const later = resolveFighterAnimation(
      context({ state: 'HITSTUN', simulationTick: 150, stateFramesElapsed: 0 }),
    );

    expect(first.key).not.toBe(later.key);
  });
});

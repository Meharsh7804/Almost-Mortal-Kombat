import { describe, expect, it } from 'vitest';

import {
  FighterAnimator,
  type FighterAnimationObservation,
} from '../src/animation/FighterAnimator';
import { HEAVY_PUNCH, LIGHT_PUNCH } from '../src/combat/FrameData';
import { KAI_VISUAL, RHEA_VISUAL } from '../src/data/CharacterVisuals';
import type { FighterAttackView } from '../src/entities/Fighter';
import type { FighterState } from '../src/entities/FighterStateMachine';

function observation(
  overrides: Partial<FighterAnimationObservation> = {},
): FighterAnimationObservation {
  return {
    state: 'IDLE',
    facing: 1,
    grounded: true,
    velocityX: 0,
    velocityY: 0,
    stateFramesElapsed: 0,
    stateDurationFrames: 0,
    stateRemainingFrames: 0,
    simulationTick: 1,
    attack: null,
    dodgeDirection: 1,
    isDefeated: false,
    isCrouchBlocking: false,
    victory: false,
    ...overrides,
  };
}

function attackView(
  definition: FighterAttackView['definition'],
  phase: FighterAttackView['phase'] = 'ACTIVE',
): FighterAttackView {
  return { definition, phase, phaseProgress: 0.4, overallProgress: 0.4 };
}

function idle(tick: number, overrides: Partial<FighterAnimationObservation> = {}) {
  return observation({ simulationTick: tick, ...overrides });
}

function stateAt(
  state: FighterState,
  grounded: boolean,
  tick: number,
  overrides: Partial<FighterAnimationObservation> = {},
) {
  return observation({ state, grounded, simulationTick: tick, ...overrides });
}

describe('FighterAnimator', () => {
  it('advances idle once per tick without restarting and stays deterministic', () => {
    const first = new FighterAnimator(KAI_VISUAL);
    const second = new FighterAnimator(KAI_VISUAL);
    let firstResult = first.tick(idle(1));
    let secondResult = second.tick(idle(1));

    for (let tick = 2; tick <= 90; tick += 1) {
      firstResult = first.tick(idle(tick));
      secondResult = second.tick(idle(tick));
    }

    expect(first.debug.animation).toBe('IDLE');
    expect(first.debug.key).toBe('idle');
    expect(first.debug.elapsedFrames).toBe(90);
    expect(firstResult.pose).toEqual(secondResult.pose);
    expect(first.debug).toEqual(second.debug);
  });

  it('follows an attack from startup through recovery into idle', () => {
    const animator = new FighterAnimator(KAI_VISUAL);
    animator.tick(idle(10));

    const startTick = 10;
    let result = animator.tick(
      stateAt('ATTACKING', true, 11, {
        stateFramesElapsed: 1,
        attack: attackView(LIGHT_PUNCH, 'STARTUP'),
      }),
    );

    expect(result.snapshot.id).toBe('LIGHT_ATTACK');
    expect(animator.debug.key).toBe('attack:light-punch:10');

    for (let elapsed = 2; elapsed <= 21; elapsed += 1) {
      result = animator.tick(
        stateAt('ATTACKING', true, startTick + elapsed, {
          stateFramesElapsed: elapsed,
          attack: attackView(LIGHT_PUNCH, 'RECOVERY'),
        }),
      );
    }

    expect(result.snapshot.complete).toBe(true);
    expect(animator.debug.elapsedFrames).toBe(21);

    result = animator.tick(idle(40));
    expect(result.snapshot.id).toBe('IDLE');
  });

  it('restarts the correct clip when cancelling into a heavier attack', () => {
    const animator = new FighterAnimator(KAI_VISUAL);
    animator.tick(idle(20));
    animator.tick(
      stateAt('ATTACKING', true, 21, {
        stateFramesElapsed: 1,
        attack: attackView(LIGHT_PUNCH),
      }),
    );
    const result = animator.tick(
      stateAt('ATTACKING', true, 25, {
        stateFramesElapsed: 1,
        attack: attackView(HEAVY_PUNCH),
      }),
    );

    expect(result.snapshot.id).toBe('HEAVY_ATTACK');
    expect(animator.debug.key).toBe('attack:heavy-punch:24');
  });

  it('lets hit reactions interrupt attacks and return to idle afterwards', () => {
    const animator = new FighterAnimator(KAI_VISUAL);
    animator.tick(idle(30));
    animator.tick(
      stateAt('ATTACKING', true, 31, {
        stateFramesElapsed: 1,
        attack: attackView(LIGHT_PUNCH),
      }),
    );

    let result = animator.tick(
      stateAt('HITSTUN', true, 32, {
        stateFramesElapsed: 1,
        stateRemainingFrames: 15,
      }),
    );
    expect(result.snapshot.id).toBe('HIT_REACTION');

    for (let elapsed = 2; elapsed <= 16; elapsed += 1) {
      result = animator.tick(
        stateAt('HITSTUN', true, 31 + elapsed, {
          stateFramesElapsed: elapsed,
          stateRemainingFrames: 17 - elapsed,
        }),
      );
    }

    expect(result.snapshot.complete).toBe(true);
    result = animator.tick(idle(60));
    expect(result.snapshot.id).toBe('IDLE');
  });

  it('plays landing only once and then yields to idle', () => {
    const animator = new FighterAnimator(KAI_VISUAL);
    animator.tick(stateAt('FALLING', false, 1));
    const landing = animator.tick(idle(2));

    expect(landing.landed).toBe(true);
    expect(landing.knockdownLanding).toBe(false);
    expect(landing.snapshot.id).toBe('LANDING');

    for (let tick = 3; tick <= 10; tick += 1) {
      animator.tick(idle(tick));
    }

    expect(animator.debug.animation).toBe('IDLE');
  });

  it('chains knockdown landing into a forced get-up', () => {
    const animator = new FighterAnimator(KAI_VISUAL);
    animator.tick(stateAt('KNOCKDOWN', false, 20));
    expect(animator.debug.animation).toBe('KNOCKBACK');

    const landing = animator.tick(
      stateAt('KNOCKDOWN', true, 21, {
        stateFramesElapsed: 12,
        stateRemainingFrames: 20,
      }),
    );
    expect(landing.knockdownLanding).toBe(true);
    expect(animator.debug.animation).toBe('KNOCKDOWN');

    const recovery = animator.tick(
      idle(22, { stateFramesElapsed: 1, stateDurationFrames: 0 }),
    );
    expect(recovery.recoveringFromKnockdown).toBe(true);
    expect(recovery.snapshot.id).toBe('GET_UP');

    for (let tick = 23; tick <= 35; tick += 1) {
      animator.tick(idle(tick));
    }

    expect(animator.debug.animation).toBe('IDLE');
  });

  it('plays a perfect guard reaction and falls back to blocking', () => {
    const animator = new FighterAnimator(KAI_VISUAL);
    animator.tick(stateAt('BLOCKING', true, 40));
    expect(animator.debug.animation).toBe('BLOCK');

    expect(animator.playPerfectGuard()).toBe(true);
    const guard = animator.tick(stateAt('BLOCKING', true, 41));
    expect(guard.snapshot.id).toBe('PERFECT_GUARD');

    for (let tick = 42; tick <= 55; tick += 1) {
      animator.tick(stateAt('BLOCKING', true, tick));
    }

    expect(animator.debug.animation).toBe('BLOCK');
  });

  it('holds victory briefly and then becomes terminal on defeat', () => {
    const animator = new FighterAnimator(RHEA_VISUAL);
    animator.tick(idle(1));

    const victory = animator.tick(idle(2, { victory: true }));
    expect(victory.snapshot.id).toBe('VICTORY');
    expect(animator.tick(idle(3, { victory: true })).snapshot.id).toBe('VICTORY');

    const defeat = animator.tick(
      observation({
        state: 'DEFEATED',
        isDefeated: true,
        simulationTick: 4,
      }),
    );
    expect(defeat.snapshot.id).toBe('DEFEAT');
    expect(animator.tick(idle(5)).snapshot.id).toBe('DEFEAT');
  });

  it('selects walk direction from velocity and facing', () => {
    const animator = new FighterAnimator(KAI_VISUAL);

    expect(
      animator.tick(
        observation({ state: 'WALKING', velocityX: -300, facing: 1, simulationTick: 1 }),
      ).snapshot.id,
    ).toBe('WALK_BACKWARD');
    expect(
      animator.tick(
        observation({ state: 'WALKING', velocityX: -300, facing: -1, simulationTick: 2 }),
      ).snapshot.id,
    ).toBe('WALK_FORWARD');
  });

  it('resets back to a deterministic idle state', () => {
    const animator = new FighterAnimator(KAI_VISUAL);
    animator.tick(idle(1));
    animator.tick(
      stateAt('ATTACKING', true, 2, {
        stateFramesElapsed: 1,
        attack: attackView(HEAVY_PUNCH),
      }),
    );
    animator.reset();

    expect(animator.debug.animation).toBe('IDLE');
    expect(animator.debug.elapsedFrames).toBe(0);
    expect(animator.tick(idle(1)).pose).toEqual(
      new FighterAnimator(KAI_VISUAL).tick(idle(1)).pose,
    );
  });
});

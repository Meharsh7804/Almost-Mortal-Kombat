import { describe, expect, it } from 'vitest';

import {
  advanceAttack,
  createActiveAttack,
  getAttackPhase,
  getAttackPhaseProgress,
  hasHitTarget,
  markHitTarget,
} from '../src/combat/AttackSystem';
import {
  attackPhaseAtFrame,
  HEAVY_PUNCH,
  LIGHT_PUNCH,
  totalAttackFrames,
} from '../src/combat/FrameData';

describe('attack frame data', () => {
  it('uses the designed light and heavy timing values', () => {
    expect(LIGHT_PUNCH).toMatchObject({
      damage: 5,
      startupFrames: 6,
      activeFrames: 3,
      recoveryFrames: 12,
    });
    expect(HEAVY_PUNCH).toMatchObject({
      damage: 12,
      startupFrames: 14,
      activeFrames: 4,
      recoveryFrames: 24,
    });
    expect(HEAVY_PUNCH.damage).toBeGreaterThan(LIGHT_PUNCH.damage);
    expect(totalAttackFrames(HEAVY_PUNCH)).toBeGreaterThan(totalAttackFrames(LIGHT_PUNCH));
  });

  it('classifies phase boundaries without overlap', () => {
    expect(attackPhaseAtFrame(LIGHT_PUNCH, 0)).toBe('STARTUP');
    expect(attackPhaseAtFrame(LIGHT_PUNCH, 5)).toBe('STARTUP');
    expect(attackPhaseAtFrame(LIGHT_PUNCH, 6)).toBe('ACTIVE');
    expect(attackPhaseAtFrame(LIGHT_PUNCH, 8)).toBe('ACTIVE');
    expect(attackPhaseAtFrame(LIGHT_PUNCH, 9)).toBe('RECOVERY');
    expect(attackPhaseAtFrame(LIGHT_PUNCH, 20)).toBe('RECOVERY');
    expect(attackPhaseAtFrame(LIGHT_PUNCH, 21)).toBe('COMPLETE');
  });
});

describe('attack lifecycle', () => {
  it('runs startup, active, recovery and completion in order', () => {
    const attack = createActiveAttack(LIGHT_PUNCH);

    expect(getAttackPhase(attack)).toBe('STARTUP');

    for (let frame = 0; frame < LIGHT_PUNCH.startupFrames; frame += 1) {
      expect(advanceAttack(attack)).toBe('STARTUP');
    }
    expect(getAttackPhase(attack)).toBe('ACTIVE');

    for (let frame = 0; frame < LIGHT_PUNCH.activeFrames; frame += 1) {
      expect(advanceAttack(attack)).toBe('ACTIVE');
    }
    expect(getAttackPhase(attack)).toBe('RECOVERY');

    for (let frame = 0; frame < LIGHT_PUNCH.recoveryFrames; frame += 1) {
      expect(advanceAttack(attack)).toBe('RECOVERY');
    }
    expect(getAttackPhase(attack)).toBe('COMPLETE');
    expect(advanceAttack(attack)).toBe('COMPLETE');
  });

  it('reports normalized progress inside the current phase', () => {
    const attack = createActiveAttack(HEAVY_PUNCH);

    advanceAttack(attack);
    expect(getAttackPhaseProgress(attack)).toBeGreaterThan(0);
    expect(getAttackPhaseProgress(attack)).toBeLessThan(1);

    for (let frame = 1; frame < HEAVY_PUNCH.startupFrames - 1; frame += 1) {
      advanceAttack(attack);
    }
    expect(getAttackPhase(attack)).toBe('STARTUP');
    expect(getAttackPhaseProgress(attack)).toBeCloseTo(
      (HEAVY_PUNCH.startupFrames - 1) / HEAVY_PUNCH.startupFrames,
      5,
    );

    advanceAttack(attack);
    expect(getAttackPhase(attack)).toBe('ACTIVE');
    expect(getAttackPhaseProgress(attack)).toBe(0);
  });

  it('tracks each victim once per attack instance', () => {
    const attack = createActiveAttack(LIGHT_PUNCH);
    expect(hasHitTarget(attack, 'kai')).toBe(false);

    markHitTarget(attack, 'kai');
    expect(hasHitTarget(attack, 'kai')).toBe(true);
    expect(hasHitTarget(attack, 'rhea')).toBe(false);

    const secondAttack = createActiveAttack(LIGHT_PUNCH);
    expect(hasHitTarget(secondAttack, 'kai')).toBe(false);
  });
});

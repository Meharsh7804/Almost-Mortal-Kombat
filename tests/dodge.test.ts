import { describe, expect, it } from 'vitest';

import { CombatEngine } from '../src/combat/CombatEngine';
import { DEFAULT_COMBAT_TUNING } from '../src/combat/CombatConfig';
import { LIGHT_PUNCH } from '../src/combat/FrameData';
import { FIXED_STEP_SECONDS } from '../src/core/GameLoop';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { advanceCombatFrames, createFighter } from './helpers';

const STATIONARY_DODGE = {
  ...DEFAULT_COMBAT_TUNING,
  dodge: { ...DEFAULT_COMBAT_TUNING.dodge, speed: 0, friction: 0 },
};

function stepFighter(fighter: ReturnType<typeof createFighter>, frames: number): void {
  for (let frame = 0; frame < frames; frame += 1) {
    fighter.step(FIXED_STEP_SECONDS, ARENA_BOUNDS);
  }
}

describe('dodge', () => {
  it('spends energy, grants invulnerability frames and starts cooldown', () => {
    const fighter = createFighter(1, 500);
    expect(fighter.tryDodge(1)).toBe(true);

    expect(fighter.energy).toBe(85);
    expect(fighter.state).toBe('DODGING');
    expect(fighter.isDodging).toBe(true);
    expect(fighter.isInvulnerable).toBe(true);
    expect(fighter.dodgeCooldown).toBe(45);
    expect(fighter.currentDodgeDirection).toBe(1);
    expect(fighter.tryDodge(1)).toBe(false);
  });

  it('becomes vulnerable after five invulnerability frames', () => {
    const fighter = createFighter(1, 500);
    fighter.tryDodge(1);

    for (let frame = 0; frame < 5; frame += 1) {
      stepFighter(fighter, 1);
      expect(fighter.isInvulnerable).toBe(true);
    }

    stepFighter(fighter, 1);
    expect(fighter.isInvulnerable).toBe(false);
    expect(fighter.state).toBe('DODGING');
  });

  it('ends after the configured duration and respects cooldown', () => {
    const fighter = createFighter(1, 500);
    fighter.tryDodge(1);

    stepFighter(fighter, 12);
    expect(fighter.state).toBe('IDLE');
    expect(fighter.dodgeCooldown).toBe(33);
    expect(fighter.tryDodge(1)).toBe(false);

    stepFighter(fighter, 33);
    expect(fighter.dodgeCooldown).toBe(0);
    expect(fighter.tryDodge(1)).toBe(true);
    expect(fighter.energy).toBe(70);
  });

  it('rejects dodges without enough energy', () => {
    const fighter = createFighter(1, 500);
    fighter.spendEnergy(90);

    expect(fighter.tryDodge(1)).toBe(false);
    expect(fighter.state).toBe('IDLE');
    expect(fighter.energy).toBe(10);
  });

  it('defaults to a backward dodge and supports explicit directions', () => {
    const backward = createFighter(1, 500);
    expect(backward.tryDodge()).toBe(true);
    expect(backward.currentDodgeDirection).toBe(-1);
    expect(backward.velocityX).toBeLessThan(0);

    const forward = createFighter(1, 500);
    expect(forward.tryDodge(1)).toBe(true);
    expect(forward.currentDodgeDirection).toBe(1);
    expect(forward.velocityX).toBeGreaterThan(0);
  });

  it('stays inside the arena while dodging backward', () => {
    const fighter = createFighter(1, 123);
    expect(fighter.tryDodge(-1)).toBe(true);

    stepFighter(fighter, 12);
    expect(fighter.x).toBeGreaterThanOrEqual(123);
  });

  it('avoids an eligible attack through invulnerability', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560, { combatTuning: STATIONARY_DODGE });
    const fighters = [attacker, victim] as const;

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 4);

    expect(victim.tryDodge(1)).toBe(true);
    advanceCombatFrames(combat, fighters, 5);

    expect(victim.health).toBe(100);
    expect(victim.state).toBe('DODGING');
  });

  it('still gets hit when the dodge starts before the invulnerability window', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560, { combatTuning: STATIONARY_DODGE });
    const fighters = [attacker, victim] as const;

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    expect(victim.tryDodge(1)).toBe(true);
    advanceCombatFrames(combat, fighters, 7);

    expect(victim.health).toBe(95);
    expect(victim.state).toBe('HITSTUN');
  });
});

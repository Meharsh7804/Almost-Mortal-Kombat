import { describe, expect, it } from 'vitest';

import { CombatEngine } from '../src/combat/CombatEngine';
import { LIGHT_PUNCH } from '../src/combat/FrameData';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import type { Fighter } from '../src/entities/Fighter';
import { createFighter } from './helpers';

function pairs(attacker: Fighter, victim: Fighter): readonly [Fighter, Fighter] {
  return [attacker, victim];
}

describe('combat engine', () => {
  it('does not hit during startup and connects during the active window', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = pairs(attacker, victim);
    const combat = new CombatEngine();

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);

    for (let frame = 0; frame < LIGHT_PUNCH.startupFrames; frame += 1) {
      expect(combat.update(fighters, ARENA_BOUNDS).hits).toHaveLength(0);
    }
    expect(victim.health).toBe(100);

    const result = combat.update(fighters, ARENA_BOUNDS);
    expect(result.hits).toHaveLength(1);

    const hit = result.hits[0]!;
    expect(hit.attacker).toBe(attacker);
    expect(hit.victim).toBe(victim);
    expect(hit.attack).toBe(LIGHT_PUNCH);
    expect(hit.damage).toBe(LIGHT_PUNCH.damage);
    expect(hit.defeated).toBe(false);
    expect(hit.impactX).toBeGreaterThan(attacker.x);
    expect(hit.impactY).toBeLessThan(victim.y);
    expect(victim.health).toBe(95);
    expect(victim.state).toBe('HITSTUN');
  });

  it('applies at most one hit per attack instance', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = pairs(attacker, victim);
    const combat = new CombatEngine();

    attacker.tryStartAttack(LIGHT_PUNCH);
    const frames = LIGHT_PUNCH.startupFrames + LIGHT_PUNCH.activeFrames + 2;
    let totalHits = 0;

    for (let frame = 0; frame < frames; frame += 1) {
      totalHits += combat.update(fighters, ARENA_BOUNDS).hits.length;
    }

    expect(totalHits).toBe(1);
    expect(victim.health).toBe(95);
  });

  it('does not connect when the victim is out of range', () => {
    const attacker = createFighter(1, 300);
    const victim = createFighter(2, 900);
    const fighters = pairs(attacker, victim);
    const combat = new CombatEngine();

    attacker.tryStartAttack(LIGHT_PUNCH);
    let totalHits = 0;

    for (let frame = 0; frame < LIGHT_PUNCH.startupFrames + LIGHT_PUNCH.activeFrames; frame += 1) {
      totalHits += combat.update(fighters, ARENA_BOUNDS).hits.length;
    }

    expect(totalHits).toBe(0);
    expect(victim.health).toBe(100);
  });

  it('resolves simultaneous active hits as a trade', () => {
    const first = createFighter(1, 500);
    const second = createFighter(2, 560);
    const fighters = pairs(first, second);
    const combat = new CombatEngine();

    first.tryStartAttack(LIGHT_PUNCH);
    second.tryStartAttack(LIGHT_PUNCH);

    for (let frame = 0; frame < LIGHT_PUNCH.startupFrames; frame += 1) {
      expect(combat.update(fighters, ARENA_BOUNDS).hits).toHaveLength(0);
    }

    const result = combat.update(fighters, ARENA_BOUNDS);

    expect(result.hits).toHaveLength(2);
    expect(first.health).toBe(95);
    expect(second.health).toBe(95);
    expect(first.state).toBe('HITSTUN');
    expect(second.state).toBe('HITSTUN');
  });

  it('does not hit a defeated victim', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    victim.setDefeated();
    const fighters = pairs(attacker, victim);
    const combat = new CombatEngine();

    attacker.tryStartAttack(LIGHT_PUNCH);
    let totalHits = 0;

    for (let frame = 0; frame < LIGHT_PUNCH.startupFrames + LIGHT_PUNCH.activeFrames; frame += 1) {
      totalHits += combat.update(fighters, ARENA_BOUNDS).hits.length;
    }

    expect(totalHits).toBe(0);
    expect(victim.health).toBe(0);
  });

  it('separates overlapping pushboxes', () => {
    const first = createFighter(1, 500);
    const second = createFighter(2, 510);
    const fighters = pairs(first, second);

    new CombatEngine().update(fighters, ARENA_BOUNDS);

    const minDistance = (first.config.pushboxWidth + second.config.pushboxWidth) / 2;
    expect(Math.abs(second.x - first.x)).toBeCloseTo(minDistance, 5);
  });

  it('turns fighters to face each other', () => {
    const first = createFighter(1, 900);
    const second = createFighter(2, 400);
    const fighters = pairs(first, second);

    new CombatEngine().update(fighters, ARENA_BOUNDS);

    expect(first.facing).toBe(-1);
    expect(second.facing).toBe(1);
  });
});

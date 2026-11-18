import { describe, expect, it } from 'vitest';

import { ComboSystem } from '../src/combat/ComboSystem';
import { createFighter } from './helpers';

describe('combo system', () => {
  it('tracks consecutive hits and applies 100/90/80/70/60 percent scaling', () => {
    const combo = new ComboSystem();
    const results = Array.from({ length: 6 }, () => combo.registerHit('kai', 'rhea', 12, 0));

    expect(results.map((result) => result.scaledDamage)).toEqual([12, 11, 10, 8, 7, 7]);
    expect(results[0]?.started).toBe(true);
    expect(results.slice(1).every((result) => !result.started)).toBe(true);
    expect(results[5]?.hits).toBe(6);
    expect(results[5]?.comboDamage).toBe(55);
    expect(combo.getCombo('kai', 'rhea')).toMatchObject({
      hits: 6,
      damage: 55,
      active: true,
    });
  });

  it('keeps combos separate for each attacker-victim pair', () => {
    const combo = new ComboSystem();
    combo.registerHit('kai', 'rhea', 10, 0);
    combo.registerHit('rhea', 'kai', 10, 0);

    const kaiCombo = combo.registerHit('kai', 'rhea', 10, 1);

    expect(kaiCombo.hits).toBe(2);
    expect(combo.getCombo('rhea', 'kai')?.hits).toBe(1);
    expect(combo.getCombo('kai', 'kai')).toBeNull();
  });

  it('ends a combo when the victim returns to an actionable state', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const combo = new ComboSystem();

    combo.registerHit(attacker.id, victim.id, 10, 1);
    victim.enterHitstun(3);

    expect(combo.update(2, [attacker, victim])).toHaveLength(0);

    for (let frame = 0; frame < 3; frame += 1) {
      victim.step(1 / 60, { left: 96, right: 1184, groundY: 592, width: 1280, height: 720 });
    }

    const ended = combo.update(10, [attacker, victim]);
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({
      attackerId: attacker.id,
      victimId: victim.id,
      hits: 1,
    });
    expect(combo.getCombo(attacker.id, victim.id)).toBeNull();
  });

  it('expires stale combos after the configured timeout', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const combo = new ComboSystem({ timeoutFrames: 5, scaling: [1], maxHits: 10 });

    combo.registerHit(attacker.id, victim.id, 10, 1);
    victim.enterHitstun(100);

    expect(combo.update(5, [attacker, victim])).toHaveLength(0);
    expect(combo.update(7, [attacker, victim])).toHaveLength(1);
  });

  it('does not count blocked or missed attacks by itself', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const combo = new ComboSystem();

    combo.registerHit(attacker.id, victim.id, 5, 1);
    combo.endCombo(attacker.id, victim.id);

    expect(combo.getCombo(attacker.id, victim.id)).toBeNull();
    expect(combo.update(2, [attacker, victim])).toHaveLength(0);
  });

  it('resets all active combos', () => {
    const combo = new ComboSystem();
    combo.registerHit('kai', 'rhea', 10, 1);
    combo.registerHit('rhea', 'kai', 10, 1);

    combo.reset();

    expect(combo.getCombo('kai', 'rhea')).toBeNull();
    expect(combo.getCombo('rhea', 'kai')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { CombatEngine } from '../src/combat/CombatEngine';
import {
  ENERGY_BLAST,
  HEAVY_PUNCH,
  LIGHT_PUNCH,
  LOW_KICK,
  RISING_STRIKE,
} from '../src/combat/FrameData';
import type { AttackDefinition } from '../src/combat/FrameData';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { NEUTRAL_CONTROLS } from '../src/entities/Fighter';
import { advanceCombatFrames, createFighter } from './helpers';

describe('phase 2 combat integration', () => {
  it('chains light into heavy and applies combo damage scaling', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    attacker.spendEnergy(30);
    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 7);

    expect(victim.health).toBe(95);
    expect(combat.getCombo(attacker.id, victim.id)).toMatchObject({
      hits: 1,
      damage: 5,
    });

    expect(attacker.tryStartAttack(HEAVY_PUNCH)).toBe(true);
    expect(attacker.activeAttack?.definition.id).toBe(HEAVY_PUNCH.id);

    advanceCombatFrames(combat, fighters, 15);

    expect(victim.health).toBe(84);
    expect(attacker.energy).toBe(83);
    expect(combat.getCombo(attacker.id, victim.id)).toMatchObject({
      hits: 2,
      damage: 16,
    });
  });

  it('rejects cancels before contact or outside the data window', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 6);
    expect(attacker.activeAttack?.frame).toBe(6);
    expect(attacker.tryStartAttack(HEAVY_PUNCH)).toBe(false);
  });

  it('rejects cancels into disallowed attack categories', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    expect(attacker.tryStartAttack(HEAVY_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 15);
    expect(victim.health).toBe(88);
    expect(attacker.tryStartAttack(LOW_KICK)).toBe(false);
    expect(attacker.tryStartAttack(RISING_STRIKE)).toBe(true);
  });

  it('prevents infinite self-cancel loops', () => {
    const loopAttack: AttackDefinition = {
      ...LIGHT_PUNCH,
      cancelWindows: [
        {
          startFrame: 0,
          endFrame: 999,
          allowedCategories: ['LIGHT'],
          requiresContact: false,
        },
      ],
    };
    const fighter = createFighter(1, 500);

    expect(fighter.tryStartAttack(loopAttack)).toBe(true);
    expect(fighter.tryStartAttack(loopAttack)).toBe(true);
    expect(fighter.tryStartAttack(loopAttack)).toBe(false);
  });

  it('buffers an attack pressed during hitstun and executes it on recovery', () => {
    const fighter = createFighter(1, 500);
    fighter.enterHitstun(3);

    fighter.applyControls({ ...NEUTRAL_CONTROLS, lightPressed: true });
    expect(fighter.bufferedInputs).toHaveLength(1);

    for (let frame = 0; frame < 3; frame += 1) {
      fighter.step(1 / 60, ARENA_BOUNDS);
    }

    expect(fighter.state).toBe('ATTACKING');
    expect(fighter.activeAttack?.definition.id).toBe(LIGHT_PUNCH.id);
    expect(fighter.bufferedInputs).toHaveLength(0);
  });

  it('expires buffered inputs after eight frames', () => {
    const fighter = createFighter(1, 500);
    fighter.enterHitstun(12);

    fighter.applyControls({ ...NEUTRAL_CONTROLS, lightPressed: true });
    for (let frame = 0; frame < 10; frame += 1) {
      fighter.step(1 / 60, ARENA_BOUNDS);
    }
    expect(fighter.bufferedInputs).toHaveLength(1);

    for (let frame = 0; frame < 2; frame += 1) {
      fighter.step(1 / 60, ARENA_BOUNDS);
    }

    expect(fighter.bufferedInputs).toHaveLength(0);
    expect(fighter.activeAttack).toBeNull();
    expect(fighter.state).toBe('IDLE');
  });

  it('does not repeat an attack from a single press', () => {
    const fighter = createFighter(1, 500);
    fighter.applyControls({ ...NEUTRAL_CONTROLS, lightPressed: true });

    expect(fighter.activeAttack).not.toBeNull();
    expect(fighter.bufferedInputs).toHaveLength(0);

    for (let frame = 0; frame < 22; frame += 1) {
      fighter.tickAttack();
    }

    expect(fighter.activeAttack).toBeNull();
    fighter.step(1 / 60, ARENA_BOUNDS);
    expect(fighter.activeAttack).toBeNull();
  });

  it('ends a combo when the victim recovers', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 7);
    expect(combat.getCombo(attacker.id, victim.id)?.hits).toBe(1);

    const results = advanceCombatFrames(combat, fighters, 18);
    const endEvents = results.flatMap((result) =>
      result.events.filter((event) => event.type === 'COMBO_ENDED'),
    );

    expect(combat.getCombo(attacker.id, victim.id)).toBeNull();
    expect(endEvents).toHaveLength(1);
    expect(endEvents[0]).toMatchObject({ hits: 1, damage: 5 });
  });

  it('keeps phase 1 movement and basic attacks intact', () => {
    const fighter = createFighter(1, 500);
    fighter.applyControls({ ...NEUTRAL_CONTROLS, moveRight: true });
    const startX = fighter.x;

    for (let frame = 0; frame < 10; frame += 1) {
      fighter.step(1 / 60, ARENA_BOUNDS);
    }

    expect(fighter.x).toBeGreaterThan(startX);
    expect(['WALKING', 'IDLE']).toContain(fighter.state);
    expect(fighter.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    expect(fighter.state).toBe('ATTACKING');
  });

  it('resets energy, projectiles and cooldowns between rounds', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 900);
    const fighters = [attacker, victim] as const;

    attacker.spendEnergy(70);
    attacker.tryStartAttack(ENERGY_BLAST);
    advanceCombatFrames(combat, fighters, 17);
    expect(combat.projectiles.active).toHaveLength(1);

    attacker.reset();
    victim.reset();
    combat.reset();

    expect(attacker.energy).toBe(100);
    expect(victim.energy).toBe(100);
    expect(combat.projectiles.active).toHaveLength(0);
    expect(combat.getCombo(attacker.id, victim.id)).toBeNull();
    expect(attacker.tryStartAttack(ENERGY_BLAST)).toBe(true);
  });
});

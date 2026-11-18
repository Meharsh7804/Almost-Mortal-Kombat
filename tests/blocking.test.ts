import { describe, expect, it } from 'vitest';

import { CombatEngine } from '../src/combat/CombatEngine';
import { HEAVY_PUNCH, LIGHT_PUNCH, LOW_KICK } from '../src/combat/FrameData';
import { NEUTRAL_CONTROLS, type FighterControls } from '../src/entities/Fighter';
import { advanceCombatFrames, createFighter } from './helpers';

function controls(overrides: Partial<FighterControls>): FighterControls {
  return { ...NEUTRAL_CONTROLS, ...overrides };
}

describe('blocking and perfect guard', () => {
  it('blocks a standing high attack and applies chip damage', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    victim.applyControls(controls({ block: true, blockPressed: true }));
    victim.spendEnergy(50);
    advanceCombatFrames(combat, fighters, 5);

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    const results = advanceCombatFrames(combat, fighters, 7);
    const finalEvents = results.at(-1)?.events ?? [];

    expect(victim.health).toBe(99);
    expect(victim.energy).toBe(53);
    expect(victim.state).toBe('BLOCKSTUN');
    expect(victim.stateRemainingFrames).toBe(LIGHT_PUNCH.blockstunFrames);
    expect(finalEvents).toContainEqual(
      expect.objectContaining({
        type: 'ATTACK_BLOCKED',
        attackId: LIGHT_PUNCH.id,
        chipDamage: 1,
        perfect: false,
      }),
    );
    expect(finalEvents.some((event) => event.type === 'PERFECT_GUARD')).toBe(false);
  });

  it('blocks a mid attack while crouch blocking', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    victim.applyControls(controls({ block: true, blockPressed: true, crouch: true }));
    advanceCombatFrames(combat, fighters, 5);

    expect(attacker.tryStartAttack(HEAVY_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 15);

    expect(victim.health).toBe(98);
    expect(victim.isCrouchBlocking).toBe(true);
    expect(victim.state).toBe('BLOCKSTUN');
  });

  it('does not block a high attack while crouch blocking', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    victim.applyControls(controls({ block: true, blockPressed: true, crouch: true }));
    advanceCombatFrames(combat, fighters, 5);

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 7);

    expect(victim.health).toBe(95);
    expect(victim.state).toBe('HITSTUN');
  });

  it('does not block a low attack while standing blocking', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    victim.applyControls(controls({ block: true, blockPressed: true }));
    advanceCombatFrames(combat, fighters, 5);

    expect(attacker.tryStartAttack(LOW_KICK)).toBe(true);
    advanceCombatFrames(combat, fighters, 6);

    expect(victim.health).toBe(96);
    expect(victim.state).toBe('HITSTUN');
  });

  it('grants a perfect guard within the first four frames of blocking', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    victim.spendEnergy(20);
    expect(victim.energy).toBe(80);

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 3);

    victim.applyControls(controls({ block: true, blockPressed: true }));
    const results = advanceCombatFrames(combat, fighters, 4);
    const finalEvents = results.at(-1)?.events ?? [];

    expect(victim.health).toBe(100);
    expect(victim.energy).toBe(86);
    expect(victim.state).toBe('BLOCKSTUN');
    expect(victim.stateRemainingFrames).toBe(5);
    expect(finalEvents).toContainEqual(
      expect.objectContaining({
        type: 'ATTACK_BLOCKED',
        perfect: true,
        chipDamage: 0,
      }),
    );
    expect(finalEvents).toContainEqual(expect.objectContaining({ type: 'PERFECT_GUARD' }));
  });

  it('falls back to a normal block after the perfect window expires', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    victim.applyControls(controls({ block: true, blockPressed: true }));
    advanceCombatFrames(combat, fighters, 5);

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    const results = advanceCombatFrames(combat, fighters, 7);
    const finalEvents = results.at(-1)?.events ?? [];

    expect(victim.health).toBe(99);
    expect(victim.energy).toBe(100);
    expect(finalEvents.some((event) => event.type === 'PERFECT_GUARD')).toBe(false);
  });

  it('keeps guarding while holding block during blockstun', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    victim.applyControls(controls({ block: true, blockPressed: true }));
    victim.enterBlockstun(20);

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 7);

    expect(victim.health).toBe(99);
    expect(victim.state).toBe('BLOCKSTUN');
  });

  it('reports the defence events through the combat engine', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    victim.applyControls(controls({ block: true, blockPressed: true }));
    advanceCombatFrames(combat, fighters, 5);
    attacker.tryStartAttack(HEAVY_PUNCH);

    const results = advanceCombatFrames(combat, fighters, 15);
    const types = results.flatMap((result) => result.events.map((event) => event.type));

    expect(types).toContain('ATTACK_STARTED');
    expect(types).toContain('ATTACK_BLOCKED');
  });
});

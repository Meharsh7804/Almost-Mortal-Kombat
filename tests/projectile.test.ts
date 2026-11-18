import { describe, expect, it } from 'vitest';

import { CombatEngine } from '../src/combat/CombatEngine';
import { ENERGY_BLAST, LIGHT_PUNCH, RISING_STRIKE } from '../src/combat/FrameData';
import { ProjectileSystem } from '../src/combat/ProjectileSystem';
import { FIXED_STEP_SECONDS } from '../src/core/GameLoop';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { NEUTRAL_CONTROLS, type FighterControls } from '../src/entities/Fighter';
import { advanceCombat, advanceCombatFrames, createFighter } from './helpers';

function controls(overrides: Partial<FighterControls>): FighterControls {
  return { ...NEUTRAL_CONTROLS, ...overrides };
}

describe('projectiles', () => {
  it('spawns a pooled projectile with owner metadata on active frames', () => {
    const system = new ProjectileSystem(2);
    const owner = createFighter(1, 500);

    const projectile = system.spawn(owner, ENERGY_BLAST);

    expect(projectile).not.toBeNull();
    expect(projectile?.active).toBe(true);
    expect(projectile?.owner).toBe(owner);
    expect(projectile?.ownerId).toBe(owner.id);
    expect(projectile?.velocityX).toBe(ENERGY_BLAST.projectile?.speed);
    expect(projectile?.remainingFrames).toBe(ENERGY_BLAST.projectile?.lifetimeFrames);
    expect(system.active).toHaveLength(1);
  });

  it('reuses deactivated projectiles and respects the pool cap', () => {
    const system = new ProjectileSystem(2);
    const owner = createFighter(1, 500);

    const first = system.spawn(owner, ENERGY_BLAST);
    expect(first).not.toBeNull();
    const firstId = first!.id;
    expect(system.spawn(owner, ENERGY_BLAST)).not.toBeNull();
    expect(system.spawn(owner, ENERGY_BLAST)).toBeNull();

    system.deactivate(first!);
    const reused = system.spawn(owner, ENERGY_BLAST);
    expect(reused).not.toBeNull();
    expect(reused?.id).not.toBe(firstId);
    expect(system.active).toHaveLength(2);
  });

  it('expires projectiles after their lifetime', () => {
    const system = new ProjectileSystem(2);
    const owner = createFighter(1, 500);

    system.spawn(owner, ENERGY_BLAST);
    for (let frame = 0; frame < 80; frame += 1) {
      system.update(FIXED_STEP_SECONDS, ARENA_BOUNDS);
    }

    expect(system.active).toHaveLength(0);
  });

  it('casts energy blast, travels, hits once and awards energy', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 900);
    const fighters = [attacker, victim] as const;

    attacker.spendEnergy(30);
    victim.spendEnergy(50);
    expect(attacker.tryStartAttack(ENERGY_BLAST)).toBe(true);
    expect(attacker.state).toBe('SPECIAL_ATTACK');
    expect(attacker.energy).toBe(45);

    advanceCombatFrames(combat, fighters, 17);
    expect(combat.projectiles.active).toHaveLength(1);
    expect(victim.health).toBe(100);

    const results = advanceCombatFrames(combat, fighters, 31);
    const hitEvents = results.flatMap((result) =>
      result.events.filter((event) => event.type === 'ATTACK_CONNECTED'),
    );

    expect(victim.health).toBe(90);
    expect(attacker.health).toBe(100);
    expect(attacker.energy).toBe(51);
    expect(victim.energy).toBe(53);
    expect(combat.projectiles.active).toHaveLength(0);
    expect(hitEvents).toHaveLength(1);
    expect(combat.getCombo(attacker.id, victim.id)).toMatchObject({
      hits: 1,
      damage: 10,
    });
  });

  it('does not hit its owner', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 620);
    const fighters = [attacker, victim] as const;

    expect(attacker.tryStartAttack(ENERGY_BLAST)).toBe(true);
    advanceCombatFrames(combat, fighters, 20);

    expect(attacker.health).toBe(100);
    expect(attacker.energy).toBe(81);
    expect(victim.health).toBe(90);
  });

  it('is blocked by a valid guard for chip damage', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 620);
    const fighters = [attacker, victim] as const;

    victim.applyControls(controls({ block: true, blockPressed: true }));
    advanceCombatFrames(combat, fighters, 5);

    expect(attacker.tryStartAttack(ENERGY_BLAST)).toBe(true);
    const results = advanceCombatFrames(combat, fighters, 17);
    const events = results.flatMap((result) => result.events);

    expect(victim.health).toBe(98);
    expect(victim.state).toBe('BLOCKSTUN');
    expect(victim.stateRemainingFrames).toBe(ENERGY_BLAST.blockstunFrames);
    expect(combat.projectiles.active).toHaveLength(0);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'ATTACK_BLOCKED',
        attackId: ENERGY_BLAST.id,
        chipDamage: 2,
      }),
    );
  });

  it('cannot be cast without energy', () => {
    const attacker = createFighter(1, 500);
    attacker.spendEnergy(90);

    expect(attacker.tryStartAttack(ENERGY_BLAST)).toBe(false);
    expect(attacker.state).toBe('IDLE');
  });

  it('applies special attack cooldowns after casting', () => {
    const attacker = createFighter(1, 500);

    expect(attacker.tryStartAttack(ENERGY_BLAST)).toBe(true);
    attacker.cancelAttack();
    expect(attacker.tryStartAttack(ENERGY_BLAST)).toBe(false);
    expect(attacker.tryStartAttack(RISING_STRIKE)).toBe(true);
  });

  it('allows melee cancels to trigger special attacks', () => {
    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    const fighters = [attacker, victim] as const;

    expect(attacker.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    advanceCombatFrames(combat, fighters, 7);

    expect(attacker.tryStartAttack(RISING_STRIKE)).toBe(true);
    expect(attacker.energy).toBe(75);
    expect(attacker.state).toBe('SPECIAL_ATTACK');
    advanceCombat(combat, fighters);
    expect(attacker.activeAttack?.definition.id).toBe(RISING_STRIKE.id);
  });
});

import type { CombatTuning } from './CombatConfig';
import type { Fighter } from '../entities/Fighter';
import type { AttackDefinition } from './FrameData';

export interface DamageApplication {
  readonly applied: number;
  readonly defeated: boolean;
  readonly victimId: string;
}

export interface BlockApplication {
  readonly chipDamage: number;
  readonly defeated: boolean;
  readonly victimId: string;
  readonly blockstunFrames: number;
  readonly perfect: boolean;
}

/**
 * Resolves a clean hit. The damage system owns health clamping, hit reactions,
 * knockback direction and defeat handling; attack timing and collision stay in
 * the attack and hitbox systems.
 */
export function applyHit(
  attacker: Fighter,
  victim: Fighter,
  attack: AttackDefinition,
  damage: number = attack.damage,
): DamageApplication {
  if (victim.isDefeated || victim.health <= 0 || damage <= 0) {
    return { applied: 0, defeated: false, victimId: victim.id };
  }

  const applied = victim.takeDamage(damage);
  if (applied <= 0) {
    return { applied: 0, defeated: false, victimId: victim.id };
  }

  victim.cancelAttack();

  const offset = victim.x - attacker.x;
  const direction = offset === 0 ? attacker.facing : offset > 0 ? 1 : -1;
  victim.applyKnockback(direction * attack.knockback, attack.launchForce);

  if (victim.health <= 0) {
    victim.setDefeated();
    return { applied, defeated: true, victimId: victim.id };
  }

  if (attack.causesKnockdown) {
    victim.enterKnockdown(attack.hitstunFrames);
  } else {
    victim.enterHitstun(attack.hitstunFrames);
  }

  return { applied, defeated: false, victimId: victim.id };
}

export function applyBlock(
  attackerX: number,
  victim: Fighter,
  attack: AttackDefinition,
  perfect: boolean,
  tuning: CombatTuning,
): BlockApplication {
  const blockstunFrames = perfect
    ? Math.max(1, Math.ceil(attack.blockstunFrames * tuning.perfectGuardBlockstunScale))
    : attack.blockstunFrames;

  victim.enterBlockstun(blockstunFrames);

  const direction = victim.x === attackerX ? victim.facing : victim.x > attackerX ? 1 : -1;
  victim.applyKnockback(direction * attack.knockback * 0.3, 0);

  const chipDamage = perfect ? 0 : Math.max(0, attack.chipDamage);
  const appliedChip = chipDamage > 0 ? victim.takeDamage(chipDamage) : 0;

  if (victim.health <= 0) {
    victim.setDefeated();
    return {
      chipDamage: appliedChip,
      defeated: true,
      victimId: victim.id,
      blockstunFrames,
      perfect,
    };
  }

  return {
    chipDamage: appliedChip,
    defeated: false,
    victimId: victim.id,
    blockstunFrames,
    perfect,
  };
}

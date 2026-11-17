import type { Fighter } from '../entities/Fighter';
import type { AttackDefinition } from './FrameData';

export interface DamageApplication {
  readonly applied: number;
  readonly defeated: boolean;
  readonly victimId: string;
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
): DamageApplication {
  if (victim.isDefeated || victim.health <= 0) {
    return { applied: 0, defeated: false, victimId: victim.id };
  }

  const applied = victim.takeDamage(attack.damage);
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

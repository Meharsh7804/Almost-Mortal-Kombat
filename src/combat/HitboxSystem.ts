import type { FacingDirection, Fighter } from '../entities/Fighter';
import type { AABB } from '../utils/CollisionUtils';
import { rectanglesIntersect } from '../utils/CollisionUtils';
import type { AttackHitboxDefinition } from './FrameData';

/**
 * Places an attack hitbox in world space. `offsetX` is mirrored by the
 * fighter's facing direction, while `offsetY` is measured upward from the
 * fighter's feet. This keeps attacks aligned in both directions.
 */
export function computeAttackHitbox(
  originX: number,
  feetY: number,
  facing: FacingDirection,
  hitbox: AttackHitboxDefinition,
): AABB {
  const centerX = originX + facing * hitbox.offsetX;

  return {
    x: centerX - hitbox.width / 2,
    y: feetY - hitbox.offsetY - hitbox.height / 2,
    width: hitbox.width,
    height: hitbox.height,
  };
}

/** Current attack box regardless of frame phase; null when not attacking. */
export function getAttackBox(fighter: Fighter): AABB | null {
  const attack = fighter.activeAttack;
  if (!attack) {
    return null;
  }

  return computeAttackHitbox(fighter.x, fighter.y, fighter.facing, attack.definition.hitbox);
}

/** Hitbox only while the attack is in its active window. */
export function getActiveAttackHitbox(fighter: Fighter): AABB | null {
  if (!fighter.activeAttack || fighter.getAttackPhase() !== 'ACTIVE') {
    return null;
  }

  return getAttackBox(fighter);
}

/**
 * Full validity check for a hit: active window, untouched target and real
 * hitbox/hurtbox intersection. CombatEngine performs the same checks while
 * owning the frame advance; this helper is used by diagnostics and tests.
 */
export function attackConnects(attacker: Fighter, defender: Fighter): boolean {
  if (attacker.isDefeated || defender.isDefeated) {
    return false;
  }

  const attack = attacker.activeAttack;
  if (!attack || attack.hitTargets.has(defender.id)) {
    return false;
  }

  const hitbox = getActiveAttackHitbox(attacker);
  return hitbox !== null && rectanglesIntersect(hitbox, defender.getHurtbox());
}

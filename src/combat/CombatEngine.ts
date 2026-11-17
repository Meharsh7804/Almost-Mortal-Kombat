import type { ArenaBounds } from '../data/ArenaConfig';
import type { Fighter } from '../entities/Fighter';
import {
  getBoxCenter,
  getIntersection,
  rectanglesIntersect,
  type AABB,
} from '../utils/CollisionUtils';
import { applyHit } from './DamageSystem';
import type { AttackDefinition } from './FrameData';
import { getAttackBox } from './HitboxSystem';

export interface HitEvent {
  readonly attacker: Fighter;
  readonly victim: Fighter;
  readonly attack: AttackDefinition;
  readonly damage: number;
  readonly defeated: boolean;
  readonly impactX: number;
  readonly impactY: number;
}

export interface CombatTickResult {
  readonly hits: readonly HitEvent[];
}

interface PendingHit {
  readonly attacker: Fighter;
  readonly victim: Fighter;
  readonly attack: AttackDefinition;
  readonly activeAttack: NonNullable<Fighter['activeAttack']>;
  readonly hitbox: AABB;
  readonly hurtbox: AABB;
}

/**
 * Owns attack advancement, hit validation, damage resolution, pushbox
 * separation and automatic facing. It runs exactly once per fixed simulation
 * tick, so a hit cannot be applied twice by extra render frames.
 */
export class CombatEngine {
  update(fighters: readonly [Fighter, Fighter], arena: ArenaBounds): CombatTickResult {
    this.updateFacing(fighters);

    const pairs: ReadonlyArray<readonly [Fighter, Fighter]> = [
      [fighters[0], fighters[1]],
      [fighters[1], fighters[0]],
    ];
    const pending: PendingHit[] = [];

    for (const [attacker, victim] of pairs) {
      const activeAttack = attacker.activeAttack;
      if (!activeAttack) {
        continue;
      }

      const phase = attacker.tickAttack();
      if (phase !== 'ACTIVE' || attacker.isDefeated || victim.isDefeated) {
        continue;
      }
      if (activeAttack.hitTargets.has(victim.id)) {
        continue;
      }

      const hitbox = getAttackBox(attacker);
      if (!hitbox) {
        continue;
      }

      const hurtbox = victim.getHurtbox();
      if (!rectanglesIntersect(hitbox, hurtbox)) {
        continue;
      }

      pending.push({
        attacker,
        victim,
        attack: activeAttack.definition,
        activeAttack,
        hitbox,
        hurtbox,
      });
    }

    const hits: HitEvent[] = [];

    for (const pendingHit of pending) {
      pendingHit.activeAttack.hitTargets.add(pendingHit.victim.id);
      const result = applyHit(pendingHit.attacker, pendingHit.victim, pendingHit.attack);
      if (result.applied <= 0) {
        continue;
      }

      const intersection = getIntersection(pendingHit.hitbox, pendingHit.hurtbox);
      const impact = intersection
        ? getBoxCenter(intersection)
        : { x: pendingHit.victim.x, y: pendingHit.victim.y - 100 };

      hits.push({
        attacker: pendingHit.attacker,
        victim: pendingHit.victim,
        attack: pendingHit.attack,
        damage: result.applied,
        defeated: result.defeated,
        impactX: impact.x,
        impactY: impact.y,
      });
    }

    this.separatePushboxes(fighters, arena);
    this.updateFacing(fighters);

    return { hits };
  }

  updateFacing(fighters: readonly [Fighter, Fighter]): void {
    fighters[0].faceTowards(fighters[1].x);
    fighters[1].faceTowards(fighters[0].x);
  }

  separatePushboxes(fighters: readonly [Fighter, Fighter], arena: ArenaBounds): void {
    const a = fighters[0];
    const b = fighters[1];
    const boxA = a.getPushbox();
    const boxB = b.getPushbox();

    if (!rectanglesIntersect(boxA, boxB)) {
      return;
    }

    const minimumDistance = (boxA.width + boxB.width) / 2;
    const signedDistance = b.x - a.x;
    const direction: 1 | -1 =
      signedDistance === 0
        ? a.playerNumber < b.playerNumber
          ? 1
          : -1
        : signedDistance > 0
          ? 1
          : -1;

    const overlap = minimumDistance - Math.abs(signedDistance);
    if (overlap <= 0) {
      return;
    }

    a.setHorizontalPosition(a.x - (direction * overlap) / 2);
    b.setHorizontalPosition(b.x + (direction * overlap) / 2);
    this.clampFighterX(a, arena);
    this.clampFighterX(b, arena);

    let remaining = minimumDistance - Math.abs(b.x - a.x);
    if (remaining <= 0) {
      return;
    }

    if (direction > 0) {
      const bMaximum = arena.right - boxB.width / 2;
      const bShift = Math.min(remaining, Math.max(0, bMaximum - b.x));
      b.setHorizontalPosition(b.x + bShift);
      remaining -= bShift;

      if (remaining > 0) {
        const aMinimum = arena.left + boxA.width / 2;
        const aShift = Math.min(remaining, Math.max(0, a.x - aMinimum));
        a.setHorizontalPosition(a.x - aShift);
      }
    } else {
      const bMinimum = arena.left + boxB.width / 2;
      const bShift = Math.min(remaining, Math.max(0, b.x - bMinimum));
      b.setHorizontalPosition(b.x - bShift);
      remaining -= bShift;

      if (remaining > 0) {
        const aMaximum = arena.right - boxA.width / 2;
        const aShift = Math.min(remaining, Math.max(0, aMaximum - a.x));
        a.setHorizontalPosition(a.x + aShift);
      }
    }

    this.clampFighterX(a, arena);
    this.clampFighterX(b, arena);
  }

  private clampFighterX(fighter: Fighter, arena: ArenaBounds): void {
    const halfWidth = fighter.getPushbox().width / 2;
    const clamped = Math.min(arena.right - halfWidth, Math.max(arena.left + halfWidth, fighter.x));
    fighter.setHorizontalPosition(clamped);
  }
}

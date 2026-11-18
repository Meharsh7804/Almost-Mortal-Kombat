import type { ArenaBounds } from '../data/ArenaConfig';
import type { Fighter } from '../entities/Fighter';
import {
  getBoxCenter,
  getIntersection,
  rectanglesIntersect,
  type AABB,
} from '../utils/CollisionUtils';
import { FIXED_STEP_SECONDS } from '../core/GameLoop';
import type { ActiveAttack } from './AttackSystem';
import { DEFAULT_COMBAT_TUNING, type CombatTuning } from './CombatConfig';
import { ComboSystem, type ComboSnapshot } from './ComboSystem';
import type { CombatEvent } from './CombatEvents';
import { applyBlock, applyHit } from './DamageSystem';
import { guardMatches, type AttackDefinition } from './FrameData';
import { getAttackBox } from './HitboxSystem';
import { ProjectileSystem, type Projectile } from './ProjectileSystem';

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
  readonly events: readonly CombatEvent[];
  readonly hitstopFrames: number;
}

interface PendingHit {
  readonly attacker: Fighter;
  readonly victim: Fighter;
  readonly attack: AttackDefinition;
  readonly activeAttack: ActiveAttack | null;
  readonly projectile: Projectile | null;
  readonly sourceX: number;
  readonly hitbox: AABB;
  readonly hurtbox: AABB;
}

type GuardOutcome = 'none' | 'blocked' | 'perfect';

/**
 * Owns attack advancement, hit validation, damage resolution, pushbox
 * separation and automatic facing. It runs exactly once per fixed simulation
 * tick, so a hit cannot be applied twice by extra render frames.
 */
export class CombatEngine {
  readonly projectiles = new ProjectileSystem();

  private readonly tuning: CombatTuning;
  private readonly combo: ComboSystem;
  private currentTick = 0;

  constructor(tuning: CombatTuning = DEFAULT_COMBAT_TUNING) {
    this.tuning = tuning;
    this.combo = new ComboSystem({
      timeoutFrames: tuning.comboTimeoutFrames,
      scaling: tuning.comboScaling,
      maxHits: tuning.maxComboHits,
    });
  }

  get tick(): number {
    return this.currentTick;
  }

  getCombo(attackerId: string, victimId: string): ComboSnapshot | null {
    return this.combo.getCombo(attackerId, victimId);
  }

  reset(): void {
    this.currentTick = 0;
    this.combo.reset();
    this.projectiles.reset();
  }

  update(fighters: readonly [Fighter, Fighter], arena: ArenaBounds): CombatTickResult {
    this.currentTick += 1;
    this.updateFacing(fighters);

    const events: CombatEvent[] = [];
    fighters[0].drainEvents(events);
    fighters[1].drainEvents(events);

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
      if (attacker.isDefeated || phase !== 'ACTIVE') {
        continue;
      }

      if (activeAttack.definition.projectile) {
        if (!activeAttack.projectileSpawned) {
          const spawned = this.projectiles.spawn(attacker, activeAttack.definition);
          if (spawned) {
            activeAttack.projectileSpawned = true;
          }
        }
        continue;
      }

      if (victim.isDefeated || activeAttack.hitTargets.has(victim.id)) {
        continue;
      }

      if (victim.isInvulnerable && activeAttack.definition.canBeDodged) {
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
        projectile: null,
        sourceX: attacker.x,
        hitbox,
        hurtbox,
      });
    }

    this.projectiles.update(FIXED_STEP_SECONDS, arena);

    for (const projectile of this.projectiles.active) {
      const attack = projectile.attack;
      const owner = projectile.owner;
      if (!attack || !owner) {
        continue;
      }

      const maxHits = attack.projectile?.maxHits ?? 1;
      if (projectile.hitTargets.size >= maxHits) {
        continue;
      }

      const projectileBox = this.projectiles.getBounds(projectile);
      if (!projectileBox) {
        continue;
      }

      for (const victim of fighters) {
        if (
          victim.id === owner.id ||
          victim.isDefeated ||
          projectile.hitTargets.has(victim.id) ||
          victim.health <= 0
        ) {
          continue;
        }
        if (victim.isInvulnerable && attack.canBeDodged) {
          continue;
        }

        const hurtbox = victim.getHurtbox();
        if (!rectanglesIntersect(projectileBox, hurtbox)) {
          continue;
        }

        pending.push({
          attacker: owner,
          victim,
          attack,
          activeAttack: null,
          projectile,
          sourceX: projectile.x,
          hitbox: projectileBox,
          hurtbox,
        });
      }
    }

    const hits: HitEvent[] = [];
    let hitstopFrames = 0;

    for (const pendingHit of pending) {
      if (pendingHit.projectile) {
        pendingHit.projectile.hitTargets.add(pendingHit.victim.id);
      } else {
        pendingHit.activeAttack?.hitTargets.add(pendingHit.victim.id);
      }

      const impact = this.resolveImpact(pendingHit);
      const guard = this.evaluateGuard(pendingHit.victim, pendingHit.attack, pendingHit.sourceX);

      if (guard !== 'none') {
        const perfect = guard === 'perfect';
        const endedCombo = this.combo.endCombo(pendingHit.attacker.id, pendingHit.victim.id);
        if (endedCombo) {
          events.push({
            type: 'COMBO_ENDED',
            attackerId: endedCombo.attackerId,
            victimId: endedCombo.victimId,
            hits: endedCombo.hits,
            damage: endedCombo.damage,
          });
        }

        const block = applyBlock(
          pendingHit.sourceX,
          pendingHit.victim,
          pendingHit.attack,
          perfect,
          this.tuning,
        );

        events.push({
          type: 'ATTACK_BLOCKED',
          attackerId: pendingHit.attacker.id,
          victimId: pendingHit.victim.id,
          attackId: pendingHit.attack.id,
          chipDamage: block.chipDamage,
          perfect,
          impactX: impact.x,
          impactY: impact.y,
        });

        if (perfect) {
          pendingHit.victim.gainEnergy(pendingHit.victim.energyRules.gainOnPerfectGuard);
          events.push({
            type: 'PERFECT_GUARD',
            fighterId: pendingHit.victim.id,
            playerNumber: pendingHit.victim.playerNumber,
            attackerId: pendingHit.attacker.id,
            attackId: pendingHit.attack.id,
          });
        }

        if (block.chipDamage > 0) {
          pendingHit.victim.gainEnergy(pendingHit.victim.energyRules.gainOnTakingDamage);
          events.push({
            type: 'FIGHTER_DAMAGED',
            fighterId: pendingHit.victim.id,
            playerNumber: pendingHit.victim.playerNumber,
            amount: block.chipDamage,
            health: pendingHit.victim.health,
            maxHealth: pendingHit.victim.maxHealth,
          });
        }

        if (block.defeated) {
          events.push({
            type: 'FIGHTER_DEFEATED',
            fighterId: pendingHit.victim.id,
            playerNumber: pendingHit.victim.playerNumber,
          });
        }

        if (pendingHit.projectile) {
          this.projectiles.deactivate(pendingHit.projectile);
        }

        hitstopFrames = Math.max(
          hitstopFrames,
          perfect ? 1 : Math.max(1, pendingHit.attack.hitstopFrames - 1),
        );
        continue;
      }

      if (pendingHit.victim.health <= 0) {
        if (pendingHit.projectile) {
          this.projectiles.deactivate(pendingHit.projectile);
        }
        continue;
      }

      const combo = this.combo.registerHit(
        pendingHit.attacker.id,
        pendingHit.victim.id,
        pendingHit.attack.damage,
        this.currentTick,
      );

      const result = applyHit(
        pendingHit.attacker,
        pendingHit.victim,
        pendingHit.attack,
        combo.scaledDamage,
      );

      if (pendingHit.projectile) {
        this.projectiles.deactivate(pendingHit.projectile);
      }

      if (result.applied <= 0) {
        continue;
      }

      pendingHit.attacker.gainEnergy(pendingHit.attack.energyGainOnHit);
      pendingHit.victim.gainEnergy(pendingHit.victim.energyRules.gainOnTakingDamage);

      events.push({
        type: combo.started ? 'COMBO_STARTED' : 'COMBO_UPDATED',
        attackerId: pendingHit.attacker.id,
        victimId: pendingHit.victim.id,
        hits: combo.hits,
        damage: combo.comboDamage,
      });

      events.push({
        type: 'ATTACK_CONNECTED',
        attackerId: pendingHit.attacker.id,
        victimId: pendingHit.victim.id,
        attackId: pendingHit.attack.id,
        damage: result.applied,
        comboHits: combo.hits,
        impactX: impact.x,
        impactY: impact.y,
      });

      events.push({
        type: 'FIGHTER_DAMAGED',
        fighterId: pendingHit.victim.id,
        playerNumber: pendingHit.victim.playerNumber,
        amount: result.applied,
        health: pendingHit.victim.health,
        maxHealth: pendingHit.victim.maxHealth,
      });

      if (result.defeated) {
        events.push({
          type: 'FIGHTER_DEFEATED',
          fighterId: pendingHit.victim.id,
          playerNumber: pendingHit.victim.playerNumber,
        });
      }

      hits.push({
        attacker: pendingHit.attacker,
        victim: pendingHit.victim,
        attack: pendingHit.attack,
        damage: result.applied,
        defeated: result.defeated,
        impactX: impact.x,
        impactY: impact.y,
      });

      hitstopFrames = Math.max(hitstopFrames, pendingHit.attack.hitstopFrames);
    }

    const endedCombos = this.combo.update(this.currentTick, fighters);
    for (const ended of endedCombos) {
      events.push({
        type: 'COMBO_ENDED',
        attackerId: ended.attackerId,
        victimId: ended.victimId,
        hits: ended.hits,
        damage: ended.damage,
      });
    }

    this.separatePushboxes(fighters, arena);
    this.updateFacing(fighters);

    return { hits, events, hitstopFrames };
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

  private evaluateGuard(victim: Fighter, attack: AttackDefinition, sourceX: number): GuardOutcome {
    if (!attack.canBeBlocked || attack.guardType === 'UNBLOCKABLE') {
      return 'none';
    }
    if (!victim.isBlocking && !(victim.isBlockstunned && victim.isHoldingBlock)) {
      return 'none';
    }
    if (!victim.isFacingPosition(sourceX)) {
      return 'none';
    }
    if (!guardMatches(attack.guardType, victim.isCrouchBlocking)) {
      return 'none';
    }

    return victim.tryPerfectGuard() ? 'perfect' : 'blocked';
  }

  private resolveImpact(pendingHit: PendingHit): { x: number; y: number } {
    const intersection = getIntersection(pendingHit.hitbox, pendingHit.hurtbox);
    if (intersection) {
      return getBoxCenter(intersection);
    }

    return { x: pendingHit.victim.x, y: pendingHit.victim.y - 100 };
  }

  private clampFighterX(fighter: Fighter, arena: ArenaBounds): void {
    const halfWidth = fighter.getPushbox().width / 2;
    const clamped = Math.min(arena.right - halfWidth, Math.max(arena.left + halfWidth, fighter.x));
    fighter.setHorizontalPosition(clamped);
  }
}

import { computeAttackHitbox } from '../combat/HitboxSystem';
import type { AttackDefinition } from '../combat/FrameData';
import type { Fighter } from '../entities/Fighter';
import { boxFromCenterBottom, type AABB } from '../utils/CollisionUtils';
import type { AIAttackThreat, AIPerceptionInput, AIPerceptionSnapshot } from './AITypes';

const CORNER_MARGIN = 110;

function attackReachX(fighter: Fighter, attack: AttackDefinition): number {
  return attack.hitbox.offsetX + attack.hitbox.width * 0.5 + fighter.config.pushboxWidth * 0.2;
}

function attackReachY(attack: AttackDefinition): number {
  return attack.hitbox.offsetY + attack.hitbox.height * 0.5;
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && bMin <= aMax;
}

function intersects(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function estimateProjectileThreat(
  self: Fighter,
  projectiles: readonly AIPerceptionInput['projectiles'][number][],
): AIAttackThreat | null {
  const hurtbox = self.getHurtbox();
  let best: AIAttackThreat | null = null;

  for (const projectile of projectiles) {
    if (!projectile.active || !projectile.attack?.projectile || projectile.ownerId === self.id) {
      continue;
    }

    const bounds = {
      x: projectile.x - projectile.attack.projectile.width / 2,
      y: projectile.y - projectile.attack.projectile.height / 2,
      width: projectile.attack.projectile.width,
      height: projectile.attack.projectile.height,
    };

    const horizontalDistance =
      projectile.direction > 0 ? hurtbox.x - (bounds.x + bounds.width) : bounds.x - (hurtbox.x + hurtbox.width);
    if (horizontalDistance < -bounds.width) {
      continue;
    }

    const yOverlap = rangesOverlap(bounds.y, bounds.y + bounds.height, hurtbox.y, hurtbox.y + hurtbox.height);
    const verticalNear = Math.abs(projectile.y - (hurtbox.y + hurtbox.height * 0.5)) < bounds.height + 70;
    if (!yOverlap && !verticalNear) {
      continue;
    }

    const eta = Math.max(0, Math.round(Math.max(0, horizontalDistance) / Math.max(1, projectile.attack.projectile.speed / 60)));
    const threat: AIAttackThreat = {
      active: true,
      attack: projectile.attack,
      attackView: null,
      isProjectile: true,
      sourceX: projectile.x,
      rangeX: bounds.width * 0.5,
      rangeY: bounds.height * 0.5,
      framesUntilImpactEstimate: eta,
      canBeBlocked: projectile.attack.canBeBlocked,
      guardType: projectile.attack.guardType,
      highThreat: eta <= 18 || intersects(bounds, boxFromCenterBottom(self.x, self.y, hurtbox.width + 18, hurtbox.height)),
    };

    if (!best || threat.framesUntilImpactEstimate < best.framesUntilImpactEstimate) {
      best = threat;
    }
  }

  return best;
}

function estimateAttackThreat(self: Fighter, opponent: Fighter): AIAttackThreat {
  const view = opponent.getAttackView();
  const none: AIAttackThreat = {
    active: false,
    attack: null,
    attackView: view,
    isProjectile: false,
    sourceX: opponent.x,
    rangeX: 0,
    rangeY: 0,
    framesUntilImpactEstimate: 999,
    canBeBlocked: false,
    guardType: 'NONE',
    highThreat: false,
  };

  if (!view) {
    return none;
  }

  const attack = view.definition;
  if (attack.projectile) {
    // Projectile spawn/active travel is handled separately via projectile perception.
    return {
      ...none,
      attack,
      attackView: view,
      isProjectile: true,
    };
  }

  const remainingStartup = view.phase === 'STARTUP' ? Math.max(0, attack.startupFrames - Math.floor(view.overallProgress * (attack.startupFrames + attack.activeFrames + attack.recoveryFrames))) : view.phase === 'ACTIVE' ? 0 : 999;
  const activeOrSoon = view.phase === 'ACTIVE' || (view.phase === 'STARTUP' && remainingStartup <= 10);
  if (!activeOrSoon) {
    return {
      ...none,
      attack,
      attackView: view,
      framesUntilImpactEstimate: remainingStartup,
      canBeBlocked: attack.canBeBlocked,
      guardType: attack.guardType,
    };
  }

  const hitbox = computeAttackHitbox(opponent.x, opponent.y, opponent.facing, attack.hitbox);
  const hurtbox = self.getHurtbox();
  const horizontalGap = hitbox.x > hurtbox.x + hurtbox.width
    ? hitbox.x - (hurtbox.x + hurtbox.width)
    : hurtbox.x > hitbox.x + hitbox.width
      ? hurtbox.x - (hitbox.x + hitbox.width)
      : 0;
  const verticalOverlap = rangesOverlap(hitbox.y, hitbox.y + hitbox.height, hurtbox.y, hurtbox.y + hurtbox.height);
  const inThreatRange = horizontalGap < 28 && (verticalOverlap || Math.abs((hitbox.y + hitbox.height / 2) - (hurtbox.y + hurtbox.height / 2)) < 70);

  return {
    active: inThreatRange,
    attack,
    attackView: view,
    isProjectile: false,
    sourceX: opponent.x,
    rangeX: attack.hitbox.width / 2 + attack.hitbox.offsetX,
    rangeY: attack.hitbox.height / 2 + attack.hitbox.offsetY,
    framesUntilImpactEstimate: remainingStartup,
    canBeBlocked: attack.canBeBlocked,
    guardType: attack.guardType,
    highThreat: inThreatRange && (view.phase === 'ACTIVE' || remainingStartup <= 6),
  };
}

export function perceiveFight(input: AIPerceptionInput): AIPerceptionSnapshot {
  const { self, opponent, arena, projectiles, tick, getCombo } = input;
  const distanceX = opponent.x - self.x;
  const absDistanceX = Math.abs(distanceX);
  const distanceY = opponent.y - self.y;
  const absDistanceY = Math.abs(distanceY);
  const towardOpponent: 1 | -1 = distanceX >= 0 ? 1 : -1;
  const awayFromOpponent: 1 | -1 = towardOpponent === 1 ? -1 : 1;

  const leftSpace = self.x - arena.left;
  const rightSpace = arena.right - self.x;
  const selfCornerDistance = Math.min(leftSpace, rightSpace);
  const opponentCornerDistance = Math.min(opponent.x - arena.left, arena.right - opponent.x);

  const meleeThreat = estimateAttackThreat(self, opponent);
  const projectileThreat = estimateProjectileThreat(self, projectiles);
  const opponentAttack =
    projectileThreat && (!meleeThreat.active || projectileThreat.framesUntilImpactEstimate <= meleeThreat.framesUntilImpactEstimate)
      ? projectileThreat
      : meleeThreat;

  const lightRange = attackReachX(self, self.config.lightAttack) + 18;
  const heavyRange = attackReachX(self, self.config.heavyAttack) + 20;
  const crouchLightRange = attackReachX(self, self.config.crouchingLightAttack) + 18;
  const special1Range =
    self.config.specialAttacks[0].projectile
      ? Math.min(760, (self.config.specialAttacks[0].projectile.lifetimeFrames * self.config.specialAttacks[0].projectile.speed) / 60)
      : attackReachX(self, self.config.specialAttacks[0]) + 30;
  const special2Range =
    self.config.specialAttacks[1].projectile
      ? Math.min(760, (self.config.specialAttacks[1].projectile.lifetimeFrames * self.config.specialAttacks[1].projectile.speed) / 60)
      : attackReachX(self, self.config.specialAttacks[1]) + 40;

  const opponentAttackView = opponent.getAttackView();
  const opponentRecoveryFramesEstimate =
    opponentAttackView && opponentAttackView.phase === 'RECOVERY'
      ? Math.max(1, opponentAttackView.definition.recoveryFrames - Math.floor(opponentAttackView.phaseProgress * opponentAttackView.definition.recoveryFrames))
      : opponent.state === 'HITSTUN' || opponent.state === 'BLOCKSTUN'
        ? opponent.stateRemainingFrames
        : 0;

  const combo = getCombo ? getCombo(self.id, opponent.id) : null;

  return {
    tick,
    selfId: self.id,
    opponentId: opponent.id,
    distanceX,
    distanceY,
    absDistanceX,
    absDistanceY,
    selfFacing: self.facing,
    opponentFacing: opponent.facing,
    towardOpponent,
    awayFromOpponent,
    selfState: self.state,
    opponentState: opponent.state,
    selfGrounded: self.grounded,
    opponentGrounded: opponent.grounded,
    selfHealth: self.health,
    opponentHealth: opponent.health,
    selfHealthRatio: self.maxHealth <= 0 ? 0 : self.health / self.maxHealth,
    opponentHealthRatio: opponent.maxHealth <= 0 ? 0 : opponent.health / opponent.maxHealth,
    selfEnergy: self.energy,
    opponentEnergy: opponent.energy,
    opponentAttack,
    opponentInRecovery:
      opponentRecoveryFramesEstimate > 0 ||
      (opponentAttackView !== null && opponentAttackView.phase === 'RECOVERY'),
    opponentRecoveryFramesEstimate,
    opponentBlocking: opponent.isBlocking || opponent.isBlockstunned,
    opponentAirborne: !opponent.grounded || opponent.state === 'JUMPING' || opponent.state === 'FALLING',
    selfActionable: self.isActionable,
    selfInRecovery:
      !self.isActionable &&
      (self.state === 'ATTACKING' ||
        self.state === 'SPECIAL_ATTACK' ||
        self.state === 'HITSTUN' ||
        self.state === 'KNOCKDOWN' ||
        self.state === 'BLOCKSTUN' ||
        self.state === 'DODGING'),
    selfCornered: selfCornerDistance < CORNER_MARGIN && Math.sign(distanceX) === (leftSpace < rightSpace ? -1 : 1),
    opponentCornered: opponentCornerDistance < CORNER_MARGIN,
    selfCornerDistance,
    opponentCornerDistance,
    selfCanLight: canStartAttackNow(self, self.config.lightAttack),
    selfCanHeavy: canStartAttackNow(self, self.config.heavyAttack),
    selfCanCrouchLight: canStartAttackNow(self, self.config.crouchingLightAttack),
    selfCanSpecial1: canStartAttackNow(self, self.config.specialAttacks[0]),
    selfCanSpecial2: canStartAttackNow(self, self.config.specialAttacks[1]),
    selfCanDodge: self.isActionable && self.dodgeCooldown <= 0 && self.grounded && self.energy >= self.tuning.dodge.energyCost,
    selfCanJump: self.isActionable && self.grounded,
    lightRange,
    heavyRange,
    special1Range,
    special2Range,
    crouchLightRange,
    inLightRange: absDistanceX <= lightRange && absDistanceY < attackReachY(self.config.lightAttack) + 40,
    inHeavyRange: absDistanceX <= heavyRange && absDistanceY < attackReachY(self.config.heavyAttack) + 40,
    inCrouchLightRange: absDistanceX <= crouchLightRange && absDistanceY < 80,
    inSpecial1Range: absDistanceX <= special1Range && absDistanceY < 140,
    inSpecial2Range: absDistanceX <= special2Range && absDistanceY < 140,
    inAnySpecialRange: absDistanceX <= Math.max(special1Range, special2Range),
    comboActive: (combo?.hits ?? 0) > 0,
    comboHits: combo?.hits ?? 0,
    availableProjectiles: projectiles,
  };
}

export function canStartAttackNow(fighter: Fighter, attack: AttackDefinition): boolean {
  if (fighter.isDefeated) {
    return false;
  }
  if (!fighter.energyRules || fighter.energy < attack.energyCost) {
    if (fighter.energy < attack.energyCost) {
      return false;
    }
  }
  if (!fighter.grounded && !(attack.airborne && fighter.config.canAttackAirborne)) {
    return false;
  }

  const state = fighter.state;
  if (state === 'ATTACKING' || state === 'SPECIAL_ATTACK') {
    // Combo continuation is evaluated separately against cancel windows.
    return fighter.energy >= attack.energyCost;
  }

  return fighter.isActionable && fighter.energy >= attack.energyCost;
}

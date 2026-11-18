/**
 * Data-driven attack definitions and frame-phase helpers.
 *
 * Frame convention: an attack instance is created at frame 0. Each simulation
 * tick advances it by one frame. `advanceAttack` returns the phase that was
 * active during the tick before advancing, so an attack with 6 startup frames
 * receives 6 startup ticks before active frames begin.
 */

export const ATTACK_PHASES = ['STARTUP', 'ACTIVE', 'RECOVERY', 'COMPLETE'] as const;

export type AttackPhase = (typeof ATTACK_PHASES)[number];

export const ATTACK_CATEGORIES = ['LIGHT', 'HEAVY', 'SPECIAL', 'ULTIMATE'] as const;

export type AttackCategory = (typeof ATTACK_CATEGORIES)[number];

export const GUARD_TYPES = ['HIGH', 'MID', 'LOW', 'UNBLOCKABLE'] as const;

export type GuardType = (typeof GUARD_TYPES)[number];

export type AttackId =
  | 'light-punch'
  | 'heavy-punch'
  | 'low-kick'
  | 'energy-blast'
  | 'rising-strike'
  | 'shadow-dash'
  | 'thunder-kick';

export interface AttackHitboxDefinition {
  readonly width: number;
  readonly height: number;
  /** Horizontal distance from the fighter's center to the hitbox center. */
  readonly offsetX: number;
  /** Vertical distance from the fighter's feet upward to the hitbox center. */
  readonly offsetY: number;
}

export interface CancelWindow {
  /** Inclusive first simulation frame of the window. */
  readonly startFrame: number;
  /** Inclusive last simulation frame of the window. */
  readonly endFrame: number;
  readonly allowedCategories: readonly AttackCategory[];
  readonly requiresContact: boolean;
}

export interface AttackAdvanceDefinition {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly velocityX: number;
}

export interface ProjectileDefinition {
  readonly speed: number;
  readonly width: number;
  readonly height: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly lifetimeFrames: number;
  readonly maxHits: number;
}

export interface AttackDefinition {
  readonly id: AttackId;
  readonly name: string;
  readonly category: AttackCategory;
  readonly guardType: GuardType;

  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly recoveryFrames: number;

  readonly damage: number;
  readonly knockback: number;
  readonly hitstunFrames: number;
  readonly blockstunFrames: number;
  readonly chipDamage: number;

  readonly energyCost: number;
  readonly energyGainOnHit: number;
  readonly cooldownFrames: number;

  readonly cancelWindows: readonly CancelWindow[];
  readonly canBeBlocked: boolean;
  readonly canBeDodged: boolean;
  readonly airborne: boolean;

  readonly hitbox: AttackHitboxDefinition;
  /** Upward launch applied on hit. Zero keeps grounded victims grounded. */
  readonly launchForce: number;
  readonly causesKnockdown: boolean;
  /** Simulation ticks frozen after a clean hit, for impact weight. */
  readonly hitstopFrames: number;

  readonly advance?: AttackAdvanceDefinition;
  readonly projectile?: ProjectileDefinition;
}

export const LIGHT_PUNCH: AttackDefinition = Object.freeze({
  id: 'light-punch',
  name: 'LIGHT PUNCH',
  category: 'LIGHT',
  guardType: 'HIGH',
  damage: 5,
  startupFrames: 6,
  activeFrames: 3,
  recoveryFrames: 12,
  knockback: 170,
  hitstunFrames: 16,
  blockstunFrames: 10,
  chipDamage: 1,
  energyCost: 0,
  energyGainOnHit: 5,
  cooldownFrames: 0,
  cancelWindows: Object.freeze([
    Object.freeze({
      startFrame: 6,
      endFrame: 18,
      allowedCategories: Object.freeze(['LIGHT', 'HEAVY', 'SPECIAL'] as const),
      requiresContact: true,
    }),
  ]),
  canBeBlocked: true,
  canBeDodged: true,
  airborne: false,
  hitbox: Object.freeze({ width: 58, height: 46, offsetX: 54, offsetY: 104 }),
  launchForce: 0,
  causesKnockdown: false,
  hitstopFrames: 2,
});

export const HEAVY_PUNCH: AttackDefinition = Object.freeze({
  id: 'heavy-punch',
  name: 'HEAVY PUNCH',
  category: 'HEAVY',
  guardType: 'MID',
  damage: 12,
  startupFrames: 14,
  activeFrames: 4,
  recoveryFrames: 24,
  knockback: 460,
  hitstunFrames: 32,
  blockstunFrames: 16,
  chipDamage: 2,
  energyCost: 0,
  energyGainOnHit: 8,
  cooldownFrames: 0,
  cancelWindows: Object.freeze([
    Object.freeze({
      startFrame: 14,
      endFrame: 28,
      allowedCategories: Object.freeze(['SPECIAL'] as const),
      requiresContact: true,
    }),
  ]),
  canBeBlocked: true,
  canBeDodged: true,
  airborne: false,
  hitbox: Object.freeze({ width: 92, height: 58, offsetX: 66, offsetY: 108 }),
  launchForce: 210,
  causesKnockdown: true,
  hitstopFrames: 4,
});

export const LOW_KICK: AttackDefinition = Object.freeze({
  id: 'low-kick',
  name: 'LOW KICK',
  category: 'LIGHT',
  guardType: 'LOW',
  damage: 4,
  startupFrames: 5,
  activeFrames: 3,
  recoveryFrames: 10,
  knockback: 110,
  hitstunFrames: 14,
  blockstunFrames: 9,
  chipDamage: 1,
  energyCost: 0,
  energyGainOnHit: 5,
  cooldownFrames: 0,
  cancelWindows: Object.freeze([
    Object.freeze({
      startFrame: 5,
      endFrame: 16,
      allowedCategories: Object.freeze(['LIGHT', 'HEAVY', 'SPECIAL'] as const),
      requiresContact: true,
    }),
  ]),
  canBeBlocked: true,
  canBeDodged: true,
  airborne: false,
  hitbox: Object.freeze({ width: 70, height: 30, offsetX: 48, offsetY: 36 }),
  launchForce: 0,
  causesKnockdown: false,
  hitstopFrames: 2,
});

export const ENERGY_BLAST: AttackDefinition = Object.freeze({
  id: 'energy-blast',
  name: 'ENERGY BLAST',
  category: 'SPECIAL',
  guardType: 'MID',
  damage: 10,
  startupFrames: 16,
  activeFrames: 2,
  recoveryFrames: 20,
  knockback: 300,
  hitstunFrames: 22,
  blockstunFrames: 14,
  chipDamage: 2,
  energyCost: 25,
  energyGainOnHit: 6,
  cooldownFrames: 30,
  cancelWindows: Object.freeze([]),
  canBeBlocked: true,
  canBeDodged: true,
  airborne: false,
  hitbox: Object.freeze({ width: 24, height: 24, offsetX: 44, offsetY: 104 }),
  launchForce: 0,
  causesKnockdown: false,
  hitstopFrames: 3,
  projectile: Object.freeze({
    speed: 640,
    width: 46,
    height: 46,
    offsetX: 58,
    offsetY: 104,
    lifetimeFrames: 75,
    maxHits: 1,
  }),
});

export const RISING_STRIKE: AttackDefinition = Object.freeze({
  id: 'rising-strike',
  name: 'RISING STRIKE',
  category: 'SPECIAL',
  guardType: 'MID',
  damage: 15,
  startupFrames: 10,
  activeFrames: 5,
  recoveryFrames: 26,
  knockback: 240,
  hitstunFrames: 30,
  blockstunFrames: 16,
  chipDamage: 3,
  energyCost: 25,
  energyGainOnHit: 8,
  cooldownFrames: 45,
  cancelWindows: Object.freeze([]),
  canBeBlocked: true,
  canBeDodged: true,
  airborne: false,
  hitbox: Object.freeze({ width: 76, height: 100, offsetX: 52, offsetY: 112 }),
  launchForce: 430,
  causesKnockdown: true,
  hitstopFrames: 4,
  advance: Object.freeze({ startFrame: 6, endFrame: 10, velocityX: 220 }),
});

export const SHADOW_DASH: AttackDefinition = Object.freeze({
  id: 'shadow-dash',
  name: 'SHADOW DASH',
  category: 'SPECIAL',
  guardType: 'MID',
  damage: 13,
  startupFrames: 12,
  activeFrames: 4,
  recoveryFrames: 22,
  knockback: 380,
  hitstunFrames: 26,
  blockstunFrames: 14,
  chipDamage: 2,
  energyCost: 25,
  energyGainOnHit: 8,
  cooldownFrames: 35,
  cancelWindows: Object.freeze([]),
  canBeBlocked: true,
  canBeDodged: true,
  airborne: false,
  hitbox: Object.freeze({ width: 96, height: 52, offsetX: 62, offsetY: 106 }),
  launchForce: 120,
  causesKnockdown: false,
  hitstopFrames: 4,
  advance: Object.freeze({ startFrame: 5, endFrame: 15, velocityX: 620 }),
});

export const THUNDER_KICK: AttackDefinition = Object.freeze({
  id: 'thunder-kick',
  name: 'THUNDER KICK',
  category: 'SPECIAL',
  guardType: 'MID',
  damage: 16,
  startupFrames: 15,
  activeFrames: 4,
  recoveryFrames: 24,
  knockback: 420,
  hitstunFrames: 30,
  blockstunFrames: 16,
  chipDamage: 3,
  energyCost: 25,
  energyGainOnHit: 8,
  cooldownFrames: 40,
  cancelWindows: Object.freeze([]),
  canBeBlocked: true,
  canBeDodged: true,
  airborne: false,
  hitbox: Object.freeze({ width: 104, height: 48, offsetX: 70, offsetY: 96 }),
  launchForce: 170,
  causesKnockdown: true,
  hitstopFrames: 4,
  advance: Object.freeze({ startFrame: 6, endFrame: 18, velocityX: 420 }),
});

export const ATTACKS: Readonly<Record<AttackId, AttackDefinition>> = Object.freeze({
  'light-punch': LIGHT_PUNCH,
  'heavy-punch': HEAVY_PUNCH,
  'low-kick': LOW_KICK,
  'energy-blast': ENERGY_BLAST,
  'rising-strike': RISING_STRIKE,
  'shadow-dash': SHADOW_DASH,
  'thunder-kick': THUNDER_KICK,
});

export function totalAttackFrames(definition: AttackDefinition): number {
  return definition.startupFrames + definition.activeFrames + definition.recoveryFrames;
}

export function attackPhaseAtFrame(definition: AttackDefinition, frame: number): AttackPhase {
  const safeFrame = Math.max(0, Math.floor(frame));

  if (safeFrame >= totalAttackFrames(definition)) {
    return 'COMPLETE';
  }
  if (safeFrame < definition.startupFrames) {
    return 'STARTUP';
  }
  if (safeFrame < definition.startupFrames + definition.activeFrames) {
    return 'ACTIVE';
  }
  return 'RECOVERY';
}

export function findCancelWindow(
  definition: AttackDefinition,
  frame: number,
  nextCategory: AttackCategory,
): CancelWindow | null {
  return (
    definition.cancelWindows.find(
      (window) =>
        frame >= window.startFrame &&
        frame <= window.endFrame &&
        window.allowedCategories.includes(nextCategory),
    ) ?? null
  );
}

export function guardMatches(guardType: GuardType, crouchingBlock: boolean): boolean {
  switch (guardType) {
    case 'HIGH':
      return !crouchingBlock;
    case 'LOW':
      return crouchingBlock;
    case 'MID':
      return true;
    case 'UNBLOCKABLE':
      return false;
  }
}

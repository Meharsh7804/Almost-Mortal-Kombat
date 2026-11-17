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

export type AttackId = 'light-punch' | 'heavy-punch';

export interface AttackHitboxDefinition {
  readonly width: number;
  readonly height: number;
  /** Horizontal distance from the fighter's center to the hitbox center. */
  readonly offsetX: number;
  /** Vertical distance from the fighter's feet upward to the hitbox center. */
  readonly offsetY: number;
}

export interface AttackDefinition {
  readonly id: AttackId;
  readonly name: string;
  readonly damage: number;
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly recoveryFrames: number;
  readonly knockback: number;
  readonly hitstunFrames: number;
  readonly hitbox: AttackHitboxDefinition;
  /** Upward launch applied on hit. Zero keeps grounded victims grounded. */
  readonly launchForce: number;
  readonly causesKnockdown: boolean;
  /** Simulation ticks frozen after a clean hit, for impact weight. */
  readonly hitstopFrames: number;
}

export const LIGHT_PUNCH: AttackDefinition = Object.freeze({
  id: 'light-punch',
  name: 'LIGHT PUNCH',
  damage: 5,
  startupFrames: 6,
  activeFrames: 3,
  recoveryFrames: 12,
  knockback: 170,
  hitstunFrames: 16,
  hitbox: Object.freeze({ width: 58, height: 46, offsetX: 54, offsetY: 104 }),
  launchForce: 0,
  causesKnockdown: false,
  hitstopFrames: 2,
});

export const HEAVY_PUNCH: AttackDefinition = Object.freeze({
  id: 'heavy-punch',
  name: 'HEAVY PUNCH',
  damage: 12,
  startupFrames: 14,
  activeFrames: 4,
  recoveryFrames: 24,
  knockback: 460,
  hitstunFrames: 32,
  hitbox: Object.freeze({ width: 92, height: 58, offsetX: 66, offsetY: 108 }),
  launchForce: 210,
  causesKnockdown: true,
  hitstopFrames: 4,
});

export const ATTACKS: Readonly<Record<AttackId, AttackDefinition>> = Object.freeze({
  'light-punch': LIGHT_PUNCH,
  'heavy-punch': HEAVY_PUNCH,
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

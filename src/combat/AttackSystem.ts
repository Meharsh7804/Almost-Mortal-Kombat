import {
  attackPhaseAtFrame,
  findCancelWindow,
  totalAttackFrames,
  type AttackCategory,
  type AttackDefinition,
  type AttackPhase,
  type CancelWindow,
} from './FrameData';

/**
 * Per-instance attack state. Hit tracking lives on the instance so a single
 * attack can only connect with a given target once, regardless of how many
 * active frames overlap the target's hurtbox.
 */
export interface ActiveAttack {
  readonly definition: AttackDefinition;
  frame: number;
  readonly hitTargets: Set<string>;
  projectileSpawned: boolean;
}

export function createActiveAttack(definition: AttackDefinition): ActiveAttack {
  return {
    definition,
    frame: 0,
    hitTargets: new Set<string>(),
    projectileSpawned: false,
  };
}

/**
 * Advances one simulation tick and returns the phase that applied during that
 * tick. The frame counter advances after the phase query.
 */
export function advanceAttack(attack: ActiveAttack): AttackPhase {
  const phase = attackPhaseAtFrame(attack.definition, attack.frame);
  attack.frame += 1;
  return phase;
}

export function getAttackPhase(attack: ActiveAttack): AttackPhase {
  return attackPhaseAtFrame(attack.definition, attack.frame);
}

/** Normalized progress through the current phase, clamped to 0..1. */
export function getAttackPhaseProgress(attack: ActiveAttack): number {
  const { definition, frame } = attack;
  const phase = getAttackPhase(attack);

  switch (phase) {
    case 'STARTUP':
      return definition.startupFrames === 0 ? 1 : Math.min(1, frame / definition.startupFrames);
    case 'ACTIVE':
      return definition.activeFrames === 0
        ? 1
        : Math.min(1, (frame - definition.startupFrames) / definition.activeFrames);
    case 'RECOVERY':
      return definition.recoveryFrames === 0
        ? 1
        : Math.min(
            1,
            (frame - definition.startupFrames - definition.activeFrames) /
              definition.recoveryFrames,
          );
    case 'COMPLETE':
      return 1;
  }
}

export function getAttackProgress(attack: ActiveAttack): number {
  return Math.min(1, attack.frame / Math.max(1, totalAttackFrames(attack.definition)));
}

export function hasHitTarget(attack: ActiveAttack, targetId: string): boolean {
  return attack.hitTargets.has(targetId);
}

export function markHitTarget(attack: ActiveAttack, targetId: string): void {
  attack.hitTargets.add(targetId);
}

export function hasContact(attack: ActiveAttack): boolean {
  return attack.hitTargets.size > 0;
}

export function getCancelWindow(
  attack: ActiveAttack,
  nextCategory: AttackCategory,
): CancelWindow | null {
  return findCancelWindow(attack.definition, attack.frame, nextCategory);
}

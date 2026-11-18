import type { AttackCategory } from './FrameData';

export interface AttackStartedEvent {
  readonly type: 'ATTACK_STARTED';
  readonly attackerId: string;
  readonly playerNumber: 1 | 2;
  readonly attackId: string;
  readonly attackName: string;
  readonly category: AttackCategory;
  readonly special: boolean;
}

export interface AttackConnectedEvent {
  readonly type: 'ATTACK_CONNECTED';
  readonly attackerId: string;
  readonly victimId: string;
  readonly attackId: string;
  readonly damage: number;
  readonly comboHits: number;
  readonly impactX: number;
  readonly impactY: number;
}

export interface AttackBlockedEvent {
  readonly type: 'ATTACK_BLOCKED';
  readonly attackerId: string;
  readonly victimId: string;
  readonly attackId: string;
  readonly chipDamage: number;
  readonly perfect: boolean;
  readonly impactX: number;
  readonly impactY: number;
}

export interface PerfectGuardEvent {
  readonly type: 'PERFECT_GUARD';
  readonly fighterId: string;
  readonly playerNumber: 1 | 2;
  readonly attackerId: string;
  readonly attackId: string;
}

export interface ComboStartedEvent {
  readonly type: 'COMBO_STARTED';
  readonly attackerId: string;
  readonly victimId: string;
  readonly hits: number;
  readonly damage: number;
}

export interface ComboUpdatedEvent {
  readonly type: 'COMBO_UPDATED';
  readonly attackerId: string;
  readonly victimId: string;
  readonly hits: number;
  readonly damage: number;
}

export interface ComboEndedEvent {
  readonly type: 'COMBO_ENDED';
  readonly attackerId: string;
  readonly victimId: string;
  readonly hits: number;
  readonly damage: number;
}

export interface DodgeStartedEvent {
  readonly type: 'DODGE_STARTED';
  readonly fighterId: string;
  readonly playerNumber: 1 | 2;
  readonly direction: -1 | 1;
}

export interface SpecialAttackUsedEvent {
  readonly type: 'SPECIAL_ATTACK_USED';
  readonly fighterId: string;
  readonly playerNumber: 1 | 2;
  readonly attackId: string;
  readonly attackName: string;
}

export interface FighterDamagedEvent {
  readonly type: 'FIGHTER_DAMAGED';
  readonly fighterId: string;
  readonly playerNumber: 1 | 2;
  readonly amount: number;
  readonly health: number;
  readonly maxHealth: number;
}

export interface FighterDefeatedEvent {
  readonly type: 'FIGHTER_DEFEATED';
  readonly fighterId: string;
  readonly playerNumber: 1 | 2;
}

export type CombatEvent =
  | AttackStartedEvent
  | AttackConnectedEvent
  | AttackBlockedEvent
  | PerfectGuardEvent
  | ComboStartedEvent
  | ComboUpdatedEvent
  | ComboEndedEvent
  | DodgeStartedEvent
  | SpecialAttackUsedEvent
  | FighterDamagedEvent
  | FighterDefeatedEvent;

import type { ArenaBounds } from '../data/ArenaConfig';
import type { AttackDefinition } from '../combat/FrameData';
import type { Fighter, FighterAttackView } from '../entities/Fighter';
import type { FighterState } from '../entities/FighterStateMachine';
import type { Projectile } from '../combat/ProjectileSystem';

export type AIDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT';
export type AIPersonality = 'AGGRESSOR' | 'DEFENDER' | 'TRICKSTER' | 'BRUISER';

export type AITacticalSituation =
  | 'NEUTRAL'
  | 'APPROACHING'
  | 'OFFENSIVE_OPPORTUNITY'
  | 'OPPONENT_ATTACK'
  | 'OPPONENT_RECOVERY'
  | 'AI_RECOVERY'
  | 'CORNERED';

export type AIIntent =
  | 'IDLE'
  | 'APPROACH'
  | 'RETREAT'
  | 'WALK_FORWARD'
  | 'WALK_BACKWARD'
  | 'JUMP'
  | 'CROUCH'
  | 'LIGHT_ATTACK'
  | 'HEAVY_ATTACK'
  | 'SPECIAL_1'
  | 'SPECIAL_2'
  | 'CROUCH_LIGHT_ATTACK'
  | 'BLOCK_STAND'
  | 'BLOCK_CROUCH'
  | 'PERFECT_GUARD_STAND'
  | 'PERFECT_GUARD_CROUCH'
  | 'DODGE_FORWARD'
  | 'DODGE_BACKWARD'
  | 'PUNISH_LIGHT'
  | 'PUNISH_HEAVY'
  | 'PUNISH_SPECIAL'
  | 'COMBO_CONTINUE_LIGHT'
  | 'COMBO_CONTINUE_HEAVY'
  | 'COMBO_CONTINUE_SPECIAL'
  | 'ANTI_AIR_LIGHT'
  | 'ANTI_AIR_HEAVY'
  | 'REPOSITION'
  | 'BAIT';

export interface AIPlannedAction {
  readonly intent: AIIntent;
  readonly score: number;
  readonly commitmentFrames: number;
  readonly label: string;
  readonly reason: string;
}

export interface AIScoredAction {
  readonly intent: AIIntent;
  readonly score: number;
  readonly label: string;
  readonly valid: boolean;
  readonly reason?: string;
}

export interface AIDifficultyProfile {
  readonly reactionDelayFrames: number;
  readonly reactionJitterFrames: number;
  readonly decisionIntervalFrames: number;
  readonly actionCommitmentFrames: number;
  readonly minimumActionFrames: number;
  readonly aggression: number;
  readonly defenseWeight: number;
  readonly spacingWeight: number;
  readonly punishWeight: number;
  readonly comboConfidence: number;
  readonly perfectGuardProbability: number;
  readonly dodgeProbability: number;
  readonly blockProbability: number;
  readonly specialUsageThreshold: number;
  readonly predictionStrength: number;
  readonly mistakeProbability: number;
  readonly adaptationStrength: number;
  readonly antiAirAwareness: number;
  readonly spacingDiscipline: number;
}

export interface AIPersonalityProfile {
  readonly aggressionBias: number;
  readonly defenseBias: number;
  readonly spacingBias: number;
  readonly riskBias: number;
  readonly lightBias: number;
  readonly heavyBias: number;
  readonly specialBias: number;
  readonly dodgeBias: number;
  readonly jumpBias: number;
  readonly repositionBias: number;
}

export interface AIResolvedProfile {
  readonly difficulty: AIDifficulty;
  readonly personality: AIPersonality;
  readonly difficultyProfile: AIDifficultyProfile;
  readonly personalityProfile: AIPersonalityProfile;
}

export interface AIAdaptationSnapshot {
  readonly samples: number;
  readonly lightAttackRate: number;
  readonly heavyAttackRate: number;
  readonly jumpRate: number;
  readonly specialRate: number;
  readonly blockRate: number;
  readonly dodgeRate: number;
  readonly forwardRate: number;
  readonly retreatRate: number;
  readonly repeatedStarterRate: number;
  readonly recentPattern: string | null;
  readonly antiHeavyBias: number;
  readonly antiJumpBias: number;
  readonly antiBlockBias: number;
  readonly pressureBias: number;
  readonly patternBreakBias: number;
}

export interface AIAttackThreat {
  readonly active: boolean;
  readonly attack: AttackDefinition | null;
  readonly attackView: FighterAttackView | null;
  readonly isProjectile: boolean;
  readonly sourceX: number;
  readonly rangeX: number;
  readonly rangeY: number;
  readonly framesUntilImpactEstimate: number;
  readonly canBeBlocked: boolean;
  readonly guardType: AttackDefinition['guardType'] | 'NONE';
  readonly highThreat: boolean;
}

export interface AIPerceptionSnapshot {
  readonly tick: number;
  readonly selfId: string;
  readonly opponentId: string;
  readonly distanceX: number;
  readonly distanceY: number;
  readonly absDistanceX: number;
  readonly absDistanceY: number;
  readonly selfFacing: 1 | -1;
  readonly opponentFacing: 1 | -1;
  readonly towardOpponent: 1 | -1;
  readonly awayFromOpponent: 1 | -1;
  readonly selfState: FighterState;
  readonly opponentState: FighterState;
  readonly selfGrounded: boolean;
  readonly opponentGrounded: boolean;
  readonly selfHealth: number;
  readonly opponentHealth: number;
  readonly selfHealthRatio: number;
  readonly opponentHealthRatio: number;
  readonly selfEnergy: number;
  readonly opponentEnergy: number;
  readonly opponentAttack: AIAttackThreat;
  readonly opponentInRecovery: boolean;
  readonly opponentRecoveryFramesEstimate: number;
  readonly opponentBlocking: boolean;
  readonly opponentAirborne: boolean;
  readonly selfActionable: boolean;
  readonly selfInRecovery: boolean;
  readonly selfCornered: boolean;
  readonly opponentCornered: boolean;
  readonly selfCornerDistance: number;
  readonly opponentCornerDistance: number;
  readonly selfCanLight: boolean;
  readonly selfCanHeavy: boolean;
  readonly selfCanCrouchLight: boolean;
  readonly selfCanSpecial1: boolean;
  readonly selfCanSpecial2: boolean;
  readonly selfCanDodge: boolean;
  readonly selfCanJump: boolean;
  readonly lightRange: number;
  readonly heavyRange: number;
  readonly special1Range: number;
  readonly special2Range: number;
  readonly crouchLightRange: number;
  readonly inLightRange: boolean;
  readonly inHeavyRange: boolean;
  readonly inCrouchLightRange: boolean;
  readonly inSpecial1Range: boolean;
  readonly inSpecial2Range: boolean;
  readonly inAnySpecialRange: boolean;
  readonly comboActive: boolean;
  readonly comboHits: number;
  readonly availableProjectiles: readonly Projectile[];
}

export interface AIContext {
  readonly perception: AIPerceptionSnapshot;
  readonly situation: AITacticalSituation;
  readonly profile: AIResolvedProfile;
  readonly adaptation: AIAdaptationSnapshot;
}

export interface AIDebugInfo {
  readonly enabled: boolean;
  readonly controlledPlayer: 1 | 2;
  readonly difficulty: AIDifficulty;
  readonly personality: AIPersonality;
  readonly situation: AITacticalSituation;
  readonly selectedAction: string;
  readonly selectedScore: number;
  readonly topActions: readonly { intent: AIIntent; score: number; label: string }[];
  readonly reactionFramesRemaining: number;
  readonly commitmentFramesRemaining: number;
  readonly aiState: FighterState;
  readonly opponentObservedState: FighterState;
  readonly adaptation: AIAdaptationSnapshot;
  readonly lastReason: string;
}

export interface AIPerceptionInput {
  readonly self: Fighter;
  readonly opponent: Fighter;
  readonly arena: ArenaBounds;
  readonly projectiles: readonly Projectile[];
  readonly tick: number;
  readonly getCombo?: (attackerId: string, victimId: string) => { hits: number } | null;
}

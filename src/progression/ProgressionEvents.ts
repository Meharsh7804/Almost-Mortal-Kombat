export type MatchResultOutcome = 'WIN' | 'LOSS' | 'DRAW';

export interface MatchProgressionInput {
  /** Stable token to prevent duplicate rewards (e.g. battle instance id / timestamp+seed+rounds) */
  matchToken: string;
  mode: 'LOCAL_VERSUS' | 'CPU_BATTLE' | 'TRAINING' | 'ARCADE';
  playerCharacterId: string;
  opponentCharacterId: string;
  arenaId: string;
  outcome: MatchResultOutcome;
  durationSeconds: number;
  damageDealt: number;
  damageReceived: number;
  highestCombo: number;
  totalSuccessfulCombos: number;
  perfectGuards: number;
  dodges: number;
  specialAttacksUsed: number;
  roundsWon: number;
  roundsLost: number;
  isArcadeStage: boolean;
  arcadeRunId?: string | null;
  arcadeStageIndex?: number | null;
  isArcadeFinalStage?: boolean;
  difficulty?: string | null;
  rematch?: boolean;
}

export interface ProgressionNotificationPayload {
  kind: 'LEVEL_UP' | 'MASTERY_UP' | 'ACHIEVEMENT' | 'UNLOCK' | 'ARCADE_STAGE' | 'ARCADE_COMPLETE' | 'XP' | 'INFO';
  title: string;
  description?: string;
  meta?: Record<string, unknown>;
}

export interface ProgressionUpdateResult {
  xpGained: number;
  masteryXpGained: number;
  leveledUp: boolean;
  masteryLeveledUp: boolean;
  notifications: ProgressionNotificationPayload[];
  unlockedIds: string[];
  achievementsUnlocked: string[];
  duplicatePrevented: boolean;
}

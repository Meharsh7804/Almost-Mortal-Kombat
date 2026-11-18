export interface PlayerStatistics {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  highestCombo: number;
  totalSuccessfulCombos: number;
  perfectGuards: number;
  dodges: number;
  specialAttacksUsed: number;
  arcadeRunsStarted: number;
  arcadeRunsCompleted: number;
  arcadeRunsFailed: number;
  /** Character id -> matches played count */
  charactersPlayed: Record<string, number>;
  /** Arena id -> matches played count */
  arenasPlayed: Record<string, number>;
}

export interface CharacterMastery {
  characterId: string;
  masteryLevel: number;
  masteryXP: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  highestCombo: number;
  /** Achievement ids or milestone keys progressed for this character */
  characterAchievementProgress: Record<string, number>;
}

export type UnlockableContentType =
  | 'FIGHTER'
  | 'COSTUME'
  | 'PALETTE'
  | 'ARENA'
  | 'TITLE'
  | 'BADGE'
  | 'VICTORY_POSE'
  | 'COSMETIC_EFFECT';

export interface UnlockedContent {
  /** All unlocked content ids (any type) */
  ids: string[];
  /** Optional equipped cosmetics by slot/type */
  equipped: Partial<Record<UnlockableContentType, string>>;
}

export type AchievementProgressType = 'boolean' | 'counter';

export interface AchievementProgress {
  id: string;
  progress: number;
  completed: boolean;
  unlockedAt: number | null;
  rewardGranted: boolean;
}

export interface ArcadeRunStageState {
  index: number;
  label: string;
  opponentCharacterId: string;
  arenaId: string;
  difficulty: string;
  personality: 'AGGRESSOR' | 'DEFENDER' | 'TRICKSTER' | 'BRUISER';
  roundsToWin: number;
  roundTimerSeconds: number;
  boss: boolean;
}

export interface ArcadeRunState {
  active: boolean;
  runId: string | null;
  characterId: string | null;
  difficulty: string | null;
  campaignId: string | null;
  seedBase: number | null;
  stages: ArcadeRunStageState[];
  opponentSequenceIds: string[];
  currentStageIndex: number;
  wins: number;
  losses: number;
  continuesUsed: number;
  continuesRemaining: number;
  completed: boolean;
  failed: boolean;
  rewardsGranted: boolean;
  /** Stage results: true = cleared */
  stageResults: boolean[];
  /** Prevent duplicate per-match reward application within a run flow */
  lastRewardedMatchToken: string | null;
}

export interface ArcadeProgress {
  runsStarted: number;
  runsCompleted: number;
  runsFailed: number;
  /** Character id -> ending unlocked */
  endingsUnlocked: Record<string, boolean>;
  /** Campaign/difficulty completion markers */
  completions: Record<string, boolean>;
  currentRun: ArcadeRunState | null;
  /** Prevent duplicate completion rewards per campaign+difficulty+character combo as needed */
  completionRewardsGranted: string[];
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  /** 'system' follows OS/browser preference; true/false forces the behavior. */
  reducedMotion: 'system' | boolean;
  screenShake: boolean;
}

export interface PlayerProfile {
  version: number;
  playerLevel: number;
  totalXP: number;
  statistics: PlayerStatistics;
  characterMastery: Record<string, CharacterMastery>;
  unlockedContent: UnlockedContent;
  achievements: AchievementProgress[];
  arcadeProgress: ArcadeProgress;
  /** Bounded idempotency tokens for processed match rewards */
  processedMatchRewardTokens: string[];
  settings: GameSettings;
}

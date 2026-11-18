import type { AIDifficulty } from '../ai/AITypes';

export interface ArcadeStageDefinition {
  index: number;
  label: string;
  opponentCharacterId?: string; // optional fixed; if omitted selector chooses
  arenaId?: string;
  /** Optional template difficulty hint; actual stage difficulty is scaled by run difficulty when omitted/resolved. */
  difficulty?: AIDifficulty;
  personality?: 'AGGRESSOR' | 'DEFENDER' | 'TRICKSTER' | 'BRUISER';
  roundsToWin?: number;
  roundTimerSeconds?: number;
  boss?: boolean;
}

export interface ArcadeCampaignConfig {
  id: string;
  name: string;
  description: string;
  difficulties: AIDifficulty[];
  defaultRoundsToWin: number;
  defaultRoundTimerSeconds: number;
  continuesByDifficulty: Record<AIDifficulty, number>;
  stages: readonly ArcadeStageDefinition[];
}

export interface ArcadeEndingDefinition {
  characterId: string;
  title: string;
  text: string[];
}

export interface ArcadeRunSnapshot {
  runId: string;
  campaignId: string;
  characterId: string;
  difficulty: AIDifficulty;
  seedBase?: number;
  stages: readonly ArcadeResolvedStage[];
  currentStageIndex: number;
  wins: number;
  losses: number;
  continuesUsed: number;
  continuesRemaining: number;
  completed: boolean;
  failed: boolean;
  stageResults: boolean[];
}

export interface ArcadeResolvedStage {
  index: number;
  label: string;
  opponentCharacterId: string;
  arenaId: string;
  difficulty: AIDifficulty;
  personality: 'AGGRESSOR' | 'DEFENDER' | 'TRICKSTER' | 'BRUISER';
  roundsToWin: number;
  roundTimerSeconds: number;
  boss: boolean;
}

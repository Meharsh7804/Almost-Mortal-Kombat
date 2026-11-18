import type { AIDifficulty, AIPersonality } from '../../ai/AITypes';

export type MatchMode = 'LOCAL_VERSUS' | 'CPU_BATTLE' | 'TRAINING';

export interface MatchConfig {
  readonly mode: MatchMode;
  readonly player1CharacterId: string;
  readonly player2CharacterId: string;
  readonly cpuEnabled: boolean;
  readonly cpuPlayer: 1 | 2;
  readonly cpuDifficulty: AIDifficulty;
  readonly cpuPersonality: AIPersonality;
  readonly arenaId: string;
  readonly roundTimerSeconds: number;
  readonly roundsToWin: number;
  readonly allowDuplicateCharacters: boolean;
  readonly seed: number;
}

export interface ResolvedMatchConfig extends MatchConfig {
  readonly resolvedArenaId: string;
  readonly cpuPlayers: readonly (1 | 2)[];
}

export interface ValidationResult<T> {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly value: T;
}

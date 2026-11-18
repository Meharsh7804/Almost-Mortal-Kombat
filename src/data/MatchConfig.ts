import type { AIDifficulty, AIPersonality } from '../ai/AITypes';
import { DEFAULT_DIFFICULTY, DEFAULT_PERSONALITY } from '../ai/AIProfiles';
import type { FighterConfig, PlayerNumber } from '../entities/Fighter';
import { ARENA_BOUNDS } from './ArenaConfig';
import { getDefaultArenaId, getRandomArenaId, isValidArenaId } from './ArenaRegistry';
import {
  getCharacterById,
  getCharacterRegistry,
  getDefaultCharacterId,
  getRandomCharacterId,
  isValidCharacterId,
} from './CharacterRegistry';

export type MatchMode = 'LOCAL_VERSUS' | 'CPU_BATTLE' | 'TRAINING' | 'ARCADE';
export type CpuPlayerSlot = 1 | 2;

export interface MatchConfig {
  readonly mode: MatchMode;
  readonly player1CharacterId: string;
  readonly player2CharacterId: string;
  readonly cpuEnabled: boolean;
  readonly cpuPlayer: CpuPlayerSlot;
  readonly cpuDifficulty: AIDifficulty;
  readonly cpuPersonality: AIPersonality;
  readonly arenaId: string;
  /** Round timer in seconds. 0 means unlimited. */
  readonly roundTimerSeconds: number;
  readonly roundsToWin: number;
  readonly allowDuplicateCharacters: boolean;
  readonly seed: number;
}

export interface MatchValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly config: MatchConfig;
}

export interface ResolvedMatchConfig extends MatchConfig {
  readonly resolvedArenaId: string;
  readonly cpuPlayers: readonly CpuPlayerSlot[];
}

export const RANDOM_CHARACTER_ID = '__random_character__';
export const RANDOM_ARENA_ID = '__random_arena__';

const AI_DIFFICULTIES: readonly AIDifficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];
const AI_PERSONALITIES: readonly AIPersonality[] = ['AGGRESSOR', 'DEFENDER', 'TRICKSTER', 'BRUISER'];

export function createDefaultMatchConfig(mode: MatchMode = 'LOCAL_VERSUS'): MatchConfig {
  const registry = getCharacterRegistry();
  const first = registry[0]?.id ?? getDefaultCharacterId();
  const second = registry[1]?.id ?? registry[0]?.id ?? getDefaultCharacterId();
  const cpuEnabled = mode === 'CPU_BATTLE' || mode === 'ARCADE' || mode === 'TRAINING';
  return Object.freeze({
    mode,
    player1CharacterId: first,
    player2CharacterId: second,
    cpuEnabled,
    cpuPlayer: 2 as CpuPlayerSlot,
    cpuDifficulty: DEFAULT_DIFFICULTY,
    cpuPersonality: DEFAULT_PERSONALITY,
    arenaId: getDefaultArenaId(),
    roundTimerSeconds: 99,
    roundsToWin: 2,
    allowDuplicateCharacters: true,
    seed: 1337,
  });
}

export function normalizeMatchConfig(input?: Partial<MatchConfig> | null): MatchConfig {
  const defaults = createDefaultMatchConfig(input?.mode);
  const mode = input?.mode ?? defaults.mode;
  const cpuEnabled =
    mode === 'CPU_BATTLE' || mode === 'ARCADE' || mode === 'TRAINING'
      ? true
      : Boolean(input?.cpuEnabled ?? defaults.cpuEnabled);
  const cpuPlayer = input?.cpuPlayer === 1 ? 1 : 2;
  const cpuDifficulty = AI_DIFFICULTIES.includes(input?.cpuDifficulty as AIDifficulty)
    ? (input?.cpuDifficulty as AIDifficulty)
    : defaults.cpuDifficulty;
  const cpuPersonality = AI_PERSONALITIES.includes(input?.cpuPersonality as AIPersonality)
    ? (input?.cpuPersonality as AIPersonality)
    : defaults.cpuPersonality;
  const roundTimerSeconds = clampInt(
    typeof input?.roundTimerSeconds === 'number' ? input.roundTimerSeconds : defaults.roundTimerSeconds,
    0,
    999,
  );
  const roundsToWin = clampInt(
    typeof input?.roundsToWin === 'number' ? input.roundsToWin : defaults.roundsToWin,
    1,
    5,
  );
  const seed =
    typeof input?.seed === 'number' && Number.isFinite(input.seed)
      ? (Math.floor(input.seed) >>> 0)
      : defaults.seed;

  return Object.freeze({
    mode,
    player1CharacterId: input?.player1CharacterId || defaults.player1CharacterId,
    player2CharacterId: input?.player2CharacterId || defaults.player2CharacterId,
    cpuEnabled,
    cpuPlayer,
    cpuDifficulty,
    cpuPersonality,
    arenaId: input?.arenaId || defaults.arenaId,
    roundTimerSeconds,
    roundsToWin,
    allowDuplicateCharacters: input?.allowDuplicateCharacters ?? defaults.allowDuplicateCharacters,
    seed,
  });
}

export function validateMatchConfig(input?: Partial<MatchConfig> | null): MatchValidationResult {
  const config = normalizeMatchConfig(input);
  const errors: string[] = [];

  if (!['LOCAL_VERSUS', 'CPU_BATTLE', 'TRAINING', 'ARCADE'].includes(config.mode)) {
    errors.push('Invalid match mode.');
  }
  if (!isValidCharacterId(config.player1CharacterId)) {
    errors.push(`Invalid player 1 character: ${config.player1CharacterId}`);
  }
  if (!isValidCharacterId(config.player2CharacterId)) {
    errors.push(`Invalid player 2 character: ${config.player2CharacterId}`);
  }
  if (
    !config.allowDuplicateCharacters &&
    config.player1CharacterId === config.player2CharacterId
  ) {
    errors.push('Duplicate characters are not allowed by this match configuration.');
  }
  if ((config.mode === 'CPU_BATTLE' || config.mode === 'ARCADE' || config.mode === 'TRAINING') && !config.cpuEnabled) {
    errors.push('CPU/Training/Arcade mode requires cpuEnabled to be true.');
  }
  if (config.cpuEnabled && config.cpuPlayer !== 1 && config.cpuPlayer !== 2) {
    errors.push('cpuPlayer must be 1 or 2.');
  }
  if (!isValidArenaId(config.arenaId)) {
    errors.push(`Invalid arena: ${config.arenaId}`);
  }
  if (!Number.isInteger(config.roundTimerSeconds) || config.roundTimerSeconds < 0) {
    errors.push('roundTimerSeconds must be an integer >= 0.');
  }
  if (!Number.isInteger(config.roundsToWin) || config.roundsToWin < 1) {
    errors.push('roundsToWin must be an integer >= 1.');
  }

  return { valid: errors.length === 0, errors: Object.freeze(errors), config };
}

export function resolveMatchConfig(input?: Partial<MatchConfig> | null): ResolvedMatchConfig {
  const base = normalizeMatchConfig(input);
  const rng = mulberry32(base.seed || 1337);

  const p1 =
    base.player1CharacterId === RANDOM_CHARACTER_ID
      ? getRandomCharacterId(rng)
      : isValidCharacterId(base.player1CharacterId)
        ? base.player1CharacterId
        : getDefaultCharacterId();
  const p2 =
    base.player2CharacterId === RANDOM_CHARACTER_ID
      ? getRandomCharacterId(rng)
      : isValidCharacterId(base.player2CharacterId)
        ? base.player2CharacterId
        : getDefaultCharacterId();
  const resolvedArenaId =
    base.arenaId === RANDOM_ARENA_ID
      ? getRandomArenaId(rng)
      : isValidArenaId(base.arenaId)
        ? base.arenaId
        : getDefaultArenaId();

  const cpuPlayers: CpuPlayerSlot[] = base.cpuEnabled ? [base.cpuPlayer] : [];
  const resolved = Object.freeze({
    ...base,
    player1CharacterId: p1,
    player2CharacterId: p2,
    arenaId: resolvedArenaId,
    resolvedArenaId,
    cpuPlayers: Object.freeze(cpuPlayers),
  });

  const validation = validateMatchConfig(resolved);
  if (!validation.valid) {
    // Fall back to safe defaults rather than blocking BattleScene.
    const fallback = createDefaultMatchConfig(base.mode);
    return Object.freeze({
      ...fallback,
      resolvedArenaId: fallback.arenaId,
      cpuPlayers: Object.freeze(fallback.cpuEnabled ? [fallback.cpuPlayer] : []),
    });
  }

  return resolved;
}

export function getCharacterIdForPlayer(config: MatchConfig, player: PlayerNumber): string {
  return player === 1 ? config.player1CharacterId : config.player2CharacterId;
}

export function createFighterConfigForMatch(
  config: MatchConfig,
  player: PlayerNumber,
): FighterConfig {
  const characterId = getCharacterIdForPlayer(config, player);
  const character = getCharacterById(characterId) ?? getCharacterById(getDefaultCharacterId());
  if (!character) {
    throw new Error(`No character available for player ${player}`);
  }

  const base = character.fighterConfig;
  return Object.freeze({
    ...base,
    id: `${character.id}-p${player}`,
    characterId: character.id,
    visualId: character.visualId,
    displayName: character.displayName,
    name: character.displayName,
    playerNumber: player,
    x: player === 1 ? 420 : 860,
    y: ARENA_BOUNDS.groundY,
  });
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

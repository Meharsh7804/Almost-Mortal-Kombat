import { getCharacterRegistry } from '../data/CharacterRegistry';
import { getArenaRegistry } from '../data/ArenaRegistry';
import type {
  AchievementProgress,
  ArcadeProgress,
  ArcadeRunStageState,
  ArcadeRunState,
  CharacterMastery,
  GameSettings,
  PlayerProfile,
  PlayerStatistics,
  UnlockedContent,
} from './PlayerProfile';

export const CURRENT_PROFILE_VERSION = 1;
export const PROFILE_STORAGE_KEY = 'riftbound.playerProfile.v1';
export const PROFILE_BACKUP_STORAGE_KEY = 'riftbound.playerProfile.backup.v1';

export function createDefaultStatistics(): PlayerStatistics {
  return {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalDamageDealt: 0,
    totalDamageReceived: 0,
    highestCombo: 0,
    totalSuccessfulCombos: 0,
    perfectGuards: 0,
    dodges: 0,
    specialAttacksUsed: 0,
    arcadeRunsStarted: 0,
    arcadeRunsCompleted: 0,
    arcadeRunsFailed: 0,
    charactersPlayed: {},
    arenasPlayed: {},
  };
}

export function createDefaultUnlockedContent(): UnlockedContent {
  const ids = new Set<string>();
  for (const c of getCharacterRegistry()) ids.add(`fighter:${c.id}`);
  for (const a of getArenaRegistry()) ids.add(`arena:${a.id}`);
  return {
    ids: Array.from(ids),
    equipped: {},
  };
}

export function createDefaultArcadeRunState(): ArcadeRunState {
  return {
    active: false,
    runId: null,
    characterId: null,
    difficulty: null,
    campaignId: null,
    seedBase: null,
    stages: [],
    opponentSequenceIds: [],
    currentStageIndex: 0,
    wins: 0,
    losses: 0,
    continuesUsed: 0,
    continuesRemaining: 0,
    completed: false,
    failed: false,
    rewardsGranted: false,
    stageResults: [],
    lastRewardedMatchToken: null,
  };
}

export function createDefaultArcadeProgress(): ArcadeProgress {
  return {
    runsStarted: 0,
    runsCompleted: 0,
    runsFailed: 0,
    endingsUnlocked: {},
    completions: {},
    currentRun: null,
    completionRewardsGranted: [],
  };
}

export function createDefaultSettings(): GameSettings {
  return {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    muted: false,
    reducedMotion: 'system',
    screenShake: true,
  };
}

export function createDefaultCharacterMastery(characterId: string): CharacterMastery {
  return {
    characterId,
    masteryLevel: 1,
    masteryXP: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    highestCombo: 0,
    characterAchievementProgress: {},
  };
}

export function createDefaultProfile(): PlayerProfile {
  const characterMastery: Record<string, CharacterMastery> = {};
  for (const c of getCharacterRegistry()) {
    characterMastery[c.id] = createDefaultCharacterMastery(c.id);
  }
  return {
    version: CURRENT_PROFILE_VERSION,
    playerLevel: 1,
    totalXP: 0,
    statistics: createDefaultStatistics(),
    characterMastery,
    unlockedContent: createDefaultUnlockedContent(),
    achievements: [],
    arcadeProgress: createDefaultArcadeProgress(),
    processedMatchRewardTokens: [],
    settings: createDefaultSettings(),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function asInt(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return Math.floor(asFiniteNumber(value, fallback, min, max));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback: string | null = null): string | null {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asRecordNumber(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
  }
  return out;
}

function asRecordBoolean(value: unknown): Record<string, boolean> {
  if (!isObject(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function sanitizeStatistics(raw: unknown): PlayerStatistics {
  const d = createDefaultStatistics();
  if (!isObject(raw)) return d;
  return {
    totalMatches: asInt(raw.totalMatches, d.totalMatches, 0),
    wins: asInt(raw.wins, d.wins, 0),
    losses: asInt(raw.losses, d.losses, 0),
    draws: asInt(raw.draws, d.draws, 0),
    totalDamageDealt: asInt(raw.totalDamageDealt, d.totalDamageDealt, 0),
    totalDamageReceived: asInt(raw.totalDamageReceived, d.totalDamageReceived, 0),
    highestCombo: asInt(raw.highestCombo, d.highestCombo, 0),
    totalSuccessfulCombos: asInt(raw.totalSuccessfulCombos, d.totalSuccessfulCombos, 0),
    perfectGuards: asInt(raw.perfectGuards, d.perfectGuards, 0),
    dodges: asInt(raw.dodges, d.dodges, 0),
    specialAttacksUsed: asInt(raw.specialAttacksUsed, d.specialAttacksUsed, 0),
    arcadeRunsStarted: asInt(raw.arcadeRunsStarted, d.arcadeRunsStarted, 0),
    arcadeRunsCompleted: asInt(raw.arcadeRunsCompleted, d.arcadeRunsCompleted, 0),
    arcadeRunsFailed: asInt(raw.arcadeRunsFailed, d.arcadeRunsFailed, 0),
    charactersPlayed: asRecordNumber(raw.charactersPlayed),
    arenasPlayed: asRecordNumber(raw.arenasPlayed),
  };
}

function sanitizeMastery(raw: unknown, characterId: string): CharacterMastery {
  const d = createDefaultCharacterMastery(characterId);
  if (!isObject(raw)) return d;
  return {
    characterId,
    masteryLevel: asInt(raw.masteryLevel, d.masteryLevel, 1, 20),
    masteryXP: asInt(raw.masteryXP, d.masteryXP, 0),
    matchesPlayed: asInt(raw.matchesPlayed, d.matchesPlayed, 0),
    wins: asInt(raw.wins, d.wins, 0),
    losses: asInt(raw.losses, d.losses, 0),
    highestCombo: asInt(raw.highestCombo, d.highestCombo, 0),
    characterAchievementProgress: asRecordNumber(raw.characterAchievementProgress),
  };
}

function sanitizeUnlockedContent(raw: unknown): UnlockedContent {
  const d = createDefaultUnlockedContent();
  if (!isObject(raw)) return d;
  const ids = Array.from(new Set([...d.ids, ...asStringArray(raw.ids)]));
  const equippedRaw = isObject(raw.equipped) ? raw.equipped : {};
  const equipped: UnlockedContent['equipped'] = {};
  for (const [k, v] of Object.entries(equippedRaw)) {
    if (typeof v === 'string') {
      (equipped as Record<string, string>)[k] = v;
    }
  }
  return { ids, equipped };
}

function sanitizeAchievementProgress(raw: unknown): AchievementProgress[] {
  if (!Array.isArray(raw)) return [];
  const out: AchievementProgress[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const id = asString(item.id);
    if (!id) continue;
    out.push({
      id,
      progress: asInt(item.progress, 0, 0),
      completed: asBoolean(item.completed, false),
      unlockedAt: typeof item.unlockedAt === 'number' && Number.isFinite(item.unlockedAt) ? item.unlockedAt : null,
      rewardGranted: asBoolean(item.rewardGranted, false),
    });
  }
  return out;
}

function sanitizeArcadeRunStage(raw: unknown): ArcadeRunStageState | null {
  if (!isObject(raw)) return null;
  const opponentCharacterId = asString(raw.opponentCharacterId);
  const arenaId = asString(raw.arenaId);
  const difficulty = asString(raw.difficulty);
  const personality = asString(raw.personality);
  if (!opponentCharacterId || !arenaId || !difficulty) return null;
  const allowedPers = new Set(['AGGRESSOR', 'DEFENDER', 'TRICKSTER', 'BRUISER']);
  const safePersonality: ArcadeRunStageState['personality'] =
    personality === 'DEFENDER' || personality === 'TRICKSTER' || personality === 'BRUISER'
      ? personality
      : 'AGGRESSOR';
  void allowedPers;
  return {
    index: asInt(raw.index, 0, 0),
    label: asString(raw.label) ?? `Stage ${asInt(raw.index, 0, 0) + 1}`,
    opponentCharacterId,
    arenaId,
    difficulty,
    personality: safePersonality,
    roundsToWin: asInt(raw.roundsToWin, 2, 1, 5),
    roundTimerSeconds: asInt(raw.roundTimerSeconds, 99, 0, 999),
    boss: asBoolean(raw.boss, false),
  };
}

function sanitizeArcadeRunState(raw: unknown): ArcadeRunState | null {
  if (!isObject(raw)) return null;
  const runId = asString(raw.runId);
  const rawStages = raw.stages;
  const stagesRaw: unknown[] = Array.isArray(rawStages) ? rawStages : [];
  const stages = stagesRaw
    .map((s) => sanitizeArcadeRunStage(s))
    .filter((s): s is ArcadeRunStageState => s !== null);
  const rawSeedBase = raw.seedBase;
  const seedBase =
    typeof rawSeedBase === 'number' && Number.isFinite(rawSeedBase) ? Math.floor(rawSeedBase) : null;
  const state: ArcadeRunState = {
    active: asBoolean(raw.active, false),
    runId,
    characterId: asString(raw.characterId),
    difficulty: asString(raw.difficulty),
    campaignId: asString(raw.campaignId),
    seedBase,
    stages,
    opponentSequenceIds: asStringArray(raw.opponentSequenceIds),
    currentStageIndex: asInt(raw.currentStageIndex, 0, 0),
    wins: asInt(raw.wins, 0, 0),
    losses: asInt(raw.losses, 0, 0),
    continuesUsed: asInt(raw.continuesUsed, 0, 0),
    continuesRemaining: asInt(raw.continuesRemaining, 0, 0),
    completed: asBoolean(raw.completed, false),
    failed: asBoolean(raw.failed, false),
    rewardsGranted: asBoolean(raw.rewardsGranted, false),
    stageResults: Array.isArray(raw.stageResults) ? raw.stageResults.map((v) => v === true) : [],
    lastRewardedMatchToken: asString(raw.lastRewardedMatchToken),
  };
  if (state.opponentSequenceIds.length === 0 && stages.length > 0) {
    state.opponentSequenceIds = stages.map((s) => s.opponentCharacterId);
  }
  if (!state.active && !state.runId) return null;
  return state;
}

function sanitizeSettings(raw: unknown): GameSettings {
  const d = createDefaultSettings();
  if (!isObject(raw)) return d;
  const reducedMotionRaw = raw.reducedMotion;
  const reducedMotion: GameSettings['reducedMotion'] =
    reducedMotionRaw === 'system' || typeof reducedMotionRaw === 'boolean' ? reducedMotionRaw : d.reducedMotion;
  return {
    masterVolume: asFiniteNumber(raw.masterVolume, d.masterVolume, 0, 1),
    musicVolume: asFiniteNumber(raw.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: asFiniteNumber(raw.sfxVolume, d.sfxVolume, 0, 1),
    muted: asBoolean(raw.muted, d.muted),
    reducedMotion,
    screenShake: asBoolean(raw.screenShake, d.screenShake),
  };
}

function sanitizeArcadeProgress(raw: unknown): ArcadeProgress {
  const d = createDefaultArcadeProgress();
  if (!isObject(raw)) return d;
  return {
    runsStarted: asInt(raw.runsStarted, d.runsStarted, 0),
    runsCompleted: asInt(raw.runsCompleted, d.runsCompleted, 0),
    runsFailed: asInt(raw.runsFailed, d.runsFailed, 0),
    endingsUnlocked: asRecordBoolean(raw.endingsUnlocked),
    completions: asRecordBoolean(raw.completions),
    currentRun: sanitizeArcadeRunState(raw.currentRun),
    completionRewardsGranted: asStringArray(raw.completionRewardsGranted),
  };
}

export interface ProfileLoadResult {
  profile: PlayerProfile;
  status: 'created' | 'loaded' | 'migrated' | 'recovered' | 'corrupted';
  message?: string;
}

export function sanitizeProfile(raw: unknown): PlayerProfile | null {
  if (!isObject(raw)) return null;
  const version = asInt(raw.version, CURRENT_PROFILE_VERSION, 1);
  if (version > CURRENT_PROFILE_VERSION) {
    return null;
  }

  const base = createDefaultProfile();
  const stats = sanitizeStatistics(raw.statistics);
  const masteryRaw = isObject(raw.characterMastery) ? raw.characterMastery : {};
  const characterMastery: Record<string, CharacterMastery> = { ...base.characterMastery };
  for (const c of getCharacterRegistry()) {
    characterMastery[c.id] = sanitizeMastery(masteryRaw[c.id], c.id);
  }

  const profile: PlayerProfile = {
    version: CURRENT_PROFILE_VERSION,
    playerLevel: asInt(raw.playerLevel, 1, 1, 100),
    totalXP: asInt(raw.totalXP, 0, 0),
    statistics: stats,
    characterMastery,
    unlockedContent: sanitizeUnlockedContent(raw.unlockedContent),
    achievements: sanitizeAchievementProgress(raw.achievements),
    arcadeProgress: sanitizeArcadeProgress(raw.arcadeProgress),
    processedMatchRewardTokens: asStringArray(raw.processedMatchRewardTokens).slice(-100),
    settings: sanitizeSettings(raw.settings),
  };
  return profile;
}

export function migrateProfile(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const version = typeof raw.version === 'number' ? raw.version : 0;
  const current: Record<string, unknown> = { ...raw };
  if (version < 1) {
    current.version = 1;
  }
  if (!Array.isArray(current.processedMatchRewardTokens)) {
    current.processedMatchRewardTokens = [];
  }
  if (!isObject(current.settings)) {
    current.settings = createDefaultSettings();
  }
  return current;
}

function safeGetStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // ignore
  }
  return null;
}

export function saveProfile(profile: PlayerProfile): boolean {
  const storage = safeGetStorage();
  if (!storage) return false;
  try {
    const existing = storage.getItem(PROFILE_STORAGE_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (sanitizeProfile(migrateProfile(parsed))) {
          storage.setItem(PROFILE_BACKUP_STORAGE_KEY, existing);
        }
      } catch {
        // don't backup corrupt existing over a good backup
      }
    }
    const normalized = sanitizeProfile(profile) ?? createDefaultProfile();
    storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function loadProfile(): ProfileLoadResult {
  const storage = safeGetStorage();
  if (!storage) {
    return { profile: createDefaultProfile(), status: 'created' };
  }

  const rawStr = storage.getItem(PROFILE_STORAGE_KEY);
  if (rawStr == null) {
    const created = createDefaultProfile();
    saveProfile(created);
    return { profile: created, status: 'created' };
  }

  try {
    const parsed = JSON.parse(rawStr);
    const migrated = migrateProfile(parsed);
    const sanitized = sanitizeProfile(migrated);
    if (sanitized) {
      const wasMigrated = isObject(parsed) && parsed.version !== CURRENT_PROFILE_VERSION;
      saveProfile(sanitized);
      return { profile: sanitized, status: wasMigrated ? 'migrated' : 'loaded' };
    }
  } catch {
    // fallthrough to recovery
  }

  const backupStr = storage.getItem(PROFILE_BACKUP_STORAGE_KEY);
  if (backupStr) {
    try {
      const backupParsed = JSON.parse(backupStr);
      const backupSanitized = sanitizeProfile(migrateProfile(backupParsed));
      if (backupSanitized) {
        storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(backupSanitized));
        return { profile: backupSanitized, status: 'recovered', message: 'Recovered profile from backup due to corrupted save data.' };
      }
    } catch {
      // ignore
    }
  }

  return {
    profile: createDefaultProfile(),
    status: 'corrupted',
    message: 'Save data was invalid or corrupted. Using safe defaults without overwriting the existing save file.',
  };
}

export function resetProfile(): PlayerProfile {
  const storage = safeGetStorage();
  const fresh = createDefaultProfile();
  if (storage) {
    try {
      const existing = storage.getItem(PROFILE_STORAGE_KEY);
      if (existing) storage.setItem(PROFILE_BACKUP_STORAGE_KEY, existing);
      storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore
    }
  }
  return fresh;
}

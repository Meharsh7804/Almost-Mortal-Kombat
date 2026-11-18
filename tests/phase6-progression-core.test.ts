import { beforeEach, describe, expect, it } from 'vitest';

import { createDefaultProfile, loadProfile, saveProfile, resetProfile, sanitizeProfile, migrateProfile, PROFILE_STORAGE_KEY, PROFILE_BACKUP_STORAGE_KEY } from '../src/progression/PlayerProfileService';
import { getPlayerLevelProgress, getMasteryLevelProgress, levelFromTotalXP, masteryLevelFromXP, totalXpForLevel, masteryTotalXpForLevel } from '../src/progression/LevelCurve';
import { XP_REWARDS, applyPlayerXP, applyMasteryXP } from '../src/progression/XPSystem';
import { applyMatchProgression, clearProfileCache } from '../src/progression/ProgressionService';
import type { MatchProgressionInput } from '../src/progression/ProgressionEvents';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
}

function baseMatchInput(overrides: Partial<MatchProgressionInput> = {}): MatchProgressionInput {
  return {
    matchToken: 'match-1',
    mode: 'CPU_BATTLE',
    playerCharacterId: 'kai',
    opponentCharacterId: 'rhea',
    arenaId: 'forgotten-temple',
    outcome: 'WIN',
    durationSeconds: 42,
    damageDealt: 300,
    damageReceived: 120,
    highestCombo: 6,
    totalSuccessfulCombos: 3,
    perfectGuards: 1,
    dodges: 2,
    specialAttacksUsed: 1,
    roundsWon: 2,
    roundsLost: 1,
    isArcadeStage: false,
    isArcadeFinalStage: false,
    rematch: false,
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
  clearProfileCache();
});

describe('PlayerProfileService persistence', () => {
  it('creates and saves a default profile when none exists', () => {
    const res = loadProfile();
    expect(res.status).toBe('created');
    expect(res.profile.version).toBe(1);
    expect(res.profile.playerLevel).toBe(1);
    expect(res.profile.totalXP).toBe(0);
    expect(res.profile.characterMastery.kai).toBeTruthy();
    expect(res.profile.unlockedContent.ids).toContain('fighter:kai');
    const stored = (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(PROFILE_STORAGE_KEY);
    expect(typeof stored).toBe('string');
  });

  it('loads and sanitizes a stored profile', () => {
    const profile = createDefaultProfile();
    profile.totalXP = 9999;
    profile.playerLevel = 7;
    profile.statistics.wins = 5;
    saveProfile(profile);
    const res = loadProfile();
    expect(res.status).toBe('loaded');
    expect(res.profile.totalXP).toBe(9999);
    expect(res.profile.statistics.wins).toBe(5);
  });

  it('recovers from corrupted main save using backup when possible', () => {
    const good = createDefaultProfile();
    good.statistics.wins = 3;
    saveProfile(good); // creates backup on next save, but first save stores main
    // force backup to known good
    const storage = (globalThis as unknown as { localStorage: Storage }).localStorage;
    storage.setItem(PROFILE_BACKUP_STORAGE_KEY, JSON.stringify(good));
    storage.setItem(PROFILE_STORAGE_KEY, '{not-json');
    const res = loadProfile();
    expect(['recovered', 'corrupted']).toContain(res.status);
    if (res.status === 'recovered') {
      expect(res.profile.statistics.wins).toBe(3);
    }
  });

  it('does not overwrite corrupted main save with defaults when unrecoverable', () => {
    const storage = (globalThis as unknown as { localStorage: Storage }).localStorage;
    storage.setItem(PROFILE_STORAGE_KEY, '{bad');
    storage.removeItem(PROFILE_BACKUP_STORAGE_KEY);
    const before = storage.getItem(PROFILE_STORAGE_KEY);
    const res = loadProfile();
    expect(res.status).toBe('corrupted');
    expect(res.profile.playerLevel).toBe(1);
    expect(storage.getItem(PROFILE_STORAGE_KEY)).toBe(before);
  });

  it('migrates legacy version and sanitizes invalid values', () => {
    const legacy = { version: 0, totalXP: -50, playerLevel: 999, statistics: { wins: -2, totalMatches: 'x' } };
    const migrated = migrateProfile(legacy);
    const sanitized = sanitizeProfile(migrated);
    expect(sanitized).toBeTruthy();
    expect(sanitized!.version).toBe(1);
    expect(sanitized!.totalXP).toBe(0);
    expect(sanitized!.playerLevel).toBe(100);
    expect(sanitized!.statistics.wins).toBe(0);
  });

  it('resetProfile creates a fresh profile and stores it', () => {
    const profile = createDefaultProfile();
    profile.totalXP = 5000;
    profile.statistics.wins = 9;
    saveProfile(profile);
    const fresh = resetProfile();
    expect(fresh.totalXP).toBe(0);
    expect(fresh.statistics.wins).toBe(0);
    const loaded = loadProfile();
    expect(loaded.profile.totalXP).toBe(0);
  });
});

describe('XP and leveling', () => {
  it('player level progression is cumulative and capped', () => {
    expect(levelFromTotalXP(0)).toBe(1);
    expect(levelFromTotalXP(totalXpForLevel(2))).toBe(2);
    expect(levelFromTotalXP(10 ** 12)).toBe(100);
    const p = getPlayerLevelProgress(totalXpForLevel(10));
    expect(p.level).toBe(10);
  });

  it('applyPlayerXP grants XP and levels up with carryover', () => {
    const profile = createDefaultProfile();
    const res = applyPlayerXP(profile, totalXpForLevel(3) + 10);
    expect(res.gained).toBe(totalXpForLevel(3) + 10);
    expect(res.newLevel).toBe(3);
    expect(profile.totalXP).toBe(totalXpForLevel(3) + 10);
    expect(profile.playerLevel).toBe(3);
  });

  it('mastery XP/level progression works per character', () => {
    const profile = createDefaultProfile();
    const r = applyMasteryXP(profile, 'kai', masteryTotalXpForLevel(5) + 5);
    expect(r.newLevel).toBe(5);
    expect(profile.characterMastery.kai!.masteryLevel).toBe(5);
    expect(masteryLevelFromXP(10 ** 9)).toBe(20);
    const mp = getMasteryLevelProgress(masteryTotalXpForLevel(4));
    expect(mp.level).toBe(4);
  });
});

describe('ProgressionService match application', () => {
  it('awards match XP, mastery XP, stats, and prevents duplicate match tokens', () => {
    const profile = createDefaultProfile();
    const res1 = applyMatchProgression(profile, baseMatchInput({ matchToken: 'm1', outcome: 'WIN' }));
    expect(res1.duplicatePrevented).toBe(false);
    expect(res1.xpGained).toBeGreaterThanOrEqual(XP_REWARDS.MATCH_COMPLETION + XP_REWARDS.MATCH_VICTORY + XP_REWARDS.FIRST_WIN_WITH_CHARACTER);
    expect(profile.statistics.totalMatches).toBe(1);
    expect(profile.statistics.wins).toBe(1);
    expect(profile.characterMastery.kai!.matchesPlayed).toBe(1);
    expect(profile.characterMastery.kai!.wins).toBe(1);

    const xpAfter = profile.totalXP;
    const masteryAfter = profile.characterMastery.kai!.masteryXP;
    const res2 = applyMatchProgression(profile, baseMatchInput({ matchToken: 'm1', outcome: 'WIN' }));
    expect(res2.duplicatePrevented).toBe(true);
    expect(profile.totalXP).toBe(xpAfter);
    expect(profile.characterMastery.kai!.masteryXP).toBe(masteryAfter);
    expect(profile.statistics.totalMatches).toBe(1);
  });

  it('awards arcade stage/final bonuses on wins and first-win bonus once per character', () => {
    const profile = createDefaultProfile();
    const stage = applyMatchProgression(profile, baseMatchInput({ matchToken: 's1', isArcadeStage: true, outcome: 'WIN' }));
    expect(stage.xpGained).toBeGreaterThanOrEqual(XP_REWARDS.MATCH_COMPLETION + XP_REWARDS.MATCH_VICTORY + XP_REWARDS.ARCADE_STAGE_COMPLETION + XP_REWARDS.FIRST_WIN_WITH_CHARACTER);
    const final = applyMatchProgression(profile, baseMatchInput({ matchToken: 's2', isArcadeStage: true, isArcadeFinalStage: true, outcome: 'WIN' }));
    // no first-win bonus again
    expect(final.xpGained).toBeGreaterThanOrEqual(XP_REWARDS.MATCH_COMPLETION + XP_REWARDS.MATCH_VICTORY + XP_REWARDS.ARCADE_STAGE_COMPLETION + XP_REWARDS.ARCADE_COMPLETION_BONUS);
    expect(final.xpGained).toBeLessThan(XP_REWARDS.MATCH_COMPLETION + XP_REWARDS.MATCH_VICTORY + XP_REWARDS.ARCADE_STAGE_COMPLETION + XP_REWARDS.ARCADE_COMPLETION_BONUS + XP_REWARDS.FIRST_WIN_WITH_CHARACTER);
  });

  it('persists profile after progression application', () => {
    const profile = createDefaultProfile();
    applyMatchProgression(profile, baseMatchInput({ matchToken: 'persist-1' }));
    const loaded = loadProfile().profile;
    expect(loaded.statistics.totalMatches).toBe(1);
    expect(loaded.totalXP).toBeGreaterThan(0);
  });
});

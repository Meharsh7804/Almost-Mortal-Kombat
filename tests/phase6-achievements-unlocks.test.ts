import { beforeEach, describe, expect, it } from 'vitest';

import { createDefaultProfile } from '../src/progression/PlayerProfileService';
import { clearProfileCache, applyMatchProgression } from '../src/progression/ProgressionService';
import { evaluateAchievements, getAchievementProgressValue } from '../src/progression/AchievementSystem';
import { evaluateUnlocks, isContentUnlocked } from '../src/progression/UnlockSystem';
import type { MatchProgressionInput } from '../src/progression/ProgressionEvents';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
}

function input(token: string, overrides: Partial<MatchProgressionInput> = {}): MatchProgressionInput {
  return {
    matchToken: token,
    mode: 'CPU_BATTLE',
    playerCharacterId: 'kai',
    opponentCharacterId: 'rhea',
    arenaId: 'forgotten-temple',
    outcome: 'WIN',
    durationSeconds: 30,
    damageDealt: 200,
    damageReceived: 50,
    highestCombo: 4,
    totalSuccessfulCombos: 2,
    perfectGuards: 0,
    dodges: 0,
    specialAttacksUsed: 0,
    roundsWon: 2,
    roundsLost: 0,
    isArcadeStage: false,
    isArcadeFinalStage: false,
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
  clearProfileCache();
});

describe('Unlocks', () => {
  it('includes default fighters and arenas and grants milestone unlocks', () => {
    const profile = createDefaultProfile();
    expect(isContentUnlocked(profile, 'fighter:kai')).toBe(true);
    expect(isContentUnlocked(profile, 'arena:forgotten-temple')).toBe(true);
    const added = evaluateUnlocks(profile, new Set(['first_win:kai', 'collector_10']));
    expect(profile.unlockedContent.ids).toContain('title:kai:initiate');
    expect(profile.unlockedContent.ids).toContain('title:profile:collector10');
    expect(added.length).toBeGreaterThanOrEqual(0);
  });

  it('grants mastery unlock at required level', () => {
    const profile = createDefaultProfile();
    profile.characterMastery.kai!.masteryLevel = 5;
    evaluateUnlocks(profile);
    expect(profile.unlockedContent.ids).toContain('palette:kai:mastery5');
  });
});

describe('Achievements', () => {
  it('unlocks combat achievements and grants rewards once', () => {
    const profile = createDefaultProfile();
    applyMatchProgression(profile, input('a1', { outcome: 'WIN', damageReceived: 0, highestCombo: 21, perfectGuards: 10 }));
    // combat_first_blood, character_first_steps, combat_untouchable
    expect(profile.achievements.find(a => a.id === 'combat_first_blood')?.completed).toBe(true);
    expect(profile.achievements.find(a => a.id === 'combat_untouchable')?.completed).toBe(true);
    expect(profile.achievements.find(a => a.id === 'character_first_steps')?.completed).toBe(true);
    // combo/perfect timing progress/complete
    expect(getAchievementProgressValue(profile, 'combat_combo_artist')).toBeGreaterThanOrEqual(20);
    expect(profile.achievements.find(a => a.id === 'combat_combo_artist')?.completed).toBe(true);
    expect(profile.achievements.find(a => a.id === 'combat_perfect_timing')?.completed).toBe(true);

    const totalXpBefore = profile.totalXP;
    const res = evaluateAchievements(profile);
    expect(res.unlocked.length).toBe(0);
    expect(profile.totalXP).toBe(totalXpBefore); // rewards not granted twice
  });

  it('tracks arcade completion achievements from progression flags', () => {
    const profile = createDefaultProfile();
    profile.arcadeProgress.runsCompleted = 1;
    profile.arcadeProgress.completions['arcade:default:NORMAL:any'] = true;
    profile.arcadeProgress.completions['arcade:default:HARD:any'] = true;
    profile.arcadeProgress.completions['arcade:default:EXPERT:any'] = true;
    evaluateAchievements(profile);
    expect(profile.achievements.find(a => a.id === 'arcade_road_to_glory')?.completed).toBe(true);
    expect(profile.achievements.find(a => a.id === 'arcade_champion')?.completed).toBe(true);
    expect(profile.achievements.find(a => a.id === 'arcade_nightmare')?.completed).toBe(true);
    expect(profile.achievements.find(a => a.id === 'arcade_rift_conqueror')?.completed).toBe(true);
  });
});

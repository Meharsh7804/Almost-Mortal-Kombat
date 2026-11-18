import { applyMasteryXP } from './XPSystem';
import type { PlayerProfile } from './PlayerProfile';

export const MASTERY_REWARDS_BY_LEVEL: Record<number, string[]> = {
  5: ['palette:{char}:mastery5'],
  10: ['victory:{char}:mastery10'],
  20: ['badge:{char}:mastery20'],
};

export function ensureCharacterMastery(profile: PlayerProfile, characterId: string): void {
  if (!profile.characterMastery[characterId]) {
    profile.characterMastery[characterId] = {
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
}

export interface MasteryGainResult {
  gained: number;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  rewardUnlockIds: string[];
}

export function grantMasteryXP(profile: PlayerProfile, characterId: string, amount: number): MasteryGainResult {
  ensureCharacterMastery(profile, characterId);
  const result = applyMasteryXP(profile, characterId, amount);
  const rewardUnlockIds: string[] = [];
  if (result.leveledUp) {
    for (let lvl = result.previousLevel + 1; lvl <= result.newLevel; lvl += 1) {
      const templates = MASTERY_REWARDS_BY_LEVEL[lvl] ?? [];
      for (const t of templates) {
        rewardUnlockIds.push(t.replace('{char}', characterId));
      }
    }
  }
  return { ...result, rewardUnlockIds };
}

import { getPlayerLevelProgress, getMasteryLevelProgress, levelFromTotalXP, masteryLevelFromXP } from './LevelCurve';
import type { PlayerProfile } from './PlayerProfile';

export const XP_REWARDS = Object.freeze({
  MATCH_COMPLETION: 50,
  MATCH_VICTORY: 100,
  ARCADE_STAGE_COMPLETION: 75,
  ARCADE_COMPLETION_BONUS: 500,
  FIRST_WIN_WITH_CHARACTER: 150,
});

export interface XpGrant {
  amount: number;
  reason: string;
  key?: string; // idempotency key within a match context
}

export function applyPlayerXP(profile: PlayerProfile, amount: number): { gained: number; leveledUp: boolean; previousLevel: number; newLevel: number } {
  const gained = Math.max(0, Math.floor(amount));
  const previousLevel = profile.playerLevel;
  profile.totalXP = Math.max(0, Math.floor(profile.totalXP + gained));
  const newLevel = levelFromTotalXP(profile.totalXP);
  profile.playerLevel = newLevel;
  return { gained, leveledUp: newLevel > previousLevel, previousLevel, newLevel };
}

export function applyMasteryXP(profile: PlayerProfile, characterId: string, amount: number): { gained: number; leveledUp: boolean; previousLevel: number; newLevel: number } {
  const gained = Math.max(0, Math.floor(amount));
  const mastery = profile.characterMastery[characterId];
  if (!mastery) {
    return { gained: 0, leveledUp: false, previousLevel: 1, newLevel: 1 };
  }
  const previousLevel = mastery.masteryLevel;
  mastery.masteryXP = Math.max(0, Math.floor(mastery.masteryXP + gained));
  const newLevel = masteryLevelFromXP(mastery.masteryXP);
  mastery.masteryLevel = newLevel;
  return { gained, leveledUp: newLevel > previousLevel, previousLevel, newLevel };
}

export function getLevelProgressForProfile(profile: PlayerProfile) {
  return getPlayerLevelProgress(profile.totalXP);
}

export function getMasteryProgressForProfile(profile: PlayerProfile, characterId: string) {
  const mastery = profile.characterMastery[characterId];
  return getMasteryLevelProgress(mastery?.masteryXP ?? 0);
}

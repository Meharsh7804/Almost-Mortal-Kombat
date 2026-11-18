import type { PlayerProfile } from './PlayerProfile';
import type { MatchProgressionInput, ProgressionNotificationPayload, ProgressionUpdateResult } from './ProgressionEvents';
import { XP_REWARDS, applyPlayerXP } from './XPSystem';
import { ensureCharacterMastery, grantMasteryXP } from './MasteryService';
import { evaluateUnlocks } from './UnlockSystem';
import { evaluateAchievements, onMatchForAchievements } from './AchievementSystem';
import { loadProfile, resetProfile, saveProfile } from './PlayerProfileService';
import { levelFromTotalXP } from './LevelCurve';
import { pushProgressionNotifications, emitSaveError, emitLoadInfo } from './ProgressionNotifications';

function ensureArrayToken(profile: PlayerProfile, token: string): boolean {
  if (!token) return true;
  if (profile.processedMatchRewardTokens.includes(token)) return false;
  profile.processedMatchRewardTokens.push(token);
  if (profile.processedMatchRewardTokens.length > 120) {
    profile.processedMatchRewardTokens.splice(0, profile.processedMatchRewardTokens.length - 120);
  }
  return true;
}

export function updateStatisticsFromMatch(profile: PlayerProfile, input: MatchProgressionInput): void {
  const s = profile.statistics;
  s.totalMatches += 1;
  if (input.outcome === 'WIN') s.wins += 1;
  else if (input.outcome === 'LOSS') s.losses += 1;
  else s.draws += 1;

  s.totalDamageDealt += Math.max(0, Math.floor(input.damageDealt));
  s.totalDamageReceived += Math.max(0, Math.floor(input.damageReceived));
  s.highestCombo = Math.max(s.highestCombo, Math.max(0, Math.floor(input.highestCombo)));
  s.totalSuccessfulCombos += Math.max(0, Math.floor(input.totalSuccessfulCombos));
  s.perfectGuards += Math.max(0, Math.floor(input.perfectGuards));
  s.dodges += Math.max(0, Math.floor(input.dodges));
  s.specialAttacksUsed += Math.max(0, Math.floor(input.specialAttacksUsed));
  s.charactersPlayed[input.playerCharacterId] = (s.charactersPlayed[input.playerCharacterId] ?? 0) + 1;
  s.arenasPlayed[input.arenaId] = (s.arenasPlayed[input.arenaId] ?? 0) + 1;

  ensureCharacterMastery(profile, input.playerCharacterId);
  const m = profile.characterMastery[input.playerCharacterId]!;
  m.matchesPlayed += 1;
  if (input.outcome === 'WIN') m.wins += 1;
  if (input.outcome === 'LOSS') m.losses += 1;
  m.highestCombo = Math.max(m.highestCombo, Math.max(0, Math.floor(input.highestCombo)));
}

export function computeMatchXP(input: MatchProgressionInput, profile: PlayerProfile): { xp: number; masteryXp: number; notifications: ProgressionNotificationPayload[]; reasons: string[] } {
  let xp = 0;
  let masteryXp = 0;
  const notifications: ProgressionNotificationPayload[] = [];
  const reasons: string[] = [];

  xp += XP_REWARDS.MATCH_COMPLETION;
  reasons.push('match_completion');
  if (input.outcome === 'WIN') {
    xp += XP_REWARDS.MATCH_VICTORY;
    reasons.push('match_victory');
  }
  if (input.isArcadeStage && input.outcome === 'WIN') {
    xp += XP_REWARDS.ARCADE_STAGE_COMPLETION;
    reasons.push('arcade_stage');
  }
  if (input.isArcadeFinalStage && input.outcome === 'WIN') {
    xp += XP_REWARDS.ARCADE_COMPLETION_BONUS;
    reasons.push('arcade_completion');
  }

  const mastery = profile.characterMastery[input.playerCharacterId];
  if (input.outcome === 'WIN' && mastery && mastery.wins === 1) {
    xp += XP_REWARDS.FIRST_WIN_WITH_CHARACTER;
    reasons.push('first_win_character');
    notifications.push({ kind: 'XP', title: 'First Win Bonus', description: `First victory with this fighter! +${XP_REWARDS.FIRST_WIN_WITH_CHARACTER} XP` });
  }

  masteryXp += 40;
  if (input.outcome === 'WIN') masteryXp += 70;
  if (input.isArcadeStage && input.outcome === 'WIN') masteryXp += 35;
  masteryXp += Math.min(50, Math.floor(input.totalSuccessfulCombos) * 2);
  masteryXp += Math.min(40, Math.floor(input.specialAttacksUsed) * 3);
  masteryXp += Math.min(40, Math.floor(input.perfectGuards) * 5);
  if (input.highestCombo >= 10) masteryXp += 20;

  return { xp, masteryXp, notifications, reasons };
}

export function applyMatchProgression(profile: PlayerProfile, input: MatchProgressionInput): ProgressionUpdateResult {
  const notifications: ProgressionNotificationPayload[] = [];
  const unlockedIds: string[] = [];
  const achievementsUnlocked: string[] = [];
  let xpGained = 0;
  let masteryXpGained = 0;
  let leveledUp = false;
  let masteryLeveledUp = false;

  if (!ensureArrayToken(profile, input.matchToken)) {
    return { xpGained: 0, masteryXpGained: 0, leveledUp: false, masteryLeveledUp: false, notifications: [], unlockedIds: [], achievementsUnlocked: [], duplicatePrevented: true };
  }

  updateStatisticsFromMatch(profile, input);

  const { xp, masteryXp, notifications: xpNotifs } = computeMatchXP(input, profile);
  notifications.push(...xpNotifs);

  const playerXpRes = applyPlayerXP(profile, xp);
  xpGained += playerXpRes.gained;
  if (playerXpRes.leveledUp) {
    leveledUp = true;
    notifications.push({ kind: 'LEVEL_UP', title: `Level Up! ${playerXpRes.newLevel}`, description: `Player level increased from ${playerXpRes.previousLevel}.`, meta: { level: playerXpRes.newLevel } });
  }

  const masteryRes = grantMasteryXP(profile, input.playerCharacterId, masteryXp);
  masteryXpGained += masteryRes.gained;
  if (masteryRes.leveledUp) {
    masteryLeveledUp = true;
    notifications.push({ kind: 'MASTERY_UP', title: `Mastery Up! Lv ${masteryRes.newLevel}`, description: `${input.playerCharacterId.toUpperCase()} mastery increased.`, meta: { characterId: input.playerCharacterId, level: masteryRes.newLevel } });
  }
  for (const id of masteryRes.rewardUnlockIds) {
    if (!profile.unlockedContent.ids.includes(id)) {
      profile.unlockedContent.ids.push(id);
      unlockedIds.push(id);
      notifications.push({ kind: 'UNLOCK', title: 'Reward Unlocked', description: id, meta: { id } });
    }
  }

  const milestones = new Set<string>();
  if ((profile.characterMastery[input.playerCharacterId]?.wins ?? 0) >= 1) milestones.add(`first_win:${input.playerCharacterId}`);
  if (profile.unlockedContent.ids.length >= 10) milestones.add('collector_10');

  const newUnlocks = evaluateUnlocks(profile, milestones);
  for (const id of newUnlocks) {
    if (!unlockedIds.includes(id)) {
      unlockedIds.push(id);
      notifications.push({ kind: 'UNLOCK', title: 'Content Unlocked', description: id, meta: { id } });
    }
  }

  onMatchForAchievements(profile, input);
  const achRes = evaluateAchievements(profile);
  achievementsUnlocked.push(...achRes.unlocked);
  notifications.push(...achRes.notifications);
  xpGained += achRes.xpGranted;
  profile.playerLevel = levelFromTotalXP(profile.totalXP);

  // summary notifications for XP gain (kept lightweight)
  if (xpGained > 0) {
    notifications.unshift({ kind: 'XP', title: 'XP Gained', description: `+${xpGained} XP` });
  }

  const saved = saveProfile(profile);
  if (!saved) emitSaveError();
  pushProgressionNotifications(notifications);
  return { xpGained, masteryXpGained, leveledUp, masteryLeveledUp, notifications, unlockedIds, achievementsUnlocked, duplicatePrevented: false };
}

let cachedProfile: PlayerProfile | null = null;
let lastLoadStatus: ReturnType<typeof loadProfile>['status'] | null = null;
let lastLoadMessage: string | null = null;

export function getOrLoadProfile(): PlayerProfile {
  if (cachedProfile) return cachedProfile;
  const loaded = loadProfile();
  cachedProfile = loaded.profile;
  lastLoadStatus = loaded.status;
  lastLoadMessage = loaded.message ?? null;
  if (loaded.status === 'recovered') {
    emitLoadInfo(loaded.message ?? 'Recovered progression data from backup.');
  } else if (loaded.status === 'corrupted') {
    emitLoadInfo(loaded.message ?? 'Progression save data was corrupted; using safe defaults.');
  } else if (loaded.status === 'migrated') {
    emitLoadInfo('Progression profile migrated to the latest version.');
  }
  return cachedProfile;
}

export function getLastProfileLoadInfo(): { status: ReturnType<typeof loadProfile>['status'] | null; message: string | null } {
  return { status: lastLoadStatus, message: lastLoadMessage };
}

export function setCachedProfile(profile: PlayerProfile): void {
  cachedProfile = profile;
}

export function clearProfileCache(): void {
  cachedProfile = null;
  lastLoadStatus = null;
  lastLoadMessage = null;
}

export function reloadProfileCache(): PlayerProfile {
  const loaded = loadProfile();
  cachedProfile = loaded.profile;
  lastLoadStatus = loaded.status;
  lastLoadMessage = loaded.message ?? null;
  return cachedProfile;
}

export function persistProfile(profile: PlayerProfile = getOrLoadProfile()): boolean {
  cachedProfile = profile;
  const saved = saveProfile(profile);
  if (!saved) emitSaveError();
  return saved;
}

export function resetCachedProfileAndStorage(): PlayerProfile {
  cachedProfile = resetProfile();
  lastLoadStatus = 'created';
  lastLoadMessage = null;
  return cachedProfile;
}

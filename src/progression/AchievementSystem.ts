import type { PlayerProfile } from './PlayerProfile';
import type { MatchProgressionInput, ProgressionNotificationPayload } from './ProgressionEvents';
import { ACHIEVEMENT_REGISTRY } from './AchievementRegistry';
import { UNLOCK_REGISTRY_MAP } from './UnlockRegistry';
import { getCharacterRegistry } from '../data/CharacterRegistry';
import { getArenaRegistry } from '../data/ArenaRegistry';
import { applyPlayerXP } from './XPSystem';
import { levelFromTotalXP } from './LevelCurve';

function ensureProgress(profile: PlayerProfile, id: string) {
  let entry = profile.achievements.find((a) => a.id === id);
  if (!entry) {
    entry = { id, progress: 0, completed: false, unlockedAt: null, rewardGranted: false };
    profile.achievements.push(entry);
  }
  return entry;
}

export function syncAchievementTargets(_profile: PlayerProfile): void {
  void _profile;
}

export function getAchievementTarget(id: string): number {
  const def = ACHIEVEMENT_REGISTRY.find((a) => a.id === id);
  if (!def) return 0;
  if (id === 'collection_roster_complete') return getCharacterRegistry().length;
  if (id === 'collection_arena_explorer') return getArenaRegistry().length;
  return def.targetValue;
}

export function getAchievementProgressValue(profile: PlayerProfile, id: string): number {
  const target = getAchievementTarget(id);
  switch (id) {
    case 'combat_first_blood':
    case 'character_first_steps':
      return Math.min(target, profile.statistics.wins > 0 ? 1 : 0);
    case 'combat_no_mercy':
      return Math.min(target, profile.statistics.wins);
    case 'combat_perfect_timing':
      return Math.min(target, profile.statistics.perfectGuards);
    case 'combat_combo_artist':
      return Math.min(target, profile.statistics.highestCombo);
    case 'combat_untouchable':
      return ensureProgress(profile, id).progress;
    case 'arcade_road_to_glory':
      return Math.min(target, profile.arcadeProgress.runsCompleted > 0 ? 1 : 0);
    case 'arcade_champion':
      return profile.arcadeProgress.completions['arcade:default:NORMAL:any'] ? 1 : 0;
    case 'arcade_nightmare':
      return profile.arcadeProgress.completions['arcade:default:HARD:any'] ? 1 : 0;
    case 'arcade_rift_conqueror':
      return profile.arcadeProgress.completions['arcade:default:EXPERT:any'] ? 1 : 0;
    case 'character_specialist':
      return Math.max(0, ...Object.values(profile.characterMastery).map((m) => m.masteryLevel));
    case 'character_true_master':
      return Math.max(0, ...Object.values(profile.characterMastery).map((m) => m.masteryLevel));
    case 'collection_collector':
      return profile.unlockedContent.ids.length;
    case 'collection_roster_complete': {
      const total = getCharacterRegistry().length;
      const unlocked = getCharacterRegistry().filter((c) => profile.unlockedContent.ids.includes(`fighter:${c.id}`)).length;
      return Math.min(total, unlocked);
    }
    case 'collection_arena_explorer': {
      const total = getArenaRegistry().length;
      const played = Object.keys(profile.statistics.arenasPlayed).length;
      return Math.min(total, played);
    }
    default:
      return ensureProgress(profile, id).progress;
  }
}

export interface AchievementUpdateResult {
  unlocked: string[];
  notifications: ProgressionNotificationPayload[];
  xpGranted: number;
  unlockIdsGranted: string[];
}

export function evaluateAchievements(profile: PlayerProfile): AchievementUpdateResult {
  syncAchievementTargets(profile);
  const unlocked: string[] = [];
  const notifications: ProgressionNotificationPayload[] = [];
  let xpGranted = 0;
  const unlockIdsGranted: string[] = [];

  for (const def of ACHIEVEMENT_REGISTRY) {
    const entry = ensureProgress(profile, def.id);
    const target = getAchievementTarget(def.id);
    const value = getAchievementProgressValue(profile, def.id);
    entry.progress = Math.max(entry.progress, value);

    if (!entry.completed && target > 0 && entry.progress >= target) {
      entry.completed = true;
      entry.unlockedAt = Date.now();
      unlocked.push(def.id);
      notifications.push({ kind: 'ACHIEVEMENT', title: `Achievement Unlocked: ${def.name}`, description: def.description, meta: { id: def.id } });
    }

    if (entry.completed && !entry.rewardGranted) {
      if (def.reward.xp) {
        const r = applyPlayerXP(profile, def.reward.xp);
        xpGranted += r.gained;
      }
      if (def.reward.unlockIds) {
        for (const id of def.reward.unlockIds) {
          if (!UNLOCK_REGISTRY_MAP.has(id)) continue;
          if (!profile.unlockedContent.ids.includes(id)) {
            profile.unlockedContent.ids.push(id);
            unlockIdsGranted.push(id);
          }
        }
      }
      entry.rewardGranted = true;
    }
  }

  if (xpGranted > 0) {
    profile.playerLevel = levelFromTotalXP(profile.totalXP);
  }

  return { unlocked, notifications, xpGranted, unlockIdsGranted };
}

export function onMatchForAchievements(profile: PlayerProfile, input: MatchProgressionInput): void {
  if (input.outcome === 'WIN' && input.damageReceived <= 0) {
    const entry = ensureProgress(profile, 'combat_untouchable');
    entry.progress = Math.max(entry.progress, 1);
  }
}

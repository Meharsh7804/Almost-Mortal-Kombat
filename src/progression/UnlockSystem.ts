import type { PlayerProfile } from './PlayerProfile';
import { UNLOCK_REGISTRY, getUnlockDefinition } from './UnlockRegistry';

export interface UnlockEvaluationContext {
  profile: PlayerProfile;
  milestones?: Set<string>;
}

export function isContentUnlocked(profile: PlayerProfile, id: string): boolean {
  return profile.unlockedContent.ids.includes(id);
}

export function canUnlock(defId: string, ctx: UnlockEvaluationContext): boolean {
  const def = getUnlockDefinition(defId);
  if (!def) return false;
  if (ctx.profile.unlockedContent.ids.includes(defId)) return false;

  switch (def.unlockCondition.type) {
    case 'DEFAULT':
      return true;
    case 'PLAYER_LEVEL':
      return ctx.profile.playerLevel >= Number(def.unlockCondition.value ?? 1);
    case 'MASTERY_LEVEL': {
      const charId = def.unlockCondition.characterId;
      if (!charId) return false;
      const mastery = ctx.profile.characterMastery[charId];
      return (mastery?.masteryLevel ?? 1) >= Number(def.unlockCondition.value ?? 1);
    }
    case 'ARCADE_COMPLETION':
      return ctx.profile.arcadeProgress.runsCompleted > 0;
    case 'ARCADE_DIFFICULTY_COMPLETION': {
      const diff = def.unlockCondition.difficulty;
      if (!diff) return false;
      // Check any completion for this difficulty
      return Object.keys(ctx.profile.arcadeProgress.completions).some((k) => k.includes(`:${diff}:`) && ctx.profile.arcadeProgress.completions[k]);
    }
    case 'ACHIEVEMENT': {
      const achId = String(def.unlockCondition.value ?? '');
      return ctx.profile.achievements.some((a) => a.id === achId && a.completed);
    }
    case 'MILESTONE': {
      const key = String(def.unlockCondition.value ?? '');
      return ctx.milestones?.has(key) ?? false;
    }
    default:
      return false;
  }
}

export function evaluateUnlocks(profile: PlayerProfile, milestones?: Set<string>): string[] {
  const ctx: UnlockEvaluationContext = { profile, milestones };
  const newlyUnlocked: string[] = [];
  for (const def of UNLOCK_REGISTRY) {
    if (canUnlock(def.id, ctx)) {
      profile.unlockedContent.ids.push(def.id);
      newlyUnlocked.push(def.id);
    }
  }
  return newlyUnlocked;
}

export function grantUnlock(profile: PlayerProfile, id: string): boolean {
  if (!getUnlockDefinition(id)) return false;
  if (profile.unlockedContent.ids.includes(id)) return false;
  profile.unlockedContent.ids.push(id);
  return true;
}

export type AchievementCategory = 'COMBAT' | 'ARCADE' | 'CHARACTER' | 'COLLECTION';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  hidden: boolean;
  progressType: 'boolean' | 'counter';
  targetValue: number;
  reward: { xp?: number; unlockIds?: string[] };
  completionStatus?: boolean;
  unlockTimestamp?: number | null;
}

const defs: AchievementDefinition[] = [
  { id: 'combat_first_blood', name: 'First Blood', description: 'Win your first match.', category: 'COMBAT', icon: '⚔', hidden: false, progressType: 'counter', targetValue: 1, reward: { xp: 100 } },
  { id: 'combat_untouchable', name: 'Untouchable', description: 'Win a match while taking no damage.', category: 'COMBAT', icon: '🛡', hidden: false, progressType: 'counter', targetValue: 1, reward: { xp: 150 } },
  { id: 'combat_perfect_timing', name: 'Perfect Timing', description: 'Perform 10 perfect guards (lifetime).', category: 'COMBAT', icon: '⏱', hidden: false, progressType: 'counter', targetValue: 10, reward: { xp: 120 } },
  { id: 'combat_combo_artist', name: 'Combo Artist', description: 'Land a 20-hit combo.', category: 'COMBAT', icon: '🔥', hidden: false, progressType: 'counter', targetValue: 20, reward: { xp: 150 } },
  { id: 'combat_no_mercy', name: 'No Mercy', description: 'Win 10 matches.', category: 'COMBAT', icon: '☠', hidden: false, progressType: 'counter', targetValue: 10, reward: { xp: 200 } },

  { id: 'arcade_road_to_glory', name: 'Road to Glory', description: 'Complete your first arcade run.', category: 'ARCADE', icon: '🏁', hidden: false, progressType: 'counter', targetValue: 1, reward: { xp: 200, unlockIds: ['title:arcade:road_to_glory'] } },
  { id: 'arcade_champion', name: 'Champion', description: 'Complete arcade on Normal difficulty.', category: 'ARCADE', icon: '🏆', hidden: false, progressType: 'counter', targetValue: 1, reward: { xp: 250, unlockIds: ['badge:arcade:normal'] } },
  { id: 'arcade_nightmare', name: 'Nightmare', description: 'Complete arcade on Hard difficulty.', category: 'ARCADE', icon: '🌑', hidden: false, progressType: 'counter', targetValue: 1, reward: { xp: 350, unlockIds: ['badge:arcade:hard'] } },
  { id: 'arcade_rift_conqueror', name: 'Rift Conqueror', description: 'Complete arcade on Expert difficulty.', category: 'ARCADE', icon: '👑', hidden: false, progressType: 'counter', targetValue: 1, reward: { xp: 500, unlockIds: ['badge:arcade:expert'] } },

  { id: 'character_first_steps', name: 'First Steps', description: 'Win a match with any character.', category: 'CHARACTER', icon: '👣', hidden: false, progressType: 'counter', targetValue: 1, reward: { xp: 100 } },
  { id: 'character_specialist', name: 'Specialist', description: 'Reach mastery level 10 with any character.', category: 'CHARACTER', icon: '🎯', hidden: false, progressType: 'counter', targetValue: 10, reward: { xp: 200 } },
  { id: 'character_true_master', name: 'True Master', description: 'Reach mastery level 20 with any character.', category: 'CHARACTER', icon: '🥋', hidden: false, progressType: 'counter', targetValue: 20, reward: { xp: 300 } },

  { id: 'collection_collector', name: 'Collector', description: 'Unlock 10 rewards.', category: 'COLLECTION', icon: '📦', hidden: false, progressType: 'counter', targetValue: 10, reward: { xp: 150, unlockIds: ['title:profile:collector10'] } },
  { id: 'collection_roster_complete', name: 'Roster Complete', description: 'Unlock all available fighters.', category: 'COLLECTION', icon: '🧩', hidden: false, progressType: 'counter', targetValue: 0, reward: { xp: 100 } },
  { id: 'collection_arena_explorer', name: 'Arena Explorer', description: 'Play every arena.', category: 'COLLECTION', icon: '🗺', hidden: false, progressType: 'counter', targetValue: 0, reward: { xp: 100 } },
];

export const ACHIEVEMENT_REGISTRY: readonly AchievementDefinition[] = Object.freeze(
  defs.map((a) =>
    Object.freeze({
      ...a,
      reward: Object.freeze({
        ...a.reward,
        unlockIds: a.reward.unlockIds ? [...a.reward.unlockIds] : undefined,
      }),
    }),
  ),
);

export const ACHIEVEMENT_REGISTRY_MAP = new Map(ACHIEVEMENT_REGISTRY.map((a) => [a.id, a]));

export function getAchievementDefinition(id: string): AchievementDefinition | null {
  return ACHIEVEMENT_REGISTRY_MAP.get(id) ?? null;
}

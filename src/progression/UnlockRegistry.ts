import { getArenaRegistry } from '../data/ArenaRegistry';
import { getCharacterRegistry } from '../data/CharacterRegistry';

export type UnlockConditionType =
  | 'DEFAULT'
  | 'PLAYER_LEVEL'
  | 'MASTERY_LEVEL'
  | 'ARCADE_COMPLETION'
  | 'ARCADE_DIFFICULTY_COMPLETION'
  | 'ACHIEVEMENT'
  | 'MILESTONE';

export interface UnlockDefinition {
  id: string;
  contentType: 'FIGHTER' | 'COSTUME' | 'PALETTE' | 'ARENA' | 'TITLE' | 'BADGE' | 'VICTORY_POSE' | 'COSMETIC_EFFECT';
  displayName: string;
  description: string;
  unlockCondition: { type: UnlockConditionType; value?: string | number; characterId?: string; difficulty?: string };
  rewardSource: string;
  icon?: string;
  preview?: string;
  defaultUnlocked: boolean;
}

const defs: UnlockDefinition[] = [];

// Default fighters/arenas
for (const c of getCharacterRegistry()) {
  defs.push({
    id: `fighter:${c.id}`,
    contentType: 'FIGHTER',
    displayName: c.displayName,
    description: `Playable fighter ${c.displayName}.`,
    unlockCondition: { type: 'DEFAULT' },
    rewardSource: 'default',
    defaultUnlocked: true,
  });
  defs.push({
    id: `title:${c.id}:initiate`,
    contentType: 'TITLE',
    displayName: `${c.displayName} Initiate`,
    description: `Win your first match with ${c.displayName}.`,
    unlockCondition: { type: 'MILESTONE', value: `first_win:${c.id}` },
    rewardSource: 'milestone',
    defaultUnlocked: false,
  });
  defs.push({
    id: `palette:${c.id}:mastery5`,
    contentType: 'PALETTE',
    displayName: `${c.displayName} Alt Palette I`,
    description: `Reach mastery level 5 with ${c.displayName}.`,
    unlockCondition: { type: 'MASTERY_LEVEL', characterId: c.id, value: 5 },
    rewardSource: 'mastery',
    defaultUnlocked: false,
  });
  defs.push({
    id: `victory:${c.id}:mastery10`,
    contentType: 'VICTORY_POSE',
    displayName: `${c.displayName} Victory Pose`,
    description: `Reach mastery level 10 with ${c.displayName}.`,
    unlockCondition: { type: 'MASTERY_LEVEL', characterId: c.id, value: 10 },
    rewardSource: 'mastery',
    defaultUnlocked: false,
  });
  defs.push({
    id: `badge:${c.id}:mastery20`,
    contentType: 'BADGE',
    displayName: `${c.displayName} True Master`,
    description: `Reach mastery level 20 with ${c.displayName}.`,
    unlockCondition: { type: 'MASTERY_LEVEL', characterId: c.id, value: 20 },
    rewardSource: 'mastery',
    defaultUnlocked: false,
  });
}

for (const a of getArenaRegistry()) {
  defs.push({
    id: `arena:${a.id}`,
    contentType: 'ARENA',
    displayName: a.name,
    description: a.description,
    unlockCondition: { type: 'DEFAULT' },
    rewardSource: 'default',
    defaultUnlocked: true,
  });
}

defs.push(
  {
    id: 'title:arcade:road_to_glory',
    contentType: 'TITLE',
    displayName: 'Road to Glory',
    description: 'Complete your first arcade run.',
    unlockCondition: { type: 'ARCADE_COMPLETION', value: 'any' },
    rewardSource: 'arcade',
    defaultUnlocked: false,
  },
  {
    id: 'badge:arcade:normal',
    contentType: 'BADGE',
    displayName: 'Arcade Champion',
    description: 'Complete arcade on Normal difficulty.',
    unlockCondition: { type: 'ARCADE_DIFFICULTY_COMPLETION', difficulty: 'NORMAL' },
    rewardSource: 'arcade',
    defaultUnlocked: false,
  },
  {
    id: 'badge:arcade:hard',
    contentType: 'BADGE',
    displayName: 'Nightmare Breaker',
    description: 'Complete arcade on Hard difficulty.',
    unlockCondition: { type: 'ARCADE_DIFFICULTY_COMPLETION', difficulty: 'HARD' },
    rewardSource: 'arcade',
    defaultUnlocked: false,
  },
  {
    id: 'badge:arcade:expert',
    contentType: 'BADGE',
    displayName: 'Rift Conqueror',
    description: 'Complete arcade on Expert difficulty.',
    unlockCondition: { type: 'ARCADE_DIFFICULTY_COMPLETION', difficulty: 'EXPERT' },
    rewardSource: 'arcade',
    defaultUnlocked: false,
  },
  {
    id: 'title:profile:collector10',
    contentType: 'TITLE',
    displayName: 'Collector',
    description: 'Unlock 10 rewards.',
    unlockCondition: { type: 'MILESTONE', value: 'collector_10' },
    rewardSource: 'achievement',
    defaultUnlocked: false,
  },
);

export const UNLOCK_REGISTRY: readonly UnlockDefinition[] = Object.freeze(defs.map((d) => Object.freeze({ ...d })));
export const UNLOCK_REGISTRY_MAP = new Map(UNLOCK_REGISTRY.map((d) => [d.id, d]));

export function getUnlockDefinition(id: string): UnlockDefinition | null {
  return UNLOCK_REGISTRY_MAP.get(id) ?? null;
}

export const MAX_PLAYER_LEVEL = 100;
export const MAX_MASTERY_LEVEL = 20;

export interface LevelProgress {
  level: number;
  currentLevelXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  progress01: number;
}

/**
 * Gradual XP curve for levels 1..100.
 * Uses a gently increasing quadratic term to avoid excessively steep jumps.
 * Total XP is cumulative XP earned; level is derived from total XP.
 */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  // XP required to advance from (level-1) -> level
  // Base 200, +15 per level step, + small quadratic growth.
  const n = level - 1;
  return Math.floor(200 + n * 15 + n * n * 2.2);
}

export function totalXpForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  let total = 0;
  for (let l = 2; l <= clamped; l += 1) {
    total += xpRequiredForLevel(l);
  }
  return total;
}

export function levelFromTotalXP(totalXP: number): number {
  const xp = Math.max(0, Math.floor(totalXP));
  let level = 1;
  let cumulative = 0;
  while (level < MAX_PLAYER_LEVEL) {
    const need = xpRequiredForLevel(level + 1);
    if (xp < cumulative + need) break;
    cumulative += need;
    level += 1;
  }
  return level;
}

export function getPlayerLevelProgress(totalXP: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXP));
  const level = levelFromTotalXP(xp);
  const currentLevelXP = totalXpForLevel(level);
  const xpIntoLevel = Math.max(0, xp - currentLevelXP);
  if (level >= MAX_PLAYER_LEVEL) {
    return {
      level,
      currentLevelXP,
      xpIntoLevel,
      xpForNextLevel: null,
      progress01: 1,
    };
  }
  const nextReq = xpRequiredForLevel(level + 1);
  return {
    level,
    currentLevelXP,
    xpIntoLevel,
    xpForNextLevel: nextReq,
    progress01: nextReq > 0 ? Math.min(1, xpIntoLevel / nextReq) : 1,
  };
}

export function masteryXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return Math.floor(120 + n * 20 + n * n * 3);
}

export function masteryTotalXpForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_MASTERY_LEVEL, Math.floor(level)));
  let total = 0;
  for (let l = 2; l <= clamped; l += 1) total += masteryXpRequiredForLevel(l);
  return total;
}

export function masteryLevelFromXP(totalXP: number): number {
  const xp = Math.max(0, Math.floor(totalXP));
  let level = 1;
  let cumulative = 0;
  while (level < MAX_MASTERY_LEVEL) {
    const need = masteryXpRequiredForLevel(level + 1);
    if (xp < cumulative + need) break;
    cumulative += need;
    level += 1;
  }
  return level;
}

export function getMasteryLevelProgress(masteryXP: number): LevelProgress {
  const xp = Math.max(0, Math.floor(masteryXP));
  const level = masteryLevelFromXP(xp);
  const currentLevelXP = masteryTotalXpForLevel(level);
  const xpIntoLevel = Math.max(0, xp - currentLevelXP);
  if (level >= MAX_MASTERY_LEVEL) {
    return { level, currentLevelXP, xpIntoLevel, xpForNextLevel: null, progress01: 1 };
  }
  const nextReq = masteryXpRequiredForLevel(level + 1);
  return { level, currentLevelXP, xpIntoLevel, xpForNextLevel: nextReq, progress01: nextReq > 0 ? Math.min(1, xpIntoLevel / nextReq) : 1 };
}

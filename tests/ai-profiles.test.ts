import { describe, expect, it } from 'vitest';

import {
  DIFFICULTY_PROFILES,
  PERSONALITY_PROFILES,
  resolveAIProfile,
} from '../src/ai/AIProfiles';

describe('AI profiles', () => {
  it('defines ordered difficulty capabilities without altering fighter stats', () => {
    const easy = DIFFICULTY_PROFILES.EASY;
    const normal = DIFFICULTY_PROFILES.NORMAL;
    const hard = DIFFICULTY_PROFILES.HARD;
    const expert = DIFFICULTY_PROFILES.EXPERT;

    expect(easy.reactionDelayFrames).toBeGreaterThan(normal.reactionDelayFrames);
    expect(normal.reactionDelayFrames).toBeGreaterThan(hard.reactionDelayFrames);
    expect(hard.reactionDelayFrames).toBeGreaterThan(expert.reactionDelayFrames);

    expect(easy.mistakeProbability).toBeGreaterThan(expert.mistakeProbability);
    expect(easy.adaptationStrength).toBe(0);
    expect(expert.adaptationStrength).toBeGreaterThan(hard.adaptationStrength);
    expect(hard.adaptationStrength).toBeGreaterThan(normal.adaptationStrength);
    expect(expert.punishWeight).toBeGreaterThan(easy.punishWeight);
  });

  it('exposes distinct personality behavior modifiers', () => {
    expect(PERSONALITY_PROFILES.AGGRESSOR.aggressionBias).toBeGreaterThan(
      PERSONALITY_PROFILES.DEFENDER.aggressionBias,
    );
    expect(PERSONALITY_PROFILES.DEFENDER.defenseBias).toBeGreaterThan(
      PERSONALITY_PROFILES.AGGRESSOR.defenseBias,
    );
    expect(PERSONALITY_PROFILES.BRUISER.heavyBias).toBeGreaterThan(
      PERSONALITY_PROFILES.TRICKSTER.heavyBias,
    );
    expect(PERSONALITY_PROFILES.TRICKSTER.repositionBias).toBeGreaterThan(
      PERSONALITY_PROFILES.BRUISER.repositionBias,
    );
  });

  it('resolves combined difficulty/personality profiles', () => {
    const resolved = resolveAIProfile('HARD', 'TRICKSTER');
    expect(resolved.difficulty).toBe('HARD');
    expect(resolved.personality).toBe('TRICKSTER');
    expect(resolved.difficultyProfile).toBe(DIFFICULTY_PROFILES.HARD);
    expect(resolved.personalityProfile).toBe(PERSONALITY_PROFILES.TRICKSTER);
  });
});
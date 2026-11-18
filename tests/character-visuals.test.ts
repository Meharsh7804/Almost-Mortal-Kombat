import { describe, expect, it } from 'vitest';

import {
  getCharacterVisual,
  getImplementedCharacterVisuals,
  KAI_VISUAL,
  RHEA_VISUAL,
} from '../src/data/CharacterVisuals';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from '../src/data/FighterData';

describe('character visual identities', () => {
  it('keeps Kai and Rhea distinct without changing gameplay identity', () => {
    expect(KAI_VISUAL.id).toBe(PLAYER_ONE_CONFIG.id);
    expect(KAI_VISUAL.name).toBe(PLAYER_ONE_CONFIG.name);
    expect(KAI_VISUAL.colors.primary).toBe(PLAYER_ONE_CONFIG.color);

    expect(RHEA_VISUAL.id).toBe(PLAYER_TWO_CONFIG.id);
    expect(RHEA_VISUAL.name).toBe(PLAYER_TWO_CONFIG.name);
    expect(RHEA_VISUAL.colors.primary).toBe(PLAYER_TWO_CONFIG.color);

    expect(KAI_VISUAL.colors.primary).not.toBe(RHEA_VISUAL.colors.primary);
    expect(KAI_VISUAL.hairStyle).not.toBe(RHEA_VISUAL.hairStyle);
    expect(KAI_VISUAL.headAccessory).not.toBe(RHEA_VISUAL.headAccessory);
    expect(KAI_VISUAL.sash).not.toBe(RHEA_VISUAL.sash);
    expect(KAI_VISUAL.aura.style).not.toBe(RHEA_VISUAL.aura.style);
    expect(KAI_VISUAL.victoryStyle).not.toBe(RHEA_VISUAL.victoryStyle);
    expect(KAI_VISUAL.build.shoulderWidth).not.toBe(RHEA_VISUAL.build.shoulderWidth);
    expect(KAI_VISUAL.motion.walkCadence).not.toBe(RHEA_VISUAL.motion.walkCadence);
  });

  it('defines complete, positive proportions and motion profiles for every fighter', () => {
    for (const visual of getImplementedCharacterVisuals()) {
      for (const [key, value] of Object.entries(visual.build)) {
        expect(value, `${visual.id}.build.${key}`).toBeGreaterThan(0);
      }

      for (const [key, value] of Object.entries(visual.motion)) {
        expect(Number.isFinite(value), `${visual.id}.motion.${key}`).toBe(true);
      }

      expect(visual.colors.primary).toBeGreaterThanOrEqual(0);
      expect(visual.colors.outline).toBeGreaterThanOrEqual(0);
      expect(visual.aura.scaleX).toBeGreaterThan(0);
      expect(visual.aura.scaleY).toBeGreaterThan(0);
      expect(visual.aura.baseAlpha).toBeGreaterThan(0);
    }
  });

  it('returns the authored identity and a palette-derived fallback for new roster ids', () => {
    expect(getCharacterVisual('kai')).toBe(KAI_VISUAL);
    expect(getCharacterVisual('rhea')).toBe(RHEA_VISUAL);

    const fallback = getCharacterVisual('ghost', 0x33ffaa, 0x115544);
    expect(fallback.id).toBe('ghost');
    expect(fallback.name).toBe('GHOST');
    expect(fallback.colors.primary).toBe(0x33ffaa);
    expect(fallback.colors.secondary).toBe(0x115544);
    expect(fallback.build).toBe(KAI_VISUAL.build);
    expect(fallback.sash).toBe('none');
  });
});

import { describe, expect, it } from 'vitest';

import {
  GAME_ASPECT_RATIO,
  GAME_BACKGROUND_COLOR,
  GAME_CONFIG,
  GAME_HEIGHT,
  GAME_PARENT_ID,
  GAME_WIDTH,
  SCENE_KEYS,
} from '../src/core/GameConfig';

describe('game configuration', () => {
  it('uses a 1280x720 landscape logical resolution', () => {
    expect(GAME_CONFIG.width).toBe(1280);
    expect(GAME_CONFIG.height).toBe(720);
    expect(GAME_CONFIG.width).toBeGreaterThan(GAME_CONFIG.height);
    expect(GAME_WIDTH).toBe(GAME_CONFIG.width);
    expect(GAME_HEIGHT).toBe(GAME_CONFIG.height);
  });

  it('preserves a 16:9 aspect ratio', () => {
    expect(GAME_ASPECT_RATIO).toBe(16 / 9);
    expect(GAME_CONFIG.aspectRatio).toBeCloseTo(16 / 9, 10);
  });

  it('uses FIT scaling centered on both axes', () => {
    expect(GAME_CONFIG.scale.mode).toBe('FIT');
    expect(GAME_CONFIG.scale.autoCenter).toBe('CENTER_BOTH');
  });

  it('prefers WebGL with automatic Canvas fallback and antialiasing enabled', () => {
    expect(GAME_CONFIG.rendering.renderer).toBe('AUTO');
    expect(GAME_CONFIG.rendering.antialias).toBe(true);
    expect(GAME_CONFIG.rendering.pixelArt).toBe(false);
  });

  it('disables physics for the foundation phase', () => {
    expect(GAME_CONFIG.physicsEnabled).toBe(false);
    expect(GAME_CONFIG).not.toHaveProperty('physics');
  });

  it('uses the dark charcoal background and named game parent', () => {
    expect(GAME_CONFIG.backgroundColor).toBe('#08070b');
    expect(GAME_BACKGROUND_COLOR).toBe(GAME_CONFIG.backgroundColor);
    expect(GAME_CONFIG.parent).toBe(GAME_PARENT_ID);
    expect(GAME_CONFIG.parent).toBe('game-root');
  });

  it('exposes stable scene keys in boot order', () => {
    expect(Object.values(SCENE_KEYS)).toEqual([
      'BootScene',
      'PreloadScene',
      'MenuScene',
      'ModeSelectScene',
      'CpuConfigScene',
      'CharacterSelectScene',
      'ArenaSelectScene',
      'VersusScene',
      'BattleScene',
      'ResultsScene',
      'SettingsScene',
      'HowToPlayScene',
      'ArcadeScene',
      'ArcadeProgressScene',
      'ArcadeEndingScene',
      'PlayerProfileScene',
      'MasteryScene',
      'AchievementScene',
      'CollectionScene',
    ]);
  });

  it('is immutable', () => {
    expect(Object.isFrozen(GAME_CONFIG)).toBe(true);
    expect(Object.isFrozen(GAME_CONFIG.rendering)).toBe(true);
    expect(Object.isFrozen(GAME_CONFIG.scale)).toBe(true);
  });
});

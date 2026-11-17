/**
 * Engine-agnostic game configuration.
 *
 * This module deliberately has no runtime dependency on Phaser. `Game.ts` maps
 * these values onto Phaser's configuration object. Keeping the contract pure
 * means it can be unit tested in Node and the game's logical settings stay
 * independent of the renderer.
 */

export const GAME_TITLE = 'RIFTBOUND';
export const GAME_VERSION = '0.1.0';
export const GAME_PARENT_ID = 'game-root';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GAME_ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT;

/** Dark charcoal, almost black. */
export const GAME_BACKGROUND_COLOR = '#08070b';

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MENU: 'MenuScene',
  BATTLE: 'BattleScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

export interface GameScaleConfig {
  /** Preserve the logical 16:9 aspect ratio at every window size. */
  readonly mode: 'FIT';
  readonly autoCenter: 'CENTER_BOTH';
}

export interface GameRenderingConfig {
  /** Prefer WebGL, with Phaser's automatic Canvas fallback. */
  readonly renderer: 'AUTO';
  readonly antialias: boolean;
  readonly pixelArt: boolean;
}

export interface GameConfig {
  readonly parent: string;
  readonly title: string;
  readonly version: string;
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly backgroundColor: string;
  readonly rendering: GameRenderingConfig;
  readonly scale: GameScaleConfig;
  /** Arcade Physics is intentionally disabled until a later phase. */
  readonly physicsEnabled: boolean;
}

export const GAME_CONFIG: GameConfig = Object.freeze({
  parent: GAME_PARENT_ID,
  title: GAME_TITLE,
  version: GAME_VERSION,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  aspectRatio: GAME_ASPECT_RATIO,
  backgroundColor: GAME_BACKGROUND_COLOR,
  rendering: Object.freeze({
    renderer: 'AUTO',
    antialias: true,
    pixelArt: false,
  }),
  scale: Object.freeze({
    mode: 'FIT',
    autoCenter: 'CENTER_BOTH',
  }),
  physicsEnabled: false,
});

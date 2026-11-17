import Phaser from 'phaser';

import { GAME_BACKGROUND_COLOR, GAME_TITLE, SCENE_KEYS } from '../core/GameConfig';

/**
 * Boot is deliberately tiny: engine configuration lives in Game.ts, while this
 * scene applies global runtime settings and hands off to asset preparation.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.game.canvas.setAttribute(
      'aria-label',
      `${GAME_TITLE} game canvas. Landscape orientation is recommended.`,
    );
    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}

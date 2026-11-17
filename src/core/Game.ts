import Phaser from 'phaser';

import { BattleScene } from '../scenes/BattleScene';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { GAME_CONFIG } from './GameConfig';
import { GAME_LOOP_REGISTRY_KEY, GameLoop } from './GameLoop';

/**
 * Phaser bootstrap and ownership boundary for the engine.
 *
 * Phaser remains the single owner of the RAF loop. The shared `GameLoop`
 * receives Phaser's PRE_STEP delta and exposes fixed simulation ticks to
 * scenes and future combat systems.
 */
export class Game {
  private readonly loop: GameLoop;
  private phaserGame: Phaser.Game | null = null;

  constructor(loop: GameLoop = new GameLoop()) {
    this.loop = loop;
  }

  get gameLoop(): GameLoop {
    return this.loop;
  }

  get instance(): Phaser.Game | null {
    return this.phaserGame;
  }

  start(): this {
    if (this.phaserGame) {
      return this;
    }

    this.loop.reset();

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: GAME_CONFIG.parent,
      width: GAME_CONFIG.width,
      height: GAME_CONFIG.height,
      backgroundColor: GAME_CONFIG.backgroundColor,
      antialias: GAME_CONFIG.rendering.antialias,
      pixelArt: GAME_CONFIG.rendering.pixelArt,
      banner: false,
      disableContextMenu: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_CONFIG.width,
        height: GAME_CONFIG.height,
        expandParent: false,
        autoRound: true,
      },
      render: {
        antialias: GAME_CONFIG.rendering.antialias,
        pixelArt: GAME_CONFIG.rendering.pixelArt,
        roundPixels: false,
        transparent: false,
        powerPreference: 'high-performance',
      },
      scene: [BootScene, PreloadScene, MenuScene, BattleScene],
      callbacks: {
        preBoot: (game) => {
          game.registry.set(GAME_LOOP_REGISTRY_KEY, this.loop);
          game.events.on(Phaser.Core.Events.PRE_STEP, this.handlePreStep);
        },
      },
    };

    this.phaserGame = new Phaser.Game(config);
    return this;
  }

  destroy(): void {
    if (!this.phaserGame) {
      return;
    }

    this.phaserGame.events.off(Phaser.Core.Events.PRE_STEP, this.handlePreStep);
    this.phaserGame.destroy(true);
    this.phaserGame = null;
  }

  private readonly handlePreStep = (_time: number, delta: number): void => {
    this.loop.update(delta);
  };
}

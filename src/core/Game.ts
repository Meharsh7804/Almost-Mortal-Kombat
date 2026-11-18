import Phaser from 'phaser';

import { BattleScene } from '../scenes/BattleScene';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { ArenaSelectScene } from '../scenes/ArenaSelectScene';
import { CharacterSelectScene } from '../scenes/CharacterSelectScene';
import { CpuConfigScene } from '../scenes/CpuConfigScene';
import { HowToPlayScene } from '../scenes/HowToPlayScene';
import { ModeSelectScene } from '../scenes/ModeSelectScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { ResultsScene } from '../scenes/ResultsScene';
import { SettingsScene } from '../scenes/SettingsScene';
import { VersusScene } from '../scenes/VersusScene';
import { ArcadeScene } from '../scenes/ArcadeScene';
import { ArcadeProgressScene } from '../scenes/ArcadeProgressScene';
import { ArcadeEndingScene } from '../scenes/ArcadeEndingScene';
import { PlayerProfileScene } from '../scenes/PlayerProfileScene';
import { MasteryScene } from '../scenes/MasteryScene';
import { AchievementScene } from '../scenes/AchievementScene';
import { CollectionScene } from '../scenes/CollectionScene';
import { AUDIO_REGISTRY_KEY, AudioManager } from '../audio/AudioManager';
import { GAME_CONFIG } from './GameConfig';
import { GAME_LOOP_REGISTRY_KEY, GameLoop } from './GameLoop';
import { getOrLoadProfile } from '../progression/ProgressionService';

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
      scene: [
        BootScene,
        PreloadScene,
        MenuScene,
        ModeSelectScene,
        CpuConfigScene,
        CharacterSelectScene,
        ArenaSelectScene,
        VersusScene,
        BattleScene,
        ResultsScene,
        SettingsScene,
        HowToPlayScene,
        ArcadeScene,
        ArcadeProgressScene,
        ArcadeEndingScene,
        PlayerProfileScene,
        MasteryScene,
        AchievementScene,
        CollectionScene,
      ],
      callbacks: {
        preBoot: (game) => {
          game.registry.set(GAME_LOOP_REGISTRY_KEY, this.loop);
          game.registry.set(AUDIO_REGISTRY_KEY, new AudioManager(getOrLoadProfile().settings));
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

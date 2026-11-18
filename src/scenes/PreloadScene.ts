import Phaser from 'phaser';

import { ASSET_MANIFEST, resolveAssetUrl } from '../data/AssetManifest';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import {
  GAME_BACKGROUND_COLOR,
  GAME_HEIGHT,
  GAME_TITLE,
  GAME_WIDTH,
  SCENE_KEYS,
} from '../core/GameConfig';
import { ensureSoftGlowTexture } from '../ui/ProceduralTextures';
import { COLORS, CSS_COLORS, FONTS } from '../ui/Theme';
import { getAudioManager } from '../audio/AudioManager';
import { getOrLoadProfile } from '../progression/ProgressionService';

const BAR_WIDTH = 300;
const BAR_HEIGHT = 3;
const BAR_X = (GAME_WIDTH - BAR_WIDTH) / 2;
const BAR_Y = 396;
const MIN_LOADER_DISPLAY_MS = 700;
const FINISH_DELAY_MS = 180;
const FADE_OUT_MS = 280;

/**
 * Asset-pipeline scene.
 *
 * Phase 0 intentionally loads no external files, but the progress, error and
 * completion wiring is live so future manifests require no scene changes.
 */
export class PreloadScene extends Phaser.Scene {
  private progressFill?: Phaser.GameObjects.Graphics;
  private percentText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private progress = 0;
  private loadingComplete = false;
  private minimumTimeElapsed = false;
  private transitioning = false;
  private loadErrors = 0;

  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  preload(): void {
    this.buildLoadingScreen();
    this.registerLoaderEvents();
    this.queueManifestAssets();

    this.time.delayedCall(MIN_LOADER_DISPLAY_MS, () => {
      this.minimumTimeElapsed = true;
      this.tryFinish();
    });
  }

  create(): void {
    // With an empty manifest Phaser never starts a loader pass, so completion
    // is established here instead. Future assets use the COMPLETE listener.
    if (ASSET_MANIFEST.length === 0) {
      this.loadingComplete = true;
      this.setProgress(1);
    }

    this.tryFinish();
  }

  private buildLoadingScreen(): void {
    ensureSoftGlowTexture(this);

    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.cameras.main.fadeIn(260, 4, 3, 7);

    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(900, 620)
      .setTint(COLORS.violetDeep)
      .setAlpha(0.38)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add
      .image(GAME_WIDTH / 2 + 140, GAME_HEIGHT / 2 - 90, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(520, 380)
      .setTint(COLORS.crimsonDeep)
      .setAlpha(0.22)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, GAME_TITLE, {
        fontFamily: FONTS.display,
        fontSize: '34px',
        color: CSS_COLORS.bone,
      })
      .setOrigin(0.5)
      .setLetterSpacing(10)
      .setShadow(0, 0, CSS_COLORS.crimson, 18, true, true)
      .setAlpha(0.92);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'SYNCHRONIZING RIFT', {
        fontFamily: FONTS.mono,
        fontSize: '10px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setAlpha(0.62);

    const track = this.add.graphics();
    track.lineStyle(1, COLORS.line, 0.85);
    track.strokeRect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT);

    this.progressFill = this.add.graphics();

    this.percentText = this.add
      .text(GAME_WIDTH / 2, BAR_Y + 24, '000%', {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2)
      .setAlpha(0.5);

    this.setProgress(0);
  }

  private registerLoaderEvents(): void {
    this.load.on(Phaser.Loader.Events.PROGRESS, this.handleProgress, this);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleLoadError, this);
    this.load.once(Phaser.Loader.Events.COMPLETE, this.handleLoadComplete, this);
  }

  private queueManifestAssets(): void {
    for (const asset of ASSET_MANIFEST) {
      const url = resolveAssetUrl(asset.path);

      switch (asset.kind) {
        case 'image':
          this.load.image(asset.key, url);
          break;
        case 'audio':
          this.load.audio(asset.key, url);
          break;
        case 'json':
          this.load.json(asset.key, url);
          break;
      }
    }
  }

  private handleProgress(progress: number): void {
    this.setProgress(progress);
  }

  private handleLoadError(file: Phaser.Loader.File): void {
    this.loadErrors += 1;
    console.warn(`[PreloadScene] Failed to load asset "${file.key}". Continuing without it.`);
    this.statusText?.setText('RECOVERING ASSET STREAM').setColor(CSS_COLORS.crimson);
  }

  private handleLoadComplete(): void {
    this.loadingComplete = true;
    this.setProgress(1);
    const audio = getAudioManager(this.game);
    if (audio) {
      audio.attach(this.sound);
      audio.applySettings(getOrLoadProfile().settings);
    }
    this.tryFinish();
  }

  private setProgress(value: number): void {
    this.progress = Phaser.Math.Clamp(value, 0, 1);

    this.progressFill?.clear();
    if (this.progress > 0) {
      this.progressFill?.fillGradientStyle(
        COLORS.crimson,
        COLORS.violet,
        COLORS.violet,
        COLORS.crimson,
        1,
        1,
        1,
        1,
      );
      this.progressFill?.fillRect(BAR_X, BAR_Y, BAR_WIDTH * this.progress, BAR_HEIGHT);
    }

    const percentage = Math.round(this.progress * 100)
      .toString()
      .padStart(3, '0');
    this.percentText?.setText(`${percentage}%`);
  }

  private tryFinish(): void {
    if (!this.loadingComplete || !this.minimumTimeElapsed || this.transitioning) {
      return;
    }

    this.transitioning = true;

    if (this.loadErrors > 0) {
      this.statusText
        ?.setText(`STREAM RECOVERED // ${this.loadErrors} ERROR${this.loadErrors === 1 ? '' : 'S'}`)
        .setColor(CSS_COLORS.crimson);
    } else {
      this.statusText?.setText('SYSTEM READY').setColor(CSS_COLORS.muted);
    }

    this.time.delayedCall(FINISH_DELAY_MS, () => {
      this.cameras.main.fadeOut(FADE_OUT_MS, 4, 3, 7);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.MENU);
      });
    });
  }
}

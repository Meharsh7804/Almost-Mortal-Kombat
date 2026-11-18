import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getArenaRegistry, getRandomArenaId } from '../data/ArenaRegistry';
import type { MatchConfig } from '../data/MatchConfig';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { CSS_COLORS, FONTS, toCssColor } from '../ui/Theme';

interface SceneData {
  readonly config: MatchConfig;
}

export class ArenaSelectScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private config!: MatchConfig;
  private index = 0;
  private buttons: MenuButton[] = [];
  private previewName!: Phaser.GameObjects.Text;
  private previewDesc!: Phaser.GameObjects.Text;
  private previewMeta!: Phaser.GameObjects.Text;
  private previewBox!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: SCENE_KEYS.ARENA_SELECT });
  }

  init(data: SceneData): void {
    this.config = data.config;
    const arenas = getArenaRegistry();
    const idx = arenas.findIndex((a) => a.id === this.config.arenaId);
    this.index = idx >= 0 ? idx : 0;
  }

  create(): void {
    this.starting = false;
    this.cameras.main.fadeIn(220, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    getAudioManager(this.game)?.attach(this.sound);

    this.add.text(640, 90, 'ARENA SELECT', {
      fontFamily: FONTS.display, fontSize: '50px', color: CSS_COLORS.bone, stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.previewBox = this.add.graphics();
    this.previewName = this.add.text(640, 210, '', { fontFamily: FONTS.display, fontSize: '36px', color: CSS_COLORS.bone }).setOrigin(0.5);
    this.previewDesc = this.add.text(640, 290, '', { fontFamily: FONTS.body, fontSize: '18px', color: CSS_COLORS.muted, align: 'center', wordWrap: { width: 520 } }).setOrigin(0.5);
    this.previewMeta = this.add.text(640, 360, '', { fontFamily: FONTS.mono, fontSize: '12px', color: CSS_COLORS.violet, align: 'center', lineSpacing: 8 }).setOrigin(0.5);

    const arenas = getArenaRegistry();
    arenas.forEach((arena, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this.buttons.push(new MenuButton(this, {
        x: 260 + col * 760,
        y: 430 + row * 86,
        width: 320,
        height: 54,
        label: arena.name.toUpperCase(),
        onClick: () => { this.index = i; this.refreshPreview(); },
      }));
    });

    this.buttons.push(new MenuButton(this, { x: 640, y: 605, width: 220, height: 44, label: 'RANDOM', onClick: () => this.randomize() }));
    this.buttons.push(new MenuButton(this, { x: 520, y: 662, width: 220, height: 44, label: 'CONFIRM', onClick: () => this.confirm() }));
    this.buttons.push(new MenuButton(this, { x: 760, y: 662, width: 220, height: 44, label: 'BACK', onClick: () => this.back() }));

    this.refreshPreview();
    this.bindInput();

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => this.backdrop?.update(loop.simulationTimeSeconds));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private refreshPreview(): void {
    const arenas = getArenaRegistry();
    const arena = arenas[this.index] ?? arenas[0];
    if (!arena) return;

    this.previewName.setText(arena.name).setColor(toCssColor(arena.theme.accentA));
    this.previewDesc.setText(arena.description);
    this.previewMeta.setText(`VISUAL STAGE ONLY  •  COMBAT PLANE PRESERVED\nMOTIF: ${arena.theme.motif.toUpperCase()}  •  PARALLAX: ${arena.parallax.mid}\nAMBIENCE: ${(arena.atmosphere.particleAlpha * 100).toFixed(0)}%`);

    this.previewBox.clear();
    this.previewBox.fillGradientStyle(arena.theme.skyTop, arena.theme.skyTop, arena.theme.skyBottom, arena.theme.skyBottom, 1);
    this.previewBox.fillRoundedRect(360, 160, 560, 230, 14);
    this.previewBox.fillStyle(arena.theme.horizon, 0.6);
    this.previewBox.fillRoundedRect(380, 250, 520, 90, 10);
    this.previewBox.fillStyle(arena.theme.floorTop, 0.95);
    this.previewBox.fillRect(380, 330, 520, 40);
    this.previewBox.lineStyle(3, arena.theme.accentA, 0.7);
    this.previewBox.strokeRoundedRect(360, 160, 560, 230, 14);
    this.previewBox.lineStyle(2, arena.theme.accentB, 0.5);
    this.previewBox.lineBetween(420, 340, 860, 340);
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1), this);
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1), this);
    this.input.keyboard?.on('keydown-UP', () => this.move(-2), this);
    this.input.keyboard?.on('keydown-DOWN', () => this.move(2), this);
    this.input.keyboard?.on('keydown-A', () => this.move(-1), this);
    this.input.keyboard?.on('keydown-D', () => this.move(1), this);
    this.input.keyboard?.on('keydown-R', this.randomize, this);
    this.input.keyboard?.on('keydown-ENTER', this.confirm, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirm, this);
    this.input.keyboard?.on('keydown-ESC', this.back, this);
  }

  private move(delta: number): void {
    if (this.starting) return;
    const arenas = getArenaRegistry();
    this.index = (this.index + delta + arenas.length * 10) % arenas.length;
    this.refreshPreview();
    getAudioManager(this.game)?.playUi('ui-move');
  }

  private randomize(): void {
    const id = getRandomArenaId();
    const idx = getArenaRegistry().findIndex((a) => a.id === id);
    if (idx >= 0) this.index = idx;
    this.refreshPreview();
    getAudioManager(this.game)?.playUi('ui-move');
  }

  private confirm(): void {
    if (this.starting) return;
    const arena = getArenaRegistry()[this.index];
    if (!arena) return;
    const config: MatchConfig = { ...this.config, arenaId: arena.id };
    if (config.mode === 'ARCADE') {
      this.start(SCENE_KEYS.ARCADE);
      return;
    }
    this.start(SCENE_KEYS.VERSUS, { config });
  }

  private back(): void {
    if (this.starting) return;
    if (this.config.mode === 'ARCADE') {
      this.start(SCENE_KEYS.ARCADE);
      return;
    }
    if (this.config.mode === 'CPU_BATTLE') {
      this.start(SCENE_KEYS.CHARACTER_SELECT, { config: this.config, selecting: 2 });
      return;
    }
    if (this.config.mode === 'TRAINING') {
      this.start(SCENE_KEYS.CHARACTER_SELECT, { config: this.config, selecting: 1 });
      return;
    }
    this.start(SCENE_KEYS.CHARACTER_SELECT, { config: this.config, selecting: 2 });
  }

  private start(key: string, data?: object): void {
    if (this.starting) return;
    this.starting = true;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.cameras.main.fadeOut(220, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  private shutdown(): void {
    this.unsubscribeLoop?.(); this.unsubscribeLoop = null;
    this.input.keyboard?.removeAllListeners();
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.backdrop = undefined;
  }
}

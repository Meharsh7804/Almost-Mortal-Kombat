import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getCharacterById, getCharacterRegistry, getRandomCharacterId } from '../data/CharacterRegistry';
import type { MatchConfig } from '../data/MatchConfig';
import { getCharacterVisual } from '../data/CharacterVisuals';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { CSS_COLORS, FONTS, toCssColor } from '../ui/Theme';

interface SceneData {
  readonly config: MatchConfig;
  readonly selecting: 1 | 2;
}

export class CharacterSelectScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private config!: MatchConfig;
  private selecting: 1 | 2 = 1;
  private index = 0;
  private buttons: MenuButton[] = [];
  private previewName!: Phaser.GameObjects.Text;
  private previewInfo!: Phaser.GameObjects.Text;
  private previewDesc!: Phaser.GameObjects.Text;
  private previewStats!: Phaser.GameObjects.Text;
  private previewBox!: Phaser.GameObjects.Graphics;
  private p1Text!: Phaser.GameObjects.Text;
  private p2Text!: Phaser.GameObjects.Text;
  private confirmHint!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.CHARACTER_SELECT });
  }

  init(data: SceneData): void {
    this.config = data.config;
    this.selecting = data.selecting ?? 1;
    const roster = getCharacterRegistry();
    const currentId = this.selecting === 1 ? this.config.player1CharacterId : this.config.player2CharacterId;
    const idx = roster.findIndex((c) => c.id === currentId);
    this.index = idx >= 0 ? idx : 0;
  }

  create(): void {
    this.starting = false;
    this.cameras.main.fadeIn(220, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    getAudioManager(this.game)?.attach(this.sound);

    this.add.text(640, 90, 'CHARACTER SELECT', {
      fontFamily: FONTS.display, fontSize: '50px', color: CSS_COLORS.bone, stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.p1Text = this.add.text(240, 150, '', { fontFamily: FONTS.mono, fontSize: '14px', color: CSS_COLORS.bone }).setOrigin(0.5);
    this.p2Text = this.add.text(1040, 150, '', { fontFamily: FONTS.mono, fontSize: '14px', color: CSS_COLORS.bone }).setOrigin(0.5);

    this.previewBox = this.add.graphics();
    this.previewBox.fillStyle(0x120a18, 0.9);
    this.previewBox.fillRoundedRect(420, 170, 440, 360, 14);
    this.previewBox.lineStyle(2, 0x4a2a45, 0.9);
    this.previewBox.strokeRoundedRect(420, 170, 440, 360, 14);

    this.previewName = this.add.text(640, 210, '', { fontFamily: FONTS.display, fontSize: '40px', color: CSS_COLORS.bone }).setOrigin(0.5);
    this.previewInfo = this.add.text(640, 255, '', { fontFamily: FONTS.mono, fontSize: '13px', color: CSS_COLORS.violet }).setOrigin(0.5);
    this.previewDesc = this.add.text(640, 360, '', { fontFamily: FONTS.body, fontSize: '18px', color: CSS_COLORS.muted, align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5);
    this.previewStats = this.add.text(640, 470, '', { fontFamily: FONTS.mono, fontSize: '14px', color: CSS_COLORS.bone, align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    this.confirmHint = this.add.text(640, 560, '', { fontFamily: FONTS.mono, fontSize: '11px', color: CSS_COLORS.muted }).setOrigin(0.5);

    const roster = getCharacterRegistry();
    roster.forEach((char, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const b = new MenuButton(this, {
        x: 220 + col * 840,
        y: 300 + row * 90,
        width: 260,
        height: 58,
        label: char.displayName,
        onClick: () => { this.index = i; this.refreshPreview(); },
      });
      this.buttons.push(b);
    });

    const randomBtn = new MenuButton(this, { x: 640, y: 610, width: 220, height: 44, label: 'RANDOM', onClick: () => this.randomize() });
    const confirmBtn = new MenuButton(this, { x: 520, y: 665, width: 220, height: 44, label: 'CONFIRM', onClick: () => this.confirmSelection() });
    const backBtn = new MenuButton(this, { x: 760, y: 665, width: 220, height: 44, label: 'BACK', onClick: () => this.back() });
    this.buttons.push(randomBtn, confirmBtn, backBtn);

    this.refreshPreview();
    this.bindInput();

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => this.backdrop?.update(loop.simulationTimeSeconds));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private refreshPreview(): void {
    const roster = getCharacterRegistry();
    const char = roster[this.index] ?? roster[0];
    if (!char) return;
    const visual = getCharacterVisual(char.visualId, char.fighterConfig.color, char.fighterConfig.accentColor);
    this.previewName.setText(char.displayName).setColor(toCssColor(visual.colors.primary));
    this.previewInfo.setText(`${char.archetype.replace('_', ' ')}  •  ${this.selecting === 1 ? 'PLAYER 1' : (this.config.cpuEnabled && this.config.cpuPlayer === 2 ? 'CPU' : 'PLAYER 2')} SELECTING`);
    this.previewDesc.setText(char.description);
    this.previewStats.setText(`POWER ${char.stats.power}/5   SPEED ${char.stats.speed}/5\nRANGE ${char.stats.range}/5   DEFENSE ${char.stats.defense}/5\nDIFFICULTY ${char.stats.difficulty}/5`);

    this.previewBox.clear();
    this.previewBox.fillStyle(0x120a18, 0.94);
    this.previewBox.fillRoundedRect(420, 170, 440, 360, 14);
    this.previewBox.lineStyle(2, visual.colors.primary, 0.85);
    this.previewBox.strokeRoundedRect(420, 170, 440, 360, 14);
    this.previewBox.fillStyle(visual.colors.primary, 0.18);
    this.previewBox.fillCircle(640, 315, 42);
    this.previewBox.fillStyle(visual.colors.secondary, 0.9);
    this.previewBox.fillRoundedRect(604, 330, 72, 14, 6);
    this.previewBox.lineStyle(2, visual.colors.accent, 0.7);
    this.previewBox.strokeCircle(640, 315, 42);

    const p1 = getCharacterById(this.config.player1CharacterId);
    const p2 = getCharacterById(this.config.player2CharacterId);
    this.p1Text.setText(`P1: ${p1?.displayName ?? '?'}`);
    this.p2Text.setText(`${this.config.cpuEnabled && this.config.cpuPlayer === 2 ? 'CPU' : 'P2'}: ${p2?.displayName ?? '?'}`);
    this.confirmHint.setText('ARROWS/A-D NAVIGATE  •  R RANDOM  •  ENTER CONFIRM  •  ESC BACK');
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1), this);
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1), this);
    this.input.keyboard?.on('keydown-A', () => this.move(-1), this);
    this.input.keyboard?.on('keydown-D', () => this.move(1), this);
    this.input.keyboard?.on('keydown-UP', () => this.move(-2), this);
    this.input.keyboard?.on('keydown-DOWN', () => this.move(2), this);
    this.input.keyboard?.on('keydown-R', this.randomize, this);
    this.input.keyboard?.on('keydown-ENTER', this.confirmSelection, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirmSelection, this);
    this.input.keyboard?.on('keydown-ESC', this.back, this);
  }

  private move(delta: number): void {
    if (this.starting) return;
    const roster = getCharacterRegistry();
    const len = roster.length;
    this.index = (this.index + delta + len * 10) % len;
    this.refreshPreview();
    getAudioManager(this.game)?.playUi('ui-move');
  }

  private randomize(): void {
    const id = getRandomCharacterId();
    const roster = getCharacterRegistry();
    const idx = roster.findIndex((c) => c.id === id);
    if (idx >= 0) this.index = idx;
    this.refreshPreview();
    getAudioManager(this.game)?.playUi('ui-move');
  }

  private confirmSelection(): void {
    if (this.starting) return;
    const roster = getCharacterRegistry();
    const chosen = roster[this.index] ?? roster[0];
    if (!chosen) return;

    if (this.selecting === 1) {
      const config: MatchConfig = { ...this.config, player1CharacterId: chosen.id };
      if (this.config.mode === 'ARCADE') {
        this.start(SCENE_KEYS.ARCADE);
        return;
      }
      if (this.config.mode === 'CPU_BATTLE' && this.config.cpuPlayer === 2) {
        // CPU opponent next (still player-2 slot selection, can be randomized by user)
        this.start(SCENE_KEYS.CHARACTER_SELECT, { config, selecting: 2 });
        return;
      }
      if (this.config.mode === 'TRAINING') {
        // Lightweight practice: auto-pick a CPU opponent, then choose arena.
        const opp = roster.find((c) => c.id !== chosen.id) ?? roster[0] ?? chosen;
        this.start(SCENE_KEYS.ARENA_SELECT, {
          config: { ...config, player2CharacterId: opp.id, cpuEnabled: true, cpuPlayer: 2 },
        });
        return;
      }
      this.start(SCENE_KEYS.CHARACTER_SELECT, { config, selecting: 2 });
      return;
    }

    const config: MatchConfig = { ...this.config, player2CharacterId: chosen.id };
    if (config.mode === 'ARCADE') {
      this.start(SCENE_KEYS.ARCADE);
      return;
    }
    this.start(SCENE_KEYS.ARENA_SELECT, { config });
  }

  private back(): void {
    if (this.starting) return;
    if (this.selecting === 2) {
      this.start(SCENE_KEYS.CHARACTER_SELECT, { config: this.config, selecting: 1 });
      return;
    }
    if (this.config.mode === 'ARCADE') {
      this.start(SCENE_KEYS.ARCADE);
      return;
    }
    if (this.config.mode === 'CPU_BATTLE') {
      this.start(SCENE_KEYS.CPU_CONFIG, { config: this.config });
    } else if (this.config.mode === 'TRAINING') {
      this.start(SCENE_KEYS.MODE_SELECT, { config: { ...this.config, cpuEnabled: false }, presetMode: this.config.mode });
    } else {
      this.start(SCENE_KEYS.MODE_SELECT, { config: this.config, presetMode: this.config.mode });
    }
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

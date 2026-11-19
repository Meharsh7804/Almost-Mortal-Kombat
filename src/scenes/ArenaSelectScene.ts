import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getArenaRegistry, getRandomArenaId } from '../data/ArenaRegistry';
import type { ArenaDefinition } from '../data/ArenaRegistry';
import type { MatchConfig } from '../data/MatchConfig';
import { drawArenaPreview } from '../ui/ArenaPreview';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { COLORS, CSS_COLORS, FONTS, toCssColor } from '../ui/Theme';

interface SceneData {
  readonly config: MatchConfig;
}

interface ArenaCard {
  readonly arena: ArenaDefinition;
  readonly zone: Phaser.GameObjects.Zone;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly detail: Phaser.GameObjects.Text;
}

const FEATURE_BOUNDS = { x: 300, y: 108, width: 680, height: 182 } as const;
const CARD_WIDTH = 260;
const CARD_HEIGHT = 108;
const CARD_CENTER_Y = 450;
const CARD_GAP = 14;

export class ArenaSelectScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private config!: MatchConfig;
  private index = 0;
  private buttons: MenuButton[] = [];
  private cards: ArenaCard[] = [];
  private feature!: Phaser.GameObjects.Graphics;
  private previewName!: Phaser.GameObjects.Text;
  private previewDesc!: Phaser.GameObjects.Text;
  private previewMeta!: Phaser.GameObjects.Text;

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

    this.add.text(640, 52, 'ARENA SELECT', {
      fontFamily: FONTS.display,
      fontSize: '48px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(640, 88, 'CHOOSE THE BATTLEGROUND', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setLetterSpacing(4).setAlpha(0.8);

    this.feature = this.add.graphics().setDepth(2);
    this.previewName = this.add.text(640, 124, '', {
      fontFamily: FONTS.display,
      fontSize: '32px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(3);

    this.previewDesc = this.add.text(640, 318, '', {
      fontFamily: FONTS.body,
      fontSize: '16px',
      color: CSS_COLORS.muted,
      align: 'center',
      wordWrap: { width: 760 },
    }).setOrigin(0.5);

    this.previewMeta = this.add.text(640, 360, '', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS_COLORS.violet,
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5).setLetterSpacing(1);

    this.createArenaCards();

    this.buttons.push(
      new MenuButton(this, { x: 450, y: 568, width: 180, height: 40, label: 'RANDOM', fontSize: 17, letterSpacing: 4, glowPaddingX: 20, glowPaddingY: 50, onClick: () => this.randomize() }),
      new MenuButton(this, { x: 640, y: 568, width: 180, height: 40, label: 'CONFIRM', fontSize: 17, letterSpacing: 4, glowPaddingX: 20, glowPaddingY: 50, onClick: () => this.confirm() }),
      new MenuButton(this, { x: 830, y: 568, width: 180, height: 40, label: 'BACK', fontSize: 17, letterSpacing: 4, glowPaddingX: 20, glowPaddingY: 50, onClick: () => this.back() }),
    );

    this.add.text(640, 626, 'ARROWS/A-D PICK  •  R RANDOM  •  ENTER CONFIRM  •  ESC BACK', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setAlpha(0.72);

    this.refreshPreview();
    this.bindInput();

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => this.backdrop?.update(loop.simulationTimeSeconds));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private createArenaCards(): void {
    const arenas = getArenaRegistry();
    const totalWidth = arenas.length * CARD_WIDTH + Math.max(0, arenas.length - 1) * CARD_GAP;
    const startX = 640 - totalWidth / 2 + CARD_WIDTH / 2;

    this.cards = arenas.map((arena, index) => {
      const x = startX + index * (CARD_WIDTH + CARD_GAP);
      const graphics = this.add.graphics().setDepth(4);
      const label = this.add.text(x, 475, arena.name.toUpperCase(), {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: CSS_COLORS.bone,
      }).setOrigin(0.5).setDepth(5);
      const detail = this.add.text(x, 493, `${arena.theme.motif.toUpperCase()}  •  PARALLAX ${arena.parallax.mid}`, {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      }).setOrigin(0.5).setDepth(5).setLetterSpacing(1);

      const zone = this.add.zone(x, CARD_CENTER_Y, CARD_WIDTH, CARD_HEIGHT).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (this.starting || this.index === index) return;
        this.index = index;
        this.refreshPreview();
        getAudioManager(this.game)?.playUi('ui-move');
      });
      zone.on('pointerdown', () => {
        if (this.starting) return;
        this.index = index;
        this.refreshPreview();
      });

      return { arena, zone, graphics, label, detail };
    });
  }

  private refreshPreview(): void {
    const arenas = getArenaRegistry();
    const arena = arenas[this.index] ?? arenas[0];
    if (!arena) return;

    this.feature.clear();
    drawArenaPreview(this.feature, arena, FEATURE_BOUNDS, { selected: true });

    this.previewName.setText(arena.name.toUpperCase()).setColor(toCssColor(arena.theme.accentA));
    this.previewDesc.setText(arena.description);
    this.previewMeta.setText(
      `MOTIF ${arena.theme.motif.toUpperCase()}  •  PARALLAX ${arena.parallax.mid}  •  AMBIENCE ${(arena.atmosphere.particleAlpha * 100).toFixed(0)}%`,
    );

    this.cards.forEach((card, index) => {
      const active = index === this.index;
      const x = card.zone.x;
      const y = card.zone.y;
      const accent = active ? card.arena.theme.accentA : card.arena.theme.frame;

      card.graphics.clear();
      card.graphics.fillStyle(COLORS.panel, active ? 0.94 : 0.7);
      card.graphics.fillRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 10);
      drawArenaPreview(
        card.graphics,
        card.arena,
        { x: x - 118, y: y - 46, width: 236, height: 54 },
        { selected: active },
      );
      card.graphics.lineStyle(active ? 2.5 : 1, accent, active ? 1 : 0.55);
      card.graphics.strokeRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 10);

      card.label.setColor(active ? CSS_COLORS.pearl : CSS_COLORS.bone).setAlpha(active ? 1 : 0.72);
      card.detail.setColor(toCssColor(active ? card.arena.theme.accentB : 0x9d92ae));
    });
  }

  private bindInput(): void {
    const columns = Math.max(1, Math.min(4, getArenaRegistry().length));
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1), this);
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1), this);
    this.input.keyboard?.on('keydown-UP', () => this.move(-columns), this);
    this.input.keyboard?.on('keydown-DOWN', () => this.move(columns), this);
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
    if (arenas.length === 0) return;
    this.index = ((this.index + delta) % arenas.length + arenas.length) % arenas.length;
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
    for (const button of this.buttons) button.destroy();
    this.buttons = [];
    for (const card of this.cards) {
      card.zone.destroy();
      card.graphics.destroy();
      card.label.destroy();
      card.detail.destroy();
    }
    this.cards = [];
    this.backdrop = undefined;
  }
}

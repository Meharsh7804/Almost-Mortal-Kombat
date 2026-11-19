import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import {
  getCharacterById,
  getCharacterRegistry,
  getRandomCharacterId,
  type CharacterDefinition,
} from '../data/CharacterRegistry';
import type { MatchConfig } from '../data/MatchConfig';
import { getCharacterVisual } from '../data/CharacterVisuals';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { FighterPortrait } from '../ui/FighterPortrait';
import { COLORS, CSS_COLORS, FONTS, toCssColor } from '../ui/Theme';

interface SceneData {
  readonly config: MatchConfig;
  readonly selecting: 1 | 2;
}

interface RosterCard {
  readonly zone: Phaser.GameObjects.Zone;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
}

interface FighterShowcase {
  readonly panel: Phaser.GameObjects.Graphics;
  readonly portrait: FighterPortrait;
  readonly badge: Phaser.GameObjects.Text;
  readonly name: Phaser.GameObjects.Text;
  readonly archetype: Phaser.GameObjects.Text;
  readonly statLabels: Phaser.GameObjects.Text[];
  readonly stats: Phaser.GameObjects.Graphics;
}

const PANEL_Y = 124;
const PANEL_HEIGHT = 392;
const STAT_LABELS = ['POWER', 'SPEED', 'RANGE', 'DEFENSE', 'DIFFICULTY'] as const;

export class CharacterSelectScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private config!: MatchConfig;
  private selecting: 1 | 2 = 1;
  private index = 0;
  private buttons: MenuButton[] = [];
  private rosterCards: RosterCard[] = [];
  private showcases: FighterShowcase[] = [];

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

    this.add.text(640, 62, 'CHARACTER SELECT', {
      fontFamily: FONTS.display,
      fontSize: '46px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(640, 104, 'CHOOSE YOUR FIGHTER', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setLetterSpacing(4).setAlpha(0.8);

    const divider = this.add.graphics();
    divider.lineStyle(1, COLORS.line, 0.55);
    divider.lineBetween(640, 124, 640, 516);
    divider.fillStyle(COLORS.crimson, 0.1);
    divider.fillRect(636, 124, 8, 392);

    this.showcases = [
      this.createShowcase(0, 36, 316, 1),
      this.createShowcase(1, 684, 964, -1),
    ];

    this.add.text(640, 316, 'VS', {
      fontFamily: FONTS.display,
      fontSize: '42px',
      color: CSS_COLORS.crimson,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(6);

    this.createRosterStrip();

    this.buttons.push(
      new MenuButton(this, { x: 430, y: 634, width: 190, height: 40, label: 'RANDOM', fontSize: 18, letterSpacing: 4, glowPaddingX: 20, glowPaddingY: 50, onClick: () => this.randomize() }),
      new MenuButton(this, { x: 640, y: 634, width: 190, height: 40, label: 'CONFIRM', fontSize: 18, letterSpacing: 4, glowPaddingX: 20, glowPaddingY: 50, onClick: () => this.confirmSelection() }),
      new MenuButton(this, { x: 850, y: 634, width: 190, height: 40, label: 'BACK', fontSize: 18, letterSpacing: 4, glowPaddingX: 20, glowPaddingY: 50, onClick: () => this.back() }),
    );

    this.add.text(640, 688, 'ARROWS/A-D PICK  •  R RANDOM  •  ENTER CONFIRM  •  ESC BACK', {
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

  private createShowcase(side: 0 | 1, panelX: number, centerX: number, facing: 1 | -1): FighterShowcase {
    const panel = this.add.graphics().setDepth(2);
    const portrait = new FighterPortrait(this, {
      x: centerX,
      y: 498,
      characterId: side === 0 ? this.config.player1CharacterId : this.config.player2CharacterId,
      scale: 1.5,
      facing,
      pose: 'ready',
      glowAlpha: 0.19,
    });
    portrait.setDepth(4);

    const badge = this.add.text(centerX, 86, '', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.bone,
    }).setOrigin(0.5).setLetterSpacing(2).setDepth(6);

    const name = this.add.text(centerX, 148, '', {
      fontFamily: FONTS.display,
      fontSize: '36px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(6);

    const archetype = this.add.text(centerX, 182, '', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.violet,
    }).setOrigin(0.5).setLetterSpacing(2).setDepth(6);

    const statLabels = STAT_LABELS.map((label, index) =>
      this.add.text(panelX + 34, 222 + index * 18, label, {
        fontFamily: FONTS.mono,
        fontSize: '10px',
        color: CSS_COLORS.muted,
      }).setOrigin(0, 0.5).setDepth(6),
    );

    const stats = this.add.graphics();
    stats.setDepth(5);

    return { panel, portrait, badge, name, archetype, statLabels, stats };
  }

  private createRosterStrip(): void {
    const roster = getCharacterRegistry();
    const cardWidth = 190;
    const gap = 14;
    const totalWidth = roster.length * cardWidth + (roster.length - 1) * gap;
    const startX = 640 - totalWidth / 2 + cardWidth / 2;

    this.rosterCards = roster.map((character, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = 556;
      const graphics = this.add.graphics().setDepth(21);
      const swatch = getCharacterVisual(
        character.visualId,
        character.fighterConfig.color,
        character.fighterConfig.accentColor,
      ).colors.primary;
      const label = this.add.text(x + 8, y, character.displayName, {
        fontFamily: FONTS.display,
        fontSize: '18px',
        color: CSS_COLORS.bone,
      }).setOrigin(0.5).setDepth(22);
      graphics.fillStyle(swatch, 0.95);
      graphics.fillCircle(x - cardWidth / 2 + 22, y, 7);

      const zone = this.add.zone(x, y, cardWidth, 52).setInteractive({ useHandCursor: true });
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

      return { zone, graphics, label };
    });
  }

  private refreshPreview(): void {
    const roster = getCharacterRegistry();
    const selected = roster[this.index] ?? roster[0];
    if (!selected) return;

    const p1 = getCharacterById(this.config.player1CharacterId) ?? selected;
    const p2 = getCharacterById(this.config.player2CharacterId) ?? selected;
    const activeCharacter = selected;
    const characters: CharacterDefinition[] = [
      this.selecting === 1 ? activeCharacter : p1,
      this.selecting === 2 ? activeCharacter : p2,
    ];

    this.showcases.forEach((showcase, side) => {
      const character = characters[side] ?? selected;
      const visual = getCharacterVisual(
        character.visualId,
        character.fighterConfig.color,
        character.fighterConfig.accentColor,
      );
      const active = (side === 0 && this.selecting === 1) || (side === 1 && this.selecting === 2);
      const role = side === 0 ? 'PLAYER 1' : this.config.cpuEnabled && this.config.cpuPlayer === 2 ? 'CPU' : 'PLAYER 2';

      showcase.portrait.setCharacter(
        character.visualId,
        character.fighterConfig.color,
        character.fighterConfig.accentColor,
      );
      showcase.portrait.setPose(active ? 'strike' : 'ready');
      showcase.portrait.setEmphasis(active);

      showcase.badge.setText(`${role}  //  ${active ? 'SELECTING' : 'LOCKED'}`);
      showcase.badge.setColor(active ? CSS_COLORS.pearl : CSS_COLORS.muted);
      showcase.name.setText(character.displayName).setColor(toCssColor(visual.colors.primary));
      showcase.archetype.setText(character.archetype.replace('_', ' '));

      const panelX = side === 0 ? 36 : 684;
      showcase.panel.clear();
      showcase.panel.fillStyle(COLORS.panel, 0.82);
      showcase.panel.fillRoundedRect(panelX, PANEL_Y, 560, PANEL_HEIGHT, 14);
      showcase.panel.lineStyle(active ? 3 : 1.5, visual.colors.primary, active ? 0.95 : 0.5);
      showcase.panel.strokeRoundedRect(panelX, PANEL_Y, 560, PANEL_HEIGHT, 14);
      showcase.panel.fillStyle(visual.colors.primary, active ? 0.5 : 0.2);
      showcase.panel.fillRoundedRect(panelX + 20, PANEL_Y + 18, 52, 3, 2);
      showcase.panel.fillRoundedRect(panelX + 488, PANEL_Y + PANEL_HEIGHT - 21, 52, 3, 2);

      showcase.stats.clear();
      STAT_LABELS.forEach((label, statIndex) => {
        const value = character.stats[label.toLowerCase() as keyof CharacterDefinition['stats']];
        const barX = panelX + 150;
        const barY = 226 + statIndex * 18;
        showcase.statLabels[statIndex]?.setColor(active ? CSS_COLORS.bone : CSS_COLORS.muted);
        showcase.stats.fillStyle(COLORS.nearBlack, 0.75);
        showcase.stats.fillRoundedRect(barX, barY - 4, 116, 8, 3);
        for (let segment = 0; segment < 5; segment += 1) {
          showcase.stats.fillStyle(
            segment < value ? visual.colors.primary : COLORS.line,
            segment < value ? (active ? 0.95 : 0.6) : 0.35,
          );
          showcase.stats.fillRoundedRect(barX + segment * 24, barY - 4, 20, 8, 2);
        }
      });
    });

    this.rosterCards.forEach((card, index) => {
      const character = roster[index];
      if (!character) return;
      const visual = getCharacterVisual(
        character.visualId,
        character.fighterConfig.color,
        character.fighterConfig.accentColor,
      );
      const active = index === this.index;
      const x = card.zone.x;
      const y = card.zone.y;
      card.graphics.clear();
      card.graphics.fillStyle(active ? COLORS.panel : COLORS.nearBlack, active ? 0.96 : 0.72);
      card.graphics.fillRoundedRect(x - 95, y - 26, 190, 52, 8);
      card.graphics.lineStyle(active ? 2.5 : 1, visual.colors.primary, active ? 1 : 0.45);
      card.graphics.strokeRoundedRect(x - 95, y - 26, 190, 52, 8);
      card.graphics.fillStyle(visual.colors.primary, 0.95);
      card.graphics.fillCircle(x - 73, y, 7);
      card.label.setColor(active ? CSS_COLORS.pearl : CSS_COLORS.muted);
    });
  }

  private bindInput(): void {
    const columns = Math.max(1, Math.min(4, getCharacterRegistry().length));
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1), this);
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1), this);
    this.input.keyboard?.on('keydown-A', () => this.move(-1), this);
    this.input.keyboard?.on('keydown-D', () => this.move(1), this);
    this.input.keyboard?.on('keydown-UP', () => this.move(-columns), this);
    this.input.keyboard?.on('keydown-DOWN', () => this.move(columns), this);
    this.input.keyboard?.on('keydown-R', this.randomize, this);
    this.input.keyboard?.on('keydown-ENTER', this.confirmSelection, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirmSelection, this);
    this.input.keyboard?.on('keydown-ESC', this.back, this);
  }

  private move(delta: number): void {
    if (this.starting) return;
    const length = getCharacterRegistry().length;
    if (length === 0) return;
    this.index = ((this.index + delta) % length + length) % length;
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
        this.start(SCENE_KEYS.CHARACTER_SELECT, { config, selecting: 2 });
        return;
      }
      if (this.config.mode === 'TRAINING') {
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
    for (const button of this.buttons) button.destroy();
    this.buttons = [];
    for (const card of this.rosterCards) {
      card.zone.destroy();
      card.graphics.destroy();
      card.label.destroy();
    }
    this.rosterCards = [];
    for (const showcase of this.showcases) showcase.portrait.destroy();
    this.showcases = [];
    this.backdrop = undefined;
  }
}

import Phaser from 'phaser';

import { GAME_WIDTH } from '../core/GameConfig';
import { COLORS, CSS_COLORS, FONTS, toCssColor } from './Theme';

export interface HudFighterSnapshot {
  readonly name: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly playerNumber: 1 | 2;
  readonly color: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly dodgeCooldownFrames: number;
  readonly dodgeCooldownMaxFrames: number;
  readonly blocking: boolean;
}

const BAR_X = 64;
const BAR_Y = 76;
const BAR_WIDTH = 500;
const BAR_HEIGHT = 22;
const ENERGY_Y = 116;
const ENERGY_HEIGHT = 8;
const DODGE_Y = 130;
const COMBO_Y = 150;
const P2_BAR_X = GAME_WIDTH - BAR_X - BAR_WIDTH;
const DEPTH = 100;

export class HUD {
  private p1HealthCurrent = 100;
  private p2HealthCurrent = 100;
  private p1HealthLag = 100;
  private p2HealthLag = 100;
  private p1EnergyCurrent = 100;
  private p2EnergyCurrent = 100;
  private p1DodgeRatio = 1;
  private p2DodgeRatio = 1;

  private readonly p1Label: Phaser.GameObjects.Text;
  private readonly p2Label: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly roundText: Phaser.GameObjects.Text;
  private readonly phaseLabel: Phaser.GameObjects.Text;
  private readonly announcementText: Phaser.GameObjects.Text;
  private readonly controlHint1: Phaser.GameObjects.Text;
  private readonly controlHint2: Phaser.GameObjects.Text;
  private readonly noticeText: Phaser.GameObjects.Text;
  private readonly p1ComboText: Phaser.GameObjects.Text;
  private readonly p2ComboText: Phaser.GameObjects.Text;

  private readonly bars: Phaser.GameObjects.Graphics;
  private noticeTimer = 0;
  private comboTimers = [0, 0];

  constructor(scene: Phaser.Scene) {
    this.bars = scene.add.graphics().setDepth(DEPTH);

    this.p1Label = scene.add.text(BAR_X, 44, 'P1', {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 3,
    }).setDepth(DEPTH);

    this.p2Label = scene.add.text(P2_BAR_X + BAR_WIDTH, 44, 'P2', {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(DEPTH);

    this.timerText = scene.add.text(GAME_WIDTH / 2, 36, '99', {
      fontFamily: FONTS.display,
      fontSize: '40px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5, 0).setDepth(DEPTH);

    this.roundText = scene.add.text(GAME_WIDTH / 2, 84, 'ROUND 01  •  0 - 0', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setLetterSpacing(2).setDepth(DEPTH);

    this.phaseLabel = scene.add.text(GAME_WIDTH / 2, 112, 'STANDBY', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS_COLORS.violet,
    }).setOrigin(0.5).setLetterSpacing(3).setDepth(DEPTH);

    this.announcementText = scene.add.text(GAME_WIDTH / 2, 250, '', {
      fontFamily: FONTS.display,
      fontSize: '84px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH).setVisible(false);

    this.controlHint1 = scene.add.text(24, 688, '', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setAlpha(0.7).setDepth(DEPTH);

    this.controlHint2 = scene.add.text(GAME_WIDTH - 24, 688, '', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setOrigin(1, 0).setAlpha(0.7).setDepth(DEPTH);

    this.noticeText = scene.add.text(GAME_WIDTH / 2, 170, '', {
      fontFamily: FONTS.display,
      fontSize: '24px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH).setVisible(false);

    this.p1ComboText = scene.add.text(BAR_X, COMBO_Y, '', {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: toCssColor(COLORS.cyan),
      stroke: '#000000',
      strokeThickness: 4,
    }).setDepth(DEPTH).setVisible(false);

    this.p2ComboText = scene.add.text(P2_BAR_X + BAR_WIDTH, COMBO_Y, '', {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: toCssColor(COLORS.emberOrange),
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(1, 0).setDepth(DEPTH).setVisible(false);
  }

  setSideLabels(p1: string, p2: string): void {
    this.p1Label.setText(p1);
    this.p2Label.setText(p2);
  }

  setControlHints(p1: string, p2: string): void {
    this.controlHint1.setText(p1);
    this.controlHint2.setText(p2);
  }

  setPhaseLabel(label: string): void {
    this.phaseLabel.setText(label.toUpperCase());
  }

  setAnnouncement(text: 'READY' | 'FIGHT' | 'K.O.' | 'TIME' | null): void {
    if (!text) {
      this.announcementText.setVisible(false);
      return;
    }
    const color = text === 'K.O.' || text === 'TIME' ? CSS_COLORS.crimson : CSS_COLORS.bone;
    this.announcementText.setColor(color).setText(text).setVisible(true).setAlpha(1).setScale(1);
  }

  setTimer(seconds: number | null): void {
    if (seconds === null) {
      this.timerText.setText('--').setColor(CSS_COLORS.muted);
      return;
    }
    const clamped = Math.max(0, Math.floor(seconds));
    this.timerText.setText(String(clamped).padStart(2, '0'));
    this.timerText.setColor(clamped <= 10 ? CSS_COLORS.crimson : CSS_COLORS.bone);
  }

  setRoundInfo(currentRound: number, p1Wins: number, p2Wins: number, roundsToWin: number): void {
    this.roundText.setText(
      `ROUND ${String(currentRound).padStart(2, '0')}  •  ${p1Wins} - ${p2Wins}  (FT${roundsToWin})`,
    );
  }

  showNotice(text: string, color: number = COLORS.bone): void {
    this.noticeText.setText(text).setColor(toCssColor(color)).setVisible(true).setAlpha(1);
    this.noticeTimer = 900;
  }

  showCombo(playerNumber: 1 | 2, hits: number, damage: number): void {
    if (hits < 2) return;
    const text = playerNumber === 1 ? this.p1ComboText : this.p2ComboText;
    text.setText(`${hits} HITS  ${damage}`).setVisible(true).setAlpha(1);
    this.comboTimers[playerNumber - 1] = 1200;
  }

  clearCombo(playerNumber: 1 | 2): void {
    const text = playerNumber === 1 ? this.p1ComboText : this.p2ComboText;
    text.setVisible(false);
    this.comboTimers[playerNumber - 1] = 0;
  }

  update(players: readonly [HudFighterSnapshot, HudFighterSnapshot], deltaMs: number): void {
    const [p1, p2] = players;
    this.updateValues(p1, p2, deltaMs);
    this.drawBars(p1, p2);
    this.updateTransientText(deltaMs);
  }

  destroy(): void {
    this.bars.destroy();
    this.p1Label.destroy();
    this.p2Label.destroy();
    this.timerText.destroy();
    this.roundText.destroy();
    this.phaseLabel.destroy();
    this.announcementText.destroy();
    this.controlHint1.destroy();
    this.controlHint2.destroy();
    this.noticeText.destroy();
    this.p1ComboText.destroy();
    this.p2ComboText.destroy();
  }

  private updateValues(p1: HudFighterSnapshot, p2: HudFighterSnapshot, deltaMs: number): void {
    const lerp = Math.min(1, deltaMs * 0.012);
    const lagLerp = Math.min(1, deltaMs * 0.0045);

    this.p1HealthCurrent = Phaser.Math.Linear(this.p1HealthCurrent, p1.health, lerp);
    this.p2HealthCurrent = Phaser.Math.Linear(this.p2HealthCurrent, p2.health, lerp);
    this.p1HealthLag = Phaser.Math.Linear(this.p1HealthLag, p1.health, lagLerp);
    this.p2HealthLag = Phaser.Math.Linear(this.p2HealthLag, p2.health, lagLerp);
    this.p1EnergyCurrent = Phaser.Math.Linear(this.p1EnergyCurrent, p1.energy, lerp);
    this.p2EnergyCurrent = Phaser.Math.Linear(this.p2EnergyCurrent, p2.energy, lerp);

    const p1Dodge = p1.dodgeCooldownMaxFrames > 0 ? 1 - p1.dodgeCooldownFrames / p1.dodgeCooldownMaxFrames : 1;
    const p2Dodge = p2.dodgeCooldownMaxFrames > 0 ? 1 - p2.dodgeCooldownFrames / p2.dodgeCooldownMaxFrames : 1;
    this.p1DodgeRatio = Phaser.Math.Linear(this.p1DodgeRatio, Phaser.Math.Clamp(p1Dodge, 0, 1), lerp);
    this.p2DodgeRatio = Phaser.Math.Linear(this.p2DodgeRatio, Phaser.Math.Clamp(p2Dodge, 0, 1), lerp);
  }

  private drawBars(p1: HudFighterSnapshot, p2: HudFighterSnapshot): void {
    const g = this.bars;
    g.clear();

    this.drawPlayerBars(g, BAR_X, 1, p1, this.p1HealthCurrent, this.p1HealthLag, this.p1EnergyCurrent, this.p1DodgeRatio);
    this.drawPlayerBars(g, P2_BAR_X, -1, p2, this.p2HealthCurrent, this.p2HealthLag, this.p2EnergyCurrent, this.p2DodgeRatio);
  }

  private drawPlayerBars(
    g: Phaser.GameObjects.Graphics,
    x: number,
    dir: 1 | -1,
    fighter: HudFighterSnapshot,
    health: number,
    lag: number,
    energy: number,
    dodgeRatio: number,
  ): void {
    const maxH = Math.max(1, fighter.maxHealth);
    const maxE = Math.max(1, fighter.maxEnergy);
    const healthRatio = Phaser.Math.Clamp(health / maxH, 0, 1);
    const lagRatio = Phaser.Math.Clamp(lag / maxH, 0, 1);
    const energyRatio = Phaser.Math.Clamp(energy / maxE, 0, 1);

    // background
    g.fillStyle(0x0b0810, 0.9);
    g.fillRect(x, BAR_Y, BAR_WIDTH, BAR_HEIGHT);
    g.lineStyle(1, COLORS.line, 0.8);
    g.strokeRect(x, BAR_Y, BAR_WIDTH, BAR_HEIGHT);

    // lag
    g.fillStyle(COLORS.crimsonDeep, 0.75);
    this.fillBar(g, x, BAR_Y + 2, BAR_WIDTH, BAR_HEIGHT - 4, lagRatio, dir);

    // health
    g.fillStyle(fighter.color, 0.95);
    this.fillBar(g, x, BAR_Y + 2, BAR_WIDTH, BAR_HEIGHT - 4, healthRatio, dir);

    // block indicator overlay
    if (fighter.blocking) {
      g.lineStyle(2, COLORS.gold, 0.55);
      g.strokeRect(x - 1, BAR_Y - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2);
    }

    // energy
    g.fillStyle(0x0b0810, 0.9);
    g.fillRect(x, ENERGY_Y, BAR_WIDTH, ENERGY_HEIGHT);
    g.fillStyle(COLORS.violet, 0.9);
    this.fillBar(g, x, ENERGY_Y + 1, BAR_WIDTH, ENERGY_HEIGHT - 2, energyRatio, dir);

    // dodge cooldown
    g.fillStyle(0x0b0810, 0.9);
    g.fillRect(x, DODGE_Y, BAR_WIDTH, 4);
    g.fillStyle(dodgeRatio >= 1 ? COLORS.cyan : COLORS.muted, 0.85);
    this.fillBar(g, x, DODGE_Y, BAR_WIDTH, 4, dodgeRatio, dir);
  }

  private fillBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    ratio: number,
    dir: 1 | -1,
  ): void {
    const w = Math.max(0, Math.floor(width * ratio));
    if (w <= 0) return;
    if (dir === 1) {
      g.fillRect(x, y, w, height);
    } else {
      g.fillRect(x + width - w, y, w, height);
    }
  }

  private updateTransientText(deltaMs: number): void {
    if (this.noticeTimer > 0) {
      this.noticeTimer -= deltaMs;
      if (this.noticeTimer <= 0) {
        this.noticeText.setVisible(false);
      } else if (this.noticeTimer < 250) {
        this.noticeText.setAlpha(this.noticeTimer / 250);
      }
    }

    for (let i = 0; i < 2; i += 1) {
      const timer = this.comboTimers[i] ?? 0;
      if (timer <= 0) continue;
      this.comboTimers[i] = timer - deltaMs;
      const text = i === 0 ? this.p1ComboText : this.p2ComboText;
      const remaining = this.comboTimers[i] ?? 0;
      if (remaining <= 0) {
        text.setVisible(false);
      } else if (remaining < 300) {
        text.setAlpha(remaining / 300);
      }
    }
  }
}

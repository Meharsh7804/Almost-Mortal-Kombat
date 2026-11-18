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
const BAR_GAP = 8;
const ENERGY_Y = 116;
const ENERGY_HEIGHT = 8;
const DODGE_Y = 130;
const COMBO_Y = 150;
const P2_BAR_X = GAME_WIDTH - BAR_X - BAR_WIDTH;
const DEPTH = 100;

/**
 * Fighting-game HUD. It receives plain health snapshots rather than Fighter
 * instances, so the UI stays decoupled from simulation internals. Bar values
 * interpolate on the render clock while damage targets update immediately.
 */
export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly barGraphics: Phaser.GameObjects.Graphics;
  private readonly p1Label: Phaser.GameObjects.Text;
  private readonly p2Label: Phaser.GameObjects.Text;
  private readonly p1Name: Phaser.GameObjects.Text;
  private readonly p2Name: Phaser.GameObjects.Text;
  private readonly p1Health: Phaser.GameObjects.Text;
  private readonly p2Health: Phaser.GameObjects.Text;
  private readonly p1Dodge: Phaser.GameObjects.Text;
  private readonly p2Dodge: Phaser.GameObjects.Text;
  private readonly p1Combo: Phaser.GameObjects.Text;
  private readonly p2Combo: Phaser.GameObjects.Text;
  private readonly notice: Phaser.GameObjects.Text;
  private readonly phaseText: Phaser.GameObjects.Text;
  private readonly announcement: Phaser.GameObjects.Text;
  private readonly versusText: Phaser.GameObjects.Text;
  private readonly p1Controls: Phaser.GameObjects.Text;
  private readonly p2Controls: Phaser.GameObjects.Text;

  private displayedHealth: [number, number] = [0, 0];
  private chipHealth: [number, number] = [0, 0];
  private displayedEnergy: [number, number] = [0, 0];
  private healthInitialized = false;
  private currentAnnouncement: string | null = null;
  private currentPhaseLabel = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.barGraphics = scene.add.graphics().setDepth(DEPTH);

    this.p1Label = this.createText(BAR_X, 24, 'P1 // RIFT', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setOrigin(0, 0);
    this.p2Label = this.createText(GAME_WIDTH - BAR_X, 24, 'EMBER // P2', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setOrigin(1, 0);

    this.p1Name = this.createText(BAR_X, 34, '', {
      fontFamily: FONTS.display,
      fontSize: '30px',
      color: CSS_COLORS.bone,
    }).setOrigin(0, 0);
    this.p2Name = this.createText(GAME_WIDTH - BAR_X, 34, '', {
      fontFamily: FONTS.display,
      fontSize: '30px',
      color: CSS_COLORS.bone,
    }).setOrigin(1, 0);

    this.p1Health = this.createText(BAR_X, 104, '100', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.muted,
    }).setOrigin(0, 0);
    this.p2Health = this.createText(GAME_WIDTH - BAR_X, 104, '100', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.muted,
    }).setOrigin(1, 0);

    this.p1Dodge = this.createText(BAR_X, DODGE_Y, 'DODGE READY', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS_COLORS.muted,
    }).setOrigin(0, 0);
    this.p2Dodge = this.createText(GAME_WIDTH - BAR_X, DODGE_Y, 'DODGE READY', {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS_COLORS.muted,
    }).setOrigin(1, 0);

    this.p1Combo = this.createText(BAR_X, COMBO_Y, '', {
      fontFamily: FONTS.display,
      fontSize: '22px',
      color: CSS_COLORS.bone,
    })
      .setOrigin(0, 0)
      .setAlpha(0)
      .setVisible(false);
    this.p2Combo = this.createText(GAME_WIDTH - BAR_X, COMBO_Y, '', {
      fontFamily: FONTS.display,
      fontSize: '22px',
      color: CSS_COLORS.bone,
    })
      .setOrigin(1, 0)
      .setAlpha(0)
      .setVisible(false);

    this.notice = this.createText(GAME_WIDTH / 2, 172, '', {
      fontFamily: FONTS.display,
      fontSize: '24px',
      color: CSS_COLORS.bone,
    })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setAlpha(0)
      .setVisible(false);

    this.createText(GAME_WIDTH / 2, 24, 'ROUND 01', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    })
      .setOrigin(0.5, 0)
      .setLetterSpacing(4);

    this.phaseText = this.createText(GAME_WIDTH / 2, 102, 'STANDBY', {
      fontFamily: FONTS.display,
      fontSize: '16px',
      color: CSS_COLORS.bone,
    })
      .setOrigin(0.5, 0)
      .setLetterSpacing(3);

    this.announcement = this.createText(GAME_WIDTH / 2, 254, '', {
      fontFamily: FONTS.display,
      fontSize: '96px',
      color: CSS_COLORS.bone,
      align: 'center',
    })
      .setOrigin(0.5)
      .setLetterSpacing(8)
      .setVisible(false);

    this.versusText = this.createText(GAME_WIDTH / 2, 330, '', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS_COLORS.muted,
    })
      .setOrigin(0.5)
      .setLetterSpacing(5)
      .setVisible(false);

    this.p1Controls = this.createText(
      BAR_X,
      691,
      'P1  A/D MOVE   W JUMP   S CROUCH   F LIGHT   G HEAVY   T BLOCK   H/Y SPECIAL   Q DODGE',
      {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      },
    )
      .setOrigin(0, 1)
      .setAlpha(0.34);

    this.p2Controls = this.createText(
      GAME_WIDTH - BAR_X,
      691,
      'P2  LEFT/RIGHT MOVE   UP JUMP   DOWN CROUCH   J LIGHT   K HEAVY   O BLOCK   U/I SPECIAL   P DODGE',
      {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      },
    )
      .setOrigin(1, 1)
      .setAlpha(0.34);
  }

  update(players: readonly [HudFighterSnapshot, HudFighterSnapshot], deltaMs: number): void {
    this.p1Name.setText(players[0].name).setColor(toCssColor(players[0].color));
    this.p2Name.setText(players[1].name).setColor(toCssColor(players[1].color));
    this.p1Label.setColor(toCssColor(players[0].color));
    this.p2Label.setColor(toCssColor(players[1].color));
    this.versusText.setText(`${players[0].name}   VS   ${players[1].name}`);

    if (!this.healthInitialized) {
      this.displayedHealth = [players[0].health, players[1].health];
      this.chipHealth = [players[0].health, players[1].health];
      this.displayedEnergy = [players[0].energy, players[1].energy];
      this.healthInitialized = true;
    }

    const fastFactor = 1 - Math.exp(-deltaMs / 70);
    const slowFactor = 1 - Math.exp(-deltaMs / 280);
    const energyFactor = 1 - Math.exp(-deltaMs / 140);

    for (let index = 0; index < 2; index += 1) {
      const player = players[index];
      if (!player) {
        continue;
      }
      const target = Phaser.Math.Clamp(player.health, 0, player.maxHealth);
      let displayed = this.displayedHealth[index] ?? target;
      let chip = this.chipHealth[index] ?? target;

      if (target > displayed) {
        displayed = target;
        chip = target;
      } else {
        displayed += (target - displayed) * fastFactor;
        chip += (target - chip) * slowFactor;
        if (chip < displayed) {
          chip = displayed;
        }
      }

      this.displayedHealth[index] = displayed;
      this.chipHealth[index] = chip;

      const energyTarget = Phaser.Math.Clamp(player.energy, 0, player.maxEnergy);
      const displayedEnergy = this.displayedEnergy[index] ?? energyTarget;
      this.displayedEnergy[index] =
        displayedEnergy + (energyTarget - displayedEnergy) * energyFactor;
    }

    this.p1Health.setText(`${Math.max(0, Math.ceil(players[0].health))}`);
    this.p2Health.setText(`${Math.max(0, Math.ceil(players[1].health))}`);
    this.p1Health.setColor(players[0].blocking ? toCssColor(COLORS.violet) : CSS_COLORS.muted);
    this.p2Health.setColor(players[1].blocking ? toCssColor(COLORS.violet) : CSS_COLORS.muted);

    this.updateDodgeLabel(this.p1Dodge, players[0]);
    this.updateDodgeLabel(this.p2Dodge, players[1]);

    this.drawBars(players);
  }

  showCombo(playerNumber: 1 | 2, hits: number, damage: number): void {
    const text = playerNumber === 1 ? this.p1Combo : this.p2Combo;
    const color = playerNumber === 1 ? COLORS.cyan : COLORS.emberOrange;

    this.scene.tweens.killTweensOf(text);
    text
      .setText(`${hits} HIT${hits === 1 ? '' : 'S'}  //  ${damage} DMG`)
      .setColor(toCssColor(color))
      .setVisible(true)
      .setAlpha(1)
      .setScale(1.16);

    this.scene.tweens.add({
      targets: text,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });
  }

  clearCombo(playerNumber: 1 | 2): void {
    const text = playerNumber === 1 ? this.p1Combo : this.p2Combo;
    this.scene.tweens.killTweensOf(text);
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: 220,
      ease: 'Sine.easeIn',
      onComplete: () => text.setVisible(false),
    });
  }

  showNotice(text: string, color: number): void {
    this.scene.tweens.killTweensOf(this.notice);
    this.notice
      .setText(text)
      .setColor(toCssColor(color))
      .setVisible(true)
      .setAlpha(1)
      .setScale(1.12);
    this.notice.setShadow(0, 0, toCssColor(color), 24, true, true);

    this.scene.tweens.add({
      targets: this.notice,
      scaleX: 1,
      scaleY: 1,
      duration: 130,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.notice,
      alpha: 0,
      delay: 720,
      duration: 240,
      ease: 'Sine.easeIn',
      onComplete: () => this.notice.setVisible(false),
    });
  }

  setPhaseLabel(label: string): void {
    if (label === this.currentPhaseLabel) {
      return;
    }

    this.currentPhaseLabel = label;
    this.phaseText.setText(label);
    const color =
      label === 'FIGHT' || label === 'K.O.'
        ? COLORS.crimson
        : label === 'MATCH COMPLETE' || label === 'DOUBLE K.O.'
          ? COLORS.gold
          : COLORS.bone;
    this.phaseText.setColor(toCssColor(color));
  }

  setAnnouncement(text: string | null): void {
    if (text === this.currentAnnouncement) {
      return;
    }

    this.currentAnnouncement = text;
    this.scene.tweens.killTweensOf(this.announcement);
    this.scene.tweens.killTweensOf(this.versusText);

    if (!text) {
      this.versusText.setVisible(false);
      this.scene.tweens.add({
        targets: this.announcement,
        alpha: 0,
        duration: 150,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (this.currentAnnouncement === null) {
            this.announcement.setVisible(false);
          }
        },
      });
      return;
    }

    const color = text === 'READY' ? COLORS.bone : COLORS.crimson;
    this.announcement
      .setText(text)
      .setColor(toCssColor(color))
      .setVisible(true)
      .setAlpha(0)
      .setScale(1.35);
    this.announcement.setShadow(0, 0, toCssColor(color), 36, true, true);

    this.scene.tweens.add({
      targets: this.announcement,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 240,
      ease: 'Back.easeOut',
    });

    if (text === 'READY' || text === 'FIGHT') {
      this.versusText.setVisible(true).setAlpha(0);
      this.scene.tweens.add({
        targets: this.versusText,
        alpha: 0.8,
        duration: 260,
        ease: 'Sine.easeOut',
      });
    } else {
      this.versusText.setVisible(false);
    }
  }

  setSideLabels(p1Label: string, p2Label: string): void {
    this.p1Label.setText(p1Label);
    this.p2Label.setText(p2Label);
  }

  setControlHints(p1: string, p2: string): void {
    this.p1Controls.setText(p1);
    this.p2Controls.setText(p2);
  }

  private drawBars(players: readonly [HudFighterSnapshot, HudFighterSnapshot]): void {
    const graphics = this.barGraphics;
    graphics.clear();

    const p1Ratio = this.getRatio(players[0], 0);
    const p2Ratio = this.getRatio(players[1], 1);
    const p1ChipRatio = this.getChipRatio(players[0], 0);
    const p2ChipRatio = this.getChipRatio(players[1], 1);

    this.drawFrame(graphics, BAR_X, players[0].color);
    this.drawFrame(graphics, P2_BAR_X, players[1].color);

    this.drawFill(graphics, BAR_X, BAR_WIDTH, players[0].color, p1Ratio, p1ChipRatio, false);
    this.drawFill(graphics, P2_BAR_X, BAR_WIDTH, players[1].color, p2Ratio, p2ChipRatio, true);

    this.drawEnergyBar(graphics, BAR_X, players[0], 0, false);
    this.drawEnergyBar(graphics, P2_BAR_X, players[1], 1, true);

    graphics.fillStyle(COLORS.gold, 0.85);
    graphics.fillTriangle(
      GAME_WIDTH / 2,
      BAR_Y + 2,
      GAME_WIDTH / 2 + 9,
      BAR_Y + BAR_HEIGHT / 2,
      GAME_WIDTH / 2,
      BAR_Y + BAR_HEIGHT - 2,
    );
    graphics.fillTriangle(
      GAME_WIDTH / 2,
      BAR_Y + 2,
      GAME_WIDTH / 2 - 9,
      BAR_Y + BAR_HEIGHT / 2,
      GAME_WIDTH / 2,
      BAR_Y + BAR_HEIGHT - 2,
    );
    graphics.lineStyle(1, COLORS.line, 0.7);
    graphics.strokeCircle(GAME_WIDTH / 2, BAR_Y + BAR_HEIGHT / 2, 14);

    graphics.lineStyle(1, players[0].color, 0.45);
    graphics.lineBetween(BAR_X, BAR_Y - 6, BAR_X + 70, BAR_Y - 6);
    graphics.lineStyle(1, players[1].color, 0.45);
    graphics.lineBetween(GAME_WIDTH - BAR_X, BAR_Y - 6, GAME_WIDTH - BAR_X - 70, BAR_Y - 6);
  }

  private drawFrame(graphics: Phaser.GameObjects.Graphics, x: number, color: number): void {
    graphics.fillStyle(0x050408, 0.88);
    graphics.fillRect(
      x - BAR_GAP,
      BAR_Y - BAR_GAP,
      BAR_WIDTH + BAR_GAP * 2,
      BAR_HEIGHT + BAR_GAP * 2,
    );
    graphics.lineStyle(1, COLORS.line, 0.85);
    graphics.strokeRect(
      x - BAR_GAP,
      BAR_Y - BAR_GAP,
      BAR_WIDTH + BAR_GAP * 2,
      BAR_HEIGHT + BAR_GAP * 2,
    );
    graphics.lineStyle(1, color, 0.4);
    graphics.strokeRect(x, BAR_Y, BAR_WIDTH, BAR_HEIGHT);
    graphics.fillStyle(0x0d0812, 1);
    graphics.fillRect(x, BAR_Y, BAR_WIDTH, BAR_HEIGHT);
  }

  private drawFill(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    width: number,
    color: number,
    ratio: number,
    chipRatio: number,
    mirrored: boolean,
  ): void {
    const chipWidth = width * chipRatio;
    const fillWidth = width * ratio;

    if (chipWidth > 0) {
      graphics.fillStyle(COLORS.bone, 0.38);
      graphics.fillRect(mirrored ? x + width - chipWidth : x, BAR_Y, chipWidth, BAR_HEIGHT);
    }

    if (fillWidth > 0) {
      const lowHealth = ratio <= 0.25;
      const pulse = lowHealth ? 0.78 + Math.sin(this.scene.time.now / 95) * 0.22 : 1;
      graphics.fillStyle(color, pulse);
      graphics.fillRect(mirrored ? x + width - fillWidth : x, BAR_Y, fillWidth, BAR_HEIGHT);

      graphics.fillStyle(0xffffff, 0.16);
      graphics.fillRect(mirrored ? x + width - fillWidth : x, BAR_Y, fillWidth, 3);
    }

    graphics.lineStyle(1, 0x050408, 0.6);
    for (let segment = 1; segment < 10; segment += 1) {
      const segmentX = x + (width / 10) * segment;
      graphics.lineBetween(segmentX, BAR_Y, segmentX, BAR_Y + BAR_HEIGHT);
    }
  }

  private drawEnergyBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    player: HudFighterSnapshot,
    index: number,
    mirrored: boolean,
  ): void {
    const ratio =
      player.maxEnergy <= 0
        ? 0
        : Phaser.Math.Clamp((this.displayedEnergy[index] ?? 0) / player.maxEnergy, 0, 1);

    graphics.fillStyle(0x050408, 0.9);
    graphics.fillRect(x, ENERGY_Y, BAR_WIDTH, ENERGY_HEIGHT);
    graphics.lineStyle(1, COLORS.line, 0.9);
    graphics.strokeRect(x, ENERGY_Y, BAR_WIDTH, ENERGY_HEIGHT);

    const fillWidth = BAR_WIDTH * ratio;
    if (fillWidth > 0) {
      graphics.fillStyle(COLORS.violet, 0.92);
      graphics.fillRect(
        mirrored ? x + BAR_WIDTH - fillWidth : x,
        ENERGY_Y,
        fillWidth,
        ENERGY_HEIGHT,
      );
      graphics.fillStyle(COLORS.pearl, 0.32);
      graphics.fillRect(mirrored ? x + BAR_WIDTH - fillWidth : x, ENERGY_Y, fillWidth, 2);
    }

    graphics.lineStyle(1, player.color, 0.35);
    graphics.strokeRect(x, ENERGY_Y, BAR_WIDTH, ENERGY_HEIGHT);

    graphics.lineStyle(1, 0x050408, 0.5);
    for (let segment = 1; segment < 4; segment += 1) {
      const segmentX = x + (BAR_WIDTH / 4) * segment;
      graphics.lineBetween(segmentX, ENERGY_Y, segmentX, ENERGY_Y + ENERGY_HEIGHT);
    }
  }

  private updateDodgeLabel(text: Phaser.GameObjects.Text, player: HudFighterSnapshot): void {
    if (player.dodgeCooldownFrames <= 0) {
      text.setText('DODGE READY').setColor(toCssColor(COLORS.violet)).setAlpha(0.85);
      return;
    }

    text
      .setText(`DODGE ${Math.ceil(player.dodgeCooldownFrames)}F`)
      .setColor(CSS_COLORS.muted)
      .setAlpha(0.5);
  }

  private getRatio(player: HudFighterSnapshot, index: number): number {
    const displayed = this.displayedHealth[index] ?? 0;
    return player.maxHealth <= 0 ? 0 : Phaser.Math.Clamp(displayed / player.maxHealth, 0, 1);
  }

  private getChipRatio(player: HudFighterSnapshot, index: number): number {
    const chip = this.chipHealth[index] ?? 0;
    return player.maxHealth <= 0 ? 0 : Phaser.Math.Clamp(chip / player.maxHealth, 0, 1);
  }

  private createText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, text, style).setDepth(DEPTH + 1);
  }
}

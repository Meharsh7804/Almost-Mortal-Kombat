import type Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../core/GameConfig';
import { MenuButton } from './MenuButton';
import { COLORS, CSS_COLORS, FONTS, toCssColor } from './Theme';

export interface VictoryScreenOptions {
  readonly winnerName: string | null;
  readonly winnerPlayer: 1 | 2 | null;
  readonly winnerColor: number;
  readonly isDraw: boolean;
  readonly onRestart: () => void;
  readonly onMenu: () => void;
}

const OVERLAY_DEPTH = 190;
const BUTTON_DEPTH = 210;

/**
 * Post-match overlay. It owns its keyboard shortcuts and is destroyed with the
 * scene; the scene controls what restart and return-to-menu actually do.
 */
export class VictoryScreen {
  private readonly scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Container | null = null;
  private buttons: MenuButton[] = [];
  private options: VictoryScreenOptions | null = null;
  private visible = false;
  private handled = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(options: VictoryScreenOptions): void {
    if (this.visible) {
      return;
    }

    this.visible = true;
    this.handled = false;
    this.options = options;

    const overlay = this.scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);
    this.overlay = overlay;

    const dim = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x040308, 0.9).setOrigin(0);
    overlay.add(dim);

    const decoration = this.scene.add.graphics();
    this.drawDecoration(decoration, options.winnerColor);
    overlay.add(decoration);

    const headline = options.isDraw ? 'DRAW' : 'VICTORY';
    const accent = options.winnerColor;

    overlay.add(
      this.makeText(640, 130, 'K.O.', {
        fontFamily: FONTS.display,
        fontSize: '30px',
        color: CSS_COLORS.crimson,
      })
        .setOrigin(0.5)
        .setLetterSpacing(14),
    );

    const headlineText = this.makeText(640, 196, headline, {
      fontFamily: FONTS.display,
      fontSize: '82px',
      color: CSS_COLORS.bone,
    })
      .setOrigin(0.5)
      .setLetterSpacing(10);
    headlineText.setShadow(0, 0, toCssColor(accent), 40, true, true);
    overlay.add(headlineText);

    const winnerLine = options.isDraw
      ? 'TWO FIGHTERS FELL'
      : `${options.winnerName ?? 'UNKNOWN'} WINS`;
    overlay.add(
      this.makeText(640, 282, winnerLine, {
        fontFamily: FONTS.display,
        fontSize: '40px',
        color: toCssColor(accent),
      })
        .setOrigin(0.5)
        .setLetterSpacing(5),
    );

    const subline = options.isDraw
      ? 'NO WINNER // ROUND 01'
      : `PLAYER ${options.winnerPlayer ?? '-'} // ROUND 01 COMPLETE`;
    overlay.add(
      this.makeText(640, 330, subline, {
        fontFamily: FONTS.mono,
        fontSize: '11px',
        color: CSS_COLORS.muted,
      })
        .setOrigin(0.5)
        .setLetterSpacing(4),
    );

    overlay.add(
      this.makeText(640, 552, 'ENTER  REMATCH        ESC  MAIN MENU', {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      })
        .setOrigin(0.5)
        .setAlpha(0.55)
        .setLetterSpacing(3),
    );

    overlay.setAlpha(0);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 260,
      ease: 'Sine.easeOut',
    });

    const restart = new MenuButton(this.scene, {
      x: 420,
      y: 444,
      width: 340,
      height: 68,
      label: 'RESTART',
      onClick: () => this.restart(),
    });
    restart.setDepth(BUTTON_DEPTH);

    const menu = new MenuButton(this.scene, {
      x: 850,
      y: 444,
      width: 440,
      height: 68,
      label: 'RETURN TO MENU',
      onClick: () => this.menu(),
    });
    menu.setDepth(BUTTON_DEPTH);

    this.buttons = [restart, menu];
    for (const button of this.buttons) {
      button.setAlpha(0);
      this.scene.tweens.add({
        targets: button,
        alpha: 1,
        duration: 300,
        delay: 140,
        ease: 'Sine.easeOut',
      });
    }

    this.scene.input.keyboard?.on('keydown-ENTER', this.handleEnter);
    this.scene.input.keyboard?.on('keydown-ESC', this.handleEscape);
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-ENTER', this.handleEnter);
    this.scene.input.keyboard?.off('keydown-ESC', this.handleEscape);

    for (const button of this.buttons) {
      button.destroy();
    }
    this.buttons = [];
    this.overlay?.destroy(true);
    this.overlay = null;
    this.visible = false;
    this.handled = false;
    this.options = null;
  }

  private drawDecoration(graphics: Phaser.GameObjects.Graphics, accent: number): void {
    graphics.fillStyle(0x0c0812, 0.94);
    graphics.fillRect(208, 84, 864, 528);
    graphics.lineStyle(1, COLORS.line, 0.9);
    graphics.strokeRect(208, 84, 864, 528);
    graphics.lineStyle(2, accent, 0.7);
    graphics.lineBetween(208, 84, 328, 84);
    graphics.lineBetween(208, 84, 208, 172);
    graphics.lineBetween(GAME_WIDTH - 208, GAME_HEIGHT - 84, GAME_WIDTH - 328, GAME_HEIGHT - 84);
    graphics.lineBetween(GAME_WIDTH - 208, GAME_HEIGHT - 84, GAME_WIDTH - 208, GAME_HEIGHT - 172);

    graphics.lineStyle(1, COLORS.violet, 0.2);
    graphics.lineBetween(208, 384, GAME_WIDTH - 208, 384);
    graphics.lineStyle(1, COLORS.crimson, 0.35);
    graphics.beginPath();
    graphics.moveTo(208, 384);
    graphics.lineTo(228, 374);
    graphics.lineTo(248, 384);
    graphics.strokePath();
    graphics.beginPath();
    graphics.moveTo(GAME_WIDTH - 208, 384);
    graphics.lineTo(GAME_WIDTH - 228, 374);
    graphics.lineTo(GAME_WIDTH - 248, 384);
    graphics.strokePath();

    graphics.fillStyle(accent, 0.8);
    graphics.fillTriangle(640, 358, 650, 372, 640, 386);
    graphics.fillTriangle(640, 358, 630, 372, 640, 386);
  }

  private makeText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, text, style);
  }

  private restart(): void {
    if (this.handled) {
      return;
    }

    this.handled = true;
    this.options?.onRestart();
  }

  private menu(): void {
    if (this.handled) {
      return;
    }

    this.handled = true;
    this.options?.onMenu();
  }

  private readonly handleEnter = (): void => {
    this.restart();
  };

  private readonly handleEscape = (): void => {
    this.menu();
  };
}

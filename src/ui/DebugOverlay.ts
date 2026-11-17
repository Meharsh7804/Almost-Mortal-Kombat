import type Phaser from 'phaser';

import { ARENA_BOUNDS } from '../data/ArenaConfig';
import type { Fighter } from '../entities/Fighter';
import { getAttackBox } from '../combat/HitboxSystem';
import { COLORS, CSS_COLORS, FONTS } from './Theme';

const COLORS_DEBUG = {
  hitbox: 0xff3b4e,
  hurtbox: 0x46ff8c,
  pushbox: 0x4d8dff,
} as const;

/**
 * Development-only collision visualization. Draws on top of fighters, never
 * participates in collision and can be toggled without pausing the match.
 */
export class DebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private enabled = false;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(80);
    this.label = scene.add
      .text(640, 662, 'DEBUG  HITBOX [RED]   HURTBOX [GREEN]   PUSHBOX [BLUE]   `  TO CLOSE', {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2)
      .setAlpha(0.7)
      .setDepth(81)
      .setVisible(false);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.label.setVisible(enabled);
    if (!enabled) {
      this.graphics.clear();
    }
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  update(fighters: readonly [Fighter, Fighter]): void {
    if (!this.enabled) {
      return;
    }

    const graphics = this.graphics;
    graphics.clear();

    graphics.lineStyle(1, COLORS.violet, 0.5);
    graphics.lineBetween(ARENA_BOUNDS.left, 200, ARENA_BOUNDS.left, ARENA_BOUNDS.groundY);
    graphics.lineBetween(ARENA_BOUNDS.right, 200, ARENA_BOUNDS.right, ARENA_BOUNDS.groundY);
    graphics.lineStyle(1, COLORS.line, 0.5);
    graphics.lineBetween(
      ARENA_BOUNDS.left,
      ARENA_BOUNDS.groundY,
      ARENA_BOUNDS.right,
      ARENA_BOUNDS.groundY,
    );

    for (const fighter of fighters) {
      const hurtbox = fighter.getHurtbox();
      const pushbox = fighter.getPushbox();

      this.drawBox(
        graphics,
        hurtbox.x,
        hurtbox.y,
        hurtbox.width,
        hurtbox.height,
        COLORS_DEBUG.hurtbox,
        0.1,
      );
      this.drawBox(
        graphics,
        pushbox.x,
        pushbox.y,
        pushbox.width,
        pushbox.height,
        COLORS_DEBUG.pushbox,
        0,
      );

      const attack = fighter.activeAttack;
      if (attack) {
        const attackBox = getAttackBox(fighter);
        if (attackBox) {
          const active = fighter.getAttackPhase() === 'ACTIVE';
          this.drawBox(
            graphics,
            attackBox.x,
            attackBox.y,
            attackBox.width,
            attackBox.height,
            COLORS_DEBUG.hitbox,
            active ? 0.2 : 0.04,
          );
        }
      }
    }
  }

  private drawBox(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    fillAlpha: number,
  ): void {
    if (fillAlpha > 0) {
      graphics.fillStyle(color, fillAlpha);
      graphics.fillRect(x, y, width, height);
    }
    graphics.lineStyle(1, color, 0.9);
    graphics.strokeRect(x, y, width, height);
  }
}

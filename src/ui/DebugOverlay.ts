import type Phaser from 'phaser';

import type { FighterAnimatorDebug } from '../animation/FighterAnimator';
import type { Projectile } from '../combat/ProjectileSystem';
import { ARENA_BOUNDS } from '../data/ArenaConfig';
import type { Fighter } from '../entities/Fighter';
import { getAttackBox } from '../combat/HitboxSystem';
import { COLORS, CSS_COLORS, FONTS } from './Theme';

const COLORS_DEBUG = {
  hitbox: 0xff3b4e,
  hurtbox: 0x46ff8c,
  pushbox: 0x4d8dff,
  projectile: 0xff4de0,
} as const;

export interface FighterDebugInfo extends FighterAnimatorDebug {
  readonly playerNumber: 1 | 2;
  readonly state: string;
  readonly attackId: string | null;
  readonly facing: 1 | -1;
  readonly velocityX: number;
  readonly velocityY: number;
}

/**
 * Development-only collision visualization. Draws on top of fighters, never
 * participates in collision and can be toggled without pausing the match.
 */
export class DebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly animLabel: Phaser.GameObjects.Text;
  private lastAnimSignature = '';
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

    this.animLabel = scene.add
      .text(20, 142, '', {
        fontFamily: FONTS.mono,
        fontSize: '10px',
        color: CSS_COLORS.muted,
        lineSpacing: 5,
        backgroundColor: 'rgba(4, 7, 12, 0.78)',
      })
      .setPadding(7, 6, 9, 6)
      .setAlpha(0.94)
      .setDepth(81)
      .setVisible(false);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.label.setVisible(enabled);
    this.animLabel.setVisible(enabled);
    if (!enabled) {
      this.graphics.clear();
      this.animLabel.setText('');
      this.lastAnimSignature = '';
    }
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  update(
    fighters: readonly [Fighter, Fighter],
    projectiles: readonly Projectile[] = [],
    animations: readonly FighterDebugInfo[] = [],
  ): void {
    if (!this.enabled) {
      return;
    }

    this.updateAnimationPanel(animations);

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

    for (const projectile of projectiles) {
      const definition = projectile.attack?.projectile;
      if (!projectile.active || !definition) {
        continue;
      }

      this.drawBox(
        graphics,
        projectile.x - definition.width / 2,
        projectile.y - definition.height / 2,
        definition.width,
        definition.height,
        COLORS_DEBUG.projectile,
        0.14,
      );
    }
  }

  private updateAnimationPanel(animations: readonly FighterDebugInfo[]): void {
    if (animations.length === 0) {
      return;
    }

    const lines = animations.map((info) => {
      const mode = info.loop ? 'LOOP' : info.complete ? 'DONE' : 'ONCE';
      const key = info.key.length > 24 ? `${info.key.slice(0, 23)}~` : info.key;
      return [
        `P${info.playerNumber} ${info.state.padEnd(14)} ANIM ${info.animation.padEnd(13)}`,
        `  ${String(info.priority).padStart(4)}  ${info.elapsedFrames}/${info.durationFrames} ${mode}`,
        `  F${info.facing > 0 ? '+' : '-'} VX ${Math.round(info.velocityX)} VY ${Math.round(info.velocityY)}`,
        `  ATK ${info.attackId ?? '-'}  KEY ${key}`,
      ].join('\n');
    });

    const text = `ANIMATION DEBUG\n${lines.join('\n')}`;
    if (text !== this.lastAnimSignature) {
      this.lastAnimSignature = text;
      this.animLabel.setText(text);
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

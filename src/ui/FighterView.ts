import Phaser from 'phaser';

import { ARENA_BOUNDS } from '../data/ArenaConfig';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import type { Fighter } from '../entities/Fighter';
import { ensureSoftGlowTexture } from './ProceduralTextures';
import { COLORS } from './Theme';

interface Point {
  readonly x: number;
  readonly y: number;
}

const OUTLINE = 0x05040a;
const BONE = 0xf3e9ef;
const GROUND_Y = ARENA_BOUNDS.groundY;

/**
 * Procedural humanoid fighter renderer. The simulation entity is untouched;
 * this view reads state, attack phase and timers each render frame, then draws
 * an animated silhouette with limbs, head, scarf and facing indicator.
 */
export class FighterView {
  private readonly fighter: Fighter;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly facingMarker: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Container;
  private readonly bodyGraphics: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Image;
  private flashRemainingMs = 0;

  constructor(scene: Phaser.Scene, fighter: Fighter) {
    this.fighter = fighter;
    ensureSoftGlowTexture(scene);

    this.shadow = scene.add.graphics().setDepth(8);
    this.facingMarker = scene.add.graphics().setDepth(9);

    this.aura = scene.add
      .image(0, -82, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(220, 280)
      .setTint(fighter.config.color)
      .setAlpha(0.1)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.bodyGraphics = scene.add.graphics();
    this.body = scene.add
      .container(fighter.x, fighter.y, [this.aura, this.bodyGraphics])
      .setDepth(10);
  }

  triggerHitFlash(): void {
    this.flashRemainingMs = 120;
  }

  update(deltaMs: number, elapsedSeconds: number): void {
    const fighter = this.fighter;
    this.flashRemainingMs = Math.max(0, this.flashRemainingMs - deltaMs);

    this.body.setPosition(fighter.x, fighter.y);
    this.body.setScale(fighter.facing, 1);

    const rotation = this.resolveBodyRotation();
    this.body.setRotation(rotation);
    this.body.setAlpha(fighter.isDefeated ? 0.82 : 1);

    const state = fighter.state;
    const attackView = fighter.getAttackView();
    const attacking = attackView !== null;
    const blocking = state === 'BLOCKING' || state === 'BLOCKSTUN';
    this.aura.setAlpha(
      fighter.isDefeated
        ? 0.04
        : blocking
          ? 0.15 + Math.sin(elapsedSeconds * 5) * 0.025
          : attacking
            ? 0.16 + Math.sin(elapsedSeconds * 8) * 0.02
            : fighter.isDodging
              ? 0.2
              : 0.09 + Math.sin(elapsedSeconds * 2.4 + fighter.playerNumber) * 0.02,
    );

    this.drawBody(elapsedSeconds);
    this.drawShadow();
    this.drawFacingMarker(state);
  }

  private resolveBodyRotation(): number {
    const fighter = this.fighter;

    if (fighter.isDefeated) {
      return -fighter.facing * 1.45;
    }

    if (fighter.state === 'KNOCKDOWN') {
      const duration = Math.max(1, fighter.stateDurationFrames);
      const elapsed = Phaser.Math.Clamp(duration - fighter.stateRemainingFrames, 0, duration);
      const progress = elapsed / duration;
      let fall = 1;
      if (progress < 0.3) {
        fall = progress / 0.3;
      } else if (progress > 0.75) {
        fall = (1 - progress) / 0.25;
      }
      return -fighter.facing * 1.15 * Phaser.Math.Clamp(fall, 0, 1);
    }

    if (fighter.state === 'HITSTUN') {
      return -fighter.facing * 0.12;
    }

    return 0;
  }

  private drawShadow(): void {
    const fighter = this.fighter;
    const heightAboveGround = Math.max(0, GROUND_Y - fighter.y);
    const scale = Phaser.Math.Clamp(1 - heightAboveGround / 420, 0.45, 1);

    this.shadow.clear();
    this.shadow.fillStyle(0x000000, 0.48 * scale);
    this.shadow.fillEllipse(fighter.x, GROUND_Y + 7, 86 * scale, 18 * scale);
    this.shadow.lineStyle(1, fighter.config.color, 0.3 * scale);
    this.shadow.strokeEllipse(fighter.x, GROUND_Y + 12, 54 * scale, 10 * scale);
  }

  private drawFacingMarker(state: string): void {
    this.facingMarker.clear();
    if (this.fighter.isDefeated) {
      return;
    }

    const color = this.flashRemainingMs > 0 ? BONE : this.fighter.config.color;
    const alpha =
      state === 'ATTACKING' || state === 'SPECIAL_ATTACK'
        ? 0.8
        : state === 'BLOCKING' || state === 'BLOCKSTUN'
          ? 0.7
          : 0.45;
    const direction = this.fighter.facing;
    const baseX = this.fighter.x + direction * 40;
    const baseY = GROUND_Y + 10;

    this.facingMarker.fillStyle(color, alpha);
    this.facingMarker.fillTriangle(
      baseX + direction * 12,
      baseY,
      baseX,
      baseY - 5,
      baseX,
      baseY + 5,
    );
    this.facingMarker.lineStyle(1, color, alpha * 0.7);
    this.facingMarker.lineBetween(
      this.fighter.x + direction * 18,
      baseY,
      baseX - direction * 2,
      baseY,
    );
  }

  private drawBody(elapsedSeconds: number): void {
    const graphics = this.bodyGraphics;
    const fighter = this.fighter;
    const state = fighter.state;
    const flash = this.flashRemainingMs > 0;

    const primary = flash ? BONE : fighter.config.color;
    const secondary = flash ? BONE : fighter.config.accentColor;
    const accent = flash ? BONE : COLORS.gold;

    const crouching = state === 'CROUCHING' || fighter.isCrouchBlocking;
    const airborne = !fighter.grounded && !fighter.isDefeated;
    const walking = state === 'WALKING';
    const attacking = state === 'ATTACKING' || state === 'SPECIAL_ATTACK';
    const blocking = state === 'BLOCKING' || state === 'BLOCKSTUN';
    const hitstun = state === 'HITSTUN';
    const defeated = fighter.isDefeated;

    const attackView = fighter.getAttackView();
    const heavy = attackView?.definition.category === 'HEAVY';
    const special = attackView?.definition.category === 'SPECIAL';
    let extension = 0;
    let startupProgress = 0;

    if (attackView) {
      if (attackView.phase === 'STARTUP') {
        extension = -0.32 * attackView.phaseProgress;
        startupProgress = attackView.phaseProgress;
      } else if (attackView.phase === 'ACTIVE') {
        extension = 1;
      } else if (attackView.phase === 'RECOVERY') {
        extension = 1 - attackView.phaseProgress;
      }
    }

    const lean = extension * (heavy ? 11 : 6);
    const bob =
      !crouching && !airborne && !attacking && !hitstun && !defeated && !blocking
        ? Math.sin(elapsedSeconds * 2.6 + fighter.playerNumber * 1.7) * 1.2
        : 0;

    const hipY = -68 + (crouching ? 18 : 0) + bob;
    const shoulderY = -116 + (crouching ? 34 : 0) + bob;
    const headY = -140 + (crouching ? 38 : 0) + bob;
    const headRadius = 15;
    const headX = lean * 0.7;
    const animPhase = elapsedSeconds * 11 + fighter.playerNumber * 0.8;

    graphics.clear();

    if (fighter.isDodging) {
      this.drawDodgeTrail(graphics);
    }

    this.drawScarf(graphics, shoulderY + 2, secondary, elapsedSeconds);

    const stride = walking ? Math.sin(animPhase) * 16 : 0;
    const liftBack = walking ? Math.max(0, Math.sin(animPhase)) * 7 : 0;
    const liftFront = walking ? Math.max(0, -Math.sin(animPhase)) * 7 : 0;

    let backFootX = -18 + stride;
    let frontFootX = 18 - stride;
    let backFootY = -liftBack;
    let frontFootY = -liftFront;
    let backKneeX = -15 + stride * 0.55;
    let frontKneeX = 14 - stride * 0.55;
    let backKneeY = -36;
    let frontKneeY = -36;

    if (airborne) {
      backFootX = -15;
      frontFootX = 15;
      backFootY = -18;
      frontFootY = -12;
      backKneeX = -18;
      frontKneeX = 12;
      backKneeY = -44;
      frontKneeY = -38;
    } else if (crouching) {
      backFootX = -30;
      frontFootX = 27;
      backFootY = 0;
      frontFootY = 0;
      backKneeX = -30;
      frontKneeX = 24;
      backKneeY = -26;
      frontKneeY = -26;
    } else if (attacking) {
      backFootX = -22 - extension * 4;
      frontFootX = 20 + extension * (heavy ? 16 : 9);
      backKneeY = -38;
      frontKneeY = -34;
    } else if (blocking) {
      backFootX = -20;
      frontFootX = 18;
      backKneeX = -20;
      frontKneeX = 16;
      backKneeY = -34;
      frontKneeY = -32;
    } else if (hitstun) {
      backFootX = -24;
      frontFootX = 14;
      backKneeX = -18;
      frontKneeX = 12;
    } else if (defeated) {
      backFootX = -18;
      frontFootX = 16;
      backKneeY = -30;
      frontKneeY = -30;
    }

    this.drawLimb(
      graphics,
      [
        { x: -9, y: hipY + 2 },
        { x: backKneeX, y: backKneeY },
        { x: backFootX, y: backFootY },
      ],
      secondary,
      9,
    );

    this.drawLimb(
      graphics,
      [
        { x: 11, y: hipY + 2 },
        { x: frontKneeX, y: frontKneeY },
        { x: frontFootX, y: frontFootY },
      ],
      primary,
      10,
    );

    if (!blocking) {
      this.drawBackArm(graphics, shoulderY, secondary, heavy, extension);
    }

    const hipLeft = -14 + lean;
    const hipRight = 16 + lean;
    const torsoPoints: Point[] = [
      { x: -23 + lean, y: shoulderY + 8 },
      { x: 22 + lean, y: shoulderY + 8 },
      { x: hipRight, y: hipY + 2 },
      { x: hipLeft, y: hipY + 2 },
    ];

    this.drawTorso(graphics, torsoPoints, secondary, primary);

    graphics.fillStyle(0x05040a, 1);
    graphics.fillCircle(headX, headY, headRadius + 3);
    graphics.fillStyle(primary, 1);
    graphics.fillCircle(headX, headY, headRadius);

    graphics.fillStyle(secondary, 1);
    graphics.fillTriangle(
      headX - headRadius + 4,
      headY - 9,
      headX - headRadius - 12,
      headY - 2,
      headX - headRadius + 5,
      headY + 4,
    );
    graphics.fillTriangle(
      headX - headRadius + 7,
      headY + 3,
      headX - headRadius - 8,
      headY + 12,
      headX - headRadius + 8,
      headY + 11,
    );

    graphics.lineStyle(6, 0x090610, 0.95);
    graphics.lineBetween(headX - 12, headY - 1, headX + 13, headY - 1);
    graphics.lineStyle(3, flash ? BONE : COLORS.gold, 0.95);
    graphics.lineBetween(headX + 5, headY - 2, headX + 12, headY - 2);
    graphics.fillStyle(BONE, 0.9);
    graphics.fillCircle(headX + 9, headY - 2, 1.6);

    if (blocking) {
      this.drawGuardArms(graphics, shoulderY, primary, secondary, accent);
    } else {
      this.drawFrontArm(
        graphics,
        shoulderY,
        primary,
        secondary,
        accent,
        heavy,
        extension,
        startupProgress,
        attacking,
        hitstun,
      );
    }

    if (attacking && attackView) {
      this.drawAttackEffect(
        graphics,
        shoulderY,
        heavy || special,
        extension,
        startupProgress,
        attackView.phase,
        accent,
      );
    }

    if (crouching) {
      graphics.lineStyle(2, primary, 0.5);
      graphics.lineBetween(-24, -4, 24, -4);
    }

    if (fighter.isDefeated) {
      graphics.lineStyle(2, BONE, 0.5);
      graphics.lineBetween(headX + 5, headY - 4, headX + 10, headY + 1);
      graphics.lineBetween(headX + 10, headY - 4, headX + 5, headY + 1);
    }
  }

  private drawScarf(
    graphics: Phaser.GameObjects.Graphics,
    neckY: number,
    color: number,
    elapsedSeconds: number,
  ): void {
    for (let tail = 0; tail < 2; tail += 1) {
      const wave = Math.sin(elapsedSeconds * 4.6 + tail * 1.4) * 5;
      const wave2 = Math.sin(elapsedSeconds * 3.7 + tail * 2.1 + 1) * 4;
      graphics.lineStyle(5, OUTLINE, 0.9);
      graphics.beginPath();
      graphics.moveTo(-4, neckY + tail * 4);
      graphics.lineTo(-22, neckY + 4 + tail * 6 + wave);
      graphics.lineTo(-42, neckY + 12 + tail * 7 + wave2);
      graphics.lineTo(-58 + tail * 4, neckY + 6 + tail * 8 - wave);
      graphics.strokePath();

      graphics.lineStyle(2.5, color, 0.9);
      graphics.beginPath();
      graphics.moveTo(-4, neckY + tail * 4);
      graphics.lineTo(-22, neckY + 4 + tail * 6 + wave);
      graphics.lineTo(-42, neckY + 12 + tail * 7 + wave2);
      graphics.lineTo(-58 + tail * 4, neckY + 6 + tail * 8 - wave);
      graphics.strokePath();
    }
  }

  private drawTorso(
    graphics: Phaser.GameObjects.Graphics,
    points: Point[],
    fill: number,
    accent: number,
  ): void {
    graphics.fillStyle(OUTLINE, 1);
    graphics.fillPoints(points, true);
    graphics.lineStyle(5, OUTLINE, 1);
    graphics.strokePoints(points, true);

    const inset = 3;
    const center = points.reduce(
      (accumulator, point) => ({
        x: accumulator.x + point.x / points.length,
        y: accumulator.y + point.y / points.length,
      }),
      { x: 0, y: 0 },
    );
    const inner = points.map((point) => ({
      x: point.x + (center.x - point.x) * (inset / 20),
      y: point.y + (center.y - point.y) * (inset / 20),
    }));

    graphics.fillStyle(fill, 1);
    graphics.fillPoints(inner, true);

    graphics.lineStyle(2, accent, 0.55);
    graphics.lineBetween(center.x - 13, center.y - 6, center.x + 14, center.y - 6);
    graphics.fillStyle(accent, 0.4);
    graphics.fillCircle(center.x, center.y, 4);
  }

  private drawBackArm(
    graphics: Phaser.GameObjects.Graphics,
    shoulderY: number,
    color: number,
    heavy: boolean,
    extension: number,
  ): void {
    const pullBack = heavy ? extension * 8 : extension * 4;
    this.drawLimb(
      graphics,
      [
        { x: -12, y: shoulderY + 4 },
        { x: -25 - pullBack, y: shoulderY + 26 },
        { x: -12 - pullBack, y: shoulderY + 12 },
      ],
      color,
      8,
    );
  }

  private drawFrontArm(
    graphics: Phaser.GameObjects.Graphics,
    shoulderY: number,
    primary: number,
    secondary: number,
    accent: number,
    heavy: boolean,
    extension: number,
    startupProgress: number,
    attacking: boolean,
    hitstun: boolean,
  ): void {
    const shoulder: Point = { x: 12, y: shoulderY + 4 };
    const guardElbow: Point = { x: 20, y: shoulderY + 25 };
    const guardFist: Point = { x: 15, y: shoulderY + 7 };

    const reach = heavy ? 68 : 52;
    const clampedExtension = Phaser.Math.Clamp(extension, -0.32, 1);
    const fist: { x: number; y: number } = {
      x: guardFist.x + reach * clampedExtension,
      y: guardFist.y - 4 * clampedExtension,
    };
    const elbow: { x: number; y: number } = {
      x: guardElbow.x + reach * 0.48 * clampedExtension,
      y: guardElbow.y - 8 * clampedExtension,
    };

    if (hitstun) {
      fist.y -= 14;
      fist.x -= 8;
      elbow.x -= 4;
    }

    this.drawLimb(graphics, [shoulder, elbow, fist], primary, 9);

    if (attacking && startupProgress > 0) {
      const chargeRadius = 6 + startupProgress * 9;
      graphics.fillStyle(accent, 0.16 + startupProgress * 0.24);
      graphics.fillCircle(fist.x, fist.y, chargeRadius + 6);
      graphics.fillStyle(BONE, 0.5 + startupProgress * 0.4);
      graphics.fillCircle(fist.x, fist.y, chargeRadius * 0.44);
    }

    const fistRadius = heavy ? 8 : 6;
    graphics.fillStyle(OUTLINE, 1);
    graphics.fillCircle(fist.x, fist.y, fistRadius + 2);
    graphics.fillStyle(BONE, 0.92);
    graphics.fillCircle(fist.x, fist.y, fistRadius);

    if (extension > 0.6) {
      graphics.lineStyle(2, secondary, 0.55);
      graphics.lineBetween(fist.x - 16, fist.y + 7, fist.x - 4, fist.y + 3);
      graphics.lineStyle(1, secondary, 0.4);
      graphics.lineBetween(fist.x - 20, fist.y - 6, fist.x - 7, fist.y - 3);
    }
  }

  private drawAttackEffect(
    graphics: Phaser.GameObjects.Graphics,
    shoulderY: number,
    heavy: boolean,
    extension: number,
    startupProgress: number,
    phase: string,
    accent: number,
  ): void {
    if (phase === 'ACTIVE' && extension > 0.4) {
      graphics.lineStyle(heavy ? 4 : 2, accent, heavy ? 0.65 : 0.45);
      graphics.beginPath();
      graphics.arc(
        16,
        shoulderY + 10,
        heavy ? 76 : 56,
        Phaser.Math.DegToRad(-42),
        Phaser.Math.DegToRad(30),
        false,
      );
      graphics.strokePath();

      if (heavy) {
        graphics.lineStyle(2, BONE, 0.55);
        graphics.beginPath();
        graphics.arc(
          16,
          shoulderY + 10,
          62,
          Phaser.Math.DegToRad(-36),
          Phaser.Math.DegToRad(24),
          false,
        );
        graphics.strokePath();
      }
    }

    if (phase === 'STARTUP' && heavy) {
      graphics.lineStyle(2, accent, 0.2 + startupProgress * 0.5);
      graphics.strokeCircle(15, shoulderY + 7, 12 + startupProgress * 12);
    }
  }

  private drawGuardArms(
    graphics: Phaser.GameObjects.Graphics,
    shoulderY: number,
    primary: number,
    secondary: number,
    accent: number,
  ): void {
    this.drawLimb(
      graphics,
      [
        { x: -10, y: shoulderY + 5 },
        { x: 8, y: shoulderY + 22 },
        { x: 26, y: shoulderY + 2 },
      ],
      secondary,
      8,
    );
    this.drawLimb(
      graphics,
      [
        { x: 12, y: shoulderY + 4 },
        { x: 22, y: shoulderY + 24 },
        { x: 8, y: shoulderY + 8 },
      ],
      primary,
      9,
    );

    graphics.fillStyle(accent, 0.3);
    graphics.fillCircle(24, shoulderY + 6, 7);
    graphics.lineStyle(2, accent, 0.55);
    graphics.beginPath();
    graphics.arc(14, shoulderY + 12, 34, -1.05, 0.55, false);
    graphics.strokePath();
  }

  private drawDodgeTrail(graphics: Phaser.GameObjects.Graphics): void {
    const fighter = this.fighter;
    const duration = Math.max(1, fighter.stateDurationFrames);
    const progress = Phaser.Math.Clamp(1 - fighter.stateRemainingFrames / duration, 0, 1);
    const worldOffset = -fighter.currentDodgeDirection * (24 + progress * 54);
    const localOffset = worldOffset * fighter.facing;
    const color = fighter.config.color;

    for (let ghost = 1; ghost <= 3; ghost += 1) {
      const x = localOffset * (ghost / 3);
      const alpha = 0.16 - ghost * 0.035;

      graphics.fillStyle(color, alpha);
      graphics.fillCircle(x, -138, 13);
      graphics.fillRect(x - 13, -124, 26, 52);
      graphics.fillRect(x - 12, -74, 10, 62);
      graphics.fillRect(x + 3, -74, 10, 58);
    }
  }

  private drawLimb(
    graphics: Phaser.GameObjects.Graphics,
    points: readonly Point[],
    color: number,
    width: number,
  ): void {
    graphics.lineStyle(width + 3, OUTLINE, 1);
    this.tracePath(graphics, points);

    graphics.lineStyle(width, color, 1);
    this.tracePath(graphics, points);

    for (const point of points) {
      graphics.fillStyle(OUTLINE, 1);
      graphics.fillCircle(point.x, point.y, width / 2 + 1.5);
      graphics.fillStyle(color, 1);
      graphics.fillCircle(point.x, point.y, width / 2);
    }
  }

  private tracePath(graphics: Phaser.GameObjects.Graphics, points: readonly Point[]): void {
    const first = points[0];
    if (!first) {
      return;
    }

    graphics.beginPath();
    graphics.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      if (point) {
        graphics.lineTo(point.x, point.y);
      }
    }
    graphics.strokePath();
  }
}

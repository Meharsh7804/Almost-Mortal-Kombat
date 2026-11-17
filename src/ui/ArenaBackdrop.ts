import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../core/GameConfig';
import { ARENA_BOUNDS } from '../data/ArenaConfig';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import { ensureMenuTextures } from './ProceduralTextures';
import { COLORS, CSS_COLORS, FONTS } from './Theme';

const GROUND_Y = ARENA_BOUNDS.groundY;

const DEPTH = {
  sky: -100,
  glows: -94,
  gate: -88,
  ring: -84,
  wall: -80,
  wallDetails: -76,
  floor: -72,
  floorDetails: -70,
  labels: -66,
  dust: -60,
  scanlines: 58,
  vignette: 59,
  frame: 60,
} as const;

/**
 * Procedural training arena: dark layered walls, a rift gate, side banners,
 * paneled floor, boundary energy and subtle atmosphere. Everything is drawn
 * with Phaser primitives and generated textures; no external art is used.
 */
export class ArenaBackdrop {
  private readonly scene: Phaser.Scene;
  private readonly archGlow: Phaser.GameObjects.Image;
  private readonly leftGlow: Phaser.GameObjects.Image;
  private readonly rightGlow: Phaser.GameObjects.Image;
  private readonly riftRing: Phaser.GameObjects.Graphics;
  private readonly boundaryPulse: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureMenuTextures(scene);

    this.buildSky();
    this.leftGlow = this.addGlow(300, 500, 620, 560, COLORS.cyanDeep, 0.2);
    this.rightGlow = this.addGlow(980, 500, 620, 560, COLORS.emberOrangeDeep, 0.2);
    this.archGlow = this.addGlow(640, 392, 540, 520, COLORS.violet, 0.18);

    this.buildGate();
    this.riftRing = this.buildRiftRing();
    this.buildWalls();
    this.buildFloor();
    this.buildAtmosphere();
    this.boundaryPulse = this.buildBoundaryPulse();
  }

  update(elapsedSeconds: number): void {
    this.riftRing.rotation = elapsedSeconds * 0.05;
    this.archGlow.setAlpha(0.16 + Math.sin(elapsedSeconds * 0.9) * 0.035);
    this.leftGlow.setAlpha(0.18 + Math.sin(elapsedSeconds * 0.7 + 0.4) * 0.03);
    this.rightGlow.setAlpha(0.18 + Math.sin(elapsedSeconds * 0.62 + 2.2) * 0.03);
    this.boundaryPulse.setAlpha(0.7 + Math.sin(elapsedSeconds * 2.4) * 0.2);
  }

  private buildSky(): void {
    const sky = this.scene.add.graphics().setDepth(DEPTH.sky);
    sky.fillGradientStyle(0x05040a, 0x07060d, 0x160c1d, 0x0b0711, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GROUND_Y);

    sky.fillStyle(0x1c0f24, 0.55);
    sky.fillTriangle(0, 0, 360, 0, 0, 260);
    sky.fillTriangle(GAME_WIDTH, 0, GAME_WIDTH - 400, 0, GAME_WIDTH, 300);

    sky.lineStyle(1, COLORS.violetDeep, 0.28);
    sky.lineBetween(0, 180, GAME_WIDTH, 120);
    sky.lineStyle(1, COLORS.crimsonDeep, 0.2);
    sky.lineBetween(0, 208, GAME_WIDTH, 148);
  }

  private addGlow(
    x: number,
    y: number,
    width: number,
    height: number,
    tint: number,
    alpha: number,
  ): Phaser.GameObjects.Image {
    return this.scene.add
      .image(x, y, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(width, height)
      .setTint(tint)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glows);
  }

  private buildGate(): void {
    const gate = this.scene.add.graphics().setDepth(DEPTH.gate);

    gate.fillStyle(0x0a0710, 1);
    gate.fillRect(456, 238, 54, GROUND_Y - 238);
    gate.fillRect(770, 238, 54, GROUND_Y - 238);
    gate.fillRect(456, 210, 368, 46);

    gate.fillStyle(0x120a18, 1);
    gate.fillRect(510, 262, 40, GROUND_Y - 262);
    gate.fillRect(730, 262, 40, GROUND_Y - 262);
    gate.fillRect(510, 262, 260, 34);

    gate.fillGradientStyle(0x341442, 0x43132c, 0x0a0712, 0x0a0712, 0.55, 0.55, 0.9, 0.9);
    gate.fillRect(550, 296, 180, GROUND_Y - 296);

    gate.lineStyle(2, COLORS.violet, 0.32);
    gate.lineBetween(550, 296, 550, GROUND_Y);
    gate.lineBetween(730, 296, 730, GROUND_Y);
    gate.lineBetween(550, 296, 730, 296);

    gate.lineStyle(1, COLORS.crimson, 0.4);
    gate.lineBetween(456, 236, 510, 236);
    gate.lineBetween(770, 236, 824, 236);
    gate.lineBetween(456, 238, 456, GROUND_Y);
    gate.lineBetween(824, 238, 824, GROUND_Y);

    gate.fillStyle(COLORS.cyan, 0.5);
    gate.fillTriangle(566, 420, 566, 430, 574, 425);
    gate.fillStyle(COLORS.emberOrange, 0.5);
    gate.fillTriangle(714, 420, 714, 430, 706, 425);

    gate.fillStyle(0x1f1027, 1);
    gate.fillRect(496, 520, 288, 10);
    gate.fillStyle(COLORS.violetDeep, 0.8);
    gate.fillRect(496, 520, 288, 2);

    const riftCore = this.scene.add.graphics().setDepth(DEPTH.gate + 1);
    riftCore.fillGradientStyle(
      0xffffff,
      COLORS.violet,
      COLORS.crimsonDeep,
      0x0a0712,
      0.28,
      0.1,
      0.02,
      0.6,
    );
    riftCore.fillRect(612, 320, 56, GROUND_Y - 320);
    riftCore.fillStyle(0xffffff, 0.22);
    riftCore.fillRect(634, 330, 12, GROUND_Y - 330);
  }

  private buildRiftRing(): Phaser.GameObjects.Graphics {
    const ring = this.scene.add.graphics({ x: 640, y: 368 }).setDepth(DEPTH.ring);

    ring.lineStyle(1, COLORS.violet, 0.32);
    ring.strokeCircle(0, 0, 112);
    ring.lineStyle(1, COLORS.crimson, 0.22);
    ring.strokeCircle(0, 0, 132);

    for (let index = 0; index < 24; index += 1) {
      const angle = (index / 24) * Math.PI * 2;
      const inner = index % 3 === 0 ? 104 : 118;
      const outer = index % 3 === 0 ? 122 : 126;
      ring.lineStyle(1, index % 3 === 0 ? COLORS.crimson : COLORS.violet, 0.3);
      ring.lineBetween(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer,
      );
    }

    ring.lineStyle(2, COLORS.violet, 0.24);
    ring.beginPath();
    ring.arc(0, 0, 92, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
    ring.strokePath();
    ring.lineStyle(2, COLORS.crimson, 0.18);
    ring.beginPath();
    ring.arc(0, 0, 92, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    ring.strokePath();

    return ring;
  }

  private buildWalls(): void {
    const wall = this.scene.add.graphics().setDepth(DEPTH.wall);

    wall.fillStyle(0x0b0811, 0.92);
    wall.fillRect(0, 408, GAME_WIDTH, GROUND_Y - 408);

    wall.lineStyle(1, 0x2c1933, 0.65);
    for (let x = 32; x < GAME_WIDTH; x += 96) {
      wall.lineBetween(x, 408, x, GROUND_Y);
    }
    wall.lineStyle(1, 0x2a172f, 0.55);
    wall.lineBetween(0, 458, GAME_WIDTH, 458);
    wall.lineBetween(0, 516, GAME_WIDTH, 516);
    wall.lineBetween(0, 566, GAME_WIDTH, 566);

    const details = this.scene.add.graphics().setDepth(DEPTH.wallDetails);

    this.drawPillar(details, 118, 150, 64, GROUND_Y - 150, COLORS.cyan);
    this.drawPillar(details, 1098, 150, 64, GROUND_Y - 150, COLORS.emberOrange);

    this.drawBanner(details, 236, 262, 78, 170, COLORS.cyan, COLORS.cyanDeep);
    this.drawBanner(details, 1044, 262, 78, 170, COLORS.emberOrange, COLORS.emberOrangeDeep);

    details.lineStyle(1, COLORS.line, 0.45);
    details.lineBetween(64, 108, 300, 108);
    details.lineBetween(GAME_WIDTH - 64, 108, GAME_WIDTH - 300, 108);

    for (let index = 0; index < 5; index += 1) {
      const x = 336 + index * 152;
      details.lineStyle(1, COLORS.violetDeep, 0.3);
      details.strokeRect(x, 372, 22, 22);
      details.lineBetween(x + 6, 383, x + 16, 383);
    }

    this.scene.add
      .text(GAME_WIDTH / 2, 550, 'RIFT TRAINING GROUND // SECTOR 07', {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(5)
      .setAlpha(0.32)
      .setDepth(DEPTH.labels);

    this.scene.add
      .text(64, 420, 'P1 // RIFT SIDE', {
        fontFamily: FONTS.mono,
        fontSize: '8px',
        color: CSS_COLORS.muted,
      })
      .setLetterSpacing(3)
      .setAlpha(0.26)
      .setDepth(DEPTH.labels);

    this.scene.add
      .text(GAME_WIDTH - 64, 420, 'P2 // EMBER SIDE', {
        fontFamily: FONTS.mono,
        fontSize: '8px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(1, 0)
      .setLetterSpacing(3)
      .setAlpha(0.26)
      .setDepth(DEPTH.labels);
  }

  private drawPillar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    accent: number,
  ): void {
    graphics.fillStyle(0x120a18, 1);
    graphics.fillRect(x, y, width, height);
    graphics.fillStyle(0x1e1026, 1);
    graphics.fillRect(x + 8, y + 18, width - 16, height - 18);
    graphics.fillStyle(0x090610, 1);
    graphics.fillRect(x - 8, y - 14, width + 16, 20);
    graphics.fillRect(x - 8, y + height - 12, width + 16, 16);

    graphics.lineStyle(1, accent, 0.35);
    graphics.lineBetween(x + 8, y + 18, x + 8, y + height - 12);
    graphics.lineBetween(x + width - 8, y + 18, x + width - 8, y + height - 12);
    graphics.lineStyle(1, COLORS.line, 0.4);
    graphics.lineBetween(x - 8, y - 4, x + width + 8, y - 4);
    graphics.lineBetween(x - 8, y + height - 22, x + width + 8, y + height - 22);
  }

  private drawBanner(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    accent: number,
    deep: number,
  ): void {
    const half = width / 2;
    graphics.fillStyle(0x07050c, 1);
    graphics.fillRect(x - half - 8, y - 8, width + 16, 8);

    graphics.fillStyle(deep, 0.92);
    graphics.beginPath();
    graphics.moveTo(x - half, y);
    graphics.lineTo(x + half, y);
    graphics.lineTo(x + half - 6, y + height);
    graphics.lineTo(x, y + height - 26);
    graphics.lineTo(x - half + 6, y + height);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(accent, 0.16);
    graphics.fillRect(x - half + 7, y + 12, width - 14, height - 50);

    graphics.lineStyle(1, accent, 0.55);
    graphics.lineBetween(x - half, y, x + half, y);
    graphics.lineBetween(x - half, y, x - half + 6, y + height);
    graphics.lineBetween(x + half, y, x + half - 6, y + height);

    graphics.lineStyle(2, accent, 0.7);
    graphics.strokeCircle(x, y + 64, 20);
    graphics.strokeCircle(x, y + 64, 13);
    graphics.lineBetween(x - 20, y + 64, x + 20, y + 64);
    graphics.lineBetween(x, y + 44, x, y + 84);
    graphics.fillStyle(accent, 0.8);
    graphics.fillCircle(x, y + 64, 3);
  }

  private buildFloor(): void {
    const floor = this.scene.add.graphics().setDepth(DEPTH.floor);

    floor.fillGradientStyle(0x120b18, 0x120b18, 0x050409, 0x050409, 1);
    floor.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

    floor.fillStyle(0x1b1023, 1);
    floor.fillRect(
      ARENA_BOUNDS.left - 24,
      GROUND_Y,
      ARENA_BOUNDS.right - ARENA_BOUNDS.left + 48,
      22,
    );

    floor.fillGradientStyle(0x34213e, 0x2b1a35, 0x0d0813, 0x0d0813, 1);
    floor.fillRect(ARENA_BOUNDS.left, GROUND_Y + 4, ARENA_BOUNDS.right - ARENA_BOUNDS.left, 20);

    const details = this.scene.add.graphics().setDepth(DEPTH.floorDetails);

    details.lineStyle(2, COLORS.bone, 0.58);
    details.lineBetween(ARENA_BOUNDS.left, GROUND_Y, ARENA_BOUNDS.right, GROUND_Y);
    details.lineStyle(1, COLORS.cyan, 0.5);
    details.lineBetween(ARENA_BOUNDS.left, GROUND_Y + 1, ARENA_BOUNDS.left + 210, GROUND_Y + 1);
    details.lineStyle(1, COLORS.emberOrange, 0.5);
    details.lineBetween(ARENA_BOUNDS.right, GROUND_Y + 1, ARENA_BOUNDS.right - 210, GROUND_Y + 1);

    details.lineStyle(1, 0x2c1b35, 0.6);
    for (let x = ARENA_BOUNDS.left + 64; x < ARENA_BOUNDS.right; x += 80) {
      details.lineBetween(x, GROUND_Y + 24, x - 14, GAME_HEIGHT);
    }
    details.lineBetween(ARENA_BOUNDS.left, GROUND_Y + 44, ARENA_BOUNDS.right, GROUND_Y + 44);
    details.lineBetween(ARENA_BOUNDS.left, GROUND_Y + 84, ARENA_BOUNDS.right, GROUND_Y + 84);
    details.lineStyle(1, 0x180f1f, 0.9);
    details.lineBetween(0, GAME_HEIGHT - 26, GAME_WIDTH, GAME_HEIGHT - 26);

    details.lineStyle(1, COLORS.violet, 0.24);
    details.strokeEllipse(640, GROUND_Y + 62, 520, 118);
    details.strokeEllipse(640, GROUND_Y + 62, 380, 82);
    details.lineStyle(1, COLORS.cyan, 0.2);
    details.beginPath();
    details.arc(
      640,
      GROUND_Y + 62,
      240,
      Phaser.Math.DegToRad(198),
      Phaser.Math.DegToRad(252),
      false,
    );
    details.strokePath();
    details.lineStyle(1, COLORS.crimson, 0.18);
    details.beginPath();
    details.arc(
      640,
      GROUND_Y + 62,
      240,
      Phaser.Math.DegToRad(288),
      Phaser.Math.DegToRad(342),
      false,
    );
    details.strokePath();
    details.lineStyle(1, COLORS.gold, 0.28);
    details.lineBetween(640, GROUND_Y + 18, 640, GROUND_Y + 108);

    this.scene.add
      .image(ARENA_BOUNDS.left, 520, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(140, 600)
      .setTint(COLORS.cyan)
      .setAlpha(0.12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.floorDetails);

    this.scene.add
      .image(ARENA_BOUNDS.right, 520, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(140, 600)
      .setTint(COLORS.emberOrange)
      .setAlpha(0.12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.floorDetails);
  }

  private buildBoundaryPulse(): Phaser.GameObjects.Graphics {
    const pulse = this.scene.add.graphics().setDepth(DEPTH.floorDetails + 1);

    for (const side of [ARENA_BOUNDS.left, ARENA_BOUNDS.right] as const) {
      const color = side === ARENA_BOUNDS.left ? COLORS.cyan : COLORS.emberOrange;
      pulse.lineStyle(2, color, 0.5);
      for (let y = 384; y < GROUND_Y; y += 26) {
        pulse.lineBetween(side, y, side, y + 10);
      }
      pulse.lineStyle(1, color, 0.22);
      pulse.lineBetween(side, 384, side, GROUND_Y);
    }

    return pulse;
  }

  private buildAtmosphere(): void {
    this.scene.add
      .particles(0, 0, TEXTURE_KEYS.ember, {
        x: { min: -20, max: GAME_WIDTH + 20 },
        y: { min: 380, max: GAME_HEIGHT - 40 },
        lifespan: { min: 5200, max: 9000 },
        speedX: { min: -12, max: 18 },
        speedY: { min: -30, max: -10 },
        scale: { start: 0.22, end: 0.02 },
        alpha: { start: 0.26, end: 0 },
        tint: [COLORS.violet, COLORS.cyan, COLORS.crimson],
        frequency: 280,
        quantity: 1,
        maxAliveParticles: 36,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.dust);

    this.scene.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURE_KEYS.scanlines)
      .setAlpha(0.1)
      .setDepth(DEPTH.scanlines);

    this.scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEXTURE_KEYS.vignette)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.8)
      .setDepth(DEPTH.vignette);

    const frame = this.scene.add.graphics().setDepth(DEPTH.frame);
    const inset = 18;
    const length = 46;
    frame.lineStyle(1, COLORS.line, 0.5);
    frame.lineBetween(inset, inset, inset + length, inset);
    frame.lineBetween(inset, inset, inset, inset + length);
    frame.lineBetween(GAME_WIDTH - inset, inset, GAME_WIDTH - inset - length, inset);
    frame.lineBetween(GAME_WIDTH - inset, inset, GAME_WIDTH - inset, inset + length);
    frame.lineBetween(inset, GAME_HEIGHT - inset, inset + length, GAME_HEIGHT - inset);
    frame.lineBetween(inset, GAME_HEIGHT - inset, inset, GAME_HEIGHT - inset - length);
    frame.lineBetween(
      GAME_WIDTH - inset,
      GAME_HEIGHT - inset,
      GAME_WIDTH - inset - length,
      GAME_HEIGHT - inset,
    );
    frame.lineBetween(
      GAME_WIDTH - inset,
      GAME_HEIGHT - inset,
      GAME_WIDTH - inset,
      GAME_HEIGHT - inset - length,
    );
  }
}

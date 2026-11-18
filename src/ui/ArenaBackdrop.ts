import Phaser from 'phaser';

import type { ArenaDefinition } from '../data/ArenaRegistry';
import { ARENA_BOUNDS } from '../data/ArenaConfig';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/GameConfig';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import { ensureMenuTextures } from './ProceduralTextures';
import { CSS_COLORS, FONTS } from './Theme';

const GROUND_Y = ARENA_BOUNDS.groundY;

const DEPTH = {
  sky: -100,
  glows: -94,
  back: -90,
  mid: -84,
  front: -78,
  floor: -72,
  floorDetails: -70,
  labels: -66,
  particles: -60,
  scanlines: 58,
  vignette: 59,
  frame: 60,
} as const;

/* color/alpha utilities reserved for future arena theme extensions */

export class ArenaBackdrop {
  private readonly scene: Phaser.Scene;
  private readonly arena: ArenaDefinition;
  private readonly archGlow: Phaser.GameObjects.Image;
  private readonly leftGlow: Phaser.GameObjects.Image;
  private readonly rightGlow: Phaser.GameObjects.Image;
  private readonly boundaryPulse: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, arena: ArenaDefinition) {
    this.scene = scene;
    this.arena = arena;

    ensureMenuTextures(scene);
    this.buildSky();
    this.buildBackLayer();
    this.buildMidLayer();
    this.buildFrontLayer();
    this.buildFloor();
    this.archGlow = this.buildArchGlow();
    this.leftGlow = this.buildSideGlow(ARENA_BOUNDS.left, arena.theme.accentA);
    this.rightGlow = this.buildSideGlow(ARENA_BOUNDS.right, arena.theme.accentB);
    this.boundaryPulse = this.buildBoundaryPulse();
    this.buildAtmosphere();
  }

  update(elapsedSeconds: number): void {
    const pulse = 0.84 + Math.sin(elapsedSeconds * 2.2) * 0.16;
    this.archGlow.setAlpha((this.arena.lighting.rimAlpha + 0.14) * pulse);
    this.leftGlow.setAlpha((this.arena.lighting.keyAlpha + 0.08) * (0.88 + Math.sin(elapsedSeconds * 1.8) * 0.12));
    this.rightGlow.setAlpha((this.arena.lighting.keyAlpha + 0.08) * (0.88 + Math.cos(elapsedSeconds * 1.7) * 0.12));
    this.boundaryPulse.setAlpha(0.18 + Math.sin(elapsedSeconds * 3.2) * 0.1);
  }

  destroy(): void {
    // Scene owns game objects; no explicit teardown required beyond scene lifecycle.
  }

  private buildSky(): void {
    const { theme } = this.arena;
    const sky = this.scene.add.graphics().setDepth(DEPTH.sky);
    sky.fillGradientStyle(theme.skyTop, theme.skyTop, theme.skyBottom, theme.skyBottom, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    sky.fillStyle(theme.horizon, 0.5);
    sky.fillTriangle(0, GROUND_Y - 120, GAME_WIDTH * 0.28, 160, GAME_WIDTH * 0.42, GROUND_Y - 120);
    sky.fillTriangle(GAME_WIDTH, GROUND_Y - 120, GAME_WIDTH * 0.72, 150, GAME_WIDTH * 0.56, GROUND_Y - 120);
    sky.fillStyle(theme.haze, 0.12);
    sky.fillEllipse(GAME_WIDTH / 2, GROUND_Y - 40, GAME_WIDTH * 0.9, 220);
  }

  private buildArchGlow(): Phaser.GameObjects.Image {
    return this.scene.add
      .image(GAME_WIDTH / 2, 250, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(900, 520)
      .setTint(this.arena.lighting.rimTint)
      .setAlpha(this.arena.lighting.rimAlpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glows);
  }

  private buildSideGlow(x: number, tint: number): Phaser.GameObjects.Image {
    return this.scene.add
      .image(x, 470, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(420, 520)
      .setTint(tint)
      .setAlpha(this.arena.lighting.keyAlpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glows);
  }

  private buildBackLayer(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.back);
    const { theme } = this.arena;
    g.fillGradientStyle(theme.wallTop, theme.wallTop, theme.wallBottom, theme.wallBottom, 1);
    g.fillRect(0, 70, GAME_WIDTH, GROUND_Y - 70);

    // Simple horizontal bands for depth
    g.fillStyle(theme.accentC, 0.06);
    for (let y = 120; y < GROUND_Y - 40; y += 54) {
      g.fillRect(40, y, GAME_WIDTH - 80, 2);
    }

    if (theme.motif === 'neon') {
      this.drawNeonBack(g);
    } else if (theme.motif === 'reactor') {
      this.drawReactorBack(g);
    } else if (theme.motif === 'frost') {
      this.drawFrostBack(g);
    } else {
      this.drawTempleBack(g);
    }
  }

  private buildMidLayer(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.mid);
    const { theme } = this.arena;

    if (theme.motif === 'neon') {
      this.drawNeonMid(g);
    } else if (theme.motif === 'reactor') {
      this.drawReactorMid(g);
    } else if (theme.motif === 'frost') {
      this.drawFrostMid(g);
    } else {
      this.drawTempleMid(g);
    }
  }

  private buildFrontLayer(): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.front);
    const { theme } = this.arena;

    if (theme.motif === 'neon') {
      this.drawNeonFront(g);
    } else if (theme.motif === 'reactor') {
      this.drawReactorFront(g);
    } else if (theme.motif === 'frost') {
      this.drawFrostFront(g);
    } else {
      this.drawTempleFront(g);
    }
  }

  private drawTempleBack(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    g.lineStyle(2, theme.accentC, 0.2);
    g.strokeRoundedRect(GAME_WIDTH / 2 - 220, 110, 440, 360, 120);
    g.strokeRoundedRect(GAME_WIDTH / 2 - 150, 150, 300, 280, 90);
    g.fillStyle(theme.accentB, 0.08);
    g.fillEllipse(GAME_WIDTH / 2, 250, 180, 260);
  }

  private drawTempleMid(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    this.drawPillar(g, 170, 170, 70, GROUND_Y - 170, theme.accentA, theme.wallTop);
    this.drawPillar(g, 1040, 170, 70, GROUND_Y - 170, theme.accentA, theme.wallTop);
    this.drawBanner(g, 260, 260, 80, 170, theme.accentB, theme.accentA);
    this.drawBanner(g, 940, 260, 80, 170, theme.accentB, theme.accentA);
  }

  private drawTempleFront(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    g.lineStyle(1, theme.frame, 0.5);
    g.lineBetween(80, 118, 320, 118);
    g.lineBetween(GAME_WIDTH - 80, 118, GAME_WIDTH - 320, 118);
    g.fillStyle(theme.accentA, 0.12);
    g.fillCircle(GAME_WIDTH / 2, 132, 18);
    g.lineStyle(2, theme.accentA, 0.4);
    g.strokeCircle(GAME_WIDTH / 2, 132, 18);
  }

  private drawNeonBack(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    for (let i = 0; i < 8; i += 1) {
      const x = 80 + i * 150;
      const h = 180 + (i % 3) * 70;
      g.fillStyle(theme.wallTop, 0.9);
      g.fillRect(x, GROUND_Y - h, 90, h);
      g.lineStyle(2, i % 2 === 0 ? theme.accentA : theme.accentB, 0.25);
      g.strokeRect(x, GROUND_Y - h, 90, h);
    }
  }

  private drawNeonMid(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    g.lineStyle(3, theme.accentA, 0.35);
    g.lineBetween(120, 180, 420, 180);
    g.lineBetween(860, 220, 1160, 220);
    g.lineStyle(3, theme.accentB, 0.35);
    g.lineBetween(420, 180, 520, 300);
    g.lineBetween(760, 300, 860, 220);
    for (const x of [220, 360, 920, 1060]) {
      g.fillStyle(theme.accentC, 0.08);
      g.fillRect(x - 20, 260, 40, 140);
      g.lineStyle(1, theme.accentA, 0.4);
      g.strokeRect(x - 20, 260, 40, 140);
    }
  }

  private drawNeonFront(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    g.lineStyle(2, theme.accentA, 0.3);
    g.strokeRoundedRect(GAME_WIDTH / 2 - 260, 110, 520, 40, 8);
    g.lineStyle(2, theme.accentB, 0.25);
    g.strokeRoundedRect(GAME_WIDTH / 2 - 220, 125, 440, 10, 4);
  }

  private drawReactorBack(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    g.lineStyle(3, theme.accentA, 0.25);
    g.strokeCircle(GAME_WIDTH / 2, 230, 140);
    g.strokeCircle(GAME_WIDTH / 2, 230, 200);
    g.lineStyle(1, theme.accentB, 0.2);
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      g.lineBetween(GAME_WIDTH / 2 + Math.cos(a) * 140, 230 + Math.sin(a) * 140, GAME_WIDTH / 2 + Math.cos(a) * 200, 230 + Math.sin(a) * 200);
    }
  }

  private drawReactorMid(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    this.drawPillar(g, 180, 220, 60, GROUND_Y - 220, theme.accentB, theme.wallTop);
    this.drawPillar(g, 1040, 220, 60, GROUND_Y - 220, theme.accentB, theme.wallTop);
    g.lineStyle(2, theme.accentA, 0.35);
    g.strokeRect(GAME_WIDTH / 2 - 170, 330, 340, 80);
    g.lineStyle(1, theme.accentC, 0.25);
    g.lineBetween(GAME_WIDTH / 2 - 170, 370, GAME_WIDTH / 2 + 170, 370);
  }

  private drawReactorFront(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    g.fillStyle(theme.accentA, 0.12);
    g.fillRect(120, 150, 160, 10);
    g.fillRect(GAME_WIDTH - 280, 150, 160, 10);
    g.lineStyle(1, theme.frame, 0.5);
    g.lineBetween(120, 150, 280, 150);
    g.lineBetween(GAME_WIDTH - 280, 150, GAME_WIDTH - 120, 150);
  }

  private drawFrostBack(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    g.fillStyle(theme.haze, 0.08);
    g.fillEllipse(GAME_WIDTH / 2, 220, 520, 260);
    for (let i = 0; i < 6; i += 1) {
      const x = 160 + i * 190;
      g.lineStyle(2, theme.accentB, 0.18);
      g.lineBetween(x, GROUND_Y - 60, x + 30, 180 + (i % 2) * 40);
      g.lineBetween(x + 30, 180 + (i % 2) * 40, x + 60, GROUND_Y - 80);
    }
  }

  private drawFrostMid(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    this.drawPillar(g, 150, 190, 55, GROUND_Y - 190, theme.accentA, theme.wallTop);
    this.drawPillar(g, 1075, 190, 55, GROUND_Y - 190, theme.accentA, theme.wallTop);
    g.fillStyle(theme.accentB, 0.08);
    g.fillTriangle(GAME_WIDTH / 2 - 70, GROUND_Y - 30, GAME_WIDTH / 2, 200, GAME_WIDTH / 2 + 70, GROUND_Y - 30);
    g.lineStyle(1, theme.accentC, 0.35);
    g.strokeTriangle(GAME_WIDTH / 2 - 70, GROUND_Y - 30, GAME_WIDTH / 2, 200, GAME_WIDTH / 2 + 70, GROUND_Y - 30);
  }

  private drawFrostFront(g: Phaser.GameObjects.Graphics): void {
    const { theme } = this.arena;
    g.lineStyle(1, theme.accentB, 0.35);
    g.lineBetween(90, 140, 330, 140);
    g.lineBetween(GAME_WIDTH - 330, 140, GAME_WIDTH - 90, 140);
    g.fillStyle(theme.accentA, 0.15);
    g.fillCircle(GAME_WIDTH / 2, 140, 10);
  }

  private buildFloor(): void {
    const { theme } = this.arena;
    const floor = this.scene.add.graphics().setDepth(DEPTH.floor);
    floor.fillGradientStyle(theme.floorTop, theme.floorTop, theme.floorBottom, theme.floorBottom, 1);
    floor.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    floor.fillStyle(theme.frame, 0.7);
    floor.fillRect(ARENA_BOUNDS.left - 24, GROUND_Y, ARENA_BOUNDS.right - ARENA_BOUNDS.left + 48, 20);

    const details = this.scene.add.graphics().setDepth(DEPTH.floorDetails);
    details.lineStyle(2, theme.accentC, 0.45);
    details.lineBetween(ARENA_BOUNDS.left, GROUND_Y, ARENA_BOUNDS.right, GROUND_Y);
    details.lineStyle(1, theme.accentA, 0.35);
    details.lineBetween(ARENA_BOUNDS.left, GROUND_Y + 1, ARENA_BOUNDS.left + 220, GROUND_Y + 1);
    details.lineStyle(1, theme.accentB, 0.35);
    details.lineBetween(ARENA_BOUNDS.right, GROUND_Y + 1, ARENA_BOUNDS.right - 220, GROUND_Y + 1);
    details.lineStyle(1, theme.frame, 0.25);
    for (let x = ARENA_BOUNDS.left + 70; x < ARENA_BOUNDS.right; x += 90) {
      details.lineBetween(x, GROUND_Y + 24, x - 16, GAME_HEIGHT);
    }
    details.strokeEllipse(GAME_WIDTH / 2, GROUND_Y + 64, 520, 116);
    details.strokeEllipse(GAME_WIDTH / 2, GROUND_Y + 64, 360, 82);

    this.scene.add
      .text(GAME_WIDTH / 2, 552, `${this.arena.name.toUpperCase()} // ${this.arena.id.toUpperCase()}`, {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setAlpha(0.28)
      .setDepth(DEPTH.labels);
  }

  private buildBoundaryPulse(): Phaser.GameObjects.Graphics {
    const pulse = this.scene.add.graphics().setDepth(DEPTH.floorDetails + 1);
    for (const side of [ARENA_BOUNDS.left, ARENA_BOUNDS.right] as const) {
      const color = side === ARENA_BOUNDS.left ? this.arena.theme.accentA : this.arena.theme.accentB;
      pulse.lineStyle(2, color, 0.45);
      for (let y = 390; y < GROUND_Y; y += 28) {
        pulse.lineBetween(side, y, side, y + 10);
      }
    }
    return pulse;
  }

  private buildAtmosphere(): void {
    const { atmosphere } = this.arena;
    this.scene.add
      .particles(0, 0, TEXTURE_KEYS.ember, {
        x: { min: -20, max: GAME_WIDTH + 20 },
        y: { min: 360, max: GAME_HEIGHT - 30 },
        lifespan: { min: 4200, max: 8600 },
        speedX: { min: -14, max: 18 },
        speedY: { min: -28, max: -8 },
        scale: { start: 0.22, end: 0.02 },
        alpha: { start: atmosphere.particleAlpha, end: 0 },
        tint: [atmosphere.particleTintA, atmosphere.particleTintB, atmosphere.particleTintC],
        frequency: 260,
        quantity: 1,
        maxAliveParticles: 34,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.particles);

    this.scene.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURE_KEYS.scanlines)
      .setAlpha(atmosphere.scanlineAlpha)
      .setDepth(DEPTH.scanlines);

    this.scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEXTURE_KEYS.vignette)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(atmosphere.vignetteAlpha)
      .setDepth(DEPTH.vignette);

    const frame = this.scene.add.graphics().setDepth(DEPTH.frame);
    const inset = 18;
    const length = 46;
    frame.lineStyle(1, this.arena.theme.frame, 0.5);
    frame.lineBetween(inset, inset, inset + length, inset);
    frame.lineBetween(inset, inset, inset, inset + length);
    frame.lineBetween(GAME_WIDTH - inset, inset, GAME_WIDTH - inset - length, inset);
    frame.lineBetween(GAME_WIDTH - inset, inset, GAME_WIDTH - inset, inset + length);
    frame.lineBetween(inset, GAME_HEIGHT - inset, inset + length, GAME_HEIGHT - inset);
    frame.lineBetween(inset, GAME_HEIGHT - inset, inset, GAME_HEIGHT - inset - length);
    frame.lineBetween(GAME_WIDTH - inset, GAME_HEIGHT - inset, GAME_WIDTH - inset - length, GAME_HEIGHT - inset);
    frame.lineBetween(GAME_WIDTH - inset, GAME_HEIGHT - inset, GAME_WIDTH - inset, GAME_HEIGHT - inset - length);
  }

  private drawPillar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    accent: number,
    fill: number,
  ): void {
    graphics.fillStyle(fill, 0.95);
    graphics.fillRect(x, y, width, height);
    graphics.fillStyle(0x000000, 0.18);
    graphics.fillRect(x + 8, y + 16, width - 16, height - 16);
    graphics.lineStyle(1, accent, 0.4);
    graphics.strokeRect(x, y, width, height);
    graphics.lineBetween(x, y + 18, x + width, y + 18);
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
    graphics.fillStyle(deep, 0.85);
    graphics.beginPath();
    graphics.moveTo(x - half, y);
    graphics.lineTo(x + half, y);
    graphics.lineTo(x + half - 6, y + height);
    graphics.lineTo(x, y + height - 24);
    graphics.lineTo(x - half + 6, y + height);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(1, accent, 0.5);
    graphics.strokePath();
  }
}

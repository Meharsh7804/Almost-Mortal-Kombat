import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_VERSION, GAME_WIDTH } from '../core/GameConfig';
import { FIXED_TIMESTEP_HZ } from '../core/GameLoop';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import { ensureMenuTextures } from './ProceduralTextures';
import { COLORS, CSS_COLORS, FONTS } from './Theme';

const TAU = Math.PI * 2;

const DEPTH = {
  base: -100,
  facets: -96,
  glow: -94,
  ring: -88,
  halftone: -82,
  particles: -74,
  scanlines: -68,
  vignette: -60,
  frame: -52,
} as const;

/**
 * Static atmosphere for the menu: procedural glow fields, a rift sigil,
 * drifting embers, vignette and screen framing. All animation is driven by the
 * fixed-timestep elapsed clock passed into `update`.
 */
export class MenuBackdrop {
  private readonly scene: Phaser.Scene;
  private readonly sigil: Phaser.GameObjects.Graphics;
  private readonly halftone: Phaser.GameObjects.TileSprite;
  private readonly violetGlow: Phaser.GameObjects.Image;
  private readonly crimsonGlow: Phaser.GameObjects.Image;
  private readonly lowerGlow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureMenuTextures(scene);

    scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.background, 1)
      .setOrigin(0)
      .setDepth(DEPTH.base);

    this.addFacets();

    this.violetGlow = scene.add
      .image(318, 330, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(1100, 1080)
      .setTint(COLORS.violetDeep)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow);

    this.crimsonGlow = scene.add
      .image(1005, 250, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(920, 860)
      .setTint(COLORS.crimsonDeep)
      .setAlpha(0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow);

    scene.add
      .image(640, 290, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(680, 440)
      .setTint(COLORS.violet)
      .setAlpha(0.12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow);

    this.lowerGlow = scene.add
      .image(640, 792, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(1360, 560)
      .setTint(COLORS.crimsonDeep)
      .setAlpha(0.34)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow);

    this.sigil = this.createSigil();
    this.halftone = this.createHalftone();
    this.createEmbers();
    this.createScanlines();
    this.createVignette();
    this.createFrame();
  }

  update(elapsedSeconds: number): void {
    this.sigil.rotation = elapsedSeconds * 0.018;
    this.halftone.tilePositionX = elapsedSeconds * 5;
    this.halftone.tilePositionY = elapsedSeconds * -2.4;

    this.violetGlow.setAlpha(0.55 + Math.sin(elapsedSeconds * 0.6) * 0.045);
    this.crimsonGlow.setAlpha(0.42 + Math.sin(elapsedSeconds * 0.83 + 1.3) * 0.04);
    this.lowerGlow.setAlpha(0.34 + Math.sin(elapsedSeconds * 0.47 + 2.1) * 0.03);
  }

  private addFacets(): void {
    const facets = this.scene.add.graphics().setDepth(DEPTH.facets);

    facets.fillStyle(COLORS.violetDeep, 0.08);
    facets.fillTriangle(GAME_WIDTH, 0, GAME_WIDTH, 320, 930, 0);

    facets.fillStyle(COLORS.crimsonDeep, 0.06);
    facets.fillTriangle(0, GAME_HEIGHT, 0, 430, 360, GAME_HEIGHT);

    facets.lineStyle(1, COLORS.line, 0.22);
    facets.lineBetween(92, 640, 1192, 78);
    facets.lineStyle(1, COLORS.violetDeep, 0.35);
    facets.lineBetween(140, 676, 1210, 120);
  }

  private createSigil(): Phaser.GameObjects.Graphics {
    const sigil = this.scene.add.graphics({ x: GAME_WIDTH / 2, y: 298 }).setDepth(DEPTH.ring);

    sigil.lineStyle(1, COLORS.violet, 0.17);
    sigil.strokeCircle(0, 0, 236);

    sigil.lineStyle(1, COLORS.line, 0.35);
    sigil.strokeCircle(0, 0, 252);

    sigil.lineStyle(1, COLORS.crimson, 0.1);
    sigil.strokeCircle(0, 0, 308);

    for (let index = 0; index < 72; index += 1) {
      const angle = (index / 72) * TAU;
      const isMajor = index % 9 === 0;
      const innerRadius = 266;
      const outerRadius = isMajor ? 286 : 276;
      sigil.lineStyle(1, isMajor ? COLORS.crimson : COLORS.violet, isMajor ? 0.3 : 0.13);
      sigil.lineBetween(
        Math.cos(angle) * innerRadius,
        Math.sin(angle) * innerRadius,
        Math.cos(angle) * outerRadius,
        Math.sin(angle) * outerRadius,
      );
    }

    sigil.lineStyle(2, COLORS.violet, 0.18);
    sigil.beginPath();
    sigil.arc(0, 0, 220, Phaser.Math.DegToRad(206), Phaser.Math.DegToRad(318), false);
    sigil.strokePath();

    sigil.lineStyle(2, COLORS.crimson, 0.14);
    sigil.beginPath();
    sigil.arc(0, 0, 220, Phaser.Math.DegToRad(26), Phaser.Math.DegToRad(142), false);
    sigil.strokePath();

    return sigil;
  }

  private createHalftone(): Phaser.GameObjects.TileSprite {
    return this.scene.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURE_KEYS.halftone)
      .setTint(COLORS.violet)
      .setAlpha(0.07)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.halftone);
  }

  private createEmbers(): void {
    this.scene.add
      .particles(0, 0, TEXTURE_KEYS.ember, {
        x: { min: -40, max: GAME_WIDTH + 40 },
        y: { min: GAME_HEIGHT * 0.32, max: GAME_HEIGHT + 60 },
        lifespan: { min: 5600, max: 11000 },
        speedX: { min: -14, max: 14 },
        speedY: { min: -44, max: -18 },
        scale: { start: 0.42, end: 0.05 },
        alpha: { start: 0.48, end: 0 },
        tint: [COLORS.crimson, COLORS.violet, COLORS.ember],
        frequency: 240,
        quantity: 1,
        maxAliveParticles: 48,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.particles);
  }

  private createScanlines(): void {
    this.scene.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURE_KEYS.scanlines)
      .setAlpha(0.42)
      .setDepth(DEPTH.scanlines);
  }

  private createVignette(): void {
    this.scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEXTURE_KEYS.vignette)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTH.vignette);
  }

  private createFrame(): void {
    const inset = 26;
    const length = 62;
    const frame = this.scene.add.graphics().setDepth(DEPTH.frame);

    frame.lineStyle(1, COLORS.line, 0.55);
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

    frame.lineStyle(2, COLORS.crimson, 0.5);
    frame.lineBetween(inset, inset, inset + 22, inset);
    frame.lineBetween(
      GAME_WIDTH - inset,
      GAME_HEIGHT - inset,
      GAME_WIDTH - inset - 22,
      GAME_HEIGHT - inset,
    );

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONTS.mono,
      fontSize: '9px',
      color: CSS_COLORS.muted,
    };
    const labelAlpha = 0.42;

    this.scene.add
      .text(50, 44, 'RIFT PROTOCOL // ONLINE', labelStyle)
      .setLetterSpacing(2)
      .setAlpha(labelAlpha)
      .setDepth(DEPTH.frame);

    this.scene.add
      .text(GAME_WIDTH - 50, 44, 'BUILD // RELEASE', labelStyle)
      .setOrigin(1, 0)
      .setLetterSpacing(2)
      .setAlpha(labelAlpha)
      .setDepth(DEPTH.frame);

    this.scene.add
      .text(50, GAME_HEIGHT - 44, `SIMULATION ${FIXED_TIMESTEP_HZ} HZ`, labelStyle)
      .setOrigin(0, 1)
      .setLetterSpacing(2)
      .setAlpha(labelAlpha)
      .setDepth(DEPTH.frame);

    this.scene.add
      .text(GAME_WIDTH - 50, GAME_HEIGHT - 44, `RIFTBOUND v${GAME_VERSION}`, labelStyle)
      .setOrigin(1, 1)
      .setLetterSpacing(2)
      .setAlpha(labelAlpha)
      .setDepth(DEPTH.frame);
  }
}

import type Phaser from 'phaser';

import type { FighterPose } from '../../animation/ProceduralPose';
import type { CharacterVisualConfig } from '../../data/CharacterVisuals';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface PartPalette {
  readonly outline: number;
  readonly primary: number;
  readonly secondary: number;
  readonly accent: number;
  readonly skin: number;
  readonly hair: number;
  readonly wrap: number;
  readonly boot: number;
  readonly pants: number;
  readonly torso: number;
  readonly trim: number;
  readonly glove: number;
}

interface PartPair {
  readonly base: Phaser.GameObjects.Graphics;
  readonly flash: Phaser.GameObjects.Graphics;
}

interface ArmRig {
  readonly shoulder: Phaser.GameObjects.Container;
  readonly elbow: Phaser.GameObjects.Container;
  readonly hand: Phaser.GameObjects.Container;
}

interface LegRig {
  readonly hip: Phaser.GameObjects.Container;
  readonly knee: Phaser.GameObjects.Container;
  readonly ankle: Phaser.GameObjects.Container;
}

type DrawPart = (graphics: Phaser.GameObjects.Graphics, palette: PartPalette) => void;

const DEPTH = 10;
const FLASH_PALETTE: PartPalette = Object.freeze({
  outline: 0xffffff,
  primary: 0xffffff,
  secondary: 0xffffff,
  accent: 0xffffff,
  skin: 0xffffff,
  hair: 0xffffff,
  wrap: 0xffffff,
  boot: 0xffffff,
  pants: 0xffffff,
  torso: 0xffffff,
  trim: 0xffffff,
  glove: 0xffffff,
});

/**
 * Layered procedural fighter rig. Every limb is a container hierarchy with its
 * own pivot, so joint rotations and translations can be animated independently
 * from the combat simulation. The rig also keeps a white duplicate of each
 * part that is toggled for short hit flashes.
 */
export class FighterRig {
  readonly root: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly config: CharacterVisualConfig;
  private readonly palette: PartPalette;
  private readonly flip: Phaser.GameObjects.Container;
  private readonly poseRoot: Phaser.GameObjects.Container;
  private readonly torso: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Container;
  private readonly hair: Phaser.GameObjects.Container;
  private readonly scarf: Phaser.GameObjects.Container;
  private readonly headbandTails: Phaser.GameObjects.Container;
  private readonly backArm: ArmRig;
  private readonly frontArm: ArmRig;
  private readonly backLeg: LegRig;
  private readonly frontLeg: LegRig;
  private readonly parts: PartPair[] = [];
  private flashActive = false;

  constructor(scene: Phaser.Scene, config: CharacterVisualConfig) {
    this.scene = scene;
    this.config = config;
    this.palette = createPalette(config);

    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    this.flip = scene.add.container(0, 0);
    this.poseRoot = scene.add.container(0, 0);
    this.root.add(this.flip);
    this.flip.add(this.poseRoot);

    this.backLeg = this.createLeg(true);
    this.torso = scene.add.container(0, 0);
    this.scarf = scene.add.container(0, 0);
    this.torso.add(this.scarf);
    this.backArm = this.createArm(true);
    this.frontArm = this.createArm(false);
    this.head = scene.add.container(0, 0);
    this.hair = scene.add.container(0, 0);
    this.headbandTails = scene.add.container(0, 0);

    this.createTorsoPart();
    this.createHeadParts();
    this.torso.add([this.backArm.shoulder, this.head, this.frontArm.shoulder]);
    this.poseRoot.add([this.backLeg.hip, this.torso]);
    this.frontLeg = this.createLeg(false);
    this.poseRoot.add(this.frontLeg.hip);

    this.drawScarf();
    this.drawHeadbandTails();
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  setFacing(facing: 1 | -1): void {
    this.flip.setScale(facing, 1);
  }

  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
  }

  setFlash(active: boolean): void {
    if (active === this.flashActive) {
      return;
    }

    this.flashActive = active;
    for (const part of this.parts) {
      part.base.setVisible(!active);
      part.flash.setVisible(active);
    }
  }

  applyPose(pose: FighterPose): void {
    const build = this.config.build;
    const hipY = -build.hipHeight + pose.hipOffsetY;

    this.poseRoot.setPosition(pose.bodyOffsetX, pose.bodyOffsetY);

    this.torso.setPosition(pose.hipOffsetX, hipY);
    this.torso.setRotation(pose.torsoRotation);

    this.backLeg.hip.setPosition(-build.hipSpread + pose.hipOffsetX, hipY);
    this.backLeg.hip.setRotation(pose.backHipAngle);
    this.backLeg.knee.setRotation(pose.backKneeAngle);
    this.backLeg.ankle.setRotation(pose.backFootAngle);

    this.frontLeg.hip.setPosition(build.hipSpread + pose.hipOffsetX, hipY);
    this.frontLeg.hip.setRotation(pose.frontHipAngle);
    this.frontLeg.knee.setRotation(pose.frontKneeAngle);
    this.frontLeg.ankle.setRotation(pose.frontFootAngle);

    this.head.setPosition(
      pose.headOffsetX,
      -build.torsoLength + pose.headOffsetY,
    );
    this.head.setRotation(pose.headRotation);

    this.hair.setRotation(pose.hairSway);
    this.scarf.setRotation(pose.scarfSway);
    this.headbandTails.setRotation(pose.hairSway * 0.6 + pose.scarfSway * 0.4);

    const shoulderHalf = build.shoulderWidth / 2 - 2;
    this.backArm.shoulder.setPosition(-shoulderHalf, -build.torsoLength + 5);
    this.frontArm.shoulder.setPosition(shoulderHalf, -build.torsoLength + 5);

    this.applyArm(this.backArm, pose.backShoulderAngle, pose.backElbowAngle, pose.backHandAngle);
    this.applyArm(
      this.frontArm,
      pose.frontShoulderAngle,
      pose.frontElbowAngle,
      pose.frontHandAngle,
    );
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private applyArm(arm: ArmRig, shoulder: number, elbow: number, hand: number): void {
    arm.shoulder.setRotation(shoulder);
    arm.elbow.setRotation(elbow);
    arm.hand.setRotation(hand);
  }

  private createLeg(back: boolean): LegRig {
    const build = this.config.build;
    const shade = back ? 0.72 : 1;
    const hip = this.scene.add.container(0, 0);
    const knee = this.scene.add.container(0, build.upperLegLength);
    const ankle = this.scene.add.container(0, build.lowerLegLength);

    this.addPart(hip, (graphics, palette) => {
      drawLimbSegment(
        graphics,
        build.upperLegLength,
        build.limbWidth * 1.05,
        shadeColor(palette.pants, shade),
        palette.outline,
      );
      graphics.fillStyle(palette.trim, 0.65);
      graphics.fillCircle(0, build.upperLegLength - 3, 2.2);
    });

    this.addPart(knee, (graphics, palette) => {
      drawLimbSegment(
        graphics,
        build.lowerLegLength,
        build.limbWidth * 0.9,
        shadeColor(palette.pants, shade * 0.88),
        palette.outline,
      );
      graphics.lineStyle(2, palette.trim, 0.5);
      graphics.lineBetween(-3, 6, 3, 6);
    });

    this.addPart(ankle, (graphics, palette) => {
      drawFoot(graphics, build.footLength, shadeColor(palette.boot, shade), palette);
    });

    knee.add(ankle);
    hip.add(knee);
    return { hip, knee, ankle };
  }

  private createArm(back: boolean): ArmRig {
    const build = this.config.build;
    const shade = back ? 0.7 : 1;
    const shoulder = this.scene.add.container(0, 0);
    const elbow = this.scene.add.container(0, build.upperArmLength);
    const hand = this.scene.add.container(0, build.forearmLength);

    this.addPart(shoulder, (graphics, palette) => {
      drawLimbSegment(
        graphics,
        build.upperArmLength,
        build.limbWidth * 0.85,
        shadeColor(palette.torso, shade),
        palette.outline,
      );
      graphics.lineStyle(2, palette.trim, 0.62);
      graphics.lineBetween(-2, build.upperArmLength - 5, 3, build.upperArmLength - 2);
    });

    this.addPart(elbow, (graphics, palette) => {
      drawLimbSegment(
        graphics,
        build.forearmLength,
        build.limbWidth * 0.68,
        shadeColor(palette.skin, shade),
        palette.outline,
      );
      graphics.lineStyle(3, shadeColor(palette.wrap, shade), 0.9);
      graphics.lineBetween(-4, 4, 4, 4);
      graphics.lineBetween(-4, 8, 4, 8);
    });

    this.addPart(hand, (graphics, palette) => {
      drawHand(graphics, build.limbWidth * 0.68, shadeColor(palette.glove, shade), palette);
    });

    elbow.add(hand);
    shoulder.add(elbow);
    return { shoulder, elbow, hand };
  }

  private createTorsoPart(): void {
    const build = this.config.build;
    const outline = this.palette.outline;

    this.addPart(this.torso, (graphics, palette) => {
      const topHalf = build.shoulderWidth / 2;
      const bottomHalf = build.waistWidth / 2;
      const points: Point[] = [
        { x: -topHalf, y: -build.torsoLength },
        { x: topHalf, y: -build.torsoLength },
        { x: bottomHalf + 1, y: -6 },
        { x: -bottomHalf - 1, y: -6 },
      ];

      graphics.fillStyle(outline, 1);
      graphics.fillPoints(points, true);
      graphics.lineStyle(4, outline, 1);
      graphics.strokePoints(points, true);

      const inner: Point[] = [
        { x: -topHalf + 3, y: -build.torsoLength + 3 },
        { x: topHalf - 3, y: -build.torsoLength + 3 },
        { x: bottomHalf - 2, y: -8 },
        { x: -bottomHalf + 2, y: -8 },
      ];
      graphics.fillStyle(palette.torso, 1);
      graphics.fillPoints(inner, true);

      if (this.config.outfit.style === 'gi') {
        graphics.fillStyle(palette.trim, 0.22);
        graphics.fillTriangle(
          -topHalf + 5,
          -build.torsoLength + 4,
          0,
          -build.torsoLength + 20,
          -1,
          -8,
        );
        graphics.lineStyle(2, palette.trim, 0.85);
        graphics.lineBetween(-topHalf + 6, -build.torsoLength + 5, 1, -6);
        graphics.lineBetween(topHalf - 6, -build.torsoLength + 5, 3, -8);
        graphics.lineStyle(1, palette.trim, 0.35);
        graphics.lineBetween(-bottomHalf + 2, -18, bottomHalf - 2, -18);
      } else {
        graphics.fillStyle(palette.primary, 0.3);
        graphics.fillTriangle(
          -bottomHalf,
          -10,
          bottomHalf,
          -18,
          topHalf - 4,
          -build.torsoLength + 5,
        );
        graphics.lineStyle(1, palette.accent, 0.75);
        graphics.lineBetween(-bottomHalf + 3, -20, bottomHalf - 4, -26);
        graphics.fillStyle(palette.accent, 0.85);
        graphics.fillCircle(0, -build.torsoLength * 0.58, 2.4);
      }

      graphics.fillStyle(palette.accent, 0.9);
      graphics.fillRect(-bottomHalf - 1, -9, bottomHalf * 2 + 2, 5);
      graphics.fillStyle(outline, 0.6);
      graphics.fillRect(-4, -9.5, 8, 6);
      graphics.fillStyle(palette.accent, 0.8);
      graphics.fillCircle(0, -6.5, 1.8);

      graphics.fillStyle(palette.skin, 1);
      graphics.fillRect(-4, -build.torsoLength - 6, 8, 9);
      graphics.lineStyle(2, outline, 1);
      graphics.strokeRect(-4, -build.torsoLength - 6, 8, 9);
    });
  }

  private createHeadParts(): void {
    const build = this.config.build;
    const radius = build.headRadius;
    const outline = this.palette.outline;

    this.addPart(this.head, (graphics, palette) => {
      graphics.fillStyle(outline, 1);
      graphics.fillCircle(0, -radius, radius + 3);
      graphics.fillStyle(palette.skin, 1);
      graphics.fillCircle(0, -radius, radius);

      graphics.fillStyle(shadeColor(palette.skin, 0.84), 0.9);
      graphics.fillEllipse(0, -radius * 0.55, radius * 1.2, radius * 0.7);

      graphics.lineStyle(2, outline, 0.95);
      graphics.lineBetween(radius * 0.2, -radius * 1.15, radius * 0.7, -radius * 1.12);
      graphics.fillStyle(0xffffff, 0.92);
      graphics.fillCircle(radius * 0.52, -radius * 1.12, 1.6);
      graphics.fillStyle(palette.accent, 0.9);
      graphics.fillCircle(radius * 0.52, -radius * 1.12, 0.8);

      graphics.lineStyle(1, outline, 0.65);
      graphics.lineBetween(radius * 0.25, -radius * 0.55, radius * 0.62, -radius * 0.48);
    });

    this.addPart(this.hair, (graphics, palette) => {
      if (this.config.hairStyle === 'spiked') {
        graphics.fillStyle(palette.hair, 1);
        graphics.fillTriangle(-radius * 0.9, -radius * 0.85, -radius * 1.5, -radius * 1.9, -radius * 0.2, -radius * 1.3);
        graphics.fillTriangle(-radius * 0.55, -radius * 1.25, -radius * 0.5, -radius * 2.3, radius * 0.15, -radius * 1.45);
        graphics.fillTriangle(radius * 0.15, -radius * 1.35, radius * 0.55, -radius * 2.05, radius * 0.9, -radius * 1.1);
        graphics.fillEllipse(0, -radius * 1.42, radius * 2, radius * 1.05);
        graphics.fillStyle(shadeColor(palette.hair, 1.35), 0.42);
        graphics.fillTriangle(-radius * 0.4, -radius * 1.85, 0, -radius * 2.15, radius * 0.2, -radius * 1.65);
      } else {
        graphics.fillStyle(palette.hair, 1);
        graphics.fillEllipse(0, -radius * 1.42, radius * 2.02, radius * 1.1);
        graphics.fillTriangle(
          -radius * 0.9,
          -radius * 1.2,
          -radius * 1.3,
          -radius * 0.5,
          -radius * 0.45,
          -radius * 0.5,
        );
      }

      if (this.config.headAccessory === 'headband') {
        graphics.lineStyle(4, palette.accent, 0.95);
        graphics.lineBetween(-radius * 0.85, -radius * 1.25, radius * 0.82, -radius * 1.25);
        graphics.lineStyle(1, outline, 0.8);
        graphics.lineBetween(-radius * 0.85, -radius * 1.4, radius * 0.82, -radius * 1.4);
      }
    });

    this.head.add([this.hair, this.headbandTails]);
    this.head.setPosition(0, -build.torsoLength);
  }

  private drawScarf(): void {
    const build = this.config.build;
    const style = this.config.sash;
    if (style === 'none') {
      return;
    }

    const scarfStartY = style === 'scarf' ? -build.torsoLength + 3 : -5;
    this.scarf.setPosition(0, scarfStartY);

    this.addPart(this.scarf, (graphics, palette) => {
      const color = style === 'scarf' ? palette.primary : palette.accent;
      const length = style === 'scarf' ? 1 : 0.55;

      graphics.lineStyle(9, palette.outline, 0.95);
      traceScarf(graphics, length);
      graphics.lineStyle(5.5, color, 0.92);
      traceScarf(graphics, length);

      graphics.lineStyle(2.4, palette.trim, 0.65);
      graphics.beginPath();
      graphics.moveTo(-8, 7);
      graphics.lineTo(-24 * length, 17);
      graphics.lineTo(-43 * length, 14);
      graphics.strokePath();
    });
  }

  private drawHeadbandTails(): void {
    if (this.config.headAccessory !== 'headband') {
      return;
    }

    const radius = this.config.build.headRadius;
    this.headbandTails.setPosition(-radius * 0.8, -radius * 1.15);

    this.addPart(this.headbandTails, (graphics, palette) => {
      graphics.lineStyle(4, palette.outline, 0.95);
      graphics.beginPath();
      graphics.moveTo(0, 0);
      graphics.lineTo(-11, 7);
      graphics.lineTo(-22, 5);
      graphics.strokePath();
      graphics.lineStyle(2, palette.accent, 0.95);
      graphics.beginPath();
      graphics.moveTo(0, 0);
      graphics.lineTo(-11, 7);
      graphics.lineTo(-22, 5);
      graphics.strokePath();

      graphics.lineStyle(3, palette.outline, 0.9);
      graphics.beginPath();
      graphics.moveTo(0, 2);
      graphics.lineTo(-9, 12);
      graphics.lineTo(-17, 16);
      graphics.strokePath();
      graphics.lineStyle(1.6, palette.accent, 0.8);
      graphics.beginPath();
      graphics.moveTo(0, 2);
      graphics.lineTo(-9, 12);
      graphics.lineTo(-17, 16);
      graphics.strokePath();
    });
  }

  private addPart(parent: Phaser.GameObjects.Container, draw: DrawPart): PartPair {
    const base = this.scene.add.graphics();
    const flash = this.scene.add.graphics().setVisible(false);
    draw(base, this.palette);
    draw(flash, FLASH_PALETTE);
    parent.add([base, flash]);
    const pair = { base, flash };
    this.parts.push(pair);
    return pair;
  }
}

function createPalette(config: CharacterVisualConfig): PartPalette {
  const { colors, outfit } = config;
  const torso = outfit.top === 'primary' ? colors.primary : colors.secondary;
  const trim = outfit.style === 'gi' ? colors.primary : colors.accent;
  const glove = outfit.glove === 'wrap' ? colors.wrap : colors.accent;
  const boot =
    outfit.boots === 'primary'
      ? colors.primary
      : outfit.boots === 'secondary'
        ? colors.secondary
        : colors.boot;

  return Object.freeze({
    outline: colors.outline,
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    skin: colors.skin,
    hair: colors.hair,
    wrap: colors.wrap,
    boot,
    pants: colors.pants,
    torso,
    trim,
    glove,
  });
}

function drawLimbSegment(
  graphics: Phaser.GameObjects.Graphics,
  length: number,
  width: number,
  fill: number,
  outline: number,
): void {
  graphics.lineStyle(width + 3, outline, 1);
  graphics.lineBetween(0, 0, 0, length);
  graphics.lineStyle(width, fill, 1);
  graphics.lineBetween(0, 0, 0, length);
  graphics.fillStyle(outline, 1);
  graphics.fillCircle(0, 0, width / 2 + 1.5);
  graphics.fillCircle(0, length, width / 2 + 1.5);
  graphics.fillStyle(fill, 1);
  graphics.fillCircle(0, 0, width / 2);
  graphics.fillCircle(0, length, width / 2);
}

function drawHand(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  fill: number,
  palette: PartPalette,
): void {
  const radius = width * 0.62;
  graphics.fillStyle(palette.outline, 1);
  graphics.fillCircle(0, 0, radius + 2);
  graphics.fillStyle(fill, 1);
  graphics.fillCircle(0, 0, radius);
  graphics.lineStyle(1.5, palette.trim, 0.55);
  graphics.lineBetween(-radius * 0.6, 0, radius * 0.6, 0);
}

function drawFoot(
  graphics: Phaser.GameObjects.Graphics,
  length: number,
  fill: number,
  palette: PartPalette,
): void {
  const points: Point[] = [
    { x: -length * 0.28, y: -6 },
    { x: length * 0.62, y: -4 },
    { x: length, y: 1 },
    { x: length * 0.72, y: 5 },
    { x: -length * 0.3, y: 5 },
  ];

  graphics.fillStyle(palette.outline, 1);
  graphics.fillPoints(points, true);
  graphics.lineStyle(2.5, palette.outline, 1);
  graphics.strokePoints(points, true);

  const inner: Point[] = [
    { x: -length * 0.18, y: -3 },
    { x: length * 0.55, y: -2 },
    { x: length * 0.78, y: 1 },
    { x: length * 0.58, y: 2.5 },
    { x: -length * 0.2, y: 2.5 },
  ];
  graphics.fillStyle(fill, 1);
  graphics.fillPoints(inner, true);
  graphics.lineStyle(1.4, palette.trim, 0.65);
  graphics.lineBetween(-length * 0.1, 2, length * 0.6, 2);
}

function traceScarf(graphics: Phaser.GameObjects.Graphics, scale: number): void {
  graphics.beginPath();
  graphics.moveTo(0, 0);
  graphics.lineTo(-13 * scale, 7 * scale);
  graphics.lineTo(-29 * scale, 15 * scale);
  graphics.lineTo(-48 * scale, 10 * scale);
  graphics.strokePath();

  graphics.beginPath();
  graphics.moveTo(0, 4);
  graphics.lineTo(-15 * scale, 14 * scale);
  graphics.lineTo(-33 * scale, 25 * scale);
  graphics.lineTo(-44 * scale, 22 * scale);
  graphics.strokePath();
}

function shadeColor(color: number, factor: number): number {
  const red = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const green = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const blue = Math.min(255, Math.round((color & 0xff) * factor));
  return (red << 16) | (green << 8) | blue;
}

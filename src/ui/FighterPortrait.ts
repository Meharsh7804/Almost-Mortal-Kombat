import Phaser from 'phaser';

import { createNeutralPose, type FighterPose } from '../animation/ProceduralPose';
import { getCharacterVisual, type CharacterVisualConfig } from '../data/CharacterVisuals';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import { FighterRig } from './fighter/FighterRig';
import { ensureSoftGlowTexture } from './ProceduralTextures';
import { COLORS } from './Theme';

export type FighterPortraitPose = 'idle' | 'ready' | 'strike' | 'victory';

export interface FighterPortraitOptions {
  readonly x: number;
  /** Feet baseline in scene coordinates. */
  readonly y: number;
  readonly characterId: string;
  readonly fallbackColor?: number;
  readonly fallbackAccent?: number;
  readonly scale?: number;
  readonly facing?: 1 | -1;
  readonly pose?: FighterPortraitPose;
  readonly glowAlpha?: number;
  /** Gentle vertical breathing motion; disabled for strictly static layouts. */
  readonly animated?: boolean;
}

/**
 * Standalone character showcase for menus. It reuses the battle rig so select
 * and versus screens show the same artwork/poses as an actual match without
 * needing a live `Fighter` simulation.
 */
export class FighterPortrait extends Phaser.GameObjects.Container {
  private readonly glow: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly portraitScale: number;
  private readonly glowAlpha: number;
  private readonly animated: boolean;

  private visual: CharacterVisualConfig;
  private rig: FighterRig;
  private poseName: FighterPortraitPose;
  private facingDirection: 1 | -1;
  private bobTween?: Phaser.Tweens.Tween;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: FighterPortraitOptions) {
    super(scene, options.x, options.y);
    this.portraitScale = options.scale ?? 1.6;
    this.glowAlpha = options.glowAlpha ?? 0.2;
    this.animated = options.animated ?? true;
    this.poseName = options.pose ?? 'ready';
    this.facingDirection = options.facing ?? 1;
    this.visual = getCharacterVisual(
      options.characterId,
      options.fallbackColor,
      options.fallbackAccent,
    );

    ensureSoftGlowTexture(scene);

    this.glow = scene.add
      .image(0, -150 * this.portraitScale, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(280 * this.portraitScale, 340 * this.portraitScale)
      .setTint(this.visual.colors.aura)
      .setAlpha(this.glowAlpha)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.shadow = scene.add.graphics();
    this.drawShadow();

    this.rig = this.createRig();
    this.add([this.glow, this.shadow, this.rig.root]);

    scene.add.existing(this);

    if (this.animated) {
      this.startIdleMotion();
    }
  }

  setCharacter(
    characterId: string,
    fallbackColor?: number,
    fallbackAccent?: number,
  ): void {
    if (this.destroyed) return;
    const visual = getCharacterVisual(characterId, fallbackColor, fallbackAccent);
    const paletteChanged =
      visual.id !== this.visual.id ||
      visual.colors.primary !== this.visual.colors.primary ||
      visual.colors.aura !== this.visual.colors.aura;

    this.visual = visual;
    if (!paletteChanged) return;

    this.remove(this.rig.root);
    this.rig.destroy();
    this.rig = this.createRig();
    this.add(this.rig.root);
    this.glow.setTint(this.visual.colors.aura);
    this.drawShadow();
    if (this.animated) {
      this.startIdleMotion();
    }
  }

  setPose(pose: FighterPortraitPose): void {
    if (this.destroyed || pose === this.poseName) return;
    this.poseName = pose;
    this.rig.applyPose(this.createPose());
  }

  setFacing(facing: 1 | -1): void {
    if (this.destroyed || facing === this.facingDirection) return;
    this.facingDirection = facing;
    this.rig.setFacing(facing);
  }

  /** Dims the inactive side of a two-fighter showcase. */
  setEmphasis(active: boolean): void {
    if (this.destroyed) return;
    this.glow.setAlpha(active ? this.glowAlpha : this.glowAlpha * 0.35);
    this.setAlpha(active ? 1 : 0.72);
  }

  override destroy(fromScene?: boolean): void {
    this.destroyed = true;
    this.bobTween?.remove();
    this.bobTween = undefined;
    this.rig?.destroy();
    super.destroy(fromScene);
  }

  private createRig(): FighterRig {
    const rig = new FighterRig(this.scene, this.visual);
    rig.root.setScale(this.portraitScale);
    rig.setFacing(this.facingDirection);
    rig.applyPose(this.createPose());
    return rig;
  }

  private createPose(): FighterPose {
    const base = createNeutralPose(this.visual);
    switch (this.poseName) {
      case 'ready':
        return {
          ...base,
          hipOffsetY: base.hipOffsetY + 3,
          torsoRotation: base.torsoRotation + 0.04,
          headRotation: -0.05,
          backShoulderAngle: 0.52,
          backElbowAngle: -0.62,
          frontShoulderAngle: -0.95,
          frontElbowAngle: -0.28,
        };
      case 'strike':
        return {
          ...base,
          bodyOffsetX: 6,
          hipOffsetY: base.hipOffsetY + 4,
          torsoRotation: 0.18,
          headRotation: -0.06,
          headOffsetX: 4,
          backShoulderAngle: 0.78,
          backElbowAngle: -0.42,
          frontShoulderAngle: -1.32,
          frontElbowAngle: -0.08,
          frontHandAngle: 0.18,
        };
      case 'victory':
        return {
          ...base,
          torsoRotation: -0.04,
          backShoulderAngle: 2.5,
          backElbowAngle: -0.2,
          frontShoulderAngle: -2.45,
          frontElbowAngle: 0.22,
          scarfSway: 0.22,
          hairSway: 0.14,
          auraIntensity: 0.95,
        };
      case 'idle':
      default:
        return { ...base, auraIntensity: 0.7 };
    }
  }

  private drawShadow(): void {
    this.shadow.clear();
    this.shadow.fillStyle(COLORS.nearBlack, 0.55);
    this.shadow.fillEllipse(0, 8, 150 * this.portraitScale, 20 * this.portraitScale);
    this.shadow.lineStyle(1, this.visual.colors.primary, 0.35);
    this.shadow.strokeEllipse(0, 8, 96 * this.portraitScale, 12 * this.portraitScale);
  }

  private startIdleMotion(): void {
    this.bobTween?.remove();
    this.bobTween = this.scene.tweens.add({
      targets: this.rig.root,
      y: -4,
      duration: 1250,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }
}

import Phaser from 'phaser';

import { TEXTURE_KEYS } from '../data/TextureKeys';
import { ensureSoftGlowTexture } from './ProceduralTextures';
import { COLORS, CSS_COLORS, FONTS } from './Theme';

export interface MenuButtonConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly onClick: () => void;
}

/**
 * Angular, anime-UI inspired action button built entirely from procedural
 * graphics. It owns hover/press presentation; the scene owns what activation
 * actually does.
 */
export class MenuButton extends Phaser.GameObjects.Container {
  private readonly glow: Phaser.GameObjects.Image;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly panelWidth: number;
  private readonly panelHeight: number;
  private readonly onClick: () => void;

  private hovered = false;
  private pressed = false;

  constructor(scene: Phaser.Scene, config: MenuButtonConfig) {
    super(scene, config.x, config.y);

    ensureSoftGlowTexture(scene);

    this.panelWidth = config.width;
    this.panelHeight = config.height;
    this.onClick = config.onClick;

    this.glow = scene.add
      .image(0, 0, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(config.width + 300, config.height + 220)
      .setTint(COLORS.crimson)
      .setAlpha(0.13)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.panel = scene.add.graphics();

    this.labelText = scene.add
      .text(0, 0, config.label, {
        fontFamily: FONTS.display,
        fontSize: '26px',
        color: CSS_COLORS.bone,
        align: 'center',
      })
      .setOrigin(0.5)
      .setLetterSpacing(8);
    this.labelText.setShadow(0, 0, CSS_COLORS.crimson, 16, true, true);

    this.add([this.glow, this.panel, this.labelText]);
    this.setSize(config.width, config.height);
    this.setDepth(20);

    this.drawPanel();
    this.bindEvents();

    scene.add.existing(this);
  }

  pulse(): void {
    this.scene.tweens.killTweensOf(this.glow);
    this.glow.setAlpha(0.34);
    this.scene.tweens.add({
      targets: this.glow,
      alpha: this.hovered ? 0.2 : 0.13,
      duration: 520,
      ease: 'Sine.easeOut',
    });

    this.scene.tweens.killTweensOf(this.labelText);
    this.labelText.setColor(CSS_COLORS.pearl);
    this.scene.tweens.add({
      targets: this.labelText,
      y: -4,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.labelText.setColor(CSS_COLORS.bone);
      },
    });
  }

  private bindEvents(): void {
    // Container hit-test coordinates are normalized by displayOrigin, so the
    // rectangle lives in top-left space even though children are centered.
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, this.panelWidth, this.panelHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    this.on('pointerover', this.handlePointerOver, this);
    this.on('pointerout', this.handlePointerOut, this);
    this.on('pointerdown', this.handlePointerDown, this);
    this.on('pointerup', this.handlePointerUp, this);
  }

  private handlePointerOver(): void {
    this.hovered = true;
    this.drawPanel();
    this.tweenScale(1.015);
    this.tweenGlow(0.2);
  }

  private handlePointerOut(): void {
    this.hovered = false;
    this.pressed = false;
    this.drawPanel();
    this.tweenScale(1);
    this.tweenGlow(0.13);
  }

  private handlePointerDown(): void {
    this.pressed = true;
    this.tweenScale(0.985);
    this.tweenGlow(0.28);
  }

  private handlePointerUp(): void {
    if (!this.pressed) {
      return;
    }

    this.pressed = false;
    this.tweenScale(this.hovered ? 1.015 : 1);
    this.tweenGlow(this.hovered ? 0.2 : 0.13);
    this.pulse();
    this.onClick();
  }

  private tweenScale(scale: number): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: scale,
      scaleY: scale,
      duration: 140,
      ease: 'Sine.easeOut',
    });
  }

  private tweenGlow(alpha: number): void {
    this.scene.tweens.killTweensOf(this.glow);
    this.scene.tweens.add({
      targets: this.glow,
      alpha,
      duration: 180,
      ease: 'Sine.easeOut',
    });
  }

  private drawPanel(): void {
    const graphics = this.panel;
    const width = this.panelWidth;
    const height = this.panelHeight;
    const cut = 16;

    graphics.clear();

    this.tracePanel(graphics, width, height, cut);
    graphics.fillStyle(COLORS.panel, 0.94);
    graphics.fillPath();

    this.tracePanel(graphics, width, height, cut);
    graphics.fillGradientStyle(
      COLORS.crimsonDeep,
      COLORS.panel,
      COLORS.nearBlack,
      COLORS.violetDeep,
      0.42,
      0.16,
      0.3,
      0.34,
    );
    graphics.fillPath();

    this.tracePanel(graphics, width, height, cut);
    graphics.lineStyle(1, this.hovered ? COLORS.crimson : COLORS.line, this.hovered ? 0.95 : 0.7);
    graphics.strokePath();

    graphics.lineStyle(2, COLORS.crimson, this.hovered ? 1 : 0.8);
    graphics.lineBetween(-width / 2 + cut, -height / 2, -width / 2 + cut + 46, -height / 2);
    graphics.lineBetween(width / 2 - cut, height / 2, width / 2 - cut - 46, height / 2);

    graphics.lineStyle(1, COLORS.violet, this.hovered ? 0.34 : 0.2);
    graphics.lineBetween(
      -width / 2 + cut + 58,
      -height / 2 + 7,
      width / 2 - cut - 20,
      -height / 2 + 7,
    );

    graphics.fillStyle(COLORS.crimson, this.hovered ? 1 : 0.82);
    graphics.fillTriangle(-width / 2 + 26, 0, -width / 2 + 34, -4, -width / 2 + 34, 4);
    graphics.fillTriangle(width / 2 - 26, 0, width / 2 - 34, -4, width / 2 - 34, 4);
  }

  private tracePanel(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    cut: number,
  ): void {
    graphics.beginPath();
    graphics.moveTo(-width / 2 + cut, -height / 2);
    graphics.lineTo(width / 2, -height / 2);
    graphics.lineTo(width / 2, height / 2 - cut);
    graphics.lineTo(width / 2 - cut, height / 2);
    graphics.lineTo(-width / 2, height / 2);
    graphics.lineTo(-width / 2, -height / 2 + cut);
    graphics.closePath();
  }
}

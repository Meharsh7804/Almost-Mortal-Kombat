import Phaser from 'phaser';

import type { Projectile } from '../combat/ProjectileSystem';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import { ensureEmberTexture } from './ProceduralTextures';
import { COLORS } from './Theme';

const DEPTH = 12;

export class CombatVfx {
  private readonly scene: Phaser.Scene;
  private readonly reducedMotion: boolean;
  private readonly projectileGraphics: Phaser.GameObjects.Graphics;
  private readonly blockEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly guardEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dodgeEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, reducedMotion = false) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
    ensureEmberTexture(scene);

    this.projectileGraphics = scene.add.graphics().setDepth(DEPTH);
    this.blockEmitter = this.createEmitter([0xffffff, COLORS.pearl, COLORS.violet], 220, 0.42);
    this.guardEmitter = this.createEmitter([0xffffff, COLORS.violet, COLORS.gold], 420, 0.62);
    this.dodgeEmitter = this.createEmitter([0xffffff, COLORS.muted, COLORS.line], 280, 0.35);
  }

  update(projectiles: readonly Projectile[], elapsedSeconds: number): void {
    const graphics = this.projectileGraphics;
    graphics.clear();

    for (const projectile of projectiles) {
      if (!projectile.active || !projectile.attack) {
        continue;
      }

      const ownerColor = projectile.owner?.config.color ?? COLORS.violet;
      const color = projectile.attack.id === 'energy-blast' ? ownerColor : COLORS.violet;
      const direction = projectile.direction;
      const pulse = 0.82 + Math.sin(elapsedSeconds * 18 + projectile.id) * 0.18;

      for (let trail = 4; trail >= 1; trail -= 1) {
        const radius = (7 - trail) * 2.2 * pulse;
        graphics.fillStyle(color, 0.05 + (5 - trail) * 0.045);
        graphics.fillCircle(projectile.x - direction * trail * 11, projectile.y, radius);
      }

      graphics.fillStyle(color, 0.24 * pulse);
      graphics.fillCircle(projectile.x, projectile.y, 28);
      graphics.fillStyle(color, 0.7);
      graphics.fillCircle(projectile.x, projectile.y, 18);
      graphics.lineStyle(2, COLORS.pearl, 0.9);
      graphics.strokeCircle(projectile.x, projectile.y, 22);
      graphics.fillStyle(COLORS.pearl, 0.95);
      graphics.fillCircle(projectile.x, projectile.y, 7);
      graphics.lineStyle(2, color, 0.5);
      graphics.lineBetween(
        projectile.x - direction * 46,
        projectile.y,
        projectile.x - direction * 20,
        projectile.y,
      );
    }
  }

  blockImpact(x: number, y: number, color: number): void {
    this.blockEmitter.setParticleTint(color);
    this.blockEmitter.emitParticleAt(x, y, this.reducedMotion ? 4 : 9);
  }

  perfectGuard(x: number, y: number, color: number): void {
    if (!this.reducedMotion) {
      this.guardEmitter.setParticleTint(color);
      this.guardEmitter.emitParticleAt(x, y, 20);
    }

    const ring = this.scene.add
      .circle(x, y, 20)
      .setStrokeStyle(3, color, 1)
      .setDepth(32)
      .setScale(0.7);

    this.scene.tweens.add({
      targets: ring,
      scaleX: this.reducedMotion ? 1.8 : 3.4,
      scaleY: this.reducedMotion ? 1.8 : 3.4,
      alpha: 0,
      duration: this.reducedMotion ? 180 : 320,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  dodgeTrail(x: number, y: number, color: number): void {
    if (this.reducedMotion) {
      return;
    }

    this.dodgeEmitter.setParticleTint(color);
    this.dodgeEmitter.emitParticleAt(x, y, 6);
  }

  private createEmitter(
    tint: number[],
    lifespan: number,
    scaleStart: number,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    return this.scene.add
      .particles(0, 0, TEXTURE_KEYS.ember, {
        emitting: false,
        lifespan: { min: lifespan * 0.5, max: lifespan },
        speed: { min: 50, max: 260 },
        angle: { min: 0, max: 360 },
        scale: { start: scaleStart, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 300,
        tint,
        blendMode: Phaser.BlendModes.ADD,
        quantity: 1,
      })
      .setDepth(31);
  }
}

import Phaser from 'phaser';

import type { Projectile } from '../combat/ProjectileSystem';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import { ensureEmberTexture } from './ProceduralTextures';
import { COLORS } from './Theme';

const DEPTH = 12;
const IMPACT_DEPTH = 30;
const IMPACT_POOL_SIZE = 14;

type ImpactKind =
  | 'light'
  | 'heavy'
  | 'guard'
  | 'perfect'
  | 'dodge'
  | 'landing'
  | 'knockdown'
  | 'combo'
  | 'defeat'
  | 'projectile';

interface PooledImpact {
  readonly graphics: Phaser.GameObjects.Graphics;
  active: boolean;
  kind: ImpactKind;
  age: number;
  duration: number;
  x: number;
  y: number;
  color: number;
  strength: number;
}

/**
 * Presentation-only combat feedback. Effects are pooled and cleaned up in
 * place; nothing here is allowed to touch fighter state or combat timers.
 */
export class CombatVfx {
  private readonly scene: Phaser.Scene;
  private readonly reducedMotion: boolean;
  private readonly projectileGraphics: Phaser.GameObjects.Graphics;
  private readonly blockEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly guardEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dodgeEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly impacts: PooledImpact[] = [];
  private readonly seenProjectiles = new Set<number>();
  private lastElapsed = -1;

  constructor(scene: Phaser.Scene, reducedMotion = false) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
    ensureEmberTexture(scene);

    this.projectileGraphics = scene.add.graphics().setDepth(DEPTH);
    this.blockEmitter = this.createEmitter([0xffffff, COLORS.pearl, COLORS.violet], 220, 0.42, 31);
    this.guardEmitter = this.createEmitter([0xffffff, COLORS.violet, COLORS.gold], 420, 0.62, 31);
    this.dodgeEmitter = this.createEmitter([0xffffff, COLORS.muted, COLORS.line], 280, 0.35, 31);
    this.dustEmitter = this.createEmitter(
      [COLORS.muted, 0x8b7b8f, COLORS.line],
      340,
      0.32,
      7,
      Phaser.BlendModes.NORMAL,
    );

    for (let index = 0; index < IMPACT_POOL_SIZE; index += 1) {
      this.impacts.push({
        graphics: scene.add.graphics().setDepth(IMPACT_DEPTH).setVisible(false),
        active: false,
        kind: 'light',
        age: 0,
        duration: 0.2,
        x: 0,
        y: 0,
        color: COLORS.pearl,
        strength: 1,
      });
    }
  }

  update(projectiles: readonly Projectile[], elapsedSeconds: number): void {
    const elapsed = Math.max(0, elapsedSeconds);
    const delta =
      this.lastElapsed < 0 ? 0 : Phaser.Math.Clamp(elapsed - this.lastElapsed, 0, 0.1);
    this.lastElapsed = elapsed;

    this.trackProjectiles(projectiles);
    this.updateImpacts(delta);
    this.drawProjectiles(projectiles, elapsed);
  }

  hitImpact(x: number, y: number, color: number, strength = 1): void {
    this.spawnImpact(
      strength >= 0.9 ? 'heavy' : 'light',
      x,
      y,
      color,
      strength >= 0.9 ? 0.26 : 0.17,
      strength,
    );
    if (strength >= 0.9 && !this.reducedMotion) {
      this.spawnImpact('light', x, y, COLORS.pearl, 0.12, 0.8);
    }
  }

  blockImpact(x: number, y: number, color: number): void {
    this.blockEmitter.setParticleTint(color);
    this.blockEmitter.emitParticleAt(x, y, this.reducedMotion ? 4 : 9);
    this.spawnImpact('guard', x, y, color, 0.2, 0.7);
  }

  perfectGuard(x: number, y: number, color: number): void {
    if (!this.reducedMotion) {
      this.guardEmitter.setParticleTint(color);
      this.guardEmitter.emitParticleAt(x, y, 20);
    }
    this.spawnImpact('perfect', x, y, color, this.reducedMotion ? 0.24 : 0.34, 1.2);
  }

  dodgeTrail(x: number, y: number, color: number): void {
    if (this.reducedMotion) {
      return;
    }

    this.dodgeEmitter.setParticleTint(color);
    this.dodgeEmitter.emitParticleAt(x, y, 6);
    this.spawnImpact('dodge', x, y, color, 0.24, 0.6);
  }

  landingDust(x: number, groundY: number, color: number): void {
    this.dustEmitter.setParticleTint(color);
    this.dustEmitter.emitParticleAt(x, groundY - 2, this.reducedMotion ? 3 : 6);
    this.spawnImpact('landing', x, groundY, color, 0.28, 0.5);
  }

  knockdownDust(x: number, groundY: number, color: number): void {
    this.dustEmitter.setParticleTint(color);
    this.dustEmitter.emitParticleAt(x, groundY - 2, this.reducedMotion ? 5 : 14);
    this.spawnImpact('knockdown', x, groundY, color, 0.42, 1);
  }

  comboBurst(x: number, y: number, color: number, hits: number): void {
    if (this.reducedMotion || hits < 2) {
      return;
    }

    this.spawnImpact('combo', x, y, color, 0.32, Math.min(1.6, 0.6 + hits * 0.15));
  }

  defeatBurst(x: number, y: number, color: number): void {
    this.spawnImpact('defeat', x, y, color, this.reducedMotion ? 0.3 : 0.55, 1.4);
  }

  /** Spawn flash for a projectile that appeared since the previous render. */
  private trackProjectiles(projectiles: readonly Projectile[]): void {
    const activeIds = new Set<number>();

    for (const projectile of projectiles) {
      if (!projectile.active) {
        continue;
      }

      activeIds.add(projectile.id);
      if (this.seenProjectiles.has(projectile.id)) {
        continue;
      }

      this.seenProjectiles.add(projectile.id);
      this.spawnImpact(
        'projectile',
        projectile.x,
        projectile.y,
        projectile.owner?.config.color ?? COLORS.violet,
        0.24,
        0.8,
      );
    }

    for (const id of this.seenProjectiles) {
      if (!activeIds.has(id)) {
        this.seenProjectiles.delete(id);
      }
    }
  }

  private updateImpacts(delta: number): void {
    for (const impact of this.impacts) {
      if (!impact.active) {
        continue;
      }

      impact.age += delta;
      if (impact.age >= impact.duration) {
        impact.active = false;
        impact.graphics.clear().setVisible(false);
        continue;
      }

      this.drawImpact(impact, impact.age / impact.duration);
    }
  }

  private spawnImpact(
    kind: ImpactKind,
    x: number,
    y: number,
    color: number,
    duration: number,
    strength: number,
  ): void {
    let impact = this.impacts.find((candidate) => !candidate.active);

    if (!impact) {
      // Replace the most advanced effect. The pool is only a presentation
      // budget; dropping an old spark is preferable to allocating mid-fight.
      for (const candidate of this.impacts) {
        if (!impact || candidate.age / candidate.duration > impact.age / impact.duration) {
          impact = candidate;
        }
      }
    }

    if (!impact) {
      return;
    }

    impact.active = true;
    impact.kind = kind;
    impact.age = 0;
    impact.duration = Math.max(0.05, duration);
    impact.x = x;
    impact.y = y;
    impact.color = color;
    impact.strength = strength;
    impact.graphics.setVisible(true);
  }

  private drawImpact(impact: PooledImpact, progress: number): void {
    const graphics = impact.graphics;
    const fade = 1 - progress;
    const eased = 1 - (1 - progress) ** 2;
    const color = impact.color;

    graphics.clear();
    graphics.setPosition(impact.x, impact.y);

    switch (impact.kind) {
      case 'light': {
        const radius = 8 + eased * 24 * impact.strength;
        graphics.lineStyle(2, color, 0.8 * fade);
        graphics.strokeCircle(0, 0, radius);
        graphics.lineStyle(1, COLORS.pearl, 0.55 * fade);
        graphics.strokeCircle(0, 0, radius * 0.6);
        for (let shard = 0; shard < 3; shard += 1) {
          const angle = (shard / 3) * Math.PI * 2 + 0.5;
          graphics.lineStyle(1.5, COLORS.gold, 0.55 * fade);
          graphics.lineBetween(
            Math.cos(angle) * radius * 0.55,
            Math.sin(angle) * radius * 0.55,
            Math.cos(angle) * radius * 1.35,
            Math.sin(angle) * radius * 1.35,
          );
        }
        break;
      }
      case 'heavy': {
        const radius = 10 + eased * 52 * impact.strength;
        graphics.fillStyle(color, 0.12 * fade);
        graphics.fillCircle(0, 0, radius * 0.7);
        graphics.lineStyle(3, color, 0.85 * fade);
        graphics.strokeCircle(0, 0, radius);
        graphics.lineStyle(1.5, COLORS.pearl, 0.65 * fade);
        graphics.strokeCircle(0, 0, radius * 0.65);
        for (let slash = 0; slash < 6; slash += 1) {
          const angle = (slash / 6) * Math.PI * 2 + progress * 0.6;
          graphics.lineStyle(2, slash % 2 === 0 ? COLORS.gold : color, 0.7 * fade);
          graphics.lineBetween(
            Math.cos(angle) * radius * 0.8,
            Math.sin(angle) * radius * 0.8,
            Math.cos(angle) * (radius + 16),
            Math.sin(angle) * (radius + 16),
          );
        }
        break;
      }
      case 'guard': {
        graphics.lineStyle(3, COLORS.pearl, 0.75 * fade);
        graphics.beginPath();
        graphics.arc(0, 0, 22 + eased * 22, -Math.PI * 0.72, Math.PI * 0.12, false);
        graphics.strokePath();
        graphics.lineStyle(2, color, 0.55 * fade);
        graphics.beginPath();
        graphics.arc(0, 0, 30 + eased * 16, -Math.PI * 0.62, Math.PI * 0.02, false);
        graphics.strokePath();
        break;
      }
      case 'perfect': {
        const radius = 18 + eased * 56;
        graphics.lineStyle(3, COLORS.gold, 0.9 * fade);
        graphics.strokeCircle(0, 0, radius);
        graphics.lineStyle(1.5, color, 0.65 * fade);
        graphics.strokeCircle(0, 0, radius * 0.72);
        for (let spark = 0; spark < 8; spark += 1) {
          const angle = (spark / 8) * Math.PI * 2 + progress;
          graphics.fillStyle(spark % 2 === 0 ? COLORS.pearl : color, 0.8 * fade);
          graphics.fillCircle(
            Math.cos(angle) * radius * 1.05,
            Math.sin(angle) * radius * 1.05,
            2.4,
          );
        }
        break;
      }
      case 'dodge': {
        for (let ghost = 0; ghost < 3; ghost += 1) {
          graphics.fillStyle(color, (0.14 - ghost * 0.035) * fade);
          graphics.fillCircle(-progress * 50 - ghost * 10, 0, 16);
        }
        break;
      }
      case 'landing': {
        this.drawDust(graphics, color, progress, 44, 0.34);
        break;
      }
      case 'knockdown': {
        this.drawDust(graphics, color, progress, 88, 0.5);
        break;
      }
      case 'combo': {
        for (let chevron = 0; chevron < 4; chevron += 1) {
          const offset = chevron * 18 * impact.strength;
          const alpha = fade * (0.7 - chevron * 0.12);
          graphics.lineStyle(3, chevron % 2 === 0 ? COLORS.gold : color, alpha);
          graphics.beginPath();
          graphics.moveTo(-18, -offset + eased * 14);
          graphics.lineTo(0, -offset - 10 + eased * 14);
          graphics.lineTo(18, -offset + eased * 14);
          graphics.strokePath();
        }
        break;
      }
      case 'defeat': {
        const radius = 16 + eased * 84;
        graphics.fillStyle(color, 0.12 * fade);
        graphics.fillCircle(0, 0, radius * 0.8);
        graphics.lineStyle(3, color, 0.8 * fade);
        graphics.strokeCircle(0, 0, radius);
        graphics.lineStyle(2, COLORS.crimson, 0.55 * fade);
        for (let spike = 0; spike < 10; spike += 1) {
          const angle = (spike / 10) * Math.PI * 2 + progress * 0.3;
          graphics.lineBetween(
            Math.cos(angle) * radius * 0.5,
            Math.sin(angle) * radius * 0.5,
            Math.cos(angle) * (radius + 26),
            Math.sin(angle) * (radius + 26),
          );
        }
        break;
      }
      case 'projectile': {
        const radius = 30 - eased * 22;
        graphics.lineStyle(2, COLORS.pearl, 0.75 * fade);
        graphics.strokeCircle(0, 0, radius);
        graphics.lineStyle(3, color, 0.55 * fade);
        graphics.strokeCircle(0, 0, radius + 8);
        break;
      }
    }
  }

  private drawDust(
    graphics: Phaser.GameObjects.Graphics,
    color: number,
    progress: number,
    spread: number,
    alpha: number,
  ): void {
    const fade = 1 - progress;
    const radius = 10 + progress * spread;

    graphics.fillStyle(color, alpha * 0.4 * fade);
    graphics.fillEllipse(0, 4, radius * 2.1, radius * 0.62);
    graphics.lineStyle(2, COLORS.muted, alpha * fade);
    graphics.strokeEllipse(0, 2, radius * 1.6, radius * 0.44);

    for (let chunk = 0; chunk < 5; chunk += 1) {
      const direction = chunk % 2 === 0 ? 1 : -1;
      const distance = radius * (0.35 + chunk * 0.16);
      graphics.fillStyle(color, 0.35 * fade);
      graphics.fillCircle(direction * distance, progress * -18 * (chunk % 3), 1.8);
    }
  }

  private drawProjectiles(projectiles: readonly Projectile[], elapsedSeconds: number): void {
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

  private createEmitter(
    tint: number[],
    lifespan: number,
    scaleStart: number,
    depth: number,
    blendMode: Phaser.BlendModes = Phaser.BlendModes.ADD,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    return this.scene.add
      .particles(0, 0, TEXTURE_KEYS.ember, {
        emitting: false,
        lifespan: { min: lifespan * 0.5, max: lifespan },
        speed: { min: 40, max: 220 },
        angle: { min: 0, max: 360 },
        scale: { start: scaleStart, end: 0 },
        alpha: { start: 0.9, end: 0 },
        gravityY: 260,
        tint,
        blendMode,
        quantity: 1,
      })
      .setDepth(depth);
  }

  destroy(): void {
    this.projectileGraphics.destroy();
    this.blockEmitter.destroy();
    this.guardEmitter.destroy();
    this.dodgeEmitter.destroy();
    this.dustEmitter.destroy();
    for (const impact of this.impacts) {
      impact.graphics.destroy();
    }
    this.seenProjectiles.clear();
  }
}

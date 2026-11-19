import Phaser from 'phaser';

import {
  FighterAnimator,
  type FighterAnimationObservation,
  type FighterAnimatorDebug,
} from '../animation/FighterAnimator';
import { ARENA_BOUNDS } from '../data/ArenaConfig';
import { getCharacterVisual, type CharacterVisualConfig } from '../data/CharacterVisuals';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import type { Fighter } from '../entities/Fighter';
import type { FighterState } from '../entities/FighterStateMachine';
import { FighterRig } from './fighter/FighterRig';
import { ensureSoftGlowTexture } from './ProceduralTextures';

const BONE = 0xf3e9ef;
const GROUND_Y = ARENA_BOUNDS.groundY;
const HIT_FLASH_FRAMES = 6;

export interface FighterAnimationDebug extends FighterAnimatorDebug {
  readonly playerNumber: 1 | 2;
  readonly state: FighterState;
  readonly facing: 1 | -1;
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly attackId: string | null;
}

export interface FighterVisualTick {
  readonly landed: boolean;
  readonly knockdownLanding: boolean;
}

/**
 * Presentation layer for one fighter. The headless FighterAnimator advances
 * once per fixed simulation tick; Phaser's render pass only reads the current
 * pose. Combat state, collision and frame data are never written here.
 */
export class FighterView {
  readonly fighter: Fighter;

  private readonly visual: CharacterVisualConfig;
  private readonly animator: FighterAnimator;
  private readonly rig: FighterRig;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly facingMarker: Phaser.GameObjects.Graphics;
  private readonly dodgeGraphics: Phaser.GameObjects.Graphics;
  private readonly auraGraphics: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Image;

  private flashFrames = 0;
  private victory = false;

  constructor(scene: Phaser.Scene, fighter: Fighter) {
    this.fighter = fighter;
    const visualId =
      (fighter as Fighter & { visualId?: string }).visualId ??
      fighter.config.visualId ??
      fighter.config.characterId ??
      fighter.id;
    this.visual = getCharacterVisual(
      visualId,
      fighter.config.color,
      fighter.config.accentColor,
    );
    this.animator = new FighterAnimator(this.visual);

    ensureSoftGlowTexture(scene);

    this.shadow = scene.add.graphics().setDepth(8);
    this.aura = scene.add
      .image(0, 0, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(this.visual.aura.scaleX, this.visual.aura.scaleY)
      .setTint(this.visual.colors.aura)
      .setAlpha(this.visual.aura.baseAlpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9);
    this.dodgeGraphics = scene.add.graphics().setDepth(9);
    this.auraGraphics = scene.add
      .graphics()
      .setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.facingMarker = scene.add.graphics().setDepth(11);
    this.rig = new FighterRig(scene, this.visual);

    this.rig.applyPose(this.animator.pose);
    this.rig.setPosition(fighter.x, fighter.y);
    this.rig.setFacing(fighter.facing);
  }

  get animationId(): string {
    return this.animator.animationId;
  }

  /** Visual reaction to the typed PERFECT_GUARD combat event. */
  playPerfectGuard(): void {
    this.animator.playPerfectGuard();
  }

  triggerHitFlash(frames = HIT_FLASH_FRAMES): void {
    this.flashFrames = Math.max(this.flashFrames, frames);
  }

  setVictory(active: boolean): void {
    this.victory = active;
  }

  /**
   * Clears presentation-only state that survives a simulation reset. Without
   * this, the terminal DEFEAT clip keeps rendering the KO slump in the next
   * round even though the Fighter itself is back in IDLE at full health.
   */
  reset(): void {
    this.animator.reset();
    this.flashFrames = 0;
    this.victory = false;
    this.rig.setFlash(false);
    this.rig.setAlpha(1);
    this.rig.applyPose(this.animator.pose);
    this.rig.setPosition(this.fighter.x, this.fighter.y);
    this.rig.setFacing(this.fighter.facing);
  }

  /**
   * Advance deterministic animation state by exactly one simulation tick.
   * Returns presentation-only landing information for dust effects.
   */
  tickSimulation(): FighterVisualTick {
    const fighter = this.fighter;
    const observation: FighterAnimationObservation = {
      state: fighter.state,
      facing: fighter.facing,
      grounded: fighter.grounded,
      velocityX: fighter.velocityX,
      velocityY: fighter.velocityY,
      stateFramesElapsed: fighter.stateFramesElapsed,
      stateDurationFrames: fighter.stateDurationFrames,
      stateRemainingFrames: fighter.stateRemainingFrames,
      simulationTick: fighter.simulationTick,
      attack: fighter.getAttackView(),
      dodgeDirection: fighter.currentDodgeDirection,
      isDefeated: fighter.isDefeated,
      isCrouchBlocking: fighter.isCrouchBlocking,
      victory: this.victory,
    };

    const result = this.animator.tick(observation);

    this.rig.applyPose(result.pose);
    this.rig.setPosition(fighter.x, fighter.y);
    this.rig.setFacing(fighter.facing);

    if (this.flashFrames > 0) {
      this.flashFrames = Math.max(0, this.flashFrames - 1);
    }
    this.rig.setFlash(this.flashFrames > 0);

    return {
      landed: result.landed,
      knockdownLanding: result.knockdownLanding,
    };
  }

  /** Render-only pass. Never advances gameplay or animation ticks. */
  render(elapsedSeconds: number): void {
    const fighter = this.fighter;

    this.rig.setPosition(fighter.x, fighter.y);
    this.rig.setFacing(fighter.facing);
    this.rig.setAlpha(fighter.isDefeated ? 0.86 : 1);

    this.drawShadow();
    this.drawAura(elapsedSeconds);
    this.drawDodgeTrail();
    this.drawFacingMarker();
  }

  getDebugSnapshot(): FighterAnimationDebug {
    const debug = this.animator.debug;
    return {
      ...debug,
      playerNumber: this.fighter.playerNumber,
      state: this.fighter.state,
      facing: this.fighter.facing,
      x: this.fighter.x,
      y: this.fighter.y,
      velocityX: this.fighter.velocityX,
      velocityY: this.fighter.velocityY,
      attackId: this.fighter.activeAttack?.definition.id ?? null,
    };
  }

  private drawShadow(): void {
    const fighter = this.fighter;
    const heightAboveGround = Math.max(0, GROUND_Y - fighter.y);
    const scale = Phaser.Math.Clamp(1 - heightAboveGround / 420, 0.45, 1);

    this.shadow.clear();
    this.shadow.fillStyle(0x000000, 0.48 * scale);
    this.shadow.fillEllipse(fighter.x, GROUND_Y + 7, 88 * scale, 18 * scale);
    this.shadow.lineStyle(1, this.visual.colors.primary, 0.3 * scale);
    this.shadow.strokeEllipse(fighter.x, GROUND_Y + 12, 54 * scale, 10 * scale);
  }

  private drawAura(elapsedSeconds: number): void {
    const fighter = this.fighter;
    const config = this.visual.aura;
    const phase = elapsedSeconds * config.pulseSpeed + fighter.playerNumber * 1.7;
    const pulse = 0.82 + Math.sin(phase) * 0.18;
    const intensity = fighter.isDefeated
      ? 0.12
      : this.animator.pose.auraIntensity * pulse;

    this.aura
      .setPosition(fighter.x, fighter.y + config.offsetY)
      .setAlpha(Phaser.Math.Clamp(config.baseAlpha * intensity, 0, 0.42));

    const graphics = this.auraGraphics;
    graphics.clear();

    if (fighter.isDefeated) {
      return;
    }

    const centerY = fighter.y - 84;
    const orbitPhase = elapsedSeconds * 2.7 + fighter.playerNumber * 2.1;

    if (config.style === 'calm') {
      graphics.lineStyle(1, this.visual.colors.primary, 0.14 * intensity);
      graphics.strokeEllipse(fighter.x, centerY, 86, 142);
      graphics.lineStyle(1, this.visual.colors.accent, 0.08 * intensity);
      graphics.strokeEllipse(
        fighter.x,
        centerY + 6,
        66 + Math.sin(orbitPhase) * 5,
        120 + Math.cos(orbitPhase) * 7,
      );
      for (let index = 0; index < 3; index += 1) {
        const orbit = orbitPhase + (index / 3) * Math.PI * 2;
        const x = fighter.x + Math.cos(orbit) * 38;
        const y = centerY + Math.sin(orbit) * 58;
        graphics.fillStyle(this.visual.colors.primary, 0.16 * intensity);
        graphics.fillCircle(x, y, 2.1);
      }
    } else {
      for (let index = 0; index < 4; index += 1) {
        const side = index % 2 === 0 ? 1 : -1;
        const flicker = Math.sin(orbitPhase * 1.6 + index * 1.4) * 0.5 + 0.5;
        const height = 34 + index * 13 + flicker * 10;
        const x = fighter.x + side * (30 + index * 6);
        graphics.fillStyle(
          index % 2 === 0 ? this.visual.colors.primary : this.visual.colors.accent,
          0.08 * intensity + flicker * 0.04,
        );
        graphics.fillTriangle(
          x - 5,
          centerY + height,
          x + 5,
          centerY + height,
          x + Math.sin(orbitPhase + index) * 4,
          centerY - height * 0.75,
        );
      }
      graphics.lineStyle(1, this.visual.colors.primary, 0.1 * intensity);
      graphics.strokeEllipse(fighter.x, centerY, 96, 152);
    }
  }

  private drawDodgeTrail(): void {
    const fighter = this.fighter;
    this.dodgeGraphics.clear();

    if (!fighter.isDodging) {
      return;
    }

    const duration = Math.max(1, fighter.stateDurationFrames);
    const progress = Phaser.Math.Clamp(1 - fighter.stateRemainingFrames / duration, 0, 1);
    const offset = -fighter.currentDodgeDirection * (22 + progress * 58);
    const color = this.visual.colors.primary;

    for (let ghost = 1; ghost <= 3; ghost += 1) {
      const x = fighter.x + offset * (ghost / 3);
      const alpha = 0.13 - ghost * 0.028;

      this.dodgeGraphics.fillStyle(color, alpha);
      this.dodgeGraphics.fillCircle(x, fighter.y - 138, 13);
      this.dodgeGraphics.fillRect(x - 12, fighter.y - 124, 24, 50);
      this.dodgeGraphics.fillRect(x - 10, fighter.y - 74, 8, 60);
      this.dodgeGraphics.fillRect(x + 2, fighter.y - 74, 8, 56);
    }
  }

  private drawFacingMarker(): void {
    this.facingMarker.clear();
    if (this.fighter.isDefeated) {
      return;
    }

    const color = this.flashFrames > 0 ? BONE : this.visual.colors.primary;
    const state = this.fighter.state;
    const alpha =
      state === 'ATTACKING' || state === 'SPECIAL_ATTACK'
        ? 0.75
        : state === 'BLOCKING' || state === 'BLOCKSTUN'
          ? 0.65
          : 0.38;
    const direction = this.fighter.facing;
    const baseX = this.fighter.x + direction * 40;
    const baseY = GROUND_Y + 10;

    this.facingMarker.fillStyle(color, alpha);
    this.facingMarker.fillTriangle(
      baseX + direction * 12,
      baseY,
      baseX,
      baseY - 4,
      baseX,
      baseY + 4,
    );
    this.facingMarker.lineStyle(1, color, alpha * 0.7);
    this.facingMarker.lineBetween(
      this.fighter.x + direction * 18,
      baseY,
      baseX - direction * 2,
      baseY,
    );
  }
}

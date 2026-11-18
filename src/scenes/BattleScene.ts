import Phaser from 'phaser';

import type { HitEvent } from '../combat/CombatEngine';
import type { CombatEvent } from '../combat/CombatEvents';
import { GAME_BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop, type GameLoop } from '../core/GameLoop';
import { KeyboardController } from '../controllers/KeyboardController';
import { InputManager } from '../controllers/InputManager';
import { ARENA_BOUNDS } from '../data/ArenaConfig';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from '../data/FighterData';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import type { Fighter } from '../entities/Fighter';
import { MatchManager } from '../systems/MatchManager';
import { prefersReducedMotion } from '../ui/Accessibility';
import { ArenaBackdrop } from '../ui/ArenaBackdrop';
import { CombatVfx } from '../ui/CombatVfx';
import { DebugOverlay } from '../ui/DebugOverlay';
import { FighterView } from '../ui/FighterView';
import { HUD, type HudFighterSnapshot } from '../ui/HUD';
import { ensureEmberTexture } from '../ui/ProceduralTextures';
import { COLORS } from '../ui/Theme';
import { VictoryScreen } from '../ui/VictoryScreen';

/**
 * Playable battle scene. Simulation advances only through the shared fixed
 * GameLoop subscription; the scene update pass is purely presentation.
 */
export class BattleScene extends Phaser.Scene {
  private loop: GameLoop | null = null;
  private unsubscribeLoop: (() => void) | null = null;
  private inputManager: InputManager | null = null;
  private keyboardController: KeyboardController | null = null;
  private match: MatchManager | null = null;
  private backdrop: ArenaBackdrop | null = null;
  private hud: HUD | null = null;
  private fighterViews: [FighterView, FighterView] | null = null;
  private victoryScreen: VictoryScreen | null = null;
  private debugOverlay: DebugOverlay | null = null;
  private combatVfx: CombatVfx | null = null;
  private reducedMotion = false;
  private hitSparks:
    | [Phaser.GameObjects.Particles.ParticleEmitter, Phaser.GameObjects.Particles.ParticleEmitter]
    | null = null;
  private resultShown = false;
  private transitioning = false;

  constructor() {
    super({ key: SCENE_KEYS.BATTLE });
  }

  create(): void {
    this.resultShown = false;
    this.transitioning = false;
    this.reducedMotion = prefersReducedMotion();

    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.fadeIn(360, 4, 3, 7);

    this.backdrop = new ArenaBackdrop(this);
    this.match = new MatchManager([PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG], ARENA_BOUNDS);
    this.fighterViews = [
      new FighterView(this, this.match.fighters[0]),
      new FighterView(this, this.match.fighters[1]),
    ];
    this.hud = new HUD(this);
    this.victoryScreen = new VictoryScreen(this);
    this.combatVfx = new CombatVfx(this, this.reducedMotion);
    this.createHitSparks();

    this.inputManager = new InputManager();
    this.keyboardController = new KeyboardController(window, this.inputManager, {
      preventDefault: true,
    });

    if (import.meta.env.DEV) {
      this.debugOverlay = new DebugOverlay(this);
      window.addEventListener('keydown', this.handleDebugKey);
    }

    this.loop = getGameLoop(this);
    if (this.loop) {
      this.unsubscribeLoop = this.loop.addFixedUpdate(this.handleFixedUpdate);
    } else {
      console.warn('[BattleScene] Shared GameLoop was not found in the scene registry.');
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  override update(_time: number, delta: number): void {
    if (!this.match || !this.fighterViews || !this.hud || !this.backdrop) {
      return;
    }

    const deltaMs = Math.min(delta, 50);
    const elapsed = this.loop?.simulationTimeSeconds ?? 0;
    const fighters = this.match.fighters;

    this.fighterViews[0].update(deltaMs, elapsed);
    this.fighterViews[1].update(deltaMs, elapsed);

    const p1 = this.toHudSnapshot(fighters[0]);
    const p2 = this.toHudSnapshot(fighters[1]);
    this.hud.update([p1, p2], deltaMs);
    this.hud.setPhaseLabel(this.match.stateLabel);
    this.hud.setAnnouncement(this.match.announcement);

    this.combatVfx?.update(this.match.activeProjectiles, elapsed);
    this.backdrop.update(elapsed);
    this.debugOverlay?.update(fighters, this.match.activeProjectiles);

    if (!this.resultShown && this.match.resultVisible) {
      this.resultShown = true;
      this.showVictoryScreen();
    }
  }

  private readonly handleFixedUpdate = (): void => {
    if (!this.match || !this.inputManager) {
      return;
    }

    const inputs = this.inputManager.poll();
    const result = this.match.update(inputs);

    this.handleCombatEvents(result.events);

    for (const hit of result.hits) {
      this.handleHit(hit);
    }
  };

  private handleCombatEvents(events: readonly CombatEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'ATTACK_BLOCKED': {
          const victim = this.findFighter(event.victimId);
          if (victim) {
            this.combatVfx?.blockImpact(event.impactX, event.impactY, victim.config.color);
          }
          if (!this.reducedMotion) {
            this.cameras.main.shake(60, 0.0016);
          }
          break;
        }
        case 'PERFECT_GUARD': {
          const defender = this.findFighter(event.fighterId);
          if (defender) {
            this.combatVfx?.perfectGuard(defender.x, defender.y - 92, defender.config.color);
            this.hud?.showNotice('PERFECT GUARD', COLORS.violet);
          }
          break;
        }
        case 'COMBO_STARTED':
        case 'COMBO_UPDATED': {
          const attacker = this.findFighter(event.attackerId);
          if (!attacker) {
            break;
          }
          this.hud?.showCombo(attacker.playerNumber, event.hits, event.damage);
          if (event.hits >= 2) {
            this.hud?.showNotice(
              `${event.hits} HIT COMBO`,
              attacker.playerNumber === 1 ? COLORS.cyan : COLORS.emberOrange,
            );
          }
          break;
        }
        case 'COMBO_ENDED': {
          const attacker = this.findFighter(event.attackerId);
          if (attacker) {
            this.hud?.clearCombo(attacker.playerNumber);
          }
          break;
        }
        case 'DODGE_STARTED': {
          const fighter = this.findFighter(event.fighterId);
          if (fighter) {
            this.combatVfx?.dodgeTrail(fighter.x, fighter.y - 66, fighter.config.color);
          }
          break;
        }
        case 'SPECIAL_ATTACK_USED': {
          const fighter = this.findFighter(event.fighterId);
          if (fighter) {
            this.hud?.showNotice(event.attackName, fighter.config.color);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private findFighter(id: string): Fighter | null {
    return this.match?.fighters.find((fighter) => fighter.id === id) ?? null;
  }

  private handleHit(hit: HitEvent): void {
    if (!this.fighterViews) {
      return;
    }

    const victimIndex = hit.victim.playerNumber === 1 ? 0 : 1;
    this.fighterViews[victimIndex].triggerHitFlash();

    const sparks = hit.attacker.playerNumber === 1 ? this.hitSparks?.[0] : this.hitSparks?.[1];
    sparks?.emitParticleAt(hit.impactX, hit.impactY, hit.attack.causesKnockdown ? 16 : 8);

    if (hit.defeated) {
      if (!this.reducedMotion) {
        this.cameras.main.shake(240, 0.008);
        this.cameras.main.flash(160, 255, 110, 130);
      }
    } else if (hit.attack.causesKnockdown) {
      if (!this.reducedMotion) {
        this.cameras.main.shake(150, 0.0045);
      }
    } else if (!this.reducedMotion) {
      this.cameras.main.shake(70, 0.0012);
    }
  }

  private createHitSparks(): void {
    ensureEmberTexture(this);

    const createEmitter = (tint: number): Phaser.GameObjects.Particles.ParticleEmitter =>
      this.add
        .particles(0, 0, TEXTURE_KEYS.ember, {
          emitting: false,
          lifespan: { min: 160, max: 440 },
          speed: { min: 70, max: 360 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.55, end: 0 },
          alpha: { start: 1, end: 0 },
          gravityY: 720,
          tint: [0xffffff, tint, COLORS.gold],
          blendMode: Phaser.BlendModes.ADD,
          quantity: 1,
        })
        .setDepth(30);

    this.hitSparks = [
      createEmitter(PLAYER_ONE_CONFIG.color),
      createEmitter(PLAYER_TWO_CONFIG.color),
    ];
  }

  private toHudSnapshot(fighter: MatchManager['fighters'][number]): HudFighterSnapshot {
    return {
      name: fighter.name,
      health: fighter.health,
      maxHealth: fighter.maxHealth,
      playerNumber: fighter.playerNumber,
      color: fighter.config.color,
      energy: fighter.energy,
      maxEnergy: fighter.maxEnergy,
      dodgeCooldownFrames: fighter.dodgeCooldown,
      dodgeCooldownMaxFrames: fighter.dodgeCooldownMax,
      blocking: fighter.isBlocking || fighter.isBlockstunned,
    };
  }

  private showVictoryScreen(): void {
    if (!this.match || !this.victoryScreen) {
      return;
    }

    const winner = this.match.winner;
    this.victoryScreen.show({
      winnerName: winner?.name ?? null,
      winnerPlayer: winner?.playerNumber ?? null,
      winnerColor: winner?.config.color ?? COLORS.bone,
      isDraw: this.match.isDraw,
      onRestart: () => this.returnToBattle(),
      onMenu: () => this.returnToMenu(),
    });
  }

  private returnToBattle(): void {
    if (this.transitioning) {
      return;
    }

    this.transitioning = true;
    this.cameras.main.fadeOut(240, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart();
    });
  }

  private returnToMenu(): void {
    if (this.transitioning) {
      return;
    }

    this.transitioning = true;
    this.cameras.main.fadeOut(240, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }

  private readonly handleDebugKey = (event: KeyboardEvent): void => {
    if (event.code !== 'Backquote') {
      return;
    }

    event.preventDefault();
    this.debugOverlay?.toggle();
  };

  private handleShutdown(): void {
    this.unsubscribeLoop?.();
    this.unsubscribeLoop = null;
    this.loop = null;

    this.keyboardController?.destroy();
    this.keyboardController = null;
    this.inputManager = null;

    this.victoryScreen?.destroy();
    this.victoryScreen = null;

    if (this.debugOverlay) {
      window.removeEventListener('keydown', this.handleDebugKey);
      this.debugOverlay.setEnabled(false);
    }
    this.debugOverlay = null;

    this.hitSparks = null;
    this.combatVfx = null;
    this.fighterViews = null;
    this.match = null;
    this.hud = null;
    this.backdrop = null;
  }
}

import Phaser from 'phaser';

import { AIController } from '../ai/AIController';
import type { AIDifficulty, AIPersonality } from '../ai/AITypes';
import type { HitEvent } from '../combat/CombatEngine';
import type { CombatEvent } from '../combat/CombatEvents';
import { GAME_BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop, type GameLoop } from '../core/GameLoop';
import { KeyboardController } from '../controllers/KeyboardController';
import { InputManager } from '../controllers/InputManager';
import { ARENA_BOUNDS } from '../data/ArenaConfig';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from '../data/FighterData';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import type { PlayerNumber, Fighter } from '../entities/Fighter';
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

export interface BattleSceneConfig {
  readonly mode?: 'PVP' | 'PVC';
  readonly difficulty?: AIDifficulty;
  readonly personality?: AIPersonality;
  readonly aiPlayer?: 1 | 2;
  readonly seed?: number;
}

interface ResolvedBattleConfig {
  readonly mode: 'PVP' | 'PVC';
  readonly difficulty: AIDifficulty;
  readonly personality: AIPersonality;
  readonly aiPlayer: 1 | 2;
  readonly seed: number;
}

const DEFAULT_BATTLE_CONFIG: ResolvedBattleConfig = Object.freeze({
  mode: 'PVP',
  difficulty: 'NORMAL',
  personality: 'AGGRESSOR',
  aiPlayer: 2,
  seed: 1337,
});

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

  private battleConfig: ResolvedBattleConfig = DEFAULT_BATTLE_CONFIG;
  private aiControllers: Partial<Record<PlayerNumber, AIController>> = {};
  private simulationTick = 0;
  private aiDebugKeyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super({ key: SCENE_KEYS.BATTLE });
  }

  init(data?: BattleSceneConfig): void {
    this.battleConfig = this.resolveBattleConfig(data);
  }

  create(_data?: BattleSceneConfig): void {
    this.resultShown = false;
    this.transitioning = false;
    this.simulationTick = 0;
    this.aiControllers = {};
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

    const humanPlayers: PlayerNumber[] =
      this.battleConfig.mode === 'PVP'
        ? [1, 2]
        : [this.battleConfig.aiPlayer === 1 ? 2 : 1];
    this.keyboardController = new KeyboardController(window, this.inputManager, {
      preventDefault: true,
      enabledPlayers: humanPlayers,
    });

    if (this.battleConfig.mode === 'PVC') {
      const aiPlayer = this.battleConfig.aiPlayer;
      this.aiControllers[aiPlayer] = new AIController({
        controlledPlayer: aiPlayer,
        difficulty: this.battleConfig.difficulty,
        personality: this.battleConfig.personality,
        seed: this.battleConfig.seed,
        debug: false,
      });
    }

    this.applyHudModeLabels();

    if (import.meta.env.DEV) {
      this.debugOverlay = new DebugOverlay(this);
      window.addEventListener('keydown', this.handleDebugKey);
      this.aiDebugKeyHandler = (event: KeyboardEvent) => {
        if (event.code !== 'F4') return;
        event.preventDefault();
        const ai = this.getPrimaryAIController();
        const match = this.match;
        if (ai && match) {
          const self = match.fighters[ai.controlledPlayer - 1];
          const opponent = match.fighters[ai.controlledPlayer === 1 ? 1 : 0];
          if (self && opponent) {
            ai.setDebugEnabled(!ai.getDebugInfo(this.simulationTick, self, opponent).enabled);
          }
        }
      };
      window.addEventListener('keydown', this.aiDebugKeyHandler);
    }

    this.loop = getGameLoop(this);
    if (this.loop) {
      this.unsubscribeLoop = this.loop.addFixedUpdate(this.handleFixedUpdate);
    } else {
      console.warn('[BattleScene] Shared GameLoop was not found in the scene registry.');
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private resolveBattleConfig(data?: BattleSceneConfig): ResolvedBattleConfig {
    const mode = data?.mode === 'PVC' ? 'PVC' : data?.mode === 'PVP' ? 'PVP' : DEFAULT_BATTLE_CONFIG.mode;
    const aiPlayer: 1 | 2 = data?.aiPlayer === 1 ? 1 : 2;
    const difficulty: AIDifficulty = data?.difficulty ?? DEFAULT_BATTLE_CONFIG.difficulty;
    const personality: AIPersonality = data?.personality ?? DEFAULT_BATTLE_CONFIG.personality;
    const seed = typeof data?.seed === 'number' && Number.isFinite(data.seed) ? (data.seed >>> 0) : DEFAULT_BATTLE_CONFIG.seed;
    return { mode, difficulty, personality, aiPlayer, seed };
  }

  private getPrimaryAIController(): AIController | null {
    return this.aiControllers[1] ?? this.aiControllers[2] ?? null;
  }

  private applyHudModeLabels(): void {
    if (!this.hud) return;
    const ai = this.getPrimaryAIController();
    if (!ai) {
      this.hud.setSideLabels('P1 // RIFT', 'EMBER // P2');
      this.hud.setControlHints(
        'P1  A/D MOVE   W JUMP   S CROUCH   F LIGHT   G HEAVY   T BLOCK   H/Y SPECIAL   Q DODGE',
        'P2  LEFT/RIGHT MOVE   UP JUMP   DOWN CROUCH   J LIGHT   K HEAVY   O BLOCK   U/I SPECIAL   P DODGE',
      );
      return;
    }

    const humanPlayer = ai.controlledPlayer === 1 ? 2 : 1;
    const cpuLabel = `CPU P${ai.controlledPlayer} // ${ai.getProfile().difficulty}`;
    const p1Label = ai.controlledPlayer === 1 ? cpuLabel : 'P1 // RIFT';
    const p2Label = ai.controlledPlayer === 2 ? cpuLabel : 'EMBER // P2';
    this.hud.setSideLabels(p1Label, p2Label);

    const p1Human = 'P1  A/D MOVE   W JUMP   S CROUCH   F LIGHT   G HEAVY   T BLOCK   H/Y SPECIAL   Q DODGE';
    const p2Human = 'P2  LEFT/RIGHT MOVE   UP JUMP   DOWN CROUCH   J LIGHT   K HEAVY   O BLOCK   U/I SPECIAL   P DODGE';
    const p1Cpu = `P1  CPU  ${ai.getProfile().personality}  (${ai.getProfile().difficulty})`;
    const p2Cpu = `P2  CPU  ${ai.getProfile().personality}  (${ai.getProfile().difficulty})`;
    this.hud.setControlHints(
      ai.controlledPlayer === 1 ? p1Cpu : humanPlayer === 1 ? p1Human : p1Cpu,
      ai.controlledPlayer === 2 ? p2Cpu : humanPlayer === 2 ? p2Human : p2Cpu,
    );
  }

  override update(_time: number, delta: number): void {
    if (!this.match || !this.fighterViews || !this.hud || !this.backdrop) {
      return;
    }

    const deltaMs = Math.min(delta, 50);
    const elapsed = this.loop?.simulationTimeSeconds ?? 0;
    const fighters = this.match.fighters;

    this.fighterViews[0].render(elapsed);
    this.fighterViews[1].render(elapsed);

    const p1 = this.toHudSnapshot(fighters[0]);
    const p2 = this.toHudSnapshot(fighters[1]);
    this.hud.update([p1, p2], deltaMs);
    this.hud.setPhaseLabel(this.match.stateLabel);
    this.hud.setAnnouncement(this.match.announcement);

    this.combatVfx?.update(this.match.activeProjectiles, elapsed);
    this.backdrop.update(elapsed);

    const ai = this.getPrimaryAIController();
    const aiSelf = ai ? fighters[ai.controlledPlayer - 1] : null;
    const aiOpponent = ai ? fighters[ai.controlledPlayer === 1 ? 1 : 0] : null;
    const aiDebug = ai && aiSelf && aiOpponent
      ? ai.getDebugInfo(this.simulationTick, aiSelf, aiOpponent)
      : null;
    this.debugOverlay?.update(
      fighters,
      this.match.activeProjectiles,
      [this.fighterViews[0].getDebugSnapshot(), this.fighterViews[1].getDebugSnapshot()],
      aiDebug?.enabled ? aiDebug : null,
    );

    if (!this.resultShown && this.match.resultVisible) {
      this.resultShown = true;
      this.showVictoryScreen();
    }
  }

  private readonly handleFixedUpdate = (): void => {
    if (!this.match || !this.inputManager) {
      return;
    }

    // Hitstop freezes simulation state, so animation clocks must freeze with
    // it. AI controllers emit into InputManager before poll() so the same
    // snapshot pipeline consumes human and CPU inputs identically.
    const frozen = this.match.hitstopActive;
    const allowControl = this.match.controlsEnabled;

    this.updateAIControllers(allowControl, frozen);

    const inputs = this.inputManager.poll();
    const result = this.match.update(inputs);

    this.handleCombatEvents(result.events);

    for (const hit of result.hits) {
      this.handleHit(hit);
    }

    this.syncVictoryPose();

    if (!frozen) {
      this.tickFighterAnimation(0);
      this.tickFighterAnimation(1);
    }

    this.simulationTick += 1;
  };

  private updateAIControllers(allowControl: boolean, hitstopActive: boolean): void {
    if (!this.match || !this.inputManager) return;
    const fighters = this.match.fighters;
    const combat = this.match.combatEngine;

    for (const player of [1, 2] as const) {
      const controller = this.aiControllers[player];
      if (!controller) continue;
      const self = fighters[player - 1];
      const opponent = fighters[player === 1 ? 1 : 0];
      if (!self || !opponent) continue;
      controller.update({
        input: this.inputManager,
        self,
        opponent,
        arena: ARENA_BOUNDS,
        combat,
        tick: this.simulationTick,
        allowControl,
        hitstopActive,
      });
    }
  }

  private tickFighterAnimation(index: 0 | 1): void {
    const views = this.fighterViews;
    if (!views) {
      return;
    }

    const view = views[index];
    const tick = view.tickSimulation();

    if (tick.knockdownLanding) {
      this.combatVfx?.knockdownDust(
        view.fighter.x,
        ARENA_BOUNDS.groundY,
        view.fighter.config.color,
      );
    } else if (tick.landed) {
      this.combatVfx?.landingDust(
        view.fighter.x,
        ARENA_BOUNDS.groundY,
        view.fighter.config.color,
      );
    }
  }

  private syncVictoryPose(): void {
    if (!this.match || !this.fighterViews) {
      return;
    }

    const winner = this.match.matchPhase === 'FINISHED' ? this.match.winner : null;
    const settled = winner !== null && this.match.finishedTicks >= 32;

    this.fighterViews[0].setVictory(settled && winner === this.match.fighters[0]);
    this.fighterViews[1].setVictory(settled && winner === this.match.fighters[1]);
  }

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
            this.fighterViews?.[defender.playerNumber === 1 ? 0 : 1].playPerfectGuard();
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
            const victim = this.findFighter(event.victimId);
            if (victim) {
              this.combatVfx?.comboBurst(
                victim.x,
                victim.y - 104,
                attacker.config.color,
                event.hits,
              );
            }
            this.hud?.showNotice(
              `${event.hits} HIT COMBO`,
              attacker.playerNumber === 1 ? COLORS.cyan : COLORS.emberOrange,
            );
          }
          break;
        }
        case 'FIGHTER_DEFEATED': {
          const fighter = this.findFighter(event.fighterId);
          if (fighter) {
            this.combatVfx?.defeatBurst(
              fighter.x,
              fighter.y - 92,
              fighter.config.color,
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

    const heavy = hit.attack.category !== 'LIGHT' || hit.attack.causesKnockdown;
    this.combatVfx?.hitImpact(
      hit.impactX,
      hit.impactY,
      hit.victim.config.color,
      heavy ? 1 : 0.55,
    );

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
      this.scene.restart(this.battleConfig);
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

    if (this.inputManager) {
      for (const controller of Object.values(this.aiControllers)) {
        controller?.reset(this.inputManager);
      }
    }
    this.aiControllers = {};

    this.keyboardController?.destroy();
    this.keyboardController = null;
    this.inputManager = null;

    this.victoryScreen?.destroy();
    this.victoryScreen = null;

    if (this.debugOverlay) {
      window.removeEventListener('keydown', this.handleDebugKey);
      this.debugOverlay.setEnabled(false);
    }
    if (this.aiDebugKeyHandler) {
      window.removeEventListener('keydown', this.aiDebugKeyHandler);
      this.aiDebugKeyHandler = null;
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

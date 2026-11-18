import Phaser from 'phaser';

import { AIController } from '../ai/AIController';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import type { HitEvent } from '../combat/CombatEngine';
import type { CombatEvent } from '../combat/CombatEvents';
import { GAME_BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop, type GameLoop } from '../core/GameLoop';
import { InputManager } from '../controllers/InputManager';
import { KeyboardController } from '../controllers/KeyboardController';
import { ARENA_BOUNDS } from '../data/ArenaConfig';
import { getArenaById } from '../data/ArenaRegistry';
import { getCharacterById } from '../data/CharacterRegistry';
import {
  createFighterConfigForMatch,
  resolveMatchConfig,
  type MatchConfig,
  type ResolvedMatchConfig,
} from '../data/MatchConfig';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from '../data/FighterData';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import type { Fighter, PlayerNumber } from '../entities/Fighter';
import { MatchManager } from '../systems/MatchManager';
import { MatchStatisticsTracker } from '../systems/MatchStats';
import { resolveReducedMotion, resolveScreenShakeEnabled } from '../ui/Accessibility';
import { ArenaBackdrop } from '../ui/ArenaBackdrop';
import { CombatVfx } from '../ui/CombatVfx';
import { DebugOverlay } from '../ui/DebugOverlay';
import { FighterView } from '../ui/FighterView';
import { HUD, type HudFighterSnapshot } from '../ui/HUD';
import { MenuButton } from '../ui/MenuButton';
import { ensureEmberTexture } from '../ui/ProceduralTextures';
import { COLORS, CSS_COLORS, FONTS } from '../ui/Theme';
import type { ResultsSceneData, ArcadeResultsContext } from '../ui/ResultsScreen';
import type { MatchProgressionInput } from '../progression/ProgressionEvents';
import { applyMatchProgression, getOrLoadProfile, persistProfile } from '../progression/ProgressionService';
import { recordArcadeStageLoss, recordArcadeStageWin } from '../arcade/ArcadeProgressionService';
import { ProgressionToast } from '../ui/ProgressionToast';

export interface BattleSceneConfig {
  readonly mode?: 'PVP' | 'PVC';
  readonly difficulty?: 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT';
  readonly personality?: 'AGGRESSOR' | 'DEFENDER' | 'TRICKSTER' | 'BRUISER';
  readonly aiPlayer?: 1 | 2;
  readonly seed?: number;
}

interface BattleSceneData extends BattleSceneConfig {
  readonly matchConfig?: Partial<MatchConfig> | MatchConfig | ResolvedMatchConfig;
  readonly arcade?: ArcadeResultsContext;
  readonly matchToken?: string;
}

interface LegacyResolvedBattleConfig {
  readonly mode: 'PVP' | 'PVC';
  readonly difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT';
  readonly personality: 'AGGRESSOR' | 'DEFENDER' | 'TRICKSTER' | 'BRUISER';
  readonly aiPlayer: 1 | 2;
  readonly seed: number;
}

const DEFAULT_LEGACY_CONFIG: LegacyResolvedBattleConfig = Object.freeze({
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
  private debugOverlay: DebugOverlay | null = null;
  private combatVfx: CombatVfx | null = null;
  private reducedMotion = false;
  private screenShakeEnabled = true;
  private hitSparks:
    | [Phaser.GameObjects.Particles.ParticleEmitter, Phaser.GameObjects.Particles.ParticleEmitter]
    | null = null;
  private resultShown = false;
  private transitioning = false;

  private aiControllers: Partial<Record<PlayerNumber, AIController>> = {};
  private simulationTick = 0;
  private aiDebugKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private debugKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private pauseKeyHandler: (() => void) | null = null;

  private resolvedMatchConfig: ResolvedMatchConfig | null = null;
  private legacyBattleConfig: LegacyResolvedBattleConfig = DEFAULT_LEGACY_CONFIG;
  private statsTracker = new MatchStatisticsTracker();
  private lastMatchPhase: string = 'READY';
  private matchFinishedHandled = false;
  private arcadeContext: ArcadeResultsContext | null = null;
  private matchToken = '';
  private progressionToast: ProgressionToast | null = null;
  private audio: AudioManager | null = null;
  private paused = false;
  private pauseContainer: Phaser.GameObjects.Container | null = null;
  private pauseButtons: MenuButton[] = [];

  constructor() {
    super({ key: SCENE_KEYS.BATTLE });
  }

  init(data?: BattleSceneData): void {
    if (data?.matchConfig) {
      this.resolvedMatchConfig = resolveMatchConfig(data.matchConfig);
      this.legacyBattleConfig = this.legacyFromResolved(this.resolvedMatchConfig);
    } else {
      this.resolvedMatchConfig = null;
      this.legacyBattleConfig = this.resolveLegacyBattleConfig(data);
    }
    this.arcadeContext = data?.arcade ?? null;
    this.matchToken = data?.matchToken ?? this.createMatchToken();
  }

  private createMatchToken(): string {
    const seed = this.resolvedMatchConfig?.seed ?? this.legacyBattleConfig.seed ?? 0;
    const mode = this.resolvedMatchConfig?.mode ?? (this.legacyBattleConfig.mode === 'PVC' ? 'CPU_BATTLE' : 'LOCAL_VERSUS');
    const stage = this.arcadeContext ? `${this.arcadeContext.run.runId}:${this.arcadeContext.stageIndex}` : 'none';
    return `${mode}:${stage}:${seed}:${Date.now()}:${Math.floor(Math.random() * 1e9)}`;
  }

  create(data?: BattleSceneData): void {
    this.init(data);
    this.resultShown = false;
    this.transitioning = false;
    this.simulationTick = 0;
    this.aiControllers = {};
    this.statsTracker = new MatchStatisticsTracker();
    this.lastMatchPhase = 'READY';
    this.matchFinishedHandled = false;
    this.paused = false;
    this.pauseContainer = null;
    this.pauseButtons = [];

    const settings = getOrLoadProfile().settings;
    this.reducedMotion = resolveReducedMotion(settings.reducedMotion);
    this.screenShakeEnabled = resolveScreenShakeEnabled(settings);
    this.audio = getAudioManager(this.game);
    this.audio?.attach(this.sound);
    this.audio?.applySettings(settings);
    // Stop menu/previous scene music on match entry (safe no-op if no music is playing or keys are missing).
    this.audio?.setMusic(null);

    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.fadeIn(360, 4, 3, 7);

    this.progressionToast = new ProgressionToast(this);
    this.progressionToast.pumpFromQueue(this.time.now);

    const resolved = this.resolvedMatchConfig;
    const arenaDef = resolved ? getArenaById(resolved.resolvedArenaId) : getArenaById('forgotten-temple');
    this.backdrop = new ArenaBackdrop(this, arenaDef ?? getArenaById('forgotten-temple')!);

    const fighterConfigs = this.createFighterConfigs();
    this.match = new MatchManager(fighterConfigs, ARENA_BOUNDS, undefined, {
      roundsToWin: resolved?.roundsToWin ?? 1,
      roundTimerSeconds: resolved?.roundTimerSeconds ?? 0,
    });

    this.fighterViews = [
      new FighterView(this, this.match.fighters[0]),
      new FighterView(this, this.match.fighters[1]),
    ];
    this.hud = new HUD(this);
    this.combatVfx = new CombatVfx(this, this.reducedMotion);
    this.createHitSparks(fighterConfigs[0].color, fighterConfigs[1].color);

    this.statsTracker.registerFighter(this.match.fighters[0].id, 1);
    this.statsTracker.registerFighter(this.match.fighters[1].id, 2);
    this.statsTracker.onRoundStart();

    this.inputManager = new InputManager();
    this.setupControllers();

    this.applyHudModeLabels();

    if (import.meta.env.DEV) {
      this.debugOverlay = new DebugOverlay(this);
      this.debugKeyHandler = (event: KeyboardEvent) => {
        if (event.code !== 'Backquote') return;
        event.preventDefault();
        this.debugOverlay?.toggle();
      };
      window.addEventListener('keydown', this.debugKeyHandler);
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

    this.pauseKeyHandler = () => this.togglePause();
    this.input.keyboard?.on('keydown-ESC', this.pauseKeyHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private createFighterConfigs() {
    const resolved = this.resolvedMatchConfig;
    if (!resolved) {
      return [PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG] as const;
    }
    return [
      createFighterConfigForMatch(resolved, 1),
      createFighterConfigForMatch(resolved, 2),
    ] as const;
  }

  private resolveLegacyBattleConfig(data?: BattleSceneData): LegacyResolvedBattleConfig {
    const mode = data?.mode === 'PVC' ? 'PVC' : data?.mode === 'PVP' ? 'PVP' : DEFAULT_LEGACY_CONFIG.mode;
    const aiPlayer: 1 | 2 = data?.aiPlayer === 1 ? 1 : 2;
    const difficulty = data?.difficulty ?? DEFAULT_LEGACY_CONFIG.difficulty;
    const personality = data?.personality ?? DEFAULT_LEGACY_CONFIG.personality;
    const seed = typeof data?.seed === 'number' && Number.isFinite(data.seed) ? (data.seed >>> 0) : DEFAULT_LEGACY_CONFIG.seed;
    return { mode, difficulty, personality, aiPlayer, seed };
  }

  private legacyFromResolved(resolved: ResolvedMatchConfig): LegacyResolvedBattleConfig {
    const mode = resolved.cpuEnabled ? 'PVC' : 'PVP';
    return {
      mode,
      difficulty: resolved.cpuDifficulty,
      personality: resolved.cpuPersonality,
      aiPlayer: resolved.cpuPlayer,
      seed: resolved.seed,
    };
  }

  private setupControllers(): void {
    if (!this.inputManager) return;
    const resolved = this.resolvedMatchConfig;
    const cpuPlayers = new Set<PlayerNumber>();

    if (resolved) {
      for (const p of resolved.cpuPlayers) cpuPlayers.add(p);
    } else if (this.legacyBattleConfig.mode === 'PVC') {
      cpuPlayers.add(this.legacyBattleConfig.aiPlayer);
    }

    const humanPlayers: PlayerNumber[] = ([1, 2] as const).filter((p) => !cpuPlayers.has(p));
    this.keyboardController = new KeyboardController(window, this.inputManager, {
      preventDefault: true,
      enabledPlayers: humanPlayers.length > 0 ? humanPlayers : [1],
    });

    if (resolved) {
      for (const cpuPlayer of resolved.cpuPlayers) {
        this.aiControllers[cpuPlayer] = new AIController({
          controlledPlayer: cpuPlayer,
          difficulty: resolved.cpuDifficulty,
          personality: resolved.cpuPersonality,
          seed: resolved.seed + cpuPlayer * 97,
          debug: false,
        });
      }
    } else if (this.legacyBattleConfig.mode === 'PVC') {
      const aiPlayer = this.legacyBattleConfig.aiPlayer;
      this.aiControllers[aiPlayer] = new AIController({
        controlledPlayer: aiPlayer,
        difficulty: this.legacyBattleConfig.difficulty,
        personality: this.legacyBattleConfig.personality,
        seed: this.legacyBattleConfig.seed,
        debug: false,
      });
    }
  }

  private getPrimaryAIController(): AIController | null {
    return this.aiControllers[1] ?? this.aiControllers[2] ?? null;
  }

  private applyHudModeLabels(): void {
    if (!this.hud || !this.match) return;
    const [f1, f2] = this.match.fighters;
    const ai = this.getPrimaryAIController();
    const resolved = this.resolvedMatchConfig;

    const p1Char = resolved ? getCharacterById(resolved.player1CharacterId) : null;
    const p2Char = resolved ? getCharacterById(resolved.player2CharacterId) : null;
    const p1Name = p1Char?.displayName ?? f1.displayName ?? f1.name;
    const p2Name = p2Char?.displayName ?? f2.displayName ?? f2.name;

    if (resolved?.cpuEnabled && resolved.cpuPlayer === 2) {
      this.hud.setSideLabels(`P1 // ${p1Name}`, `CPU // ${p2Name}`);
      this.hud.setControlHints(
        'P1  A/D MOVE   W JUMP   S CROUCH   F LIGHT   G HEAVY   T BLOCK   H/Y SPECIAL   Q DODGE',
        `CPU  ${resolved.cpuPersonality}  (${resolved.cpuDifficulty})`,
      );
    } else if (resolved?.cpuEnabled && resolved.cpuPlayer === 1) {
      this.hud.setSideLabels(`CPU // ${p1Name}`, `P2 // ${p2Name}`);
      this.hud.setControlHints(
        `CPU  ${resolved.cpuPersonality}  (${resolved.cpuDifficulty})`,
        'P2  LEFT/RIGHT MOVE   UP JUMP   DOWN CROUCH   J LIGHT   K HEAVY   O BLOCK   U/I SPECIAL   P DODGE',
      );
    } else if (ai) {
      const cpuLabel = `CPU P${ai.controlledPlayer} // ${ai.getProfile().difficulty}`;
      const p1Label = ai.controlledPlayer === 1 ? cpuLabel : `P1 // ${p1Name}`;
      const p2Label = ai.controlledPlayer === 2 ? cpuLabel : `P2 // ${p2Name}`;
      this.hud.setSideLabels(p1Label, p2Label);
      const p1Human = 'P1  A/D MOVE   W JUMP   S CROUCH   F LIGHT   G HEAVY   T BLOCK   H/Y SPECIAL   Q DODGE';
      const p2Human = 'P2  LEFT/RIGHT MOVE   UP JUMP   DOWN CROUCH   J LIGHT   K HEAVY   O BLOCK   U/I SPECIAL   P DODGE';
      const p1Cpu = `P1  CPU  ${ai.getProfile().personality}  (${ai.getProfile().difficulty})`;
      const p2Cpu = `P2  CPU  ${ai.getProfile().personality}  (${ai.getProfile().difficulty})`;
      this.hud.setControlHints(
        ai.controlledPlayer === 1 ? p1Cpu : p1Human,
        ai.controlledPlayer === 2 ? p2Cpu : p2Human,
      );
    } else {
      this.hud.setSideLabels(`P1 // ${p1Name}`, `P2 // ${p2Name}`);
      this.hud.setControlHints(
        'P1  A/D MOVE   W JUMP   S CROUCH   F LIGHT   G HEAVY   T BLOCK   H/Y SPECIAL   Q DODGE',
        'P2  LEFT/RIGHT MOVE   UP JUMP   DOWN CROUCH   J LIGHT   K HEAVY   O BLOCK   U/I SPECIAL   P DODGE',
      );
    }
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
    this.hud.setAnnouncement(this.paused ? null : this.match.announcement);

    const timerSeconds = this.match.roundTimerEnabled ? this.match.roundTimeRemainingSeconds : null;
    this.hud.setTimer(timerSeconds);
    const wins = this.match.roundsWon;
    this.hud.setRoundInfo(this.match.currentRound, wins[0] ?? 0, wins[1] ?? 0, this.match.roundsToWin);

    this.combatVfx?.update(this.match.activeProjectiles, elapsed);
    this.backdrop.update(elapsed);
    this.progressionToast?.update(this.time.now);

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
      this.transitionToResults();
    }
  }

  private readonly handleFixedUpdate = (): void => {
    if (!this.match || !this.inputManager) {
      return;
    }

    if (this.paused) {
      // Consume buffered input edges while paused to avoid accidental actions on resume.
      this.inputManager.poll();
      return;
    }

    const frozen = this.match.hitstopActive;
    const allowControl = this.match.controlsEnabled;

    // Track round transitions for stats
    const prevPhase = this.lastMatchPhase;
    this.updateAIControllers(allowControl, frozen);

    const inputs = this.inputManager.poll();
    const result = this.match.update(inputs);

    this.statsTracker.tick();
    this.statsTracker.onCombatEvents(result.events);

    this.handleCombatEvents(result.events);

    for (const hit of result.hits) {
      this.handleHit(hit);
    }

    this.syncVictoryPose();

    if (!frozen) {
      this.tickFighterAnimation(0);
      this.tickFighterAnimation(1);
    }

    // Detect phase transitions
    const newPhase = this.match.matchPhase;
    if (prevPhase !== 'ROUND_OVER' && newPhase === 'ROUND_OVER') {
      const rw = this.match.roundWinnerFighter;
      this.statsTracker.onRoundEnd(rw ? rw.playerNumber : null);
      this.audio?.playSfx('sfx-ko', { volume: 0.8 });
    }
    if (prevPhase !== 'FINISHED' && newPhase === 'FINISHED') {
      // If we jumped straight from FIGHTING to FINISHED (single round), count round end
      if (prevPhase !== 'ROUND_OVER') {
        const rw = this.match.roundWinnerFighter ?? this.match.winner;
        this.statsTracker.onRoundEnd(rw ? rw.playerNumber : null);
      }
      this.audio?.playSfx(this.match.winner ? 'sfx-match-end' : 'sfx-draw', { volume: 0.8 });
    }
    // Detect new round start (ROUND_OVER -> READY transition happens inside update when delay expires,
    // but we see it on next tick as READY with increased round number)
    if (prevPhase === 'ROUND_OVER' && newPhase === 'READY') {
      this.statsTracker.onRoundStart();
      this.hud?.clearCombo(1);
      this.hud?.clearCombo(2);
    }
    if (prevPhase === 'READY' && newPhase === 'FIGHT') {
      this.audio?.playSfx('sfx-fight', { volume: 0.8 });
    } else if (prevPhase === 'FIGHT' && newPhase === 'FIGHTING') {
      this.audio?.playSfx('sfx-round-start', { volume: 0.6 });
    }

    this.lastMatchPhase = newPhase;
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
    if (!views) return;

    const view = views[index];
    const tick = view.tickSimulation();

    if (tick.knockdownLanding) {
      this.combatVfx?.knockdownDust(view.fighter.x, ARENA_BOUNDS.groundY, view.fighter.config.color);
    } else if (tick.landed) {
      this.combatVfx?.landingDust(view.fighter.x, ARENA_BOUNDS.groundY, view.fighter.config.color);
    }
  }

  private syncVictoryPose(): void {
    if (!this.match || !this.fighterViews) return;

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
          this.audio?.playSfx(event.perfect ? 'sfx-perfect-guard' : 'sfx-block', {
            volume: event.perfect ? 0.7 : 0.5,
            minIntervalMs: 30,
          });
          if (this.screenShakeEnabled) {
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
          if (!attacker) break;
          this.hud?.showCombo(attacker.playerNumber, event.hits, event.damage);
          if (event.hits >= 2) {
            const victim = this.findFighter(event.victimId);
            if (victim) {
              this.combatVfx?.comboBurst(victim.x, victim.y - 104, attacker.config.color, event.hits);
            }
            this.hud?.showNotice(`${event.hits} HIT COMBO`, attacker.config.color);
            this.audio?.playSfx('sfx-combo', { volume: 0.45, minIntervalMs: 80 });
          }
          break;
        }
        case 'FIGHTER_DEFEATED': {
          const fighter = this.findFighter(event.fighterId);
          if (fighter) {
            this.combatVfx?.defeatBurst(fighter.x, fighter.y - 92, fighter.config.color);
          }
          this.hud?.clearCombo(1);
          this.hud?.clearCombo(2);
          break;
        }
        case 'COMBO_ENDED': {
          const attacker = this.findFighter(event.attackerId);
          if (attacker) this.hud?.clearCombo(attacker.playerNumber);
          break;
        }
        case 'DODGE_STARTED': {
          const fighter = this.findFighter(event.fighterId);
          if (fighter) {
            this.combatVfx?.dodgeTrail(fighter.x, fighter.y - 66, fighter.config.color);
          }
          this.audio?.playSfx('sfx-dodge', { volume: 0.45, minIntervalMs: 60 });
          break;
        }
        case 'SPECIAL_ATTACK_USED': {
          const fighter = this.findFighter(event.fighterId);
          if (fighter) {
            this.hud?.showNotice(event.attackName, fighter.config.color);
          }
          this.audio?.playSfx('sfx-special', { volume: 0.65, minIntervalMs: 80 });
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
    if (!this.fighterViews) return;

    const victimIndex = hit.victim.playerNumber === 1 ? 0 : 1;
    this.fighterViews[victimIndex].triggerHitFlash();

    const heavy = hit.attack.category !== 'LIGHT' || hit.attack.causesKnockdown;
    this.combatVfx?.hitImpact(hit.impactX, hit.impactY, hit.victim.config.color, heavy ? 1 : 0.55);
    this.audio?.playSfx(heavy ? 'sfx-hit-heavy' : 'sfx-hit-light', { volume: heavy ? 0.8 : 0.55, minIntervalMs: 25 });

    const sparks = hit.attacker.playerNumber === 1 ? this.hitSparks?.[0] : this.hitSparks?.[1];
    sparks?.emitParticleAt(hit.impactX, hit.impactY, hit.attack.causesKnockdown ? 16 : 8);

    if (hit.defeated) {
      if (this.screenShakeEnabled) {
        this.cameras.main.shake(240, 0.008);
      }
      if (!this.reducedMotion) {
        this.cameras.main.flash(160, 255, 110, 130);
      }
    } else if (hit.attack.causesKnockdown) {
      if (this.screenShakeEnabled) {
        this.cameras.main.shake(150, 0.0045);
      }
    } else if (this.screenShakeEnabled) {
      this.cameras.main.shake(70, 0.0012);
    }
  }

  private createHitSparks(color1 = PLAYER_ONE_CONFIG.color, color2 = PLAYER_TWO_CONFIG.color): void {
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

    this.hitSparks = [createEmitter(color1), createEmitter(color2)];
  }

  private toHudSnapshot(fighter: Fighter): HudFighterSnapshot {
    return {
      name: fighter.displayName ?? fighter.name,
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

  private transitionToResults(): void {
    if (this.transitioning || this.matchFinishedHandled) return;
    this.matchFinishedHandled = true;

    // If no resolved match config (legacy direct launch), fall back to in-scene behavior? no, go to menu/results-less.
    if (!this.resolvedMatchConfig || !this.match) {
      this.transitionToMenu();
      return;
    }

    const [f1, f2] = this.match.fighters;
    const p1Char = getCharacterById(this.resolvedMatchConfig.player1CharacterId);
    const p2Char = getCharacterById(this.resolvedMatchConfig.player2CharacterId);
    const arena = getArenaById(this.resolvedMatchConfig.resolvedArenaId);
    const winner = this.match.winner;
    const stats = this.statsTracker.getSnapshot();

    let arcadeOut = this.arcadeContext ?? undefined;

    // Apply progression once from profile-owner perspective (P1 human/local owner)
    try {
      const profile = getOrLoadProfile();
      const playerSlot: 1 | 2 = 1;
      const playerStats = stats.players[playerSlot - 1]!;
      const opponentSlot: 1 | 2 = playerSlot === 1 ? 2 : 1;
      const isArcade = this.resolvedMatchConfig.mode === 'ARCADE' && !!this.arcadeContext;
      const outcome: MatchProgressionInput['outcome'] = this.match.isDraw
        ? 'DRAW'
        : winner?.playerNumber === playerSlot
          ? 'WIN'
          : 'LOSS';
      const arcadeStageIndex = this.arcadeContext?.stageIndex ?? null;
      const arcadeRunId = this.arcadeContext?.run.runId ?? null;
      const isArcadeFinalStage = Boolean(
        isArcade && this.arcadeContext && this.arcadeContext.stageIndex >= this.arcadeContext.run.stages.length - 1,
      );

      // Update arcade run state in profile before achievement evaluation in progression for completion flags.
      if (isArcade && this.arcadeContext) {
        if (outcome === 'WIN') {
          arcadeOut = { ...this.arcadeContext, run: recordArcadeStageWin(profile, this.arcadeContext.run) };
        } else {
          // Draws/losses do not advance the stage; allow continue/retry via results flow.
          arcadeOut = { ...this.arcadeContext, run: recordArcadeStageLoss(profile, this.arcadeContext.run) };
        }
      }

      const input: MatchProgressionInput = {
        matchToken: this.matchToken,
        mode: this.resolvedMatchConfig.mode,
        playerCharacterId: this.resolvedMatchConfig.player1CharacterId,
        opponentCharacterId: this.resolvedMatchConfig.player2CharacterId,
        arenaId: this.resolvedMatchConfig.resolvedArenaId,
        outcome,
        durationSeconds: stats.durationSeconds,
        damageDealt: playerStats.damageDealt,
        damageReceived: playerStats.damageReceived,
        highestCombo: playerStats.highestCombo,
        totalSuccessfulCombos: playerStats.combos,
        perfectGuards: playerStats.perfectGuards,
        dodges: playerStats.dodges,
        specialAttacksUsed: playerStats.specialsUsed,
        roundsWon: this.match.roundsWon[playerSlot - 1] ?? 0,
        roundsLost: this.match.roundsWon[opponentSlot - 1] ?? 0,
        isArcadeStage: isArcade,
        arcadeRunId,
        arcadeStageIndex,
        isArcadeFinalStage: isArcade && outcome === 'WIN' && isArcadeFinalStage,
        difficulty: this.resolvedMatchConfig.cpuDifficulty,
        rematch: false,
      };
      applyMatchProgression(profile, input);
      // ensure arcade run state persisted if progression path didn't (it does save, but safe)
      if (isArcade) persistProfile(profile);
    } catch (err) {
      console.error('[BattleScene] Failed to apply progression', err);
    }

    const resultsData: ResultsSceneData = {
      config: this.resolvedMatchConfig,
      stats,
      winnerPlayer: winner?.playerNumber ?? null,
      winnerName: winner ? (winner.displayName ?? winner.name) : null,
      isDraw: this.match.isDraw,
      arenaName: arena?.name ?? 'Arena',
      p1Name: p1Char?.displayName ?? f1.displayName ?? f1.name,
      p2Name: p2Char?.displayName ?? f2.displayName ?? f2.name,
      p1Color: f1.config.color,
      p2Color: f2.config.color,
      roundsWon: this.match.roundsWon,
      matchToken: this.matchToken,
      arcade: arcadeOut,
      progressionApplied: true,
    };

    this.transitioning = true;
    this.cameras.main.fadeOut(360, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.RESULTS, resultsData);
    });
  }

  private transitionToMenu(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(240, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }

  private togglePause(): void {
    if (this.transitioning || this.resultShown || !this.match) return;
    if (this.match.isMatchOver || this.match.resultVisible) return;

    if (this.paused) {
      this.resumeFromPause();
    } else {
      this.enterPause();
    }
  }

  private enterPause(): void {
    if (this.paused) return;
    this.paused = true;
    this.audio?.playUi('ui-pause');
    if (this.inputManager) {
      // Clear held state to prevent stuck inputs; buffered edges are consumed while paused.
      this.inputManager.releaseAll();
    }
    this.createPauseOverlay();
  }

  private resumeFromPause(): void {
    if (!this.paused) return;
    this.paused = false;
    this.destroyPauseOverlay();
    this.audio?.playUi('ui-confirm');
  }

  private restartMatch(): void {
    if (this.transitioning) return;
    this.paused = false;
    this.destroyPauseOverlay();
    this.transitioning = true;
    this.audio?.playUi('ui-confirm');
    this.cameras.main.fadeOut(180, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const data = (this.scene.settings.data ?? {}) as BattleSceneData;
      this.scene.restart({ ...data, matchToken: this.createMatchToken() });
    });
  }

  private createPauseOverlay(): void {
    this.destroyPauseOverlay();

    const container = this.add.container(0, 0).setDepth(200).setScrollFactor(0);
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x040308, 0.68);
    const panel = this.add.graphics();
    panel.fillStyle(0x17111d, 0.96);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 220, GAME_HEIGHT / 2 - 180, 440, 360, 18);
    panel.lineStyle(2, COLORS.line, 0.9);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 220, GAME_HEIGHT / 2 - 180, 440, 360, 18);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 128, 'PAUSED', {
      fontFamily: FONTS.display,
      fontSize: '42px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 132, 'ESC: RESUME  •  R: RESTART  •  M: MENU', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: CSS_COLORS.muted,
      align: 'center',
    }).setOrigin(0.5);

    container.add([dim, panel, title, hint]);

    const makeBtn = (label: string, y: number, action: () => void): MenuButton => {
      const btn = new MenuButton(this, {
        x: GAME_WIDTH / 2,
        y,
        width: 280,
        height: 44,
        label,
        onClick: action,
      });
      btn.setDepth(201);
      container.add(btn);
      this.pauseButtons.push(btn);
      return btn;
    };

    makeBtn('RESUME', GAME_HEIGHT / 2 - 42, () => this.resumeFromPause());
    makeBtn('RESTART MATCH', GAME_HEIGHT / 2 + 16, () => this.restartMatch());
    makeBtn('MAIN MENU', GAME_HEIGHT / 2 + 74, () => {
      this.paused = false;
      this.destroyPauseOverlay();
      this.audio?.playUi('ui-confirm');
      this.transitionToMenu();
    });

    // Keyboard shortcuts for pause menu (non-consuming of simulation state)
    const onPauseKeys = (event: KeyboardEvent): void => {
      if (!this.paused) return;
      if (event.code === 'KeyR') this.restartMatch();
      if (event.code === 'KeyM') {
        this.paused = false;
        this.destroyPauseOverlay();
        this.audio?.playUi('ui-confirm');
        this.transitionToMenu();
      }
    };
    this.input.keyboard?.on('keydown', onPauseKeys);
    container.setData('pauseKeyListener', onPauseKeys);

    this.pauseContainer = container;
  }

  private destroyPauseOverlay(): void {
    if (this.pauseContainer) {
      const listener = this.pauseContainer.getData('pauseKeyListener') as ((event: KeyboardEvent) => void) | undefined;
      if (listener) this.input.keyboard?.off('keydown', listener);
    }
    for (const btn of this.pauseButtons) btn.destroy();
    this.pauseButtons = [];
    this.pauseContainer?.destroy(true);
    this.pauseContainer = null;
  }

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

    if (this.pauseKeyHandler) {
      this.input.keyboard?.off('keydown-ESC', this.pauseKeyHandler);
      this.pauseKeyHandler = null;
    }
    this.destroyPauseOverlay();
    this.paused = false;

    if (this.debugOverlay) {
      if (this.debugKeyHandler) {
        window.removeEventListener('keydown', this.debugKeyHandler);
        this.debugKeyHandler = null;
      }
      if (this.aiDebugKeyHandler) {
        window.removeEventListener('keydown', this.aiDebugKeyHandler);
        this.aiDebugKeyHandler = null;
      }
      this.debugOverlay.setEnabled(false);
    }
    this.debugOverlay = null;

    this.hitSparks = null;
    this.combatVfx?.destroy();
    this.combatVfx = null;
    this.fighterViews = null;
    this.match = null;
    this.hud = null;
    this.backdrop = null;
    this.progressionToast?.destroy();
    this.progressionToast = null;
    this.audio = null;
  }
}

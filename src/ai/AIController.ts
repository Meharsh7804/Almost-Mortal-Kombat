import type { ArenaBounds } from '../data/ArenaConfig';
import type { InputManager } from '../controllers/InputManager';
import type { CombatEngine } from '../combat/CombatEngine';
import type { Fighter } from '../entities/Fighter';
import { AIAdaptationTracker } from './AIAdaptation';
import { AIDecisionEngine } from './AIDecisionEngine';
import { AIInputController } from './AIInputController';
import { perceiveFight } from './AIPerception';
import { resolveAIProfile } from './AIProfiles';
import { createAIRandom, type AIRandomSource } from './AIRandom';
import type {
  AIDebugInfo,
  AIDifficulty,
  AIIntent,
  AIPersonality,
  AIPlannedAction,
  AIResolvedProfile,
  AITacticalSituation,
} from './AITypes';

export interface AIControllerConfig {
  readonly controlledPlayer: 1 | 2;
  readonly difficulty?: AIDifficulty;
  readonly personality?: AIPersonality;
  readonly seed?: number;
  readonly debug?: boolean;
}

interface PendingDecision {
  readonly executeAtTick: number;
  readonly action: AIPlannedAction;
}

const IDLE_ACTION: AIPlannedAction = {
  intent: 'IDLE',
  score: 0,
  commitmentFrames: 6,
  label: 'idle',
  reason: 'default',
};

/**
 * Per-fighter AI brain. Runs on fixed simulation ticks and emits simulated
 * inputs through the same InputManager used by human players.
 */
export class AIController {
  readonly controlledPlayer: 1 | 2;

  private readonly decisionEngine = new AIDecisionEngine();
  private readonly adaptation = new AIAdaptationTracker(180);
  private readonly inputController: AIInputController;
  private readonly random: AIRandomSource;

  private profile: AIResolvedProfile;
  private enabled = true;
  private debugEnabled = false;

  private currentAction: AIPlannedAction = IDLE_ACTION;
  private actionFrame = 0;
  private actionCommittedUntilTick = 0;
  private nextDecisionTick = 0;
  private pendingDecision: PendingDecision | null = null;

  private lastSituation: AITacticalSituation = 'NEUTRAL';
  private lastTopActions: { intent: AIIntent; score: number; label: string }[] = [];
  private lastSelectedScore = 0;
  private lastReason = 'init';

  private lastObservedOpponentState: string | null = null;
  private lastObservedOpponentAttackId: string | null = null;

  constructor(config: AIControllerConfig) {
    this.controlledPlayer = config.controlledPlayer;
    this.profile = resolveAIProfile(config.difficulty, config.personality);
    this.random = createAIRandom(config.seed ?? 1337 + config.controlledPlayer * 97);
    this.inputController = new AIInputController(config.controlledPlayer);
    this.debugEnabled = config.debug ?? false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  getProfile(): AIResolvedProfile {
    return this.profile;
  }

  setProfile(difficulty: AIDifficulty, personality: AIPersonality): void {
    this.profile = resolveAIProfile(difficulty, personality);
  }

  reset(input?: InputManager): void {
    this.currentAction = IDLE_ACTION;
    this.actionFrame = 0;
    this.actionCommittedUntilTick = 0;
    this.nextDecisionTick = 0;
    this.pendingDecision = null;
    this.lastSituation = 'NEUTRAL';
    this.lastTopActions = [];
    this.lastSelectedScore = 0;
    this.lastReason = 'reset';
    this.lastObservedOpponentState = null;
    this.lastObservedOpponentAttackId = null;
    this.adaptation.reset();
    if (input) {
      this.inputController.reset(input);
    }
  }

  /**
   * Fixed-tick AI update. Call before InputManager.poll() so emitted buttons
   * are consumed by the same combat/input pipeline as human controls.
   */
  update(params: {
    input: InputManager;
    self: Fighter;
    opponent: Fighter;
    arena: ArenaBounds;
    combat: CombatEngine;
    tick: number;
    allowControl: boolean;
    hitstopActive: boolean;
  }): void {
    const { input, self, opponent, arena, combat, tick, allowControl, hitstopActive } = params;

    if (!this.enabled || !allowControl || self.isDefeated) {
      this.inputController.reset(input);
      this.pendingDecision = null;
      this.currentAction = IDLE_ACTION;
      return;
    }

    // Hitstop freezes simulation; avoid consuming reaction/decision time as if
    // the fight were advancing. Keep held intent stable without re-emitting
    // one-shot press pulses on every frozen tick.
    if (hitstopActive) {
      this.inputController.applyIntent(
        this.currentAction.intent,
        input,
        opponent.x >= self.x ? 1 : -1,
        opponent.x >= self.x ? -1 : 1,
        Math.max(1, this.actionFrame),
      );
      return;
    }

    const perception = perceiveFight({
      self,
      opponent,
      arena,
      projectiles: combat.projectiles.active,
      tick,
      getCombo: (attackerId, victimId) => combat.getCombo(attackerId, victimId),
    });

    this.observeOpponent(perception.towardOpponent, opponent);

    const adaptation = this.adaptation.snapshot(this.profile.difficultyProfile.adaptationStrength);
    const context = {
      perception,
      situation: this.decisionEngine.determineSituation({
        perception,
        situation: 'NEUTRAL',
        profile: this.profile,
        adaptation,
      }),
      profile: this.profile,
      adaptation,
    } as const;
    this.lastSituation = context.situation;

    const forceHold = !perception.selfActionable;

    if (!forceHold) {
      if (this.pendingDecision && tick >= this.pendingDecision.executeAtTick) {
        this.currentAction = this.pendingDecision.action;
        this.lastSelectedScore = this.pendingDecision.action.score;
        this.lastReason = this.pendingDecision.action.reason;
        this.actionFrame = 0;
        this.actionCommittedUntilTick = tick + this.currentAction.commitmentFrames;
        this.pendingDecision = null;
      }

      const canReevaluate =
        this.pendingDecision === null &&
        tick >= this.nextDecisionTick &&
        tick >= this.actionCommittedUntilTick;

      const urgentThreat =
        perception.opponentAttack.highThreat && this.currentAction.intent === 'IDLE';
      const punishWindow =
        perception.opponentInRecovery && perception.opponentRecoveryFramesEstimate >= 6;

      if (
        canReevaluate ||
        (urgentThreat && tick >= this.nextDecisionTick - 1) ||
        (punishWindow && tick >= this.actionCommittedUntilTick)
      ) {
        const decision = this.decisionEngine.decide(context, this.random);
        this.lastTopActions = decision.scored
          .filter((s) => s.valid)
          .slice(0, 5)
          .map((s) => ({
            intent: s.intent,
            score: Number(s.score.toFixed(3)),
            label: s.label,
          }));

        const reactionDelay = Math.max(
          0,
          this.profile.difficultyProfile.reactionDelayFrames +
            this.random.jitter(this.profile.difficultyProfile.reactionJitterFrames),
        );
        const interval = Math.max(1, this.profile.difficultyProfile.decisionIntervalFrames);
        this.nextDecisionTick = tick + interval;

        if (reactionDelay <= 0 || urgentThreat) {
          this.currentAction = decision.chosen;
          this.lastSelectedScore = decision.chosen.score;
          this.lastReason = decision.chosen.reason;
          this.actionFrame = 0;
          this.actionCommittedUntilTick = tick + decision.chosen.commitmentFrames;
          this.pendingDecision = null;
        } else {
          this.pendingDecision = {
            executeAtTick: tick + reactionDelay,
            action: decision.chosen,
          };
        }
      }
    } else {
      // While in recovery/hitstun/attack animation, avoid incompatible actions.
      // During blockstun, preserve block intent so the fighter can continue
      // blocking on recovery when the button is still held.
      this.pendingDecision = null;
      if (self.isBlockstunned && self.isHoldingBlock) {
        this.currentAction = {
          intent: self.isCrouchBlocking ? 'BLOCK_CROUCH' : 'BLOCK_STAND',
          score: 0,
          commitmentFrames: 1,
          label: 'hold-block',
          reason: 'maintain guard through blockstun',
        };
      } else {
        this.currentAction = IDLE_ACTION;
        this.lastReason = 'recovering';
      }
      this.actionFrame = 0;
    }

    this.inputController.applyIntent(
      this.currentAction.intent,
      input,
      perception.towardOpponent,
      perception.awayFromOpponent,
      this.actionFrame,
    );
    this.actionFrame += 1;
  }

  getDebugInfo(tick: number, self: Fighter, opponent: Fighter): AIDebugInfo {
    const adaptation = this.adaptation.snapshot(this.profile.difficultyProfile.adaptationStrength);
    return {
      enabled: this.debugEnabled,
      controlledPlayer: this.controlledPlayer,
      difficulty: this.profile.difficulty,
      personality: this.profile.personality,
      situation: this.lastSituation,
      selectedAction: `${this.currentAction.intent} (${this.currentAction.label})`,
      selectedScore: this.lastSelectedScore,
      topActions: this.lastTopActions,
      reactionFramesRemaining: Math.max(0, (this.pendingDecision?.executeAtTick ?? tick) - tick),
      commitmentFramesRemaining: Math.max(0, this.actionCommittedUntilTick - tick),
      aiState: self.state,
      opponentObservedState: opponent.state,
      adaptation,
      lastReason: this.lastReason,
    };
  }

  private observeOpponent(towardOpponent: 1 | -1, opponent: Fighter): void {
    const attackView = opponent.getAttackView();
    const attackId = attackView?.definition.id ?? null;
    const attackStarted = attackId !== null && attackId !== this.lastObservedOpponentAttackId;
    const specialStarted =
      attackStarted &&
      (attackView?.definition.category === 'SPECIAL' || attackView?.definition.category === 'ULTIMATE');
    const lightStarted = attackStarted && attackView?.definition.category === 'LIGHT';
    const heavyStarted = attackStarted && attackView?.definition.category === 'HEAVY';
    const jumpPressed = opponent.state === 'JUMPING' && this.lastObservedOpponentState !== 'JUMPING';
    const dodgeStarted = opponent.state === 'DODGING' && this.lastObservedOpponentState !== 'DODGING';
    const blockHeld = opponent.isBlocking || opponent.isBlockstunned;
    const moving = Math.abs(opponent.velocityX) > 5;

    // Sample observable behavior events and periodic movement habits for bounded
    // adaptation without reading hidden inputs.
    if (
      jumpPressed ||
      lightStarted ||
      heavyStarted ||
      specialStarted ||
      dodgeStarted ||
      blockHeld ||
      moving
    ) {
      this.adaptation.observe(
        AIAdaptationTracker.sampleFromObservation(
          towardOpponent,
          opponent.velocityX,
          jumpPressed,
          lightStarted,
          heavyStarted,
          specialStarted,
          blockHeld,
          dodgeStarted,
          attackStarted ? attackId : null,
        ),
      );
    }

    this.lastObservedOpponentState = opponent.state;
    this.lastObservedOpponentAttackId = attackId;
  }
}

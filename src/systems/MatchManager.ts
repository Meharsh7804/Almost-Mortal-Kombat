import { CombatEngine, type CombatTickResult } from '../combat/CombatEngine';
import type { Projectile } from '../combat/ProjectileSystem';
import { FIXED_STEP_SECONDS, FIXED_TIMESTEP_HZ } from '../core/GameLoop';
import { ARENA_BOUNDS, type ArenaBounds } from '../data/ArenaConfig';
import { Fighter, type FighterConfig, type FighterControls } from '../entities/Fighter';
import type { InputSnapshot } from '../controllers/InputManager';

export type MatchPhase = 'READY' | 'FIGHT' | 'FIGHTING' | 'ROUND_OVER' | 'FINISHED';

export const MATCH_TIMING = Object.freeze({
  readyFrames: 90,
  fightBannerFrames: 45,
  resultDelayFrames: 55,
  roundOverDelayFrames: 90,
});

const EMPTY_RESULT: CombatTickResult = Object.freeze({
  hits: Object.freeze([]),
  events: Object.freeze([]),
  hitstopFrames: 0,
});

export interface MatchManagerOptions {
  readonly roundsToWin?: number;
  readonly roundTimerSeconds?: number;
}

export interface MatchStatsSnapshot {
  readonly roundsWon: readonly [number, number];
  readonly currentRound: number;
  readonly roundsToWin: number;
}

/**
 * Owns match/round flow: fighter construction, countdowns, simulation order,
 * timer/round wins, victory detection and restart. It never touches rendering;
 * scenes consume state and combat events.
 */
export class MatchManager {
  readonly fighters: readonly [Fighter, Fighter];

  private readonly arena: ArenaBounds;
  private readonly combat: CombatEngine;
  private readonly configuredRoundsToWin: number;
  private readonly configuredRoundTimerSeconds: number;

  private currentPhase: MatchPhase = 'READY';
  private phaseFrames = 0;
  private finishedFrames = 0;
  private roundOverFrames = 0;
  private hitstopRemaining = 0;
  private currentWinner: Fighter | null = null;
  private roundWinner: Fighter | null = null;
  private draw = false;
  private roundDraw = false;
  private timeUp = false;

  private roundNumber = 1;
  private roundWins: [number, number] = [0, 0];
  private roundTimeRemainingFrames = 0;

  constructor(
    configs: readonly [FighterConfig, FighterConfig],
    arena: ArenaBounds = ARENA_BOUNDS,
    combat: CombatEngine = new CombatEngine(),
    options: MatchManagerOptions = {},
  ) {
    this.arena = arena;
    this.combat = combat;
    this.configuredRoundsToWin = Math.max(1, Math.floor(options.roundsToWin ?? 1));
    this.configuredRoundTimerSeconds = Math.max(0, Math.floor(options.roundTimerSeconds ?? 0));
    this.roundTimeRemainingFrames = this.configuredRoundTimerSeconds * FIXED_TIMESTEP_HZ;
    this.fighters = [new Fighter(configs[0]), new Fighter(configs[1])];
    this.faceFighters();
  }

  get matchPhase(): MatchPhase {
    return this.currentPhase;
  }

  get controlsEnabled(): boolean {
    return this.currentPhase === 'FIGHT' || this.currentPhase === 'FIGHTING';
  }

  get announcement(): 'READY' | 'FIGHT' | 'K.O.' | 'TIME' | null {
    switch (this.currentPhase) {
      case 'READY':
        return 'READY';
      case 'FIGHT':
        return 'FIGHT';
      case 'ROUND_OVER':
        return this.timeUp ? 'TIME' : 'K.O.';
      case 'FINISHED':
        return this.timeUp ? 'TIME' : 'K.O.';
      case 'FIGHTING':
        return null;
    }
  }

  get stateLabel(): string {
    const roundLabel = `ROUND ${String(this.roundNumber).padStart(2, '0')}`;
    switch (this.currentPhase) {
      case 'READY':
        return 'STANDBY';
      case 'FIGHT':
        return 'FIGHT';
      case 'FIGHTING':
        return roundLabel;
      case 'ROUND_OVER':
        return this.roundDraw ? 'ROUND DRAW' : `${this.roundWinner?.displayName ?? this.roundWinner?.name ?? 'WINNER'} WINS ROUND`;
      case 'FINISHED':
        if (this.draw) return 'DOUBLE K.O.';
        if (this.configuredRoundsToWin > 1) return 'MATCH COMPLETE';
        return 'MATCH COMPLETE';
    }
  }

  get winner(): Fighter | null {
    return this.currentWinner;
  }

  get roundWinnerFighter(): Fighter | null {
    return this.roundWinner;
  }

  get isDraw(): boolean {
    return this.draw;
  }

  get isTimeUp(): boolean {
    return this.timeUp;
  }

  get hitstopActive(): boolean {
    return this.hitstopRemaining > 0;
  }

  get activeProjectiles(): readonly Projectile[] {
    return this.combat.projectiles.active;
  }

  get combatEngine(): CombatEngine {
    return this.combat;
  }

  getCombo(attackerId: string, victimId: string) {
    return this.combat.getCombo(attackerId, victimId);
  }

  get resultVisible(): boolean {
    return (
      this.currentPhase === 'FINISHED' && this.finishedFrames >= MATCH_TIMING.resultDelayFrames
    );
  }

  get finishedTicks(): number {
    return this.finishedFrames;
  }

  get currentRound(): number {
    return this.roundNumber;
  }

  get roundsToWin(): number {
    return this.configuredRoundsToWin;
  }

  get roundsWon(): readonly [number, number] {
    return [this.roundWins[0], this.roundWins[1]];
  }

  get roundTimeRemainingFramesValue(): number {
    return this.roundTimeRemainingFrames;
  }

  get roundTimeRemainingSeconds(): number {
    return Math.ceil(this.roundTimeRemainingFrames / FIXED_TIMESTEP_HZ);
  }

  get roundTimerEnabled(): boolean {
    return this.configuredRoundTimerSeconds > 0;
  }

  get isMatchOver(): boolean {
    return this.currentPhase === 'FINISHED';
  }

  get arenaBounds(): ArenaBounds {
    return this.arena;
  }

  get matchStatsSnapshot(): MatchStatsSnapshot {
    return {
      roundsWon: [this.roundWins[0], this.roundWins[1]],
      currentRound: this.roundNumber,
      roundsToWin: this.configuredRoundsToWin,
    };
  }

  update(inputs: readonly [InputSnapshot, InputSnapshot]): CombatTickResult {
    if (this.currentPhase === 'FINISHED') {
      this.finishedFrames += 1;
      this.stepVictoryScene();
      return EMPTY_RESULT;
    }

    if (this.currentPhase === 'ROUND_OVER') {
      this.roundOverFrames += 1;
      this.stepVictoryScene();
      if (this.roundOverFrames >= MATCH_TIMING.roundOverDelayFrames) {
        this.beginNextRound();
      }
      return EMPTY_RESULT;
    }

    this.phaseFrames += 1;

    if (this.currentPhase === 'READY') {
      if (this.phaseFrames >= MATCH_TIMING.readyFrames) {
        this.currentPhase = 'FIGHT';
        this.phaseFrames = 0;
      }
      return EMPTY_RESULT;
    }

    if (this.currentPhase === 'FIGHT') {
      if (this.phaseFrames >= MATCH_TIMING.fightBannerFrames) {
        this.currentPhase = 'FIGHTING';
        this.phaseFrames = 0;
      }
      // allow control during banner as before; timer starts once fighting begins
    }

    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining -= 1;
      this.bufferControls(this.fighters[0], inputs[0]);
      this.bufferControls(this.fighters[1], inputs[1]);
      return EMPTY_RESULT;
    }

    this.applyControls(this.fighters[0], inputs[0]);
    this.applyControls(this.fighters[1], inputs[1]);

    this.fighters[0].step(FIXED_STEP_SECONDS, this.arena);
    this.fighters[1].step(FIXED_STEP_SECONDS, this.arena);

    const result = this.combat.update(this.fighters, this.arena);

    if (result.hitstopFrames > 0) {
      this.hitstopRemaining = result.hitstopFrames;
    }

    if (this.currentPhase === 'FIGHTING') {
      this.tickRoundTimer();
    }

    this.finishIfNeeded();
    return result;
  }

  restart(): void {
    this.resetFightersForRound();
    this.combat.reset();
    this.currentPhase = 'READY';
    this.phaseFrames = 0;
    this.finishedFrames = 0;
    this.roundOverFrames = 0;
    this.hitstopRemaining = 0;
    this.currentWinner = null;
    this.roundWinner = null;
    this.draw = false;
    this.roundDraw = false;
    this.timeUp = false;
    this.roundNumber = 1;
    this.roundWins = [0, 0];
    this.roundTimeRemainingFrames = this.configuredRoundTimerSeconds * FIXED_TIMESTEP_HZ;
    this.faceFighters();
  }

  private beginNextRound(): void {
    this.resetFightersForRound();
    this.combat.reset();
    this.roundNumber += 1;
    this.currentPhase = 'READY';
    this.phaseFrames = 0;
    this.roundOverFrames = 0;
    this.hitstopRemaining = 0;
    this.roundWinner = null;
    this.roundDraw = false;
    this.timeUp = false;
    this.roundTimeRemainingFrames = this.configuredRoundTimerSeconds * FIXED_TIMESTEP_HZ;
    this.faceFighters();
  }

  private resetFightersForRound(): void {
    this.fighters[0].reset();
    this.fighters[1].reset();
  }

  private faceFighters(): void {
    const [first, second] = this.fighters;
    if (first.x <= second.x) {
      first.setFacing(1);
      second.setFacing(-1);
    } else {
      first.setFacing(-1);
      second.setFacing(1);
    }
  }

  private applyControls(fighter: Fighter, snapshot: InputSnapshot): void {
    fighter.applyControls(toFighterControls(snapshot));
  }

  private bufferControls(fighter: Fighter, snapshot: InputSnapshot): void {
    fighter.bufferControls(toFighterControls(snapshot));
  }

  private tickRoundTimer(): void {
    if (!this.roundTimerEnabled || this.currentPhase !== 'FIGHTING') {
      return;
    }
    if (this.roundTimeRemainingFrames <= 0) {
      return;
    }

    this.roundTimeRemainingFrames -= 1;
    if (this.roundTimeRemainingFrames <= 0) {
      this.roundTimeRemainingFrames = 0;
      this.timeUp = true;
      this.resolveRoundEndByTime();
    }
  }

  private resolveRoundEndByTime(): void {
    if (this.currentPhase === 'FINISHED' || this.currentPhase === 'ROUND_OVER') {
      return;
    }

    const [first, second] = this.fighters;
    if (first.health === second.health) {
      this.endRound(null, true);
      return;
    }
    this.endRound(first.health > second.health ? first : second, false);
  }

  private finishIfNeeded(): void {
    if (this.currentPhase === 'FINISHED' || this.currentPhase === 'ROUND_OVER') {
      return;
    }

    const [first, second] = this.fighters;
    const firstDown = first.health <= 0;
    const secondDown = second.health <= 0;
    if (!firstDown && !secondDown) {
      return;
    }

    if (firstDown && !first.isDefeated) {
      first.setDefeated();
    }
    if (secondDown && !second.isDefeated) {
      second.setDefeated();
    }

    this.timeUp = false;
    const roundDraw = firstDown && secondDown;
    const winner = roundDraw ? null : firstDown ? second : first;
    this.endRound(winner, roundDraw);
  }

  private endRound(winner: Fighter | null, roundDraw: boolean): void {
    this.roundWinner = winner;
    this.roundDraw = roundDraw;

    if (winner) {
      const idx = winner.playerNumber === 1 ? 0 : 1;
      this.roundWins[idx] += 1;
    }

    const [first, second] = this.fighters;
    first.cancelAttack();
    second.cancelAttack();
    first.clearInput();
    second.clearInput();
    this.hitstopRemaining = 0;

    const matchOver =
      this.roundWins[0] >= this.configuredRoundsToWin ||
      this.roundWins[1] >= this.configuredRoundsToWin ||
      // In single-round legacy mode, any round end ends the match.
      (this.configuredRoundsToWin <= 1 && (winner !== null || roundDraw));

    if (matchOver) {
      this.currentPhase = 'FINISHED';
      this.phaseFrames = 0;
      this.finishedFrames = 0;
      this.draw = this.determineMatchDraw();
      this.currentWinner = this.determineMatchWinner();
      return;
    }

    this.currentPhase = 'ROUND_OVER';
    this.phaseFrames = 0;
    this.roundOverFrames = 0;
  }

  private determineMatchWinner(): Fighter | null {
    if (this.roundWins[0] === this.roundWins[1]) {
      return null;
    }
    const winnerPlayer = this.roundWins[0] > this.roundWins[1] ? 1 : 2;
    return this.fighters[winnerPlayer - 1] ?? null;
  }

  private determineMatchDraw(): boolean {
    if (this.configuredRoundsToWin <= 1) {
      return this.roundDraw;
    }
    return this.roundWins[0] === this.roundWins[1] && (this.roundDraw || this.timeUp);
  }

  /** Keeps physics settling after the result; no new hits or controls. */
  private stepVictoryScene(): void {
    this.fighters[0].step(FIXED_STEP_SECONDS, this.arena);
    this.fighters[1].step(FIXED_STEP_SECONDS, this.arena);
    this.combat.updateFacing(this.fighters);
  }
}

function toFighterControls(snapshot: InputSnapshot): FighterControls {
  return {
    moveLeft: snapshot.held.left,
    moveRight: snapshot.held.right,
    crouch: snapshot.held.crouch,
    jumpPressed: snapshot.pressed.jump,
    lightPressed: snapshot.pressed.light,
    heavyPressed: snapshot.pressed.heavy,
    block: snapshot.held.block,
    blockPressed: snapshot.pressed.block,
    special1Pressed: snapshot.pressed.special1,
    special2Pressed: snapshot.pressed.special2,
    dodgePressed: snapshot.pressed.dodge,
  };
}

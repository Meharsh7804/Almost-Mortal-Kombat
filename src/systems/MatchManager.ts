import { CombatEngine, type CombatTickResult } from '../combat/CombatEngine';
import { FIXED_STEP_SECONDS } from '../core/GameLoop';
import { ARENA_BOUNDS, type ArenaBounds } from '../data/ArenaConfig';
import { Fighter, type FighterConfig, type FighterControls } from '../entities/Fighter';
import type { InputSnapshot } from '../controllers/InputManager';

export type MatchPhase = 'READY' | 'FIGHT' | 'FIGHTING' | 'FINISHED';

export const MATCH_TIMING = Object.freeze({
  readyFrames: 90,
  fightBannerFrames: 45,
  resultDelayFrames: 55,
});

const EMPTY_RESULT: CombatTickResult = Object.freeze({ hits: Object.freeze([]) });

/**
 * Owns a single-round match: fighter construction, the READY/FIGHT countdown,
 * simulation order, victory detection and restart. It never touches rendering;
 * the scene consumes its state and hit events.
 */
export class MatchManager {
  readonly fighters: readonly [Fighter, Fighter];

  private readonly arena: ArenaBounds;
  private readonly combat: CombatEngine;

  private currentPhase: MatchPhase = 'READY';
  private phaseFrames = 0;
  private finishedFrames = 0;
  private hitstopRemaining = 0;
  private currentWinner: Fighter | null = null;
  private draw = false;

  constructor(
    configs: readonly [FighterConfig, FighterConfig],
    arena: ArenaBounds = ARENA_BOUNDS,
    combat: CombatEngine = new CombatEngine(),
  ) {
    this.arena = arena;
    this.combat = combat;
    this.fighters = [new Fighter(configs[0]), new Fighter(configs[1])];
    this.faceFighters();
  }

  get matchPhase(): MatchPhase {
    return this.currentPhase;
  }

  get controlsEnabled(): boolean {
    return this.currentPhase === 'FIGHT' || this.currentPhase === 'FIGHTING';
  }

  get announcement(): 'READY' | 'FIGHT' | 'K.O.' | null {
    switch (this.currentPhase) {
      case 'READY':
        return 'READY';
      case 'FIGHT':
        return 'FIGHT';
      case 'FINISHED':
        return 'K.O.';
      case 'FIGHTING':
        return null;
    }
  }

  get stateLabel(): string {
    switch (this.currentPhase) {
      case 'READY':
        return 'STANDBY';
      case 'FIGHT':
        return 'FIGHT';
      case 'FIGHTING':
        return 'ROUND 01';
      case 'FINISHED':
        return this.draw ? 'DOUBLE K.O.' : 'MATCH COMPLETE';
    }
  }

  get winner(): Fighter | null {
    return this.currentWinner;
  }

  get isDraw(): boolean {
    return this.draw;
  }

  get hitstopActive(): boolean {
    return this.hitstopRemaining > 0;
  }

  get resultVisible(): boolean {
    return (
      this.currentPhase === 'FINISHED' && this.finishedFrames >= MATCH_TIMING.resultDelayFrames
    );
  }

  get finishedTicks(): number {
    return this.finishedFrames;
  }

  update(inputs: readonly [InputSnapshot, InputSnapshot]): CombatTickResult {
    if (this.currentPhase === 'FINISHED') {
      this.finishedFrames += 1;
      this.stepVictoryScene();
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

    if (this.currentPhase === 'FIGHT' && this.phaseFrames >= MATCH_TIMING.fightBannerFrames) {
      this.currentPhase = 'FIGHTING';
      this.phaseFrames = 0;
    }

    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining -= 1;
      return EMPTY_RESULT;
    }

    this.applyControls(this.fighters[0], inputs[0]);
    this.applyControls(this.fighters[1], inputs[1]);

    this.fighters[0].step(FIXED_STEP_SECONDS, this.arena);
    this.fighters[1].step(FIXED_STEP_SECONDS, this.arena);

    const result = this.combat.update(this.fighters, this.arena);

    if (result.hits.length > 0) {
      this.hitstopRemaining = Math.max(...result.hits.map((hit) => hit.attack.hitstopFrames));
    }

    this.finishIfNeeded();
    return result;
  }

  restart(): void {
    this.fighters[0].reset();
    this.fighters[1].reset();
    this.currentPhase = 'READY';
    this.phaseFrames = 0;
    this.finishedFrames = 0;
    this.hitstopRemaining = 0;
    this.currentWinner = null;
    this.draw = false;
    this.faceFighters();
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
    const controls: FighterControls = {
      moveLeft: snapshot.held.left,
      moveRight: snapshot.held.right,
      crouch: snapshot.held.crouch,
      jumpPressed: snapshot.pressed.jump,
      lightPressed: snapshot.pressed.light,
      heavyPressed: snapshot.pressed.heavy,
    };
    fighter.applyControls(controls);
  }

  private finishIfNeeded(): void {
    if (this.currentPhase === 'FINISHED') {
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

    this.currentPhase = 'FINISHED';
    this.phaseFrames = 0;
    this.finishedFrames = 0;
    this.hitstopRemaining = 0;
    this.draw = firstDown && secondDown;
    this.currentWinner = this.draw ? null : firstDown ? second : first;

    first.cancelAttack();
    second.cancelAttack();
    first.clearInput();
    second.clearInput();
  }

  /** Keeps physics settling after the result; no new hits or controls. */
  private stepVictoryScene(): void {
    this.fighters[0].step(FIXED_STEP_SECONDS, this.arena);
    this.fighters[1].step(FIXED_STEP_SECONDS, this.arena);
    this.combat.updateFacing(this.fighters);
  }
}

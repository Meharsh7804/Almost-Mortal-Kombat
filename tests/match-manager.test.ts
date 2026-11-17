import { describe, expect, it } from 'vitest';

import { applyHit } from '../src/combat/DamageSystem';
import { HEAVY_PUNCH, LIGHT_PUNCH } from '../src/combat/FrameData';
import type { InputSnapshot } from '../src/controllers/InputManager';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from '../src/data/FighterData';
import { MatchManager, MATCH_TIMING } from '../src/systems/MatchManager';
import { makeInput, neutralInputs } from './helpers';

function createMatch(): MatchManager {
  return new MatchManager([PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG], ARENA_BOUNDS);
}

function advance(
  match: MatchManager,
  updates: number,
  inputs: readonly [InputSnapshot, InputSnapshot] = neutralInputs(),
): void {
  for (let update = 0; update < updates; update += 1) {
    match.update(inputs);
  }
}

function advanceToFighting(match: MatchManager): void {
  let guard = 0;
  while (match.matchPhase !== 'FIGHTING' && guard < 500) {
    match.update(neutralInputs());
    guard += 1;
  }
  expect(match.matchPhase).toBe('FIGHTING');
}

describe('match flow', () => {
  it('starts in READY with a countdown and locked controls', () => {
    const match = createMatch();
    expect(match.matchPhase).toBe('READY');
    expect(match.announcement).toBe('READY');
    expect(match.stateLabel).toBe('STANDBY');
    expect(match.controlsEnabled).toBe(false);

    const startX = match.fighters[0].x;
    advance(match, 30, [
      makeInput({ right: true, jump: true }, { jump: true, light: true }),
      makeInput(),
    ]);

    expect(match.matchPhase).toBe('READY');
    expect(match.fighters[0].x).toBe(startX);
    expect(match.fighters[0].activeAttack).toBeNull();
    expect(match.fighters[0].state).toBe('IDLE');
  });

  it('transitions from READY to FIGHT and allows controls during the banner', () => {
    const match = createMatch();

    advance(match, MATCH_TIMING.readyFrames - 1);
    expect(match.matchPhase).toBe('READY');

    match.update(neutralInputs());
    expect(match.matchPhase).toBe('FIGHT');
    expect(match.announcement).toBe('FIGHT');
    expect(match.controlsEnabled).toBe(true);

    const startX = match.fighters[0].x;
    match.update([makeInput({ right: true }), makeInput()]);
    expect(match.fighters[0].x).toBeGreaterThan(startX);
  });

  it('enters FIGHTING after the banner and clears the announcement', () => {
    const match = createMatch();
    advance(match, MATCH_TIMING.readyFrames);
    expect(match.matchPhase).toBe('FIGHT');

    advance(match, MATCH_TIMING.fightBannerFrames - 1);
    expect(match.matchPhase).toBe('FIGHT');

    match.update(neutralInputs());
    expect(match.matchPhase).toBe('FIGHTING');
    expect(match.announcement).toBeNull();
    expect(match.stateLabel).toBe('ROUND 01');
    expect(match.controlsEnabled).toBe(true);
  });

  it('faces fighters toward each other automatically', () => {
    const match = createMatch();
    advanceToFighting(match);

    match.fighters[0].setHorizontalPosition(900);
    match.fighters[1].setHorizontalPosition(400);
    match.update(neutralInputs());

    expect(match.fighters[0].facing).toBe(-1);
    expect(match.fighters[1].facing).toBe(1);
  });

  it('pauses simulation during hitstop and resumes afterwards', () => {
    const match = createMatch();
    advanceToFighting(match);

    const attacker = match.fighters[0];
    const victim = match.fighters[1];
    attacker.setHorizontalPosition(500);
    victim.setHorizontalPosition(560);

    match.update([makeInput({}, { light: true }), makeInput()]);
    advance(match, LIGHT_PUNCH.startupFrames - 1);
    expect(attacker.activeAttack?.frame).toBe(LIGHT_PUNCH.startupFrames);

    const hitResult = match.update(neutralInputs());
    expect(hitResult.hits).toHaveLength(1);
    expect(victim.health).toBe(95);
    expect(match.hitstopActive).toBe(true);

    const frozenFrame = attacker.activeAttack?.frame;
    const frozenX = victim.x;
    match.update(neutralInputs());
    expect(match.hitstopActive).toBe(true);
    match.update(neutralInputs());

    expect(match.hitstopActive).toBe(false);
    expect(attacker.activeAttack?.frame).toBe(frozenFrame);
    expect(victim.x).toBe(frozenX);

    match.update(neutralInputs());
    expect(victim.x).toBeGreaterThan(frozenX);
  });

  it('ends the match with a winner and delays the result overlay', () => {
    const match = createMatch();
    advanceToFighting(match);

    const winner = match.fighters[0];
    const victim = match.fighters[1];
    victim.takeDamage(99);
    const applied = applyHit(winner, victim, HEAVY_PUNCH);
    expect(applied.defeated).toBe(true);

    match.update(neutralInputs());

    expect(match.matchPhase).toBe('FINISHED');
    expect(match.winner).toBe(winner);
    expect(match.isDraw).toBe(false);
    expect(match.announcement).toBe('K.O.');
    expect(match.stateLabel).toBe('MATCH COMPLETE');
    expect(match.resultVisible).toBe(false);
    expect(match.controlsEnabled).toBe(false);

    advance(match, MATCH_TIMING.resultDelayFrames - 1);
    expect(match.resultVisible).toBe(false);

    match.update(neutralInputs());
    expect(match.resultVisible).toBe(true);
  });

  it('detects a double K.O. draw', () => {
    const match = createMatch();
    advanceToFighting(match);

    match.fighters[0].takeDamage(100);
    match.fighters[1].takeDamage(100);
    match.update(neutralInputs());

    expect(match.matchPhase).toBe('FINISHED');
    expect(match.isDraw).toBe(true);
    expect(match.winner).toBeNull();
    expect(match.stateLabel).toBe('DOUBLE K.O.');
    expect(match.fighters[0].isDefeated).toBe(true);
    expect(match.fighters[1].isDefeated).toBe(true);
  });

  it('locks controls after the match ends', () => {
    const match = createMatch();
    advanceToFighting(match);
    match.fighters[1].takeDamage(100);
    match.update(neutralInputs());

    const winner = match.fighters[0];
    const winnerX = winner.x;
    advance(match, 10, [makeInput({ right: true }), makeInput()]);

    expect(match.matchPhase).toBe('FINISHED');
    expect(winner.x).toBe(winnerX);
  });

  it('restores the initial match state on restart', () => {
    const match = createMatch();
    advanceToFighting(match);
    match.fighters[1].takeDamage(100);
    match.update(neutralInputs());
    advance(match, MATCH_TIMING.resultDelayFrames);
    expect(match.resultVisible).toBe(true);

    match.restart();

    expect(match.matchPhase).toBe('READY');
    expect(match.announcement).toBe('READY');
    expect(match.winner).toBeNull();
    expect(match.isDraw).toBe(false);
    expect(match.resultVisible).toBe(false);
    expect(match.finishedTicks).toBe(0);
    expect(match.controlsEnabled).toBe(false);

    expect(match.fighters[0].x).toBe(PLAYER_ONE_CONFIG.x);
    expect(match.fighters[1].x).toBe(PLAYER_TWO_CONFIG.x);
    expect(match.fighters[0].health).toBe(PLAYER_ONE_CONFIG.maxHealth);
    expect(match.fighters[1].health).toBe(PLAYER_TWO_CONFIG.maxHealth);
    expect(match.fighters[0].state).toBe('IDLE');
    expect(match.fighters[1].state).toBe('IDLE');
    expect(match.fighters[0].facing).toBe(1);
    expect(match.fighters[1].facing).toBe(-1);
  });
});

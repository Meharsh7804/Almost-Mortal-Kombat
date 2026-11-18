import { describe, expect, it } from 'vitest';

import { CombatEngine } from '../src/combat/CombatEngine';
import { HEAVY_PUNCH, LIGHT_PUNCH } from '../src/combat/FrameData';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { perceiveFight } from '../src/ai/AIPerception';
import { createFighter } from './helpers';

describe('AI perception', () => {
  it('derives spacing, ranges, and facing context from observable fight state', () => {
    const self = createFighter(1, 400);
    const opponent = createFighter(2, 500);
    self.faceTowards(opponent.x);
    opponent.faceTowards(self.x);

    const snapshot = perceiveFight({
      self,
      opponent,
      arena: ARENA_BOUNDS,
      projectiles: [],
      tick: 10,
    });

    expect(snapshot.absDistanceX).toBe(100);
    expect(snapshot.towardOpponent).toBe(1);
    expect(snapshot.awayFromOpponent).toBe(-1);
    expect(snapshot.inLightRange).toBe(true);
    expect(snapshot.selfActionable).toBe(true);
    expect(snapshot.opponentAttack.active).toBe(false);
  });

  it('detects active attack threats and recovery windows', () => {
    const self = createFighter(1, 500);
    const opponent = createFighter(2, 560);
    self.faceTowards(opponent.x);
    opponent.faceTowards(self.x);

    expect(opponent.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    for (let i = 0; i < LIGHT_PUNCH.startupFrames; i += 1) {
      opponent.tickAttack();
    }

    const threatened = perceiveFight({
      self,
      opponent,
      arena: ARENA_BOUNDS,
      projectiles: [],
      tick: 20,
    });
    expect(threatened.opponentAttack.attack?.id).toBe(LIGHT_PUNCH.id);
    expect(threatened.opponentAttack.framesUntilImpactEstimate).toBe(0);

    const combat = new CombatEngine();
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    attacker.faceTowards(victim.x);
    victim.faceTowards(attacker.x);
    expect(attacker.tryStartAttack(HEAVY_PUNCH)).toBe(true);
    // Advance until recovery (heavy startup+active = 18 frames of attack ticks after start)
    for (let i = 0; i < HEAVY_PUNCH.startupFrames + HEAVY_PUNCH.activeFrames; i += 1) {
      attacker.tickAttack();
    }
    const recovery = perceiveFight({
      self: victim,
      opponent: attacker,
      arena: ARENA_BOUNDS,
      projectiles: combat.projectiles.active,
      tick: 30,
    });
    expect(recovery.opponentInRecovery).toBe(true);
    expect(recovery.opponentRecoveryFramesEstimate).toBeGreaterThan(0);
  });
});
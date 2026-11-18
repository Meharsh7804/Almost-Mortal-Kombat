import { describe, expect, it } from 'vitest';

import { MatchStatisticsTracker } from '../../src/systems/MatchStats';

describe('Phase 5 MatchStatisticsTracker', () => {
  it('tracks combat events, rounds and duration', () => {
    const tracker = new MatchStatisticsTracker();
    tracker.registerFighter('a', 1);
    tracker.registerFighter('b', 2);
    tracker.reset();
    tracker.onRoundStart();
    tracker.tick();
    tracker.tick();

    tracker.onCombatEvents([
      { type: 'ATTACK_CONNECTED', attackerId: 'a', victimId: 'b', attackId: 'light', damage: 10, comboHits: 1, impactX: 0, impactY: 0 },
      { type: 'COMBO_STARTED', attackerId: 'a', victimId: 'b', hits: 2, damage: 18 },
      { type: 'COMBO_UPDATED', attackerId: 'a', victimId: 'b', hits: 3, damage: 25 },
      { type: 'ATTACK_BLOCKED', attackerId: 'b', victimId: 'a', attackId: 'heavy', chipDamage: 2, perfect: true, impactX: 0, impactY: 0 },
      { type: 'DODGE_STARTED', fighterId: 'a', playerNumber: 1, direction: 1 },
      { type: 'SPECIAL_ATTACK_USED', fighterId: 'b', playerNumber: 2, attackId: 'sp', attackName: 'Special' },
      { type: 'COMBO_ENDED', attackerId: 'a', victimId: 'b', hits: 3, damage: 25 },
    ]);

    tracker.onRoundEnd(1);
    const snap = tracker.getSnapshot();

    expect(snap.totalRounds).toBe(1);
    expect(snap.durationSeconds).toBeCloseTo(2 / 60, 5);
    expect(snap.players[0].roundsWon).toBe(1);
    expect(snap.players[0].hitsLanded).toBe(1);
    expect(snap.players[0].damageDealt).toBe(10);
    expect(snap.players[1].damageReceived).toBe(10);
    expect(snap.players[0].highestCombo).toBe(3);
    expect(snap.players[0].highestComboDamage).toBe(25);
    expect(snap.players[0].combos).toBe(1);
    expect(snap.players[0].dodges).toBe(1);
    expect(snap.players[1].specialsUsed).toBe(1);
    expect(snap.players[1].hitsBlockedByOpponent).toBe(1);
    expect(snap.players[0].perfectGuards).toBeGreaterThanOrEqual(1);
  });
});

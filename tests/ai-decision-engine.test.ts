import { describe, expect, it } from 'vitest';

import { AIDecisionEngine } from '../src/ai/AIDecisionEngine';
import { perceiveFight } from '../src/ai/AIPerception';
import { resolveAIProfile } from '../src/ai/AIProfiles';
import { createAIRandom } from '../src/ai/AIRandom';
import type { AIContext } from '../src/ai/AITypes';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { LIGHT_PUNCH } from '../src/combat/FrameData';
import { createFighter } from './helpers';

function emptyAdaptation() {
  return {
    samples: 0,
    lightAttackRate: 0,
    heavyAttackRate: 0,
    jumpRate: 0,
    specialRate: 0,
    blockRate: 0,
    dodgeRate: 0,
    forwardRate: 0,
    retreatRate: 0,
    repeatedStarterRate: 0,
    recentPattern: null,
    antiHeavyBias: 0,
    antiJumpBias: 0,
    antiBlockBias: 0,
    pressureBias: 0,
    patternBreakBias: 0,
  };
}

function contextFor(self: ReturnType<typeof createFighter>, opponent: ReturnType<typeof createFighter>, difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' = 'HARD', personality: 'AGGRESSOR' | 'DEFENDER' | 'TRICKSTER' | 'BRUISER' = 'AGGRESSOR'): AIContext {
  self.faceTowards(opponent.x);
  opponent.faceTowards(self.x);
  const perception = perceiveFight({ self, opponent, arena: ARENA_BOUNDS, projectiles: [], tick: 1 });
  const profile = resolveAIProfile(difficulty, personality);
  const engine = new AIDecisionEngine();
  const adaptation = emptyAdaptation();
  return {
    perception,
    situation: engine.determineSituation({ perception, situation: 'NEUTRAL', profile, adaptation }),
    profile,
    adaptation,
  };
}

describe('AI decision engine', () => {
  it('identifies punish opportunities when opponent is in recovery', () => {
    const engine = new AIDecisionEngine();
    const self = createFighter(1, 500);
    const opponent = createFighter(2, 560);

    expect(opponent.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    for (let i = 0; i < LIGHT_PUNCH.startupFrames + LIGHT_PUNCH.activeFrames; i += 1) {
      opponent.tickAttack();
    }

    const ctx = contextFor(self, opponent, 'HARD', 'AGGRESSOR');
    expect(ctx.situation).toBe('OPPONENT_RECOVERY');
    const decision = engine.decide(ctx, createAIRandom(7));
    expect(decision.scored.some((s) => s.valid && s.intent.startsWith('PUNISH'))).toBe(true);
  });

  it('prefers defensive responses under active threat over blind attacks', () => {
    const engine = new AIDecisionEngine();
    const self = createFighter(1, 500);
    const opponent = createFighter(2, 560);
    expect(opponent.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    for (let i = 0; i < LIGHT_PUNCH.startupFrames; i += 1) {
      opponent.tickAttack();
    }

    const ctx = contextFor(self, opponent, 'HARD', 'DEFENDER');
    expect(ctx.situation).toBe('OPPONENT_ATTACK');
    const decision = engine.decide(ctx, createAIRandom(11));
    const top = decision.chosen.intent;
    expect(['BLOCK_STAND', 'BLOCK_CROUCH', 'DODGE_BACKWARD', 'DODGE_FORWARD', 'PERFECT_GUARD_STAND', 'PERFECT_GUARD_CROUCH']).toContain(top);
  });

  it('is deterministic for the same seed and context', () => {
    const engine = new AIDecisionEngine();
    const self = createFighter(1, 500);
    const opponent = createFighter(2, 560);
    const ctx = contextFor(self, opponent, 'NORMAL', 'AGGRESSOR');
    const a = engine.decide(ctx, createAIRandom(99));
    const b = engine.decide(ctx, createAIRandom(99));
    expect(a.chosen.intent).toBe(b.chosen.intent);
    expect(a.scored.slice(0, 3).map((s) => s.intent)).toEqual(b.scored.slice(0, 3).map((s) => s.intent));
  });

  it('does not choose unavailable actions', () => {
    const engine = new AIDecisionEngine();
    const self = createFighter(1, 500);
    const opponent = createFighter(2, 560);
    self.spendEnergy(self.energy); // cannot afford specials/dodge costs depending on config
    const ctx = contextFor(self, opponent, 'HARD', 'BRUISER');
    const decision = engine.decide(ctx, createAIRandom(5));
    const invalidSelected = decision.scored.find((s) => s.intent === decision.chosen.intent && !s.valid);
    expect(invalidSelected).toBeUndefined();
  });
});
import type { AIAdaptationSnapshot } from './AITypes';

interface BehaviorSample {
  readonly light: number;
  readonly heavy: number;
  readonly jump: number;
  readonly special: number;
  readonly block: number;
  readonly dodge: number;
  readonly forward: number;
  readonly retreat: number;
  readonly starterId: string | null;
}

const EMPTY: AIAdaptationSnapshot = Object.freeze({
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
});

/**
 * Lightweight, bounded, reversible tracker for observable opponent habits.
 * It records one sample per observation tick and derives gradual biases only
 * from observed actions/movement (no hidden inputs/state).
 */
export class AIAdaptationTracker {
  private readonly windowSize: number;
  private readonly samples: BehaviorSample[] = [];

  constructor(windowSize = 180) {
    this.windowSize = Math.max(30, windowSize);
  }

  observe(sample: BehaviorSample): void {
    this.samples.push(sample);
    if (this.samples.length > this.windowSize) {
      this.samples.splice(0, this.samples.length - this.windowSize);
    }
  }

  reset(): void {
    this.samples.length = 0;
  }

  snapshot(strength: number): AIAdaptationSnapshot {
    if (this.samples.length === 0 || strength <= 0) {
      return EMPTY;
    }

    const n = this.samples.length;
    let light = 0;
    let heavy = 0;
    let jump = 0;
    let special = 0;
    let block = 0;
    let dodge = 0;
    let forward = 0;
    let retreat = 0;
    const starterCounts = new Map<string, number>();
    let recentPattern: string | null = null;

    for (const s of this.samples) {
      light += s.light;
      heavy += s.heavy;
      jump += s.jump;
      special += s.special;
      block += s.block;
      dodge += s.dodge;
      forward += s.forward;
      retreat += s.retreat;
      if (s.starterId) {
        starterCounts.set(s.starterId, (starterCounts.get(s.starterId) ?? 0) + 1);
        recentPattern = s.starterId;
      }
    }

    const lightAttackRate = light / n;
    const heavyAttackRate = heavy / n;
    const jumpRate = jump / n;
    const specialRate = special / n;
    const blockRate = block / n;
    const dodgeRate = dodge / n;
    const forwardRate = forward / n;
    const retreatRate = retreat / n;

    let repeated = 0;
    for (const count of starterCounts.values()) {
      if (count > 1) {
        repeated += count - 1;
      }
    }
    const starterTotal = Math.max(1, light + heavy + special);
    const repeatedStarterRate = Math.min(1, repeated / starterTotal);

    // Bounded, gradual biases (scaled by difficulty adaptation strength).
    const clampBias = (value: number): number => Math.max(0, Math.min(0.45, value * strength));

    return {
      samples: n,
      lightAttackRate,
      heavyAttackRate,
      jumpRate,
      specialRate,
      blockRate,
      dodgeRate,
      forwardRate,
      retreatRate,
      repeatedStarterRate,
      recentPattern,
      antiHeavyBias: clampBias(Math.max(0, heavyAttackRate - 0.08) * 1.8),
      antiJumpBias: clampBias(Math.max(0, jumpRate - 0.05) * 2.4),
      antiBlockBias: clampBias(Math.max(0, blockRate - 0.2) * 1.4),
      pressureBias: clampBias(Math.max(0, retreatRate - forwardRate) * 1.2),
      patternBreakBias: clampBias(repeatedStarterRate * 1.6),
    };
  }

  static sampleFromObservation(
    towardOpponent: 1 | -1,
    opponentVelocityX: number,
    jumpPressed: boolean,
    lightStarted: boolean,
    heavyStarted: boolean,
    specialStarted: boolean,
    blockHeld: boolean,
    dodgeStarted: boolean,
    starterId: string | null,
  ): BehaviorSample {
    const movingToward = Math.sign(opponentVelocityX) === towardOpponent;
    const movingAway = Math.sign(opponentVelocityX) === -towardOpponent;
    return {
      light: lightStarted ? 1 : 0,
      heavy: heavyStarted ? 1 : 0,
      jump: jumpPressed ? 1 : 0,
      special: specialStarted ? 1 : 0,
      block: blockHeld ? 1 : 0,
      dodge: dodgeStarted ? 1 : 0,
      forward: movingToward ? 1 : 0,
      retreat: movingAway ? 1 : 0,
      starterId,
    };
  }
}

export const EMPTY_AI_ADAPTATION = EMPTY;

export interface AIRandomSource {
  next(): number;
  int(maxExclusive: number): number;
  float(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  jitter(maxAbs: number): number;
  clone(): AIRandomSource;
  getSeed(): number;
}

/** Small deterministic PRNG (mulberry32) for testable, seeded AI behavior. */
export function createAIRandom(seed = 1): AIRandomSource {
  let state = (seed >>> 0) || 1;
  const initial = state;

  const next = (): number => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(maxExclusive: number): number {
      if (maxExclusive <= 1) {
        return 0;
      }
      return Math.floor(next() * maxExclusive);
    },
    float(min: number, max: number): number {
      return min + (max - min) * next();
    },
    chance(probability: number): boolean {
      if (probability <= 0) {
        return false;
      }
      if (probability >= 1) {
        return true;
      }
      return next() < probability;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('Cannot pick from an empty array.');
      }
      return items[Math.floor(next() * items.length)] as T;
    },
    jitter(maxAbs: number): number {
      if (maxAbs <= 0) {
        return 0;
      }
      return Math.round((next() * 2 - 1) * maxAbs);
    },
    clone(): AIRandomSource {
      return createAIRandom(state);
    },
    getSeed(): number {
      return initial;
    },
  };
}

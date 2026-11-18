import { describe, expect, it } from 'vitest';

import { createAIRandom } from '../src/ai/AIRandom';

describe('AI random', () => {
  it('produces deterministic sequences for the same seed', () => {
    const a = createAIRandom(12345);
    const b = createAIRandom(12345);

    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());

    expect(seqA).toEqual(seqB);
  });

  it('supports deterministic derived helpers', () => {
    const a = createAIRandom(42);
    const b = createAIRandom(42);

    expect(a.int(10)).toBe(b.int(10));
    expect(a.float(1, 5)).toBe(b.float(1, 5));
    expect(a.chance(0.3)).toBe(b.chance(0.3));
    expect(a.pick(['x', 'y', 'z'])).toBe(b.pick(['x', 'y', 'z']));
    expect(a.jitter(4)).toBe(b.jitter(4));
  });
});
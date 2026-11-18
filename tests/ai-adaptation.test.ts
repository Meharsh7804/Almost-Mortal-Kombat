import { describe, expect, it } from 'vitest';

import { AIAdaptationTracker } from '../src/ai/AIAdaptation';

describe('AI adaptation tracker', () => {
  it('returns empty snapshot when disabled or unobserved', () => {
    const tracker = new AIAdaptationTracker(60);
    expect(tracker.snapshot(0).samples).toBe(0);
    expect(tracker.snapshot(0.5).samples).toBe(0);
  });

  it('derives bounded biases from repeated observable habits', () => {
    const tracker = new AIAdaptationTracker(60);

    for (let i = 0; i < 20; i += 1) {
      tracker.observe(
        AIAdaptationTracker.sampleFromObservation(
          1,
          200,
          i % 4 === 0,
          i % 5 === 0,
          i % 2 === 0,
          false,
          false,
          false,
          'heavy_punch',
        ),
      );
    }

    const snapshot = tracker.snapshot(0.6);
    expect(snapshot.samples).toBe(20);
    expect(snapshot.heavyAttackRate).toBeGreaterThan(0.3);
    expect(snapshot.jumpRate).toBeGreaterThan(0);
    expect(snapshot.antiHeavyBias).toBeGreaterThan(0);
    expect(snapshot.antiJumpBias).toBeGreaterThan(0);
    expect(snapshot.antiHeavyBias).toBeLessThanOrEqual(0.45);
    expect(snapshot.antiJumpBias).toBeLessThanOrEqual(0.45);
  });

  it('can be reset to clear learned tendencies', () => {
    const tracker = new AIAdaptationTracker(60);
    tracker.observe(
      AIAdaptationTracker.sampleFromObservation(1, -100, false, false, true, false, false, false, 'heavy'),
    );
    expect(tracker.snapshot(0.5).samples).toBe(1);
    tracker.reset();
    expect(tracker.snapshot(0.5).samples).toBe(0);
  });
});
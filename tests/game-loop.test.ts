import { describe, expect, it, vi } from 'vitest';

import {
  FIXED_TIMESTEP_HZ,
  FIXED_TIMESTEP_MS,
  GameLoop,
  MAX_CATCH_UP_STEPS,
  MAX_FRAME_DELTA_MS,
} from '../src/core/GameLoop';

describe('fixed timestep configuration', () => {
  it('targets 60 updates per second', () => {
    expect(FIXED_TIMESTEP_HZ).toBe(60);
    expect(FIXED_TIMESTEP_MS).toBeCloseTo(16.6667, 4);
    expect(FIXED_TIMESTEP_MS * FIXED_TIMESTEP_HZ).toBeCloseTo(1000, 10);
  });

  it('bounds catch-up work and clamped frame deltas', () => {
    expect(MAX_CATCH_UP_STEPS).toBeGreaterThan(0);
    expect(MAX_CATCH_UP_STEPS).toBeLessThanOrEqual(10);
    expect(MAX_FRAME_DELTA_MS).toBeGreaterThan(0);
    expect(MAX_FRAME_DELTA_MS).toBeLessThanOrEqual(1000);
  });
});

describe('GameLoop', () => {
  it('executes 60 fixed updates for one simulated second of 1ms frames', () => {
    const loop = new GameLoop();
    const ticks: number[] = [];
    loop.addFixedUpdate((frame) => {
      ticks.push(frame.tick);
    });

    for (let frame = 0; frame < 1000; frame += 1) {
      loop.update(1);
    }

    expect(loop.tick).toBe(60);
    expect(ticks).toHaveLength(60);
    expect(ticks[0]).toBe(1);
    expect(ticks.at(-1)).toBe(60);
    expect(loop.simulationTimeMs).toBeCloseTo(1000, 6);
  });

  it('executes exactly 60 updates for 60 frame deltas at the fixed rate', () => {
    const loop = new GameLoop();

    for (let frame = 0; frame < 60; frame += 1) {
      loop.update(FIXED_TIMESTEP_MS);
    }

    expect(loop.tick).toBe(60);
    expect(loop.pendingTimeMs).toBeLessThan(FIXED_TIMESTEP_MS);
  });

  it('accumulates partial frame time without frame-rate-dependent steps', () => {
    const loop = new GameLoop();

    expect(loop.update(FIXED_TIMESTEP_MS / 2)).toBe(0);
    expect(loop.tick).toBe(0);
    expect(loop.interpolationAlpha).toBeCloseTo(0.5, 6);

    expect(loop.update(FIXED_TIMESTEP_MS / 2)).toBe(1);
    expect(loop.tick).toBe(1);
    expect(loop.interpolationAlpha).toBeCloseTo(0, 6);
  });

  it('passes fixed delta and monotonic simulation time to subscribers', () => {
    const loop = new GameLoop();
    const frames: Array<{ tick: number; deltaMs: number; elapsedMs: number }> = [];

    loop.addFixedUpdate((frame) => {
      frames.push({
        tick: frame.tick,
        deltaMs: frame.deltaMs,
        elapsedMs: frame.elapsedMs,
      });
    });

    loop.update(FIXED_TIMESTEP_MS * 3);

    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual({
      tick: 1,
      deltaMs: FIXED_TIMESTEP_MS,
      elapsedMs: FIXED_TIMESTEP_MS,
    });
    expect(frames[2]?.tick).toBe(3);
    expect(frames[2]?.elapsedMs).toBeCloseTo(FIXED_TIMESTEP_MS * 3, 6);
  });

  it('clamps a single enormous frame and drops the catch-up backlog', () => {
    const loop = new GameLoop();

    const steps = loop.update(60_000);

    expect(steps).toBe(MAX_CATCH_UP_STEPS);
    expect(loop.tick).toBe(MAX_CATCH_UP_STEPS);
    expect(loop.pendingTimeMs).toBeLessThan(FIXED_TIMESTEP_MS);

    // Resuming afterwards must not replay the missed minute.
    loop.update(FIXED_TIMESTEP_MS);
    expect(loop.tick).toBe(MAX_CATCH_UP_STEPS + 1);
  });

  it('ignores zero, negative, NaN and infinite frame deltas', () => {
    const loop = new GameLoop();

    expect(loop.update(0)).toBe(0);
    expect(loop.update(-16)).toBe(0);
    expect(loop.update(Number.NaN)).toBe(0);
    expect(loop.update(Number.POSITIVE_INFINITY)).toBe(0);
    expect(loop.tick).toBe(0);
  });

  it('supports a custom simulation rate', () => {
    const loop = new GameLoop({ timestepHz: 30 });
    const handler = vi.fn();

    loop.addFixedUpdate(handler);

    expect(loop.fixedDeltaMs).toBeCloseTo(1000 / 30, 10);
    loop.update(1000 / 30);
    loop.update(1000 / 30);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(loop.simulationTimeSeconds).toBeCloseTo(2 / 30, 10);
  });

  it('supports unsubscribing and resetting without losing subscribers', () => {
    const loop = new GameLoop();
    const kept = vi.fn();
    const removed = vi.fn();
    const unsubscribe = loop.addFixedUpdate(removed);

    loop.addFixedUpdate(kept);
    unsubscribe();
    loop.update(FIXED_TIMESTEP_MS);

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);

    loop.reset();
    expect(loop.tick).toBe(0);
    expect(loop.simulationTimeMs).toBe(0);
    expect(loop.pendingTimeMs).toBe(0);

    loop.update(FIXED_TIMESTEP_MS);
    expect(kept).toHaveBeenCalledTimes(2);
  });

  it('validates constructor options', () => {
    expect(() => new GameLoop({ timestepHz: 0 })).toThrow(RangeError);
    expect(() => new GameLoop({ timestepHz: Number.NaN })).toThrow(RangeError);
    expect(() => new GameLoop({ maxCatchUpSteps: 0 })).toThrow(RangeError);
    expect(() => new GameLoop({ maxCatchUpSteps: 1.5 })).toThrow(RangeError);
    expect(() => new GameLoop({ maxFrameDeltaMs: -1 })).toThrow(RangeError);
  });
});

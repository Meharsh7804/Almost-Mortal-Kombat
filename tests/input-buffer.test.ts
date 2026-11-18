import { describe, expect, it } from 'vitest';

import { InputBuffer } from '../src/combat/InputBuffer';

describe('input buffer', () => {
  it('stores recent actions and expires them after the configured window', () => {
    const buffer = new InputBuffer(8);
    buffer.enqueue('light', 0);

    buffer.prune(8);
    expect(buffer.size).toBe(1);

    buffer.prune(9);
    expect(buffer.size).toBe(0);
  });

  it('consumes each entry exactly once', () => {
    const buffer = new InputBuffer(8);
    buffer.enqueue('heavy', 2);
    const entry = buffer.items[0];
    expect(entry).toBeDefined();

    expect(buffer.consume(entry!)).toBe(true);
    expect(buffer.size).toBe(0);
    expect(buffer.consume(entry!)).toBe(false);
  });

  it('preserves priority order and directional metadata', () => {
    const buffer = new InputBuffer(8);
    buffer.enqueue('light', 1);
    buffer.enqueue('dodge', 1, -1);
    buffer.enqueue('special1', 2, 1);

    expect(buffer.items.map((item) => item.action)).toEqual(['light', 'dodge', 'special1']);
    expect(buffer.items[1]?.direction).toBe(-1);
    expect(buffer.items[2]?.direction).toBe(1);
  });

  it('clears all pending entries', () => {
    const buffer = new InputBuffer(8);
    buffer.enqueue('jump', 0);
    buffer.enqueue('light', 0);
    buffer.clear();
    expect(buffer.size).toBe(0);
  });

  it('rejects invalid duration configuration', () => {
    expect(() => new InputBuffer(-1)).toThrow(RangeError);
    expect(() => new InputBuffer(Number.NaN)).toThrow(RangeError);
  });
});

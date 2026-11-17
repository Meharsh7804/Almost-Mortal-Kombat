import { describe, expect, it } from 'vitest';

import { InputManager } from '../src/controllers/InputManager';

describe('input manager', () => {
  it('reports held state and consumes press edges once', () => {
    const input = new InputManager();
    input.setButton(1, 'left', true);

    const first = input.poll();
    expect(first[0].held.left).toBe(true);
    expect(first[0].pressed.left).toBe(true);

    const second = input.poll();
    expect(second[0].held.left).toBe(true);
    expect(second[0].pressed.left).toBe(false);
  });

  it('creates a new press edge only after a release', () => {
    const input = new InputManager();

    input.setButton(1, 'light', true);
    expect(input.poll()[0].pressed.light).toBe(true);

    input.setButton(1, 'light', true);
    expect(input.poll()[0].pressed.light).toBe(false);

    input.setButton(1, 'light', false);
    expect(input.poll()[0].held.light).toBe(false);

    input.setButton(1, 'light', true);
    expect(input.poll()[0].pressed.light).toBe(true);
  });

  it('keeps players independent', () => {
    const input = new InputManager();
    input.setButton(1, 'jump', true);
    input.setButton(2, 'heavy', true);

    const [first, second] = input.poll();

    expect(first.pressed.jump).toBe(true);
    expect(first.pressed.heavy).toBe(false);
    expect(second.pressed.jump).toBe(false);
    expect(second.pressed.heavy).toBe(true);
  });

  it('stores multiple new presses from the same poll', () => {
    const input = new InputManager();
    input.setButton(1, 'light', true);
    input.setButton(1, 'heavy', true);
    input.setButton(2, 'jump', true);

    const [first, second] = input.poll();

    expect(first.pressed.light).toBe(true);
    expect(first.pressed.heavy).toBe(true);
    expect(second.pressed.jump).toBe(true);
  });

  it('reports held buttons without consuming them', () => {
    const input = new InputManager();
    input.setButton(2, 'crouch', true);

    expect(input.isHeld(2, 'crouch')).toBe(true);
    expect(input.isHeld(1, 'crouch')).toBe(false);

    const snapshot = input.poll();
    expect(snapshot[1].held.crouch).toBe(true);
    expect(input.isHeld(2, 'crouch')).toBe(true);
  });

  it('releases every held and pending button', () => {
    const input = new InputManager();
    input.setButton(1, 'right', true);
    input.setButton(2, 'heavy', true);

    input.releaseAll();

    const [first, second] = input.poll();
    expect(Object.values(first.held).some(Boolean)).toBe(false);
    expect(Object.values(first.pressed).some(Boolean)).toBe(false);
    expect(Object.values(second.held).some(Boolean)).toBe(false);
    expect(Object.values(second.pressed).some(Boolean)).toBe(false);
  });

  it('returns immutable snapshots', () => {
    const input = new InputManager();
    const [first] = input.poll();

    expect(Object.isFrozen(first.held)).toBe(true);
    expect(Object.isFrozen(first.pressed)).toBe(true);
  });
});

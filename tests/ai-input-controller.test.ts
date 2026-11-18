import { describe, expect, it } from 'vitest';

import { AIInputController } from '../src/ai/AIInputController';
import { InputManager } from '../src/controllers/InputManager';

describe('AI input controller', () => {
  it('maps movement intents to held directional inputs', () => {
    const manager = new InputManager();
    const ai = new AIInputController(2);

    ai.applyIntent('APPROACH', manager, -1, 1, 0);
    const snap = manager.poll()[1];
    expect(snap.held.left).toBe(true);
    expect(snap.held.right).toBe(false);
  });

  it('emits one-shot attack presses and releases them the same tick', () => {
    const manager = new InputManager();
    const ai = new AIInputController(1);

    ai.applyIntent('LIGHT_ATTACK', manager, 1, -1, 0);
    const first = manager.poll()[0];
    expect(first.pressed.light).toBe(true);
    expect(first.held.light).toBe(false);

    // no action next frame
    ai.applyIntent('IDLE', manager, 1, -1, 1);
    const second = manager.poll()[0];
    expect(second.pressed.light).toBe(false);
    expect(second.held.light).toBe(false);
  });

  it('holds block after an initial press for sustained defense intents', () => {
    const manager = new InputManager();
    const ai = new AIInputController(2);

    ai.applyIntent('BLOCK_STAND', manager, -1, 1, 0);
    const first = manager.poll()[1];
    expect(first.pressed.block).toBe(true);
    expect(first.held.block).toBe(true);

    ai.applyIntent('BLOCK_STAND', manager, -1, 1, 1);
    const second = manager.poll()[1];
    expect(second.pressed.block).toBe(false);
    expect(second.held.block).toBe(true);
  });

  it('resets all held buttons for its controlled player', () => {
    const manager = new InputManager();
    const ai = new AIInputController(1);

    ai.applyIntent('APPROACH', manager, 1, -1, 0);
    manager.poll();
    ai.reset(manager);
    const snap = manager.poll()[0];
    expect(Object.values(snap.held).every((v) => v === false)).toBe(true);
  });
});
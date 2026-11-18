import { describe, expect, it } from 'vitest';

import { AnimationController } from '../src/animation/AnimationController';
import { ANIMATION_DEFINITIONS } from '../src/animation/AnimationDefinitions';
import { ANIMATION_IDS, ANIMATION_PRIORITY } from '../src/animation/AnimationTypes';

describe('AnimationController', () => {
  it('starts idle and ignores identical requests without resetting time', () => {
    const controller = new AnimationController();

    for (let tick = 0; tick < 12; tick += 1) {
      controller.tick();
    }

    expect(controller.currentId).toBe('IDLE');
    expect(controller.elapsedFrames).toBe(12);
    expect(controller.request({ id: 'IDLE', key: 'idle' })).toBe(false);
    expect(controller.elapsedFrames).toBe(12);
  });

  it('advances one fixed tick at a time and wraps looping clips', () => {
    const controller = new AnimationController();
    controller.request({ id: 'WALK_FORWARD', key: 'walk' });

    for (let tick = 0; tick < 40; tick += 1) {
      controller.tick();
    }

    expect(controller.currentId).toBe('WALK_FORWARD');
    expect(controller.currentDefinition.loop).toBe(true);
    expect(controller.elapsedFrames).toBe(8);
    expect(controller.snapshot().normalizedTime).toBeCloseTo(8 / 32);
  });

  it('lets a higher-priority clip interrupt and blocks lower-priority ones until completion', () => {
    const controller = new AnimationController();

    expect(controller.request({ id: 'LIGHT_ATTACK', key: 'attack:1' })).toBe(true);
    controller.tick();
    expect(controller.request({ id: 'HEAVY_ATTACK', key: 'attack:2' })).toBe(true);
    expect(controller.currentId).toBe('HEAVY_ATTACK');

    // Fighters cannot act during recovery, so idle must wait for the clip.
    expect(controller.request({ id: 'IDLE', key: 'idle' })).toBe(false);

    for (let tick = 0; tick < 42; tick += 1) {
      controller.tick();
    }

    expect(controller.isComplete).toBe(true);
    expect(controller.request({ id: 'IDLE', key: 'idle' })).toBe(true);
  });

  it('lets gameplay leave looping locomotion and guard states immediately', () => {
    const controller = new AnimationController();

    controller.request({ id: 'WALK_FORWARD', key: 'walk-forward' });
    controller.tick();
    expect(controller.request({ id: 'IDLE', key: 'idle' })).toBe(true);

    controller.request({ id: 'BLOCK', key: 'block:1' });
    controller.tick();
    expect(controller.request({ id: 'WALK_BACKWARD', key: 'walk-backward' })).toBe(true);

    controller.request({ id: 'CROUCH', key: 'crouch' });
    controller.tick();
    expect(controller.request({ id: 'IDLE', key: 'idle' })).toBe(true);
  });

  it('restarts same-category attacks only when the gameplay instance changes', () => {
    const controller = new AnimationController();
    controller.request({ id: 'LIGHT_ATTACK', key: 'attack:light-punch:10' });
    controller.tick();

    expect(
      controller.request({ id: 'LIGHT_ATTACK', key: 'attack:light-punch:10' }),
    ).toBe(false);
    expect(controller.elapsedFrames).toBe(1);

    expect(
      controller.request({ id: 'LIGHT_ATTACK', key: 'attack:light-punch:18' }),
    ).toBe(true);
    expect(controller.elapsedFrames).toBe(0);
  });

  it('does not interrupt a committed clip with an equal-priority peer unless forced', () => {
    const controller = new AnimationController();
    controller.request({ id: 'DODGE_FORWARD', key: 'dodge:forward' });
    controller.tick();

    expect(controller.request({ id: 'DODGE_BACKWARD', key: 'dodge:back' })).toBe(false);
    expect(
      controller.request({ id: 'DODGE_BACKWARD', key: 'dodge:back', force: true }),
    ).toBe(true);
    expect(controller.currentId).toBe('DODGE_BACKWARD');
  });

  it('transitions a completed one-shot into its fallback exactly once', () => {
    const controller = new AnimationController();
    controller.request({ id: 'JUMP_START', key: 'jump-start' });

    for (let tick = 0; tick < 4; tick += 1) {
      const result = controller.tick();
      expect(result.completed).toBe(false);
      expect(result.snapshot.id).toBe('JUMP_START');
    }

    const result = controller.tick();
    expect(result.completed).toBe(true);
    expect(result.snapshot.id).toBe('JUMP_RISE');
    expect(controller.currentId).toBe('JUMP_RISE');
    expect(controller.elapsedFrames).toBe(0);
  });

  it('treats defeat as terminal even against forced visual requests', () => {
    const controller = new AnimationController();
    controller.request({ id: 'DEFEAT', key: 'defeat' });

    expect(controller.request({ id: 'GET_UP', key: 'get-up', force: true })).toBe(false);
    expect(controller.request({ id: 'VICTORY', key: 'victory', force: true })).toBe(false);
    expect(controller.currentId).toBe('DEFEAT');
  });

  it('uses the documented priority order for committed clips', () => {
    expect(ANIMATION_PRIORITY.DEFEAT).toBeGreaterThan(ANIMATION_PRIORITY.KNOCKDOWN);
    expect(ANIMATION_PRIORITY.KNOCKDOWN).toBeGreaterThan(ANIMATION_PRIORITY.HIT_REACTION);
    expect(ANIMATION_PRIORITY.HIT_REACTION).toBeGreaterThan(ANIMATION_PRIORITY.SPECIAL_ATTACK);
    expect(ANIMATION_PRIORITY.SPECIAL_ATTACK).toBeGreaterThan(ANIMATION_PRIORITY.HEAVY_ATTACK);
    expect(ANIMATION_PRIORITY.HEAVY_ATTACK).toBeGreaterThan(ANIMATION_PRIORITY.LIGHT_ATTACK);
    expect(ANIMATION_PRIORITY.PERFECT_GUARD).toBeGreaterThan(ANIMATION_PRIORITY.BLOCK);
    expect(ANIMATION_PRIORITY.BLOCK).toBeGreaterThan(ANIMATION_PRIORITY.DODGE_FORWARD);
    expect(ANIMATION_PRIORITY.DODGE_FORWARD).toBeGreaterThan(ANIMATION_PRIORITY.LANDING);
    expect(ANIMATION_PRIORITY.LANDING).toBeGreaterThan(ANIMATION_PRIORITY.JUMP_RISE);
    expect(ANIMATION_PRIORITY.JUMP_RISE).toBeGreaterThan(ANIMATION_PRIORITY.CROUCH);
    expect(ANIMATION_PRIORITY.CROUCH).toBeGreaterThan(ANIMATION_PRIORITY.WALK_FORWARD);
    expect(ANIMATION_PRIORITY.WALK_FORWARD).toBeGreaterThan(ANIMATION_PRIORITY.IDLE);
  });

  it('defines every animation id with a valid priority and duration', () => {
    expect(ANIMATION_IDS).toHaveLength(21);

    for (const id of ANIMATION_IDS) {
      const definition = ANIMATION_DEFINITIONS[id];
      expect(definition.id).toBe(id);
      expect(definition.priority).toBe(ANIMATION_PRIORITY[id]);
      expect(definition.durationFrames).toBeGreaterThan(0);
      expect(definition.transitionFrames).toBeGreaterThan(0);
      if (definition.fallback) {
        expect(ANIMATION_DEFINITIONS[definition.fallback]).toBeDefined();
      }
    }
  });

  it('is deterministic for an identical request sequence', () => {
    const first = new AnimationController();
    const second = new AnimationController();

    for (const controller of [first, second]) {
      controller.request({ id: 'WALK_FORWARD', key: 'walk' });
      for (let tick = 0; tick < 17; tick += 1) {
        controller.tick();
      }
      controller.request({ id: 'LIGHT_ATTACK', key: 'attack:1' });
      for (let tick = 0; tick < 7; tick += 1) {
        controller.tick();
      }
      controller.request({ id: 'IDLE', key: 'idle' });
      for (let tick = 0; tick < 30; tick += 1) {
        controller.tick();
      }
      controller.request({ id: 'IDLE', key: 'idle' });
      for (let tick = 0; tick < 9; tick += 1) {
        controller.tick();
      }
    }

    expect(first.snapshot()).toEqual(second.snapshot());
  });
});

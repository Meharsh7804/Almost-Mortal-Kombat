import { describe, expect, it } from 'vitest';

import { ANIMATION_PRIORITY, type AnimationId, type AnimationSnapshot } from '../src/animation/AnimationTypes';
import {
  attackPoseProgress,
  createNeutralPose,
  interpolatePose,
  ProceduralPoseSource,
  solveLegIk,
  type FighterPoseContext,
} from '../src/animation/ProceduralPose';
import { ENERGY_BLAST, HEAVY_PUNCH, LIGHT_PUNCH } from '../src/combat/FrameData';
import { KAI_VISUAL, RHEA_VISUAL } from '../src/data/CharacterVisuals';
import type { FighterAttackView } from '../src/entities/Fighter';

function snapshot(
  id: AnimationId,
  overrides: Partial<AnimationSnapshot> = {},
): AnimationSnapshot {
  return {
    id,
    key: id,
    priority: ANIMATION_PRIORITY[id],
    elapsedFrames: 0,
    durationFrames: 60,
    normalizedTime: 0,
    loop: true,
    complete: false,
    transitionSerial: 1,
    ...overrides,
  };
}

function context(
  id: AnimationId,
  overrides: Partial<FighterPoseContext> = {},
): FighterPoseContext {
  return {
    animation: snapshot(id),
    state: 'IDLE',
    facing: 1,
    velocityX: 0,
    velocityY: 0,
    grounded: true,
    attack: null,
    crouchBlocking: false,
    simulationTick: 10,
    ...overrides,
  };
}

function attackView(
  definition: FighterAttackView['definition'],
  phase: FighterAttackView['phase'],
  phaseProgress = 0.5,
): FighterAttackView {
  return { definition, phase, phaseProgress, overallProgress: 0.5 };
}

const source = new ProceduralPoseSource();

describe('procedural pose sampling', () => {
  it('is deterministic for identical observations', () => {
    const first = source.sample(context('IDLE', { simulationTick: 42 }), KAI_VISUAL);
    const second = source.sample(context('IDLE', { simulationTick: 42 }), KAI_VISUAL);

    expect(first).toEqual(second);
  });

  it('animates idle breathing from simulation ticks, not wall-clock time', () => {
    const early = source.sample(context('IDLE', { simulationTick: 0 }), KAI_VISUAL);
    const later = source.sample(context('IDLE', { simulationTick: 40 }), KAI_VISUAL);

    expect(early).not.toEqual(later);
    expect(later.hipOffsetY).not.toBeCloseTo(early.hipOffsetY, 5);
  });

  it('lowers the hips and head when crouching', () => {
    const idle = source.sample(context('IDLE'), KAI_VISUAL);
    const crouch = source.sample(context('CROUCH', { state: 'CROUCHING' }), KAI_VISUAL);

    expect(crouch.hipOffsetY).toBeGreaterThan(idle.hipOffsetY + 10);
    expect(crouch.torsoRotation).toBeGreaterThan(idle.torsoRotation);
  });

  it('drives walk joints through alternating strides', () => {
    const first = source.sample(
      context('WALK_FORWARD', {
        state: 'WALKING',
        velocityX: 300,
        animation: snapshot('WALK_FORWARD', { normalizedTime: 0.25 }),
      }),
      KAI_VISUAL,
    );
    const second = source.sample(
      context('WALK_FORWARD', {
        state: 'WALKING',
        velocityX: 300,
        animation: snapshot('WALK_FORWARD', { normalizedTime: 0.75 }),
      }),
      KAI_VISUAL,
    );

    expect(first.frontHipAngle).not.toBeCloseTo(second.frontHipAngle, 3);
    expect(first.backHipAngle).not.toBeCloseTo(second.backHipAngle, 3);
  });

  it('extends the striking arm from startup into the active frame', () => {
    const startup = source.sample(
      context('LIGHT_ATTACK', {
        state: 'ATTACKING',
        attack: attackView(LIGHT_PUNCH, 'STARTUP', 0.6),
      }),
      KAI_VISUAL,
    );
    const active = source.sample(
      context('LIGHT_ATTACK', {
        state: 'ATTACKING',
        attack: attackView(LIGHT_PUNCH, 'ACTIVE', 0),
      }),
      KAI_VISUAL,
    );

    expect(active.frontShoulderAngle).toBeLessThan(startup.frontShoulderAngle - 0.5);
    expect(active.scarfSway).toBeLessThan(startup.scarfSway);
  });

  it('uses both arms for a special energy blast', () => {
    const pose = source.sample(
      context('SPECIAL_ATTACK', {
        state: 'SPECIAL_ATTACK',
        attack: attackView(ENERGY_BLAST, 'ACTIVE', 0),
      }),
      KAI_VISUAL,
    );

    expect(pose.backShoulderAngle).toBeLessThan(-1.2);
    expect(pose.frontShoulderAngle).toBeLessThan(-1.2);
    expect(pose.auraIntensity).toBeGreaterThan(1.2);
  });

  it('reclines the body on knockdown and recovers upright', () => {
    const knockdown = source.sample(
      context('KNOCKDOWN', {
        state: 'KNOCKDOWN',
        animation: snapshot('KNOCKDOWN', { loop: false, normalizedTime: 1, complete: true }),
      }),
      KAI_VISUAL,
    );
    const standing = createNeutralPose(KAI_VISUAL);

    expect(knockdown.torsoRotation).toBeLessThan(-1);
    expect(knockdown.hipOffsetY).toBeGreaterThan(standing.hipOffsetY + 30);

    const recovered = source.sample(
      context('GET_UP', {
        animation: snapshot('GET_UP', { loop: false, normalizedTime: 1, complete: true }),
      }),
      KAI_VISUAL,
    );
    expect(recovered.hipOffsetY).toBeCloseTo(standing.hipOffsetY, 4);
    expect(recovered.frontShoulderAngle).toBeCloseTo(standing.frontShoulderAngle, 4);
  });

  it('produces visibly different silhouettes for Kai and Rhea', () => {
    const kai = source.sample(context('IDLE', { simulationTick: 12 }), KAI_VISUAL);
    const rhea = source.sample(context('IDLE', { simulationTick: 12 }), RHEA_VISUAL);

    expect(kai.hipOffsetY).not.toBeCloseTo(rhea.hipOffsetY, 4);
    expect(kai.frontShoulderAngle).not.toBeCloseTo(rhea.frontShoulderAngle, 4);
    expect(kai.auraIntensity).not.toBeCloseTo(rhea.auraIntensity, 4);
  });

  it('interpolates poses without overshoot at either endpoint', () => {
    const idle = createNeutralPose(KAI_VISUAL);
    const crouch = source.sample(context('CROUCH', { state: 'CROUCHING' }), KAI_VISUAL);

    expect(interpolatePose(idle, crouch, 0)).toEqual(idle);
    expect(interpolatePose(idle, crouch, 1)).toEqual(crouch);
    expect(interpolatePose(idle, crouch, 0.5).hipOffsetY).toBeGreaterThan(idle.hipOffsetY);
    expect(interpolatePose(idle, crouch, 0.5).hipOffsetY).toBeLessThan(crouch.hipOffsetY);
  });

  it('solves two-bone leg IK for reachable and overextended targets', () => {
    const reachable = solveLegIk(0, -70, 14, 0, 36, 38);
    const overextended = solveLegIk(0, -70, 200, 0, 36, 38);

    expect(Number.isFinite(reachable.hipAngle)).toBe(true);
    expect(reachable.kneeAngle).toBeGreaterThan(0);
    expect(Number.isFinite(overextended.hipAngle)).toBe(true);
    expect(overextended.kneeAngle).toBeGreaterThanOrEqual(0);
  });

  it('exposes the same attack extension curve used by the pose solver', () => {
    expect(attackPoseProgress('STARTUP', 0.8)).toBe(0);
    expect(attackPoseProgress('ACTIVE', 0.8)).toBe(1);
    expect(attackPoseProgress('RECOVERY', 0)).toBe(1);
    expect(attackPoseProgress('RECOVERY', 1)).toBe(0);
    expect(attackPoseProgress('COMPLETE', 0)).toBe(0);
  });

  it('keeps heavy attacks committed longer than light attacks', () => {
    const light = attackView(LIGHT_PUNCH, 'ACTIVE');
    const heavy = attackView(HEAVY_PUNCH, 'ACTIVE');
    const lightPose = source.sample(
      context('LIGHT_ATTACK', { state: 'ATTACKING', attack: light }),
      KAI_VISUAL,
    );
    const heavyPose = source.sample(
      context('HEAVY_ATTACK', { state: 'ATTACKING', attack: heavy }),
      KAI_VISUAL,
    );

    expect(heavyPose.hipOffsetY).toBeGreaterThan(lightPose.hipOffsetY);
    expect(heavyPose.auraIntensity).toBeGreaterThan(lightPose.auraIntensity);
  });
});

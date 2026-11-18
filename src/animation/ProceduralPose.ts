import type { AttackPhase } from '../combat/FrameData';
import type { CharacterVisualConfig } from '../data/CharacterVisuals';
import type { FighterAttackView, FacingDirection } from '../entities/Fighter';
import type { FighterState } from '../entities/FighterStateMachine';
import type { AnimationSnapshot } from './AnimationTypes';

export interface FighterPose {
  bodyOffsetX: number;
  bodyOffsetY: number;
  hipOffsetX: number;
  hipOffsetY: number;
  torsoRotation: number;
  headRotation: number;
  headOffsetX: number;
  headOffsetY: number;
  backHipAngle: number;
  backKneeAngle: number;
  backFootAngle: number;
  frontHipAngle: number;
  frontKneeAngle: number;
  frontFootAngle: number;
  backShoulderAngle: number;
  backElbowAngle: number;
  backHandAngle: number;
  frontShoulderAngle: number;
  frontElbowAngle: number;
  frontHandAngle: number;
  scarfSway: number;
  hairSway: number;
  auraIntensity: number;
}

export interface FighterPoseContext {
  readonly animation: AnimationSnapshot;
  readonly state: FighterState;
  readonly facing: FacingDirection;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly grounded: boolean;
  readonly attack: FighterAttackView | null;
  readonly crouchBlocking: boolean;
  readonly simulationTick: number;
}

/**
 * Render-source contract. A future sprite-sheet renderer can implement the
 * same sampling boundary while the procedural rig consumes `FighterPose`.
 */
export interface FighterPoseSource {
  sample(context: FighterPoseContext, config: CharacterVisualConfig): FighterPose;
}

export interface LegIkSolution {
  readonly hipAngle: number;
  readonly kneeAngle: number;
}

interface StanceOptions {
  readonly hipOffsetX?: number;
  readonly hipOffsetY: number;
  readonly backFootX: number;
  readonly backFootY?: number;
  readonly frontFootX: number;
  readonly frontFootY?: number;
  readonly backFootPitch?: number;
  readonly frontFootPitch?: number;
}

const TWO_PI = Math.PI * 2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smoothstep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function easeOutCubic(value: number): number {
  const clamped = clamp(value, 0, 1);
  return 1 - (1 - clamped) ** 3;
}

/**
 * Two-bone IK in the fighter's local coordinate space. Y grows downward, so a
 * hip angle of zero points the upper leg straight down. The knee is pushed
 * forward, matching the side-on fighting silhouette.
 */
export function solveLegIk(
  hipX: number,
  hipY: number,
  footX: number,
  footY: number,
  upperLength: number,
  lowerLength: number,
): LegIkSolution {
  const dx = footX - hipX;
  const dy = footY - hipY;
  const rawDistance = Math.hypot(dx, dy);
  const minimum = Math.abs(upperLength - lowerLength) + 0.001;
  const maximum = upperLength + lowerLength - 0.001;
  const distance = clamp(rawDistance, minimum, maximum);

  const baseAngle = Math.atan2(-dx, dy);
  const cosine =
    (upperLength * upperLength + distance * distance - lowerLength * lowerLength) /
    (2 * upperLength * distance);
  const alpha = Math.acos(clamp(cosine, -1, 1));

  return {
    hipAngle: baseAngle - alpha,
    kneeAngle: alpha * 2,
  };
}

export function createNeutralPose(config: CharacterVisualConfig): FighterPose {
  const pose: FighterPose = {
    bodyOffsetX: 0,
    bodyOffsetY: 0,
    hipOffsetX: 0,
    hipOffsetY: config.motion.idleStanceDrop,
    torsoRotation: 0.05,
    headRotation: -0.02,
    headOffsetX: 0,
    headOffsetY: 0,
    backHipAngle: 0,
    backKneeAngle: 0,
    backFootAngle: 0,
    frontHipAngle: 0,
    frontKneeAngle: 0,
    frontFootAngle: 0,
    backShoulderAngle: 0.22,
    backElbowAngle: -0.32,
    backHandAngle: 0,
    frontShoulderAngle: -0.3,
    frontElbowAngle: -0.55,
    frontHandAngle: 0,
    scarfSway: 0,
    hairSway: 0,
    auraIntensity: 0.6,
  };

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop,
    backFootX: -config.build.stanceWidth * 0.42,
    frontFootX: config.build.stanceWidth * 0.58,
  });

  return pose;
}

export function clonePose(pose: FighterPose): FighterPose {
  return { ...pose };
}

export function interpolatePose(
  from: FighterPose,
  to: FighterPose,
  amount: number,
): FighterPose {
  const t = clamp(amount, 0, 1);
  if (t <= 0) {
    return { ...from };
  }
  if (t >= 1) {
    return { ...to };
  }

  return {
    bodyOffsetX: lerp(from.bodyOffsetX, to.bodyOffsetX, t),
    bodyOffsetY: lerp(from.bodyOffsetY, to.bodyOffsetY, t),
    hipOffsetX: lerp(from.hipOffsetX, to.hipOffsetX, t),
    hipOffsetY: lerp(from.hipOffsetY, to.hipOffsetY, t),
    torsoRotation: lerp(from.torsoRotation, to.torsoRotation, t),
    headRotation: lerp(from.headRotation, to.headRotation, t),
    headOffsetX: lerp(from.headOffsetX, to.headOffsetX, t),
    headOffsetY: lerp(from.headOffsetY, to.headOffsetY, t),
    backHipAngle: lerp(from.backHipAngle, to.backHipAngle, t),
    backKneeAngle: lerp(from.backKneeAngle, to.backKneeAngle, t),
    backFootAngle: lerp(from.backFootAngle, to.backFootAngle, t),
    frontHipAngle: lerp(from.frontHipAngle, to.frontHipAngle, t),
    frontKneeAngle: lerp(from.frontKneeAngle, to.frontKneeAngle, t),
    frontFootAngle: lerp(from.frontFootAngle, to.frontFootAngle, t),
    backShoulderAngle: lerp(from.backShoulderAngle, to.backShoulderAngle, t),
    backElbowAngle: lerp(from.backElbowAngle, to.backElbowAngle, t),
    backHandAngle: lerp(from.backHandAngle, to.backHandAngle, t),
    frontShoulderAngle: lerp(from.frontShoulderAngle, to.frontShoulderAngle, t),
    frontElbowAngle: lerp(from.frontElbowAngle, to.frontElbowAngle, t),
    frontHandAngle: lerp(from.frontHandAngle, to.frontHandAngle, t),
    scarfSway: lerp(from.scarfSway, to.scarfSway, t),
    hairSway: lerp(from.hairSway, to.hairSway, t),
    auraIntensity: lerp(from.auraIntensity, to.auraIntensity, t),
  };
}

/**
 * Procedural pose library. Movement, anticipation, extension and recovery are
 * driven by the animation clock and the current combat lifecycle, never by CSS
 * timers or random values.
 */
export class ProceduralPoseSource implements FighterPoseSource {
  sample(context: FighterPoseContext, config: CharacterVisualConfig): FighterPose {
    const pose = createNeutralPose(config);

    switch (context.animation.id) {
      case 'IDLE':
        applyIdle(pose, context, config);
        break;
      case 'WALK_FORWARD':
      case 'WALK_BACKWARD':
        applyWalk(pose, context, config);
        break;
      case 'CROUCH':
        applyCrouch(pose, context, config);
        break;
      case 'BLOCK':
        applyBlock(pose, context, config);
        break;
      case 'PERFECT_GUARD':
        applyPerfectGuard(pose, context, config);
        break;
      case 'JUMP_START':
        applyJumpStart(pose, context, config);
        break;
      case 'JUMP_RISE':
        applyJumpAir(pose, context, config, true);
        break;
      case 'JUMP_FALL':
        applyJumpAir(pose, context, config, false);
        break;
      case 'LANDING':
        applyLanding(pose, context, config);
        break;
      case 'LIGHT_ATTACK':
      case 'HEAVY_ATTACK':
      case 'SPECIAL_ATTACK':
        applyAttack(pose, context, config);
        break;
      case 'DODGE_FORWARD':
      case 'DODGE_BACKWARD':
        applyDodge(pose, context, config);
        break;
      case 'HIT_REACTION':
        applyHitReaction(pose, context, config);
        break;
      case 'KNOCKBACK':
        applyKnockback(pose, context, config);
        break;
      case 'KNOCKDOWN':
        applyKnockdown(pose, context, config);
        break;
      case 'GET_UP':
        return sampleGetUp(context, config);
      case 'VICTORY':
        applyVictory(pose, context, config);
        break;
      case 'DEFEAT':
        applyDefeat(pose, context, config);
        break;
    }

    return pose;
  }
}

function applyStance(
  pose: FighterPose,
  config: CharacterVisualConfig,
  options: StanceOptions,
): void {
  const { build } = config;
  const hipOffsetX = options.hipOffsetX ?? 0;
  const hipY = -build.hipHeight + options.hipOffsetY;
  const backHipX = -build.hipSpread + hipOffsetX;
  const frontHipX = build.hipSpread + hipOffsetX;

  const back = solveLegIk(
    backHipX,
    hipY,
    options.backFootX,
    options.backFootY ?? 0,
    build.upperLegLength,
    build.lowerLegLength,
  );
  const front = solveLegIk(
    frontHipX,
    hipY,
    options.frontFootX,
    options.frontFootY ?? 0,
    build.upperLegLength,
    build.lowerLegLength,
  );

  pose.hipOffsetX = hipOffsetX;
  pose.hipOffsetY = options.hipOffsetY;
  pose.backHipAngle = back.hipAngle;
  pose.backKneeAngle = back.kneeAngle;
  pose.backFootAngle = -(back.hipAngle + back.kneeAngle) + (options.backFootPitch ?? 0);
  pose.frontHipAngle = front.hipAngle;
  pose.frontKneeAngle = front.kneeAngle;
  pose.frontFootAngle =
    -(front.hipAngle + front.kneeAngle) + (options.frontFootPitch ?? 0);
}

function applyIdle(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const phase = context.simulationTick * config.motion.idleSpeed + config.motion.idlePhase;
  const breath = Math.sin(phase) * config.motion.idleBreath;
  const sway = Math.sin(phase * 0.53 + 0.7) * config.motion.idleSway;

  applyStance(pose, config, {
    hipOffsetX: sway * 1.1,
    hipOffsetY: config.motion.idleStanceDrop + breath * 0.45,
    backFootX: -config.build.stanceWidth * 0.42,
    frontFootX: config.build.stanceWidth * 0.58,
  });

  pose.torsoRotation = 0.05 + breath * 0.012 + sway * 0.006;
  pose.headRotation = -0.02 + Math.sin(phase * 0.7) * 0.02;
  pose.headOffsetX = sway * 0.3;
  pose.backShoulderAngle = 0.22 + breath * 0.02;
  pose.backElbowAngle = -0.32 - breath * 0.02;
  pose.frontShoulderAngle = -0.3 - breath * 0.025;
  pose.frontElbowAngle = -0.55 + breath * 0.018;
  pose.scarfSway = Math.sin(phase * 0.8 + 1) * 0.1;
  pose.hairSway = Math.sin(phase * 0.9) * 0.08;
  pose.auraIntensity = 0.55 + Math.sin(phase) * 0.06;
}

function applyWalk(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const forward = context.animation.id === 'WALK_FORWARD';
  const t = context.animation.normalizedTime * TWO_PI * config.motion.walkCadence;
  const stride = Math.sin(t) * config.motion.walkStride * (forward ? 1 : -0.78);
  const liftBack = Math.max(0, Math.sin(t)) * 7;
  const liftFront = Math.max(0, -Math.sin(t)) * 7;
  const lean = forward ? config.motion.walkLean : config.motion.backWalkLean;

  applyStance(pose, config, {
    hipOffsetX: Math.sin(t) * 0.9,
    hipOffsetY:
      config.motion.idleStanceDrop +
      Math.abs(Math.sin(t)) * config.motion.walkBounce,
    backFootX: -config.build.stanceWidth * 0.42 + stride,
    backFootY: -liftBack,
    frontFootX: config.build.stanceWidth * 0.58 - stride,
    frontFootY: -liftFront,
    backFootPitch: 0.08,
    frontFootPitch: 0.08,
  });

  const swing = Math.sin(t) * config.motion.walkArmSwing * (forward ? 1 : -0.7);
  pose.torsoRotation = lean + Math.cos(t * 2) * 0.012;
  pose.headRotation = -lean * 0.35;
  pose.backShoulderAngle = 0.22 + swing;
  pose.backElbowAngle = -0.38 - Math.abs(swing) * 0.4;
  pose.frontShoulderAngle = -0.3 - swing;
  pose.frontElbowAngle = -0.6 - Math.abs(swing) * 0.35;
  pose.scarfSway = -lean * 1.4 + Math.sin(t * 1.7) * 0.08;
  pose.hairSway = Math.sin(t * 1.9) * 0.07;
  pose.auraIntensity = 0.62;
}

function applyCrouch(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const breath = Math.sin(
    context.simulationTick * config.motion.idleSpeed * 0.8 + config.motion.idlePhase,
  );

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 19 + breath * 0.4,
    backFootX: -config.build.stanceWidth * 0.55,
    frontFootX: config.build.stanceWidth * 0.7,
  });

  pose.torsoRotation = 0.24;
  pose.headRotation = -0.12;
  pose.headOffsetY = 1;
  pose.backShoulderAngle = -0.45;
  pose.backElbowAngle = -1.85;
  pose.frontShoulderAngle = -0.7;
  pose.frontElbowAngle = -1.75;
  pose.scarfSway = 0.12;
  pose.hairSway = breath * 0.03;
  pose.auraIntensity = 0.5;
}

function applyBlock(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const crouching = context.crouchBlocking;
  const drop = crouching ? 18 : 4;

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + drop,
    backFootX: -config.build.stanceWidth * 0.55,
    frontFootX: config.build.stanceWidth * 0.62,
  });

  pose.torsoRotation = crouching ? 0.22 : 0.08;
  pose.headRotation = -0.06;
  pose.backShoulderAngle = -0.8;
  pose.backElbowAngle = -2.05;
  pose.frontShoulderAngle = -1.05;
  pose.frontElbowAngle = -1.95;
  pose.frontHandAngle = -0.25;
  pose.scarfSway = -0.06;
  pose.auraIntensity = 0.9;
}

function applyPerfectGuard(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const flare = Math.sin(Math.PI * clamp(context.animation.normalizedTime, 0, 1));

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 7,
    backFootX: -config.build.stanceWidth * 0.6,
    frontFootX: config.build.stanceWidth * 0.7,
  });

  pose.torsoRotation = -0.04 + flare * 0.08;
  pose.headRotation = -0.03;
  pose.backShoulderAngle = -1.15 - flare * 0.2;
  pose.backElbowAngle = -1.3;
  pose.frontShoulderAngle = -1.35 - flare * 0.25;
  pose.frontElbowAngle = -0.95;
  pose.frontHandAngle = -0.2;
  pose.scarfSway = -0.35 * flare;
  pose.hairSway = 0.2 * flare;
  pose.auraIntensity = 1.2 + flare * 0.75;
}

function applyJumpStart(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const t = context.animation.normalizedTime;
  const compression = t < 0.62 ? smoothstep(t / 0.62) : 1 - smoothstep((t - 0.62) / 0.38);

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 16 * compression,
    backFootX: -config.build.stanceWidth * 0.5,
    frontFootX: config.build.stanceWidth * 0.66,
  });

  pose.torsoRotation = 0.22 * compression;
  pose.headRotation = -0.12 * compression;
  pose.backShoulderAngle = 0.35 + compression * 0.45;
  pose.backElbowAngle = -0.45;
  pose.frontShoulderAngle = -0.2 + compression * 0.5;
  pose.frontElbowAngle = -0.9;
  pose.scarfSway = -0.15 * compression;
  pose.auraIntensity = 0.7;
}

function applyJumpAir(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
  rising: boolean,
): void {
  const t = context.animation.normalizedTime * TWO_PI;
  const flutter = Math.sin(t) * 2;
  const speedTuck = clamp(Math.abs(context.velocityY) / 900, 0, 1);

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + (rising ? 5 : 2),
    backFootX: rising ? -8 : -10,
    backFootY: rising ? -22 - flutter * 0.3 : -7,
    frontFootX: rising ? 14 : 12,
    frontFootY: rising ? -12 + flutter * 0.3 : -2,
    backFootPitch: rising ? -0.25 : 0.1,
    frontFootPitch: rising ? -0.15 : 0.1,
  });

  pose.torsoRotation = rising ? 0.14 : 0.06;
  pose.headRotation = rising ? -0.08 : 0.04;
  pose.backShoulderAngle = rising ? -1.85 : -1.3;
  pose.backElbowAngle = rising ? -0.55 : -0.4;
  pose.frontShoulderAngle = rising ? -2.15 : -1.05;
  pose.frontElbowAngle = rising ? -0.42 : -0.55;
  pose.scarfSway = rising ? -0.4 - speedTuck * 0.2 : 0.25;
  pose.hairSway = rising ? 0.22 : -0.18;
  pose.auraIntensity = 0.75;
}

function applyLanding(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const impact = Math.sin(Math.PI * clamp(context.animation.normalizedTime, 0, 1));

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 20 * impact,
    backFootX: -config.build.stanceWidth * 0.62,
    frontFootX: config.build.stanceWidth * 0.72,
  });

  pose.torsoRotation = 0.08 + 0.24 * impact;
  pose.headRotation = -0.12 * impact;
  pose.backShoulderAngle = 0.2 - 0.7 * impact;
  pose.backElbowAngle = -0.35 - 0.4 * impact;
  pose.frontShoulderAngle = -0.3 - 0.55 * impact;
  pose.frontElbowAngle = -0.55 - 0.3 * impact;
  pose.scarfSway = 0.28 * impact;
  pose.hairSway = -0.2 * impact;
  pose.auraIntensity = 0.7;
}

function applyAttack(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const attack = context.attack;
  if (!attack) {
    applyGuardFallback(pose, config);
    return;
  }

  const windup = attack.phase === 'STARTUP' ? smoothstep(attack.phaseProgress) : 0;
  const extend =
    attack.phase === 'ACTIVE'
      ? 1
      : attack.phase === 'RECOVERY'
        ? 1 - easeOutCubic(attack.phaseProgress)
        : 0;

  if (attack.definition.id === 'low-kick') {
    applyLowKick(pose, config, windup, extend);
    return;
  }

  switch (attack.definition.id) {
    case 'energy-blast':
      applyEnergyBlast(pose, config, windup, extend);
      return;
    case 'rising-strike':
      applyRisingStrike(pose, config, windup, extend);
      return;
    case 'shadow-dash':
      applyShadowDash(pose, config, windup, extend);
      return;
    case 'thunder-kick':
      applyThunderKick(pose, config, windup, extend);
      return;
    case 'light-punch':
      applyLightPunch(pose, config, windup, extend);
      return;
    case 'heavy-punch':
      applyHeavyPunch(pose, config, windup, extend);
      return;
  }
}

function applyLightPunch(
  pose: FighterPose,
  config: CharacterVisualConfig,
  windup: number,
  extend: number,
): void {
  const cocked = windup * (1 - extend);

  applyStance(pose, config, {
    hipOffsetX: extend * 2.5,
    hipOffsetY: config.motion.idleStanceDrop + 2,
    backFootX: -config.build.stanceWidth * 0.48,
    frontFootX: config.build.stanceWidth * 0.6 + extend * 5,
  });

  pose.torsoRotation = 0.05 + config.motion.attackLean * extend - windup * 0.09;
  pose.headRotation = -0.02 - windup * 0.03;
  pose.backShoulderAngle = 0.26 + extend * 0.35;
  pose.backElbowAngle = -0.42 - extend * 0.1;
  pose.frontShoulderAngle = -0.3 + cocked * 0.62 - extend * 1.3;
  pose.frontElbowAngle = -0.55 - cocked * 1.4 + extend * 0.5;
  pose.frontHandAngle = extend * 0.12;
  pose.scarfSway = -0.24 * extend;
  pose.hairSway = -0.12 * extend;
  pose.auraIntensity = 0.65 + extend * 0.25;
}

function applyHeavyPunch(
  pose: FighterPose,
  config: CharacterVisualConfig,
  windup: number,
  extend: number,
): void {
  const cocked = windup * (1 - extend);

  applyStance(pose, config, {
    hipOffsetX: extend * 4 - windup * 2,
    hipOffsetY: config.motion.idleStanceDrop + 5 + windup * 3,
    backFootX: -config.build.stanceWidth * 0.55,
    frontFootX: config.build.stanceWidth * 0.65 + extend * 10,
  });

  pose.torsoRotation =
    0.05 + config.motion.attackLean * extend - config.motion.heavyWindup * windup;
  pose.headRotation = -0.04 + windup * 0.06 - extend * 0.06;
  pose.backShoulderAngle = 0.26 + windup * 0.35 + extend * 0.55;
  pose.backElbowAngle = -0.42 - windup * 0.5 - extend * 0.2;
  pose.frontShoulderAngle = -0.3 + cocked * 0.95 - extend * 1.55;
  pose.frontElbowAngle = -0.55 - cocked * 1.5 + extend * 0.5;
  pose.frontHandAngle = extend * 0.2;
  pose.scarfSway = -0.38 * extend + 0.14 * windup;
  pose.hairSway = -0.2 * extend;
  pose.auraIntensity = 0.75 + windup * 0.35 + extend * 0.5;
}

function applyLowKick(
  pose: FighterPose,
  config: CharacterVisualConfig,
  windup: number,
  extend: number,
): void {
  const kick = Math.max(extend, windup * 0.18);

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 15,
    backFootX: -config.build.stanceWidth * 0.56,
    frontFootX: config.build.stanceWidth * 0.55 + kick * 42,
    frontFootY: -kick * 10,
    frontFootPitch: -0.25 * kick,
  });

  pose.torsoRotation = 0.18 + 0.12 * extend;
  pose.headRotation = -0.08 - 0.05 * extend;
  pose.backShoulderAngle = 0.2 + extend * 0.35;
  pose.backElbowAngle = -0.5;
  pose.frontShoulderAngle = -0.55 - windup * 0.2;
  pose.frontElbowAngle = -1.2;
  pose.scarfSway = -0.24 * extend;
  pose.auraIntensity = 0.75 + extend * 0.25;
}

function applyEnergyBlast(
  pose: FighterPose,
  config: CharacterVisualConfig,
  windup: number,
  extend: number,
): void {
  const gather = windup * (1 - extend);
  const release = extend;

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 5 + gather * 5,
    backFootX: -config.build.stanceWidth * 0.58,
    frontFootX: config.build.stanceWidth * 0.65 + release * 5,
  });

  pose.torsoRotation = 0.04 - gather * 0.12 + config.motion.attackLean * release;
  pose.headRotation = -0.02 + gather * 0.04;
  pose.backShoulderAngle = -0.55 - gather * 0.35 - release * 0.9;
  pose.backElbowAngle = -0.7 - gather * 1.4 - release * 0.7;
  pose.frontShoulderAngle = -0.6 - gather * 0.3 - release * 0.95;
  pose.frontElbowAngle = -0.75 - gather * 1.15 - release * 0.65;
  pose.frontHandAngle = -0.2;
  pose.scarfSway = 0.2 * gather - 0.55 * release;
  pose.hairSway = 0.15 * gather - 0.25 * release;
  pose.auraIntensity = 0.7 + gather * 0.8 + release * 0.85;
}

function applyRisingStrike(
  pose: FighterPose,
  config: CharacterVisualConfig,
  windup: number,
  extend: number,
): void {
  const crouch = windup * (1 - extend);

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 7 + crouch * 12 - extend * 3,
    backFootX: -config.build.stanceWidth * 0.58,
    frontFootX: config.build.stanceWidth * 0.62 + extend * 6,
  });

  pose.torsoRotation =
    0.06 + crouch * 0.22 - extend * config.motion.attackLean * 0.9;
  pose.headRotation = -0.04 - extend * 0.12;
  pose.backShoulderAngle = 0.25 + extend * 0.35;
  pose.backElbowAngle = -0.45 - extend * 0.2;
  pose.frontShoulderAngle = -0.3 + crouch * 0.75 - extend * 2.45;
  pose.frontElbowAngle = -0.55 - crouch * 0.45 + extend * 0.38;
  pose.frontHandAngle = -extend * 0.2;
  pose.scarfSway = -0.35 * extend + 0.12 * crouch;
  pose.hairSway = -0.25 * extend;
  pose.auraIntensity = 0.8 + crouch * 0.5 + extend * 0.75;
}

function applyShadowDash(
  pose: FighterPose,
  config: CharacterVisualConfig,
  windup: number,
  extend: number,
): void {
  applyStance(pose, config, {
    hipOffsetX: extend * 4,
    hipOffsetY: config.motion.idleStanceDrop + 9,
    backFootX: -config.build.stanceWidth * 0.7 - extend * 8,
    backFootY: -extend * 5,
    frontFootX: config.build.stanceWidth * 0.7 + extend * 12,
  });

  pose.torsoRotation = 0.12 + windup * 0.16 + extend * 0.32;
  pose.headRotation = -0.08 - extend * 0.1;
  pose.backShoulderAngle = 0.35 + windup * 0.5 + extend * 0.4;
  pose.backElbowAngle = -0.45;
  pose.frontShoulderAngle = -0.55 + windup * 0.4 - extend * 1.2;
  pose.frontElbowAngle = -0.8 - windup * 1.1 + extend * 0.65;
  pose.scarfSway = -0.5 * extend;
  pose.hairSway = -0.32 * extend;
  pose.auraIntensity = 0.9 + extend * 0.75;
}

function applyThunderKick(
  pose: FighterPose,
  config: CharacterVisualConfig,
  windup: number,
  extend: number,
): void {
  const chamber = windup * (1 - extend);

  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 6 + chamber * 8,
    backFootX: -config.build.stanceWidth * 0.52,
    frontFootX: config.build.stanceWidth * 0.7 + extend * 48,
    frontFootY: -extend * 74,
    frontFootPitch: -0.3 * extend,
  });

  pose.torsoRotation = 0.04 - windup * 0.18 - extend * 0.18;
  pose.headRotation = 0.03 + extend * 0.06;
  pose.backShoulderAngle = 0.35 + extend * 0.75;
  pose.backElbowAngle = -0.4;
  pose.frontShoulderAngle = -0.3 - chamber * 0.45 + extend * 0.35;
  pose.frontElbowAngle = -0.65 - chamber * 0.9 - extend * 0.2;
  pose.scarfSway = -0.42 * extend;
  pose.hairSway = -0.28 * extend;
  pose.auraIntensity = 0.85 + extend * 0.8;
}

function applyGuardFallback(pose: FighterPose, config: CharacterVisualConfig): void {
  applyStance(pose, config, {
    hipOffsetY: config.motion.idleStanceDrop + 3,
    backFootX: -config.build.stanceWidth * 0.52,
    frontFootX: config.build.stanceWidth * 0.64,
  });
  pose.torsoRotation = 0.08;
  pose.backShoulderAngle = -0.75;
  pose.backElbowAngle = -2;
  pose.frontShoulderAngle = -1;
  pose.frontElbowAngle = -1.9;
}

function applyDodge(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const forward = context.animation.id === 'DODGE_FORWARD';
  const t = context.animation.normalizedTime;
  const lean = Math.sin(Math.PI * t) * config.motion.dodgeLean;

  applyStance(pose, config, {
    hipOffsetX: (forward ? 3 : -2) * lean * 4,
    hipOffsetY: config.motion.idleStanceDrop + 10 + lean * 4,
    backFootX: -config.build.stanceWidth * (forward ? 0.62 : 0.45),
    backFootY: forward ? -lean * 9 : 0,
    frontFootX: config.build.stanceWidth * (forward ? 0.72 : 0.62),
    frontFootY: forward ? 0 : -lean * 8,
  });

  pose.torsoRotation = forward ? lean : -lean * 0.85;
  pose.headRotation = forward ? -lean * 0.35 : lean * 0.25;
  pose.backShoulderAngle = 0.2 + lean * 0.9;
  pose.backElbowAngle = -0.4;
  pose.frontShoulderAngle = -0.3 - lean * 0.9;
  pose.frontElbowAngle = -0.6 - lean * 0.4;
  pose.scarfSway = -lean * 1.2;
  pose.hairSway = -lean * 0.7;
  pose.auraIntensity = 0.9 + lean * 0.5;
}

function applyHitReaction(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const n = context.animation.normalizedTime;
  const impact = n < 0.22 ? 1 : Math.max(0, 1 - (n - 0.22) / 0.78);
  const recoil = config.motion.hitRecoil * impact;

  applyStance(pose, config, {
    hipOffsetX: -impact * 4,
    hipOffsetY: config.motion.idleStanceDrop + 3 + impact * 3,
    backFootX: -config.build.stanceWidth * 0.5 - impact * 10,
    frontFootX: config.build.stanceWidth * 0.6 - impact * 7,
  });

  pose.torsoRotation = 0.05 - recoil;
  pose.headRotation = -0.02 - recoil * 1.15;
  pose.headOffsetX = -impact * 3;
  pose.backShoulderAngle = 0.22 + impact * 0.85;
  pose.backElbowAngle = -0.32 - impact * 0.2;
  pose.frontShoulderAngle = -0.3 + impact * 0.55;
  pose.frontElbowAngle = -0.55 - impact * 0.55;
  pose.scarfSway = 0.4 * impact;
  pose.hairSway = 0.3 * impact;
  pose.auraIntensity = 0.8 + impact * 0.35;
}

function applyKnockback(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const t = clamp(context.animation.normalizedTime, 0, 1);
  const flail = Math.sin(t * Math.PI * 1.3);

  applyStance(pose, config, {
    hipOffsetX: -2,
    hipOffsetY: config.motion.idleStanceDrop + 10,
    backFootX: -10 - t * 8,
    backFootY: -16 - flail * 6,
    frontFootX: 16 + t * 4,
    frontFootY: -8 - flail * 5,
  });

  pose.torsoRotation = -0.75 - t * 0.25;
  pose.headRotation = -0.45;
  pose.headOffsetX = -4;
  pose.backShoulderAngle = 1.05 + flail * 0.25;
  pose.backElbowAngle = -0.25;
  pose.frontShoulderAngle = 0.8 - flail * 0.35;
  pose.frontElbowAngle = -0.3;
  pose.scarfSway = 0.55 + flail * 0.2;
  pose.hairSway = 0.4;
  pose.auraIntensity = 0.45;
}

function applyKnockdown(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const n = clamp(context.animation.normalizedTime, 0, 1);
  const settle = smoothstep(Math.min(1, n * 3));
  const bounce = Math.sin(Math.min(1, n * 2.2) * Math.PI) * (1 - settle) * 4;

  applyStance(pose, config, {
    hipOffsetX: -8,
    hipOffsetY: config.motion.idleStanceDrop + 42 + bounce,
    backFootX: -config.build.stanceWidth * 0.85,
    backFootY: -3,
    frontFootX: -config.build.stanceWidth * 0.3,
    frontFootY: -12,
  });

  pose.torsoRotation = -1.28 + (1 - settle) * 0.12;
  pose.headRotation = -0.1;
  pose.headOffsetX = -2;
  pose.backShoulderAngle = 0.65;
  pose.backElbowAngle = -0.45;
  pose.frontShoulderAngle = -0.55;
  pose.frontElbowAngle = -0.8;
  pose.scarfSway = 0.2;
  pose.hairSway = 0.25;
  pose.auraIntensity = 0.32;
}

function sampleGetUp(
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): FighterPose {
  const standing = createNeutralPose(config);
  const lyingPose = createNeutralPose(config);
  applyKnockdown(lyingPose, context, config);

  const rise = smoothstep(context.animation.normalizedTime);
  const recovered = interpolatePose(lyingPose, standing, rise);
  recovered.auraIntensity = 0.45 + rise * 0.3;
  recovered.torsoRotation += Math.sin(Math.PI * rise) * 0.12;
  return recovered;
}

function applyVictory(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const phase = context.animation.normalizedTime * TWO_PI;
  const breath = Math.sin(phase) * 0.8;

  applyStance(pose, config, {
    hipOffsetX: Math.sin(phase * 0.5) * 0.8,
    hipOffsetY: config.motion.idleStanceDrop + 1 + breath * 0.2,
    backFootX: -config.build.stanceWidth * 0.5,
    frontFootX: config.build.stanceWidth * 0.58,
  });

  pose.headRotation = -0.08;

  if (config.victoryStyle === 'raised-fist') {
    pose.torsoRotation = -0.06 + breath * 0.01;
    pose.backShoulderAngle = 0.5;
    pose.backElbowAngle = -1.65;
    pose.frontShoulderAngle = -2.45 + Math.sin(phase) * 0.06;
    pose.frontElbowAngle = -0.2;
    pose.frontHandAngle = 0.1;
    pose.scarfSway = Math.sin(phase * 0.8) * 0.12;
    pose.hairSway = Math.sin(phase * 0.7) * 0.1;
  } else {
    pose.torsoRotation = 0.08 + breath * 0.012;
    pose.backShoulderAngle = -0.8;
    pose.backElbowAngle = -2.45;
    pose.frontShoulderAngle = -0.95;
    pose.frontElbowAngle = -2.6;
    pose.headRotation = 0.06;
    pose.scarfSway = Math.sin(phase * 1.1 + 0.4) * 0.22;
    pose.hairSway = Math.sin(phase * 0.95) * 0.14;
  }

  pose.auraIntensity = 1.15 + Math.sin(phase) * 0.12;
}

function applyDefeat(
  pose: FighterPose,
  context: FighterPoseContext,
  config: CharacterVisualConfig,
): void {
  const t = clamp(context.animation.normalizedTime, 0, 1);

  if (!context.grounded) {
    applyStance(pose, config, {
      hipOffsetY: config.motion.idleStanceDrop + 8,
      backFootX: -8,
      backFootY: -18,
      frontFootX: 14,
      frontFootY: -10,
    });
    pose.torsoRotation = -0.95 - t * 0.2;
    pose.headRotation = -0.5;
    pose.headOffsetX = -4;
    pose.backShoulderAngle = 1.1;
    pose.backElbowAngle = -0.2;
    pose.frontShoulderAngle = 0.75;
    pose.frontElbowAngle = -0.25;
    pose.scarfSway = 0.65;
    pose.hairSway = 0.5;
    pose.auraIntensity = 0.18;
    return;
  }

  const slump = smoothstep(Math.min(1, t * 2.2));
  applyStance(pose, config, {
    hipOffsetX: -10,
    hipOffsetY: config.motion.idleStanceDrop + 49,
    backFootX: -config.build.stanceWidth * 0.95,
    backFootY: -2,
    frontFootX: -config.build.stanceWidth * 0.45,
    frontFootY: -6,
  });

  pose.torsoRotation = -1.35 - slump * 0.06;
  pose.headRotation = -0.35 + slump * 0.12;
  pose.headOffsetX = -3;
  pose.backShoulderAngle = 0.8;
  pose.backElbowAngle = -0.25;
  pose.frontShoulderAngle = -0.35;
  pose.frontElbowAngle = -0.45;
  pose.scarfSway = 0.15;
  pose.hairSway = 0.18;
  pose.auraIntensity = 0.14;
}

/** Exposed for tests: the raw attack extension curve used by the pose solver. */
export function attackPoseProgress(phase: AttackPhase, phaseProgress: number): number {
  switch (phase) {
    case 'STARTUP':
      return 0;
    case 'ACTIVE':
      return 1;
    case 'RECOVERY':
      return 1 - easeOutCubic(phaseProgress);
    case 'COMPLETE':
      return 0;
  }
}

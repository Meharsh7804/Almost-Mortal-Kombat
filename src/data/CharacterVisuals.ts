/**
 * Visual-only character identities.
 *
 * These values must never affect hurtboxes, damage, speed, frame data or any
 * other combat statistic. They describe proportions, palette, silhouette and
 * motion personality for the procedural renderer.
 */

export type HairStyle = 'spiked' | 'ponytail';
export type OutfitStyle = 'gi' | 'bodysuit';
export type HeadAccessory = 'headband' | 'none';
export type SashStyle = 'scarf' | 'belt-tails' | 'none';
export type AuraStyle = 'calm' | 'flicker';
export type VictoryStyle = 'raised-fist' | 'crossed-arms';

export interface CharacterBuild {
  readonly hipHeight: number;
  readonly hipSpread: number;
  readonly torsoLength: number;
  readonly shoulderWidth: number;
  readonly waistWidth: number;
  readonly headRadius: number;
  readonly upperArmLength: number;
  readonly forearmLength: number;
  readonly upperLegLength: number;
  readonly lowerLegLength: number;
  readonly limbWidth: number;
  readonly footLength: number;
  readonly stanceWidth: number;
}

export interface CharacterColors {
  readonly primary: number;
  readonly secondary: number;
  readonly accent: number;
  readonly skin: number;
  readonly hair: number;
  readonly aura: number;
  readonly outline: number;
  readonly wrap: number;
  readonly boot: number;
  readonly pants: number;
}

export interface CharacterOutfit {
  readonly style: OutfitStyle;
  readonly top: 'primary' | 'secondary';
  readonly glove: 'wrap' | 'accent';
  readonly boots: 'primary' | 'secondary' | 'boot';
}

export interface CharacterMotion {
  readonly idleSpeed: number;
  readonly idlePhase: number;
  readonly idleBreath: number;
  readonly idleSway: number;
  readonly idleStanceDrop: number;
  readonly walkCadence: number;
  readonly walkStride: number;
  readonly walkArmSwing: number;
  readonly walkLean: number;
  readonly backWalkLean: number;
  readonly walkBounce: number;
  readonly attackLean: number;
  readonly heavyWindup: number;
  readonly hitRecoil: number;
  readonly dodgeLean: number;
}

export interface CharacterAura {
  readonly style: AuraStyle;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly baseAlpha: number;
  readonly pulseSpeed: number;
  readonly offsetY: number;
}

export interface CharacterVisualConfig {
  readonly id: string;
  readonly name: string;
  readonly build: CharacterBuild;
  readonly colors: CharacterColors;
  readonly outfit: CharacterOutfit;
  readonly hairStyle: HairStyle;
  readonly headAccessory: HeadAccessory;
  readonly sash: SashStyle;
  readonly aura: CharacterAura;
  readonly motion: CharacterMotion;
  readonly victoryStyle: VictoryStyle;
}

const SHARED_MOTION = {
  idleSpeed: 0.052,
  idlePhase: 0,
  idleBreath: 1.2,
  idleSway: 1,
  idleStanceDrop: 2,
  walkCadence: 1,
  walkStride: 15,
  walkArmSwing: 0.42,
  walkLean: 0.1,
  backWalkLean: -0.07,
  walkBounce: 1.8,
  attackLean: 0.12,
  heavyWindup: 0.2,
  hitRecoil: 0.3,
  dodgeLean: 0.4,
} as const;

export const KAI_VISUAL: CharacterVisualConfig = Object.freeze({
  id: 'kai',
  name: 'KAI',
  build: Object.freeze({
    hipHeight: 74,
    hipSpread: 5,
    torsoLength: 42,
    shoulderWidth: 34,
    waistWidth: 23,
    headRadius: 16,
    upperArmLength: 26,
    forearmLength: 24,
    upperLegLength: 36,
    lowerLegLength: 38,
    limbWidth: 10,
    footLength: 18,
    stanceWidth: 34,
  }),
  colors: Object.freeze({
    primary: 0x2ee6ff,
    secondary: 0x10233d,
    accent: 0xffd36e,
    skin: 0xc98d5f,
    hair: 0x151424,
    aura: 0x2ee6ff,
    outline: 0x05040a,
    wrap: 0xe9e1e8,
    boot: 0x0d1b2e,
    pants: 0x14233f,
  }),
  outfit: Object.freeze({
    style: 'gi',
    top: 'secondary',
    glove: 'wrap',
    boots: 'primary',
  }),
  hairStyle: 'spiked',
  headAccessory: 'headband',
  sash: 'belt-tails',
  aura: Object.freeze({
    style: 'calm',
    scaleX: 210,
    scaleY: 270,
    baseAlpha: 0.09,
    pulseSpeed: 2.4,
    offsetY: -84,
  }),
  motion: Object.freeze({
    ...SHARED_MOTION,
    idleSpeed: 0.05,
    idlePhase: 0.2,
    idleBreath: 1.35,
    idleSway: 1.1,
    idleStanceDrop: 2,
    walkCadence: 0.94,
    walkStride: 16,
    walkArmSwing: 0.44,
    walkLean: 0.11,
    backWalkLean: -0.06,
    walkBounce: 1.8,
    attackLean: 0.12,
    heavyWindup: 0.22,
    hitRecoil: 0.28,
    dodgeLean: 0.38,
  }),
  victoryStyle: 'raised-fist',
});

export const RHEA_VISUAL: CharacterVisualConfig = Object.freeze({
  id: 'rhea',
  name: 'RHEA',
  build: Object.freeze({
    hipHeight: 73,
    hipSpread: 5,
    torsoLength: 42,
    shoulderWidth: 29,
    waistWidth: 20,
    headRadius: 15,
    upperArmLength: 25,
    forearmLength: 23,
    upperLegLength: 35,
    lowerLegLength: 38,
    limbWidth: 8.5,
    footLength: 17,
    stanceWidth: 32,
  }),
  colors: Object.freeze({
    primary: 0xff5a36,
    secondary: 0x2b1230,
    accent: 0xc18bff,
    skin: 0xe5b28a,
    hair: 0x24102b,
    aura: 0xff6a3f,
    outline: 0x05040a,
    wrap: 0x3a1638,
    boot: 0x170b1c,
    pants: 0x351332,
  }),
  outfit: Object.freeze({
    style: 'bodysuit',
    top: 'secondary',
    glove: 'accent',
    boots: 'boot',
  }),
  hairStyle: 'ponytail',
  headAccessory: 'none',
  sash: 'scarf',
  aura: Object.freeze({
    style: 'flicker',
    scaleX: 220,
    scaleY: 280,
    baseAlpha: 0.11,
    pulseSpeed: 5.1,
    offsetY: -86,
  }),
  motion: Object.freeze({
    ...SHARED_MOTION,
    idleSpeed: 0.064,
    idlePhase: 1.6,
    idleBreath: 1.6,
    idleSway: 1.9,
    idleStanceDrop: 4,
    walkCadence: 1.08,
    walkStride: 18,
    walkArmSwing: 0.5,
    walkLean: 0.15,
    backWalkLean: -0.1,
    walkBounce: 2.4,
    attackLean: 0.16,
    heavyWindup: 0.24,
    hitRecoil: 0.36,
    dodgeLean: 0.52,
  }),
  victoryStyle: 'crossed-arms',
});

const CHARACTER_VISUALS: Readonly<Record<string, CharacterVisualConfig>> = Object.freeze({
  kai: KAI_VISUAL,
  rhea: RHEA_VISUAL,
});

/**
 * Returns a character identity or a palette-derived fallback. The fallback
 * keeps future roster additions playable before an art pass exists.
 */
export function getCharacterVisual(
  id: string,
  fallbackColor = 0x2ee6ff,
  fallbackAccent = 0x0c6b8f,
): CharacterVisualConfig {
  const visual = CHARACTER_VISUALS[id];
  if (visual) {
    return visual;
  }

  return Object.freeze({
    id,
    name: id.toUpperCase(),
    build: KAI_VISUAL.build,
    colors: Object.freeze({
      ...KAI_VISUAL.colors,
      primary: fallbackColor,
      aura: fallbackColor,
      secondary: fallbackAccent,
      pants: fallbackAccent,
    }),
    outfit: KAI_VISUAL.outfit,
    hairStyle: 'spiked',
    headAccessory: 'none',
    sash: 'none',
    aura: Object.freeze({
      ...KAI_VISUAL.aura,
      style: 'calm',
    }),
    motion: KAI_VISUAL.motion,
    victoryStyle: 'raised-fist',
  });
}

export function getImplementedCharacterVisuals(): readonly CharacterVisualConfig[] {
  return Object.freeze([KAI_VISUAL, RHEA_VISUAL]);
}

import { ARENA_BOUNDS, type ArenaBounds } from './ArenaConfig';

export type ArenaMotif = 'temple' | 'neon' | 'reactor' | 'frost';

export interface ArenaTheme {
  readonly skyTop: number;
  readonly skyBottom: number;
  readonly horizon: number;
  readonly wallTop: number;
  readonly wallBottom: number;
  readonly floorTop: number;
  readonly floorBottom: number;
  readonly accentA: number;
  readonly accentB: number;
  readonly accentC: number;
  readonly haze: number;
  readonly frame: number;
  readonly ring: number;
  readonly motif: ArenaMotif;
}

export interface ArenaLighting {
  readonly keyTint: number;
  readonly rimTint: number;
  readonly keyAlpha: number;
  readonly rimAlpha: number;
}

export interface ArenaAtmosphere {
  readonly particleTintA: number;
  readonly particleTintB: number;
  readonly particleTintC: number;
  readonly particleAlpha: number;
  readonly scanlineAlpha: number;
  readonly vignetteAlpha: number;
}

export interface ArenaDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly bounds: ArenaBounds;
  readonly theme: ArenaTheme;
  readonly lighting: ArenaLighting;
  readonly atmosphere: ArenaAtmosphere;
  readonly parallax: Readonly<{ back: number; mid: number; front: number }>;
}

export const FORGOTTEN_TEMPLE_ARENA: ArenaDefinition = Object.freeze({
  id: 'forgotten-temple',
  name: 'Forgotten Temple',
  description: 'Ancient stone arches, drifting ash, and violet rift light over a sacred battleground.',
  bounds: ARENA_BOUNDS,
  theme: Object.freeze({
    skyTop: 0x120916,
    skyBottom: 0x07050b,
    horizon: 0x2d1431,
    wallTop: 0x1a1020,
    wallBottom: 0x09060e,
    floorTop: 0x2e1f33,
    floorBottom: 0x08060d,
    accentA: 0xffcf7a,
    accentB: 0x8b3dff,
    accentC: 0xd6b07a,
    haze: 0x7d4cff,
    frame: 0x4a2a45,
    ring: 0xc98a4a,
    motif: 'temple',
  }),
  lighting: Object.freeze({ keyTint: 0xffcf7a, rimTint: 0x8b3dff, keyAlpha: 0.18, rimAlpha: 0.14 }),
  atmosphere: Object.freeze({
    particleTintA: 0xffcf7a,
    particleTintB: 0x8b3dff,
    particleTintC: 0xc98a4a,
    particleAlpha: 0.22,
    scanlineAlpha: 0.08,
    vignetteAlpha: 0.78,
  }),
  parallax: Object.freeze({ back: 0.15, mid: 0.35, front: 0.55 }),
});

export const NEON_DISTRICT_ARENA: ArenaDefinition = Object.freeze({
  id: 'neon-district',
  name: 'Neon District',
  description: 'Rain-slick signs, electric cyan-magenta glare, and a humming night skyline.',
  bounds: ARENA_BOUNDS,
  theme: Object.freeze({
    skyTop: 0x040717,
    skyBottom: 0x02030a,
    horizon: 0x081738,
    wallTop: 0x071126,
    wallBottom: 0x03060f,
    floorTop: 0x102544,
    floorBottom: 0x03050d,
    accentA: 0x2ee6ff,
    accentB: 0xff3fa8,
    accentC: 0x8dfcff,
    haze: 0x2ee6ff,
    frame: 0x1a3558,
    ring: 0xff3fa8,
    motif: 'neon',
  }),
  lighting: Object.freeze({ keyTint: 0x2ee6ff, rimTint: 0xff3fa8, keyAlpha: 0.2, rimAlpha: 0.18 }),
  atmosphere: Object.freeze({
    particleTintA: 0x2ee6ff,
    particleTintB: 0xff3fa8,
    particleTintC: 0x8dfcff,
    particleAlpha: 0.18,
    scanlineAlpha: 0.12,
    vignetteAlpha: 0.72,
  }),
  parallax: Object.freeze({ back: 0.2, mid: 0.4, front: 0.6 }),
});

export const REACTOR_CORE_ARENA: ArenaDefinition = Object.freeze({
  id: 'reactor-core',
  name: 'Reactor Core',
  description: 'Industrial heat, pulsing containment rings, and hazardous ember-lit machinery.',
  bounds: ARENA_BOUNDS,
  theme: Object.freeze({
    skyTop: 0x140807,
    skyBottom: 0x060303,
    horizon: 0x34110d,
    wallTop: 0x211010,
    wallBottom: 0x080404,
    floorTop: 0x3a1b12,
    floorBottom: 0x090403,
    accentA: 0xff6a2e,
    accentB: 0xffd36e,
    accentC: 0xff3b2f,
    haze: 0xff5a2f,
    frame: 0x4a2115,
    ring: 0xff8a3d,
    motif: 'reactor',
  }),
  lighting: Object.freeze({ keyTint: 0xff6a2e, rimTint: 0xffd36e, keyAlpha: 0.22, rimAlpha: 0.12 }),
  atmosphere: Object.freeze({
    particleTintA: 0xff6a2e,
    particleTintB: 0xffd36e,
    particleTintC: 0xff3b2f,
    particleAlpha: 0.2,
    scanlineAlpha: 0.09,
    vignetteAlpha: 0.76,
  }),
  parallax: Object.freeze({ back: 0.18, mid: 0.38, front: 0.58 }),
});

export const FROZEN_SANCTUARY_ARENA: ArenaDefinition = Object.freeze({
  id: 'frozen-sanctuary',
  name: 'Frozen Sanctuary',
  description: 'Crystalline pillars, cold moonlight, and drifting frost within a silent refuge.',
  bounds: ARENA_BOUNDS,
  theme: Object.freeze({
    skyTop: 0x071422,
    skyBottom: 0x03070d,
    horizon: 0x0f2d42,
    wallTop: 0x0c2133,
    wallBottom: 0x040a12,
    floorTop: 0x1a3347,
    floorBottom: 0x04080e,
    accentA: 0x9fe9ff,
    accentB: 0xe8fbff,
    accentC: 0x63b7ff,
    haze: 0x7fdfff,
    frame: 0x24475f,
    ring: 0xbef4ff,
    motif: 'frost',
  }),
  lighting: Object.freeze({ keyTint: 0x9fe9ff, rimTint: 0xe8fbff, keyAlpha: 0.2, rimAlpha: 0.16 }),
  atmosphere: Object.freeze({
    particleTintA: 0x9fe9ff,
    particleTintB: 0xe8fbff,
    particleTintC: 0x63b7ff,
    particleAlpha: 0.16,
    scanlineAlpha: 0.06,
    vignetteAlpha: 0.74,
  }),
  parallax: Object.freeze({ back: 0.16, mid: 0.34, front: 0.54 }),
});

const ARENAS: readonly ArenaDefinition[] = Object.freeze([
  FORGOTTEN_TEMPLE_ARENA,
  NEON_DISTRICT_ARENA,
  REACTOR_CORE_ARENA,
  FROZEN_SANCTUARY_ARENA,
]);

const ARENA_MAP = new Map(ARENAS.map((arena) => [arena.id, arena]));

export function getArenaRegistry(): readonly ArenaDefinition[] {
  return ARENAS;
}

export function getArenaById(id: string): ArenaDefinition | null {
  return ARENA_MAP.get(id) ?? null;
}

export function getDefaultArenaId(): string {
  return ARENAS[0]?.id ?? FORGOTTEN_TEMPLE_ARENA.id;
}

export function isValidArenaId(id: string): boolean {
  return ARENA_MAP.has(id);
}

export function getRandomArenaId(random: () => number = Math.random): string {
  const index = Math.floor(random() * ARENAS.length);
  return ARENAS[Math.max(0, Math.min(ARENAS.length - 1, index))]?.id ?? getDefaultArenaId();
}

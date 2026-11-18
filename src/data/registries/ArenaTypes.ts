import type { ArenaBounds } from '../ArenaConfig';

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

export interface ArenaDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly bounds: ArenaBounds;
  readonly theme: ArenaTheme;
  readonly parallax: Readonly<{ back: number; mid: number; front: number }>;
  readonly atmosphere: Readonly<{
    particleTintA: number;
    particleTintB: number;
    particleTintC: number;
    particleAlpha: number;
    scanlineAlpha: number;
    vignetteAlpha: number;
  }>;
  readonly lighting: Readonly<{
    keyTint: number;
    rimTint: number;
    keyAlpha: number;
    rimAlpha: number;
  }>;
}

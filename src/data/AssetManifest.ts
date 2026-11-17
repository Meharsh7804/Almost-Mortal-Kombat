/**
 * Single source of truth for externally loaded assets.
 *
 * Phase 0 intentionally ships with zero external assets: every visual in the
 * foundation is generated procedurally at runtime. Future phases register
 * character, arena, effect, audio and UI files here so no asset URL is
 * hard-coded in scenes.
 */

export type AssetKind = 'image' | 'audio' | 'json';

export interface AssetDefinition {
  /** Global Phaser cache key. */
  readonly key: string;
  readonly kind: AssetKind;
  /** Path relative to `public/assets`. */
  readonly path: string;
}

const ASSET_ROOT = 'assets';

export const ASSET_MANIFEST: readonly AssetDefinition[] = [];

export function resolveAssetUrl(relativePath: string): string {
  return `${ASSET_ROOT}/${relativePath.replace(/^\/+/, '')}`;
}

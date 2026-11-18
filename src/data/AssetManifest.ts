/**
 * Single source of truth for externally loaded assets.
 *
 * The game ships with procedural visuals and no bundled audio files. Audio keys
 * are played only when present in the cache, so missing assets are safe. To add
 * audio, place files under `public/assets/audio/` and register them here.
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

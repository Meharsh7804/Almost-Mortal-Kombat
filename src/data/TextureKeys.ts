/**
 * Keys for textures generated at runtime. Keeping them centralized prevents
 * magic strings from spreading across scenes and UI components.
 */
export const TEXTURE_KEYS = {
  glowSoft: 'procedural:glow-soft',
  ember: 'procedural:ember',
  vignette: 'procedural:vignette',
  halftone: 'procedural:halftone',
  scanlines: 'procedural:scanlines',
} as const;

export type TextureKey = (typeof TEXTURE_KEYS)[keyof typeof TEXTURE_KEYS];

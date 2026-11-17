/** Shared visual language for RIFTBOUND's UI. */

export const COLORS = {
  background: 0x08070b,
  nearBlack: 0x050408,
  panel: 0x140c17,
  bone: 0xf3e9ef,
  pearl: 0xfff7fa,
  muted: 0xb9a4c0,
  crimson: 0xff2f55,
  crimsonDeep: 0x8f0f28,
  ember: 0xff8a6d,
  violet: 0x8b3dff,
  violetDeep: 0x4c1b7a,
  line: 0x4a2a45,
  cyan: 0x2ee6ff,
  cyanDeep: 0x0c6b8f,
  emberOrange: 0xff5a36,
  emberOrangeDeep: 0x8f2c14,
  gold: 0xffd36e,
} as const;

export const CSS_COLORS = {
  bone: '#f3e9ef',
  pearl: '#fff7fa',
  muted: '#b9a4c0',
  crimson: '#ff2f55',
  violet: '#c19bff',
  background: '#08070b',
} as const;

export const FONTS = {
  display: '"Arial Black", "Impact", "Segoe UI Black", sans-serif',
  body: '"Trebuchet MS", "Segoe UI", sans-serif',
  mono: '"Cascadia Mono", "Consolas", "Courier New", monospace',
} as const;

export function toRgba(color: number, alpha: number): string {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

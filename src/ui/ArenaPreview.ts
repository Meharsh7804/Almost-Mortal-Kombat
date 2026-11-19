import type Phaser from 'phaser';

import type { ArenaDefinition, ArenaTheme } from '../data/ArenaRegistry';
import { COLORS } from './Theme';

export interface ArenaPreviewBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ArenaPreviewOptions {
  /** Draws a brighter frame and accent lighting for the active card. */
  readonly selected?: boolean;
}

/**
 * Compact, deterministic stage artwork used by arena select cards/banners.
 * It mirrors the arena's registered theme (palette + motif) so the preview
 * reads as the same environment shown in battle, without instantiating the
 * full-screen ArenaBackdrop.
 */
export function drawArenaPreview(
  graphics: Phaser.GameObjects.Graphics,
  arena: ArenaDefinition,
  bounds: ArenaPreviewBounds,
  options: ArenaPreviewOptions = {},
): void {
  const { x, y, width, height } = bounds;
  const { theme } = arena;
  const floorY = y + height * 0.68;

  graphics.fillGradientStyle(
    theme.skyTop,
    theme.skyTop,
    theme.skyBottom,
    theme.skyBottom,
    1,
  );
  graphics.fillRoundedRect(x, y, width, height, 10);

  graphics.fillStyle(theme.haze, options.selected ? 0.3 : 0.18);
  graphics.fillEllipse(x + width / 2, floorY - height * 0.12, width * 0.9, height * 0.44);

  drawMotif(graphics, theme, x, y, width, floorY);

  // Stage floor in shallow perspective.
  graphics.fillStyle(theme.floorTop, 0.98);
  graphics.fillPoints(
    [
      { x: x + width * 0.16, y: floorY },
      { x: x + width * 0.84, y: floorY },
      { x: x + width * 1.04, y: y + height },
      { x: x - width * 0.04, y: y + height },
    ],
    true,
  );
  graphics.fillStyle(theme.floorBottom, 0.92);
  graphics.fillRect(x, y + height - height * 0.12, width, height * 0.12);

  graphics.lineStyle(1, theme.ring, options.selected ? 0.65 : 0.4);
  graphics.lineBetween(x + width * 0.16, floorY, x + width * 0.84, floorY);
  for (let step = -2; step <= 2; step += 1) {
    graphics.lineBetween(
      x + width / 2 + step * width * 0.075,
      floorY,
      x + width / 2 + step * width * 0.23,
      y + height,
    );
  }

  // Accent rim lights.
  graphics.fillStyle(theme.accentA, options.selected ? 0.85 : 0.55);
  graphics.fillCircle(x + width * 0.2, floorY - 4, 2.4);
  graphics.fillCircle(x + width * 0.8, floorY - 4, 2.4);
  graphics.lineStyle(1, theme.accentA, options.selected ? 0.5 : 0.3);
  graphics.lineBetween(x + width * 0.2, floorY, x + width * 0.2, floorY - height * 0.26);
  graphics.lineBetween(x + width * 0.8, floorY, x + width * 0.8, floorY - height * 0.26);

  graphics.lineStyle(options.selected ? 2.5 : 1.5, theme.accentA, options.selected ? 0.95 : 0.55);
  graphics.strokeRoundedRect(x, y, width, height, 10);
  if (options.selected) {
    graphics.lineStyle(1, COLORS.pearl, 0.35);
    graphics.strokeRoundedRect(x + 4, y + 4, width - 8, height - 8, 8);
  }
}

function drawMotif(
  graphics: Phaser.GameObjects.Graphics,
  theme: ArenaTheme,
  x: number,
  y: number,
  width: number,
  floorY: number,
): void {
  const backHeight = floorY - y;

  switch (theme.motif) {
    case 'neon': {
      graphics.fillStyle(theme.wallTop, 0.95);
      for (let index = 0; index < 7; index += 1) {
        const buildingWidth = width * (0.07 + (index % 3) * 0.02);
        const buildingHeight = backHeight * (0.3 + ((index * 7) % 5) * 0.09);
        const bx = x + width * 0.06 + index * width * 0.13;
        graphics.fillRect(bx, floorY - buildingHeight, buildingWidth, buildingHeight);
      }
      graphics.fillStyle(theme.accentA, 0.8);
      for (let row = 0; row < 3; row += 1) {
        graphics.fillRect(x + width * 0.14 + row * width * 0.26, floorY - backHeight * 0.56, width * 0.09, 3);
      }
      graphics.fillStyle(theme.accentB, 0.75);
      graphics.fillRect(x + width * 0.62, floorY - backHeight * 0.72, width * 0.13, 4);
      break;
    }
    case 'reactor': {
      graphics.lineStyle(3, theme.frame, 0.95);
      graphics.strokeCircle(x + width / 2, floorY - backHeight * 0.42, backHeight * 0.34);
      graphics.lineStyle(2, theme.accentB, 0.7);
      graphics.strokeCircle(x + width / 2, floorY - backHeight * 0.42, backHeight * 0.24);
      graphics.fillStyle(theme.accentA, 0.55);
      graphics.fillCircle(x + width / 2, floorY - backHeight * 0.42, backHeight * 0.12);
      graphics.fillStyle(theme.frame, 0.9);
      graphics.fillRect(x, floorY - backHeight * 0.32, width * 0.12, backHeight * 0.32);
      graphics.fillRect(x + width * 0.88, floorY - backHeight * 0.28, width * 0.12, backHeight * 0.28);
      break;
    }
    case 'frost': {
      graphics.fillStyle(theme.wallTop, 0.85);
      for (let index = 0; index < 5; index += 1) {
        const cx = x + width * (0.12 + index * 0.19);
        const spikeHeight = backHeight * (0.4 + ((index * 3) % 4) * 0.1);
        graphics.fillTriangle(
          cx - width * 0.06,
          floorY,
          cx,
          floorY - spikeHeight,
          cx + width * 0.06,
          floorY,
        );
      }
      graphics.fillStyle(theme.accentB, 0.42);
      for (let index = 0; index < 8; index += 1) {
        const px = x + width * (((index * 37) % 89) / 100) + 5;
        const py = y + (((index * 53) % 70) / 100) * backHeight;
        graphics.fillCircle(px, py, 1.5);
      }
      break;
    }
    case 'temple':
    default: {
      graphics.fillStyle(theme.wallTop, 0.9);
      for (let index = 0; index < 4; index += 1) {
        const pillarX = x + width * (0.1 + index * 0.26);
        const pillarHeight = backHeight * (0.44 + (index % 2) * 0.12);
        graphics.fillRect(pillarX, floorY - pillarHeight, width * 0.06, pillarHeight);
        graphics.fillRect(pillarX - width * 0.012, floorY - pillarHeight, width * 0.084, backHeight * 0.045);
      }
      graphics.lineStyle(3, theme.ring, 0.55);
      graphics.strokeEllipse(x + width / 2, floorY - backHeight * 0.3, width * 0.78, backHeight * 0.34);
      graphics.fillStyle(theme.accentB, 0.3);
      graphics.fillCircle(x + width / 2, floorY - backHeight * 0.42, backHeight * 0.1);
      break;
    }
  }
}

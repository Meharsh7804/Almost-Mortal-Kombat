import type Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../core/GameConfig';
import { TEXTURE_KEYS } from '../data/TextureKeys';

type CanvasDraw = (context: CanvasRenderingContext2D, width: number, height: number) => void;

function createCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: CanvasDraw,
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    console.warn(`[ProceduralTextures] Unable to create texture "${key}".`);
    return;
  }

  draw(texture.context, width, height);
  texture.refresh();
}

export function ensureSoftGlowTexture(scene: Phaser.Scene): void {
  createCanvasTexture(scene, TEXTURE_KEYS.glowSoft, 512, 512, (context, width, height) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2;
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.16, 'rgba(255, 255, 255, 0.62)');
    gradient.addColorStop(0.42, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
}

export function ensureEmberTexture(scene: Phaser.Scene): void {
  createCanvasTexture(scene, TEXTURE_KEYS.ember, 32, 32, (context, width, height) => {
    const center = width / 2;
    const gradient = context.createRadialGradient(center, center, 0, center, center, center);

    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.28, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.18)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
}

export function ensureVignetteTexture(scene: Phaser.Scene): void {
  createCanvasTexture(
    scene,
    TEXTURE_KEYS.vignette,
    GAME_WIDTH,
    GAME_HEIGHT,
    (context, width, height) => {
      const gradient = context.createRadialGradient(
        width / 2,
        height * 0.46,
        height * 0.18,
        width / 2,
        height * 0.5,
        width * 0.7,
      );

      gradient.addColorStop(0, 'rgba(4, 2, 7, 0)');
      gradient.addColorStop(0.55, 'rgba(4, 2, 7, 0.22)');
      gradient.addColorStop(0.8, 'rgba(4, 2, 7, 0.58)');
      gradient.addColorStop(1, 'rgba(4, 2, 7, 0.94)');

      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    },
  );
}

export function ensureHalftoneTexture(scene: Phaser.Scene): void {
  createCanvasTexture(scene, TEXTURE_KEYS.halftone, 16, 16, (context) => {
    context.fillStyle = 'rgba(255, 255, 255, 0.75)';
    context.beginPath();
    context.arc(8, 8, 1.15, 0, Math.PI * 2);
    context.fill();
  });
}

export function ensureScanlineTexture(scene: Phaser.Scene): void {
  createCanvasTexture(scene, TEXTURE_KEYS.scanlines, 4, 4, (context) => {
    context.fillStyle = 'rgba(0, 0, 0, 0.45)';
    context.fillRect(0, 0, 4, 1);
  });
}

export function ensureMenuTextures(scene: Phaser.Scene): void {
  ensureSoftGlowTexture(scene);
  ensureEmberTexture(scene);
  ensureVignetteTexture(scene);
  ensureHalftoneTexture(scene);
  ensureScanlineTexture(scene);
}

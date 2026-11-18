import type { GameSettings } from '../progression/PlayerProfile';

export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function prefersReducedMotion(): boolean {
  return systemPrefersReducedMotion();
}

export function resolveReducedMotion(setting: GameSettings['reducedMotion'] | undefined): boolean {
  if (setting === true || setting === false) return setting;
  return systemPrefersReducedMotion();
}

export function resolveScreenShakeEnabled(settings: Pick<GameSettings, 'screenShake' | 'reducedMotion'> | undefined): boolean {
  if (!settings) return !systemPrefersReducedMotion();
  if (!settings.screenShake) return false;
  return !resolveReducedMotion(settings.reducedMotion);
}

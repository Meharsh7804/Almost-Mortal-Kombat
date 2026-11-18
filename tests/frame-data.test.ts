import { describe, expect, it } from 'vitest';

import {
  ENERGY_BLAST,
  findCancelWindow,
  guardMatches,
  HEAVY_PUNCH,
  LIGHT_PUNCH,
  LOW_KICK,
  RISING_STRIKE,
  SHADOW_DASH,
  THUNDER_KICK,
} from '../src/combat/FrameData';

describe('phase 2 frame data', () => {
  it('defines unique frame data for every special attack', () => {
    const specials = [ENERGY_BLAST, RISING_STRIKE, SHADOW_DASH, THUNDER_KICK];

    for (const attack of specials) {
      expect(attack.category).toBe('SPECIAL');
      expect(attack.energyCost).toBe(25);
      expect(attack.startupFrames).toBeGreaterThan(0);
      expect(attack.activeFrames).toBeGreaterThan(0);
      expect(attack.recoveryFrames).toBeGreaterThan(0);
      expect(attack.blockstunFrames).toBeGreaterThan(0);
      expect(attack.cooldownFrames).toBeGreaterThan(0);
    }

    expect(new Set(specials.map((attack) => attack.id)).size).toBe(specials.length);
    expect(ENERGY_BLAST.projectile).toBeDefined();
    expect(RISING_STRIKE.launchForce).toBeGreaterThan(0);
    expect(SHADOW_DASH.advance).toBeDefined();
    expect(THUNDER_KICK.advance).toBeDefined();
  });

  it('defines guard types that distinguish standing and crouching block', () => {
    expect(LIGHT_PUNCH.guardType).toBe('HIGH');
    expect(HEAVY_PUNCH.guardType).toBe('MID');
    expect(LOW_KICK.guardType).toBe('LOW');

    expect(guardMatches('HIGH', false)).toBe(true);
    expect(guardMatches('HIGH', true)).toBe(false);
    expect(guardMatches('MID', false)).toBe(true);
    expect(guardMatches('MID', true)).toBe(true);
    expect(guardMatches('LOW', false)).toBe(false);
    expect(guardMatches('LOW', true)).toBe(true);
    expect(guardMatches('UNBLOCKABLE', false)).toBe(false);
    expect(guardMatches('UNBLOCKABLE', true)).toBe(false);
  });

  it('exposes data-driven cancel windows with category restrictions', () => {
    expect(findCancelWindow(LIGHT_PUNCH, 6, 'LIGHT')).not.toBeNull();
    expect(findCancelWindow(LIGHT_PUNCH, 6, 'HEAVY')).not.toBeNull();
    expect(findCancelWindow(LIGHT_PUNCH, 6, 'SPECIAL')).not.toBeNull();
    expect(findCancelWindow(LIGHT_PUNCH, 5, 'HEAVY')).toBeNull();
    expect(findCancelWindow(LIGHT_PUNCH, 19, 'HEAVY')).toBeNull();

    expect(findCancelWindow(HEAVY_PUNCH, 14, 'SPECIAL')).not.toBeNull();
    expect(findCancelWindow(HEAVY_PUNCH, 14, 'LIGHT')).toBeNull();

    expect(findCancelWindow(RISING_STRIKE, 10, 'SPECIAL')).toBeNull();
    expect(LIGHT_PUNCH.cancelWindows[0]?.requiresContact).toBe(true);
  });

  it('marks chip damage and block state for every blockable attack', () => {
    for (const attack of [LIGHT_PUNCH, HEAVY_PUNCH, LOW_KICK, ENERGY_BLAST]) {
      expect(attack.canBeBlocked).toBe(true);
      expect(attack.canBeDodged).toBe(true);
      expect(attack.blockstunFrames).toBeGreaterThan(0);
      expect(attack.chipDamage).toBeGreaterThanOrEqual(0);
    }
  });
});

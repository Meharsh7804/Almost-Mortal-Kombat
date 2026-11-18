import { describe, expect, it } from 'vitest';

import { DEFAULT_ENERGY_RULES, EnergySystem } from '../src/systems/EnergySystem';

describe('energy system', () => {
  it('starts at maximum and clamps gains at the maximum', () => {
    const energy = new EnergySystem();
    expect(energy.current).toBe(100);
    expect(energy.max).toBe(100);
    expect(energy.ratio).toBe(1);

    expect(energy.gain(25)).toBe(0);
    expect(energy.current).toBe(100);

    energy.spend(40);
    expect(energy.gain(100)).toBe(40);
    expect(energy.current).toBe(100);
  });

  it('validates and consumes spending exactly once', () => {
    const energy = new EnergySystem();
    expect(energy.spend(25)).toBe(true);
    expect(energy.current).toBe(75);
    expect(energy.spend(80)).toBe(false);
    expect(energy.current).toBe(75);
    expect(energy.canSpend(75)).toBe(true);
    expect(energy.spend(75)).toBe(true);
    expect(energy.current).toBe(0);
  });

  it('ignores invalid gains and never becomes negative', () => {
    const energy = new EnergySystem();
    expect(energy.gain(-10)).toBe(0);
    expect(energy.gain(Number.NaN)).toBe(0);
    expect(energy.spend(-5)).toBe(false);
    expect(energy.current).toBe(100);
  });

  it('supports configurable maximum and reset', () => {
    const energy = new EnergySystem({ ...DEFAULT_ENERGY_RULES, maxEnergy: 60 });
    expect(energy.current).toBe(60);
    energy.spend(60);
    expect(energy.current).toBe(0);

    energy.reset();
    expect(energy.current).toBe(60);
  });
});

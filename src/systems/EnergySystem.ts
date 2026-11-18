export interface EnergyRules {
  readonly maxEnergy: number;
  readonly gainOnTakingDamage: number;
  readonly gainOnPerfectGuard: number;
}

export const DEFAULT_ENERGY_RULES: EnergyRules = Object.freeze({
  maxEnergy: 100,
  gainOnTakingDamage: 3,
  gainOnPerfectGuard: 6,
});

export class EnergySystem {
  readonly rules: EnergyRules;

  private currentEnergy: number;

  constructor(rules: EnergyRules = DEFAULT_ENERGY_RULES) {
    if (!Number.isFinite(rules.maxEnergy) || rules.maxEnergy <= 0) {
      throw new RangeError('maxEnergy must be a positive finite number.');
    }

    this.rules = rules;
    this.currentEnergy = rules.maxEnergy;
  }

  get current(): number {
    return this.currentEnergy;
  }

  get max(): number {
    return this.rules.maxEnergy;
  }

  get ratio(): number {
    return Math.min(1, Math.max(0, this.currentEnergy / this.rules.maxEnergy));
  }

  canSpend(amount: number): boolean {
    return (
      Number.isFinite(amount) && amount >= 0 && this.currentEnergy >= Math.min(amount, this.max)
    );
  }

  spend(amount: number): boolean {
    if (!this.canSpend(amount)) {
      return false;
    }

    this.currentEnergy = Math.max(0, this.currentEnergy - amount);
    return true;
  }

  gain(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }

    const previous = this.currentEnergy;
    this.currentEnergy = Math.min(this.max, this.currentEnergy + amount);
    return this.currentEnergy - previous;
  }

  reset(): void {
    this.currentEnergy = this.max;
  }
}

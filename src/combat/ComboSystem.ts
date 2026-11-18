import type { Fighter } from '../entities/Fighter';

export interface ComboRules {
  readonly timeoutFrames: number;
  readonly scaling: readonly number[];
  readonly maxHits: number;
}

export const DEFAULT_COMBO_RULES: ComboRules = Object.freeze({
  timeoutFrames: 60,
  scaling: Object.freeze([1, 0.9, 0.8, 0.7, 0.6]),
  maxHits: 50,
});

export interface ComboSnapshot {
  readonly attackerId: string;
  readonly victimId: string;
  readonly hits: number;
  readonly damage: number;
  readonly active: boolean;
}

export interface ComboHitResult {
  readonly hits: number;
  readonly comboDamage: number;
  readonly scaledDamage: number;
  readonly started: boolean;
}

export interface ComboEndResult {
  readonly attackerId: string;
  readonly victimId: string;
  readonly hits: number;
  readonly damage: number;
}

interface ComboState {
  attackerId: string;
  victimId: string;
  hits: number;
  damage: number;
  lastHitFrame: number;
}

export class ComboSystem {
  readonly rules: ComboRules;

  private readonly combos = new Map<string, ComboState>();

  constructor(rules: ComboRules = DEFAULT_COMBO_RULES) {
    this.rules = rules;
  }

  registerHit(
    attackerId: string,
    victimId: string,
    baseDamage: number,
    frame: number,
  ): ComboHitResult {
    const key = comboKey(attackerId, victimId);
    let state = this.combos.get(key);
    const started = state === undefined;

    if (!state) {
      state = {
        attackerId,
        victimId,
        hits: 0,
        damage: 0,
        lastHitFrame: frame,
      };
      this.combos.set(key, state);
    }

    state.hits = Math.min(state.hits + 1, this.rules.maxHits);
    state.lastHitFrame = frame;

    const scaleIndex = Math.min(state.hits - 1, this.rules.scaling.length - 1);
    const scale = this.rules.scaling[scaleIndex] ?? 1;
    const scaledDamage = Math.max(1, Math.round(baseDamage * scale));
    state.damage += scaledDamage;

    return {
      hits: state.hits,
      comboDamage: state.damage,
      scaledDamage,
      started,
    };
  }

  endCombo(attackerId: string, victimId: string): ComboEndResult | null {
    const key = comboKey(attackerId, victimId);
    const state = this.combos.get(key);
    if (!state) {
      return null;
    }

    this.combos.delete(key);
    return {
      attackerId: state.attackerId,
      victimId: state.victimId,
      hits: state.hits,
      damage: state.damage,
    };
  }

  update(frame: number, fighters: readonly [Fighter, Fighter]): ComboEndResult[] {
    const ended: ComboEndResult[] = [];

    for (const [key, state] of this.combos) {
      const victim = fighters.find((fighter) => fighter.id === state.victimId);
      const timedOut = frame - state.lastHitFrame > this.rules.timeoutFrames;
      const recovered = victim !== undefined && (victim.isActionable || victim.isDefeated);

      if (!timedOut && !recovered) {
        continue;
      }

      this.combos.delete(key);
      ended.push({
        attackerId: state.attackerId,
        victimId: state.victimId,
        hits: state.hits,
        damage: state.damage,
      });
    }

    return ended;
  }

  getCombo(attackerId: string, victimId: string): ComboSnapshot | null {
    const state = this.combos.get(comboKey(attackerId, victimId));
    if (!state) {
      return null;
    }

    return {
      attackerId: state.attackerId,
      victimId: state.victimId,
      hits: state.hits,
      damage: state.damage,
      active: true,
    };
  }

  reset(): void {
    this.combos.clear();
  }
}

function comboKey(attackerId: string, victimId: string): string {
  return `${attackerId}::${victimId}`;
}

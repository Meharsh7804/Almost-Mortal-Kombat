export interface DodgeTuning {
  readonly energyCost: number;
  readonly durationFrames: number;
  readonly invulnerabilityFrames: number;
  readonly cooldownFrames: number;
  readonly speed: number;
  readonly friction: number;
}

export interface CombatTuning {
  readonly inputBufferFrames: number;
  readonly perfectGuardFrames: number;
  readonly perfectGuardBlockstunScale: number;
  readonly comboTimeoutFrames: number;
  readonly comboScaling: readonly number[];
  readonly maxComboHits: number;
  readonly maxCancelChain: number;
  readonly maxAttackRepeatsPerChain: number;
  readonly dodge: DodgeTuning;
}

export const DEFAULT_COMBAT_TUNING: CombatTuning = Object.freeze({
  inputBufferFrames: 8,
  perfectGuardFrames: 4,
  perfectGuardBlockstunScale: 0.5,
  comboTimeoutFrames: 60,
  comboScaling: Object.freeze([1, 0.9, 0.8, 0.7, 0.6]),
  maxComboHits: 50,
  maxCancelChain: 6,
  maxAttackRepeatsPerChain: 2,
  dodge: Object.freeze({
    energyCost: 15,
    durationFrames: 12,
    invulnerabilityFrames: 5,
    cooldownFrames: 45,
    speed: 620,
    friction: 2400,
  }),
});

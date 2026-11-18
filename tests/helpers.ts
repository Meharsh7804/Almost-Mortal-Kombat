import type { InputButtons, InputSnapshot } from '../src/controllers/InputManager';
import type { CombatEngine, CombatTickResult } from '../src/combat/CombatEngine';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from '../src/data/FighterData';
import { Fighter, type FighterConfig, type PlayerNumber } from '../src/entities/Fighter';
import { FIXED_STEP_SECONDS } from '../src/core/GameLoop';

export function createFighter(
  playerNumber: PlayerNumber,
  x: number,
  overrides: Partial<FighterConfig> = {},
): Fighter {
  const base = playerNumber === 1 ? PLAYER_ONE_CONFIG : PLAYER_TWO_CONFIG;
  const config: FighterConfig = {
    ...base,
    id: `${base.id}-test-${playerNumber}`,
    playerNumber,
    x,
    y: ARENA_BOUNDS.groundY,
    ...overrides,
  };

  return new Fighter(config);
}

export const BUTTONS_OFF: InputButtons = Object.freeze({
  left: false,
  right: false,
  jump: false,
  crouch: false,
  light: false,
  heavy: false,
  block: false,
  special1: false,
  special2: false,
  dodge: false,
});

export function makeInput(
  held: Partial<InputButtons> = {},
  pressed: Partial<InputButtons> = {},
  released: Partial<InputButtons> = {},
): InputSnapshot {
  return {
    held: { ...BUTTONS_OFF, ...held },
    pressed: { ...BUTTONS_OFF, ...pressed },
    released: { ...BUTTONS_OFF, ...released },
  };
}

export function neutralInputs(): readonly [InputSnapshot, InputSnapshot] {
  return [makeInput(), makeInput()];
}

export function advanceCombat(
  combat: CombatEngine,
  fighters: readonly [Fighter, Fighter],
): CombatTickResult {
  for (const fighter of fighters) {
    fighter.step(FIXED_STEP_SECONDS, ARENA_BOUNDS);
  }

  return combat.update(fighters, ARENA_BOUNDS);
}

export function advanceCombatFrames(
  combat: CombatEngine,
  fighters: readonly [Fighter, Fighter],
  frames: number,
): CombatTickResult[] {
  const results: CombatTickResult[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    results.push(advanceCombat(combat, fighters));
  }
  return results;
}

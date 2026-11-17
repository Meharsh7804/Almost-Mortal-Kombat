import type { InputButtons, InputSnapshot } from '../src/controllers/InputManager';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from '../src/data/FighterData';
import { Fighter, type FighterConfig, type PlayerNumber } from '../src/entities/Fighter';

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
});

export function makeInput(
  held: Partial<InputButtons> = {},
  pressed: Partial<InputButtons> = {},
): InputSnapshot {
  return {
    held: { ...BUTTONS_OFF, ...held },
    pressed: { ...BUTTONS_OFF, ...pressed },
  };
}

export function neutralInputs(): readonly [InputSnapshot, InputSnapshot] {
  return [makeInput(), makeInput()];
}

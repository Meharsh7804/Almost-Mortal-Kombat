import type { PlayerNumber } from '../entities/Fighter';

export const INPUT_ACTIONS = [
  'left',
  'right',
  'jump',
  'crouch',
  'light',
  'heavy',
  'block',
  'special1',
  'special2',
  'dodge',
] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];

export type InputButtons = Readonly<Record<InputAction, boolean>>;

export interface InputSnapshot {
  /** Keys currently held. Drives movement, crouch and block. */
  readonly held: InputButtons;
  /** Buttons that transitioned from up to down since the previous poll. */
  readonly pressed: InputButtons;
  /** Buttons that transitioned from down to up since the previous poll. */
  readonly released: InputButtons;
}

type PlayerButtons = Record<InputAction, boolean>;

function createButtons(): PlayerButtons {
  return {
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
  };
}

function freezeButtons(buttons: PlayerButtons): InputButtons {
  return Object.freeze({ ...buttons });
}

/**
 * Device-agnostic input state. Keyboard, future gamepad support or touch
 * controls all write button transitions here; the simulation polls a snapshot
 * once per fixed tick. Press edges live until polled, so a high-refresh render
 * loop cannot drop or duplicate an attack input.
 */
export class InputManager {
  private readonly held: Record<PlayerNumber, PlayerButtons> = {
    1: createButtons(),
    2: createButtons(),
  };

  private readonly pressed: Record<PlayerNumber, PlayerButtons> = {
    1: createButtons(),
    2: createButtons(),
  };

  private readonly released: Record<PlayerNumber, PlayerButtons> = {
    1: createButtons(),
    2: createButtons(),
  };

  setButton(player: PlayerNumber, action: InputAction, isDown: boolean): void {
    const held = this.held[player];
    const pressed = this.pressed[player];
    const released = this.released[player];

    if (isDown) {
      if (!held[action]) {
        pressed[action] = true;
      }
      held[action] = true;
    } else {
      if (held[action]) {
        released[action] = true;
      }
      held[action] = false;
    }
  }

  isHeld(player: PlayerNumber, action: InputAction): boolean {
    return this.held[player][action];
  }

  /** Returns both players' state and consumes one-shot press/release edges. */
  poll(): readonly [InputSnapshot, InputSnapshot] {
    const first = this.snapshotAndClear(1);
    const second = this.snapshotAndClear(2);
    return [first, second];
  }

  releaseAll(): void {
    for (const player of [1, 2] as const) {
      const held = this.held[player];
      const pressed = this.pressed[player];
      const released = this.released[player];
      for (const action of INPUT_ACTIONS) {
        held[action] = false;
        pressed[action] = false;
        released[action] = false;
      }
    }
  }

  reset(): void {
    this.releaseAll();
  }

  private snapshotAndClear(player: PlayerNumber): InputSnapshot {
    const held = this.held[player];
    const pressed = this.pressed[player];
    const released = this.released[player];
    const snapshot: InputSnapshot = {
      held: freezeButtons(held),
      pressed: freezeButtons(pressed),
      released: freezeButtons(released),
    };

    for (const action of INPUT_ACTIONS) {
      pressed[action] = false;
      released[action] = false;
    }

    return snapshot;
  }
}

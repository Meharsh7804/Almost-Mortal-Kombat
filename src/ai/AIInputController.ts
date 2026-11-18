import type { InputAction, InputButtons, InputManager, InputSnapshot } from '../controllers/InputManager';
import type { AIIntent } from './AITypes';

export interface AIInputFrame {
  readonly held: Partial<InputButtons>;
  readonly pressed: Partial<InputButtons>;
}

const ACTIONS: readonly InputAction[] = [
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

function empty(): AIInputFrame {
  return { held: {}, pressed: {} };
}

function press(action: InputAction): AIInputFrame {
  return { held: {}, pressed: { [action]: true } };
}

function hold(action: InputAction): AIInputFrame {
  return { held: { [action]: true }, pressed: {} };
}

function holdMove(dir: 'left' | 'right'): AIInputFrame {
  return { held: { [dir]: true }, pressed: {} };
}

function holdMovePress(dir: 'left' | 'right', action: InputAction): AIInputFrame {
  return { held: { [dir]: true }, pressed: { [action]: true } };
}

/**
 * Converts AI intents into simulated human-like inputs via the same InputManager
 * button API used by keyboard/controllers. It never mutates combat state.
 */
export class AIInputController {
  private readonly player: 1 | 2;
  private activeHeld: Partial<InputButtons> = {};

  constructor(player: 1 | 2) {
    this.player = player;
  }

  get controlledPlayer(): 1 | 2 {
    return this.player;
  }

  reset(input: InputManager): void {
    this.apply(input, empty());
  }

  applyIntent(
    intent: AIIntent,
    input: InputManager,
    towardOpponent: 1 | -1,
    awayFromOpponent: 1 | -1,
    frameInAction = 0,
  ): AIInputFrame {
    const frame = this.frameForIntent(intent, towardOpponent, awayFromOpponent, frameInAction);
    this.apply(input, frame);
    return frame;
  }

  frameForIntent(
    intent: AIIntent,
    towardOpponent: 1 | -1,
    awayFromOpponent: 1 | -1,
    frameInAction = 0,
  ): AIInputFrame {
    const toward = towardOpponent === 1 ? 'right' : 'left';
    const away = awayFromOpponent === 1 ? 'right' : 'left';

    switch (intent) {
      case 'IDLE':
        return empty();
      case 'APPROACH':
      case 'WALK_FORWARD':
        return holdMove(toward);
      case 'RETREAT':
      case 'WALK_BACKWARD':
      case 'REPOSITION':
        return holdMove(away);
      case 'BAIT':
        return frameInAction < 4 ? holdMove(away) : holdMove(toward);
      case 'JUMP':
        return frameInAction === 0 ? press('jump') : holdMove(toward);
      case 'CROUCH':
        return hold('crouch');
      case 'LIGHT_ATTACK':
      case 'COMBO_CONTINUE_LIGHT':
      case 'PUNISH_LIGHT':
      case 'ANTI_AIR_LIGHT':
        return frameInAction === 0 ? press('light') : empty();
      case 'HEAVY_ATTACK':
      case 'COMBO_CONTINUE_HEAVY':
      case 'PUNISH_HEAVY':
      case 'ANTI_AIR_HEAVY':
        return frameInAction === 0 ? press('heavy') : empty();
      case 'SPECIAL_1':
      case 'COMBO_CONTINUE_SPECIAL':
      case 'PUNISH_SPECIAL':
        return frameInAction === 0 ? press('special1') : empty();
      case 'SPECIAL_2':
        return frameInAction === 0 ? press('special2') : empty();
      case 'CROUCH_LIGHT_ATTACK':
        return frameInAction === 0
          ? { held: { crouch: true }, pressed: { light: true } }
          : hold('crouch');
      case 'BLOCK_STAND':
      case 'PERFECT_GUARD_STAND':
        // Hold block so sustained defense works; the initial transition produces
        // a press edge for perfect-guard/fresh-block timing.
        return hold('block');
      case 'BLOCK_CROUCH':
      case 'PERFECT_GUARD_CROUCH':
        return { held: { crouch: true, block: true }, pressed: {} };
      case 'DODGE_FORWARD':
        return frameInAction === 0 ? holdMovePress(toward, 'dodge') : holdMove(toward);
      case 'DODGE_BACKWARD':
        return frameInAction === 0 ? holdMovePress(away, 'dodge') : holdMove(away);
    }
  }

  private apply(input: InputManager, frame: AIInputFrame): void {
    const nextHeld = frame.held;

    for (const action of ACTIONS) {
      const wasDown = this.activeHeld[action] === true;
      const shouldBeDown = nextHeld[action] === true;
      if (wasDown !== shouldBeDown) {
        input.setButton(this.player, action, shouldBeDown);
      }
    }

    // Pulse presses as down+up transitions within the same fixed tick. InputManager
    // records the press edge and poll() will expose it to the simulation.
    for (const action of ACTIONS) {
      if (frame.pressed[action] === true && nextHeld[action] !== true) {
        input.setButton(this.player, action, true);
        input.setButton(this.player, action, false);
      }
    }

    this.activeHeld = { ...nextHeld };
  }
}

export function neutralSnapshot(): InputSnapshot {
  // Utility for tests/docs; runtime uses InputManager snapshots.
  const off = {
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
  } as const;
  return { held: off, pressed: off, released: off };
}

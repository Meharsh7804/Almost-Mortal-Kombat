import type { PlayerNumber } from '../entities/Fighter';
import type { InputAction, InputManager } from './InputManager';

interface KeyBinding {
  readonly player: PlayerNumber;
  readonly action: InputAction;
}

export const KEY_BINDINGS: Readonly<Record<string, KeyBinding>> = Object.freeze({
  KeyA: { player: 1, action: 'left' },
  KeyD: { player: 1, action: 'right' },
  KeyW: { player: 1, action: 'jump' },
  KeyS: { player: 1, action: 'crouch' },
  KeyF: { player: 1, action: 'light' },
  KeyG: { player: 1, action: 'heavy' },
  KeyT: { player: 1, action: 'block' },
  KeyH: { player: 1, action: 'special1' },
  KeyY: { player: 1, action: 'special2' },
  KeyQ: { player: 1, action: 'dodge' },
  ArrowLeft: { player: 2, action: 'left' },
  ArrowRight: { player: 2, action: 'right' },
  ArrowUp: { player: 2, action: 'jump' },
  ArrowDown: { player: 2, action: 'crouch' },
  KeyJ: { player: 2, action: 'light' },
  KeyK: { player: 2, action: 'heavy' },
  KeyO: { player: 2, action: 'block' },
  KeyU: { player: 2, action: 'special1' },
  KeyI: { player: 2, action: 'special2' },
  KeyP: { player: 2, action: 'dodge' },
});

export interface KeyboardControllerOptions {
  readonly preventDefault?: boolean;
}

type KeyboardTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * Translates physical keyboard state into device-agnostic input buttons.
 * Uses `event.code` so layout changes cannot remap controls, and releases all
 * keys on window blur to avoid stuck movement.
 */
export class KeyboardController {
  private readonly target: KeyboardTarget;
  private readonly input: InputManager;
  private readonly preventDefault: boolean;
  private destroyed = false;

  constructor(
    target: KeyboardTarget,
    input: InputManager,
    options: KeyboardControllerOptions = {},
  ) {
    this.target = target;
    this.input = input;
    this.preventDefault = options.preventDefault ?? true;

    this.target.addEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.addEventListener('keyup', this.handleKeyUp as EventListener);
    this.target.addEventListener('blur', this.handleBlur as EventListener);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.target.removeEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.handleKeyUp as EventListener);
    this.target.removeEventListener('blur', this.handleBlur as EventListener);
    this.input.releaseAll();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const binding = KEY_BINDINGS[event.code];
    if (!binding) {
      return;
    }

    if (this.preventDefault) {
      event.preventDefault();
    }

    this.input.setButton(binding.player, binding.action, true);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const binding = KEY_BINDINGS[event.code];
    if (!binding) {
      return;
    }

    if (this.preventDefault) {
      event.preventDefault();
    }

    this.input.setButton(binding.player, binding.action, false);
  };

  private readonly handleBlur = (): void => {
    this.input.releaseAll();
  };
}

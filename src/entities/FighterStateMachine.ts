export const FIGHTER_STATES = [
  'IDLE',
  'WALKING',
  'JUMPING',
  'FALLING',
  'CROUCHING',
  'ATTACKING',
  'HITSTUN',
  'KNOCKDOWN',
  'DEFEATED',
] as const;

export type FighterState = (typeof FIGHTER_STATES)[number];

const ACTIONABLE_STATES: ReadonlySet<FighterState> = new Set<FighterState>([
  'IDLE',
  'WALKING',
  'JUMPING',
  'FALLING',
  'CROUCHING',
]);

const TRANSITIONS: Readonly<Record<FighterState, readonly FighterState[]>> = {
  IDLE: [
    'WALKING',
    'JUMPING',
    'FALLING',
    'CROUCHING',
    'ATTACKING',
    'HITSTUN',
    'KNOCKDOWN',
    'DEFEATED',
  ],
  WALKING: [
    'IDLE',
    'JUMPING',
    'FALLING',
    'CROUCHING',
    'ATTACKING',
    'HITSTUN',
    'KNOCKDOWN',
    'DEFEATED',
  ],
  JUMPING: ['IDLE', 'FALLING', 'ATTACKING', 'HITSTUN', 'KNOCKDOWN', 'DEFEATED'],
  FALLING: ['IDLE', 'JUMPING', 'ATTACKING', 'HITSTUN', 'KNOCKDOWN', 'DEFEATED'],
  CROUCHING: ['IDLE', 'WALKING', 'JUMPING', 'ATTACKING', 'HITSTUN', 'KNOCKDOWN', 'DEFEATED'],
  ATTACKING: ['IDLE', 'FALLING', 'HITSTUN', 'KNOCKDOWN', 'DEFEATED'],
  HITSTUN: ['IDLE', 'FALLING', 'KNOCKDOWN', 'DEFEATED'],
  KNOCKDOWN: ['IDLE', 'FALLING', 'HITSTUN', 'DEFEATED'],
  DEFEATED: [],
};

export function isActionableState(state: FighterState): boolean {
  return ACTIONABLE_STATES.has(state);
}

/**
 * Validated fighter state transitions with optional timed states. Timers are
 * measured in simulation ticks (60 Hz); the owning fighter decides what the
 * transition means physically.
 */
export class FighterStateMachine {
  private state: FighterState;
  private framesInCurrentState = 0;
  private remaining = 0;

  constructor(initialState: FighterState = 'IDLE') {
    this.state = initialState;
  }

  get current(): FighterState {
    return this.state;
  }

  get framesInState(): number {
    return this.framesInCurrentState;
  }

  get remainingFrames(): number {
    return this.remaining;
  }

  get isActionable(): boolean {
    return isActionableState(this.state);
  }

  canTransitionTo(next: FighterState): boolean {
    if (next === this.state) {
      return true;
    }
    if (this.state === 'DEFEATED') {
      return false;
    }
    return TRANSITIONS[this.state].includes(next);
  }

  transition(next: FighterState, durationFrames = 0): boolean {
    if (!this.canTransitionTo(next)) {
      return false;
    }

    this.state = next;
    this.framesInCurrentState = 0;
    this.remaining = Math.max(0, Math.floor(durationFrames));
    return true;
  }

  tick(): void {
    this.framesInCurrentState += 1;
    if (this.remaining > 0) {
      this.remaining -= 1;
    }
  }

  reset(initialState: FighterState = 'IDLE'): void {
    this.state = initialState;
    this.framesInCurrentState = 0;
    this.remaining = 0;
  }
}

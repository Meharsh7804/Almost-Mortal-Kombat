export const BUFFERED_ACTIONS = [
  'jump',
  'light',
  'heavy',
  'special1',
  'special2',
  'dodge',
] as const;

export type BufferedAction = (typeof BUFFERED_ACTIONS)[number];

export type BufferedDirection = -1 | 0 | 1;

export interface BufferedInput {
  readonly action: BufferedAction;
  readonly tick: number;
  readonly direction: BufferedDirection;
}

export class InputBuffer {
  readonly durationFrames: number;

  private readonly entries: BufferedInput[] = [];

  constructor(durationFrames: number) {
    if (!Number.isFinite(durationFrames) || durationFrames < 0) {
      throw new RangeError('InputBuffer duration must be a non-negative finite number.');
    }

    this.durationFrames = Math.floor(durationFrames);
  }

  get size(): number {
    return this.entries.length;
  }

  get items(): readonly BufferedInput[] {
    return this.entries;
  }

  enqueue(action: BufferedAction, tick: number, direction: BufferedDirection = 0): void {
    this.entries.push({
      action,
      tick: Math.max(0, Math.floor(tick)),
      direction,
    });
  }

  prune(currentTick: number): void {
    const oldestValid = currentTick - this.durationFrames;

    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (entry && entry.tick < oldestValid) {
        this.entries.splice(index, 1);
      }
    }
  }

  consume(entry: BufferedInput): boolean {
    const index = this.entries.indexOf(entry);
    if (index < 0) {
      return false;
    }

    this.entries.splice(index, 1);
    return true;
  }

  clear(): void {
    this.entries.length = 0;
  }
}

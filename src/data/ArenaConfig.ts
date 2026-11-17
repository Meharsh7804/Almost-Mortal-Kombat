/**
 * Logical arena measurements shared by the simulation and the arena renderer.
 * Coordinates are in the game's fixed 1280x720 space; fighter Y values are the
 * ground contact point (their feet).
 */
export interface ArenaBounds {
  readonly left: number;
  readonly right: number;
  readonly groundY: number;
  readonly width: number;
  readonly height: number;
}

export const ARENA_BOUNDS: ArenaBounds = Object.freeze({
  left: 96,
  right: 1184,
  groundY: 592,
  width: 1280,
  height: 720,
});

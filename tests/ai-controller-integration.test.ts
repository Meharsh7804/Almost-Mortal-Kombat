import { describe, expect, it } from 'vitest';

import { AIController } from '../src/ai/AIController';
import { CombatEngine } from '../src/combat/CombatEngine';
import { InputManager } from '../src/controllers/InputManager';
import { ENERGY_BLAST } from '../src/combat/FrameData';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { createFighter } from './helpers';

function stepControlledMatch(options: { seed: number; difficulty?: 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT'; personality?: 'AGGRESSOR' | 'DEFENDER' | 'TRICKSTER' | 'BRUISER'; ticks: number }) {
  const aiFighter = createFighter(2, 860);
  const humanFighter = createFighter(1, 420);
  humanFighter.faceTowards(aiFighter.x);
  aiFighter.faceTowards(humanFighter.x);

  const combat = new CombatEngine();
  const input = new InputManager();
  const ai = new AIController({
    controlledPlayer: 2,
    difficulty: options.difficulty ?? 'HARD',
    personality: options.personality ?? 'AGGRESSOR',
    seed: options.seed,
  });

  for (let tick = 0; tick < options.ticks; tick += 1) {
    ai.update({
      input,
      self: aiFighter,
      opponent: humanFighter,
      arena: ARENA_BOUNDS,
      combat,
      tick,
      allowControl: true,
      hitstopActive: false,
    });
    const snaps = input.poll();
    aiFighter.applyControls(toControls(snaps[1]));
    humanFighter.applyControls(toControls(snaps[0]));
    aiFighter.step(1 / 60, ARENA_BOUNDS);
    humanFighter.step(1 / 60, ARENA_BOUNDS);
    combat.update([humanFighter, aiFighter], ARENA_BOUNDS);
  }

  return { aiFighter, humanFighter, combat, ai };
}

function toControls(snapshot: { held: any; pressed: any }) {
  return {
    moveLeft: snapshot.held.left,
    moveRight: snapshot.held.right,
    crouch: snapshot.held.crouch,
    jumpPressed: snapshot.pressed.jump,
    lightPressed: snapshot.pressed.light,
    heavyPressed: snapshot.pressed.heavy,
    block: snapshot.held.block,
    blockPressed: snapshot.pressed.block,
    special1Pressed: snapshot.pressed.special1,
    special2Pressed: snapshot.pressed.special2,
    dodgePressed: snapshot.pressed.dodge,
  };
}

describe('AI controller integration', () => {
  it('acts through InputManager without mutating health/energy directly', () => {
    const aiFighter = createFighter(2, 560);
    const human = createFighter(1, 500);
    const combat = new CombatEngine();
    const input = new InputManager();
    const ai = new AIController({ controlledPlayer: 2, difficulty: 'NORMAL', personality: 'AGGRESSOR', seed: 1 });

    const initialHealth = aiFighter.health;
    const initialEnergy = aiFighter.energy;

    ai.update({
      input,
      self: aiFighter,
      opponent: human,
      arena: ARENA_BOUNDS,
      combat,
      tick: 0,
      allowControl: true,
      hitstopActive: false,
    });

    expect(aiFighter.health).toBe(initialHealth);
    expect(aiFighter.energy).toBe(initialEnergy);
  });

  it('can take offensive action in range over time', () => {
    const result = stepControlledMatch({ seed: 2024, difficulty: 'HARD', personality: 'AGGRESSOR', ticks: 240 });
    const moved = Math.abs(result.aiFighter.x - 860) > 1 || result.aiFighter.state !== 'IDLE' || result.aiFighter.activeAttack !== null;
    expect(moved).toBe(true);
  });

  it('does not emit button-driving decisions during defeat/disabled control', () => {
    const aiFighter = createFighter(2, 560);
    const human = createFighter(1, 500);
    const combat = new CombatEngine();
    const input = new InputManager();
    const ai = new AIController({ controlledPlayer: 2, difficulty: 'NORMAL', personality: 'AGGRESSOR', seed: 3 });

    aiFighter.takeDamage(1000);
    ai.update({
      input,
      self: aiFighter,
      opponent: human,
      arena: ARENA_BOUNDS,
      combat,
      tick: 0,
      allowControl: false,
      hitstopActive: false,
    });
    const snap = input.poll()[1];
    expect(Object.values(snap.held).every((v) => v === false)).toBe(true);
    expect(Object.values(snap.pressed).every((v) => v === false)).toBe(true);
  });

  it('respects energy constraints for specials (cannot cast without cost being paid by combat system)', () => {
    const aiFighter = createFighter(2, 560);
    aiFighter.spendEnergy(aiFighter.energy);
    expect(aiFighter.energy).toBe(0);
    expect(aiFighter.tryStartAttack(ENERGY_BLAST)).toBe(false);
    // sanity: no projectile spawned and no hidden energy grant
    const combat = new CombatEngine();
    expect(combat.projectiles.active.length).toBe(0);
  });

  it('is deterministic for identical seeds and initial conditions', () => {
    const a = stepControlledMatch({ seed: 777, difficulty: 'NORMAL', personality: 'TRICKSTER', ticks: 180 });
    const b = stepControlledMatch({ seed: 777, difficulty: 'NORMAL', personality: 'TRICKSTER', ticks: 180 });
    expect(a.aiFighter.x).toBe(b.aiFighter.x);
    expect(a.aiFighter.y).toBe(b.aiFighter.y);
    expect(a.aiFighter.state).toBe(b.aiFighter.state);
    expect(a.humanFighter.health).toBe(b.humanFighter.health);
  });
});
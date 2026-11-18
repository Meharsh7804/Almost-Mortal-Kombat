import { describe, expect, it } from 'vitest';

import { LIGHT_PUNCH } from '../src/combat/FrameData';
import { ARENA_BOUNDS } from '../src/data/ArenaConfig';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from '../src/data/FighterData';
import {
  FighterStateMachine,
  FIGHTER_STATES,
  isActionableState,
} from '../src/entities/FighterStateMachine';
import { createFighter } from './helpers';

const STEPS_PER_SECOND = 60;
const FRAME_SECONDS = 1 / STEPS_PER_SECOND;

function step(fighter: ReturnType<typeof createFighter>, frames: number): void {
  for (let frame = 0; frame < frames; frame += 1) {
    fighter.step(FRAME_SECONDS, ARENA_BOUNDS);
  }
}

describe('fighter state machine', () => {
  it('starts idle and actionable', () => {
    const machine = new FighterStateMachine();
    expect(machine.current).toBe('IDLE');
    expect(machine.isActionable).toBe(true);
    expect(machine.framesInState).toBe(0);
  });

  it('allows only valid transitions', () => {
    const machine = new FighterStateMachine();

    expect(machine.transition('ATTACKING')).toBe(true);
    expect(machine.current).toBe('ATTACKING');
    expect(machine.isActionable).toBe(false);
    expect(machine.transition('WALKING')).toBe(false);
    expect(machine.transition('CROUCHING')).toBe(false);
    expect(machine.transition('IDLE')).toBe(true);

    expect(machine.transition('JUMPING')).toBe(true);
    expect(machine.transition('FALLING')).toBe(true);
    expect(machine.transition('IDLE')).toBe(true);
  });

  it('counts down timed states but leaves the exit to the fighter', () => {
    const machine = new FighterStateMachine();
    machine.transition('HITSTUN', 3);

    machine.tick();
    machine.tick();
    expect(machine.remainingFrames).toBe(1);
    machine.tick();
    expect(machine.remainingFrames).toBe(0);
    expect(machine.current).toBe('HITSTUN');
    expect(machine.framesInState).toBe(3);
  });

  it('locks defeated fighters out of every state', () => {
    const machine = new FighterStateMachine();
    machine.transition('DEFEATED');

    expect(machine.isActionable).toBe(false);
    expect(machine.canTransitionTo('IDLE')).toBe(false);
    expect(machine.transition('IDLE')).toBe(false);
    expect(machine.transition('DEFEATED')).toBe(true);
  });

  it('exposes the full state list and actionability rules', () => {
    expect(FIGHTER_STATES).toHaveLength(13);
    expect(isActionableState('IDLE')).toBe(true);
    expect(isActionableState('WALKING')).toBe(true);
    expect(isActionableState('JUMPING')).toBe(true);
    expect(isActionableState('FALLING')).toBe(true);
    expect(isActionableState('CROUCHING')).toBe(true);
    expect(isActionableState('ATTACKING')).toBe(false);
    expect(isActionableState('SPECIAL_ATTACK')).toBe(false);
    expect(isActionableState('BLOCKING')).toBe(false);
    expect(isActionableState('BLOCKSTUN')).toBe(false);
    expect(isActionableState('DODGING')).toBe(false);
    expect(isActionableState('HITSTUN')).toBe(false);
    expect(isActionableState('KNOCKDOWN')).toBe(false);
    expect(isActionableState('DEFEATED')).toBe(false);
  });
});

describe('fighter simulation', () => {
  it('walks in the requested direction and decelerates on release', () => {
    const fighter = createFighter(1, PLAYER_ONE_CONFIG.x);

    fighter.applyControls({
      moveLeft: false,
      moveRight: true,
      crouch: false,
      jumpPressed: false,
      lightPressed: false,
      heavyPressed: false,
    });
    step(fighter, 10);

    expect(fighter.x).toBeGreaterThan(PLAYER_ONE_CONFIG.x);
    expect(fighter.state).toBe('WALKING');
    expect(fighter.velocityX).toBeGreaterThan(0);

    fighter.applyControls({
      moveLeft: false,
      moveRight: false,
      crouch: false,
      jumpPressed: false,
      lightPressed: false,
      heavyPressed: false,
    });
    step(fighter, 20);

    expect(fighter.state).toBe('IDLE');
    expect(fighter.velocityX).toBe(0);
  });

  it('jumps once, falls under gravity and lands back on the ground', () => {
    const fighter = createFighter(1, PLAYER_ONE_CONFIG.x);

    fighter.applyControls({
      moveLeft: false,
      moveRight: false,
      crouch: false,
      jumpPressed: true,
      lightPressed: false,
      heavyPressed: false,
    });

    expect(fighter.state).toBe('JUMPING');
    expect(fighter.grounded).toBe(false);
    expect(fighter.velocityY).toBe(-PLAYER_ONE_CONFIG.jumpForce);
    expect(fighter.y).toBe(ARENA_BOUNDS.groundY);

    step(fighter, 1);
    expect(fighter.y).toBeLessThan(ARENA_BOUNDS.groundY);

    fighter.applyControls({
      moveLeft: false,
      moveRight: false,
      crouch: false,
      jumpPressed: true,
      lightPressed: false,
      heavyPressed: false,
    });
    expect(fighter.velocityY).toBeLessThan(0);

    step(fighter, 60);

    expect(fighter.grounded).toBe(true);
    expect(fighter.y).toBe(ARENA_BOUNDS.groundY);
    expect(fighter.state).toBe('IDLE');
  });

  it('crouches with a reduced hurtbox and cannot walk while crouching', () => {
    const fighter = createFighter(1, PLAYER_ONE_CONFIG.x);
    const standingHeight = fighter.getHurtbox().height;

    fighter.applyControls({
      moveLeft: false,
      moveRight: true,
      crouch: true,
      jumpPressed: false,
      lightPressed: false,
      heavyPressed: false,
    });
    step(fighter, 5);

    expect(fighter.state).toBe('CROUCHING');
    expect(fighter.getHurtbox().height).toBe(118);
    expect(fighter.getHurtbox().height).toBeLessThan(standingHeight);
    expect(fighter.getHurtbox().width).toBe(74);
    expect(fighter.x).toBe(PLAYER_ONE_CONFIG.x);
  });

  it('cannot attack while in hitstun or airborne', () => {
    const fighter = createFighter(1, PLAYER_ONE_CONFIG.x);

    fighter.enterHitstun(20);
    fighter.applyControls({
      moveLeft: false,
      moveRight: false,
      crouch: false,
      jumpPressed: false,
      lightPressed: true,
      heavyPressed: false,
    });
    expect(fighter.activeAttack).toBeNull();
    expect(fighter.state).toBe('HITSTUN');

    const airborne = createFighter(2, PLAYER_TWO_CONFIG.x);
    airborne.tryJump();
    airborne.applyControls({
      moveLeft: false,
      moveRight: false,
      crouch: false,
      jumpPressed: false,
      lightPressed: true,
      heavyPressed: false,
    });
    expect(airborne.activeAttack).toBeNull();
  });

  it('starts a grounded attack and holds position during it', () => {
    const fighter = createFighter(1, PLAYER_ONE_CONFIG.x);

    expect(fighter.tryStartAttack(LIGHT_PUNCH)).toBe(true);
    const startX = fighter.x;
    step(fighter, 5);

    expect(fighter.state).toBe('ATTACKING');
    expect(fighter.activeAttack).not.toBeNull();
    expect(fighter.x).toBe(startX);
    expect(fighter.tryStartAttack(LIGHT_PUNCH)).toBe(false);
  });

  it('ignores movement input and actions once defeated', () => {
    const fighter = createFighter(1, PLAYER_ONE_CONFIG.x);
    fighter.setDefeated();
    const defeatedX = fighter.x;

    fighter.applyControls({
      moveLeft: false,
      moveRight: true,
      crouch: false,
      jumpPressed: true,
      lightPressed: true,
      heavyPressed: true,
    });
    step(fighter, 10);

    expect(fighter.health).toBe(0);
    expect(fighter.state).toBe('DEFEATED');
    expect(fighter.x).toBe(defeatedX);
    expect(fighter.activeAttack).toBeNull();
  });

  it('resets health, position, facing and state', () => {
    const fighter = createFighter(1, PLAYER_ONE_CONFIG.x);
    fighter.takeDamage(40);
    fighter.setFacing(-1);
    fighter.tryStartAttack(LIGHT_PUNCH);
    fighter.applyKnockback(100, 0);
    step(fighter, 3);

    fighter.reset();

    expect(fighter.health).toBe(PLAYER_ONE_CONFIG.maxHealth);
    expect(fighter.x).toBe(PLAYER_ONE_CONFIG.x);
    expect(fighter.y).toBe(ARENA_BOUNDS.groundY);
    expect(fighter.facing).toBe(1);
    expect(fighter.state).toBe('IDLE');
    expect(fighter.grounded).toBe(true);
    expect(fighter.activeAttack).toBeNull();
    expect(fighter.velocityX).toBe(0);
    expect(fighter.velocityY).toBe(0);
  });

  it('respects the arena boundaries', () => {
    const fighter = createFighter(1, 130);

    fighter.applyControls({
      moveLeft: true,
      moveRight: false,
      crouch: false,
      jumpPressed: false,
      lightPressed: false,
      heavyPressed: false,
    });
    step(fighter, 120);

    const minX = ARENA_BOUNDS.left + PLAYER_ONE_CONFIG.pushboxWidth / 2;
    expect(fighter.x).toBeGreaterThanOrEqual(minX);
    expect(fighter.x).toBeCloseTo(minX, 5);
  });
});

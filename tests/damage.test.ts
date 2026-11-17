import { describe, expect, it } from 'vitest';

import { applyHit } from '../src/combat/DamageSystem';
import { HEAVY_PUNCH, LIGHT_PUNCH } from '../src/combat/FrameData';
import { createFighter } from './helpers';

describe('damage application', () => {
  it('applies light damage, hitstun and knockback away from the attacker', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);

    const result = applyHit(attacker, victim, LIGHT_PUNCH);

    expect(result).toEqual({ applied: 5, defeated: false, victimId: victim.id });
    expect(victim.health).toBe(95);
    expect(victim.state).toBe('HITSTUN');
    expect(victim.stateRemainingFrames).toBe(LIGHT_PUNCH.hitstunFrames);
    expect(victim.stateDurationFrames).toBe(LIGHT_PUNCH.hitstunFrames);
    expect(victim.velocityX).toBe(LIGHT_PUNCH.knockback);
  });

  it('knocks the victim toward the attacker relative side', () => {
    const attacker = createFighter(1, 560);
    const victim = createFighter(2, 500);
    attacker.setFacing(-1);

    applyHit(attacker, victim, LIGHT_PUNCH);

    expect(victim.velocityX).toBe(-LIGHT_PUNCH.knockback);
  });

  it('causes knockdown, launch and heavier reactions with a heavy attack', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);

    const result = applyHit(attacker, victim, HEAVY_PUNCH);

    expect(result.applied).toBe(HEAVY_PUNCH.damage);
    expect(victim.health).toBe(88);
    expect(victim.state).toBe('KNOCKDOWN');
    expect(victim.stateRemainingFrames).toBe(HEAVY_PUNCH.hitstunFrames);
    expect(victim.velocityX).toBe(HEAVY_PUNCH.knockback);
    expect(victim.velocityY).toBe(-HEAVY_PUNCH.launchForce);
    expect(victim.grounded).toBe(false);
  });

  it('cancels an attack that is interrupted by a hit', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    victim.tryStartAttack(LIGHT_PUNCH);

    applyHit(attacker, victim, LIGHT_PUNCH);

    expect(victim.activeAttack).toBeNull();
    expect(victim.state).toBe('HITSTUN');
  });

  it('clamps lethal damage to remaining health and reports defeat', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    victim.takeDamage(97);

    const result = applyHit(attacker, victim, HEAVY_PUNCH);

    expect(result).toEqual({ applied: 3, defeated: true, victimId: victim.id });
    expect(victim.health).toBe(0);
    expect(victim.isDefeated).toBe(true);
    expect(victim.state).toBe('DEFEATED');
  });

  it('ignores further hits once the victim is defeated', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    victim.setDefeated();

    const result = applyHit(attacker, victim, HEAVY_PUNCH);

    expect(result).toEqual({ applied: 0, defeated: false, victimId: victim.id });
    expect(victim.health).toBe(0);
  });

  it('does not report a defeat for a zero-health fighter that is not yet defeated', () => {
    const attacker = createFighter(1, 500);
    const victim = createFighter(2, 560);
    victim.takeDamage(100);

    const result = applyHit(attacker, victim, LIGHT_PUNCH);

    expect(result).toEqual({ applied: 0, defeated: false, victimId: victim.id });
    expect(victim.state).toBe('IDLE');
  });
});

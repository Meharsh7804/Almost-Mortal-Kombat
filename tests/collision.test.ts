import { describe, expect, it } from 'vitest';

import {
  boxFromCenterBottom,
  getBoxCenter,
  getIntersection,
  rectanglesIntersect,
  type AABB,
} from '../src/utils/CollisionUtils';
import { computeAttackHitbox } from '../src/combat/HitboxSystem';
import { LIGHT_PUNCH } from '../src/combat/FrameData';

function box(x: number, y: number, width = 100, height = 100): AABB {
  return { x, y, width, height };
}

describe('rectangle intersection', () => {
  it('detects overlapping rectangles', () => {
    expect(rectanglesIntersect(box(0, 0), box(50, 50))).toBe(true);
  });

  it('rejects rectangles separated on either axis', () => {
    expect(rectanglesIntersect(box(0, 0), box(200, 0))).toBe(false);
    expect(rectanglesIntersect(box(0, 0), box(0, 200))).toBe(false);
  });

  it('does not treat touching edges as a collision', () => {
    expect(rectanglesIntersect(box(0, 0), box(100, 0))).toBe(false);
    expect(rectanglesIntersect(box(0, 0), box(0, 100))).toBe(false);
    expect(rectanglesIntersect(box(0, 0), box(100, 100))).toBe(false);
  });

  it('detects full containment', () => {
    expect(rectanglesIntersect(box(0, 0), box(25, 25, 10, 10))).toBe(true);
  });

  it('returns the intersection rectangle and center', () => {
    const intersection = getIntersection(box(0, 0), box(80, 60, 50, 50));
    expect(intersection).not.toBeNull();
    expect(intersection).toEqual({ x: 80, y: 60, width: 20, height: 40 });
    expect(getBoxCenter(intersection!)).toEqual({ x: 90, y: 80 });
    expect(getIntersection(box(0, 0), box(300, 300))).toBeNull();
  });

  it('builds boxes from a center and ground contact point', () => {
    expect(boxFromCenterBottom(640, 592, 64, 154)).toEqual({
      x: 608,
      y: 438,
      width: 64,
      height: 154,
    });
  });
});

describe('facing-dependent attack hitboxes', () => {
  const definition = LIGHT_PUNCH.hitbox;

  it('mirrors the horizontal offset when facing right and left', () => {
    const right = computeAttackHitbox(600, 592, 1, definition);
    const left = computeAttackHitbox(600, 592, -1, definition);

    expect(right.width).toBe(definition.width);
    expect(right.height).toBe(definition.height);
    expect(right.x + right.width / 2).toBe(600 + definition.offsetX);
    expect(left.x + left.width / 2).toBe(600 - definition.offsetX);
    expect(right.y).toBe(left.y);
  });

  it('places the hitbox at the configured height above the feet', () => {
    const hitbox = computeAttackHitbox(500, 592, 1, definition);
    expect(hitbox.y + hitbox.height / 2).toBe(592 - definition.offsetY);
  });

  it('actually connects in front of the attacker and misses behind', () => {
    const attackerHitbox = computeAttackHitbox(500, 592, 1, definition);
    const victimInFront = boxFromCenterBottom(560, 592, 64, 154);
    const victimBehind = boxFromCenterBottom(440, 592, 64, 154);

    expect(rectanglesIntersect(attackerHitbox, victimInFront)).toBe(true);
    expect(rectanglesIntersect(attackerHitbox, victimBehind)).toBe(false);
  });
});

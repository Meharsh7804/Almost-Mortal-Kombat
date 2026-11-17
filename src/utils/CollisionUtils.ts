/**
 * Rectangle collision primitives shared by combat, pushbox separation and the
 * debug renderer. Boxes use top-left origin and positive dimensions.
 *
 * Edge contact is deliberately not a collision: adjacent boxes that only touch
 * must not register a hit or push.
 */
export interface AABB {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function rectanglesIntersect(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function getIntersection(a: AABB, b: AABB): AABB | null {
  if (!rectanglesIntersect(a, b)) {
    return null;
  }

  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  return { x, y, width: right - x, height: bottom - y };
}

export function getBoxCenter(box: AABB): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Builds an axis-aligned box from a horizontal center and a bottom edge.
 * Fighters use their feet as the bottom anchor, which keeps standing and
 * crouching hurtboxes aligned on the ground.
 */
export function boxFromCenterBottom(
  centerX: number,
  bottomY: number,
  width: number,
  height: number,
): AABB {
  return {
    x: centerX - width / 2,
    y: bottomY - height,
    width,
    height,
  };
}

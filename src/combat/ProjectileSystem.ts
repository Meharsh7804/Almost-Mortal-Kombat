import type { ArenaBounds } from '../data/ArenaConfig';
import type { Fighter } from '../entities/Fighter';
import type { AABB } from '../utils/CollisionUtils';
import type { AttackDefinition } from './FrameData';

export interface Projectile {
  id: number;
  active: boolean;
  owner: Fighter | null;
  ownerId: string;
  attack: AttackDefinition | null;
  x: number;
  y: number;
  velocityX: number;
  direction: 1 | -1;
  remainingFrames: number;
  readonly hitTargets: Set<string>;
}

const DEFAULT_POOL_SIZE = 12;
const ARENA_MARGIN = 96;

export class ProjectileSystem {
  private readonly pool: Projectile[];
  private readonly activeList: Projectile[] = [];
  private nextId = 1;

  constructor(poolSize: number = DEFAULT_POOL_SIZE) {
    const size = Math.max(1, Math.floor(poolSize));
    this.pool = Array.from({ length: size }, (_, index) => ({
      id: index,
      active: false,
      owner: null,
      ownerId: '',
      attack: null,
      x: 0,
      y: 0,
      velocityX: 0,
      direction: 1,
      remainingFrames: 0,
      hitTargets: new Set<string>(),
    }));
  }

  get active(): readonly Projectile[] {
    return this.activeList;
  }

  spawn(owner: Fighter, attack: AttackDefinition): Projectile | null {
    const definition = attack.projectile;
    if (!definition || owner.isDefeated) {
      return null;
    }

    const projectile = this.pool.find((candidate) => !candidate.active);
    if (!projectile) {
      return null;
    }

    projectile.active = true;
    projectile.owner = owner;
    projectile.ownerId = owner.id;
    projectile.attack = attack;
    projectile.direction = owner.facing;
    projectile.x = owner.x + owner.facing * definition.offsetX;
    projectile.y = owner.y - definition.offsetY;
    projectile.velocityX = owner.facing * definition.speed;
    projectile.remainingFrames = definition.lifetimeFrames;
    projectile.hitTargets.clear();
    this.nextId += 1;
    projectile.id = this.nextId;

    this.activeList.push(projectile);
    return projectile;
  }

  update(deltaSeconds: number, arena: ArenaBounds): void {
    for (let index = this.activeList.length - 1; index >= 0; index -= 1) {
      const projectile = this.activeList[index];
      if (!projectile) {
        continue;
      }

      projectile.x += projectile.velocityX * deltaSeconds;
      projectile.remainingFrames -= 1;

      if (
        projectile.remainingFrames <= 0 ||
        projectile.x < arena.left - ARENA_MARGIN ||
        projectile.x > arena.right + ARENA_MARGIN
      ) {
        this.deactivate(projectile);
      }
    }
  }

  deactivate(projectile: Projectile): void {
    if (!projectile.active) {
      return;
    }

    projectile.active = false;
    projectile.owner = null;
    projectile.ownerId = '';
    projectile.attack = null;
    projectile.remainingFrames = 0;
    projectile.hitTargets.clear();

    const index = this.activeList.indexOf(projectile);
    if (index >= 0) {
      this.activeList.splice(index, 1);
    }
  }

  getBounds(projectile: Projectile): AABB | null {
    const definition = projectile.attack?.projectile;
    if (!projectile.active || !definition) {
      return null;
    }

    return {
      x: projectile.x - definition.width / 2,
      y: projectile.y - definition.height / 2,
      width: definition.width,
      height: definition.height,
    };
  }

  reset(): void {
    for (const projectile of this.pool) {
      if (projectile.active) {
        this.deactivate(projectile);
      }
    }

    this.activeList.length = 0;
  }
}

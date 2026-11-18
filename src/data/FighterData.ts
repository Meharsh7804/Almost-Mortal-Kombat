import type { FighterConfig } from '../entities/Fighter';
import {
  ENERGY_BLAST,
  HEAVY_PUNCH,
  LIGHT_PUNCH,
  LOW_KICK,
  RISING_STRIKE,
  SHADOW_DASH,
  THUNDER_KICK,
} from '../combat/FrameData';
import { DEFAULT_ENERGY_RULES } from '../systems/EnergySystem';
import { ARENA_BOUNDS } from './ArenaConfig';

const SHARED_CONFIG = {
  maxHealth: 100,
  movementSpeed: 322,
  jumpForce: 780,
  gravity: 2200,
  acceleration: 3000,
  deceleration: 3400,
  airAcceleration: 1900,
  airDeceleration: 240,
  pushboxWidth: 54,
  hurtbox: {
    standingWidth: 64,
    standingHeight: 154,
    crouchingWidth: 74,
    crouchingHeight: 118,
  },
  canAttackAirborne: false,
  lightAttack: LIGHT_PUNCH,
  heavyAttack: HEAVY_PUNCH,
  crouchingLightAttack: LOW_KICK,
  energyRules: DEFAULT_ENERGY_RULES,
} satisfies Omit<
  FighterConfig,
  'id' | 'name' | 'playerNumber' | 'x' | 'y' | 'color' | 'accentColor' | 'specialAttacks'
>;

export const PLAYER_ONE_CONFIG: FighterConfig = Object.freeze({
  ...SHARED_CONFIG,
  id: 'kai',
  name: 'KAI',
  playerNumber: 1,
  x: 420,
  y: ARENA_BOUNDS.groundY,
  color: 0x2ee6ff,
  accentColor: 0x0c6b8f,
  specialAttacks: Object.freeze([ENERGY_BLAST, RISING_STRIKE] as const),
});

export const PLAYER_TWO_CONFIG: FighterConfig = Object.freeze({
  ...SHARED_CONFIG,
  id: 'rhea',
  name: 'RHEA',
  playerNumber: 2,
  x: 860,
  y: ARENA_BOUNDS.groundY,
  color: 0xff5a36,
  accentColor: 0x8f2c14,
  specialAttacks: Object.freeze([SHADOW_DASH, THUNDER_KICK] as const),
});

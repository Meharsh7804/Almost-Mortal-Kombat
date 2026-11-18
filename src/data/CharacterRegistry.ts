import type { FighterConfig } from '../entities/Fighter';
import { KAI_VISUAL, RHEA_VISUAL } from './CharacterVisuals';
import { PLAYER_ONE_CONFIG, PLAYER_TWO_CONFIG } from './FighterData';

export type CharacterArchetype = 'RUSH_DOWN' | 'BALANCED' | 'ZONER' | 'TECHNICAL';

export interface CharacterDescriptiveStats {
  readonly power: number;
  readonly speed: number;
  readonly range: number;
  readonly defense: number;
  readonly difficulty: number;
}

export interface CharacterDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly archetype: CharacterArchetype;
  readonly description: string;
  readonly stats: CharacterDescriptiveStats;
  readonly visualId: string;
  /** Base fighter/combat config used as source of truth for combat parameters. */
  readonly fighterConfig: FighterConfig;
}

export const KAI_CHARACTER: CharacterDefinition = Object.freeze({
  id: 'kai',
  displayName: 'KAI',
  archetype: 'BALANCED',
  description: 'A disciplined rift striker with steady pressure, clean confirms, and reliable energy control.',
  stats: Object.freeze({ power: 3, speed: 3, range: 3, defense: 3, difficulty: 2 }),
  visualId: KAI_VISUAL.id,
  fighterConfig: PLAYER_ONE_CONFIG,
});

export const RHEA_CHARACTER: CharacterDefinition = Object.freeze({
  id: 'rhea',
  displayName: 'RHEA',
  archetype: 'RUSH_DOWN',
  description: 'An ember-charged brawler who thrives on momentum, sharp entries, and punishing close-range bursts.',
  stats: Object.freeze({ power: 4, speed: 4, range: 2, defense: 2, difficulty: 3 }),
  visualId: RHEA_VISUAL.id,
  fighterConfig: PLAYER_TWO_CONFIG,
});

const CHARACTERS: readonly CharacterDefinition[] = Object.freeze([KAI_CHARACTER, RHEA_CHARACTER]);
const CHARACTER_MAP = new Map(CHARACTERS.map((character) => [character.id, character]));

export function getCharacterRegistry(): readonly CharacterDefinition[] {
  return CHARACTERS;
}

export function getCharacterById(id: string): CharacterDefinition | null {
  return CHARACTER_MAP.get(id) ?? null;
}

export function getDefaultCharacterId(): string {
  return CHARACTERS[0]?.id ?? 'kai';
}

export function isValidCharacterId(id: string): boolean {
  return CHARACTER_MAP.has(id);
}

export function getRandomCharacterId(random: () => number = Math.random): string {
  const index = Math.floor(random() * CHARACTERS.length);
  return CHARACTERS[Math.max(0, Math.min(CHARACTERS.length - 1, index))]?.id ?? getDefaultCharacterId();
}

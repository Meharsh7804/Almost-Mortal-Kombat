import type { FighterConfig } from '../../entities/Fighter';

export interface CharacterDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly archetype: 'RUSH_DOWN' | 'BALANCED' | 'ZONER' | 'TECHNICAL';
  readonly description: string;
  readonly stats: Readonly<{
    power: number;
    speed: number;
    range: number;
    defense: number;
    difficulty: number;
  }>;
  readonly visualId: string;
  /** Base combat config (source of truth for existing combat parameters). */
  readonly fighterConfig: FighterConfig;
}

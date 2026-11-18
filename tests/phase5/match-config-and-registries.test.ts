import { describe, expect, it } from 'vitest';

import { DEFAULT_DIFFICULTY, DEFAULT_PERSONALITY } from '../../src/ai/AIProfiles';
import { getArenaById, getArenaRegistry, getDefaultArenaId, isValidArenaId } from '../../src/data/ArenaRegistry';
import { getCharacterById, getCharacterRegistry, getDefaultCharacterId, isValidCharacterId } from '../../src/data/CharacterRegistry';
import {
  RANDOM_ARENA_ID,
  RANDOM_CHARACTER_ID,
  createDefaultMatchConfig,
  createFighterConfigForMatch,
  normalizeMatchConfig,
  resolveMatchConfig,
  validateMatchConfig,
} from '../../src/data/MatchConfig';

describe('Phase 5 registries', () => {
  it('exposes character registry from existing fighter source of truth', () => {
    const roster = getCharacterRegistry();
    expect(roster.length).toBeGreaterThanOrEqual(2);
    expect(isValidCharacterId(getDefaultCharacterId())).toBe(true);
    const kai = getCharacterById('kai');
    const rhea = getCharacterById('rhea');
    expect(kai?.displayName).toBe('KAI');
    expect(rhea?.displayName).toBe('RHEA');
    expect(kai?.fighterConfig).toBeTruthy();
    expect(rhea?.fighterConfig).toBeTruthy();
  });

  it('provides four data-driven visual arenas with preserved bounds', () => {
    const arenas = getArenaRegistry();
    expect(arenas.map((a) => a.id)).toEqual([
      'forgotten-temple',
      'neon-district',
      'reactor-core',
      'frozen-sanctuary',
    ]);
    expect(isValidArenaId(getDefaultArenaId())).toBe(true);
    for (const arena of arenas) {
      expect(arena.bounds.left).toBe(96);
      expect(arena.bounds.right).toBe(1184);
      expect(arena.bounds.groundY).toBe(592);
      expect(getArenaById(arena.id)?.name).toBe(arena.name);
    }
  });
});

describe('Phase 5 MatchConfig', () => {
  it('creates sensible defaults', () => {
    const config = createDefaultMatchConfig('CPU_BATTLE');
    expect(config.mode).toBe('CPU_BATTLE');
    expect(config.cpuEnabled).toBe(true);
    expect(config.cpuPlayer).toBe(2);
    expect(config.cpuDifficulty).toBe(DEFAULT_DIFFICULTY);
    expect(config.cpuPersonality).toBe(DEFAULT_PERSONALITY);
    expect(config.roundTimerSeconds).toBe(99);
    expect(config.roundsToWin).toBe(2);
    expect(config.allowDuplicateCharacters).toBe(true);
    expect(isValidCharacterId(config.player1CharacterId)).toBe(true);
    expect(isValidCharacterId(config.player2CharacterId)).toBe(true);
    expect(isValidArenaId(config.arenaId)).toBe(true);
  });

  it('normalizes invalid values and validates configs', () => {
    const normalized = normalizeMatchConfig({
      mode: 'CPU_BATTLE',
      cpuDifficulty: 'IMPOSSIBLE' as unknown as typeof DEFAULT_DIFFICULTY,
      roundTimerSeconds: -5,
      roundsToWin: 99,
      seed: 42.7,
      cpuPlayer: 2,
    });
    expect(normalized.cpuDifficulty).toBe(DEFAULT_DIFFICULTY);
    expect(normalized.roundTimerSeconds).toBe(0);
    expect(normalized.roundsToWin).toBe(5);
    expect(normalized.seed).toBe(42);
    const validation = validateMatchConfig(normalized);
    expect(validation.valid).toBe(true);
  });

  it('rejects invalid character/arena ids and duplicate policy violations', () => {
    const invalid = validateMatchConfig({
      ...createDefaultMatchConfig('LOCAL_VERSUS'),
      player1CharacterId: 'missing',
      arenaId: 'missing',
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.join(' ')).toContain('Invalid player 1 character');
    expect(invalid.errors.join(' ')).toContain('Invalid arena');

    const dup = validateMatchConfig({
      ...createDefaultMatchConfig('LOCAL_VERSUS'),
      player1CharacterId: 'kai',
      player2CharacterId: 'kai',
      allowDuplicateCharacters: false,
    });
    expect(dup.valid).toBe(false);
  });

  it('resolves random selections deterministically from seed', () => {
    const a = resolveMatchConfig({
      ...createDefaultMatchConfig('LOCAL_VERSUS'),
      player1CharacterId: RANDOM_CHARACTER_ID,
      player2CharacterId: RANDOM_CHARACTER_ID,
      arenaId: RANDOM_ARENA_ID,
      seed: 1234,
    });
    const b = resolveMatchConfig({
      ...createDefaultMatchConfig('LOCAL_VERSUS'),
      player1CharacterId: RANDOM_CHARACTER_ID,
      player2CharacterId: RANDOM_CHARACTER_ID,
      arenaId: RANDOM_ARENA_ID,
      seed: 1234,
    });
    expect(a.player1CharacterId).toBe(b.player1CharacterId);
    expect(a.player2CharacterId).toBe(b.player2CharacterId);
    expect(a.resolvedArenaId).toBe(b.resolvedArenaId);
    expect(isValidCharacterId(a.player1CharacterId)).toBe(true);
    expect(isValidArenaId(a.resolvedArenaId)).toBe(true);
  });

  it('creates fighter configs for selected characters and players', () => {
    const resolved = resolveMatchConfig({
      ...createDefaultMatchConfig('LOCAL_VERSUS'),
      player1CharacterId: 'kai',
      player2CharacterId: 'rhea',
    });
    const p1 = createFighterConfigForMatch(resolved, 1);
    const p2 = createFighterConfigForMatch(resolved, 2);
    expect(p1.playerNumber).toBe(1);
    expect(p2.playerNumber).toBe(2);
    expect(p1.displayName).toBe('KAI');
    expect(p2.displayName).toBe('RHEA');
    expect(p1.x).not.toBe(p2.x);
    expect(p1.y).toBe(592);
  });
});

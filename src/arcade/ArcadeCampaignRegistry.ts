import { getArenaById, getArenaRegistry } from '../data/ArenaRegistry';
import { getCharacterById, getCharacterRegistry } from '../data/CharacterRegistry';
import type { AIDifficulty, AIPersonality } from '../ai/AITypes';
import type { ArcadeCampaignConfig, ArcadeEndingDefinition, ArcadeResolvedStage } from './ArcadeConfig';

function personalities(): readonly AIPersonality[] {
  return ['AGGRESSOR', 'DEFENDER', 'TRICKSTER', 'BRUISER'] as const;
}

function defaultStageDifficulty(runDifficulty: AIDifficulty, stageIndex: number, total: number): AIDifficulty {
  const isBoss = stageIndex === total - 1;
  switch (runDifficulty) {
    case 'EASY':
      if (stageIndex <= 2) return 'EASY';
      if (isBoss) return 'HARD';
      return 'NORMAL';
    case 'NORMAL':
      if (stageIndex <= 1) return 'NORMAL';
      if (isBoss) return 'HARD';
      return stageIndex >= 5 ? 'HARD' : 'NORMAL';
    case 'HARD':
      if (stageIndex <= 1) return 'NORMAL';
      if (isBoss) return 'EXPERT';
      return 'HARD';
    case 'EXPERT':
      if (stageIndex <= 1) return 'HARD';
      return 'EXPERT';
    default:
      return runDifficulty;
  }
}

const stageLabels = [
  'Rival',
  'Challenger',
  'Aggressor',
  'Specialist',
  'Rival Rematch',
  'Elite Fighter',
  'Champion',
  'Final Boss',
] as const;

export function createDefaultArcadeCampaign(): ArcadeCampaignConfig {
  const total = 8;
  const stages = Array.from({ length: total }, (_, i) => ({
    index: i,
    label: stageLabels[i] ?? `Stage ${i + 1}`,
    boss: i === total - 1,
    roundsToWin: 2,
    roundTimerSeconds: 99,
  }));
  return {
    id: 'default',
    name: 'Riftbound Arcade',
    description: 'Fight through a gauntlet of rivals, elites, and a final boss.',
    difficulties: ['EASY', 'NORMAL', 'HARD', 'EXPERT'],
    defaultRoundsToWin: 2,
    defaultRoundTimerSeconds: 99,
    continuesByDifficulty: { EASY: 5, NORMAL: 3, HARD: 2, EXPERT: 1 },
    stages,
  };
}

export const ARCADE_CAMPAIGNS: readonly ArcadeCampaignConfig[] = Object.freeze([
  Object.freeze(createDefaultArcadeCampaign()),
]);

export function getArcadeCampaign(id: string): ArcadeCampaignConfig | null {
  return ARCADE_CAMPAIGNS.find((c) => c.id === id) ?? null;
}

export function getDefaultArcadeCampaign(): ArcadeCampaignConfig {
  return ARCADE_CAMPAIGNS[0]!;
}

export function resolveArcadeStages(
  campaign: ArcadeCampaignConfig,
  playerCharacterId: string,
  difficulty: AIDifficulty,
  seedBase = 1337,
): ArcadeResolvedStage[] {
  const roster = getCharacterRegistry();
  const arenas = getArenaRegistry();
  const pers = personalities();
  const resolved: ArcadeResolvedStage[] = [];
  const usedRecent: string[] = [];

  for (let i = 0; i < campaign.stages.length; i += 1) {
    const stage = campaign.stages[i]!;
    let opponentId =
      stage.opponentCharacterId && getCharacterById(stage.opponentCharacterId)
        ? stage.opponentCharacterId
        : '';

    if (!opponentId) {
      const candidates = roster.map((c) => c.id).filter((id) => id !== playerCharacterId);
      const pool = candidates.length > 0 ? candidates : roster.map((c) => c.id);
      const filtered = pool.filter((id) => !usedRecent.slice(-1).includes(id));
      const pickPool = filtered.length > 0 ? filtered : pool;
      opponentId = pickPool[(seedBase + i * 7) % pickPool.length] ?? playerCharacterId;
    }

    usedRecent.push(opponentId);

    const arena =
      stage.arenaId && getArenaById(stage.arenaId)
        ? getArenaById(stage.arenaId)!
        : arenas[i % arenas.length]!;

    const personality =
      stage.personality ?? pers[(i + (difficulty === 'HARD' ? 1 : difficulty === 'EXPERT' ? 2 : 0)) % pers.length]!;

    // Scale by selected run difficulty and stage progression (boss escalates)
    const stageDifficulty = defaultStageDifficulty(difficulty, i, campaign.stages.length);

    resolved.push({
      index: i,
      label: stage.label,
      opponentCharacterId: opponentId,
      arenaId: arena.id,
      difficulty: stageDifficulty,
      personality,
      roundsToWin: stage.roundsToWin ?? campaign.defaultRoundsToWin,
      roundTimerSeconds: stage.roundTimerSeconds ?? campaign.defaultRoundTimerSeconds,
      boss: Boolean(stage.boss || i === campaign.stages.length - 1),
    });
  }

  return resolved;
}

export const ARCADE_ENDINGS: readonly ArcadeEndingDefinition[] = Object.freeze([
  {
    characterId: 'kai',
    title: 'KAI // STILLNESS AFTER STORM',
    text: [
      'The final blow fades, and the rift’s roar collapses into silence.',
      'Kai lowers his guard, breath steady, eyes fixed on the fractured horizon.',
      'Discipline carried him through every challenger and every doubt.',
      'Yet he knows the Riftbound path is never truly finished—only mastered, one battle at a time.',
    ],
  },
  {
    characterId: 'rhea',
    title: 'RHEA // EMBER CROWN',
    text: [
      'Heat lingers in the air as Rhea stands over the conquered arena.',
      'Every rush, every risk, every blazing strike carved her victory into the night.',
      'The crowd is gone, but the fire in her chest burns brighter than ever.',
      'She grins—there are stronger foes ahead, and she intends to meet them head-on.',
    ],
  },
]);

export function getArcadeEnding(characterId: string): ArcadeEndingDefinition {
  return (
    ARCADE_ENDINGS.find((e) => e.characterId === characterId) ?? {
      characterId,
      title: `${characterId.toUpperCase()} // VICTOR'S PATH`,
      text: [
        'The gauntlet is complete and the arena falls quiet.',
        'Through resolve and skill, a new champion rises from the rift.',
        'Their story continues beyond this run—stronger, sharper, unbroken.',
      ],
    }
  );
}

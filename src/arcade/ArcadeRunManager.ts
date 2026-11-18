import type { AIDifficulty } from '../ai/AITypes';
import type { ArcadeResolvedStage, ArcadeRunSnapshot } from './ArcadeConfig';
import { getArcadeCampaign, getDefaultArcadeCampaign, resolveArcadeStages } from './ArcadeCampaignRegistry';

export interface ArcadeRunManagerState {
  snapshot: ArcadeRunSnapshot | null;
}

function uid(): string {
  return `arcade_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function startArcadeRun(characterId: string, difficulty: AIDifficulty, campaignId?: string, seedBase?: number): ArcadeRunSnapshot {
  const campaign = (campaignId ? getArcadeCampaign(campaignId) : null) ?? getDefaultArcadeCampaign();
  const seed = (seedBase ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff))) >>> 0;
  const stages = resolveArcadeStages(campaign, characterId, difficulty, seed);
  const continuesRemaining = campaign.continuesByDifficulty[difficulty] ?? 1;
  return {
    runId: uid(),
    campaignId: campaign.id,
    characterId,
    difficulty,
    seedBase: seed,
    stages,
    currentStageIndex: 0,
    wins: 0,
    losses: 0,
    continuesUsed: 0,
    continuesRemaining,
    completed: false,
    failed: false,
    stageResults: [],
  };
}

export function getCurrentArcadeStage(run: ArcadeRunSnapshot): ArcadeResolvedStage | null {
  return run.stages[run.currentStageIndex] ?? null;
}

export function advanceArcadeRunOnWin(run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  const idx = run.currentStageIndex;
  const stageResults = [...run.stageResults];
  stageResults[idx] = true;
  const isLast = idx >= run.stages.length - 1;
  return {
    ...run,
    wins: run.wins + 1,
    stageResults,
    currentStageIndex: isLast ? idx : idx + 1,
    completed: isLast,
    failed: false,
  };
}

export function advanceArcadeRunOnLoss(run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  return {
    ...run,
    losses: run.losses + 1,
  };
}

export function canContinueArcadeRun(run: ArcadeRunSnapshot): boolean {
  return !run.completed && run.continuesRemaining > 0;
}

export function continueArcadeRun(run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  if (!canContinueArcadeRun(run)) return { ...run, failed: true };
  return {
    ...run,
    continuesUsed: run.continuesUsed + 1,
    continuesRemaining: Math.max(0, run.continuesRemaining - 1),
    failed: false,
  };
}

export function restartArcadeRun(run: ArcadeRunSnapshot, seedBase?: number): ArcadeRunSnapshot {
  return startArcadeRun(run.characterId, run.difficulty, run.campaignId, seedBase);
}

export function abandonArcadeRun(run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  return {
    ...run,
    failed: !run.completed,
    completed: run.completed,
  };
}

export function isArcadeRunFinished(run: ArcadeRunSnapshot): boolean {
  return run.completed || (run.failed && run.continuesRemaining <= 0);
}

export function arcadeCompletionKey(run: ArcadeRunSnapshot): string {
  return `arcade:${run.campaignId}:${run.difficulty}:${run.characterId}`;
}

import type { PlayerProfile, ArcadeRunState } from '../progression/PlayerProfile';
import type { AIDifficulty } from '../ai/AITypes';
import type { ArcadeResolvedStage, ArcadeRunSnapshot } from './ArcadeConfig';
import type { MatchConfig } from '../data/MatchConfig';
import {
  advanceArcadeRunOnLoss,
  advanceArcadeRunOnWin,
  arcadeCompletionKey,
  canContinueArcadeRun,
  continueArcadeRun,
  getCurrentArcadeStage,
  restartArcadeRun,
  startArcadeRun,
} from './ArcadeRunManager';

export function snapshotToRunState(snapshot: ArcadeRunSnapshot, prev?: ArcadeRunState | null): ArcadeRunState {
  return {
    active: !snapshot.completed && !(snapshot.failed && snapshot.continuesRemaining <= 0),
    runId: snapshot.runId,
    characterId: snapshot.characterId,
    difficulty: snapshot.difficulty,
    campaignId: snapshot.campaignId,
    seedBase: snapshot.seedBase ?? prev?.seedBase ?? null,
    stages: snapshot.stages.map((s) => ({ ...s })),
    opponentSequenceIds: snapshot.stages.map((s) => s.opponentCharacterId),
    currentStageIndex: snapshot.currentStageIndex,
    wins: snapshot.wins,
    losses: snapshot.losses,
    continuesUsed: snapshot.continuesUsed,
    continuesRemaining: snapshot.continuesRemaining,
    completed: snapshot.completed,
    failed: snapshot.failed,
    rewardsGranted: prev?.rewardsGranted ?? false,
    stageResults: [...snapshot.stageResults],
    lastRewardedMatchToken: prev?.lastRewardedMatchToken ?? null,
  };
}

export function runStateToSnapshot(state: ArcadeRunState): ArcadeRunSnapshot | null {
  if (!state.runId || !state.characterId || !state.difficulty || !state.campaignId || state.stages.length === 0) return null;
  const stages: ArcadeResolvedStage[] = state.stages.map((s) => ({
    index: s.index,
    label: s.label,
    opponentCharacterId: s.opponentCharacterId,
    arenaId: s.arenaId,
    difficulty: s.difficulty as AIDifficulty,
    personality: s.personality,
    roundsToWin: s.roundsToWin,
    roundTimerSeconds: s.roundTimerSeconds,
    boss: s.boss,
  }));
  return {
    runId: state.runId,
    campaignId: state.campaignId,
    characterId: state.characterId,
    difficulty: state.difficulty as AIDifficulty,
    seedBase: state.seedBase ?? undefined,
    stages,
    currentStageIndex: state.currentStageIndex,
    wins: state.wins,
    losses: state.losses,
    continuesUsed: state.continuesUsed,
    continuesRemaining: state.continuesRemaining,
    completed: state.completed,
    failed: state.failed,
    stageResults: [...state.stageResults],
  };
}

export function syncRunStateToProgress(profile: PlayerProfile, snapshot: ArcadeRunSnapshot | null): void {
  if (!snapshot) {
    profile.arcadeProgress.currentRun = null;
    return;
  }
  const prev = profile.arcadeProgress.currentRun;
  profile.arcadeProgress.currentRun = snapshotToRunState(snapshot, prev);
}

export function beginArcadeRun(profile: PlayerProfile, characterId: string, difficulty: AIDifficulty, campaignId = 'default', seedBase?: number): ArcadeRunSnapshot {
  const snapshot = startArcadeRun(characterId, difficulty, campaignId, seedBase);
  profile.statistics.arcadeRunsStarted += 1;
  profile.arcadeProgress.runsStarted += 1;
  syncRunStateToProgress(profile, snapshot);
  profile.arcadeProgress.currentRun!.active = true;
  return snapshot;
}

export function recordArcadeStageWin(profile: PlayerProfile, run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  const next = advanceArcadeRunOnWin(run);
  syncRunStateToProgress(profile, next);
  if (next.completed) {
    profile.statistics.arcadeRunsCompleted += 1;
    profile.arcadeProgress.runsCompleted += 1;
    profile.arcadeProgress.endingsUnlocked[next.characterId] = true;
    const key = arcadeCompletionKey(next);
    profile.arcadeProgress.completions[key] = true;
    profile.arcadeProgress.completions[`arcade:${next.campaignId}:${next.difficulty}:any`] = true;
    profile.arcadeProgress.completions[`arcade:${next.campaignId}:any:${next.characterId}`] = true;
  }
  return next;
}

export function recordArcadeStageLoss(profile: PlayerProfile, run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  const next = advanceArcadeRunOnLoss(run);
  syncRunStateToProgress(profile, next);
  if (next.failed || (!next.completed && next.continuesRemaining <= 0)) {
    // will be finalized on abandon/no-continue decision paths as needed
  }
  return next;
}

export function continueCurrentArcadeRun(profile: PlayerProfile, run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  const next = continueArcadeRun(run);
  syncRunStateToProgress(profile, next);
  return next;
}

export function markArcadeRunFailed(profile: PlayerProfile, run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  if (!run.completed) {
    profile.statistics.arcadeRunsFailed += 1;
    profile.arcadeProgress.runsFailed += 1;
  }
  const next: ArcadeRunSnapshot = { ...run, failed: true, completed: run.completed };
  syncRunStateToProgress(profile, next);
  if (profile.arcadeProgress.currentRun) profile.arcadeProgress.currentRun.active = false;
  return next;
}

export function restartCurrentArcadeRun(profile: PlayerProfile, run: ArcadeRunSnapshot, seedBase?: number): ArcadeRunSnapshot {
  if (!run.completed) {
    profile.statistics.arcadeRunsFailed += 1;
    profile.arcadeProgress.runsFailed += 1;
  }
  const next = restartArcadeRun(run, seedBase);
  profile.statistics.arcadeRunsStarted += 1;
  profile.arcadeProgress.runsStarted += 1;
  syncRunStateToProgress(profile, next);
  return next;
}

export function abandonCurrentArcadeRun(profile: PlayerProfile, run: ArcadeRunSnapshot): ArcadeRunSnapshot {
  if (!run.completed) {
    profile.statistics.arcadeRunsFailed += 1;
    profile.arcadeProgress.runsFailed += 1;
  }
  const next: ArcadeRunSnapshot = { ...run, failed: !run.completed, completed: run.completed };
  syncRunStateToProgress(profile, next);
  if (profile.arcadeProgress.currentRun) {
    profile.arcadeProgress.currentRun.active = false;
    profile.arcadeProgress.currentRun.failed = next.failed;
  }
  return next;
}

export function clearArcadeRun(profile: PlayerProfile): void {
  profile.arcadeProgress.currentRun = null;
}

export function getRunFromProfile(profile: PlayerProfile): ArcadeRunSnapshot | null {
  const r = profile.arcadeProgress.currentRun;
  if (!r) return null;
  return runStateToSnapshot(r);
}

export function createArcadeStageMatchConfig(run: ArcadeRunSnapshot, stageIndex = run.currentStageIndex): MatchConfig | null {
  const stage = run.stages[stageIndex];
  if (!stage) return null;
  const seed = ((run.seedBase ?? 1337) + stageIndex * 101 + run.continuesUsed * 17 + run.losses * 31) >>> 0;
  return {
    mode: 'ARCADE',
    player1CharacterId: run.characterId,
    player2CharacterId: stage.opponentCharacterId,
    cpuEnabled: true,
    cpuPlayer: 2,
    cpuDifficulty: stage.difficulty,
    cpuPersonality: stage.personality,
    arenaId: stage.arenaId,
    roundTimerSeconds: stage.roundTimerSeconds,
    roundsToWin: stage.roundsToWin,
    allowDuplicateCharacters: true,
    seed,
  };
}

export function createArcadeStageToken(run: ArcadeRunSnapshot, stageIndex = run.currentStageIndex): string {
  return `${run.runId}:s${stageIndex}:c${run.continuesUsed}:w${run.wins}:l${run.losses}`;
}

export { getCurrentArcadeStage, canContinueArcadeRun };

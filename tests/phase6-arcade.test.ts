import { beforeEach, describe, expect, it } from 'vitest';

import { createDefaultProfile } from '../src/progression/PlayerProfileService';
import { clearProfileCache } from '../src/progression/ProgressionService';
import { getArcadeCampaign, getArcadeEnding, resolveArcadeStages } from '../src/arcade/ArcadeCampaignRegistry';
import { startArcadeRun, advanceArcadeRunOnWin, advanceArcadeRunOnLoss, continueArcadeRun, canContinueArcadeRun, getCurrentArcadeStage } from '../src/arcade/ArcadeRunManager';
import { beginArcadeRun, recordArcadeStageWin, runStateToSnapshot } from '../src/arcade/ArcadeProgressionService';

class MemoryStorage { private d = new Map<string,string>(); getItem(k:string){return this.d.has(k)?this.d.get(k)!:null} setItem(k:string,v:string){this.d.set(k,String(v))} removeItem(k:string){this.d.delete(k)} clear(){this.d.clear()} }

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
  clearProfileCache();
});

describe('Arcade campaign and run flow', () => {
  it('builds an 8-stage campaign from registered roster/arenas only', () => {
    const campaign = getArcadeCampaign('default');
    expect(campaign).toBeTruthy();
    expect(campaign!.stages.length).toBe(8);
    const stages = resolveArcadeStages(campaign!, 'kai', 'NORMAL', 1234);
    expect(stages.length).toBe(8);
    for (const s of stages) {
      expect(['kai', 'rhea']).toContain(s.opponentCharacterId);
      expect(s.arenaId.length).toBeGreaterThan(0);
      expect(s.roundsToWin).toBe(2);
      expect(s.roundTimerSeconds).toBe(99);
    }
    expect(stages[7]!.boss).toBe(true);
  });

  it('scales difficulty and supports continues/retry semantics in run manager', () => {
    let run = startArcadeRun('kai', 'HARD', 'default', 1);
    expect(run.stages.length).toBe(8);
    expect(run.continuesRemaining).toBe(2);
    expect(getCurrentArcadeStage(run)?.index).toBe(0);
    run = advanceArcadeRunOnLoss(run);
    expect(canContinueArcadeRun(run)).toBe(true);
    run = continueArcadeRun(run);
    expect(run.continuesUsed).toBe(1);
    expect(run.continuesRemaining).toBe(1);
    for (let i = 0; i < 8; i++) run = advanceArcadeRunOnWin(run);
    expect(run.completed).toBe(true);
    expect(run.currentStageIndex).toBe(7);
  });

  it('persists arcade run state in player profile and marks completion', () => {
    const profile = createDefaultProfile();
    let run = beginArcadeRun(profile, 'kai', 'NORMAL', 'default', 42);
    expect(profile.arcadeProgress.currentRun?.active).toBe(true);
    for (let i = 0; i < 8; i++) {
      run = recordArcadeStageWin(profile, run);
      if (i < 7) expect(run.completed).toBe(false);
    }
    expect(run.completed).toBe(true);
    expect(profile.arcadeProgress.runsCompleted).toBeGreaterThan(0);
    expect(profile.arcadeProgress.endingsUnlocked['kai']).toBe(true);
    const restored = runStateToSnapshot(profile.arcadeProgress.currentRun!);
    expect(restored?.runId).toBe(run.runId);
    expect(restored?.completed).toBe(true);
  });

  it('provides character endings for registered fighters and fallback', () => {
    expect(getArcadeEnding('kai').title).toContain('KAI');
    expect(getArcadeEnding('rhea').title).toContain('RHEA');
    expect(getArcadeEnding('unknown').characterId).toBe('unknown');
  });
});

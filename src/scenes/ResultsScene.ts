import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import type { ArcadeRunSnapshot } from '../arcade/ArcadeConfig';
import { SCENE_KEYS } from '../core/GameConfig';
import type { ResultsSceneData, ResultsAction } from '../ui/ResultsScreen';
import { ResultsScreen } from '../ui/ResultsScreen';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { getGameLoop } from '../core/GameLoop';
import { getOrLoadProfile, persistProfile } from '../progression/ProgressionService';
import {
  abandonCurrentArcadeRun,
  canContinueArcadeRun,
  continueCurrentArcadeRun,
  createArcadeStageMatchConfig,
  createArcadeStageToken,
  markArcadeRunFailed,
  restartCurrentArcadeRun,
} from '../arcade/ArcadeProgressionService';
import { ProgressionToast } from '../ui/ProgressionToast';

export class ResultsScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private resultsScreen?: ResultsScreen;
  private resultsData!: ResultsSceneData;
  private transitioning = false;
  private toast?: ProgressionToast;

  constructor() {
    super({ key: SCENE_KEYS.RESULTS });
  }

  init(data: ResultsSceneData): void {
    this.resultsData = data;
  }

  create(): void {
    this.transitioning = false;
    this.cameras.main.fadeIn(240, 3, 2, 6);
    this.backdrop = new MenuBackdrop(this);
    this.toast = new ProgressionToast(this);
    this.toast.pumpFromQueue(this.time.now);

    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(getOrLoadProfile().settings);
    // Result/arcade completion cues are safe no-ops when assets/keys are unavailable.
    if (this.resultsData.arcade?.run.completed) {
      audio?.playSfx('sfx-arcade-complete', { volume: 0.8 });
    } else if (this.resultsData.isDraw) {
      audio?.playSfx('sfx-draw', { volume: 0.7 });
    } else if (this.resultsData.winnerPlayer === 1) {
      audio?.playSfx('sfx-victory', { volume: 0.75 });
    } else {
      audio?.playSfx('sfx-defeat', { volume: 0.7 });
    }

    this.resultsScreen = new ResultsScreen(this);

    const actions = this.buildActions();
    const extraLines = this.buildExtraLines();

    this.resultsScreen.show({
      winnerName: this.resultsData.winnerName,
      winnerPlayer: this.resultsData.winnerPlayer,
      winnerColor:
        this.resultsData.winnerPlayer === 1
          ? this.resultsData.p1Color
          : this.resultsData.winnerPlayer === 2
            ? this.resultsData.p2Color
            : 0xf3e9ef,
      isDraw: this.resultsData.isDraw,
      stats: this.resultsData.stats,
      p1Name: this.resultsData.p1Name,
      p2Name: this.resultsData.p2Name,
      roundsWon: this.resultsData.roundsWon,
      actions,
      extraLines,
    });

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => {
      this.backdrop?.update(loop.simulationTimeSeconds);
      this.toast?.update(this.time.now);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private buildExtraLines(): string[] {
    const arcade = this.resultsData.arcade;
    if (!arcade) return [];
    const run = arcade.run;
    const lines: string[] = [];
    lines.push(`ARCADE ${run.difficulty}  •  STAGE ${Math.min(run.currentStageIndex + 1, run.stages.length)}/${run.stages.length}`);
    lines.push(`RUN WINS ${run.wins}  •  CONTINUES LEFT ${run.continuesRemaining}`);
    if (run.completed) lines.push('ARCADE COMPLETE! Ending unlocked for this character.');
    else if (!this.resultsData.isDraw && this.resultsData.winnerPlayer !== 1) lines.push('Stage lost. Choose continue, restart, or abandon.');
    else if (this.resultsData.winnerPlayer === 1) lines.push(run.completed ? 'Campaign conquered.' : 'Stage cleared. Advance to the next fight.');
    return lines;
  }

  private buildActions(): ResultsAction[] {
    if (!this.resultsData.arcade || this.resultsData.config.mode !== 'ARCADE') {
      return [
        { label: 'REMATCH', onClick: () => this.go(SCENE_KEYS.BATTLE, { matchConfig: this.resultsData.config, matchToken: this.newMatchToken() }) },
        { label: 'CHANGE FIGHTER', onClick: () => this.go(SCENE_KEYS.CHARACTER_SELECT, { config: this.resultsData.config, selecting: 1 }) },
        { label: 'CHANGE ARENA', onClick: () => this.go(SCENE_KEYS.ARENA_SELECT, { config: this.resultsData.config }) },
        { label: 'MAIN MENU', onClick: () => this.go(SCENE_KEYS.MENU) },
      ];
    }

    const arcade = this.resultsData.arcade;
    const run = arcade.run;
    const playerWon = !this.resultsData.isDraw && this.resultsData.winnerPlayer === 1;

    if (run.completed) {
      return [
        { label: 'VIEW ENDING', onClick: () => this.go(SCENE_KEYS.ARCADE_ENDING, { characterId: run.characterId, run }) },
        { label: 'PROGRESS', onClick: () => this.go(SCENE_KEYS.ARCADE_PROGRESS, { run }) },
        { label: 'ARCADE MENU', onClick: () => this.go(SCENE_KEYS.ARCADE) },
        { label: 'MAIN MENU', onClick: () => this.go(SCENE_KEYS.MENU) },
      ];
    }

    if (playerWon) {
      return [
        { label: 'NEXT STAGE', onClick: () => this.nextStage(run) },
        { label: 'PROGRESS', onClick: () => this.go(SCENE_KEYS.ARCADE_PROGRESS, { run }) },
        { label: 'ABANDON', onClick: () => this.abandon(run) },
        { label: 'MAIN MENU', onClick: () => this.go(SCENE_KEYS.MENU) },
      ];
    }

    // loss or draw treated as failed attempt for stage advancement
    if (canContinueArcadeRun(run)) {
      return [
        { label: 'CONTINUE', onClick: () => this.continueRun(run) },
        { label: 'RESTART RUN', onClick: () => this.restartRun(run) },
        { label: 'ABANDON', onClick: () => this.abandon(run) },
        { label: 'MAIN MENU', onClick: () => this.go(SCENE_KEYS.MENU) },
      ];
    }

    return [
      { label: 'RESTART RUN', onClick: () => this.restartRun(run, true) },
      { label: 'ABANDON', onClick: () => this.abandon(run, true) },
      { label: 'ARCADE MENU', onClick: () => this.go(SCENE_KEYS.ARCADE) },
      { label: 'MAIN MENU', onClick: () => this.go(SCENE_KEYS.MENU) },
    ];
  }

  private newMatchToken(): string {
    return `rematch:${Date.now()}:${Math.floor(Math.random() * 1e9)}`;
  }

  private nextStage(run: ArcadeRunSnapshot): void {
    const profile = getOrLoadProfile();
    // run already advanced in profile/BattleScene; ensure persisted
    persistProfile(profile);
    const stageIndex = run.currentStageIndex;
    const cfg = createArcadeStageMatchConfig(run, stageIndex);
    if (!cfg) { this.go(SCENE_KEYS.ARCADE); return; }
    this.go(SCENE_KEYS.VERSUS, {
      config: cfg,
      arcade: { run, stageIndex },
      matchToken: createArcadeStageToken(run, stageIndex),
    });
  }

  private continueRun(run: ArcadeRunSnapshot): void {
    const profile = getOrLoadProfile();
    const next = continueCurrentArcadeRun(profile, run);
    persistProfile(profile);
    const stageIndex = next.currentStageIndex;
    const cfg = createArcadeStageMatchConfig(next, stageIndex);
    if (!cfg) { this.go(SCENE_KEYS.ARCADE); return; }
    this.go(SCENE_KEYS.VERSUS, {
      config: cfg,
      arcade: { run: next, stageIndex },
      matchToken: createArcadeStageToken(next, stageIndex),
    });
  }

  private restartRun(run: ArcadeRunSnapshot, markFailedFirst = false): void {
    const profile = getOrLoadProfile();
    if (markFailedFirst && !run.completed) {
      // no continues left path: count failed before restart
      markArcadeRunFailed(profile, run);
    }
    const next = restartCurrentArcadeRun(profile, run);
    persistProfile(profile);
    const cfg = createArcadeStageMatchConfig(next, 0);
    if (!cfg) { this.go(SCENE_KEYS.ARCADE); return; }
    this.go(SCENE_KEYS.VERSUS, {
      config: cfg,
      arcade: { run: next, stageIndex: 0 },
      matchToken: createArcadeStageToken(next, 0),
    });
  }

  private abandon(run: ArcadeRunSnapshot, markFailed = false): void {
    const profile = getOrLoadProfile();
    if (markFailed && !run.completed) {
      markArcadeRunFailed(profile, run);
    } else {
      abandonCurrentArcadeRun(profile, run);
    }
    persistProfile(profile);
    this.go(SCENE_KEYS.ARCADE);
  }

  private go(key: string, data?: object): void {
    if (this.transitioning) return;
    this.transitioning = true;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.cameras.main.fadeOut(220, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  private shutdown(): void {
    this.unsubscribeLoop?.(); this.unsubscribeLoop = null;
    this.input.keyboard?.removeAllListeners();
    this.input.removeAllListeners('pointerdown');
    this.resultsScreen?.destroy(); this.resultsScreen = undefined;
    this.backdrop = undefined;
    this.toast?.destroy(); this.toast = undefined;
  }
}

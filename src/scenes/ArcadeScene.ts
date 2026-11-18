import Phaser from 'phaser';

import type { AIDifficulty } from '../ai/AITypes';
import { getAudioManager } from '../audio/AudioManager';
import { getDefaultArcadeCampaign, getArcadeEnding, resolveArcadeStages } from '../arcade/ArcadeCampaignRegistry';
import { beginArcadeRun, createArcadeStageMatchConfig, createArcadeStageToken, getRunFromProfile } from '../arcade/ArcadeProgressionService';
import { isArcadeRunFinished } from '../arcade/ArcadeRunManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getCharacterById, getCharacterRegistry } from '../data/CharacterRegistry';
import { getArenaById } from '../data/ArenaRegistry';
import { getOrLoadProfile, persistProfile } from '../progression/ProgressionService';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ProgressionToast } from '../ui/ProgressionToast';
import { CSS_COLORS, FONTS, toCssColor } from '../ui/Theme';

const DIFFICULTIES: readonly AIDifficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];

export class ArcadeScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private buttons: MenuButton[] = [];
  private selectedIndex = 0;
  private characterIndex = 0;
  private difficultyIndex = 1;
  private toast?: ProgressionToast;

  private charText!: Phaser.GameObjects.Text;
  private diffText!: Phaser.GameObjects.Text;
  private previewText!: Phaser.GameObjects.Text;
  private resumeText!: Phaser.GameObjects.Text;
  private endingText!: Phaser.GameObjects.Text;
  private previewBox!: Phaser.GameObjects.Graphics;

  constructor() { super({ key: SCENE_KEYS.ARCADE }); }

  create(): void {
    this.starting = false;
    this.selectedIndex = 0;
    this.cameras.main.fadeIn(220, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    this.toast = new ProgressionToast(this);
    const profile = getOrLoadProfile();
    this.toast.pumpFromQueue(this.time.now);
    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(profile.settings);
    const unlock = () => audio?.unlock();
    this.input.once('pointerdown', unlock);
    this.input.keyboard?.once('keydown', unlock);

    const roster = getCharacterRegistry();
    const preferred = profile.arcadeProgress.currentRun?.characterId ?? roster[0]?.id;
    const idx = roster.findIndex((c) => c.id === preferred);
    this.characterIndex = idx >= 0 ? idx : 0;
    const curDiff = profile.arcadeProgress.currentRun?.difficulty as AIDifficulty | null | undefined;
    const dIdx = curDiff ? DIFFICULTIES.indexOf(curDiff) : 1;
    this.difficultyIndex = dIdx >= 0 ? dIdx : 1;

    this.add.text(640, 72, 'ARCADE MODE', {
      fontFamily: FONTS.display, fontSize: '52px', color: CSS_COLORS.bone, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(640, 118, 'Conquer the Riftbound gauntlet. Choose your fighter and difficulty.', {
      fontFamily: FONTS.body, fontSize: '16px', color: CSS_COLORS.muted,
    }).setOrigin(0.5);

    this.previewBox = this.add.graphics();
    this.charText = this.add.text(270, 170, '', { fontFamily: FONTS.display, fontSize: '34px', color: CSS_COLORS.bone }).setOrigin(0.5);
    this.diffText = this.add.text(270, 250, '', { fontFamily: FONTS.display, fontSize: '26px', color: CSS_COLORS.violet }).setOrigin(0.5);
    this.resumeText = this.add.text(270, 330, '', { fontFamily: FONTS.mono, fontSize: '12px', color: CSS_COLORS.muted, align: 'center', wordWrap: { width: 420 } }).setOrigin(0.5);
    this.endingText = this.add.text(270, 430, '', { fontFamily: FONTS.body, fontSize: '14px', color: CSS_COLORS.muted, align: 'center', wordWrap: { width: 420 }, lineSpacing: 4 }).setOrigin(0.5);
    this.previewText = this.add.text(860, 175, '', { fontFamily: FONTS.mono, fontSize: '13px', color: CSS_COLORS.bone, lineSpacing: 8 }).setOrigin(0.5, 0);

    this.add.text(270, 145, 'FIGHTER  (LEFT/RIGHT)', { fontFamily: FONTS.mono, fontSize: '10px', color: CSS_COLORS.muted }).setOrigin(0.5);
    this.add.text(270, 225, 'DIFFICULTY  (A/D)', { fontFamily: FONTS.mono, fontSize: '10px', color: CSS_COLORS.muted }).setOrigin(0.5);
    this.add.text(860, 145, 'CAMPAIGN PREVIEW', { fontFamily: FONTS.mono, fontSize: '10px', color: CSS_COLORS.muted }).setOrigin(0.5);

    this.buildButtons();
    this.refresh();
    this.bindInput();

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => {
      this.backdrop?.update(loop.simulationTimeSeconds);
      this.toast?.update(this.time.now);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private buildButtons(): void {
    const defs = [
      { label: 'START NEW RUN', y: 520, cb: () => this.startNewRun() },
      { label: 'RESUME RUN', y: 575, cb: () => this.resumeRun() },
      { label: 'VIEW PROGRESS', y: 630, cb: () => this.go(SCENE_KEYS.ARCADE_PROGRESS, { run: getRunFromProfile(getOrLoadProfile()) ?? undefined }) },
      { label: 'BACK', y: 685, cb: () => this.go(SCENE_KEYS.MENU) },
    ];
    this.buttons = defs.map((d) => new MenuButton(this, { x: 270, y: d.y, width: 340, height: 46, label: d.label, onClick: d.cb }));
    this.updateSelectionVisuals();
  }

  private selectedCharacterId(): string {
    const roster = getCharacterRegistry();
    return (roster[this.characterIndex] ?? roster[0])!.id;
  }

  private selectedDifficulty(): AIDifficulty {
    return DIFFICULTIES[this.difficultyIndex] ?? 'NORMAL';
  }

  private refresh(): void {
    const profile = getOrLoadProfile();
    const charId = this.selectedCharacterId();
    const char = getCharacterById(charId);
    const diff = this.selectedDifficulty();
    const campaign = getDefaultArcadeCampaign();

    this.charText.setText(char?.displayName ?? charId).setColor(char ? toCssColor(char.fighterConfig.color) : CSS_COLORS.bone);
    this.diffText.setText(`${diff}  •  ${campaign.continuesByDifficulty[diff] ?? 0} CONTINUES`);

    const stages = resolveArcadeStages(campaign, charId, diff, 1337);
    const lines = stages.map((s, i) => {
      const opp = getCharacterById(s.opponentCharacterId)?.displayName ?? s.opponentCharacterId;
      const arena = getArenaById(s.arenaId)?.name ?? s.arenaId;
      const boss = s.boss ? ' [BOSS]' : '';
      return `${i + 1}. ${s.label}${boss}\n   vs ${opp}  •  ${arena}  •  ${s.difficulty}`;
    });
    this.previewText.setText(lines.join('\n'));

    const ending = getArcadeEnding(charId);
    const endingUnlocked = profile.arcadeProgress.endingsUnlocked[charId] === true;
    this.endingText.setText(`${ending.title}\n${endingUnlocked ? 'Ending unlocked.' : 'Complete arcade with this fighter to unlock their ending.'}`);

    const run = getRunFromProfile(profile);
    if (run && !isArcadeRunFinished(run)) {
      const cur = run.stages[run.currentStageIndex];
      const curOpp = cur ? (getCharacterById(cur.opponentCharacterId)?.displayName ?? cur.opponentCharacterId) : '?';
      this.resumeText.setText(`RESUME AVAILABLE\n${getCharacterById(run.characterId)?.displayName ?? run.characterId}  •  ${run.difficulty}\nStage ${run.currentStageIndex + 1}/${run.stages.length} vs ${curOpp}\nContinues: ${run.continuesRemaining}`);
      this.buttons[1]?.setAlpha(1);
    } else if (run && run.completed) {
      this.resumeText.setText(`Last run completed with ${getCharacterById(run.characterId)?.displayName ?? run.characterId}.\nStart a new run to challenge again.`);
      this.buttons[1]?.setAlpha(0.45);
    } else {
      this.resumeText.setText('No active arcade run.\nStart a new run to begin the campaign.');
      this.buttons[1]?.setAlpha(0.45);
    }

    this.previewBox.clear();
    this.previewBox.fillStyle(0x120a18, 0.82);
    this.previewBox.fillRoundedRect(50, 135, 440, 390, 12);
    this.previewBox.lineStyle(2, 0x4a2a45, 0.9);
    this.previewBox.strokeRoundedRect(50, 135, 440, 390, 12);
    this.previewBox.fillStyle(0x120a18, 0.82);
    this.previewBox.fillRoundedRect(560, 135, 660, 560, 12);
    this.previewBox.lineStyle(2, 0x4a2a45, 0.9);
    this.previewBox.strokeRoundedRect(560, 135, 660, 560, 12);

    this.updateSelectionVisuals();
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown-LEFT', this.prevChar, this);
    this.input.keyboard?.on('keydown-RIGHT', this.nextChar, this);
    this.input.keyboard?.on('keydown-A', this.prevDiff, this);
    this.input.keyboard?.on('keydown-D', this.nextDiff, this);
    this.input.keyboard?.on('keydown-UP', this.up, this);
    this.input.keyboard?.on('keydown-DOWN', this.down, this);
    this.input.keyboard?.on('keydown-W', this.up, this);
    this.input.keyboard?.on('keydown-S', this.down, this);
    this.input.keyboard?.on('keydown-ENTER', this.confirm, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirm, this);
    this.input.keyboard?.on('keydown-ESC', () => this.go(SCENE_KEYS.MENU), this);
  }

  private prevChar(): void { const n = getCharacterRegistry().length; this.characterIndex = (this.characterIndex - 1 + n) % n; this.refresh(); getAudioManager(this.game)?.playUi('ui-move'); }
  private nextChar(): void { const n = getCharacterRegistry().length; this.characterIndex = (this.characterIndex + 1) % n; this.refresh(); getAudioManager(this.game)?.playUi('ui-move'); }
  private prevDiff(): void { this.difficultyIndex = (this.difficultyIndex - 1 + DIFFICULTIES.length) % DIFFICULTIES.length; this.refresh(); getAudioManager(this.game)?.playUi('ui-move'); }
  private nextDiff(): void { this.difficultyIndex = (this.difficultyIndex + 1) % DIFFICULTIES.length; this.refresh(); getAudioManager(this.game)?.playUi('ui-move'); }
  private up(): void { if (!this.starting) { this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length; this.updateSelectionVisuals(); getAudioManager(this.game)?.playUi('ui-move'); } }
  private down(): void { if (!this.starting) { this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length; this.updateSelectionVisuals(); getAudioManager(this.game)?.playUi('ui-move'); } }
  private confirm(): void {
    if (this.starting) return;
    if (this.selectedIndex === 0) this.startNewRun();
    else if (this.selectedIndex === 1) this.resumeRun();
    else if (this.selectedIndex === 2) this.go(SCENE_KEYS.ARCADE_PROGRESS, { run: getRunFromProfile(getOrLoadProfile()) ?? undefined });
    else this.go(SCENE_KEYS.MENU);
  }

  private startNewRun(): void {
    if (this.starting) return;
    const profile = getOrLoadProfile();
    const characterId = this.selectedCharacterId();
    const difficulty = this.selectedDifficulty();
    const run = beginArcadeRun(profile, characterId, difficulty);
    persistProfile(profile);
    this.launchStage(run, 0);
  }

  private resumeRun(): void {
    if (this.starting) return;
    const profile = getOrLoadProfile();
    const run = getRunFromProfile(profile);
    if (!run || isArcadeRunFinished(run)) {
      this.refresh();
      return;
    }
    const stageIndex = Math.max(0, Math.min(run.currentStageIndex, run.stages.length - 1));
    this.launchStage(run, stageIndex);
  }

  private launchStage(run: ReturnType<typeof beginArcadeRun>, stageIndex: number): void {
    const cfg = createArcadeStageMatchConfig(run, stageIndex);
    if (!cfg) return;
    this.go(SCENE_KEYS.VERSUS, {
      config: cfg,
      arcade: { run, stageIndex },
      matchToken: createArcadeStageToken(run, stageIndex),
    });
  }

  private updateSelectionVisuals(): void {
    this.buttons.forEach((b, i) => {
      b.setAlpha(i === this.selectedIndex ? 1 : 0.72);
      b.setScale(i === this.selectedIndex ? 1.03 : 1);
    });
  }

  private go(key: string, data?: object): void {
    if (this.starting) return;
    this.starting = true;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.cameras.main.fadeOut(220, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  private shutdown(): void {
    this.unsubscribeLoop?.(); this.unsubscribeLoop = null;
    this.input.keyboard?.removeAllListeners();
    this.input.removeAllListeners('pointerdown');
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.toast?.destroy(); this.toast = undefined;
    this.backdrop = undefined;
  }
}

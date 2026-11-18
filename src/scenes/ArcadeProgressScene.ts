import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import type { ArcadeRunSnapshot } from '../arcade/ArcadeConfig';
import { getRunFromProfile } from '../arcade/ArcadeProgressionService';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getArenaById } from '../data/ArenaRegistry';
import { getCharacterById } from '../data/CharacterRegistry';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ProgressionToast } from '../ui/ProgressionToast';
import { CSS_COLORS, FONTS } from '../ui/Theme';

interface SceneData { readonly run?: ArcadeRunSnapshot }

export class ArcadeProgressScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private run: ArcadeRunSnapshot | null = null;
  private toast?: ProgressionToast;
  private backButton?: MenuButton;

  constructor() { super({ key: SCENE_KEYS.ARCADE_PROGRESS }); }

  init(data?: SceneData): void { this.run = data?.run ?? null; }

  create(): void {
    this.starting = false;
    this.cameras.main.fadeIn(220, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    this.toast = new ProgressionToast(this);
    const profile = getOrLoadProfile();
    this.toast.pumpFromQueue(this.time.now);
    if (!this.run) this.run = getRunFromProfile(profile);
    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(profile.settings);

    this.add.text(640, 70, 'ARCADE PROGRESS', { fontFamily: FONTS.display, fontSize: '46px', color: CSS_COLORS.bone }).setOrigin(0.5);

    if (!this.run) {
      this.add.text(640, 300, 'No arcade run data yet.\nStart an arcade run to see campaign progression.', {
        fontFamily: FONTS.body, fontSize: '22px', color: CSS_COLORS.muted, align: 'center', lineSpacing: 8,
      }).setOrigin(0.5);
    } else {
      this.renderRun(profile);
    }

    this.renderCompletions(profile.arcadeProgress.completions, profile.arcadeProgress.endingsUnlocked);

    this.backButton = new MenuButton(this, { x: 640, y: 670, width: 320, height: 48, label: 'BACK', onClick: () => this.back() });
    this.input.keyboard?.once('keydown-ESC', () => this.back());
    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => {
      this.backdrop?.update(loop.simulationTimeSeconds);
      this.toast?.update(this.time.now);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private shutdown(): void {
    this.unsubscribeLoop?.();
    this.unsubscribeLoop = null;
    this.input.keyboard?.removeAllListeners();
    this.backButton?.destroy();
    this.backButton = undefined;
    this.toast?.destroy();
    this.toast = undefined;
    this.backdrop = undefined;
  }

  private renderRun(profile: ReturnType<typeof getOrLoadProfile>): void {
    const run = this.run!;
    const fighter = getCharacterById(run.characterId)?.displayName ?? run.characterId;
    const status = run.completed ? 'COMPLETED' : run.failed && run.continuesRemaining <= 0 ? 'FAILED' : 'IN PROGRESS';
    this.add.text(640, 120, `${fighter}  •  ${run.difficulty}  •  ${status}`, {
      fontFamily: FONTS.mono, fontSize: '14px', color: CSS_COLORS.violet,
    }).setOrigin(0.5);

    const startY = 165;
    const colX = [180, 760];
    run.stages.forEach((s, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i < 4 ? i : i - 4;
      const x = colX[col]!;
      const y = startY + row * 82;
      const result = run.stageResults[i];
      const isCurrent = !run.completed && !run.failed ? i === run.currentStageIndex : false;
      const marker = result === true ? '[CLEARED]' : result === false ? '[FAILED]' : isCurrent ? '[CURRENT]' : '[PENDING]';
      const color = result === true ? '#7dffb0' : result === false ? '#ff7d9e' : isCurrent ? '#ffd36e' : CSS_COLORS.muted;
      const opp = getCharacterById(s.opponentCharacterId)?.displayName ?? s.opponentCharacterId;
      const arena = getArenaById(s.arenaId)?.name ?? s.arenaId;
      this.add.text(x, y, `${i + 1}. ${s.label}${s.boss ? ' (BOSS)' : ''}  ${marker}`, {
        fontFamily: FONTS.mono, fontSize: '13px', color,
      }).setOrigin(0, 0.5);
      this.add.text(x + 18, y + 18, `vs ${opp}  •  ${arena}  •  ${s.difficulty}`, {
        fontFamily: FONTS.body, fontSize: '12px', color: CSS_COLORS.muted,
      }).setOrigin(0, 0.5);
    });

    this.add.text(640, 515, `Wins: ${run.wins}   Losses: ${run.losses}   Continues Used: ${run.continuesUsed}   Continues Left: ${run.continuesRemaining}`,
      { fontFamily: FONTS.mono, fontSize: '12px', color: CSS_COLORS.bone }).setOrigin(0.5);

    const endings = profile.arcadeProgress.endingsUnlocked;
    const char = getCharacterById(run.characterId)?.displayName ?? run.characterId;
    this.add.text(640, 545, `Ending for ${char}: ${endings[run.characterId] ? 'UNLOCKED' : 'LOCKED'}`, {
      fontFamily: FONTS.mono, fontSize: '12px', color: endings[run.characterId] ? '#7dffb0' : CSS_COLORS.muted,
    }).setOrigin(0.5);
  }

  private renderCompletions(completions: Record<string, boolean>, endings: Record<string, boolean>): void {
    const keys = Object.keys(completions).filter((k) => completions[k]);
    const endingKeys = Object.keys(endings).filter((k) => endings[k]);
    const summary = keys.length > 0 ? `Completions: ${keys.length}` : 'Completions: none yet';
    const endingSummary = endingKeys.length > 0 ? `Endings unlocked: ${endingKeys.map((id) => getCharacterById(id)?.displayName ?? id).join(', ')}` : 'Endings unlocked: none';
    this.add.text(640, 585, `${summary}  •  ${endingSummary}`, {
      fontFamily: FONTS.mono, fontSize: '11px', color: CSS_COLORS.muted, align: 'center', wordWrap: { width: 1100 },
    }).setOrigin(0.5);
  }

  private back(): void { if (this.starting) return; this.starting = true; getAudioManager(this.game)?.playUi('ui-confirm'); this.cameras.main.fadeOut(220,3,2,6); this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENE_KEYS.ARCADE)); }
}

import Phaser from 'phaser';

import type { AIDifficulty, AIPersonality } from '../ai/AITypes';
import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { createDefaultMatchConfig, type MatchConfig } from '../data/MatchConfig';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { CSS_COLORS, FONTS } from '../ui/Theme';

const DIFFICULTIES: readonly AIDifficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];
const PERSONALITIES: readonly AIPersonality[] = ['AGGRESSOR', 'DEFENDER', 'TRICKSTER', 'BRUISER'];

interface SceneData {
  readonly config?: Partial<MatchConfig> | MatchConfig;
}

export class CpuConfigScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private config: MatchConfig = createDefaultMatchConfig('CPU_BATTLE');
  private difficultyIndex = 1;
  private personalityIndex = 0;
  private diffText!: Phaser.GameObjects.Text;
  private persText!: Phaser.GameObjects.Text;
  private buttons: MenuButton[] = [];
  private selectedIndex = 0;

  constructor() {
    super({ key: SCENE_KEYS.CPU_CONFIG });
  }

  init(data?: SceneData): void {
    this.config = { ...createDefaultMatchConfig('CPU_BATTLE'), ...(data?.config ?? {}), mode: 'CPU_BATTLE', cpuEnabled: true, cpuPlayer: 2 };
    this.difficultyIndex = Math.max(0, DIFFICULTIES.indexOf(this.config.cpuDifficulty));
    this.personalityIndex = Math.max(0, PERSONALITIES.indexOf(this.config.cpuPersonality));
  }

  create(): void {
    this.starting = false;
    this.selectedIndex = 0;
    this.cameras.main.fadeIn(220, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    getAudioManager(this.game)?.attach(this.sound);

    this.add.text(640, 110, 'CPU BATTLE SETUP', {
      fontFamily: FONTS.display, fontSize: '50px', color: CSS_COLORS.bone, stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(640, 185, 'Configure your opponent, then choose fighters and arena.', {
      fontFamily: FONTS.body, fontSize: '18px', color: CSS_COLORS.muted,
    }).setOrigin(0.5);

    this.diffText = this.add.text(640, 290, '', { fontFamily: FONTS.display, fontSize: '34px', color: CSS_COLORS.bone }).setOrigin(0.5);
    this.persText = this.add.text(640, 390, '', { fontFamily: FONTS.display, fontSize: '30px', color: CSS_COLORS.violet }).setOrigin(0.5);

    this.add.text(640, 250, 'DIFFICULTY  (LEFT/RIGHT)', { fontFamily: FONTS.mono, fontSize: '11px', color: CSS_COLORS.muted }).setOrigin(0.5).setLetterSpacing(2);
    this.add.text(640, 350, 'PERSONALITY  (A/D)', { fontFamily: FONTS.mono, fontSize: '11px', color: CSS_COLORS.muted }).setOrigin(0.5).setLetterSpacing(2);

    this.buttons = [
      new MenuButton(this, { x: 640, y: 500, width: 360, height: 52, label: 'CONTINUE', onClick: () => this.continueFlow() }),
      new MenuButton(this, { x: 640, y: 570, width: 360, height: 52, label: 'BACK', onClick: () => this.back() }),
    ];

    this.add.text(640, 660, 'LEFT/RIGHT DIFFICULTY  •  A/D PERSONALITY  •  ENTER CONTINUE  •  ESC BACK', {
      fontFamily: FONTS.mono, fontSize: '10px', color: CSS_COLORS.muted,
    }).setOrigin(0.5).setAlpha(0.7);

    this.refreshLabels();
    this.updateSelectionVisuals();
    this.bindInput();

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => this.backdrop?.update(loop.simulationTimeSeconds));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private refreshLabels(): void {
    this.diffText.setText(DIFFICULTIES[this.difficultyIndex] ?? 'NORMAL');
    this.persText.setText(PERSONALITIES[this.personalityIndex] ?? 'AGGRESSOR');
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown-LEFT', this.prevDiff, this);
    this.input.keyboard?.on('keydown-RIGHT', this.nextDiff, this);
    this.input.keyboard?.on('keydown-A', this.prevPers, this);
    this.input.keyboard?.on('keydown-D', this.nextPers, this);
    this.input.keyboard?.on('keydown-UP', this.up, this);
    this.input.keyboard?.on('keydown-DOWN', this.down, this);
    this.input.keyboard?.on('keydown-W', this.up, this);
    this.input.keyboard?.on('keydown-S', this.down, this);
    this.input.keyboard?.on('keydown-ENTER', this.confirm, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirm, this);
    this.input.keyboard?.on('keydown-ESC', this.back, this);
  }

  private prevDiff(): void { this.difficultyIndex = (this.difficultyIndex - 1 + DIFFICULTIES.length) % DIFFICULTIES.length; this.refreshLabels(); getAudioManager(this.game)?.playUi('ui-move'); }
  private nextDiff(): void { this.difficultyIndex = (this.difficultyIndex + 1) % DIFFICULTIES.length; this.refreshLabels(); getAudioManager(this.game)?.playUi('ui-move'); }
  private prevPers(): void { this.personalityIndex = (this.personalityIndex - 1 + PERSONALITIES.length) % PERSONALITIES.length; this.refreshLabels(); getAudioManager(this.game)?.playUi('ui-move'); }
  private nextPers(): void { this.personalityIndex = (this.personalityIndex + 1) % PERSONALITIES.length; this.refreshLabels(); getAudioManager(this.game)?.playUi('ui-move'); }
  private up(): void { this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length; this.updateSelectionVisuals(); getAudioManager(this.game)?.playUi('ui-move'); }
  private down(): void { this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length; this.updateSelectionVisuals(); getAudioManager(this.game)?.playUi('ui-move'); }
  private confirm(): void { if (this.selectedIndex === 0) this.continueFlow(); else this.back(); }

  private continueFlow(): void {
    if (this.starting) return;
    const config: MatchConfig = {
      ...this.config,
      cpuEnabled: true,
      cpuPlayer: 2,
      cpuDifficulty: DIFFICULTIES[this.difficultyIndex] ?? 'NORMAL',
      cpuPersonality: PERSONALITIES[this.personalityIndex] ?? 'AGGRESSOR',
    };
    this.start(SCENE_KEYS.CHARACTER_SELECT, { config, selecting: 1 });
  }

  private back(): void { this.start(SCENE_KEYS.MODE_SELECT, { config: this.config }); }

  private updateSelectionVisuals(): void {
    this.buttons.forEach((b, i) => { b.setAlpha(i === this.selectedIndex ? 1 : 0.72); b.setScale(i === this.selectedIndex ? 1.03 : 1); });
  }

  private start(key: string, data?: object): void {
    if (this.starting) return;
    this.starting = true;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.cameras.main.fadeOut(220, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  private shutdown(): void {
    this.unsubscribeLoop?.(); this.unsubscribeLoop = null;
    this.input.keyboard?.removeAllListeners();
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.backdrop = undefined;
  }
}

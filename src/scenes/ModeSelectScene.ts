import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { createDefaultMatchConfig, type MatchConfig, type MatchMode } from '../data/MatchConfig';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { CSS_COLORS, FONTS } from '../ui/Theme';

interface SceneData {
  readonly config?: Partial<MatchConfig> | MatchConfig;
  readonly presetMode?: MatchMode;
}

export class ModeSelectScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private buttons: MenuButton[] = [];
  private unsubscribeLoop: (() => void) | null = null;
  private selectedIndex = 0;
  private starting = false;
  private baseConfig: MatchConfig = createDefaultMatchConfig('LOCAL_VERSUS');

  constructor() {
    super({ key: SCENE_KEYS.MODE_SELECT });
  }

  init(data?: SceneData): void {
    const preset = data?.presetMode ?? data?.config?.mode ?? 'LOCAL_VERSUS';
    this.baseConfig = createDefaultMatchConfig(preset);
    if (data?.config) {
      this.baseConfig = { ...this.baseConfig, ...data.config, mode: preset } as MatchConfig;
    }
  }

  create(): void {
    this.starting = false;
    this.selectedIndex = 0;
    this.cameras.main.fadeIn(260, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    getAudioManager(this.game)?.attach(this.sound);

    this.add.text(640, 120, 'SELECT MODE', {
      fontFamily: FONTS.display,
      fontSize: '58px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 7,
    }).setOrigin(0.5);

    const options: Array<{ label: string; mode: MatchMode; desc: string }> = [
      { label: 'LOCAL VERSUS', mode: 'LOCAL_VERSUS', desc: 'Two players on one keyboard. Fight for rounds and glory.' },
      { label: 'CPU BATTLE', mode: 'CPU_BATTLE', desc: 'Challenge the AI. Choose difficulty and personality.' },
      { label: 'TRAINING', mode: 'TRAINING', desc: 'Lightweight practice against a passive/standard CPU setup.' },
    ];

    options.forEach((opt, i) => {
      this.add.text(640, 290 + i * 120, opt.desc, {
        fontFamily: FONTS.body,
        fontSize: '16px',
        color: CSS_COLORS.muted,
        align: 'center',
        wordWrap: { width: 760 },
      }).setOrigin(0.5).setAlpha(0.9);

      this.buttons.push(
        new MenuButton(this, {
          x: 640,
          y: 250 + i * 120,
          width: 420,
          height: 52,
          label: opt.label,
          onClick: () => this.chooseMode(opt.mode),
        }),
      );
    });

    this.add.text(640, 675, 'ENTER CONFIRM  •  ESC BACK  •  UP/DOWN NAVIGATE', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setAlpha(0.7);

    this.updateSelectionVisuals();
    this.bindInput();

    const loop = getGameLoop(this);
    if (loop) {
      this.unsubscribeLoop = loop.addFixedUpdate(() => this.backdrop?.update(loop.simulationTimeSeconds));
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private chooseMode(mode: MatchMode): void {
    if (this.starting) return;
    const config: MatchConfig = {
      ...createDefaultMatchConfig(mode),
      ...this.baseConfig,
      mode,
      cpuEnabled: mode === 'CPU_BATTLE',
      cpuPlayer: mode === 'CPU_BATTLE' ? (this.baseConfig.cpuPlayer ?? 2) : 2,
    };

    if (mode === 'CPU_BATTLE') {
      this.start(SCENE_KEYS.CPU_CONFIG, { config });
      return;
    }

    // Training: lightweight practice against a CPU-controlled opponent.
    if (mode === 'TRAINING') {
      this.start(SCENE_KEYS.CHARACTER_SELECT, {
        config: { ...config, cpuEnabled: true, cpuPlayer: 2, cpuDifficulty: 'EASY', cpuPersonality: 'DEFENDER' },
        selecting: 1,
      });
      return;
    }

    this.start(SCENE_KEYS.CHARACTER_SELECT, { config, selecting: 1 });
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown-UP', this.up, this);
    this.input.keyboard?.on('keydown-DOWN', this.down, this);
    this.input.keyboard?.on('keydown-W', this.up, this);
    this.input.keyboard?.on('keydown-S', this.down, this);
    this.input.keyboard?.on('keydown-ENTER', this.confirm, this);
    this.input.keyboard?.on('keydown-SPACE', this.confirm, this);
    this.input.keyboard?.on('keydown-ESC', this.back, this);
  }

  private up(): void { if (!this.starting) { this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length; this.updateSelectionVisuals(); getAudioManager(this.game)?.playUi('ui-move'); } }
  private down(): void { if (!this.starting) { this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length; this.updateSelectionVisuals(); getAudioManager(this.game)?.playUi('ui-move'); } }
  private confirm(): void {
    if (this.starting) return;
    const modes: MatchMode[] = ['LOCAL_VERSUS', 'CPU_BATTLE', 'TRAINING'];
    this.chooseMode(modes[this.selectedIndex] ?? 'LOCAL_VERSUS');
  }
  private back(): void { this.start(SCENE_KEYS.MENU); }

  private updateSelectionVisuals(): void {
    this.buttons.forEach((b, i) => {
      b.setAlpha(i === this.selectedIndex ? 1 : 0.72);
      b.setScale(i === this.selectedIndex ? 1.03 : 1);
    });
  }

  private start(key: string, data?: object): void {
    if (this.starting) return;
    this.starting = true;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.cameras.main.fadeOut(220, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  private shutdown(): void {
    this.unsubscribeLoop?.();
    this.unsubscribeLoop = null;
    this.input.keyboard?.off('keydown-UP', this.up, this);
    this.input.keyboard?.off('keydown-DOWN', this.down, this);
    this.input.keyboard?.off('keydown-W', this.up, this);
    this.input.keyboard?.off('keydown-S', this.down, this);
    this.input.keyboard?.off('keydown-ENTER', this.confirm, this);
    this.input.keyboard?.off('keydown-SPACE', this.confirm, this);
    this.input.keyboard?.off('keydown-ESC', this.back, this);
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.backdrop = undefined;
  }
}

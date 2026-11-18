import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { createDefaultMatchConfig } from '../data/MatchConfig';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { CSS_COLORS, FONTS } from '../ui/Theme';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { ProgressionToast } from '../ui/ProgressionToast';

export class MenuScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private buttons: MenuButton[] = [];
  private unsubscribeLoop: (() => void) | null = null;
  private selectedIndex = 0;
  private starting = false;
  private toast?: ProgressionToast;

  constructor() {
    super({ key: SCENE_KEYS.MENU });
  }

  create(): void {
    this.starting = false;
    this.selectedIndex = 0;
    this.cameras.main.fadeIn(400, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    this.toast = new ProgressionToast(this);
    const profile = getOrLoadProfile(); // initialize/load persistent profile on menu entry
    this.toast.pumpFromQueue(this.time.now);
    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(profile.settings);
    audio?.setMusic('music-menu');
    const unlock = () => audio?.unlock();
    this.input.once('pointerdown', unlock);
    this.input.keyboard?.once('keydown', unlock);

    this.add.text(640, 170, 'RIFTBOUND', {
      fontFamily: FONTS.display,
      fontSize: '96px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(640, 238, 'ANIME FIGHTING // LOCAL VERSUS - CPU - TRAINING - ARCADE', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setLetterSpacing(3).setAlpha(0.85);

    const defs = [
      { label: 'ARCADE', action: () => this.startTransition(SCENE_KEYS.ARCADE) },
      { label: 'FIGHT', action: () => this.goToModeSelect('LOCAL_VERSUS') },
      { label: 'TRAINING', action: () => this.goToModeSelect('TRAINING') },
      { label: 'PROFILE', action: () => this.startTransition(SCENE_KEYS.PLAYER_PROFILE) },
      { label: 'COLLECTION', action: () => this.startTransition(SCENE_KEYS.COLLECTION) },
      { label: 'SETTINGS', action: () => this.startTransition(SCENE_KEYS.SETTINGS) },
      { label: 'HOW TO PLAY', action: () => this.startTransition(SCENE_KEYS.HOW_TO_PLAY) },
    ];

    this.buttons = defs.map((def, i) =>
      new MenuButton(this, {
        x: 640,
        y: 320 + i * 58,
        width: 420,
        height: 48,
        label: def.label,
        onClick: def.action,
      }),
    );

    this.add.text(640, 660, 'ENTER/SPACE CONFIRM  •  UP/DOWN OR MOUSE SELECT  •  SETTINGS FOR AUDIO & ACCESSIBILITY', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setAlpha(0.7);

    this.updateSelectionVisuals();
    this.bindInput();

    const loop = getGameLoop(this);
    if (loop) {
      this.unsubscribeLoop = loop.addFixedUpdate(() => {
        this.backdrop?.update(loop.simulationTimeSeconds);
        this.toast?.update(this.time.now);
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown-UP', this.moveSelectionUp, this);
    this.input.keyboard?.on('keydown-DOWN', this.moveSelectionDown, this);
    this.input.keyboard?.on('keydown-W', this.moveSelectionUp, this);
    this.input.keyboard?.on('keydown-S', this.moveSelectionDown, this);
    this.input.keyboard?.on('keydown-ENTER', this.activateSelection, this);
    this.input.keyboard?.on('keydown-SPACE', this.activateSelection, this);
  }

  private moveSelectionUp(): void {
    if (this.starting) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length;
    this.updateSelectionVisuals();
    getAudioManager(this.game)?.playUi('ui-move');
  }

  private moveSelectionDown(): void {
    if (this.starting) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length;
    this.updateSelectionVisuals();
    getAudioManager(this.game)?.playUi('ui-move');
  }

  private activateSelection(): void {
    if (this.starting) return;
    const actions = [
      () => this.startTransition(SCENE_KEYS.ARCADE),
      () => this.goToModeSelect('LOCAL_VERSUS'),
      () => this.goToModeSelect('TRAINING'),
      () => this.startTransition(SCENE_KEYS.PLAYER_PROFILE),
      () => this.startTransition(SCENE_KEYS.COLLECTION),
      () => this.startTransition(SCENE_KEYS.SETTINGS),
      () => this.startTransition(SCENE_KEYS.HOW_TO_PLAY),
    ];
    actions[this.selectedIndex]?.();
  }

  private updateSelectionVisuals(): void {
    this.buttons.forEach((button, index) => {
      button.setAlpha(index === this.selectedIndex ? 1 : 0.72);
      button.setScale(index === this.selectedIndex ? 1.03 : 1);
    });
  }

  private goToModeSelect(presetMode: 'LOCAL_VERSUS' | 'TRAINING'): void {
    if (this.starting) return;
    const base = createDefaultMatchConfig(presetMode);
    this.startTransition(SCENE_KEYS.MODE_SELECT, { config: base, presetMode });
  }

  private startTransition(sceneKey: string, data?: object): void {
    if (this.starting) return;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.starting = true;
    this.cameras.main.fadeOut(260, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(sceneKey, data);
    });
  }

  private shutdown(): void {
    this.unsubscribeLoop?.();
    this.unsubscribeLoop = null;
    this.input.keyboard?.off('keydown-UP', this.moveSelectionUp, this);
    this.input.keyboard?.off('keydown-DOWN', this.moveSelectionDown, this);
    this.input.keyboard?.off('keydown-W', this.moveSelectionUp, this);
    this.input.keyboard?.off('keydown-S', this.moveSelectionDown, this);
    this.input.keyboard?.off('keydown-ENTER', this.activateSelection, this);
    this.input.keyboard?.off('keydown-SPACE', this.activateSelection, this);
    this.input.removeAllListeners('pointerdown');
    for (const button of this.buttons) button.destroy();
    this.buttons = [];
    this.backdrop = undefined;
    this.toast?.destroy(); this.toast = undefined;
  }
}

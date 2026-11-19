import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { GAME_WIDTH, SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { createDefaultMatchConfig } from '../data/MatchConfig';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { CSS_COLORS, FONTS } from '../ui/Theme';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { ProgressionToast } from '../ui/ProgressionToast';

const MENU_CENTER_X = GAME_WIDTH / 2;

interface MenuDefinition {
  readonly label: string;
  readonly action: () => void;
  readonly primary: boolean;
  readonly fontSize?: number;
  readonly letterSpacing?: number;
}

export class MenuScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private buttons: MenuButton[] = [];
  private actions: Array<() => void> = [];
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

    this.add.text(MENU_CENTER_X, 158, 'RIFTBOUND', {
      fontFamily: FONTS.display,
      fontSize: '88px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(MENU_CENTER_X, 222, 'ANIME FIGHTING // LOCAL VERSUS - CPU - TRAINING - ARCADE', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setLetterSpacing(3).setAlpha(0.85);

    // Four core modes get the full-width column. Utilities live in a compact
    // row below so the footer/control hints stay clear at 1280x720.
    const defs: MenuDefinition[] = [
      { label: 'FIGHT', primary: true, action: () => this.goToModeSelect('LOCAL_VERSUS') },
      { label: 'ARCADE', primary: true, action: () => this.startTransition(SCENE_KEYS.ARCADE) },
      { label: 'TRAINING', primary: true, action: () => this.goToModeSelect('TRAINING') },
      { label: 'SETTINGS', primary: true, action: () => this.startTransition(SCENE_KEYS.SETTINGS) },
      { label: 'HOW TO PLAY', primary: false, fontSize: 15, letterSpacing: 2, action: () => this.startTransition(SCENE_KEYS.HOW_TO_PLAY) },
      { label: 'PROFILE', primary: false, fontSize: 15, letterSpacing: 2, action: () => this.startTransition(SCENE_KEYS.PLAYER_PROFILE) },
      { label: 'COLLECTION', primary: false, fontSize: 15, letterSpacing: 2, action: () => this.startTransition(SCENE_KEYS.COLLECTION) },
    ];
    this.actions = defs.map((def) => def.action);

    let coreIndex = 0;
    let utilityIndex = 0;
    this.buttons = defs.map((def) => {
      const button = def.primary
        ? new MenuButton(this, {
            x: MENU_CENTER_X,
            y: 320 + coreIndex++ * 72,
            width: 420,
            height: 52,
            label: def.label,
            fontSize: def.fontSize,
            letterSpacing: def.letterSpacing,
            onClick: def.action,
          })
        : new MenuButton(this, {
            x: MENU_CENTER_X + (utilityIndex++ - 1) * 214,
            y: 610,
            width: 196,
            height: 38,
            label: def.label,
            fontSize: def.fontSize,
            letterSpacing: def.letterSpacing,
            glowPaddingX: 20,
            glowPaddingY: 50,
            onClick: def.action,
          });
      button.on('pointerover', () => {
        if (this.starting) return;
        this.selectedIndex = this.buttons.indexOf(button);
        this.updateSelectionVisuals();
      });
      return button;
    });

    this.add.text(MENU_CENTER_X, 682, 'ENTER/SPACE CONFIRM  •  ARROWS SELECT  •  ESC BACK WHERE AVAILABLE', {
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
    this.input.keyboard?.on('keydown-LEFT', this.moveSelectionLeft, this);
    this.input.keyboard?.on('keydown-RIGHT', this.moveSelectionRight, this);
    this.input.keyboard?.on('keydown-A', this.moveSelectionLeft, this);
    this.input.keyboard?.on('keydown-D', this.moveSelectionRight, this);
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

  private moveSelectionLeft(): void {
    if (this.starting || this.selectedIndex < 4) return;
    this.selectedIndex = 4 + (this.selectedIndex - 4 + 2) % 3;
    this.updateSelectionVisuals();
    getAudioManager(this.game)?.playUi('ui-move');
  }

  private moveSelectionRight(): void {
    if (this.starting || this.selectedIndex < 4) return;
    this.selectedIndex = 4 + (this.selectedIndex - 4 + 1) % 3;
    this.updateSelectionVisuals();
    getAudioManager(this.game)?.playUi('ui-move');
  }

  private activateSelection(): void {
    if (this.starting) return;
    this.actions[this.selectedIndex]?.();
  }

  private updateSelectionVisuals(): void {
    this.buttons.forEach((button, index) => {
      const active = index === this.selectedIndex;
      button.setAlpha(active ? 1 : 0.68);
      button.setSelected(active);
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
    this.input.keyboard?.off('keydown-LEFT', this.moveSelectionLeft, this);
    this.input.keyboard?.off('keydown-RIGHT', this.moveSelectionRight, this);
    this.input.keyboard?.off('keydown-A', this.moveSelectionLeft, this);
    this.input.keyboard?.off('keydown-D', this.moveSelectionRight, this);
    this.input.keyboard?.off('keydown-ENTER', this.activateSelection, this);
    this.input.keyboard?.off('keydown-SPACE', this.activateSelection, this);
    this.input.removeAllListeners('pointerdown');
    for (const button of this.buttons) button.destroy();
    this.buttons = [];
    this.actions = [];
    this.backdrop = undefined;
    this.toast?.destroy(); this.toast = undefined;
  }
}

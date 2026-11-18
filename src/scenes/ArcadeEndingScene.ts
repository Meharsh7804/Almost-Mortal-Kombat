import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import type { ArcadeRunSnapshot } from '../arcade/ArcadeConfig';
import { getArcadeEnding } from '../arcade/ArcadeCampaignRegistry';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getCharacterById } from '../data/CharacterRegistry';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ProgressionToast } from '../ui/ProgressionToast';
import { CSS_COLORS, FONTS, toCssColor } from '../ui/Theme';

interface SceneData { readonly characterId?: string; readonly run?: ArcadeRunSnapshot }

export class ArcadeEndingScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private characterId = 'kai';
  private run?: ArcadeRunSnapshot;
  private toast?: ProgressionToast;
  private buttons: MenuButton[] = [];

  constructor() { super({ key: SCENE_KEYS.ARCADE_ENDING }); }

  init(data?: SceneData): void {
    this.characterId = data?.characterId ?? data?.run?.characterId ?? 'kai';
    this.run = data?.run;
  }

  create(): void {
    this.starting = false;
    this.cameras.main.fadeIn(300, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    this.toast = new ProgressionToast(this);
    const profile = getOrLoadProfile();
    this.toast.pumpFromQueue(this.time.now);
    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(profile.settings);
    if (this.run?.completed) {
      // Safe no-op when assets/keys are unavailable.
      audio?.playSfx('sfx-arcade-complete', { volume: 0.8 });
    }

    const ending = getArcadeEnding(this.characterId);
    const char = getCharacterById(this.characterId);
    const color = char ? toCssColor(char.fighterConfig.color) : CSS_COLORS.bone;

    this.add.text(640, 90, 'ARCADE COMPLETE', { fontFamily: FONTS.display, fontSize: '44px', color: CSS_COLORS.bone }).setOrigin(0.5);
    this.add.text(640, 150, ending.title, {
      fontFamily: FONTS.display, fontSize: '30px', color, align: 'center', wordWrap: { width: 1100 },
    }).setOrigin(0.5);
    this.add.text(640, 200, char ? `${char.displayName}'s Ending` : 'Ending', {
      fontFamily: FONTS.mono, fontSize: '13px', color: CSS_COLORS.violet,
    }).setOrigin(0.5);

    const text = ending.text.join('\n\n');
    this.add.text(640, 360, text, {
      fontFamily: FONTS.body, fontSize: '24px', color: CSS_COLORS.bone, align: 'center', wordWrap: { width: 860 }, lineSpacing: 10,
    }).setOrigin(0.5);

    if (this.run) {
      this.add.text(640, 520, `Difficulty: ${this.run.difficulty}  •  Wins: ${this.run.wins}  •  Continues Used: ${this.run.continuesUsed}`, {
        fontFamily: FONTS.mono, fontSize: '12px', color: CSS_COLORS.muted,
      }).setOrigin(0.5);
    }

    this.buttons = [
      new MenuButton(this, { x: 460, y: 620, width: 260, height: 48, label: 'ARCADE MENU', onClick: () => this.go(SCENE_KEYS.ARCADE) }),
      new MenuButton(this, { x: 820, y: 620, width: 260, height: 48, label: 'MAIN MENU', onClick: () => this.go(SCENE_KEYS.MENU) }),
    ];
    this.input.keyboard?.once('keydown-ESC', () => this.go(SCENE_KEYS.MENU));
    this.input.keyboard?.once('keydown-ENTER', () => this.go(SCENE_KEYS.ARCADE));

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
    for (const button of this.buttons) button.destroy();
    this.buttons = [];
    this.toast?.destroy();
    this.toast = undefined;
    this.backdrop = undefined;
  }

  private go(key: string): void {
    if (this.starting) return;
    this.starting = true;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.cameras.main.fadeOut(220, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key));
  }
}

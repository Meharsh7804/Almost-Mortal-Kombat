import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { CSS_COLORS, FONTS } from '../ui/Theme';

export class HowToPlayScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private button?: MenuButton;

  constructor() {
    super({ key: SCENE_KEYS.HOW_TO_PLAY });
  }

  create(): void {
    this.starting = false;
    this.cameras.main.fadeIn(220, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    getAudioManager(this.game)?.attach(this.sound);

    this.add.text(640, 90, 'HOW TO PLAY', {
      fontFamily: FONTS.display, fontSize: '52px', color: CSS_COLORS.bone, stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    const sections = [
      'GOAL: Reduce your opponent to 0 HP and win the required number of rounds before time runs out.',
      'MOVEMENT: Walk, jump, and crouch to control space and face your opponent.',
      'ATTACKS: Use Light and Heavy strikes, plus character specials that consume energy.',
      'DEFENSE: Hold Block to guard. Well-timed blocks can trigger Perfect Guard. Dodge to evade (with cooldown/energy cost).',
      'COMBOS & ENERGY: Chain attacks on hit, build damage, and manage energy for specials and movement options.',
      'MODES: Local Versus (2 players), CPU Battle (vs AI), Training (vs CPU practice), and Arcade (stage ladder).',
      'PAUSE & SETTINGS: Press ESC during a match to pause. Use Settings for audio and accessibility options.',
    ];

    sections.forEach((line, i) => {
      this.add.text(150, 160 + i * 50, `- ${line}`, {
        fontFamily: FONTS.body, fontSize: '18px', color: CSS_COLORS.muted, wordWrap: { width: 980 },
      }).setOrigin(0, 0.5);
    });

    this.add.text(640, 542, 'P1: A/D move, W jump, S crouch, F light, G heavy, T block, H/Y specials, Q dodge', {
      fontFamily: FONTS.mono, fontSize: '11px', color: CSS_COLORS.violet, align: 'center',
    }).setOrigin(0.5);
    this.add.text(640, 566, 'P2: Left/Right move, Up jump, Down crouch, J light, K heavy, O block, U/I specials, P dodge', {
      fontFamily: FONTS.mono, fontSize: '11px', color: CSS_COLORS.violet, align: 'center',
    }).setOrigin(0.5);
    this.add.text(640, 592, 'Menus: Mouse / Arrow keys or W/S, ENTER/SPACE confirm  |  Match: ESC pause/resume', {
      fontFamily: FONTS.mono, fontSize: '10px', color: CSS_COLORS.muted, align: 'center',
    }).setOrigin(0.5);

    this.button = new MenuButton(this, { x: 640, y: 655, width: 320, height: 46, label: 'BACK', onClick: () => this.back() });
    this.input.keyboard?.once('keydown-ESC', () => this.back());
    this.input.keyboard?.once('keydown-ENTER', () => this.back());

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => this.backdrop?.update(loop.simulationTimeSeconds));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private back(): void {
    if (this.starting) return;
    this.starting = true;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.cameras.main.fadeOut(220, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENE_KEYS.MENU));
  }

  private shutdown(): void {
    this.unsubscribeLoop?.(); this.unsubscribeLoop = null;
    this.button?.destroy(); this.button = undefined;
    this.backdrop = undefined;
  }
}

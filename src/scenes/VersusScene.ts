import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getArenaById } from '../data/ArenaRegistry';
import { getCharacterById } from '../data/CharacterRegistry';
import { resolveMatchConfig, type MatchConfig, type ResolvedMatchConfig } from '../data/MatchConfig';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { CSS_COLORS, FONTS, toCssColor } from '../ui/Theme';
import type { ArcadeResultsContext } from '../ui/ResultsScreen';

interface SceneData {
  readonly config: MatchConfig;
  readonly arcade?: ArcadeResultsContext;
  readonly matchToken?: string;
}

export class VersusScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private resolved!: ResolvedMatchConfig;
  private skipped = false;
  private arcade?: ArcadeResultsContext;
  private matchToken?: string;

  constructor() {
    super({ key: SCENE_KEYS.VERSUS });
  }

  init(data: SceneData): void {
    this.resolved = resolveMatchConfig(data.config);
    this.arcade = data.arcade;
    this.matchToken = data.matchToken;
  }

  create(): void {
    this.starting = false;
    this.skipped = false;
    this.cameras.main.fadeIn(180, 3, 2, 6);
    this.backdrop = new MenuBackdrop(this);

    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(getOrLoadProfile().settings);
    audio?.playSfx('sfx-versus', { volume: 0.7 });

    const p1 = getCharacterById(this.resolved.player1CharacterId);
    const p2 = getCharacterById(this.resolved.player2CharacterId);
    const arena = getArenaById(this.resolved.resolvedArenaId);
    const p2Label = this.resolved.cpuEnabled && this.resolved.cpuPlayer === 2 ? `${p2?.displayName ?? 'CPU'} (CPU)` : (p2?.displayName ?? 'P2');
    const modeLabel = this.resolved.mode === 'ARCADE' && this.arcade
      ? `ARCADE  STAGE ${this.arcade.stageIndex + 1}/${this.arcade.run.stages.length}`
      : 'VERSUS';

    this.add.rectangle(640, 360, 1280, 720, 0x050408, 0.25);
    this.add.text(640, 90, modeLabel, { fontFamily: FONTS.display, fontSize: '46px', color: CSS_COLORS.bone }).setOrigin(0.5).setAlpha(0.9);

    this.add.text(360, 320, p1?.displayName ?? 'P1', {
      fontFamily: FONTS.display, fontSize: '54px', color: toCssColor(p1?.fighterConfig.color ?? 0xffffff), stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);
    this.add.text(920, 320, p2Label, {
      fontFamily: FONTS.display, fontSize: '54px', color: toCssColor(p2?.fighterConfig.color ?? 0xffffff), stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    const vs = this.add.text(640, 320, 'VS', {
      fontFamily: FONTS.display, fontSize: '96px', color: CSS_COLORS.crimson, stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5).setScale(0.4).setAlpha(0);

    this.add.text(640, 430, arena?.name ?? 'ARENA', {
      fontFamily: FONTS.mono, fontSize: '18px', color: CSS_COLORS.violet,
    }).setOrigin(0.5).setAlpha(0);
    this.add.text(640, 470, `${this.resolved.mode.replace('_', ' ')}  •  FT${this.resolved.roundsToWin}  •  ${this.resolved.roundTimerSeconds > 0 ? `${this.resolved.roundTimerSeconds}s` : 'NO TIMER'}`, {
      fontFamily: FONTS.mono, fontSize: '12px', color: CSS_COLORS.muted,
    }).setOrigin(0.5).setAlpha(0);

    this.add.text(640, 660, 'PRESS ENTER/SPACE/ESC TO SKIP', {
      fontFamily: FONTS.mono, fontSize: '10px', color: CSS_COLORS.muted,
    }).setOrigin(0.5).setAlpha(0.6);

    const p1t = this.children.list[3] as Phaser.GameObjects.Text;
    const p2t = this.children.list[4] as Phaser.GameObjects.Text;
    const arenat = this.children.list[6] as Phaser.GameObjects.Text;
    const infot = this.children.list[7] as Phaser.GameObjects.Text;

    this.tweens.add({ targets: p1t, alpha: 1, x: 430, duration: 420, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: p2t, alpha: 1, x: 850, duration: 420, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: vs, alpha: 1, scale: 1, duration: 420, delay: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [arenat, infot], alpha: 1, duration: 360, delay: 320 });

    this.time.delayedCall(2200, () => this.startBattle());

    const skip = () => this.startBattle();
    this.input.keyboard?.once('keydown-ENTER', skip);
    this.input.keyboard?.once('keydown-SPACE', skip);
    this.input.keyboard?.once('keydown-ESC', skip);
    this.input.once('pointerdown', skip);

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => this.backdrop?.update(loop.simulationTimeSeconds));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private startBattle(): void {
    if (this.starting || this.skipped) return;
    this.skipped = true;
    this.starting = true;
    getAudioManager(this.game)?.playUi('ui-confirm');
    this.cameras.main.fadeOut(260, 3, 2, 6);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.BATTLE, {
        matchConfig: this.resolved,
        arcade: this.arcade,
        matchToken: this.matchToken,
      });
    });
  }

  private shutdown(): void {
    this.unsubscribeLoop?.(); this.unsubscribeLoop = null;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.keyboard?.removeAllListeners();
    this.input.removeAllListeners('pointerdown');
    this.backdrop = undefined;
  }
}

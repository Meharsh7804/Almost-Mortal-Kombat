import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getArenaById } from '../data/ArenaRegistry';
import { getCharacterById } from '../data/CharacterRegistry';
import { resolveMatchConfig, type MatchConfig, type ResolvedMatchConfig } from '../data/MatchConfig';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { FighterPortrait } from '../ui/FighterPortrait';
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
  private portraits: FighterPortrait[] = [];
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
    const p2IsCpu = this.resolved.cpuEnabled && this.resolved.cpuPlayer === 2;
    const modeLabel = this.resolved.mode === 'ARCADE' && this.arcade
      ? `ARCADE  STAGE ${this.arcade.stageIndex + 1}/${this.arcade.run.stages.length}`
      : 'VERSUS';

    this.add.rectangle(640, 360, 1280, 720, 0x050408, 0.25);
    this.add.text(640, 64, modeLabel, {
      fontFamily: FONTS.display,
      fontSize: '44px',
      color: CSS_COLORS.bone,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0.9);

    const p1Role = this.add.text(330, 134, 'PLAYER 1', {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS_COLORS.pearl,
    }).setOrigin(0.5).setLetterSpacing(4).setAlpha(0);

    const p2Role = this.add.text(950, 134, p2IsCpu ? 'CPU OPPONENT' : 'PLAYER 2', {
      fontFamily: FONTS.mono,
      fontSize: '13px',
      color: CSS_COLORS.pearl,
    }).setOrigin(0.5).setLetterSpacing(4).setAlpha(0);

    const p1Name = this.add.text(330, 186, p1?.displayName ?? 'P1', {
      fontFamily: FONTS.display,
      fontSize: '42px',
      color: toCssColor(p1?.fighterConfig.color ?? 0xffffff),
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    const p2Name = this.add.text(950, 186, p2?.displayName ?? 'P2', {
      fontFamily: FONTS.display,
      fontSize: '42px',
      color: toCssColor(p2?.fighterConfig.color ?? 0xffffff),
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    // Two battle-ready rigs face the center emblem, mirroring the in-match art.
    const p1Portrait = new FighterPortrait(this, {
      x: 190,
      y: 524,
      characterId: this.resolved.player1CharacterId,
      fallbackColor: p1?.fighterConfig.color,
      fallbackAccent: p1?.fighterConfig.accentColor,
      scale: 1.75,
      facing: 1,
      pose: 'strike',
      glowAlpha: 0.24,
      animated: false,
    });
    p1Portrait.setAlpha(0);

    const p2Portrait = new FighterPortrait(this, {
      x: 1090,
      y: 524,
      characterId: this.resolved.player2CharacterId,
      fallbackColor: p2?.fighterConfig.color,
      fallbackAccent: p2?.fighterConfig.accentColor,
      scale: 1.75,
      facing: -1,
      pose: 'strike',
      glowAlpha: 0.24,
      animated: false,
    });
    p2Portrait.setAlpha(0);
    this.portraits = [p1Portrait, p2Portrait];

    const vs = this.add.text(640, 352, 'VS', {
      fontFamily: FONTS.display,
      fontSize: '104px',
      color: CSS_COLORS.crimson,
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5).setScale(0.4).setAlpha(0).setDepth(30);

    const arenaName = this.add.text(640, 590, arena?.name ?? 'ARENA', {
      fontFamily: FONTS.mono,
      fontSize: '18px',
      color: CSS_COLORS.violet,
    }).setOrigin(0.5).setAlpha(0);

    const info = this.add.text(640, 622, `${this.resolved.mode.replace('_', ' ')}  •  FT${this.resolved.roundsToWin}  •  ${this.resolved.roundTimerSeconds > 0 ? `${this.resolved.roundTimerSeconds}s` : 'NO TIMER'}`, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setAlpha(0);

    this.add.text(640, 680, 'PRESS ENTER/SPACE/ESC TO SKIP', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    }).setOrigin(0.5).setAlpha(0.6);

    this.tweens.add({ targets: p1Portrait, alpha: 1, x: 330, duration: 480, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: p2Portrait, alpha: 1, x: 950, duration: 480, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [p1Role, p2Role, p1Name, p2Name], alpha: 1, duration: 380, delay: 160 });
    this.tweens.add({ targets: vs, alpha: 1, scale: 1, duration: 420, delay: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [arenaName, info], alpha: 1, duration: 360, delay: 320 });

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
    for (const portrait of this.portraits) portrait.destroy();
    this.portraits = [];
    this.backdrop = undefined;
  }
}

import Phaser from 'phaser';

import type { AIDifficulty, AIPersonality } from '../ai/AITypes';
import { GAME_TITLE, SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { TEXTURE_KEYS } from '../data/TextureKeys';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ensureSoftGlowTexture } from '../ui/ProceduralTextures';
import { COLORS, CSS_COLORS, FONTS } from '../ui/Theme';

export type BattleMode = 'PVP' | 'PVC';

export interface BattleLaunchConfig {
  readonly mode: BattleMode;
  readonly difficulty: AIDifficulty;
  readonly personality: AIPersonality;
  readonly aiPlayer: 1 | 2;
  readonly seed: number;
}

const DIFFICULTIES: readonly AIDifficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];
const PERSONALITIES: readonly AIPersonality[] = ['AGGRESSOR', 'DEFENDER', 'TRICKSTER', 'BRUISER'];

const TITLE_Y = 260;
const BUTTON_Y = 512;
const HINT_Y = 590;
const PHASE_Y = 602;

/**
 * Temporary foundation menu.
 *
 * Visual animation is intentionally split between Phaser tweens (UI entrances)
 * and the shared fixed-timestep clock (ambient pulses). That demonstrates the
 * intended future render/simulation boundary without implementing gameplay.
 */
export class MenuScene extends Phaser.Scene {
  private backdrop!: MenuBackdrop;
  private titleGroup!: Phaser.GameObjects.Container;
  private titleGhostCrimson!: Phaser.GameObjects.Text;
  private titleGhostViolet!: Phaser.GameObjects.Text;
  private titleHalo!: Phaser.GameObjects.Image;
  private eyebrow!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private divider!: Phaser.GameObjects.Graphics;
  private startButton!: MenuButton;
  private keyboardHint!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private difficultyText!: Phaser.GameObjects.Text;
  private personalityText!: Phaser.GameObjects.Text;
  private aiSideText!: Phaser.GameObjects.Text;
  private setupHintText!: Phaser.GameObjects.Text;

  private unsubscribeLoop: (() => void) | null = null;
  private accentPulse = 0;
  private starting = false;

  private battleMode: BattleMode = 'PVC';
  private difficulty: AIDifficulty = 'NORMAL';
  private personality: AIPersonality = 'AGGRESSOR';
  private aiPlayer: 1 | 2 = 2;

  constructor() {
    super({ key: SCENE_KEYS.MENU });
  }

  create(): void {
    this.cameras.main.fadeIn(520, 4, 3, 7);

    this.backdrop = new MenuBackdrop(this);
    this.buildTitle();
    this.buildPrompt();
    this.bindInput();
    this.connectSimulation();
    this.playIntro();
  }

  private buildTitle(): void {
    ensureSoftGlowTexture(this);

    this.titleHalo = this.add
      .image(640, TITLE_Y + 6, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(980, 380)
      .setTint(COLORS.crimson)
      .setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);

    this.add
      .image(598, TITLE_Y + 24, TEXTURE_KEYS.glowSoft)
      .setDisplaySize(760, 300)
      .setTint(COLORS.violet)
      .setAlpha(0.16)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);

    const baseStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONTS.display,
      fontSize: '112px',
      align: 'center',
    };

    this.titleGroup = this.add.container(640, TITLE_Y).setDepth(3);

    this.titleGhostViolet = this.add
      .text(-4, 1, GAME_TITLE, { ...baseStyle, color: CSS_COLORS.violet })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setAlpha(0.16)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.titleGhostCrimson = this.add
      .text(3, -1, GAME_TITLE, { ...baseStyle, color: CSS_COLORS.crimson })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setAlpha(0.24)
      .setBlendMode(Phaser.BlendModes.ADD);

    const title = this.add
      .text(0, 0, GAME_TITLE, { ...baseStyle, color: CSS_COLORS.bone })
      .setOrigin(0.5)
      .setLetterSpacing(4);
    title.setShadow(0, 0, CSS_COLORS.crimson, 30, true, true);

    this.titleGroup.add([this.titleGhostViolet, this.titleGhostCrimson, title]);

    this.eyebrow = this.add
      .text(640, 158, 'RIFT SIGNAL // DETECTED', {
        fontFamily: FONTS.mono,
        fontSize: '10px',
        color: CSS_COLORS.crimson,
      })
      .setOrigin(0.5)
      .setLetterSpacing(6)
      .setAlpha(0.62)
      .setDepth(4);

    const eyebrowRules = this.add.graphics().setDepth(4);
    const halfWidth = this.eyebrow.displayWidth / 2 + 22;
    eyebrowRules.lineStyle(1, COLORS.crimson, 0.35);
    eyebrowRules.lineBetween(640 - halfWidth - 58, 163, 640 - halfWidth, 163);
    eyebrowRules.lineBetween(640 + halfWidth, 163, 640 + halfWidth + 58, 163);
    eyebrowRules.fillStyle(COLORS.crimson, 0.7);
    eyebrowRules.fillTriangle(
      640 - halfWidth - 62,
      163,
      640 - halfWidth - 57,
      160,
      640 - halfWidth - 57,
      166,
    );
    eyebrowRules.fillTriangle(
      640 + halfWidth + 62,
      163,
      640 + halfWidth + 57,
      160,
      640 + halfWidth + 57,
      166,
    );

    this.subtitle = this.add
      .text(640, 338, 'THE BATTLE BEGINS', {
        fontFamily: FONTS.body,
        fontSize: '15px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(10)
      .setAlpha(0.88)
      .setDepth(4);

    this.divider = this.add.graphics().setDepth(4);
    this.divider.lineStyle(1, COLORS.line, 0.8);
    this.divider.lineBetween(410, 380, 606, 380);
    this.divider.lineBetween(674, 380, 870, 380);
    this.divider.lineStyle(1, COLORS.violet, 0.4);
    this.divider.lineBetween(606, 380, 616, 380);
    this.divider.lineBetween(664, 380, 674, 380);
    this.divider.fillStyle(COLORS.crimson, 0.9);
    this.divider.beginPath();
    this.divider.moveTo(640, 374);
    this.divider.lineTo(646, 380);
    this.divider.lineTo(640, 386);
    this.divider.lineTo(634, 380);
    this.divider.closePath();
    this.divider.fillPath();
  }

  private buildPrompt(): void {
    this.startButton = new MenuButton(this, {
      x: 640,
      y: BUTTON_Y,
      width: 380,
      height: 76,
      label: 'START',
      onClick: () => {
        this.handleStart();
      },
    });

    this.modeText = this.add
      .text(640, 408, '', {
        fontFamily: FONTS.display,
        fontSize: '20px',
        color: CSS_COLORS.bone,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setDepth(21);

    this.difficultyText = this.add
      .text(640, 438, '', {
        fontFamily: FONTS.mono,
        fontSize: '11px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setDepth(21);

    this.personalityText = this.add
      .text(640, 458, '', {
        fontFamily: FONTS.mono,
        fontSize: '11px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setDepth(21);

    this.aiSideText = this.add
      .text(640, 478, '', {
        fontFamily: FONTS.mono,
        fontSize: '11px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setDepth(21);

    this.setupHintText = this.add
      .text(
        640,
        572,
        'M MODE   D DIFFICULTY   P PERSONALITY   A AI SIDE   ENTER START',
        {
          fontFamily: FONTS.mono,
          fontSize: '9px',
          color: CSS_COLORS.muted,
        },
      )
      .setOrigin(0.5)
      .setLetterSpacing(2)
      .setAlpha(0.36)
      .setDepth(21);

    this.keyboardHint = this.add
      .text(640, HINT_Y, 'PRESS ENTER OR SPACE', {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setAlpha(0.3)
      .setDepth(21);

    this.phaseText = this.add
      .text(640, PHASE_Y, 'PHASE 04 // PLAYER VS CPU READY', {
        fontFamily: FONTS.mono,
        fontSize: '10px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setAlpha(0.7)
      .setDepth(21);

    this.refreshSetupText();
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown-ENTER', this.handleKeyboardStart);
    this.input.keyboard?.on('keydown-SPACE', this.handleKeyboardStart);
    this.input.keyboard?.on('keydown-M', this.handleModeToggle);
    this.input.keyboard?.on('keydown-D', this.handleDifficultyCycle);
    this.input.keyboard?.on('keydown-P', this.handlePersonalityCycle);
    this.input.keyboard?.on('keydown-A', this.handleAiSideToggle);
  }

  private connectSimulation(): void {
    const loop = getGameLoop(this);
    if (!loop) {
      console.warn('[MenuScene] Shared GameLoop was not found in the scene registry.');
      return;
    }

    this.unsubscribeLoop = loop.addFixedUpdate(({ deltaMs, elapsedSeconds }) => {
      this.backdrop.update(elapsedSeconds);

      this.accentPulse = Math.max(0, this.accentPulse - (deltaMs / 1000) * 0.22);

      const haloAlpha = 0.3 + Math.sin(elapsedSeconds * 1.3) * 0.045 + this.accentPulse;
      this.titleHalo.setAlpha(Math.min(haloAlpha, 0.62));

      const crimsonAlpha = 0.24 + Math.sin(elapsedSeconds * 2.1) * 0.035 + this.accentPulse * 0.9;
      this.titleGhostCrimson.setAlpha(Math.min(crimsonAlpha, 0.8));

      this.titleGhostViolet.setAlpha(0.16 + Math.sin(elapsedSeconds * 1.6 + 1.1) * 0.025);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private playIntro(): void {
    this.titleGroup.setAlpha(0).setY(TITLE_Y - 14);
    this.eyebrow.setAlpha(0);
    this.subtitle.setAlpha(0);
    this.divider.setAlpha(0);
    this.modeText.setAlpha(0);
    this.difficultyText.setAlpha(0);
    this.personalityText.setAlpha(0);
    this.aiSideText.setAlpha(0);
    this.startButton.setAlpha(0).setY(BUTTON_Y + 14);
    this.setupHintText.setAlpha(0);
    this.keyboardHint.setAlpha(0);
    this.phaseText.setAlpha(0);

    this.tweens.add({
      targets: this.eyebrow,
      alpha: 0.62,
      duration: 700,
      delay: 120,
      ease: 'Sine.easeOut',
    });

    this.tweens.add({
      targets: this.titleGroup,
      alpha: 1,
      y: TITLE_Y,
      duration: 900,
      delay: 180,
      ease: 'Cubic.easeOut',
    });

    this.tweens.add({
      targets: this.subtitle,
      alpha: 0.88,
      duration: 700,
      delay: 480,
      ease: 'Sine.easeOut',
    });

    this.tweens.add({
      targets: this.divider,
      alpha: 1,
      duration: 700,
      delay: 560,
      ease: 'Sine.easeOut',
    });

    const aiConfigVisible = this.battleMode === 'PVC';
    this.tweens.add({
      targets: this.modeText,
      alpha: 1,
      duration: 450,
      delay: 600,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: this.difficultyText,
      alpha: aiConfigVisible ? 0.9 : 0.35,
      duration: 450,
      delay: 620,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: this.personalityText,
      alpha: aiConfigVisible ? 0.9 : 0.35,
      duration: 450,
      delay: 640,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: this.aiSideText,
      alpha: aiConfigVisible ? 0.8 : 0.35,
      duration: 450,
      delay: 660,
      ease: 'Sine.easeOut',
    });

    this.tweens.add({
      targets: this.startButton,
      alpha: 1,
      y: BUTTON_Y,
      duration: 560,
      delay: 640,
      ease: 'Back.easeOut',
    });

    this.tweens.add({
      targets: [this.setupHintText, this.keyboardHint],
      alpha: { from: 0, to: 0.34 },
      duration: 500,
      delay: 900,
      ease: 'Sine.easeOut',
    });

    this.tweens.add({
      targets: this.phaseText,
      alpha: 0.7,
      duration: 500,
      delay: 980,
      ease: 'Sine.easeOut',
    });
  }

  private handleStart(): void {
    if (this.starting) {
      return;
    }

    this.starting = true;
    this.accentPulse = 0.2;

    this.startButton.pulse();
    this.tweens.killTweensOf(this.phaseText);
    this.phaseText.setText('ENTERING THE RIFT').setColor(CSS_COLORS.bone).setAlpha(1);

    const config: BattleLaunchConfig = {
      mode: this.battleMode,
      difficulty: this.difficulty,
      personality: this.personality,
      aiPlayer: this.aiPlayer,
      seed: (Date.now() & 0xffffffff) >>> 0,
    };

    this.cameras.main.fadeOut(280, 4, 3, 7);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.BATTLE, config);
    });
  }

  private readonly handleKeyboardStart = (): void => {
    this.handleStart();
  };

  private readonly handleModeToggle = (): void => {
    if (this.starting) return;
    this.battleMode = this.battleMode === 'PVC' ? 'PVP' : 'PVC';
    this.refreshSetupText();
  };

  private readonly handleDifficultyCycle = (): void => {
    if (this.starting) return;
    const index = DIFFICULTIES.indexOf(this.difficulty);
    this.difficulty = DIFFICULTIES[(index + 1) % DIFFICULTIES.length] ?? 'NORMAL';
    this.refreshSetupText();
  };

  private readonly handlePersonalityCycle = (): void => {
    if (this.starting) return;
    const index = PERSONALITIES.indexOf(this.personality);
    this.personality = PERSONALITIES[(index + 1) % PERSONALITIES.length] ?? 'AGGRESSOR';
    this.refreshSetupText();
  };

  private readonly handleAiSideToggle = (): void => {
    if (this.starting) return;
    this.aiPlayer = this.aiPlayer === 2 ? 1 : 2;
    this.refreshSetupText();
  };

  private refreshSetupText(): void {
    const modeLabel = this.battleMode === 'PVC' ? 'PLAYER VS CPU' : 'PLAYER VS PLAYER';
    this.modeText.setText(modeLabel).setColor(this.battleMode === 'PVC' ? CSS_COLORS.crimson : CSS_COLORS.bone);
    this.difficultyText
      .setText(`DIFFICULTY  ${this.difficulty}`)
      .setAlpha(this.battleMode === 'PVC' ? 0.9 : 0.35);
    this.personalityText
      .setText(`PERSONALITY  ${this.personality}`)
      .setAlpha(this.battleMode === 'PVC' ? 0.9 : 0.35);
    this.aiSideText
      .setText(`AI SIDE  P${this.aiPlayer}`)
      .setAlpha(this.battleMode === 'PVC' ? 0.8 : 0.35);
    this.phaseText.setText(
      this.battleMode === 'PVC'
        ? 'PHASE 04 // PLAYER VS CPU READY'
        : 'PHASE 04 // LOCAL VERSUS READY',
    );
  }

  private handleShutdown(): void {
    this.unsubscribeLoop?.();
    this.unsubscribeLoop = null;
    this.input.keyboard?.off('keydown-ENTER', this.handleKeyboardStart);
    this.input.keyboard?.off('keydown-SPACE', this.handleKeyboardStart);
    this.input.keyboard?.off('keydown-M', this.handleModeToggle);
    this.input.keyboard?.off('keydown-D', this.handleDifficultyCycle);
    this.input.keyboard?.off('keydown-P', this.handlePersonalityCycle);
    this.input.keyboard?.off('keydown-A', this.handleAiSideToggle);
  }
}

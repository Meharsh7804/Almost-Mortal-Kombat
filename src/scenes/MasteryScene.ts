import Phaser from 'phaser';
import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getCharacterRegistry } from '../data/CharacterRegistry';
import { getMasteryLevelProgress } from '../progression/LevelCurve';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { isContentUnlocked } from '../progression/UnlockSystem';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ProgressionToast } from '../ui/ProgressionToast';
import { CSS_COLORS, FONTS, toCssColor } from '../ui/Theme';

export class MasteryScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private toast?: ProgressionToast;
  constructor() { super({ key: SCENE_KEYS.MASTERY }); }
  create(): void {
    this.starting = false;
    this.cameras.main.fadeIn(220, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    this.toast = new ProgressionToast(this);
    const profile = getOrLoadProfile();
    this.toast.pumpFromQueue(this.time.now);
    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(profile.settings);

    this.add.text(640, 70, 'CHARACTER MASTERY', { fontFamily: FONTS.display, fontSize: '46px', color: CSS_COLORS.bone }).setOrigin(0.5);
    this.add.text(640, 115, 'Earn mastery XP by completing matches. Rewards are cosmetic/config-based.', {
      fontFamily: FONTS.body, fontSize: '15px', color: CSS_COLORS.muted,
    }).setOrigin(0.5);

    const roster = getCharacterRegistry();
    roster.forEach((char, i) => {
      const mastery = profile.characterMastery[char.id];
      const level = mastery?.masteryLevel ?? 1;
      const xp = mastery?.masteryXP ?? 0;
      const prog = getMasteryLevelProgress(xp);
      const x = 180;
      const y = 170 + i * 220;
      this.add.text(x, y, `${char.displayName}`, { fontFamily: FONTS.display, fontSize: '30px', color: toCssColor(char.fighterConfig.color) }).setOrigin(0, 0.5);
      this.add.text(x, y + 34, `Level ${level}/20   XP ${xp}   Next: ${prog.xpForNextLevel == null ? 'MAX' : `${prog.xpIntoLevel}/${prog.xpForNextLevel}`}`, {
        fontFamily: FONTS.mono, fontSize: '13px', color: CSS_COLORS.bone,
      }).setOrigin(0, 0.5);
      this.add.text(x, y + 58, `Matches ${mastery?.matchesPlayed ?? 0}   Wins ${mastery?.wins ?? 0}   Losses ${mastery?.losses ?? 0}   Best Combo ${mastery?.highestCombo ?? 0}`, {
        fontFamily: FONTS.mono, fontSize: '12px', color: CSS_COLORS.muted,
      }).setOrigin(0, 0.5);

      const barW = 520, barH = 10;
      const g = this.add.graphics();
      g.fillStyle(0x2a1828, 1).fillRoundedRect(x, y + 78, barW, barH, 4);
      g.fillStyle(char.fighterConfig.color, 1).fillRoundedRect(x, y + 78, Math.max(4, barW * prog.progress01), barH, 4);
      g.lineStyle(1, 0x4a2a45, 1).strokeRoundedRect(x, y + 78, barW, barH, 4);

      const rewards = [
        { lvl: 5, id: `palette:${char.id}:mastery5`, label: 'Alt Palette I' },
        { lvl: 10, id: `victory:${char.id}:mastery10`, label: 'Victory Pose' },
        { lvl: 20, id: `badge:${char.id}:mastery20`, label: 'True Master Badge' },
      ];
      rewards.forEach((r, ri) => {
        const unlocked = isContentUnlocked(profile, r.id);
        const status = unlocked ? 'UNLOCKED' : level >= r.lvl ? 'READY' : `LOCKED (Lv ${r.lvl})`;
        const color = unlocked ? '#7dffb0' : level >= r.lvl ? '#ffd36e' : CSS_COLORS.muted;
        this.add.text(x + 560, y + 18 + ri * 22, `${r.label}: ${status}`, {
          fontFamily: FONTS.mono, fontSize: '12px', color,
        }).setOrigin(0, 0.5);
      });
    });

    new MenuButton(this, { x: 640, y: 660, width: 320, height: 48, label: 'BACK', onClick: () => this.go(SCENE_KEYS.PLAYER_PROFILE) });
    this.input.keyboard?.once('keydown-ESC', () => this.go(SCENE_KEYS.PLAYER_PROFILE));

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => { this.backdrop?.update(loop.simulationTimeSeconds); this.toast?.update(this.time.now); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsubscribeLoop?.(); this.toast?.destroy(); });
  }
  private go(key: string): void { if (this.starting) return; this.starting = true; getAudioManager(this.game)?.playUi('ui-confirm'); this.cameras.main.fadeOut(220,3,2,6); this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key)); }
}

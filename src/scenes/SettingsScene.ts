import Phaser from 'phaser';

import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import type { GameSettings } from '../progression/PlayerProfile';
import { getOrLoadProfile, persistProfile, resetCachedProfileAndStorage } from '../progression/ProgressionService';
import { emitLoadInfo } from '../progression/ProgressionNotifications';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ProgressionToast } from '../ui/ProgressionToast';
import { CSS_COLORS, FONTS } from '../ui/Theme';

type SettingKey = 'master' | 'music' | 'sfx' | 'mute' | 'reducedMotion' | 'screenShake';

interface RowDef {
  key: SettingKey;
  label: string;
}

const ROWS: RowDef[] = [
  { key: 'master', label: 'Master Volume' },
  { key: 'music', label: 'Music Volume' },
  { key: 'sfx', label: 'SFX Volume' },
  { key: 'mute', label: 'Mute All' },
  { key: 'reducedMotion', label: 'Reduced Motion' },
  { key: 'screenShake', label: 'Screen Shake' },
];

export class SettingsScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private buttons: MenuButton[] = [];
  private toast?: ProgressionToast;
  private resetConfirmPending = false;
  private statusText?: Phaser.GameObjects.Text;
  private settings!: GameSettings;

  constructor() {
    super({ key: SCENE_KEYS.SETTINGS });
  }

  create(): void {
    this.starting = false;
    this.resetConfirmPending = false;
    this.cameras.main.fadeIn(220, 4, 3, 7);
    this.backdrop = new MenuBackdrop(this);
    this.toast = new ProgressionToast(this);
    this.toast.pumpFromQueue(this.time.now);

    const profile = getOrLoadProfile();
    this.settings = { ...profile.settings };
    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(this.settings);

    this.add.text(640, 80, 'SETTINGS', {
      fontFamily: FONTS.display, fontSize: '56px', color: CSS_COLORS.bone, stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(640, 132, 'Audio and accessibility preferences are saved to your profile.', {
      fontFamily: FONTS.body, fontSize: '18px', color: CSS_COLORS.muted, align: 'center', wordWrap: { width: 980 },
    }).setOrigin(0.5);

    this.add.text(640, 162, 'Display uses 16:9 FIT scaling. Controls: P1 WASD+FGTHYQ  •  P2 Arrows+JKOUPI. Match pause: ESC.', {
      fontFamily: FONTS.mono, fontSize: '11px', color: CSS_COLORS.violet, align: 'center', wordWrap: { width: 980 },
    }).setOrigin(0.5);

    const startY = 215;
    const gap = 48;
    ROWS.forEach((row, i) => {
      const btn = new MenuButton(this, {
        x: 640,
        y: startY + i * gap,
        width: 520,
        height: 42,
        label: this.formatRowLabel(row),
        onClick: () => this.adjustSetting(row.key, btn, row),
      });
      this.buttons.push(btn);
    });

    this.statusText = this.add.text(640, 520, '', {
      fontFamily: FONTS.mono, fontSize: '11px', color: '#ffd36e', align: 'center', wordWrap: { width: 900 },
    }).setOrigin(0.5);

    if (import.meta.env.DEV) {
      this.add.text(640, 548, 'Dev-only: reset all local progression/profile data (confirmation required).', {
        fontFamily: FONTS.mono, fontSize: '10px', color: CSS_COLORS.muted,
      }).setOrigin(0.5);
      this.buttons.push(new MenuButton(this, {
        x: 640, y: 585, width: 420, height: 44, label: 'RESET PROGRESSION DATA (DEV)', onClick: () => this.requestReset(),
      }));
    }

    this.buttons.push(new MenuButton(this, { x: 640, y: 645, width: 320, height: 46, label: 'BACK', onClick: () => this.back() }));

    this.input.keyboard?.on('keydown-ESC', this.back, this);
    const unlock = () => getAudioManager(this.game)?.unlock();
    this.input.once('pointerdown', unlock);
    this.input.keyboard?.once('keydown', unlock);

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => {
      this.backdrop?.update(loop.simulationTimeSeconds);
      this.toast?.update(this.time.now);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private formatRowLabel(row: RowDef): string {
    const s = this.settings;
    switch (row.key) {
      case 'master': return `${row.label}: ${Math.round(s.masterVolume * 100)}%`;
      case 'music': return `${row.label}: ${Math.round(s.musicVolume * 100)}%`;
      case 'sfx': return `${row.label}: ${Math.round(s.sfxVolume * 100)}%`;
      case 'mute': return `${row.label}: ${s.muted ? 'ON' : 'OFF'}`;
      case 'reducedMotion': return `${row.label}: ${s.reducedMotion === 'system' ? 'SYSTEM' : s.reducedMotion ? 'ON' : 'OFF'}`;
      case 'screenShake': return `${row.label}: ${s.screenShake ? 'ON' : 'OFF'}`;
    }
  }

  private adjustSetting(key: SettingKey, button: MenuButton, row: RowDef): void {
    const s = { ...this.settings };
    const step = 0.1;
    switch (key) {
      case 'master': s.masterVolume = Math.round((s.masterVolume + step) * 10) / 10 > 1 ? 0 : Math.round((s.masterVolume + step) * 10) / 10; break;
      case 'music': s.musicVolume = Math.round((s.musicVolume + step) * 10) / 10 > 1 ? 0 : Math.round((s.musicVolume + step) * 10) / 10; break;
      case 'sfx': s.sfxVolume = Math.round((s.sfxVolume + step) * 10) / 10 > 1 ? 0 : Math.round((s.sfxVolume + step) * 10) / 10; break;
      case 'mute': s.muted = !s.muted; break;
      case 'reducedMotion': s.reducedMotion = s.reducedMotion === 'system' ? true : s.reducedMotion === true ? false : 'system'; break;
      case 'screenShake': s.screenShake = !s.screenShake; break;
    }
    this.settings = s;
    const profile = getOrLoadProfile();
    profile.settings = { ...s };
    persistProfile(profile);
    const audio = getAudioManager(this.game);
    audio?.attach(this.sound);
    audio?.applySettings(this.settings);
    audio?.playUi('ui-move');
    button.setLabel(this.formatRowLabel(row));
    this.statusText?.setText('Settings saved.');
  }

  private requestReset(): void {
    if (!import.meta.env.DEV) return;
    if (!this.resetConfirmPending) {
      this.resetConfirmPending = true;
      this.statusText?.setText('CONFIRM RESET: click reset again to erase profile, XP, mastery, arcade, achievements, and unlock progress.');
      this.time.delayedCall(4000, () => {
        this.resetConfirmPending = false;
        if (this.statusText?.text.startsWith('CONFIRM RESET')) this.statusText.setText('');
      });
      return;
    }
    this.resetConfirmPending = false;
    resetCachedProfileAndStorage();
    emitLoadInfo('Progression/profile data reset (dev).');
    this.toast?.pumpFromQueue(this.time.now);
    this.statusText?.setText('Progression data reset. Returning to menu...');
    this.time.delayedCall(500, () => this.back());
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
    this.input.keyboard?.off('keydown-ESC', this.back, this);
    this.input.removeAllListeners('pointerdown');
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.toast?.destroy(); this.toast = undefined;
    this.backdrop = undefined;
  }
}

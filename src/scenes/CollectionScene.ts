import Phaser from 'phaser';
import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { UNLOCK_REGISTRY } from '../progression/UnlockRegistry';
import { isContentUnlocked } from '../progression/UnlockSystem';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ProgressionToast } from '../ui/ProgressionToast';
import { CSS_COLORS, FONTS } from '../ui/Theme';

const TYPES: Array<{ key: string; label: string }> = [
  { key: 'FIGHTER', label: 'Fighters' },
  { key: 'ARENA', label: 'Arenas' },
  { key: 'PALETTE', label: 'Palettes' },
  { key: 'VICTORY_POSE', label: 'Victory Poses' },
  { key: 'TITLE', label: 'Titles' },
  { key: 'BADGE', label: 'Badges' },
  { key: 'COSTUME', label: 'Costumes' },
  { key: 'COSMETIC_EFFECT', label: 'Effects' },
];

export class CollectionScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private toast?: ProgressionToast;
  constructor() { super({ key: SCENE_KEYS.COLLECTION }); }
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

    this.add.text(640, 60, 'COLLECTION / UNLOCKS', { fontFamily: FONTS.display, fontSize: '44px', color: CSS_COLORS.bone }).setOrigin(0.5);
    const unlockedCount = profile.unlockedContent.ids.length;
    this.add.text(640, 100, `${unlockedCount} total unlocks  •  Cosmetics/content only, no gameplay advantages`, {
      fontFamily: FONTS.mono, fontSize: '12px', color: CSS_COLORS.violet,
    }).setOrigin(0.5);

    let x = 70;
    let y = 140;
    const colW = 380;
    for (const type of TYPES) {
      const defs = UNLOCK_REGISTRY.filter((d) => d.contentType === type.key);
      if (defs.length === 0) continue;
      if (y > 560) { y = 140; x += colW; }
      this.add.text(x, y, type.label.toUpperCase(), { fontFamily: FONTS.mono, fontSize: '13px', color: CSS_COLORS.bone }).setOrigin(0, 0.5);
      y += 22;
      for (const def of defs) {
        if (y > 620) { y = 140; x += colW; this.add.text(x, y, `${type.label.toUpperCase()} (cont.)`, { fontFamily: FONTS.mono, fontSize: '13px', color: CSS_COLORS.bone }).setOrigin(0, 0.5); y += 22; }
        const unlocked = isContentUnlocked(profile, def.id) || def.defaultUnlocked;
        const status = unlocked ? 'UNLOCKED' : 'LOCKED';
        const color = unlocked ? '#7dffb0' : CSS_COLORS.muted;
        this.add.text(x + 8, y, `${def.displayName} — ${status}`, { fontFamily: FONTS.body, fontSize: '12px', color }).setOrigin(0, 0.5);
        y += 16;
        if (!unlocked) {
          this.add.text(x + 16, y, this.describeCondition(def), { fontFamily: FONTS.mono, fontSize: '10px', color: '#9f89a9', wordWrap: { width: colW - 24 } }).setOrigin(0, 0.5);
          y += 14;
        }
      }
      y += 10;
    }

    new MenuButton(this, { x: 640, y: 670, width: 320, height: 46, label: 'BACK', onClick: () => this.back() });
    this.input.keyboard?.once('keydown-ESC', () => this.back());
    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => { this.backdrop?.update(loop.simulationTimeSeconds); this.toast?.update(this.time.now); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsubscribeLoop?.(); this.toast?.destroy(); });
  }

  private describeCondition(def: { description: string; unlockCondition: { type: string; value?: string | number; characterId?: string; difficulty?: string } }): string {
    const c = def.unlockCondition;
    switch (c.type) {
      case 'MASTERY_LEVEL': return `Req: Mastery Lv ${c.value} (${c.characterId ?? ''})`;
      case 'ARCADE_COMPLETION': return 'Req: Complete any arcade run';
      case 'ARCADE_DIFFICULTY_COMPLETION': return `Req: Complete arcade on ${c.difficulty ?? ''}`;
      case 'ACHIEVEMENT': return `Req: Achievement ${String(c.value ?? '')}`;
      case 'MILESTONE': return `Req: ${String(c.value ?? '')}`;
      default: return def.description;
    }
  }

  private back(): void { if (this.starting) return; this.starting = true; getAudioManager(this.game)?.playUi('ui-confirm'); this.cameras.main.fadeOut(220,3,2,6); this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENE_KEYS.MENU)); }
}

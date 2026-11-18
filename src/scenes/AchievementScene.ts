import Phaser from 'phaser';
import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { ACHIEVEMENT_REGISTRY } from '../progression/AchievementRegistry';
import { getAchievementProgressValue, getAchievementTarget } from '../progression/AchievementSystem';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ProgressionToast } from '../ui/ProgressionToast';
import { CSS_COLORS, FONTS } from '../ui/Theme';

export class AchievementScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private toast?: ProgressionToast;
  constructor() { super({ key: SCENE_KEYS.ACHIEVEMENTS }); }
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

    this.add.text(640, 60, 'ACHIEVEMENTS', { fontFamily: FONTS.display, fontSize: '46px', color: CSS_COLORS.bone }).setOrigin(0.5);
    const completed = profile.achievements.filter(a => a.completed).length;
    this.add.text(640, 102, `${completed}/${ACHIEVEMENT_REGISTRY.length} unlocked`, { fontFamily: FONTS.mono, fontSize: '13px', color: CSS_COLORS.violet }).setOrigin(0.5);

    const startX = 80;
    const colW = 560;
    const rowH = 34;
    const startY = 135;
    ACHIEVEMENT_REGISTRY.forEach((def, i) => {
      const col = i < Math.ceil(ACHIEVEMENT_REGISTRY.length / 2) ? 0 : 1;
      const row = col === 0 ? i : i - Math.ceil(ACHIEVEMENT_REGISTRY.length / 2);
      const x = startX + col * colW;
      const y = startY + row * rowH;
      if (y > 610) return;
      const progress = getAchievementProgressValue(profile, def.id);
      const target = getAchievementTarget(def.id) || def.targetValue || 1;
      const entry = profile.achievements.find(a => a.id === def.id);
      const done = entry?.completed ?? (progress >= target);
      const label = `${def.icon} ${def.name}`;
      const progLabel = done ? 'UNLOCKED' : `${Math.min(progress, target)}/${target}`;
      this.add.text(x, y, label, { fontFamily: FONTS.mono, fontSize: '12px', color: done ? '#7dffb0' : CSS_COLORS.bone }).setOrigin(0, 0.5);
      this.add.text(x + 320, y, progLabel, { fontFamily: FONTS.mono, fontSize: '11px', color: done ? '#7dffb0' : CSS_COLORS.muted }).setOrigin(0, 0.5);
      const desc = def.hidden && !done ? 'Hidden achievement.' : def.description;
      this.add.text(x + 12, y + 14, desc, { fontFamily: FONTS.body, fontSize: '10px', color: CSS_COLORS.muted }).setOrigin(0, 0.5).setAlpha(0.85);
    });

    new MenuButton(this, { x: 640, y: 665, width: 320, height: 46, label: 'BACK', onClick: () => this.go(SCENE_KEYS.PLAYER_PROFILE) });
    this.input.keyboard?.once('keydown-ESC', () => this.go(SCENE_KEYS.PLAYER_PROFILE));
    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => { this.backdrop?.update(loop.simulationTimeSeconds); this.toast?.update(this.time.now); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsubscribeLoop?.(); this.toast?.destroy(); });
  }
  private go(key: string): void { if (this.starting) return; this.starting = true; getAudioManager(this.game)?.playUi('ui-confirm'); this.cameras.main.fadeOut(220,3,2,6); this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key)); }
}

import Phaser from 'phaser';
import { getAudioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../core/GameConfig';
import { getGameLoop } from '../core/GameLoop';
import { getCharacterById } from '../data/CharacterRegistry';
import { getArenaById } from '../data/ArenaRegistry';
import { getPlayerLevelProgress } from '../progression/LevelCurve';
import { getOrLoadProfile } from '../progression/ProgressionService';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { MenuButton } from '../ui/MenuButton';
import { ProgressionToast } from '../ui/ProgressionToast';
import { CSS_COLORS, FONTS } from '../ui/Theme';

export class PlayerProfileScene extends Phaser.Scene {
  private backdrop?: MenuBackdrop;
  private unsubscribeLoop: (() => void) | null = null;
  private starting = false;
  private toast?: ProgressionToast;
  constructor() { super({ key: SCENE_KEYS.PLAYER_PROFILE }); }
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

    this.add.text(640, 70, 'PLAYER PROFILE', { fontFamily: FONTS.display, fontSize: '46px', color: CSS_COLORS.bone }).setOrigin(0.5);

    const prog = getPlayerLevelProgress(profile.totalXP);
    const stats = profile.statistics;
    const wr = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;
    const next = prog.xpForNextLevel == null ? 'MAX' : `${prog.xpIntoLevel}/${prog.xpForNextLevel}`;

    this.add.text(120, 130, [
      `PLAYER LEVEL: ${profile.playerLevel}`,
      `TOTAL XP: ${profile.totalXP}   (Next: ${next})`,
      '',
      `MATCHES: ${stats.totalMatches}   WINS: ${stats.wins}   LOSSES: ${stats.losses}   DRAWS: ${stats.draws}`,
      `WIN RATE: ${wr}%`,
      `DAMAGE DEALT: ${stats.totalDamageDealt}   DAMAGE RECEIVED: ${stats.totalDamageReceived}`,
      `HIGHEST COMBO: ${stats.highestCombo}   COMBOS: ${stats.totalSuccessfulCombos}`,
      `PERFECT GUARDS: ${stats.perfectGuards}   DODGES: ${stats.dodges}   SPECIALS USED: ${stats.specialAttacksUsed}`,
      '',
      `ARCADE STARTED: ${stats.arcadeRunsStarted}   COMPLETED: ${stats.arcadeRunsCompleted}   FAILED: ${stats.arcadeRunsFailed}`,
    ].join('\n'), { fontFamily: FONTS.mono, fontSize: '14px', color: CSS_COLORS.bone, lineSpacing: 8 });

    const favChars = Object.entries(stats.charactersPlayed).sort((a,b)=>b[1]-a[1]).slice(0,4)
      .map(([id,n]) => `${getCharacterById(id)?.displayName ?? id}: ${n}`).join('   ') || 'None yet';
    const favArenas = Object.entries(stats.arenasPlayed).sort((a,b)=>b[1]-a[1]).slice(0,4)
      .map(([id,n]) => `${getArenaById(id)?.name ?? id}: ${n}`).join('   ') || 'None yet';
    const unlockedCount = profile.unlockedContent.ids.length;
    const achDone = profile.achievements.filter(a => a.completed).length;

    this.add.text(120, 420, [
      `MOST PLAYED FIGHTERS: ${favChars}`,
      `MOST PLAYED ARENAS: ${favArenas}`,
      '',
      `UNLOCKED CONTENT: ${unlockedCount}   ACHIEVEMENTS COMPLETED: ${achDone}`,
      `ENDINGS UNLOCKED: ${Object.values(profile.arcadeProgress.endingsUnlocked).filter(Boolean).length}`,
    ].join('\n'), { fontFamily: FONTS.mono, fontSize: '13px', color: CSS_COLORS.muted, lineSpacing: 8, wordWrap: { width: 1040 } });

    // XP bar
    const barX = 120, barY = 170, barW = 520, barH = 12;
    const g = this.add.graphics();
    g.fillStyle(0x2a1828, 1).fillRoundedRect(barX, barY, barW, barH, 4);
    g.fillStyle(0xff2f55, 1).fillRoundedRect(barX, barY, Math.max(4, barW * prog.progress01), barH, 4);
    g.lineStyle(1, 0x4a2a45, 1).strokeRoundedRect(barX, barY, barW, barH, 4);

    new MenuButton(this, { x: 400, y: 640, width: 240, height: 46, label: 'MASTERY', onClick: () => this.go(SCENE_KEYS.MASTERY) });
    new MenuButton(this, { x: 640, y: 640, width: 240, height: 46, label: 'ACHIEVEMENTS', onClick: () => this.go(SCENE_KEYS.ACHIEVEMENTS) });
    new MenuButton(this, { x: 880, y: 640, width: 240, height: 46, label: 'BACK', onClick: () => this.go(SCENE_KEYS.MENU) });
    this.input.keyboard?.once('keydown-ESC', () => this.go(SCENE_KEYS.MENU));

    const loop = getGameLoop(this);
    if (loop) this.unsubscribeLoop = loop.addFixedUpdate(() => { this.backdrop?.update(loop.simulationTimeSeconds); this.toast?.update(this.time.now); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsubscribeLoop?.(); this.toast?.destroy(); });
  }
  private go(key: string): void { if (this.starting) return; this.starting = true; getAudioManager(this.game)?.playUi('ui-confirm'); this.cameras.main.fadeOut(220,3,2,6); this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key)); }
}

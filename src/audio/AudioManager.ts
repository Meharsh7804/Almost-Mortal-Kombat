import type Phaser from 'phaser';
import type { GameSettings } from '../progression/PlayerProfile';
import { getOrLoadProfile } from '../progression/ProgressionService';

export const AUDIO_REGISTRY_KEY = 'riftbound:audio';

type SoundManagerLike = Phaser.Sound.BaseSoundManager & {
  context?: AudioContext;
  unlock?: () => void;
  locked?: boolean;
};

export class AudioManager {
  private sound: SoundManagerLike | null = null;
  private settings: GameSettings;
  private currentMusicKey: string | null = null;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private unlocked = false;
  private readonly lastUiPlayAt = new Map<string, number>();

  constructor(initialSettings?: GameSettings) {
    this.settings = initialSettings ?? getOrLoadProfile().settings;
  }

  attach(sound: SoundManagerLike): void {
    if (this.sound === sound) return;
    this.sound = sound;
    this.applySettings(this.settings);
  }

  getSettings(): GameSettings {
    return { ...this.settings };
  }

  applySettings(settings: GameSettings): void {
    this.settings = { ...settings };
    const s = this.sound;
    if (!s) return;
    try {
      (s as unknown as { mute: boolean }).mute = this.settings.muted;
    } catch {
      /* ignore */
    }
    try {
      (s as unknown as { volume: number }).volume = this.settings.masterVolume;
    } catch {
      /* ignore */
    }
    this.refreshMusicVolume();
  }

  updateSettings(patch: Partial<GameSettings>): GameSettings {
    this.applySettings({ ...this.settings, ...patch });
    return this.getSettings();
  }

  /** Call from a user gesture to satisfy browser autoplay policies. Safe to call repeatedly. */
  unlock(): void {
    const s = this.sound;
    if (!s || this.unlocked) return;
    try {
      const ctx = s.context;
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
      if (typeof s.unlock === 'function') s.unlock();
    } catch {
      // ignore - missing audio/context support is non-fatal
    }
    this.unlocked = true;
  }

  private canPlay(): boolean {
    return !!this.sound && !this.settings.muted && this.settings.masterVolume > 0;
  }

  private effectiveSfxVolume(mult = 1): number {
    return Math.max(0, Math.min(1, this.settings.masterVolume * this.settings.sfxVolume * mult));
  }

  private effectiveMusicVolume(mult = 1): number {
    return Math.max(0, Math.min(1, this.settings.masterVolume * this.settings.musicVolume * mult));
  }

  private hasAudioKey(key: string): boolean {
    const s = this.sound as unknown as { game?: Phaser.Game } | null;
    const cache = s?.game?.cache?.audio;
    if (!cache || typeof cache.exists !== 'function') return false;
    try {
      return cache.exists(key);
    } catch {
      return false;
    }
  }

  playUi(key = 'ui-confirm', minIntervalMs = 40): void {
    this.playSfx(key, { minIntervalMs, volume: 0.7 });
  }

  playSfx(key: string, opts?: { volume?: number; rate?: number; minIntervalMs?: number; detune?: number }): void {
    if (!this.canPlay()) return;
    const s = this.sound;
    if (!s || !this.hasAudioKey(key)) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const minInterval = opts?.minIntervalMs ?? 0;
    if (minInterval > 0) {
      const last = this.lastUiPlayAt.get(key) ?? -Infinity;
      if (now - last < minInterval) return;
      this.lastUiPlayAt.set(key, now);
    }
    try {
      s.play(key, {
        volume: this.effectiveSfxVolume(opts?.volume ?? 1),
        rate: opts?.rate ?? 1,
        detune: opts?.detune ?? 0,
      });
    } catch {
      // missing/invalid asset or decode issue - fail silently
    }
  }

  setMusic(key: string | null, opts?: { loop?: boolean; volume?: number }): void {
    if (key === this.currentMusicKey) {
      this.refreshMusicVolume(opts?.volume);
      return;
    }
    this.stopMusic();
    this.currentMusicKey = key;
    if (!key || !this.canPlay()) return;
    const s = this.sound;
    if (!s || !this.hasAudioKey(key)) return;
    try {
      const music = s.add(key, {
        loop: opts?.loop ?? true,
        volume: this.effectiveMusicVolume(opts?.volume ?? 1),
      });
      this.currentMusic = music;
      music.play();
    } catch {
      this.currentMusic = null;
      // missing/invalid asset - fail silently
    }
  }

  refreshMusicVolume(mult = 1): void {
    const music = this.currentMusic as unknown as { setVolume?: (v: number) => void; volume?: number; pause?: () => void; resume?: () => void; isPaused?: boolean } | null;
    if (!music) return;
    const vol = this.settings.muted ? 0 : this.effectiveMusicVolume(mult);
    try {
      if (typeof music.setVolume === 'function') music.setVolume(vol);
      else if (typeof music.volume === 'number') music.volume = vol;
    } catch {
      // ignore
    }
    if (this.settings.muted || this.settings.masterVolume <= 0 || this.settings.musicVolume <= 0) {
      try {
        music.pause?.();
      } catch {
        /* ignore */
      }
    } else {
      try {
        if (music.isPaused) music.resume?.();
      } catch {
        /* ignore */
      }
    }
  }

  stopMusic(): void {
    if (this.currentMusic) {
      try {
        this.currentMusic.stop();
      } catch {
        /* ignore */
      }
      try {
        this.currentMusic.destroy();
      } catch {
        /* ignore */
      }
    }
    this.currentMusic = null;
    this.currentMusicKey = null;
  }

  destroy(): void {
    this.stopMusic();
    this.sound = null;
    this.lastUiPlayAt.clear();
  }
}

export function getAudioManager(game: Phaser.Game): AudioManager | null {
  const value = game.registry.get(AUDIO_REGISTRY_KEY);
  return value instanceof AudioManager ? value : null;
}

export function ensureAudioManager(game: Phaser.Game): AudioManager {
  let manager = getAudioManager(game);
  if (!manager) {
    manager = new AudioManager(getOrLoadProfile().settings);
    game.registry.set(AUDIO_REGISTRY_KEY, manager);
  }
  return manager;
}

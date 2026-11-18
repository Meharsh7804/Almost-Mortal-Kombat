import type Phaser from 'phaser';
import type { ProgressionNotificationPayload } from '../progression/ProgressionEvents';
import { consumeProgressionNotifications } from '../progression/ProgressionNotifications';
import { CSS_COLORS, FONTS } from './Theme';

interface ToastItem {
  text: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
  expiresAt: number;
}

export class ProgressionToast {
  private readonly scene: Phaser.Scene;
  private readonly items: ToastItem[] = [];
  private readonly baseX: number;
  private readonly baseY: number;

  constructor(scene: Phaser.Scene, baseX = 1040, baseY = 90) {
    this.scene = scene;
    this.baseX = baseX;
    this.baseY = baseY;
  }

  pumpFromQueue(nowMs: number): void {
    const queued = consumeProgressionNotifications();
    for (const n of queued) this.show(n, nowMs);
  }

  show(notification: ProgressionNotificationPayload, nowMs = this.scene.time.now): void {
    const line = this.format(notification);
    if (!line) return;
    const y = this.baseY + this.items.length * 38;
    const text = this.scene.add.text(this.baseX, y, line, {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: CSS_COLORS.bone,
      align: 'right',
      wordWrap: { width: 420 },
    }).setOrigin(1, 0).setDepth(5000).setAlpha(0);
    const bg = this.scene.add.rectangle(text.x - text.width / 2 - 8, text.y + text.height / 2, text.width + 16, text.height + 10, 0x120a18, 0.88)
      .setStrokeStyle(1, 0x4a2a45, 0.8)
      .setDepth(4999)
      .setAlpha(0)
      .setOrigin(0.5);
    this.items.push({ text, bg, expiresAt: nowMs + 3200 });
    this.scene.tweens.add({ targets: [text, bg], alpha: 1, duration: 120 });
    while (this.items.length > 5) {
      const old = this.items.shift();
      old?.text.destroy();
      old?.bg.destroy();
      this.reflow();
    }
  }

  update(nowMs: number): void {
    let changed = false;
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i]!;
      if (nowMs >= item.expiresAt) {
        item.text.destroy();
        item.bg.destroy();
        this.items.splice(i, 1);
        changed = true;
      }
    }
    if (changed) this.reflow();
  }

  destroy(): void {
    for (const item of this.items) { item.text.destroy(); item.bg.destroy(); }
    this.items.length = 0;
  }

  private reflow(): void {
    this.items.forEach((item, i) => {
      const y = this.baseY + i * 38;
      item.text.setY(y);
      item.bg.setY(y + item.text.height / 2);
      item.bg.setSize(item.text.width + 16, item.text.height + 10);
    });
  }

  private format(n: ProgressionNotificationPayload): string {
    switch (n.kind) {
      case 'XP': return `+XP ${n.description ?? ''}`.trim();
      case 'LEVEL_UP': return `LEVEL UP: ${n.description ?? n.title}`;
      case 'MASTERY_UP': return `MASTERY: ${n.description ?? n.title}`;
      case 'ACHIEVEMENT': return `ACHIEVEMENT: ${n.title}`;
      case 'UNLOCK': return `UNLOCK: ${n.description ?? n.title}`;
      case 'ARCADE_STAGE': return n.description ? `ARCADE: ${n.description}` : `ARCADE: ${n.title}`;
      case 'ARCADE_COMPLETE': return n.description ? `ARCADE COMPLETE: ${n.description}` : `ARCADE COMPLETE: ${n.title}`;
      case 'INFO':
      default: return n.description ? `${n.title}: ${n.description}` : n.title;
    }
  }
}

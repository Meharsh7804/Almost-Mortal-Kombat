import type { PlayerProfile } from './PlayerProfile';
import type { ProgressionNotificationPayload } from './ProgressionEvents';

export type NotificationListener = (notification: ProgressionNotificationPayload) => void;

const listeners = new Set<NotificationListener>();
const queue: ProgressionNotificationPayload[] = [];

export function pushProgressionNotification(notification: ProgressionNotificationPayload): void {
  queue.push(notification);
  for (const l of listeners) {
    try { l(notification); } catch { /* ignore listener errors */ }
  }
}

export function pushProgressionNotifications(notifications: readonly ProgressionNotificationPayload[]): void {
  for (const n of notifications) pushProgressionNotification(n);
}

export function consumeProgressionNotifications(): ProgressionNotificationPayload[] {
  const out = [...queue];
  queue.length = 0;
  return out;
}

export function peekProgressionNotifications(): readonly ProgressionNotificationPayload[] {
  return queue;
}

export function subscribeProgressionNotifications(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearProgressionNotificationQueue(): void {
  queue.length = 0;
}

export function emitSaveError(message = 'Could not save progression data.'): void {
  pushProgressionNotification({ kind: 'INFO', title: 'Save Error', description: message });
}

export function emitLoadInfo(message: string): void {
  pushProgressionNotification({ kind: 'INFO', title: 'Progression', description: message });
}

export function summarizeProfile(profile: PlayerProfile): string {
  return `Lv ${profile.playerLevel} • ${profile.statistics.wins}W-${profile.statistics.losses}L`;
}

export type NotificationPermission = 'granted' | 'denied' | 'default';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export class BrowserNotifications {
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  static getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission as NotificationPermission;
  }

  static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
  }

  static async show(options: NotificationOptions): Promise<void> {
    if (!this.isSupported()) {
      console.warn('Browser notifications are not supported');
      return;
    }

    const permission = this.getPermission();

    if (permission === 'denied') {
      console.warn('Notification permission denied');
      return;
    }

    if (permission === 'default') {
      const newPermission = await this.requestPermission();
      if (newPermission !== 'granted') {
        return;
      }
    }

    new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/icon.png',
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
    });
  }

  static showMatchNotification(userName: string, userImage?: string): void {
    this.show({
      title: "It's a Match! 🎉",
      body: `You matched with ${userName}!`,
      icon: userImage,
      tag: 'match',
    });
  }

  static showMessageNotification(
    senderName: string,
    message: string,
    senderImage?: string
  ): void {
    this.show({
      title: `${senderName}`,
      body: message,
      icon: senderImage,
      tag: 'message',
    });
  }
}

export function useNotificationPermission() {
  if (typeof window === 'undefined') return 'denied';
  return BrowserNotifications.getPermission();
}

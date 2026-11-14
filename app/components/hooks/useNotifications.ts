'use client';

import { useSyncExternalStore } from 'react';
import { BrowserNotifications, NotificationPermission } from '@/lib/notifications';

const permissionChanged = 'bondi:notification-permission';

function subscribe(onChange: () => void) {
  window.addEventListener('focus', onChange);
  window.addEventListener(permissionChanged, onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    window.removeEventListener(permissionChanged, onChange);
  };
}

export function useNotifications() {
  const isSupported = useSyncExternalStore(
    subscribe,
    () => BrowserNotifications.isSupported(),
    () => false,
  );
  const permission = useSyncExternalStore<NotificationPermission>(
    subscribe,
    () => BrowserNotifications.getPermission(),
    () => 'default',
  );

  const requestPermission = async () => {
    const newPermission = await BrowserNotifications.requestPermission();
    window.dispatchEvent(new Event(permissionChanged));
    return newPermission;
  };

  const showMatchNotification = (userName: string, userImage?: string) => {
    if (permission === 'granted') {
      BrowserNotifications.showMatchNotification(userName, userImage);
    }
  };

  const showMessageNotification = (senderName: string, message: string, senderImage?: string) => {
    if (permission === 'granted') {
      BrowserNotifications.showMessageNotification(senderName, message, senderImage);
    }
  };

  return {
    permission,
    isSupported,
    requestPermission,
    showMatchNotification,
    showMessageNotification,
  };
}

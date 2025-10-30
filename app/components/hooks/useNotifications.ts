'use client';

import { useState, useEffect } from 'react';
import { BrowserNotifications, NotificationPermission } from '@/lib/notifications';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(BrowserNotifications.isSupported());
    if (BrowserNotifications.isSupported()) {
      setPermission(BrowserNotifications.getPermission());
    }
  }, []);

  const requestPermission = async () => {
    const newPermission = await BrowserNotifications.requestPermission();
    setPermission(newPermission);
    return newPermission;
  };

  const showMatchNotification = (userName: string, userImage?: string) => {
    if (permission === 'granted') {
      BrowserNotifications.showMatchNotification(userName, userImage);
    }
  };

  const showMessageNotification = (
    senderName: string,
    message: string,
    senderImage?: string
  ) => {
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

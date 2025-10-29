import { useState, useEffect } from 'react';

interface StorageValue<T> {
  data: T;
  timestamp: number;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  expirationMinutes: number = 10
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (!item) {
        return initialValue;
      }

      const parsedItem: StorageValue<T> = JSON.parse(item);
      const now = Date.now();
      const expirationTime = expirationMinutes * 60 * 1000;

      if (now - parsedItem.timestamp > expirationTime) {
        window.localStorage.removeItem(key);
        return initialValue;
      }

      return parsedItem.data;
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        const storageValue: StorageValue<T> = {
          data: valueToStore,
          timestamp: Date.now(),
        };
        window.localStorage.setItem(key, JSON.stringify(storageValue));
      }
    } catch (error) {
      console.error(`Error saving localStorage key "${key}":`, error);
    }
  };

  const clearValue = () => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error clearing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, clearValue];
}

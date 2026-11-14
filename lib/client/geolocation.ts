import type { Coordinates } from '@/lib/geolocation';

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (globalThis.isSecureContext === false) {
      reject(new Error('Location requires a secure connection (HTTPS).'));
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      ({ code }) => {
        const message =
          code === 1
            ? 'Location permission denied. Allow location in your browser settings, then try again.'
            : code === 2
              ? 'Your location is unavailable. Try again when your device can determine its location.'
              : code === 3
                ? 'Location request timed out. Please try again.'
                : 'Your location could not be determined. Please try again.';
        reject(new Error(message));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  });
}

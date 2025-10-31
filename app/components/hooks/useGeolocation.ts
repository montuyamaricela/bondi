'use client';

import { useState, useEffect } from 'react';
import { getCurrentPosition, type Coordinates } from '@/lib/geolocation';

export function useGeolocation() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const requestLocation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const coords = await getCurrentPosition();
      setCoordinates(coords);
      return coords;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    coordinates,
    error,
    isLoading,
    requestLocation,
  };
}

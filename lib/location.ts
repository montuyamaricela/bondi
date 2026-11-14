import { calculateDistance, formatDistance, type Coordinates } from './geolocation';
import type {
  CityOption,
  PublicLocation,
  StoredLocation,
} from '@/app/components/features/location/types';

export interface PrivateLocationPoint extends Coordinates {
  source: 'DEVICE' | 'CITY';
}

function validPoint(latitude: number | null, longitude: number | null): boolean {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

export function effectiveLocation(location: StoredLocation): PrivateLocationPoint | null {
  const { latitude, longitude } = location;
  if (
    location.locationMode === 'DEVICE' &&
    location.locationCityId === null &&
    location.locationCity === null &&
    latitude !== null &&
    longitude !== null &&
    validPoint(latitude, longitude)
  )
    return { latitude, longitude, source: 'DEVICE' };
  const city = location.locationCity;
  if (
    location.locationMode === 'CITY' &&
    location.latitude === null &&
    location.longitude === null &&
    city &&
    city.id === location.locationCityId &&
    city.available &&
    validPoint(city.latitude, city.longitude)
  )
    return { latitude: city.latitude, longitude: city.longitude, source: 'CITY' };
  return null;
}

export function cityLabel(city: CityOption): string {
  return [city.name, city.region, city.country].filter(Boolean).join(', ');
}

export function publicLocation(
  target: StoredLocation,
  viewer: PrivateLocationPoint | null = null,
): PublicLocation {
  const point = effectiveLocation(target);
  if (!point) return {};
  const visibleCity =
    target.showCity && target.locationMode === 'CITY' && target.locationCity
      ? { location: cityLabel(target.locationCity) }
      : {};
  if (!target.showDistance || !viewer) return visibleCity;
  const kilometers = calculateDistance(viewer, point);
  const display = formatDistance(kilometers);
  return {
    ...visibleCity,
    distance: Math.round(kilometers),
    distanceLabel:
      point.source === 'CITY' || viewer.source === 'CITY'
        ? `Approximate: ${display}; based on a selected city center`
        : `${display}; estimated from last-known locations`,
  };
}

export function locationPreview(target: StoredLocation) {
  const projection = publicLocation(target);
  return {
    ...(projection.location ? { cityLabel: projection.location } : {}),
    distanceMessage: !effectiveLocation(target)
      ? 'Distance unavailable'
      : target.showDistance
        ? `Distance visible to eligible viewers; ${
            target.locationMode === 'CITY'
              ? 'approximate, based on a selected city center'
              : 'estimated from last-known locations or a selected city center'
          }`
        : 'Distance hidden',
  };
}

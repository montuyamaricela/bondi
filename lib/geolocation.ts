export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function calculateDistance(coords1: Coordinates, coords2: Coordinates): number {
  const R = 6371;

  const dLat = toRadians(coords2.latitude - coords1.latitude);
  const dLon = toRadians(coords2.longitude - coords1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coords1.latitude)) *
      Math.cos(toRadians(coords2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const bounded = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));

  const distance = R * c;

  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function formatDistance(distanceInKm: number): string {
  if (distanceInKm < 1) {
    return 'Less than 1 km away';
  }
  return `${Math.round(distanceInKm)} km away`;
}

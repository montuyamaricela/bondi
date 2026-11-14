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

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  return Math.round(distance);
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function formatDistance(distanceInKm: number): string {
  if (distanceInKm < 1) {
    return 'Less than 1 km away';
  } else if (distanceInKm < 5) {
    return `${distanceInKm} km away`;
  } else if (distanceInKm < 50) {
    return `${distanceInKm} km away`;
  } else {
    return `${distanceInKm}+ km away`;
  }
}

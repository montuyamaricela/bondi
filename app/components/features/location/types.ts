export interface CityOption {
  id: string;
  name: string;
  region: string | null;
  country: string;
  countryCode: string;
}

export type LocationMode = 'OFF' | 'DEVICE' | 'CITY';

export interface CityReference extends CityOption {
  latitude: number;
  longitude: number;
  available: boolean;
}

export interface StoredLocation {
  locationMode: LocationMode;
  latitude: number | null;
  longitude: number | null;
  locationCityId: string | null;
  locationCity: CityReference | null;
  showCity: boolean;
  showDistance: boolean;
}

export interface PublicLocation {
  location?: string;
  distance?: number;
  distanceLabel?: string;
}

export interface LocationOwnerState {
  userId: string;
  mode: LocationMode;
  revision: number;
  deviceUpdatedAt: string | null;
  cityUpdatedAt: string | null;
  city: (CityOption & { available: boolean }) | null;
  legacyLabel: string | null;
  showCity: boolean;
  showDistance: boolean;
  preview: { cityLabel?: string; distanceMessage: string };
}

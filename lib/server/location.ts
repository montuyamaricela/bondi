import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';
import { effectiveLocation, locationPreview } from '@/lib/location';
import type { LocationOwnerState } from '@/app/components/features/location/types';
import { locationMutationSchema } from '@/app/components/features/location/validation';

type ProfileLocation = Prisma.ProfileGetPayload<{ include: { locationCity: true } }>;

export const locationSelect = {
  locationMode: true,
  latitude: true,
  longitude: true,
  locationCityId: true,
  showCity: true,
  showDistance: true,
  locationCity: {
    select: {
      id: true,
      name: true,
      region: true,
      country: true,
      countryCode: true,
      latitude: true,
      longitude: true,
      available: true,
    },
  },
} satisfies Prisma.ProfileSelect;

export function ownerLocation(profile: ProfileLocation): LocationOwnerState {
  const city = profile.locationCity;
  return {
    userId: profile.userId,
    mode: profile.locationMode,
    revision: profile.locationRevision,
    deviceUpdatedAt: profile.lastLocationUpdate?.toISOString() ?? null,
    cityUpdatedAt: profile.cityLocationUpdate?.toISOString() ?? null,
    city: city
      ? {
          id: city.id,
          name: city.name,
          region: city.region,
          country: city.country,
          countryCode: city.countryCode,
          available: city.available,
        }
      : null,
    legacyLabel: profile.location,
    showCity: profile.showCity,
    showDistance: profile.showDistance,
    preview: locationPreview(profile),
  };
}

export async function readOwnerLocation(userId: string) {
  const profile = await db.profile.findUnique({
    where: { userId },
    include: { locationCity: true },
  });
  if (!profile)
    throw createAppError('Complete your profile before saving location.', 404, 'PROFILE_REQUIRED');
  return ownerLocation(profile);
}

export async function updateLocation(
  userId: string,
  payload: unknown,
  showOnlineStatus?: boolean,
): Promise<LocationOwnerState> {
  const input = locationMutationSchema.parse(payload);
  if (input.expectedUserId !== userId)
    throw createAppError(
      'Your account changed. Reload settings before updating location.',
      409,
      'ACCOUNT_CHANGED',
    );
  return db.$transaction(async (transaction) => {
    const current = await transaction.profile.findUnique({
      where: { userId },
      include: { locationCity: true },
    });
    if (!current)
      throw createAppError(
        'Complete your profile before saving location.',
        404,
        'PROFILE_REQUIRED',
      );
    if (current.locationRevision !== input.expectedRevision)
      throw createAppError(
        'Location changed. Refresh saved settings and choose your action again.',
        409,
        'LOCATION_CONFLICT',
      );

    const data: Prisma.ProfileUncheckedUpdateManyInput = {
      locationRevision: { increment: 1 },
      ...(showOnlineStatus === undefined ? {} : { showOnlineStatus }),
    };
    if (input.action === 'DEVICE')
      Object.assign(data, {
        locationMode: 'DEVICE',
        latitude: input.latitude,
        longitude: input.longitude,
        lastLocationUpdate: new Date(),
        locationCityId: null,
        cityLocationUpdate: null,
        location: null,
        showCity: false,
      });
    if (input.action === 'CITY') {
      const city = await transaction.locationCity.findUnique({ where: { id: input.cityId } });
      if (!city) throw createAppError('Select a listed city.', 400, 'INVALID_CITY');
      if (!city.available)
        throw createAppError(
          'This city is unavailable. Select another listed city.',
          400,
          'CITY_UNAVAILABLE',
        );
      Object.assign(data, {
        locationMode: 'CITY',
        locationCityId: city.id,
        cityLocationUpdate: new Date(),
        latitude: null,
        longitude: null,
        lastLocationUpdate: null,
        location: null,
        showCity: current.locationMode === 'CITY' && current.showCity,
      });
    }
    if (input.action === 'CLEAR')
      Object.assign(data, {
        locationMode: 'OFF',
        latitude: null,
        longitude: null,
        lastLocationUpdate: null,
        locationCityId: null,
        cityLocationUpdate: null,
        location: null,
        showCity: false,
        showDistance: false,
      });
    if (input.action === 'VISIBILITY') {
      if (input.showCity && (current.locationMode !== 'CITY' || !effectiveLocation(current)))
        throw createAppError('Select an available city before showing it.', 400, 'CITY_REQUIRED');
      if (input.showDistance && !effectiveLocation(current))
        throw createAppError(
          'Enable device location or select an available city before showing distance.',
          400,
          'LOCATION_REQUIRED',
        );
      if (input.showCity !== undefined) data.showCity = input.showCity;
      if (input.showDistance !== undefined) data.showDistance = input.showDistance;
    }
    const updated = await transaction.profile.updateMany({
      where: { userId, locationRevision: input.expectedRevision },
      data,
    });
    if (updated.count !== 1)
      throw createAppError(
        'Location changed. Refresh saved settings and choose your action again.',
        409,
        'LOCATION_CONFLICT',
      );
    const committed = await transaction.profile.findUniqueOrThrow({
      where: { userId },
      include: { locationCity: true },
    });
    return ownerLocation(committed);
  });
}

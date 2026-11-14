import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';
import { LOCATION_CATALOG_ID, normalizeCityName } from '@/lib/location-catalog';
import type { CityOption } from '@/app/components/features/location/types';

export function citySearchQuery(query: string, country?: string) {
  const prefix = normalizeCityName(query).replace(/[\\%_]/g, '\\$&') + '%';
  return Prisma.sql`SELECT DISTINCT c."id", c."name" COLLATE "C" AS "name",
      c."region", c."country", c."countryCode"
    FROM "LocationCityName" n JOIN "LocationCity" c ON c."id" = n."cityId"
    WHERE c."available" = true AND n."normalizedName" LIKE ${prefix}
    ${country ? Prisma.sql`AND c."countryCode" = ${country}` : Prisma.empty}
    ORDER BY "name", c."id" LIMIT 20`;
}

export async function searchCities(query: string, country?: string): Promise<CityOption[]> {
  const catalog = await db.locationCatalog.findUnique({
    where: { id: LOCATION_CATALOG_ID },
    select: { cityCount: true },
  });
  if (!catalog || catalog.cityCount === 0)
    throw createAppError(
      'City search is temporarily unavailable. Please retry later.',
      503,
      'CITY_CATALOG_UNAVAILABLE',
    );
  return db.$queryRaw<CityOption[]>(citySearchQuery(query, country));
}

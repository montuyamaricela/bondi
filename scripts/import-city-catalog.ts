import { Prisma, PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import snapshot from '../tooling/geonames-snapshot.json';
import { catalogNames, LOCATION_CATALOG_ID, parseCatalogCity } from '../lib/location-catalog';
import { readCatalogFiles } from '../lib/server/location-catalog-source';

async function main() {
  const [sourceFlag, directory, confirmFlag, database, ...extra] = process.argv.slice(2);
  if (
    sourceFlag !== '--source-dir' ||
    !directory ||
    confirmFlag !== '--confirm-database' ||
    !database ||
    extra.length ||
    !process.env.DATABASE_URL
  )
    throw new Error(
      'City import needs --source-dir and --confirm-database with an exported DATABASE_URL',
    );
  if (new URL(process.env.DATABASE_URL).pathname.slice(1) !== database)
    throw new Error('City import database confirmation does not match');

  // Validate every source before starting a transaction; never download implicitly.
  const files = readCatalogFiles(resolve(directory), snapshot.sha256);
  const countries = catalogNames(files['countryInfo.txt'], 'country');
  const regions = catalogNames(files['admin1CodesASCII.txt'], 'region');
  const cities = files['cities500.txt']
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => parseCatalogCity(line, countries, regions));
  if (!cities.length || new Set(cities.map((city) => city.id)).size !== cities.length)
    throw new Error('Invalid city reference row');

  const db = new PrismaClient({ log: [] });
  try {
    await db.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(438714230)`;
        // Retain removed reference rows for existing selections; they require reselection.
        await transaction.locationCity.updateMany({ data: { available: false } });
        await transaction.locationCityName.deleteMany();
        for (let start = 0; start < cities.length; start += 500) {
          const batch = cities.slice(start, start + 500);
          await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "LocationCity" ("id", "name", "region", "country", "countryCode",
            "latitude", "longitude", "available", "sourceVersion") VALUES
          ${Prisma.join(
            batch.map(
              (city) => Prisma.sql`(${city.id}, ${city.name}, ${city.region},
            ${city.country}, ${city.countryCode}, ${city.latitude}, ${city.longitude}, true,
            ${snapshot.version})`,
            ),
          )}
          ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "region" = EXCLUDED."region",
            "country" = EXCLUDED."country", "countryCode" = EXCLUDED."countryCode",
            "latitude" = EXCLUDED."latitude", "longitude" = EXCLUDED."longitude",
            "available" = true, "sourceVersion" = EXCLUDED."sourceVersion"`);
          const names = batch.flatMap((city) =>
            city.names.map((normalizedName) => ({
              cityId: city.id,
              normalizedName,
            })),
          );
          for (let index = 0; index < names.length; index += 2000)
            await transaction.locationCityName.createMany({
              data: names.slice(index, index + 2000),
            });
        }
        await transaction.locationCatalog.upsert({
          where: { id: LOCATION_CATALOG_ID },
          create: {
            id: LOCATION_CATALOG_ID,
            version: snapshot.version,
            checksums: snapshot.sha256,
            cityCount: cities.length,
          },
          update: {
            version: snapshot.version,
            checksums: snapshot.sha256,
            cityCount: cities.length,
            importedAt: new Date(),
          },
        });
      },
      { timeout: 600_000 },
    );
    await db.$executeRaw`ANALYZE "LocationCity"`;
    await db.$executeRaw`ANALYZE "LocationCityName"`;
    console.log(`City reference snapshot ${snapshot.version}: ${cities.length} cities imported.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  const safeMessages = new Set([
    'City import needs --source-dir and --confirm-database with an exported DATABASE_URL',
    'City import database confirmation does not match',
    'City reference checksum mismatch',
    'Invalid city reference names',
    'Invalid city reference row',
    'Invalid city reference alias',
  ]);
  console.error(
    error instanceof Error && safeMessages.has(error.message)
      ? error.message
      : 'City reference setup failed. Check source files and database access.',
  );
  process.exitCode = 1;
});

import { assertTestDatabase } from '../helpers/test-database';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { LOCATION_CATALOG_ID, normalizeCityName } from '../../lib/location-catalog';

test('authenticated city search is bounded, disambiguated, normalized and distinct from unavailable catalog', async ({
  browser,
  baseURL,
}) => {
  assertTestDatabase();
  const db = new PrismaClient();
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.203' },
  });
  const prefix = `zzcity${randomUUID().replaceAll('-', '')}`;
  const idPrefix = `9${String(randomInt(1_000_000)).padStart(6, '0')}`;
  const ids = Array.from(
    { length: 26 },
    (_, index) => `${idPrefix}${String(index).padStart(2, '0')}`,
  );
  let userId: string | undefined;
  let catalogCreated = false;
  let catalogRenamed = false;
  const temporaryCatalogId = `synthetic-${randomUUID()}`;
  try {
    expect((await context.request.get('/api/location/cities?q=Manila')).status()).toBe(401);
    const signup = await context.request.post('/api/auth/sign-up/email', {
      headers: { Origin: baseURL! },
      data: {
        email: `${prefix}@example.test`,
        name: 'Synthetic city search',
        password: 'SyntheticCity43!',
      },
    });
    expect(signup.status()).toBe(200);
    userId = (await signup.json()).user.id;
    if (!(await db.locationCatalog.findUnique({ where: { id: LOCATION_CATALOG_ID } }))) {
      await db.locationCatalog.create({
        data: {
          id: LOCATION_CATALOG_ID,
          version: 'synthetic',
          checksums: {},
          cityCount: ids.length,
        },
      });
      catalogCreated = true;
    }
    await db.locationCity.createMany({
      data: ids.map((id, index) => ({
        id,
        name: `${prefix} São`,
        region: `Region ${String(index).padStart(2, '0')}`,
        country: index === 25 ? 'United States' : 'Philippines',
        countryCode: index === 25 ? 'US' : 'PH',
        latitude: 0,
        longitude: 0,
        available: index !== 24,
        sourceVersion: 'synthetic',
      })),
    });
    await db.locationCityName.createMany({
      data: ids.flatMap((cityId) => [
        { cityId, normalizedName: normalizeCityName(`${prefix} São`) },
        { cityId, normalizedName: normalizeCityName(`${prefix} alternate`) },
      ]),
    });
    const search = (query: string, country = '') =>
      context.request.get(
        `/api/location/cities?q=${encodeURIComponent(query)}${country ? `&country=${country}` : ''}`,
      );
    const all = await search(`  ${prefix.toUpperCase()} SÃO  `);
    expect(all.status()).toBe(200);
    const items = (await all.json()).items;
    expect(items).toHaveLength(20);
    expect(items.map((item: { id: string }) => item.id)).toEqual(ids.slice(0, 20));
    expect(Object.keys(items[0]).sort()).toEqual([
      'country',
      'countryCode',
      'id',
      'name',
      'region',
    ]);
    expect(items[0]).toMatchObject({
      name: `${prefix} São`,
      region: 'Region 00',
      country: 'Philippines',
    });
    expect(items[1]).toMatchObject({ name: `${prefix} São`, region: 'Region 01' });
    expect((await (await search(`${prefix} sao`)).json()).items).toEqual(items);
    expect((await (await search(`${prefix} alternate`)).json()).items).toEqual(items);
    expect(
      (await (await search(prefix, 'us')).json()).items.map((item: { id: string }) => item.id),
    ).toEqual([ids[25]]);
    expect((await (await search(`${prefix}%`)).json()).items).toEqual([]);
    expect((await (await search(`${prefix}_`)).json()).items).toEqual([]);
    expect((await (await search(`${prefix}\\`)).json()).items).toEqual([]);
    expect((await (await search(`${prefix} absent`)).json()).items).toEqual([]);
    expect((await search('x'.repeat(80))).status()).toBe(200);
    for (const query of ['', ' ', 'a', 'x'.repeat(81), '\u0301\u0301', 'a\u0301', 'ab\0', 'ab\ncd'])
      expect((await search(query)).status()).toBe(400);
    for (const query of [
      'q=ab&q=cd',
      'q=ab&country=PH&country=US',
      'q=ab&country=USA',
      'q=ab&userId=other',
    ])
      expect((await context.request.get(`/api/location/cities?${query}`)).status()).toBe(400);

    await db.locationCatalog.update({
      where: { id: LOCATION_CATALOG_ID },
      data: { id: temporaryCatalogId },
    });
    catalogRenamed = true;
    const unavailable = await search(prefix);
    expect(unavailable.status()).toBe(503);
    expect(await unavailable.json()).toMatchObject({ code: 'CITY_CATALOG_UNAVAILABLE' });
    await db.locationCatalog.update({
      where: { id: temporaryCatalogId },
      data: { id: LOCATION_CATALOG_ID },
    });
    catalogRenamed = false;
    expect((await search(prefix)).status()).toBe(200);
    await db.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await search(prefix)).status()).toBe(401);
  } finally {
    await context.close();
    try {
      if (catalogRenamed)
        await db.locationCatalog.update({
          where: { id: temporaryCatalogId },
          data: { id: LOCATION_CATALOG_ID },
        });
      await db.locationCity.deleteMany({ where: { id: { in: ids } } });
      if (catalogCreated)
        await db.locationCatalog.deleteMany({ where: { id: LOCATION_CATALOG_ID } });
      if (userId) await db.user.deleteMany({ where: { id: userId } });
    } finally {
      await db.$disconnect();
    }
  }
});

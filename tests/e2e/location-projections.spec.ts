import { assertTestDatabase } from '../helpers/test-database';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../lib/socket';
import { connect, joinRooms } from './socket-helpers';
import { calculateDistance } from '../../lib/geolocation';

const latitudeFor = (kilometers: number) => (kilometers / 6371) * (180 / Math.PI);
const fields = (name: string, marker: string) => ({
  name,
  age: 28,
  bio: 'Synthetic location projection verification.',
  gender: 'OTHER' as const,
  interests: [marker],
  hobbies: [marker],
  relationshipType: 'FRIENDSHIP' as const,
  genderPreference: 'EVERYONE' as const,
});

async function fixture(browser: Browser, baseURL: string) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-projection`;
  const marker = `shared-${randomUUID()}`;
  const contexts: BrowserContext[] = [];
  const people: string[] = [];
  const cityIds = [0, 1, 2].map((index) =>
    String(900_000_000 + index * 20_000_000 + randomInt(10_000_000)),
  );
  const cityNames = cityIds.map(
    (_, index) => `Synthetic reference ${randomUUID().slice(0, 8)} ${index}`,
  );
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
      await db.locationCity.deleteMany({ where: { id: { in: cityIds }, sourceVersion: prefix } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (let index = 0; index < 2; index++) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${220 + index}` },
      });
      contexts.push(context);
      const signup = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: {
          email: `${prefix}-${index}@example.test`,
          name: `Projection owner ${index}`,
          password: 'SyntheticProjection43!',
        },
      });
      expect(signup.status()).toBe(200);
      people.push((await signup.json()).user.id);
      expect(
        (
          await context.request.post('/api/profile', {
            data: fields(`Projection owner ${index}`, marker),
          })
        ).status(),
      ).toBe(201);
    }
    await db.locationCity.createMany({
      data: cityIds.map((id, index) => ({
        id,
        name: cityNames[index],
        region: `Region ${index}`,
        country: 'Synthetic country',
        countryCode: 'PH',
        latitude: latitudeFor(index === 0 ? 0 : index === 1 ? 2 : 5.4),
        longitude: 0,
        sourceVersion: prefix,
      })),
    });
    const kinds = [
      'city-near',
      'city-winner',
      'missing',
      'device-outside',
      'city-outside',
      'passed',
      'incompatible',
    ];
    const seeded = [...Array.from({ length: 110 }, (_, index) => `decoy-${index}`), ...kinds];
    const ids = Object.fromEntries(seeded.map((kind) => [kind, `${prefix}-${kind}`]));
    await db.user.createMany({
      data: seeded.map((kind) => ({
        id: ids[kind],
        email: `${prefix}-${kind}@example.test`,
        name: `Synthetic ${kind}`,
      })),
    });
    const profiles: Prisma.ProfileCreateManyInput[] = seeded.map((kind) => {
      const decoy = kind.startsWith('decoy-');
      const isCity = kind.startsWith('city-') || kind === 'passed';
      const cityIndex = kind === 'city-near' ? 1 : kind === 'city-outside' ? 2 : 0;
      return {
        ...fields(`Synthetic ${kind}`, decoy ? 'Unshared synthetic decoy' : marker),
        id: `${decoy ? 'aa' : 'zz'}-${prefix}-${kind}`,
        userId: ids[kind],
        locationMode: kind === 'missing' ? 'OFF' : isCity ? 'CITY' : 'DEVICE',
        latitude: kind === 'missing' || isCity ? null : latitudeFor(decoy ? 10 : 5.4),
        longitude: kind === 'missing' || isCity ? null : 0,
        lastLocationUpdate: kind === 'missing' || isCity ? null : new Date(),
        locationCityId: isCity ? cityIds[cityIndex] : null,
        cityLocationUpdate: isCity ? new Date() : null,
        location: kind === 'missing' ? 'Synthetic private unconfirmed label' : null,
        showCity: kind === 'city-winner',
        showDistance: kind !== 'missing',
        genderPreference: kind === 'incompatible' ? 'FEMALE' : 'EVERYONE',
      };
    });
    await db.profile.createMany({ data: profiles });
    await db.like.create({ data: { userId: people[0], targetUserId: ids.passed, action: 'PASS' } });
    return { db, contexts, people, ids, cityIds, cityNames, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('effective origins filter before limiting and serialize only approved location fields across HTTP and live chat', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!);
  const clients: Array<Socket<ServerToClientEvents, ClientToServerEvents>> = [];
  const frames: Array<{ event: string; value: unknown }> = [];
  try {
    const { db, contexts, people, ids, cityIds, cityNames } = owned;
    const change = async (index: number, payload: object) => {
      const state = await contexts[index].request.get('/api/profile/location');
      expect(state.status()).toBe(200);
      const response = await contexts[index].request.patch('/api/profile/location', {
        data: {
          ...payload,
          expectedUserId: people[index],
          expectedRevision: (await state.json()).revision,
        },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    const safe = (value: unknown) => {
      const serialized = JSON.stringify(value);
      expect(serialized).not.toMatch(
        /"(?:latitude|longitude|locationMode|locationRevision|locationCityId|locationCity|city|lastLocationUpdate|cityLocationUpdate|compatibilityScore)"\s*:/,
      );
      for (const id of cityIds) expect(serialized).not.toContain(JSON.stringify(id));
    };
    const feed = async (query = '') => {
      const response = await contexts[0].request.get(`/api/discover${query}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      safe(body);
      return body;
    };
    await change(1, { action: 'DEVICE', latitude: latitudeFor(5), longitude: 0 });
    await change(1, { action: 'VISIBILITY', showDistance: true });
    await db.profile.update({
      where: { userId: people[0] },
      data: { location: 'Synthetic viewer legacy label' },
    });
    expect((await contexts[0].request.get('/api/discover?distance=5')).status()).toBe(422);
    const general = await feed();
    expect(general.some((entry: { userId: string }) => entry.userId === ids.missing)).toBe(true);
    expect(JSON.stringify(general)).not.toContain('Synthetic private unconfirmed label');
    expect(JSON.stringify(general)).not.toContain('Synthetic viewer legacy label');
    await change(0, { action: 'DEVICE', latitude: 0, longitude: 0 });
    expect(
      calculateDistance({ latitude: 0, longitude: 0 }, { latitude: latitudeFor(5), longitude: 0 }),
    ).toBe(5);
    for (const viewerMode of ['DEVICE', 'CITY']) {
      if (viewerMode === 'CITY') await change(0, { action: 'CITY', cityId: cityIds[0] });
      const result = await feed('?distance=5');
      const users = result.map((entry: { userId: string }) => entry.userId);
      expect(users).toContain(people[1]);
      expect(users).toContain(ids['city-near']);
      expect(users).toContain(ids['city-winner']);
      for (const excluded of [
        'missing',
        'device-outside',
        'city-outside',
        'passed',
        'incompatible',
      ])
        expect(users).not.toContain(ids[excluded]);
      const device = result.find((entry: { userId: string }) => entry.userId === people[1]);
      expect(device.distance).toBe(5);
      expect(device.distanceLabel).toMatch(
        viewerMode === 'CITY'
          ? /Approximate:.*selected city center/
          : /estimated from last-known locations/,
      );
      const city = result.find((entry: { userId: string }) => entry.userId === ids['city-near']);
      expect(city.distanceLabel).toMatch(/Approximate:.*selected city center/);
      expect(Object.hasOwn(city, 'location')).toBe(false);
      const sameCity = result.find(
        (entry: { userId: string }) => entry.userId === ids['city-winner'],
      );
      expect(sameCity.distance).toBe(0);
      expect(sameCity.distanceLabel).toMatch(
        /Less than 1 km away; based on a selected city center/,
      );
      expect(sameCity.location).toBe(`${cityNames[0]}, Region 0, Synthetic country`);
    }
    const rawOrder = await db.profile.findMany({
      where: { userId: { not: people[0] } },
      orderBy: { id: 'asc' },
      select: { userId: true },
    });
    expect(rawOrder.findIndex((row) => row.userId === ids['city-winner'])).toBeGreaterThan(100);
    expect(
      (
        await contexts[1].request.post('/api/discover', {
          data: { action: 'LIKE', targetUserId: people[0] },
        })
      ).status(),
    ).toBe(200);
    await change(1, { action: 'CITY', cityId: cityIds[1] });
    const incoming = async () => {
      const response = await contexts[0].request.get('/api/likes/received');
      expect(response.status()).toBe(200);
      const body = await response.json();
      safe(body);
      return body.items.find((entry: { userId: string }) => entry.userId === people[1]);
    };
    expect(Object.hasOwn(await incoming(), 'location')).toBe(false);
    await change(1, { action: 'VISIBILITY', showCity: true, showDistance: false });
    const displayed = (await feed('?distance=5')).find(
      (entry: { userId: string }) => entry.userId === people[1],
    );
    expect(displayed.location).toBe(`${cityNames[1]}, Region 1, Synthetic country`);
    expect(Object.hasOwn(displayed, 'distance')).toBe(false);
    expect(Object.hasOwn(displayed, 'distanceLabel')).toBe(false);
    expect((await incoming()).location).toBe(displayed.location);
    await change(1, { action: 'VISIBILITY', showCity: false });
    expect(Object.hasOwn(await incoming(), 'location')).toBe(false);
    expect(
      Object.hasOwn(
        (await feed('?distance=5')).find((entry: { userId: string }) => entry.userId === people[1]),
        'location',
      ),
    ).toBe(false);
    await change(1, { action: 'VISIBILITY', showCity: true });
    for (const path of ['/api/profile', '/api/profile/with-photos']) {
      const response = await contexts[1].request.get(path);
      expect(response.status()).toBe(200);
      const body = await response.json();
      safe(body);
      expect(body.profile.location).toBe(displayed.location);
    }
    const publicProfile = await contexts[0].request.get(`/api/profile/${people[1]}`);
    expect(publicProfile.status()).toBe(200);
    const publicBody = await publicProfile.json();
    safe(publicBody);
    expect(Object.hasOwn(publicBody.profile, 'location')).toBe(false);

    for (const context of contexts) {
      const response = await context.request.get('/api/socket/token');
      expect(response.status()).toBe(200);
      const { token } = await response.json();
      const client: Socket<ServerToClientEvents, ClientToServerEvents> = io(baseURL!, {
        auth: { token },
        autoConnect: false,
        reconnection: false,
        transports: ['websocket'],
        extraHeaders: { Origin: baseURL! },
      });
      clients.push(client);
      client.onAny((event, value) => frames.push({ event, value }));
      await connect(client);
    }
    const matched = await contexts[0].request.post('/api/discover', {
      data: { action: 'LIKE', targetUserId: people[1] },
    });
    expect(matched.status()).toBe(200);
    const outcome = await matched.json();
    safe(outcome);
    expect(outcome.matched).toBe(true);
    await joinRooms(clients[0], clients[1], outcome.matchId);
    const sent = await contexts[0].request.post('/api/messages', {
      data: {
        matchId: outcome.matchId,
        type: 'TEXT',
        content: 'Synthetic location projection message',
        clientRequestId: randomUUID(),
      },
    });
    expect(sent.status()).toBe(201);
    const message = await sent.json();
    safe(message);
    await expect.poll(() => frames.some((frame) => frame.event === 'message:new')).toBe(true);
    for (const path of [
      '/api/matches',
      `/api/matches/${outcome.matchId}`,
      '/api/matches/conversations',
      `/api/messages?matchId=${outcome.matchId}`,
      '/api/notifications',
    ]) {
      const response = await contexts[0].request.get(path);
      expect(response.status()).toBe(200);
      const body = await response.json();
      safe(body);
      expect(JSON.stringify(body)).not.toMatch(/"location"\s*:/);
      for (const name of cityNames) expect(JSON.stringify(body)).not.toContain(name);
    }
    safe(frames);
    expect(JSON.stringify(frames)).not.toMatch(/"location"\s*:/);
    for (const name of cityNames) expect(JSON.stringify(frames)).not.toContain(name);
    await change(0, { action: 'CLEAR' });
    const afterClear = await feed();
    expect(afterClear.some((entry: { userId: string }) => entry.userId === ids.missing)).toBe(true);
    expect(
      afterClear.every(
        (entry: object) =>
          !Object.hasOwn(entry, 'distance') && !Object.hasOwn(entry, 'distanceLabel'),
      ),
    ).toBe(true);
    expect((await contexts[0].request.get('/api/discover?distance=5')).status()).toBe(422);
    expect((await db.match.findUniqueOrThrow({ where: { id: outcome.matchId } })).status).toBe(
      'ACTIVE',
    );
    expect(await db.message.count({ where: { matchId: outcome.matchId } })).toBe(1);
  } finally {
    for (const client of clients) client.disconnect();
    await owned.close();
  }
});

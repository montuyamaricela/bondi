import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

let fixtureStep = 'preflight';
import {
  artifactRoot,
  client,
  configuration,
  confirmProject,
  digest,
  MigrationError,
  verifyMarker,
  writePrivateJson,
} from './environment';
import { emptyApplication, ledger } from './snapshot';

// Same synthetic credential originally generated with Better Auth 1.3.33 in legacy-auth.spec.ts.
const legacyPassword = 'LegacySyntheticPassword42!';
const legacyHash =
  '1d626081467bc7de53774d4ba1e2e332:67a4de6f08ef0471d48b9bc52ffe2f9eaf44b9aaea0723b15f37a2e9e2ae16a6d8231198075601dd5bbb73b3386b2cc26ea94b7b5632edfe3b751935a3b972da';

async function main() {
  confirmProject(process.argv.slice(2));
  const local = configuration();
  const source = client(local.sourceUrl);
  try {
    await verifyMarker(source, local, 'source');
    await ledger(source);
    await emptyApplication(source);
    const prefix = `bondi-rehearsal-${local.runId}`;
    const userIds = Array.from({ length: 8 }, (_, index) => `${prefix}-user-${index}`);
    const emails = userIds.map((_, index) => `${prefix}-${index}@example.test`);
    const matchId = `${prefix}-active`;
    const endedMatchId = `${prefix}-ended`;
    const clientRequestId = randomUUID();
    const messageId = `${prefix}-message-000`;
    const cityRows = [
      {
        id: '820001',
        name: 'Synthetic Near City',
        region: 'Fixture Region',
        country: 'Philippines',
        countryCode: 'PH',
        latitude: 0,
        longitude: 0.02,
        available: true,
        sourceVersion: 'synthetic-rehearsal-v1',
      },
      {
        id: '820002',
        name: 'Synthetic Unavailable City',
        region: null,
        country: 'Philippines',
        countryCode: 'PH',
        latitude: 0,
        longitude: 20,
        available: false,
        sourceVersion: 'synthetic-rehearsal-v1',
      },
      {
        id: '820003',
        name: 'Synthetic Far City',
        region: 'Fixture Region',
        country: 'Philippines',
        countryCode: 'PH',
        latitude: 0,
        longitude: 30,
        available: true,
        sourceVersion: 'synthetic-rehearsal-v1',
      },
    ];
    await source.$transaction(
      async (tx) => {
        fixtureStep = 'catalog';
        await tx.locationCity.createMany({ data: cityRows });
        await tx.locationCityName.createMany({
          data: cityRows.flatMap((city) => [
            { cityId: city.id, normalizedName: city.name.toLowerCase() },
            { cityId: city.id, normalizedName: `alternate ${city.id}` },
          ]),
        });
        await tx.locationCatalog.create({
          data: {
            id: 'geonames-cities500',
            version: 'synthetic-rehearsal-v1',
            checksums: { syntheticRows: digest(JSON.stringify(cityRows)) },
            cityCount: cityRows.length,
          },
        });
        fixtureStep = 'accounts';
        for (const [index, userId] of userIds.entries()) {
          const city = index === 2 || index === 5;
          const device = index === 0 || index === 1 || index === 3 || index === 6;
          await tx.user.create({
            data: {
              id: userId,
              email: emails[index],
              name: `Migration ${index}`,
              emailVerified: index % 2 === 0,
              createdAt: new Date('2024-01-01T00:00:00Z'),
              accounts: {
                create: {
                  id: `${prefix}-account-${index}`,
                  accountId: userId,
                  providerId: 'credential',
                  password: legacyHash,
                },
              },
              profile: {
                create: {
                  id: `${prefix}-profile-${index}`,
                  name: `Migration ${index}`,
                  age: 28,
                  bio: 'Synthetic populated migration fixture; no real profile data.',
                  gender: 'OTHER',
                  genderPreference: 'EVERYONE',
                  relationshipType: 'SERIOUS',
                  interests: ['Music', 'Science'],
                  hobbies: ['Reading'],
                  lookingFor: 'Synthetic relationship preference',
                  showOnlineStatus: index % 2 === 0,
                  showDistance: (city || device) && index !== 0,
                  showCity: city,
                  locationMode: city ? 'CITY' : device ? 'DEVICE' : 'OFF',
                  locationRevision: index + 7,
                  location: index === 4 ? 'Unconfirmed synthetic legacy area' : null,
                  latitude: device ? 0 : null,
                  longitude: device ? (index === 6 ? 20 : index * 0.01) : null,
                  lastLocationUpdate: device ? new Date('2026-01-01T00:00:00Z') : null,
                  locationCityId: city ? (index === 2 ? '820001' : '820002') : null,
                  cityLocationUpdate: city ? new Date('2026-01-02T00:00:00Z') : null,
                },
              },
              sessions: {
                create: {
                  id: `${prefix}-session-${index}`,
                  token: `${prefix}-synthetic-token-${index}`,
                  expiresAt: index === 7 ? new Date(0) : new Date(Date.now() + 86_400_000),
                },
              },
            },
          });
        }
        fixtureStep = 'files';
        await tx.file.createMany({
          data: [0, 1].map((index) => ({
            id: `${prefix}-file-${index}`,
            userId: userIds[0],
            key: `${prefix}-profile-key-${index}`,
            url: `https://synthetic.example.test/profile-${index}.png`,
            name: `synthetic-${index}.png`,
            size: 128 + index,
            type: 'image/png',
            order: 1 - index,
          })),
        });
        const attachment = await tx.messageAttachment.create({
          data: {
            id: `${prefix}-attachment`,
            userId: userIds[0],
            key: `${prefix}-document-key`,
            url: 'https://synthetic.example.test/document.pdf',
            name: 'synthetic.pdf',
            size: 512,
            type: 'application/pdf',
          },
        });
        fixtureStep = 'matching';
        await tx.like.createMany({
          data: [
            {
              id: `${prefix}-like-a`,
              userId: userIds[0],
              targetUserId: userIds[1],
              action: 'LIKE',
            },
            {
              id: `${prefix}-like-b`,
              userId: userIds[1],
              targetUserId: userIds[0],
              action: 'LIKE',
            },
            { id: `${prefix}-pass`, userId: userIds[0], targetUserId: userIds[6], action: 'PASS' },
          ],
        });
        await tx.match.create({ data: { id: matchId, user1Id: userIds[0], user2Id: userIds[1] } });
        await tx.match.create({
          data: { id: endedMatchId, user1Id: userIds[0], user2Id: userIds[7], status: 'UNMATCHED' },
        });
        fixtureStep = 'messages';
        await tx.message.createMany({
          data: Array.from({ length: 120 }, (_, index) => ({
            id: `${prefix}-message-${String(index).padStart(3, '0')}`,
            matchId,
            senderId: userIds[index % 2],
            content: `Synthetic migrated message ${index}`,
            clientRequestId: index === 0 ? clientRequestId : null,
            createdAt: new Date('2024-02-01T00:00:00Z'),
            readAt: index % 5 === 0 ? new Date('2024-02-02T00:00:00Z') : null,
          })),
        });
        await tx.message.create({
          data: {
            id: `${prefix}-document-message`,
            matchId,
            senderId: userIds[0],
            content: '',
            type: 'FILE',
            fileKey: attachment.key,
            fileUrl: attachment.url,
            fileName: attachment.name,
            fileSize: attachment.size,
            fileType: attachment.type,
            createdAt: new Date('2024-01-31T00:00:00Z'),
          },
        });
        await tx.message.create({
          data: {
            id: `${prefix}-ended-message`,
            matchId: endedMatchId,
            senderId: userIds[7],
            content: 'Synthetic retained ended conversation.',
          },
        });
        fixtureStep = 'notifications';
        await tx.notification.createMany({
          data: [
            ...[0, 1].map((index) => ({
              id: `${prefix}-match-notification-${index}`,
              userId: userIds[index],
              type: 'MATCH' as const,
              entityId: matchId,
              title: 'Synthetic match',
              content: 'Synthetic migrated match',
              isRead: index === 0,
            })),
            {
              id: `${prefix}-message-notification`,
              userId: userIds[1],
              type: 'MESSAGE',
              entityId: matchId,
              title: 'Synthetic message',
              content: 'Synthetic migrated message',
              metadata: { synthetic: true },
              isRead: false,
            },
          ],
        });
        fixtureStep = 'deliveries';
        await tx.messageDelivery.createMany({
          data: [
            { messageId, userId: userIds[0], attempts: 2, nextAttemptAt: new Date(0) },
            {
              messageId,
              userId: userIds[1],
              notificationId: `${prefix}-message-notification`,
              attempts: 1,
              nextAttemptAt: new Date(0),
            },
            {
              messageId: `${prefix}-message-001`,
              userId: userIds[0],
              completedAt: new Date('2024-02-02T00:00:00Z'),
              attempts: 1,
            },
            {
              messageId: `${prefix}-message-002`,
              userId: userIds[1],
              attempts: 4,
              nextAttemptAt: new Date(Date.now() + 3_600_000),
            },
          ],
        });
        fixtureStep = 'leases';
        const leaseId = `${prefix}-lease`;
        await tx.realtimeLease.create({
          data: {
            id: leaseId,
            userId: userIds[0],
            sessionId: `${prefix}-session-0`,
            topic: `bondi:${digest(prefix)}`,
            expiresAt: new Date(Date.now() + 90_000),
            presenceSequence: 7,
            presenceExpiresAt: new Date(Date.now() + 30_000),
          },
        });
        await tx.typingLease.create({
          data: {
            leaseId,
            matchId,
            viewId: randomUUID(),
            sequence: 3,
            expiresAt: new Date(Date.now() + 5000),
          },
        });
        await tx.verification.create({
          data: {
            id: `${prefix}-verification`,
            identifier: `${prefix}-synthetic`,
            value: 'Synthetic verification fixture',
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        });
      },
      { timeout: 30_000 },
    );
    fixtureStep = 'artifact';
    writePrivateJson(resolve(artifactRoot, 'fixture.json'), {
      project: local.project,
      runId: local.runId,
      userIds,
      emails,
      password: legacyPassword,
      matchId,
      endedMatchId,
      messageId,
      clientRequestId,
      messageContent: 'Synthetic migrated message 0',
      cityIds: cityRows.map((city) => city.id),
      historyCount: 121,
    });
    console.log(
      'Explicit synthetic source fixture prepared: 8 accounts, 2 matches, 122 messages, 4 delivery intents and 3 reference cities.',
    );
    console.log('Target application data remains empty; no application traffic started.');
  } finally {
    await source.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error('Synthetic fixture step:', fixtureStep);
  if (error instanceof Error) {
    console.error('Fixture error category:', error.constructor.name);
    const sqlState = /code:\s*"([0-9A-Z]{5})"/.exec(error.message)?.[1];
    if (sqlState) console.error('SQLSTATE:', sqlState);
    const constraint = /constraint "([A-Za-z_][A-Za-z0-9_]*)"/.exec(error.message)?.[1];
    if (constraint?.startsWith('Profile_')) console.error('Profile constraint:', constraint);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    console.error('Database category:', error.code);
  if (error instanceof Prisma.PrismaClientValidationError) {
    const missing = /Argument `([A-Za-z_][A-Za-z0-9_]*)` is missing/.exec(error.message)?.[1];
    console.error(
      'Generated client validation failed.',
      missing ? `Required field: ${missing}` : 'Values omitted.',
    );
  }
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Synthetic rehearsal fixture preparation failed; private diagnostics are omitted.',
  );
  process.exitCode = 1;
});

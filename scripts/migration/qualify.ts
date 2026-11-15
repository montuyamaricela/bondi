import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  artifactRoot,
  client,
  configuration,
  fail,
  readPrivateJson,
  verifyMarker,
  writePrivateJson,
} from './environment';
import { fixture, request, sessions, startQualificationServer } from './runtime';
import { sameSnapshot, snapshot } from './snapshot';
import { assertWriteFence, saveState, transferState } from './transfer';

const baselineFile = resolve(artifactRoot, 'http-baseline.json');
async function readJson(path: string, cookie: string) {
  const response = await request(path, cookie);
  if (response.status !== 200) fail('A preserved authenticated HTTP read failed qualification.');
  return response.json();
}
export async function qualifyReads(role: 'source' | 'target') {
  const state = transferState();
  if (
    !state.source ||
    !state.failureProven ||
    (role === 'target'
      ? state.phase !== 'verified'
      : !['captured', 'rolled-back'].includes(state.phase))
  )
    fail('HTTP qualification cannot select an unverified or writable migration target.');
  const local = configuration();
  const data = fixture();
  const captured = sessions();
  const source = client(local.sourceUrl);
  const target = client(local.targetUrl);
  try {
    await verifyMarker(source, local, 'source');
    await verifyMarker(target, local, 'target');
    assertWriteFence(local.targetUrl);
    if (state.phase !== 'rolled-back') assertWriteFence(local.sourceUrl);
    const inspected = role === 'source' ? source : target;
    const url = role === 'source' ? local.sourceUrl : local.targetUrl;
    if (!sameSnapshot(state.source, await snapshot(inspected, url)))
      fail('HTTP qualification requires the exact captured application data.');
    const server = await startQualificationServer(local, role);
    let reads;
    try {
      const profiles = [];
      for (const item of captured.slice(0, 2)) {
        const response = await readJson('/api/profile', item.cookie);
        if (response.profile?.userId !== item.userId)
          fail('Preserved cookie resolved to a different profile identity.');
        profiles.push(response);
      }
      if (
        (await request('/api/profile', captured[2].cookie)).status !== 401 ||
        (await request('/api/profile')).status !== 401
      )
        fail('Expired or anonymous session obtained a protected migrated profile.');
      const history = [];
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({
          matchId: data.matchId,
          limit: '50',
          ...(cursor ? { cursor } : {}),
        });
        const page = await readJson(`/api/messages?${params}`, captured[0].cookie);
        if (!Array.isArray(page.items) || page.items.length > 50)
          fail('Migrated history lost its bounded page contract.');
        history.push(page);
        cursor = page.nextCursor;
      } while (cursor && history.length < 10);
      if (cursor || history.flatMap((page) => page.items).length !== data.historyCount)
        fail('Migrated cursor history has missing or duplicate rows.');
      const ended = await readJson(
        `/api/messages?matchId=${data.endedMatchId}`,
        captured[0].cookie,
      );
      if (ended.items?.length !== 1) fail('Ended-match read-only history was not preserved.');
      const discovery = await readJson('/api/discover?distance=10', captured[0].cookie);
      const candidates = Array.isArray(discovery) ? discovery : discovery.profiles;
      if (
        !Array.isArray(candidates) ||
        ![data.userIds[2], data.userIds[3]].every((id) =>
          candidates.some((row) => row.userId === id),
        ) ||
        candidates.some((row) =>
          [data.userIds[4], data.userIds[5], data.userIds[6]].includes(row.userId),
        )
      )
        fail('Migrated city/device radius eligibility changed.');
      if (
        candidates.some((row) =>
          ['latitude', 'longitude', 'locationCityId'].some((key) => key in row),
        )
      )
        fail('Migrated discovery exposed private location fields.');
      reads = { profiles, history, ended, discovery };
    } finally {
      await server.stop();
    }
    if (!sameSnapshot(state.source, await snapshot(inspected, url)))
      fail('Read-only qualification changed application state.');
    if (!existsSync(baselineFile)) {
      if (role !== 'source' || state.phase !== 'captured')
        fail('An actual source HTTP baseline is required before target qualification.');
      writePrivateJson(baselineFile, { runId: local.runId, reads });
    } else if (
      JSON.stringify(readPrivateJson(baselineFile)) !==
      JSON.stringify({ runId: local.runId, reads })
    )
      fail('Restored HTTP projections or cursor pages differ from the actual source baseline.');
    if (role === 'target') state.targetHttpProven = true;
    if (role === 'source' && state.phase === 'rolled-back') state.rollbackHttpProven = true;
    saveState(state);
    console.log(
      `${role === 'target' ? 'Read-only target' : state.phase === 'rolled-back' ? 'Rollback source' : 'Failed-transfer source'} HTTP qualification passed: preserved cookies/expiry, profiles, cursor history, ended history and city/device privacy.`,
    );
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

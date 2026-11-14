import { expect } from '@playwright/test';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../lib/socket';
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

export async function connect(client: Client) {
  await new Promise<void>((resolve, reject) => {
    const connected = () => {
      client.off('connect_error', reject);
      resolve();
    };
    client.once('connect', connected);
    client.once('connect_error', reject);
    client.connect();
  });
}

export async function joinRooms(actor: Client, peer: Client, matchId: string) {
  const joined = await Promise.all([
    actor.timeout(5000).emitWithAck('match:join', { matchId }),
    peer.timeout(5000).emitWithAck('match:join', { matchId }),
  ]);
  expect(joined.every(({ ok }) => ok)).toBe(true);
  let actorSawStart = false;
  let peerSawStart = false;
  let actorSawStop = false;
  let peerSawStop = false;
  const actorStart = () => {
    actorSawStart = true;
  };
  const peerStart = () => {
    peerSawStart = true;
  };
  const actorStop = () => {
    actorSawStop = true;
  };
  const peerStop = () => {
    peerSawStop = true;
  };
  actor.on('typing:start', actorStart).on('typing:stop', actorStop);
  peer.on('typing:start', peerStart).on('typing:stop', peerStop);
  try {
    // A round trip proves async room setup is ready, without a timing sleep or repeated writes.
    await expect
      .poll(() => {
        actor.emit('typing:start', { matchId });
        peer.emit('typing:start', { matchId });
        return actorSawStart && peerSawStart;
      })
      .toBe(true);
    actor.emit('typing:stop', { matchId });
    peer.emit('typing:stop', { matchId });
    await expect.poll(() => actorSawStop && peerSawStop).toBe(true);
  } finally {
    actor.off('typing:start', actorStart).off('typing:stop', actorStop);
    peer.off('typing:start', peerStart).off('typing:stop', peerStop);
  }
}

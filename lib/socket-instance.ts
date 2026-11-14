import type { SocketServer } from './socket';

// Next route bundles and the custom server share a process, but not a module cache.
const runtime = globalThis as typeof globalThis & { bondiSocketServer?: SocketServer };

export function setSocketInstance(instance: SocketServer) {
  runtime.bondiSocketServer = instance;
}

export function getSocketInstance(): SocketServer | null {
  return runtime.bondiSocketServer ?? null;
}

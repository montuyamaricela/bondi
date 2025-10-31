import type { SocketServer } from "./socket"

let io: SocketServer | null = null

export function setSocketInstance(instance: SocketServer) {
  io = instance
}

export function getSocketInstance(): SocketServer | null {
  return io
}

'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/app/components/providers/socket-provider';
import type { PresenceStatus, ServerToClientEvents } from '@/lib/socket';

const invisible: PresenceStatus = { visible: false, online: false };

export function useOnlineStatus(userId: string, enabled = true): PresenceStatus {
  const { socket, isConnected } = useSocket();
  const [state, setState] = useState<{
    userId: string;
    connectionId: string | undefined;
    status: PresenceStatus;
  }>({ userId: '', connectionId: undefined, status: invisible });

  useEffect(() => {
    if (!socket || !isConnected || !enabled) return;
    let active = true;
    let revision = 0;
    const connectionId = socket.id;
    const handleUpdate: ServerToClientEvents['presence:updated'] = (update) => {
      if (update.userId !== userId) return;
      revision++;
      setState({
        userId,
        connectionId,
        status: { visible: update.visible, online: update.online },
      });
    };
    socket.on('presence:updated', handleUpdate);
    const snapshotRevision = revision;
    void socket
      .timeout(5000)
      .emitWithAck('presence:sync', { userIds: [userId] })
      .then((result) => {
        if (active && revision === snapshotRevision) {
          setState({
            userId,
            connectionId,
            status: result.ok ? (result.statuses[userId] ?? invisible) : invisible,
          });
        }
      })
      .catch(() => {
        if (active && revision === snapshotRevision)
          setState({ userId, connectionId, status: invisible });
      });
    return () => {
      active = false;
      socket.off('presence:updated', handleUpdate);
    };
  }, [socket, isConnected, userId, enabled]);

  return enabled && isConnected && state.userId === userId && state.connectionId === socket?.id
    ? state.status
    : invisible;
}

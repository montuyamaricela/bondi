import { api, FetchError } from '@/lib/fetch-wrapper';
import type { ChatOwner, TypingInput } from '@/app/components/features/messaging/activity-input';

export function chatAccessDenied(error: unknown) {
  return (
    error instanceof FetchError &&
    ([401, 403].includes(error.status) ||
      (error.status === 409 &&
        !!error.data &&
        typeof error.data === 'object' &&
        'code' in error.data &&
        error.data.code === 'SESSION_CHANGED'))
  );
}

export function expectedChatOwner(owner: ChatOwner) {
  return { expectedUserId: owner.userId, expectedSessionId: owner.sessionId };
}
export function markChatRead(
  matchId: string,
  owner: ChatOwner,
  ids: string[],
  signal: AbortSignal,
) {
  return api.post<{ updated: number; receipts: Array<{ id: string; readAt: string }> }>(
    `/api/matches/${encodeURIComponent(matchId)}/read`,
    { ...expectedChatOwner(owner), ids },
    { signal },
  );
}
export function writeChatTyping(
  matchId: string,
  input: TypingInput,
  options?: { signal?: AbortSignal; keepalive?: boolean },
) {
  return api.post<{ accepted: boolean }>(
    `/api/matches/${encodeURIComponent(matchId)}/typing`,
    input,
    options,
  );
}
export function readChatTyping(matchId: string, owner: ChatOwner, signal: AbortSignal) {
  return api.get<{ typing: boolean; expiresAt: string | null }>(
    `/api/matches/${encodeURIComponent(matchId)}/typing?${new URLSearchParams(expectedChatOwner(owner))}`,
    { signal },
  );
}

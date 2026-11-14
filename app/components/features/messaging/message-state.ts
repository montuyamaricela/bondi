import type { Message } from './types';

export function mergeSavedMessages(matchId: string, ...sources: ReadonlyArray<readonly Message[]>) {
  const messages = new Map<string, Message>();
  for (const source of sources) {
    for (const message of source) {
      if (message.matchId !== matchId) continue;
      const previous = messages.get(message.id);
      const readAt =
        previous?.readAt &&
        (!message.readAt ||
          new Date(previous.readAt).getTime() > new Date(message.readAt).getTime())
          ? previous.readAt
          : message.readAt;
      messages.set(message.id, { ...previous, ...message, readAt });
    }
  }
  return [...messages.values()].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() ||
      left.id.localeCompare(right.id),
  );
}

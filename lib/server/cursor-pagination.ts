import { z } from 'zod';
import { createAppError } from '@/lib/app-error';

const cursorSchema = z
  .object({
    v: z.literal(1),
    scope: z.enum(['messages', 'conversations', 'likes']),
    owner: z.string().min(1).max(128),
    resource: z.string().min(1).max(128).optional(),
    at: z.iso.datetime({ precision: 3 }),
    id: z.string().min(1).max(128),
  })
  .strict();
type Scope = z.infer<typeof cursorSchema>['scope'];

export function readPagination(
  params: URLSearchParams,
  scope: Scope,
  owner: string,
  resource?: string,
) {
  const invalid = () =>
    createAppError('Invalid pagination limit or cursor', 400, 'INVALID_PAGINATION');
  if (['limit', 'cursor'].some((key) => params.getAll(key).length > 1)) throw invalid();
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 50 : /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid();
  const token = params.get('cursor');
  if (token === null) return { limit, cursor: null };
  if (!token || token.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(token)) throw invalid();
  let value: unknown;
  try {
    const decoded = Buffer.from(token, 'base64url');
    if (decoded.toString('base64url') !== token) throw invalid();
    value = JSON.parse(decoded.toString('utf8'));
  } catch {
    throw invalid();
  }
  const parsed = cursorSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.scope !== scope ||
    parsed.data.owner !== owner ||
    parsed.data.resource !== resource ||
    new Date(parsed.data.at).getUTCFullYear() < 1
  )
    throw invalid();
  return { limit, cursor: parsed.data };
}

export type Pagination = ReturnType<typeof readPagination>;

export function nextCursor(
  scope: Scope,
  owner: string,
  row: { id: string; at: Date },
  resource?: string,
) {
  // A cursor is a bookmark, never authorization; each reader checks the current session/resource.
  return Buffer.from(
    JSON.stringify({ v: 1, scope, owner, resource, at: row.at.toISOString(), id: row.id }),
  ).toString('base64url');
}

# Supabase private subscription contract

Enable the staged subscription owner with `NEXT_PUBLIC_SUPABASE_REALTIME=true`,
`NEXT_PUBLIC_SUPABASE_URL` and a public `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Keep `SUPABASE_SECRET_KEY` and `SUPABASE_SIGNING_KEYS_PATH` server-only. The latter
points to a JSON array of private ES256/P-256 JWKs containing `kid`, `alg`, `d`,
`x`, `y` and `crv`. The first key signs new credentials. Keys and credentials must
never be logged, committed, copied into NEXT_PUBLIC settings or persisted in
browser storage. The public URL/key are the only public configuration.

Import the corresponding signing key into the explicitly selected Supabase
project before enabling the owner. A Supabase-generated private key cannot be
exported for the application; use the supported imported-signing-key workflow.
Provisioning a hosted target is separate from this code change. Better Auth,
Prisma and UploadThing continue to own authentication, application data and media.

`POST /api/realtime/credential` requires the live cookie session and JSON
`expectedUserId`, `expectedSessionId`, optionally the owned `leaseId` for renewal.
It returns no-store `{userId, sessionId, leaseId, topic, expiresAt, token}`.
Requests cannot select another owner. Expired leases require a fresh allocation;
missing/revoked sessions cannot renew or join. `DELETE` with the same owner/lease
closes it. Disconnect cleanup is best-effort; expiry and session checks remain
authoritative when a browser crashes or a response arrives after logout.
The database guard compares Prisma's UTC timestamps explicitly in UTC, independently
of the connection time zone, and rejects missing or malformed credential expiry.

The browser renews 30 seconds before expiry, also revalidates on focus, and keeps
one channel on same-session refresh. A failed renewal disconnects cached native
authorization and retries at most five times; focus can initiate another bounded
attempt. Account/session replacement aborts pending work and removes all owned
channels, listeners and timers. Late response parsing cannot create a new client.
No credential is retained in localStorage. See the [decision](adr/0001-session-owned-realtime.md)
for cached authorization limits and the no-private-payload rule.

## Durable message hints

With native mode enabled, HTTP and retained socket send commands share one database
transaction for the message, trusted attachment reference, receiver notification and
per-user `MessageDelivery` intents. An identified retry returns the canonical message.
Native delivery includes every currently valid session of both participants, including
the sender; query reconciliation uses saved IDs rather than excluding a socket ID.

The app-owned `bondi_private.dispatch_message_hints(text)` function checks active
membership and live sessions/leases before calling supported `realtime.send` inside
the transaction. Native Broadcast payloads contain only a random `id` identifying the
hint, never a message, match, account, location or notification identifier. Other server
invalidation hints may have an empty payload. Authorized HTTP reads supply all data.
Because `realtime.send` warns and returns on insert failure, the dispatcher verifies
that its opaque hint was inserted before completing that intent.

The `bondi-message-delivery` pg_cron job runs once per second. Each invocation claims
at most 100 due intents with `FOR UPDATE SKIP LOCKED`. A failed intent rolls back its
native enqueues, increments `attempts` and reschedules with exponential backoff capped
at 60 seconds; other intents continue. Pending work survives application/job restart.
No network request runs while holding these database locks. Monitor pending count,
oldest pending age, attempts and the owned cron job's failures; enqueue completion
does not prove browser receipt or display. Ended matches and absent/expired audiences
complete without publishing: bounded HTTP refetch repairs missed hints on reconnect.

Notification queries are scoped to the current account/session. The initial snapshot
establishes a baseline without replaying historical browser notifications; subsequent
new unread message rows notify once per mounted owner, respecting browser permission
and saved preferences. The API marks notification effects eligible only for active
owned matches. Repeated hints still refresh durable state without repeating effects.
This is not a guarantee of exactly-once operating-system notifications across tabs,
browser restarts or more than the bounded notification window.

When an older message page is in flight, a hint fetches a separate bounded latest
page and merges overlapping saved rows without cancelling pagination. If that
latest window has no overlap, it replaces the obsolete window with its own cursor
so intervening history remains reachable rather than appearing as a false gap.
The subscription owner aborts these reads on cleanup and ignores late responses.

Apply Prisma migrations explicitly to the known target before enabling native mode
and building the app. Writes reject a mismatch between the selected mode and the
installed dispatcher. On ordinary PostgreSQL the additive migration installs only
the retry columns/index; the existing relay remains until its retirement ticket.
On native Supabase it also installs the private function and managed cron job. The
three legacy socket owners disable their message relay in native mode; commands and
other socket features remain temporarily for the dependent migration tickets.

Retention is operator-managed in this slice. After seven days, completed intents may
be removed in bounded batches using the server connection; pending work must remain:

```sql
WITH expired AS (
  SELECT "messageId", "userId" FROM public."MessageDelivery"
  WHERE "completedAt" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '7 days'
  ORDER BY "completedAt" LIMIT 1000 FOR UPDATE SKIP LOCKED
)
DELETE FROM public."MessageDelivery" d USING expired e
WHERE d."messageId" = e."messageId" AND d."userId" = e."userId";
```

This does not remove messages, idempotency keys or notifications. Separately retain
only the required history for this owned job in `cron.job_run_details` (filter by
its job ID, completed status/end time, and a bounded batch); do not prune other
applications' job history. Supabase owns retention of its native Broadcast records.

References: [database Broadcast](https://supabase.com/docs/guides/realtime/broadcast),
[native send implementation](https://github.com/supabase/realtime/blob/main/priv/repo/tenant_schema/realtime/functions/send.sql),
[managed Cron](https://supabase.com/docs/guides/cron/quickstart).

## Signing-key rotation

Import a new standby ES256 key through Supabase's supported signing-key settings.
Verify it is advertised/accepted by the selected project's native endpoints before
moving it to the first position in the server's private JWK array. Keep the
previous key trusted throughout the maximum 90-second credential lifetime plus
deployment/clock allowance. Supabase's JWKS edge/client caches can persist for
minutes: observe the provider's current rotation procedure and verify acceptance,
rather than assuming a key-file edit immediately changes native trust. Revoke an
old key only after native tests prove the new key works and old credentials have
expired. Emergency revocation and production changes require the recorded target.

The explicit local test preparation creates one active private signer and one
verification-only overlap key (`key_ops: ["verify"]`), imports them
through `auth.signing_keys_path`, and never rotates an existing file on startup.
Native Auth rejects multiple keys advertising signing capability. The second key
is accepted for verification so old/external credentials can overlap during rotation.
Native tests verify both trusted keys, unknown-key denial, wrong issuer/audience,
expired/revoked sessions, outsider topics and client publishing denial.

References: [custom JWTs](https://supabase.com/docs/guides/auth/jwts),
[signing keys](https://supabase.com/docs/guides/auth/signing-keys),
[private channel authorization](https://supabase.com/docs/guides/realtime/authorization).

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
at most 100 due intents with `FOR UPDATE SKIP LOCKED`. New intent timestamps truncate
to milliseconds so column rounding cannot place them after their accepting
transaction's clock. A failed intent rolls back its
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

## HTTP chat commands and typing

In native mode, chat sends, read receipts and typing use HTTP. A subscription outage
does not disable durable sending: the accepted HTTP response supplies the canonical
saved row, while private hints and authorized history repair missed updates.
`Retry live updates` replaces the owned subscription; an expired/replaced session
or denied match stops restricted actions and offers `Refresh chat`.

Native message POSTs include `expectedUserId` and `expectedSessionId` with the
existing content, optional owned file key and stable `clientRequestId`. GET history
binds the same expected owner. A stale cookie/owner combination returns 409 without
writing or returning another owner's result. Legacy requests without these fields
remain supported for the outgoing transport. A failed/unconfirmed attempt keeps
the draft and operation ID for manual retry; no invalid mutation retries
automatically. Only the accepted current account/session/conversation/draft
generation clears. Native message cache keys also include the account/session.

`POST /api/matches/:matchId/read` requires those owner fields and 1–100 raw `ids`.
All IDs must belong to this match; a mixed foreign batch fails atomically. Own-sent
rows are ignored. Incoming unread rows receive one monotonic server timestamp;
replays retain it. The bounded response contains `{updated, receipts:[{id,readAt}]}`.
The browser marks mounted, visible history and merges canonical receipts by ID.
Read receipts and typing require a live session and active membership every time;
ended-match history remains readable without communication writes.

`GET /api/matches/:matchId/typing` requires the two expected owner query parameters
and returns only `{typing, expiresAt}` for the active peer. POST requires the owner,
owned live `leaseId`, a chat-view UUID `viewId`, positive integer `sequence` and
boolean `typing`. Client actor/timestamp/expiry fields are rejected. The server
caps typing at five seconds and at the subscription/session expiry. Newer sequences
replace older ones; a delayed start cannot override a newer stop. Multiple views
combine using their effective expiry, without exposing peer session/device IDs.

Typing sends are throttled to at most one start per second, stop after two seconds
of idle input, and stop on send, hidden document, unmount or connection cleanup.
The peer clears the indicator on the returned expiry even if a stop hint is missed.
Abrupt loss therefore has a five-second typing bound; it is not instant disconnect
detection. Only current ephemeral state and ordering markers are stored; there is
no typing text or activity log.

Private `TypingLease` rows retain ordering markers until their parent capability
expires, preventing a delayed request from recreating a stopped view. Lease deletion
cascades them. The owned `bondi-typing-retention` cron job removes at most 1000 rows
per minute for expired capabilities/sessions, skipping locked rows and parents so
renewal cannot lose ordering state. Typing writes hold the owned lease while
checking/updating state. All HTTP writes serialize with unmatch; network publishing
runs after the transaction. Lost receipt/typing hints repair through authorized
current-state reads; they do not change already-persisted read receipts.

The explicit ordinary-PostgreSQL UI still uses its legacy commands until retirement.
This is a staged transition, with no automatic transport fallback or replacement
event framework.

## Native presence, privacy and unmatch

Native online status uses authenticated HTTP and server-owned liveness; raw peer
Supabase Presence is neither published nor consumed. Each tab starts heartbeats only
after its own private subscription reports `SUBSCRIBED`. Credential issuance alone
does not mark a tab online. A signed-in client can keep its own liveness current;
it cannot assert another actor, a deadline or a visibility preference.

`POST /api/presence` requires `expectedUserId`, `expectedSessionId`, owned live
`leaseId` and positive integer `sequence`. The server locks that lease, checks its
current session and computes `min(now + 60 seconds, lease expiry, session expiry)`.
DELETE uses the same input to clear liveness. Only a higher sequence wins; retained
ordering state prevents delayed heartbeats from undoing newer leave requests.
The existing private table RLS/grants cover both fields, and deleting a lease/session
removes its liveness. No last-seen, location heartbeat or activity history is added.

The browser refreshes about every 20 seconds, with a five-second request timeout.
Its owner aborts requests and clears timers on disconnect/account change/cleanup,
sends best-effort keepalive leave on pagehide, and resumes after page restoration.
Late completions cannot update the next owner or restart an abandoned timer.
Credential responses also contain a narrowly scoped `closeToken`, kept only by the
subscription owner. A cookie can change before old cleanup runs, so credential
DELETE accepts either its current cookie owner or this signed close capability.
It is bound to the exact user, session and lease with a domain-separated HMAC under
the server auth secret, checked in constant time. It can only delete that lease;
it cannot renew credentials, heartbeat, read data, send messages or close a new
lease. Replays after deletion are idempotent and publish no additional peer hints.
This lets an account/session switch promptly retract the retired owner's liveness
without treating a stale cookie as authorization. Auth-secret rotation invalidates
old cleanup capabilities; the bounded liveness deadline still applies.
Network/server failures visibly degrade and can recover; rejected identity, session,
lease or payload stops automatic heartbeat attempts. `Retry online status` rebuilds
the owned subscription. Subscription readiness and heartbeat success are distinct.

`POST /api/users/presence` requires the expected owner and at most 100 raw `userIds`.
It returns only `{[requestedUserId]: {visible, online}}`. Current active membership,
the target's online-visibility preference, valid sessions and unexpired liveness
all apply on every snapshot. Non-peers/ended matches/hidden profiles return false
booleans. The compatibility `/api/users/online-status` response remains boolean-only;
native configuration uses the same authoritative liveness source. No observer gets
peer lease, device, session or raw Presence metadata.

Private empty hints trigger authorized snapshots after liveness transitions,
privacy changes and session deletion (including normal sign-out/revocation). Unmatch
refreshes both former participants after the single durable transition, even though
the active edge is gone. Missed hints cannot disclose new state: each subsequent
HTTP read independently authorizes. Both open chats become read-only; permitted
history remains and receipt/typing/send operations reject an ended match.

Online-status query keys include account/session ownership, consume abort signals
and cancel older reads before confirmed transition refreshes. A held older privacy
response cannot restore status. Observers poll every 15 seconds with a five-second
request limit, and hide failed/disconnected/hidden snapshots. Focus/visibility
changes reset cached snapshots before revalidation. Refresh errors show a degraded
status and explicit retry, rather than presenting a reliable offline assertion.
An independent 20-second snapshot-age timer also retracts online status if repeated
hints keep cancelling reads before their request timeouts. Fresh authorized results
restore the indicator; cancelled reads cannot extend its display indefinitely.

Abrupt loss can leave a tab online for up to its 60-second server lease, plus up to
15 seconds for an active observer's next poll and five seconds for the read. This
gives an 80-second active-observer bound under a functioning server; background
browser suspension has no timer guarantee, and resuming must revalidate. Graceful
leave normally refreshes promptly. Native transport loss and controlled expiry/
polling are tested separately from a full wall-clock-duration outage rehearsal.
Legacy Socket.IO handlers remain only for the explicit outgoing transport until
their removal ticket; native UI does not use their presence/leave commands.

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

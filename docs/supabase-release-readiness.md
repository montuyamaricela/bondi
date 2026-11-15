# Supabase release readiness

The Database + Realtime implementation is complete in the
[#74 workstream](https://github.com/montuyamaricela/bondi/issues/74). Standard Next
serves HTTP; Supabase owns PostgreSQL and private live delivery. Better Auth,
Prisma and UploadThing retain authentication, schema and media ownership.
This records local/CI qualification, not a production deployment. The final
[#83 PR](https://github.com/montuyamaricela/bondi/issues/83) and its exact-head CI
own the final revision and results.

## Evidence and acceptance map

- [#75 / PR #84](https://github.com/montuyamaricela/bondi/pull/84): separate runtime
  and direct/session migration connections, redacted configuration failures and
  server/browser boundaries. Current `environment.test.ts` and the configuration
  owners retain these assertions. Retired socket configuration was subsequently
  removed by #81. Public key classification also rejects privileged legacy JWTs;
  Next validates the same configuration before build or server startup.
- [#76 / PR #85](https://github.com/montuyamaricela/bondi/pull/85): explicit pinned
  local preparation, actual disposable target marker, private app-table RLS/grants,
  denied anonymous and authenticated Data API access. Native tests fail without
  their stack. Ordinary PostgreSQL remains schema/build/unit evidence only.
- [#77 / PR #86](https://github.com/montuyamaricela/bondi/pull/86): imported ES256
  keys, retained text account IDs, owned receive-only capabilities, actual join/
  publish denials and live-session revocation. Lifecycle tests cover delayed
  fetch/body parsing, cookie changes, same-session renewal and replacement.
- [#78 / PR #87](https://github.com/montuyamaricela/bondi/pull/87): transactional
  message/attachment/notification/intents, canonical retries and managed bounded
  dispatch. Actual private subscribers, failure injection, relay pause/restart,
  off-room inboxes, duplicate hints and concurrent claims verify the boundary.
- [#79 / PR #88](https://github.com/montuyamaricela/bondi/pull/88): HTTP sends,
  monotonic bounded reads, ephemeral ordered typing and populated-history repair.
  Native browsers verify sending during live-update loss, manual recovery and
  late responses that cannot clear another account's draft.
- [#80 / PR #89](https://github.com/montuyamaricela/bondi/pull/89): sequenced
  multi-tab liveness, visibility/active-match authorization, close-capability
  cleanup, rejected renewal, stale snapshots and both open chats after unmatch.
  Controlled deadlines and real connection loss are distinct evidence.
- [#81 / PR #90](https://github.com/montuyamaricela/bondi/pull/90): no old process,
  dependency, flag, token route or handshake. The build guard inspects runtime
  source, lockfile and generated server/browser JavaScript. Actual browsers assert
  zero retired requests, positive native connections and old endpoints returning 404. [The coverage map](realtime-retirement.md) preserves former assertions.
- [#82 / PR #91](https://github.com/montuyamaricela/bondi/pull/91): PostgreSQL 14.25
  to native Supabase PostgreSQL 17.11 with 23 immutable migrations and all 18
  application-table counts/full-content fingerprints preserved. Genuine cookies,
  legacy passwords, location modes/revisions, gallery order, idempotency, cursor
  history and two original pending deliveries were exercised after transfer.
  A post-copy SQL failure leaves no partial target; before-write rollback and
  eight negative guards passed. [The runbook](migration-rehearsal.md) owns commands.

CI starts from a clean checkout and `npm ci`, explicitly prepares/migrates its own
native stack, then runs strict checks/build, all retained application cases and
the native permission suite. A third job independently executes the entire
populated migration/failure/rollback sequence. No global agent skill or MCP is
required. All three jobs must pass at the exact proposed PR head before merge.
The final issue report records commit metadata, merge trees and post-push main pulls.

## Observed behavior and operational checks

Local #82 evidence: 83 unit/harness cases, 72 retained browser/API cases, 26 native
cases and two populated-migration cases passed. The read-only native security
advisor reported no issues. Final #83 results belong to its PR; earlier counts do
not substitute for rerunning the required final gate.

A read-only snapshot of the idle synthetic rehearsal target observed 12 database
connections (one active, zero idle in transaction), 10 delivery intents, one pending
and zero due. That pending intent is the deliberately future-scheduled backoff
fixture, not a stuck relay. Both owned cron jobs were active: 2,774 delivery runs
and 47 typing-retention runs had zero job-level failures. This is an observation,
not a load test, capacity guarantee or production service-level objective.

Actual subscribers assert empty hints or a sole random UUID `id`; the application
JSON payload is therefore 2 or 45 bytes, excluding transport wrappers. No profile,
message, account/match identifier, exact point or private city association is
carried. Authorized REST reads and negative Data API tests verify the omissions;
UI hiding is insufficient.

On an approved server connection, collect aggregate delivery state without row IDs
or contents:

```sql
SELECT count(*) FILTER (WHERE "completedAt" IS NULL) AS pending,
  count(*) FILTER (WHERE "completedAt" IS NULL
    AND "nextAttemptAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AS due,
  max(extract(epoch FROM ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - "createdAt")))
    FILTER (WHERE "completedAt" IS NULL
      AND "nextAttemptAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AS oldest_due_seconds,
  max(attempts) FILTER (WHERE "completedAt" IS NULL) AS max_pending_attempts
FROM public."MessageDelivery";

SELECT j.jobname, j.active, count(d.runid) AS recent_runs,
  count(d.runid) FILTER (WHERE d.status = 'failed') AS recent_failures
FROM cron.job j
LEFT JOIN cron.job_run_details d ON d.jobid = j.jobid
  AND d.start_time > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
WHERE j.jobname IN ('bondi-message-delivery', 'bondi-typing-retention')
GROUP BY j.jobname, j.active;

SELECT count(*) AS connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction
FROM pg_stat_activity WHERE datname = current_database();
```

Track due count/age and attempt deltas as well as cron failures: an individual
intent can retry while its cron invocation succeeds. Investigate inactive/missing
owned jobs and sustained increases relative to measured traffic. Enqueue completion
does not prove receipt/display. Use redacted HTTP request IDs, connection status,
bounded timings and aggregate counts. Do not export raw SQL, cron return messages,
JWTs, cookies, channel topics, private rows or location values into monitoring.
Choose alert thresholds from the approved target's measured baseline; none are
claimed from this idle sample. No monitoring SaaS is required by this change.

The managed dispatcher claims at most 100 due intents per invocation, skips locks
and backs off at most 60 seconds. HTTP writes remain authoritative during live
outages; reconnect refetches bounded canonical history. Typing expires in five
seconds. Presence uses a 60-second server deadline and an 80-second active-observer
bound under a functioning server; suspended browsers revalidate on resume. Tests
exercise real disconnect/reconnect and controlled expiry, not a full-duration
production outage. [Realtime operations](realtime.md) owns these limits, bounded
completed-intent/job-history retention and the imported-key overlap/rotation steps.
Pending work is never pruned. Never stop/prune another project's resources.

## Production go/no-go checklist

Production is **not migrated**. No Bondi hosted organization/source/target or
provisioning cost was approved. Do not reuse an unrelated connected project.

- [ ] Record the approved organization/project, source and target identities,
      ownership, region, costs, release revision, maintenance window and recovery
      decision owner. Inventory data/media size, roles/extensions, schema/ledger,
      collation/encoding/time zones and compatible client/server versions.
- [ ] Take private application/schema/configuration/release and media backups;
      verify restore. Prepare native target policy/grants/jobs and import signing
      keys separately. The local operator intentionally rejects hosted URLs;
      qualify any hosted procedure separately instead of bypassing its guard.
- [ ] Qualify a disposable native target at the release revision with all three
      CI jobs and the [populated runbook](migration-rehearsal.md). Preserve existing
      account IDs/hashes, cookie secret/origin compatibility, ledger, reference
      catalog, location revisions/privacy, attachments and pending delivery work.
- [ ] Configure the host's private secrets and direct/session migration connection;
      supply only publishable/legacy-anon public keys. Build with final HTTPS/app/
      Supabase origins. Verify imported signing-key acceptance before traffic.
      Apply reviewed migrations explicitly, never during build/test/start.
- [ ] Stop/drain old writers and pause only owned relay jobs. Fence both sides,
      capture/verify the application-only backup, restore transactionally and
      compare complete counts/content/constraints/ledger and authenticated
      read-only behavior. Keep target traffic disabled on any failed comparison.
- [ ] Rehearse source rollback before accepting target writes. Explicitly approve
      target acceptance, keep the source fenced and resume only target-owned jobs.
      Route traffic to standard Next and verify HTTPS/cookies, existing login,
      revocation, profiles/photos, location/radius/privacy, matching, both inboxes,
      send/retry/history/read/typing, multi-tab presence, unmatch and private native
      delivery with synthetic users. Qualify real UploadThing completion separately.
- [ ] Record actual release/target/time, queue/connection/cron observations and
      expected private payload omissions. Exercise disconnect/reconnect and
      signing-key overlap at that target, retain evidence and monitor the window.
      Rotate/revoke old keys only after verified acceptance and expiry/cache overlap.
- [ ] If a failure occurs after accepted writes, stop writers, preserve both
      datasets and reconcile the accepted-write interval under a reviewed recovery
      plan. A code revert or automatic source switch loses changes. Decide any
      restore-point data loss explicitly; keep recovery artifacts through the window.

External upload delivery/webhooks, physical GPS, other browsers/devices, hosted
capacity and production traffic remain unqualified. Supabase Auth/Storage replacement
is a separate product decision and is not included in this completed phase.

# Populated migration and rollback rehearsal

[#82](https://github.com/montuyamaricela/bondi/issues/82) provides a guarded,
reproducible PostgreSQL-to-Supabase rehearsal with synthetic data. Better Auth,
Prisma and UploadThing retain their ownership. Hosted production transfer requires
a separately approved organization, source, target and maintenance window. These
commands accept only their identified disposable local resources; they never use
the application's ambient `DATABASE_URL` as a migration target.

## Local preparation

Use repository Node/npm versions, Docker and the pinned Supabase CLI installed by
`npm ci`. Use PostgreSQL 17 `pg_dump` and `psql`; set `BONDI_PG_BIN` to their directory
if another version is on PATH. CI installs those clients from the official signed
[PostgreSQL repository](https://www.postgresql.org/download/linux/ubuntu/).

The isolated project is `bondi-migration-rehearsal`: API 54331, PostgreSQL 17 database
54332, reserved shadow port 54330. Its PostgreSQL 14.25 source is
`bondi_migration_source_test` on 127.0.0.1:54329, using the pinned
`postgres:14.25-bookworm` image. The ordinary `bondi-integration` stack is separate.
Occupied ports or unknown resource ownership block setup rather than stopping
another project.

```bash
npm run migration:local -- prepare --confirm-project bondi-migration-rehearsal
npm run migration:schema -- --confirm-project bondi-migration-rehearsal
npm run migration:fixtures -- --confirm-project bondi-migration-rehearsal
npm run migration:build -- --confirm-project bondi-migration-rehearsal
npm run migration:accounts -- --confirm-project bondi-migration-rehearsal
```

Preparation creates separate private signing keys, ownership records and actual
database markers. Schema deployment is a separate explicit operation on both empty
owned databases. It verifies every committed migration name/checksum; migration
files remain immutable. Fixtures populate only the empty source, in one transaction.
Build only generates Prisma/Next artifacts. Account qualification starts an owned
loopback Next listener, authenticates the existing legacy credentials, captures
signed cookies privately and verifies expired/anonymous rejection before capture.
No migration, fixture seed, download or data transfer runs from build/test/start.

The synthetic fixture covers every application table: 8 accounts/profiles,
preferences and location modes/revisions/visibility; valid/expired sessions;
ordered gallery files and trusted attachment references; likes/passes, active and
ended matches; 122 messages including tied cursor history, read receipts and a
stable request ID; notifications; pending, backoff and completed delivery intents;
private lease/typing state; and verification data. Source sign-in adds genuine
sessions before the capture. Its password hash is the existing Better Auth 1.3.33
synthetic regression fixture, not a real credential.

Reference data consists of three synthetic cities, six aliases and a checksum of
those rows. It is not a full GeoNames import. Production must transfer the actual
catalog with verified counts/content or explicitly run the pinned
[reference import](reference-data/geonames.md); user origins are never reinterpreted
or geocoded during transfer.

## Failure, successful transfer and read-only qualification

```bash
npm run migration:transfer -- capture --confirm-project bondi-migration-rehearsal
npm run migration:transfer -- prove-failure --confirm-project bondi-migration-rehearsal
npm run migration:qualify -- source --confirm-project bondi-migration-rehearsal
npm run migration:transfer -- restore --confirm-project bondi-migration-rehearsal
npm run migration:qualify -- target --confirm-project bondi-migration-rehearsal
```

Capture verifies exact loopback source/target/API identities against private random
markers in the actual databases. It rejects hosted connections, pooled/query-bearing
URLs, wrong project/role/version, unexpected tables, populated destinations,
incomplete/changed migration history and schema differences. Stop/drain the source
application first: any other source client connection blocks the maintenance step.
The tool pauses only the two owned native jobs and sets both databases' connection
defaults read-only. Fresh connections must reject an otherwise valid no-op write
with PostgreSQL `25006`; owners can override these defaults, so stopping old writers
and preserving the single-writer release sequence remain operator obligations.

The private, data-only export allowlists 18 public application tables. Native
`auth`, `realtime` and `storage` schemas, global roles and platform objects are not
exported or overwritten. Target schema, RLS, API-denied grants, private receive
policy and managed functions/jobs come from its explicit Prisma deployment and are
verified separately. Required extensions/roles remain part of target bootstrap.

Restore uses `psql -X`, `ON_ERROR_STOP` and one transaction. It locks all target
application tables and rechecks emptiness before copying. Only the fresh compatible
target migration ledger is replaced inside that transaction with the original
source ledger; target bootstrap provenance is retained privately. Constraints stay
enabled. The failure proof injects division by zero after the copy statements,
requires `22012`, then verifies the entire empty target and original target ledger
are unchanged. Failed or unverified copies cannot enter HTTP target qualification.
The source remains usable for authorized reads with its preserved cookies.

A successful restore verifies counts and streamed, primary-key-ordered full-row
SHA-256 fingerprints for all tables, including the exact migration ledger and
reference rows. Data does not accumulate in application memory or logs. Database
encoding/collation/time-zone and cross-version behavior still require review for
any separately approved production dataset; a mismatch blocks qualification.
Read-only HTTP probes compare actual source/target profiles, session expiry,
bounded cursor pages, ended history and city/device discovery/privacy. They also
prove those reads leave the captured data unchanged. No target writer is accepted
on an empty-schema, mocked SDK or count-only result.

## Rehearse rollback before accepting new target writes

```bash
npm run migration:transfer -- rollback --confirm-project bondi-migration-rehearsal
npm run migration:qualify -- source --confirm-project bondi-migration-rehearsal
npm run migration:transfer -- reselect --confirm-project bondi-migration-rehearsal
npm run migration:transfer -- accept --confirm-project bondi-migration-rehearsal
npm run migration:guards -- --confirm-project bondi-migration-rehearsal
npm run migration:delivery -- --confirm-project bondi-migration-rehearsal
npm run test:migration -- --confirm-project bondi-migration-rehearsal
```

Rollback restores only the source writer, keeps the target read-only and rechecks
actual source HTTP behavior with the original signed cookies. Re-selection drains
and freezes the source again and requires its content to remain unchanged; any
source write requires a new reviewed capture/target, not silent replay over data.
Only verified failure recovery plus actual target/source HTTP qualification permits
acceptance. The journal records `accepting` before releasing the target fence, so an
interruption cannot falsely declare a safe pre-write rollback. After acceptance,
source stays read-only and automatic reverse switching is refused.

The explicit delivery command joins two real private channels using the preserved
account sessions before resuming the managed jobs. It verifies original pending
intents complete with incremented attempts and minimal native hints. Owned channels
and issued leases are cleaned up. Browser qualification separately verifies legacy
sign-in, preserved/expired sessions, same-ID replay without duplicated effects,
file order, city/device radius/privacy, foreign-history denial and two-browser live
chat/reload recovery on the restored target. Normal application and native suites
remain separate required gates; this command does not replace them.

**After new target writes:** reverting application code or pointing back to the old
source loses accepted messages, sessions, read receipts and other changes. Stop all
writers first. Preserve both databases and backups; identify the accepted-write
interval, reconcile changes and foreign keys into a reviewed recovery target, then
qualify it before traffic. Decide any restore-point data loss explicitly. No dual
write or automatic reverse import is provided.

## Private artifacts, recovery and cleanup

Private records/backups live under ignored `.agent-runs/migration-rehearsal/`
(directory 0700, files 0600). Signing material is ignored under
`tooling/migration-rehearsal/supabase/`. Owned regular files are required; symlinks,
wrong owners and group/other-readable JSON/backup files are rejected. State replaces
atomically. Server signing keys, service keys, passwords, cookies, private rows,
exact profile locations and raw subprocess diagnostics are omitted from console
output. Never upload the private directory or copy it into an issue/PR.

Preserve the source data export, its hash, capture/HTTP baseline, original target
bootstrap ledger, private journal and safe command outcomes through the rollback
window. The data export is an application-data backup for a compatible prepared
schema, not a whole-cluster or media-object backup. Production also needs verified
schema/release/configuration and external-media recovery under its retention policy.

Commands do not reset databases, clear a populated destination or overwrite a
previous capture. Fixture and pending-delivery preparation refuse completed
mutable setup instead of replaying it. Inspect an interrupted
journal before continuing. An incomplete capture can release its source through
the guarded before-write rollback only while no target writes have been accepted.
An `accepting`/`accepted` record requires explicit reconciliation review. Partial
infrastructure without completed ownership proof requires inspection. Use a fresh
isolated environment/CI run for a fresh rehearsal; preserve the previous evidence
instead of discarding it to make a retry pass.

```bash
npm run migration:local -- stop --confirm-project bondi-migration-rehearsal
```

Shutdown verifies ownership before stopping only the rehearsal Supabase project
and its labelled source container. The source uses `--rm`, so its anonymous volume
ends with that container; retain required backup artifacts first. Private records
remain for recovery. No global pruning, other-project shutdown or unrelated-file
deletion occurs.

## Recorded evidence and release boundary

Local execution verified PostgreSQL 14.25 to native Supabase PostgreSQL 17.11,
23 identical committed migrations, all 18 table counts/content, an injected
post-copy transaction rollback, preserved cookies and before-write rollback,
eight negative guards, two recovered pending intents through actual private
subscribers and both migrated API/browser cases. The native security advisor
reported no issues. CI's independent `migration-rehearsal` job runs the explicit
sequence from a fresh checkout, alongside ordinary schema/build/unit and native
application/authorization jobs. PR results own the final exact revision/counts.

For production, first approve the organization/source/target and maintenance/cost
scope; inventory roles/extensions/functions/triggers, encoding/collation/time zone,
application schema/ledger and actual dataset sizes. Prepare and validate the native
schema/grants/policy/jobs and imported signing keys separately. Keep the Better Auth
secret and app origin compatible for retained cookie sessions. Back up schema,
application data, configuration/releases and external media; verify restoration.
Stop old writers/jobs and drain connections; capture, restore and qualify privately
before routing traffic. Record the acceptance time and rollback/reconciliation
boundary, monitor safe queue/connection metrics, then qualify the actual host.
No hosted project, purchase, production data transfer or public cutover was performed
by this rehearsal. Final operational qualification remains
[#83](https://github.com/montuyamaricela/bondi/issues/83).

References: [pg_dump version compatibility](https://www.postgresql.org/docs/17/app-pgdump.html#APP-PGDUMP-NOTES),
[psql transactional restore](https://www.postgresql.org/docs/17/app-psql.html),
[pg_cron job control](https://github.com/citusdata/pg_cron#altering-a-cron-job).

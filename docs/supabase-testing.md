# Supabase integration environment

The migration workstream is [#74](https://github.com/montuyamaricela/bondi/issues/74).
This setup prepares an isolated native Supabase stack for testing. Application login
still uses Better Auth, uploads use UploadThing, and Supabase is the sole live
transport. Standard Next serves the application HTTP listener. A Supabase Auth user in the native permission test exists
only to exercise the authenticated Data API role; it is not an account migration.

## Explicit preparation

Use Node/npm from the committed project versions and a running Docker daemon with
sufficient disk for the Supabase images. `npm ci` installs the exact development CLI
version. The pinned v2.122.1 is a [maintained v2 release](https://github.com/supabase/cli/releases/tag/v2.122.1);
the old v2.84.2 npm installer brought a vulnerable `tar` dependency. The critical
audit remains enforced, and the tool pin is not a global CLI upgrade.

The committed local project is `bondi-integration`. Its PostgreSQL 17 database is on
127.0.0.1:54322 and API gateway on 127.0.0.1:54321. Stop other users of those ports
only with their owners' authorization. These commands never select or modify a
hosted project:

```bash
npm run supabase:keys:prepare
npm run supabase:start
npm run supabase:test:prepare
```

Key preparation creates two private ES256 overlap keys (one active signer, one
verification-only key) in ignored
`supabase/signing_keys.json` (0600), without replacing an existing file. Native
startup imports those keys explicitly. Never commit or print them. See the
[subscription contract](realtime.md) for hosted configuration and rotation.

The start command starts only the required local database, Auth, REST, Realtime and
gateway services. It checks the CLI pin and omits credential-bearing CLI output.
The preparation command requires the committed project confirmation, reads status
privately, validates the exact loopback endpoints and native database identity, and
creates a random marker in the private test-only `bondi_test` schema. It writes
ignored `.env.supabase.test.local` with mode 0600, including synthetic application
credentials and local test API keys. It does not migrate or seed application data.
In CI it masks those values before exporting them to the job environment.

Export this environment without printing it. For a local shell:

```bash
set -a
. ./.env.supabase.test.local
set +a
npm run db:migrate
npm run check:feature
npm run test:supabase
```

Review the target before the explicit migration command. Prisma remains the
application schema/migration owner; CLI application migrations and seeding are
disabled. Build/test/application-start commands do not start containers, migrate,
seed or import reference data. Tests create unique synthetic fixtures and remove
their own rows. To use the normal commit hook against this environment, deliberately
configure ignored `.env.test.local` from the prepared values; do not silently replace
an existing test environment or use production data.

```bash
npm run supabase:stop
```

Stop targets only `bondi-integration`; it does not use `--all` or delete data volumes.
Re-running preparation rotates the test marker, so coordinate with other local test
runs before doing it. No automatic Docker cleanup/pruning is included.

## Safety and access control

Ordinary PostgreSQL unit/schema checks retain the loopback and test/e2e/harness
name guard; application journeys require the native target below.
Native local Supabase uses the database name `postgres`, so its test path additionally
requires the exact project, API/database endpoint pair, explicit confirmation and
random marker. Playwright verifies that marker against the actual database before
fixtures write. A generic allow flag or a database-name exception is insufficient.
Runtime and direct migration URLs must identify the same test target. Arbitrary
hosted URLs and local tunnels are not accepted by this local harness.

The additive Prisma migration enables RLS and revokes PUBLIC/anon/authenticated
access on application tables, including credentials, sessions, messages and private
profile coordinates. It also removes those API-role default table grants for future
tables created by the same migrator. Missing provider roles on ordinary PostgreSQL
do not disable RLS or PUBLIC protection. Supabase-owned schemas and tables are not
altered. Application servers use their privileged owner connection and must still
perform session, ownership and active-match checks at HTTP operations; RLS here does
not replace application authorization. Future app tables/functions need explicit
private grants and RLS, rather than broad client access.

The native tests use real Auth/REST endpoints and Prisma to verify an allowed server
path, an existing private profile, denied anonymous and genuinely authenticated API
requests, RLS flags/grants, private defaults and a mismatched marker. Administrative
API calls use Node fetch so server test keys are not recorded in Playwright traces.
Native tests fail without the prepared stack; they do not skip or use a mocked SDK.
The Realtime cases additionally test actual private joins, text account IDs,
issuer/audience/key/expiry rejection, receive-only permissions, cached-connection
revocation and browser ownership across delayed responses, logout and replacement.

## Verification evidence

CI has two required checks: the ordinary PostgreSQL schema/build/unit job and `native-supabase`.
The native job explicitly starts/prepares/migrates an ephemeral local Supabase stack,
runs strict checks and a fresh build, then all retained application journeys and
the native permission cases. It stops only its owned stack. This job does not need
a hosted Supabase account or production credentials.

Report ordinary schema/build/unit results separately from native results.
Application E2E and `test:supabase` both require the prepared native target. A Mac
without Docker may run static/unit checks, but cannot claim native integration.
Physical GPS, live uploads and production-data migration are separate checks. Hosted
provisioning requires a specific organization/project and any required cost approval;
this harness does not grant that authorization.

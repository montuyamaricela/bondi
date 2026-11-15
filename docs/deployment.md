# Deployment preparation

Bondi uses a standard Next Node host, Supabase Database + Realtime and HTTPS.
Browsers connect directly to Supabase; the application host serves authenticated
HTTP. A static export cannot serve these operations. This guide prepares a release;
it does not establish a deployed or qualified site.

## Environment and ownership

Use the Node version in `.nvmrc` and configure server secrets through the host's
secret manager: runtime `DATABASE_URL`, CLI `DIRECT_URL` when pooling requires it,
a strong `BETTER_AUTH_SECRET`, `UPLOADTHING_TOKEN`, `SUPABASE_SECRET_KEY` and a
private `SUPABASE_SIGNING_KEYS_PATH`. The two database connections identify the
same database. Better Auth, Prisma and UploadThing retain their current ownership.

Use the final HTTPS origin for `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`.
Configure `NEXT_PUBLIC_SUPABASE_URL` and its public publishable key. Public values
are embedded at build time; rebuild when they change. Import signing keys into the
explicit target before issuing credentials; follow the [Realtime contract](realtime.md)
for receive-only capabilities, rotation, delivery/pruning and operational limits.
Missing public configuration reports disconnected updates and never chooses another
transport; message writes require the native dispatcher installed in Supabase.

Next CLI owns listener options. For example, the host may run
`npm start -- --hostname 0.0.0.0 --port <assigned-port>`. Application replicas share
canonical database state and managed native delivery rather than an in-process
socket registry. This architecture does not itself qualify capacity, proxy behavior
or availability on a particular host.

## Release sequence

1. Select the intended target and obtain any required provisioning/cost approval.
   Preserve backups and use the populated transfer/rollback runbook from
   [#82](https://github.com/montuyamaricela/bondi/issues/82). Keep one active writer
   during cutover; retain the previous known-good build and recovery data.
2. Install the lockfile with `npm ci`. Run `npm run check` against the intended
   revision with its build environment. This includes strict checks, tests, Prisma
   generation, a fresh Next build and the retired-transport artifact guard.
   It never applies migrations or seeds data.
3. Explicitly prepare/migrate a disposable native target using
   [Supabase test setup](supabase-testing.md), then run `check:feature` and
   `test:supabase`. Ordinary PostgreSQL schema/build results are not native delivery
   qualification. [Coverage](realtime-retirement.md) records exercised boundaries.
4. Review pending application migrations and native policy/job configuration.
   Apply `npm run db:migrate` explicitly to the approved release database using
   its direct/session connection. Existing migration history remains immutable.
   Hosted signing-key/bootstrap steps remain separate from application migrations.
5. Build with final public origins, deploy and start standard Next. Verify HTTPS,
   cookies, synthetic-user registration/login, profile/location privacy, mutual
   matches, both-direction messages/read/typing, reconnect, logout/revocation and
   actual Supabase private delivery. Qualify real upload completion separately.
6. Inspect native job health, pending delivery age/count/failures and signing-key
   acceptance. Record host/revision/target, checks and rollback readiness in
   [#83](https://github.com/montuyamaricela/bondi/issues/83). Local stack results do
   not prove a hosted cutover occurred. A failed release needs the reviewed rollback
   sequence; reverting application code alone does not restore database state.

## Meeting/demo readiness

Use synthetic profiles/messages. Explain observed checks and remaining gaps. The
README screenshot captures a local production build; it does not establish public
hosting. Add a live-demo link after the actual deployment is verified.

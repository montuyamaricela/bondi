# Deployment preparation

Bondi currently runs Next and Socket.IO in one long-lived Node process. Choose a
host supporting WebSocket upgrades and the Node version in `.nvmrc`, plus a
PostgreSQL database. A static export cannot run the current authenticated app.
This guide prepares a release; it does not establish a deployed or qualified site.

## Environment

Configure `DATABASE_URL`, a strong `BETTER_AUTH_SECRET`, and `UPLOADTHING_TOKEN`
through the host's secret manager. Use the final HTTPS origin for
`BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_SOCKET_URL`.
Set `HOSTNAME=0.0.0.0`; supply the host's assigned `PORT`.

Public `NEXT_PUBLIC_*` values are embedded during build. Rebuild after changing
them. Keep secrets server-only. The production custom Node entry point expects
environment variables from the host; it does not source `.env` itself.

Use the combined server for the first release. With separate processes, the
in-memory socket singleton does not cross process boundaries. Multiple replicas
need a deliberately designed shared Socket.IO adapter/session routing strategy
and delivery tests before scaling; the current harness does not configure one.

## Release sequence

1. Install the committed lockfile with `npm ci` and generate Prisma artifacts
   with `npm run db:generate`.
2. Run `npm run check` against the intended revision with the release build
   environment. Keep migrations outside this command. Formatting and strict lint
   are required gates alongside the behavior and build checks.
3. Against a disposable test database, apply migrations explicitly with
   `npm run db:migrate` and run the built-app browser suite using its documented
   test-origin build settings. Do not run browser tests against production data.
4. Qualify synthetic-user registration/login, profile edits/privacy, mutual likes,
   rejected non-member access, messages in both directions, reconnect/read receipts,
   and upload completion. These authenticated journeys are not yet covered by the
   initial smoke suite. Check current dependency advisories before public release.
5. Prepare the final release build with its production origins. Review pending
   migrations and the database backup/recovery plan, then apply
   `npm run db:migrate` to the intended release database.
6. Start `npm start`, verify HTTPS/cookies and WebSocket upgrades, and check public
   plus synthetic-user journeys on the actual host. Preserve the last known good
   build; a database rollback needs its own reviewed plan.

## Meeting/demo readiness

Use synthetic profiles and messages for a demonstration. Show observed behavior
and explain the remaining work directly. The README screenshot is a real capture
of the local production build; it is not evidence of public hosting or qualified
authenticated workflows. Add a live-demo link only after the deployment is verified.

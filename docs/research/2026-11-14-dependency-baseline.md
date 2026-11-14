# Dependency baseline review — 14 November 2026

Implements the bounded dependency repair in [issue #17](https://github.com/montuyamaricela/bondi/issues/17).
This is a dated audit, not a claim that the app or every dependency is secure.
Re-run the commands against the current lockfile before release.

## Changes and compatibility

Pin Next and its lint config to 16.4.6, React/React DOM to 19.3.1, and Better Auth
to 1.7.23. These were stable registry releases when checked; no canary or major
framework/auth replacement is involved. Align Prisma CLI/client at 6.19.3 within
their existing declared range. Refresh compatible vulnerable transitive packages,
including Engine.IO 6.6.11, socket.io-parser 4.2.7, and ws 8.21.3, without changing
Socket.IO event semantics.

The old Next 16.0.0 App Router baseline falls within the maintainer's
[React Server Components RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-9qr9-h5gf-34mp).
The selected release also addresses later lockfile advisories; the historical
16.0.7 patch alone is not the target. Better Auth's old critical findings include
plugin-specific two-factor/OIDC paths which Bondi does not configure. Updating the
package removes those entries without claiming those attacks were demonstrated
against this app.

The [stable Better Auth 1.7 upgrade guide](https://github.com/better-auth/better-auth/blob/v1.7.23/docs/content/docs/guides/1-7-upgrade-guide.mdx)
states that 1.7.3 onward retains the provider/account-key schema. Bondi already
uses that key and does not enable the OAuth-provider, SCIM, device authorization,
or organization plugins requiring separate migration work. The updated adapter's
startup validation nevertheless exposed an incomplete existing core schema:
missing nullable account expiry/scope columns and the verification table. An
additive migration supplies these, preserving the legacy `expiresAt` column and
all existing IDs, credentials, and profile data. No issuer column, account-key
rewrite, secret rotation, or automatic migration is introduced. Apply the new
migration explicitly before starting the upgraded app.

The migration was explicitly applied to the gated local disposable database with
a synthetic account/profile created using the old schema first. A post-migration
probe verified every original account field and the full profile were unchanged,
the new fields were null, and the verification table was usable, then removed the
exact synthetic fixture. Production databases were not accessed.

Compatibility adjustments keep onboarding's existing selected validation fields
explicitly typed for the current Zod pick API and provide the current Next router
field in the component-test adapter. Clearing the old generated `.next` output is
necessary when upgrading an existing checkout; stale generated route types are
not application source.

The browser journey also caught onboarding importing its session hook through a
module that initializes server auth/Prisma. It now imports the existing browser
adapter directly, and the server session helper no longer re-exports a client
hook. The existing onboarding journey protects this boundary through real browser
execution. The legacy-account test sends a JSON logout POST, as required by the
updated auth handler, and retains its successful-logout and denied-access checks.

## Audit evidence

Commands: `npm audit --json` and `npm audit --omit=dev --json`.
An exit status of 1 remains expected for the residual noncritical findings below;
it is not a passing all-severity audit.

- Before: 33 affected package entries — 2 critical, 23 high, 6 moderate, 2 low.
- After: 16 affected entries — **0 critical**, 7 high, 9 moderate.
- Production-only after: 8 affected entries — **0 critical**, 7 high, 1 moderate.

These are package entries, including parent packages inheriting the same finding,
not counts of independent exploits. Remaining findings resolve to three chains:

- **UploadThing / Effect:** `uploadthing`, `@uploadthing/react`,
  `@uploadthing/shared`, `effect`, and `@effect/platform` inherit the
  [Effect RPC context finding](https://github.com/advisories/GHSA-38f7-945m-qr2g)
  and [cookie attribute finding](https://github.com/advisories/GHSA-chp3-j5qr-2vfr).
  Bondi does not directly implement an Effect RPC service or derive SDK cookie
  settings from profile input. That does not establish that every internal SDK
  path or concurrent upload is safe. The audit's offered fix downgrades UploadThing
  from 7 to 6; no forced SDK downgrade or unverified Effect override is applied.
  This remains a noncritical upload-dependency follow-up, including examination
  of SDK internals and supported upstream fixes. Mocked authorization tests do not
  prove live upload/concurrency behavior.
- **Prisma config / deepmerge-ts:** `prisma`, `@prisma/config`, and `deepmerge-ts`
  inherit the [recursive-object merge finding](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
  Bondi's CLI configuration is maintained repository code; HTTP handlers import
  the generated Prisma client rather than accepting user-supplied CLI config.
  The production audit also includes this peer dependency chain. A clean audit
  requires a Prisma major upgrade according to the current remediation report;
  the corresponding config/client migration is separate from this repair.
- **Lint tooling / minimatch:** eight entries in the Next/TypeScript ESLint chain
  inherit the [glob amplification finding](https://github.com/advisories/GHSA-g3hv-75wg-m249).
  This is tooling operating on repository paths, not the app's public profile or
  discovery filters. The suggested automatic fix downgrades Next lint tooling
  to 15; keep it aligned with Next 16 and track a supported upstream patch.
  No lint rule or assertion is disabled to conceal the finding.

No unresolved critical entry remains, regardless of plugin applicability. The
remaining high/moderate findings are visible limitations, not accepted proof of
non-exploitability and not permission to deploy without a fresh release review.

## Verification and continuing gate

`npm run audit:critical` audits the full dependency graph and fails at critical
severity. `npm run check` invokes it, so commit verification and CI block a new
critical finding or registry failure for review. Lower-severity findings remain
visible; this does not suppress or force-fix them.

The legacy-credential browser/API case uses only a synthetic account and a hash
generated by Better Auth 1.3.33 before this upgrade. It checks wrong-password and
anonymous denial, successful login with the existing user/account/profile IDs,
absence of duplicate accounts, and denial after logout. Test writes are restricted
to a local disposable test database and cleaned up by exact synthetic identity.
The existing two-user onboarding/matching/chat/outsider journey remains separate.

Required delivery evidence is the full `npm run check:feature` gate (unit/harness,
critical audit, formatting, schema validation, types, strict lint, fresh build,
and all eight Chromium cases) plus independent PR CI. Record actual run results
in the implementing PR. Builds/checks do not migrate or seed databases; this
upgrade does not change that boundary or claim to test physical device location,
live storage completion, every session/socket lifecycle, or other browsers.

# Supabase Auth migration compatibility — 15 November 2026

The user has chosen **Supabase Auth as the eventual authentication owner**, with
Resend SMTP as the planned email sender. Existing reliability, privacy and UI
improvements come first. This is research and a proposed migration sequence, not
an implemented migration or permission to provision services. No provider account,
verified sending domain or production target has been supplied.

The migration is feasible without rewriting application identities, but it is not
a package swap. The two principal blockers are incompatible password formats and
the difference between Bondi's immediate session revocation and ordinary JWT
validation. Preserve the existing text IDs and use a trusted mapping to Supabase
UUIDs; preserve live authorization rather than replacing it with cached claims.

## Evidence and versions

Checked 15 November 2026 against official Supabase/Better Auth/Resend documentation
and installed source. Installed versions are Better Auth 1.7.23,
`@better-auth/utils` 0.5.1, `@supabase/supabase-js` and `@supabase/auth-js` 2.119.0,
and Supabase CLI 2.122.1. `@supabase/ssr` is not currently declared.
[Package manifest](../../package.json).

Supabase Auth implementation references below are pinned to upstream commit
`3e79d8513b67d7dc3f234153aacc074daf82db5f`, dated 13 November 2026. This is evidence
of current upstream behavior, **not proof that the existing local image or a future
hosted target runs that commit**. Qualify both explicitly before migration.
[Auth source revision](https://github.com/supabase/auth/commit/3e79d8513b67d7dc3f234153aacc074daf82db5f).

The [changelog](https://supabase.com/changelog) was checked. Relevant changes include
[CLI v3 target/flag changes](https://supabase.com/changelog/supabase-cli-v3) and
[Realtime schema restrictions](https://supabase.com/changelog/realtime-schema-locked-down-against-modification).
Keep the repository's pinned CLI workflow; research is not a reason to upgrade it.
Keep owned helper functions outside managed schemas and change only supported
Realtime policies.

## What Bondi currently owns

- `User.id` is text with a CUID default. Profiles, matches, messages, files,
  notifications, location settings and delivery records reference it. Better
  Auth credentials are in `Account`, with `providerId=credential` and a password
  hash. `Session` holds an opaque token, text ID, owner and expiry.
  [Schema](../../prisma/schema/schema.prisma).
- Server resolution calls Better Auth on every protected request; cookie caching
  is disabled to observe database revocation immediately. Email verification is
  currently not required. Configured session lifetime is seven days; any
  remember-me behavior must be verified rather than inferred from configuration.
  [Auth configuration](../../lib/auth.ts), [session seam](../../lib/session.ts).
- Realtime credentials are separate 90-second ES256 capabilities with text app
  user/session IDs and a random lease. `RealtimeLease` references the current
  `Session`. Issuance, recipient selection and database dispatch join live
  sessions. Cached channel permissions do not authorize HTTP operations.
  [Signing](../../lib/server/realtime-signing.ts),
  [lease operations](../../lib/server/realtime.ts),
  [lease schema](../../prisma/schema/realtime.prisma),
  [Realtime contract](../realtime.md).
- The existing legacy-login browser case contains a synthetic Better Auth 1.3.33
  scrypt credential and asserts preservation of the same account/profile.
  The revocation case deliberately retains a cryptographically valid old cookie
  while requiring the next protected read/write to fail.
  [Legacy case](../../tests/e2e/legacy-auth.spec.ts),
  [revocation case](../../tests/e2e/session-revocation.spec.ts).

No real user rows, credentials, cookies, private environment values or hosted
project data were inspected for this research.

## Password migration: import support is not generic scrypt support

Better Auth documents scrypt as its default and stores credentials in the account
table. Installed `node_modules/@better-auth/utils/dist/password.node.mjs` uses
NFKC-normalized passwords, an ASCII hex salt, `N=16384`, `r=16`, `p=1`, a 64-byte
derived key, and a `salt:hexKey` string. Bondi configures no custom password hasher.
[Better Auth email/password documentation](https://better-auth.com/docs/authentication/email-password).

The installed Supabase client `AdminUserAttributes.password_hash` explicitly lists
**bcrypt, Firebase scrypt, and Argon2**. Current Auth's
`NewUserWithPasswordHash` validates bcrypt or delegates to Argon2/Firebase parsers.
Its Argon2 parser supports Argon2i/id version 19 with parameter limits, not every
Argon2 variant. The Firebase parser expects a versioned `$fbscrypt` representation;
verification performs Firebase's scrypt-plus-AES construction using a signer key
and optional salt separator. It does not implement Better Auth's `salt:key`
representation or NFKC normalization.
[Import validation](https://github.com/supabase/auth/blob/3e79d8513b67d7dc3f234153aacc074daf82db5f/internal/models/user.go),
[hash parsers and verification](https://github.com/supabase/auth/blob/3e79d8513b67d7dc3f234153aacc074daf82db5f/internal/crypto/password.go).

**Directly passing the existing Better Auth hash as `password_hash` is
incompatible.** It cannot be converted to bcrypt merely by relabeling or
reformatting it. Do not interpret Firebase-specific support as a documented
Better Auth migration mechanism, invent a custom wrapper, or promise hash import
without a target-runtime acceptance test. Supabase's normal new-password path
uses bcrypt, and its current admin implementation handles bcrypt's 72-byte limit.
[Password security](https://supabase.com/docs/guides/auth/password-security),
[admin create/update implementation](https://github.com/supabase/auth/blob/3e79d8513b67d7dc3f234153aacc074daf82db5f/internal/api/admin.go).

The Password Verification Attempt hook is not a replacement verifier: its inputs
are `user_id` and the already-computed validity result; `continue` retains default
behavior and `reject` denies it. It does not receive plaintext or offer a documented
override that accepts a failed scrypt check.
[Password Verification Hook](https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook).

### Option A: bounded just-in-time credential bridge

This is the preferred candidate **if unchanged-password continuity is required**;
it is a design requiring implementation and testing, not a documented turnkey
Better Auth integration.

1. Preassign a native UUID and private one-to-one mapping for each existing app
   account. For a first legacy password sign-in, verify against the exact legacy
   hasher on the server using the submitted password. A wrong password must not
   create a user, change a credential or reveal whether the account exists.
2. Only after successful verification, create or initialize the mapped native
   credential with the submitted password, then obtain a genuine Supabase session
   through native password sign-in. Keep the plaintext only in request memory;
   never store it or send it to analytics/logs. Admin APIs stay server-only.
   [Admin user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
   [native password sign-in](https://supabase.com/docs/guides/auth/passwords).
3. Make the operation idempotent and serialize by the legacy app user. Admin API
   creation and the app's mapping transaction are not one atomic transaction:
   recover from a native user created before a timeout, a mapping write failure,
   simultaneous login and signup, and duplicate/normalized emails. Verify the
   native UUID against the stored mapping on every retry; an email match alone
   must not attach an unrelated native account.
4. Mark the account migrated only after native authentication and mapping succeed.
   Then native credentials become authoritative. Never fall back to the old hash
   after the user has reset or changed the native password; that would restore
   the old credential. Keep a finite bridge window, failure monitoring without
   private payloads, and a path for remaining inactive users.

**Compatibility decisions remain:** Better Auth accepts Unicode forms that
normalize to the same NFKC value; native bcrypt does not promise that equivalence.
Some old passwords may exceed bcrypt's 72-byte UTF-8 limit. Test both before
choosing a policy: consistently normalize all Bondi password entry/change/reset
paths, or ask affected users to choose a native-compatible new password. Do not
truncate, silently alter the accepted password space, or claim full credential
continuity without resolving these cases. Existing shorter passwords may also
conflict with a newly strengthened minimum policy.

### Option B: explicit password reset

Precreate mapped native accounts without importing the incompatible hash, verify
email ownership through recovery, and let users choose a new password. This is a
simpler final cutover but changes login continuity and requires an explicit user
decision. It is currently blocked on mail delivery and recovery qualification.
Never mark unverified legacy emails confirmed just to bypass this prerequisite.
Supabase hosted email confirmation is enabled by default, unlike local defaults
and Bondi's present configuration.
[Password-based Auth and recovery](https://supabase.com/docs/guides/auth/passwords).

### Existing browser sessions are a separate migration problem

An opaque Better Auth cookie is not a Supabase access/refresh-token pair.
`setSession` requires valid native tokens; it does not import arbitrary old cookies
or create a native refresh session from Bondi's custom Realtime JWT.
[setSession](https://supabase.com/docs/reference/javascript/auth-setsession).

The smallest bridge is to let valid legacy sessions retain their existing deadline
during a finite transition and perform JIT password migration at the next sign-in.
This temporarily keeps two explicit session paths, so migrated-user
logout/password reset must also revoke any retained legacy sessions and leases.
Do not repeatedly renew old sessions or keep old signup/password-change paths
active indefinitely.

If seamless active-session exchange is required, a server-side bridge could
validate the old live session and establish a new native session through supported
admin-generated-link/OTP APIs. Those primitives exist; their combination is **not
a qualified migration flow here**. It can affect email verification state, issue
a fresh authentication time and reset lifetimes. Require a one-time transition
bound to the validated old owner, mapping and original deadline, CSRF protection,
revocation-race checks, and synthetic proof before choosing it. Do not generate
sessions from a browser-supplied email/ID.
[generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink),
[verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp).

## Stable application IDs and native identity mapping

Supabase Auth's user ID is a UUID; its admin create endpoint validates custom IDs
as UUIDs. Existing CUID/text app IDs therefore cannot simply become native IDs.
[Admin implementation](https://github.com/supabase/auth/blob/3e79d8513b67d7dc3f234153aacc074daf82db5f/internal/api/admin.go).

Use one private owned mapping with unique `appUserId` and `authUserId`, or an
equivalent unique nullable native UUID on the existing app User during migration.
Preserve every existing `User.id` and domain foreign key. Resolve native JWT `sub`
through this mapping on the server; use the resulting app ID in profile,
membership, upload, location and message authorization. Reject missing,
conflicting, deleted or unmigrated mappings instead of making a replacement
profile. Never trust browser IDs, mutable email or `user_metadata` as the mapping.
Supabase's user-data guide supports separate app data and warns that managed
non-primary-key objects can change; do not adopt its sample public profile grants
for Bondi's private tables.
[User data](https://supabase.com/docs/guides/auth/managing-user-data).

Choose native ownership for email, verification, credentials and authentication
sessions. App name/profile/privacy/location remain in their present domain owner.
If app email is retained as a projection, define its update/reconciliation owner;
do not retain two writable email authorities. Keep application tables denied to
anonymous/authenticated Data API roles and Prisma/server authorization in place.

## Session, revocation and Realtime compatibility

Native sessions use access JWTs plus rotating refresh tokens. JWT `session_id`
identifies `auth.sessions`; the session can outlive a single access token. Default
sessions are indefinite. Optional native time-box/inactivity/single-session
controls require Pro or higher and are enforced at refresh, with delayed cleanup.
These defaults do not reproduce Bondi's seven-day database deadline. The docs
explicitly recommend checking that the session row still exists when immediate
post-signout denial is required.
[User sessions](https://supabase.com/docs/guides/auth/sessions).

For protected HTTP operations, verify signature, expected issuer/audience,
expiration and nonempty UUID `sub`/`session_id`, then resolve a live native session
belonging to that subject and the trusted app mapping. Enforce the app's required
deadline and any applicable native limits; session-row existence alone must not
extend an expired session pending cleanup. `getClaims()` can verify an asymmetric
JWT locally, so it cannot by itself prove revocation. Current Auth's authenticated
request middleware loads `auth.sessions` and rejects missing session IDs;
`getUser()` calls that Auth endpoint. Qualify this against the chosen runtime,
and retain explicit live session checks in database dispatch regardless.
[Auth request middleware](https://github.com/supabase/auth/blob/3e79d8513b67d7dc3f234153aacc074daf82db5f/internal/api/auth.go),
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser).

Important lifecycle details:

- JavaScript signout defaults to **global**; choose local/current-session logout
  explicitly if preserving today's independent-session behavior. The installed
  SDK documents local logout as clearing browser state before best-effort remote
  revocation, while global waits for server acknowledgement. A locally cleared
  browser is not evidence that the stolen/copied token was revoked. Define honest
  retry/failure behavior and test network failures.
  [signOut API](https://supabase.com/docs/reference/javascript/auth-signout).
- JWTs remain cryptographically valid until expiration after signout. Supabase's
  direct services and cached channels can accept cached authority; do not treat
  token expiry reduction as replacement for Bondi's next-request contract.
  [Signing out](https://supabase.com/docs/guides/auth/signout).
- Current native user password update calls `UpdatePassword` with the initiating
  session ID and revokes other sessions; admin password update passes no session
  and revokes all. A recovery request merely sends a link; completion is what
  changes the password. Decide whether a completed reset should retain its
  recovery session or require a fresh sign-in, then test the precise sequence.
  [User update](https://github.com/supabase/auth/blob/3e79d8513b67d7dc3f234153aacc074daf82db5f/internal/api/user.go),
  [session revocation on password update](https://github.com/supabase/auth/blob/3e79d8513b67d7dc3f234153aacc074daf82db5f/internal/models/user.go).

Rekey `RealtimeLease` from the retired legacy Session relation to native session
identity and resolve app user IDs through the mapping. Update issuance, renewal,
presence, typing, private join policy and durable delivery selection together.
Every native hint dispatch must still join a live authorized native session,
mapping and active match where required. Keep random receive-only topics, minimal
hints, authorized HTTP reads and session-owned cleanup. A long-lived socket cannot
authorize a fresh read after revocation. Realtime calculates channel permissions
at connection/join; existing authorization caching remains relevant.
[Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).

Keeping Bondi's short-lived lease JWTs temporarily is a transport choice, not a
second login provider. Native JWTs do not automatically carry the app's lease
claims, and native `sub` is now a UUID. Do not merely substitute tokens in the
current policy. Select the final lease-token approach during the migration slice,
qualify it, and retire obsolete app signing keys only after all old lease users
and rollback paths are gone.

## Next.js SSR requirements

The current official guide uses `@supabase/supabase-js` plus `@supabase/ssr`,
separate browser/server clients, and cookies with `getAll`/`setAll`. Create a server
client per request. Next.js 16 uses `proxy.ts`; earlier versions use middleware.
Refresh must happen before response headers are committed; preserve refreshed
request/response cookies and the cache-prevention headers supplied to `setAll`,
including when returning redirects. Do not trust `getSession()`'s client-supplied
user object for authorization. Pin the selected compatible SSR package and test
its exact API rather than copying an old tutorial.
[SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

The standard SSR client uses PKCE and browser-readable shared cookies. This is a
material change from an opaque server cookie; explicitly choose between the
documented browser/server pattern and a fully server-owned token architecture
before implementation. Do not set HttpOnly blindly on cookies the browser SDK
must refresh. Keep current safe callback validation, error redaction, account-owned
cache cleanup, provider listener disposal and CSRF/origin protection on writes.
Never cache authenticated responses or responses carrying refreshed cookies.
[SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide),
[Bondi callback validation](../../lib/auth-navigation.ts).

## Resend SMTP and local email qualification

Supabase Auth should generate confirmation/recovery messages and send them through
custom SMTP. A separate application email SDK or direct HTTP sender is unnecessary
for these standard Auth messages. Supabase's default mail service is limited to
team addresses, currently two messages per hour, and is not a production sender;
custom SMTP initially has a separately configurable low sending limit.
[Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Resend documents a verified owned domain and API key as prerequisites. Its Supabase
SMTP settings are host `smtp.resend.com`, port `465`, username `resend`, and API key
as password, with a sender address/name. No account, DNS records or key was created
or configured here. Store credentials only in server/provider configuration, never
browser variables, Playwright artifacts or committed files.
[Resend Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp).

Before hosting, configure the exact Site URL and allowed confirmation/recovery
callback URLs for the chosen environment. Avoid broad production wildcards;
retain Bondi's validated internal destination separately. Verify templates,
single-use/expired links, resend/rate limits, bounce/failure feedback, and that link
scanners do not consume the only login action unexpectedly.
[Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Local qualification needs no Resend account. Bondi currently disables
`[local_smtp]`, excludes Mailpit at startup, and disables email confirmations;
therefore existing native tests do not prove recovery-mail flows. In the future
auth slice, deliberately enable the disposable mail-capture service and appropriate
confirmation settings, with exact loopback ports and target guards. CLI docs call
the section `local_smtp` for this pinned CLI generation and describe Mailpit's
captured mail instead of external delivery.
[Current local configuration](../../supabase/config.toml),
[startup exclusions](../../scripts/supabase-local.mjs),
[CLI configuration](https://supabase.com/docs/guides/local-development/cli/config).

## Small staged migration and retirement

Before implementation, explicitly settle these product choices: JIT versus a
reset requirement; whether current sessions must cross without another sign-in;
how unverified legacy emails become verified without silently changing access;
Unicode/long-password compatibility; session lifetime; and current-device versus
all-device logout/reset behavior. A short compatibility spike using synthetic
fixtures must prove the chosen policy before a production migration is promised.
No forced reset, automatic email confirmation or new verification lockout is
authorized merely by choosing Supabase Auth.

1. **Resolve policy before changing authentication.** Select JIT or explicit reset,
   active-session continuity, normalization/long-password handling, legacy email
   verification, lifetime and logout/reset scope. Identify the eventual hosted
   target and mail domain separately. Existing feature fixes remain first.
2. **Prepare additive identity and verification seams.** Add the unique private
   mapping and idempotent migration state, retain app IDs/FKs, and add synthetic
   native Auth/mail cases. Prisma owns app migrations; Supabase owns its managed
   Auth schema. No migrations or seeds run implicitly in builds/tests.
3. **Implement one native vertical slice.** Native signup/login, mapped server
   identity, SSR refresh and logout must work together for synthetic users. Then
   add recovery/change-password and the chosen bounded legacy bridge. Native
   signup must not claim a pre-existing legacy account by email alone.
4. **Move the session boundary and Realtime together.** Replace every legacy
   Session dependency in protected HTTP, uploads, dispatch, presence and typing;
   preserve next-request denial, unchanged history and privacy projections.
   Capture a populated rehearsal, failure recovery and rollback boundary before
   any hosted cutover. Reverting only code after native passwords change cannot
   safely restore old hashes as current credentials.
5. **Retire the bridge.** Once remaining accounts are migrated or follow the
   agreed recovery path, disable all Better Auth routes and cookie acceptance,
   clear old cookies, remove legacy sessions/leases through explicit cleanup, and
   remove Better Auth dependency, credential writes, hooks and obsolete secrets.
   Delete retained legacy hashes on the agreed schedule after rollback retention
   ends. Supabase alone issues/verifies login credentials and refresh sessions;
   retain only the mapping and the app's domain authorization/lease operations.

## Required evidence before implementation is called complete

Use the repository's guarded disposable Supabase environment and synthetic
accounts. [Native test contract](../supabase-testing.md). The migration slice needs:

- Old 1.3.33 fixture and current hashes: correct/wrong password, Unicode-equivalent
  input, more than 72 UTF-8 bytes, policy mismatch, concurrent JIT and interrupted
  creation/mapping. Confirm the same app ID, profile, matches, message history,
  file ownership and location visibility before/after.
- Identity confusion: absent/conflicting mapping, forged metadata/IDs, normalized
  email collision, separate-account login, signup races and cross-account cache
  replacement. Deny unauthorized profile/message/upload operations.
- Real SSR cookies: refresh, expiry, concurrent tabs/requests, callback reload,
  prefetch, redirect cookie propagation, no shared response caching, refresh-token
  reuse and server/network failure. Tokens and mail links stay out of traces.
- Revocation: retain valid old access tokens and open native sockets, then local
  logout, global logout, password change/reset, deletion and legacy-session
  retirement. Require denial on the next protected read/write/credential renewal
  and suppress dispatch to revoked sessions. Test a retained initiating session
  separately from revoked peer sessions.
- Local captured mail: confirmation/recovery success, expired/reused/wrong tokens,
  changed account during recovery, safe redirect, retry/rate limits and SMTP
  unavailability. Hosted Resend delivery and DNS are a later explicit target
  qualification, not proven by Mailpit.
- Run the required feature gate and native Supabase cases after implementation;
  report unit, browser, native integration, populated migration rehearsal and
  hosted evidence separately. Existing tests must be adapted without relaxing
  their authorization, identity and failure assertions.

## What was actually checked

Read-only source/config inspection and official documentation retrieval completed.
A pure in-memory probe using the installed Better Auth verifier accepted the
committed synthetic 1.3.33 password fixture, rejected a wrong password, and confirmed
its hex `salt:key` shape. It did not connect to a database or create a session.

No native password import/JIT/session exchange, Auth image qualification, database
migration, mail delivery, browser journey or hosted integration was executed.
Those remain required proof. This note does not establish the population or shape
of real credentials, verified emails, active sessions or duplicate addresses.

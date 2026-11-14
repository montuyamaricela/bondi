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

The browser renews 30 seconds before expiry, also revalidates on focus, and keeps
one channel on same-session refresh. A failed renewal disconnects cached native
authorization and retries at most five times; focus can initiate another bounded
attempt. Account/session replacement aborts pending work and removes all owned
channels, listeners and timers. Late response parsing cannot create a new client.
No credential is retained in localStorage. See the [decision](adr/0001-session-owned-realtime.md)
for cached authorization limits and the no-private-payload rule.

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

The explicit local test preparation creates two private overlap keys, imports them
through `auth.signing_keys_path`, and never rotates an existing file on startup.
Native tests verify both trusted keys, unknown-key denial, wrong issuer/audience,
expired/revoked sessions, outsider topics and client publishing denial.

References: [custom JWTs](https://supabase.com/docs/guides/auth/jwts),
[signing keys](https://supabase.com/docs/guides/auth/signing-keys),
[private channel authorization](https://supabase.com/docs/guides/realtime/authorization).

# Receive-only Realtime capabilities preserve Better Auth sessions

Bondi retains Better Auth's text account IDs and opaque cookie sessions while
Supabase replaces the delivery transport. The server signs ES256 credentials using
an imported Supabase signing key, with issuer `bondi-realtime`, audience/role
`authenticated`, text `sub`, `bondi_session` and `bondi_lease`. Each browser owner
receives a random lease topic, renewable for at most 90 seconds and capped by the
authoritative session expiry. No Better Auth cookie token is returned by this path.

Native channel permission checks are cached. Therefore clients receive only an
minimal `changed` invalidation, empty or carrying an opaque random hint ID;
HTTP independently authorizes every sensitive read
and write. The dispatcher selects live sessions and leases immediately before
publishing. An idle revoked client may keep a cached connection until native token
expiry, but it cannot fetch protected data or qualify for future application hints.
Already in-flight hints carry no private content or resource identifiers. Direct message broadcasts,
client publishing and raw peer Presence would undermine this contract and are
deliberately excluded. Presence/typing state must later use authorized server leases.

A private-schema boolean SECURITY DEFINER lookup is necessary because Data API
roles must not read application sessions or lease capabilities. It has a fixed
`pg_catalog` search path, explicitly qualified tables, no PUBLIC/anon execute,
and validates trusted top-level claims against the live session and topic. The
only supported native-schema modification is a SELECT policy on
`realtime.messages`; application tables remain Prisma-owned and API-denied.

Native chat commands use authenticated HTTP, with private hints prompting authorized
reads. Socket.IO remains for the ordinary command path and outgoing presence
consumers during the dependent migration slices. The separately enabled Supabase
owner has no transport fallback. Remove
the old owner after HTTP commands, durable delivery and privacy behavior migrate.

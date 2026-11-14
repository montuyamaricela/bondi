---
name: bondi-data-boundaries
description: Preserve Bondi authentication, resource ownership, profile privacy, and real-time delivery boundaries when changing auth, profiles, discovery, uploads, matches, messages, or sockets.
---

# Bondi data boundaries

Trace the changed user operation from feature UI/hook through its HTTP or socket
entry point to Prisma and emitted events. Identify the acting session, target
resource, allowed audience, validation, failure response, and delivery owner.

Use the server session as the acting identity. Verify ownership/membership at the
operation boundary, including room joins, typing, sends, read receipts, uploads,
profile reads, and updates. Check active match status where communication requires
an active match. Exercise an allowed user, a non-member, and an expired/missing
session through the changed public interface.

Keep profile visibility and location/online-status preferences effective in query
results, serialized responses, broadcasts, and client caches. Test both enabled
and disabled behavior when changing a preference. Avoid logging private payloads.

Inspect all socket setup implementations (`server.ts`, `socket-server.ts`, and
`lib/socket.ts`). Confirm which process owns the connected clients and whether
HTTP emissions reach that process. Cover disconnect/reconnect and duplicate
listeners when changing providers. A successful database write alone does not
prove real-time delivery.

Keep migration execution explicit and use synthetic users in a disposable test
database. For a structural change, establish behavioral coverage before moving
the implementation. Report any untested boundary rather than treating a pure
utility test or public-page smoke test as authenticated integration evidence.

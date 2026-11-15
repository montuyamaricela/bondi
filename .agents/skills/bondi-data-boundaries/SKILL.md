---
name: bondi-data-boundaries
description: Preserve Bondi authentication, resource ownership, profile privacy, and real-time delivery boundaries when changing auth, profiles, discovery, uploads, matches, messages, or Realtime.
---

# Bondi data boundaries

Trace the changed user operation from feature UI/hook through its HTTP operation and private
hint dispatch to Prisma and emitted events. Identify the acting session, target
resource, allowed audience, validation, failure response, and delivery owner.

Use the server session as the acting identity. Verify ownership/membership at the
operation boundary, including subscription credentials, typing, sends, read receipts, uploads,
profile reads, and updates. Check active match status where communication requires
an active match. Exercise an allowed user, a non-member, and an expired/missing
session through the changed public interface.

Keep profile visibility and location/online-status preferences effective in query
results, serialized responses, broadcasts, and client caches. Test both enabled
and disabled behavior when changing a preference. Avoid logging private payloads.

Trace the owned browser subscription in `lib/client/realtime.ts`, server capability
and audience checks in `lib/server/realtime.ts`, and managed database delivery.
Keep hints minimal and receive-only; independently authorize the subsequent HTTP
read. Cover cleanup/reconnect, delayed responses, account/session replacement and
duplicate notification effects. Standard Next serves HTTP; the Supabase connection
does not grant application access. A successful database write alone does not
prove live delivery.

Keep migration execution explicit and use synthetic users in a disposable test
database. For a structural change, establish behavioral coverage before moving
the implementation. Report any untested boundary rather than treating a pure
utility test or public-page smoke test as authenticated integration evidence.

# Feature improvements and account migration

Decision date: 15 November 2026. Inventory baseline:
`d692c11ee7ccb0e07fe322b11eb5e6301b7c3148`. This plan records intended behavior;
it does not claim the work is already implemented or production-qualified.

The user selected this order: improve existing features, then authentication and
account management, then implement bounded feature additions chosen from research.
Authentication will move from Better Auth to **Supabase Auth**, with **Resend SMTP**
for production transactional email. The earlier Database/Realtime migration kept
Better Auth; Supabase hosting alone does not migrate application accounts.

## What Bondi already has

- Profile setup/editing already includes name, age, gender, bio, relationship
  intent, gender preference, interests and hobbies. Six-photo galleries support
  upload registration, deletion and ordering. See
  [profile form](../../app/components/features/profile/components/ProfileEditForm.tsx),
  [validation](../../app/components/features/profile/validation.ts) and
  [photo registration](../../lib/server/profile-photos.ts).
- Discovery already applies mutual gender preferences, age/distance limits,
  persistent LIKE/PASS decisions and active-match exclusions. Device, City and
  Off location modes include explicit refresh, city-center approximation, clear,
  privacy projection and competing-write protection. See
  [discovery](../../lib/server/discovery.ts),
  [location](../../lib/server/location.ts) and [setup/coverage](../../README.md).
- Chat already persists through authorized HTTP, reconciles identified retries,
  paginates history/inbox, uses private Supabase hints and supports typing, read
  receipts, online visibility and read-only history after unmatch. See
  [architecture](../architecture.md) and [Realtime contract](../realtime.md).
- Notifications already persist with unread state and optional browser effects.
  Attachment registration/display exists, but the composer is text-only. These
  are partial user flows rather than absent persistence implementations.

## Evidence and comparison

[Competitor research](../research/2026-11-15-dating-platform-features.md) links
first-party Tinder, Bumble, Hinge and OkCupid descriptions. Region, subscription,
device, rollout and unavailable-feature qualifications apply. No competitor was
tested with a real account, and feature presence does not establish demand.

Bondi already covers the basic expression features these platforms document.
Meaningful gaps are complete password recovery/change flows, optional profile
prompts, user-facing notification controls and inspectable shared-interest
context. Pause, block/report, contextual pre-match introductions and verification
are additional candidates with distinct product and operational requirements.

Do not duplicate existing bio/hobby/photo features, copy paid entitlements, infer
relationship success from a score, or copy a competitor's phone-account recovery
UI into an email/password application. Preserve the settled no-undo pass behavior,
mutual preference eligibility, explicit location actions and private ended chats.

## Phase A: repair existing behavior

Each item is a separate ticket and PR, with a regression check through its actual
interface. The review established these defects on the inventory baseline.

1. **R1: bind profile writes to their captured account and session.** A stale A
   form submitted with B's replacement cookie currently modifies B. Add server
   owner/session conflict checks to edit/setup writes, remount forms on owner
   replacement and suppress old save/upload effects. Preserve transactional
   gallery validation. Test same-account session replacement as well as A-to-B.
2. **R2: serialize online-visibility changes.** An older enable can currently
   overwrite a newer disable while the switch displays Off. Use an immediate
   pending guard, canonical server responses and operation-owned rollback; retain
   authorized peer invalidation. Test held writes, failures and owner changes.
3. **R3: align image rendering with canonical UploadThing hosts.** Current
   `*.ufs.sh` URLs fail Next's allowlist. Permit the configured provider host/path,
   retain intentional legacy compatibility and replace the unsupported remote
   placeholder with an existing local/initials fallback. Test representative
   callback/display URLs and host rejection; qualify real uploads separately.
4. **R4: distinguish failed history from successful empty history.** The first
   failed fetch currently renders the empty-conversation copy. Provide loading,
   error/retry, empty and populated states; retain access recovery and durable
   sends. Test transient failure recovery and authorization denial.
5. **R5: bound each Realtime credential attempt.** A pending fetch currently
   prevents all renewal/retry. Bound headers and body consumption without aborting
   the reusable owner lifetime. Test retry, late responses, disposal and focus.
6. **R7: make photo deletion and ordering keyboard accessible.** Name controls,
   provide an actual keyboard ordering alternative and preserve focus and primary
   photo semantics. Test keyboard-only reordering and saved order after reload.
7. **R8: separate owner and public profile contracts.** Public profiles omit
   private gender preferences correctly, but the client types/rendering expect
   the owner field. Keep it omitted, type the public DTO accurately and remove
   the empty private-field section. Test serialized privacy and public rendering.

R6 (UI/server password-policy disagreement) belongs in Phase B, avoiding a new
Better-Auth-only account implementation immediately before migration.

## Phase B: Supabase Auth and account management

[Auth compatibility research](../research/2026-11-15-supabase-auth-migration.md)
owns current primary-source details. Resolve compatibility in a disposable native
test environment before switching login. Do not provision a hosted service,
rotate credentials or cut over production as a side effect of build/tests.

- Preserve existing text application IDs, profile/gallery ownership, matches and
  message history through a trusted unique mapping to native UUID identities.
  Never trust editable metadata or link two accounts on email alone.
- Better Auth's scrypt hashes are not directly compatible with Supabase's
  supported import formats. Qualify a bounded credential bridge, including
  normalization, long-password behavior, reset invalidation and retirement.
  Do not silently force resets, change verified-email status or recreate accounts.
- Replace session resolution, browser auth state, middleware and Realtime
  credential/audience checks coherently. Native JWT verification alone does not
  prove a live session: retain rejection on the next protected request after
  revocation and independently authorize dispatch and subsequent HTTP reads.
- Add forgot/reset password and signed-in change-password UI using Supabase's
  actual recovery flow. Use allowlisted callbacks, generic request feedback,
  expiry/replay handling, rate controls and consistent server/client policy.
  Preserve legacy sign-in compatibility rather than imposing signup-only rules
  on existing accounts.
- Configure production email through Resend SMTP on an approved verified sending
  domain. SMTP transports mail; Supabase owns credentials/tokens. Local native
  email capture can establish end-to-end recovery without delivering real mail.
  Hosted sender/domain credentials and delivery qualification remain explicit
  operator prerequisites.

Split the work at tested interfaces: compatibility qualification; identity/session
foundation; browser/HTTP/Realtime cutover; recovery/account UI; deployment
qualification and legacy retirement. Every runtime PR must work against its
stated configuration and preserve all existing gates; no half-switched default.

## Phase C: selected additions after account work

The user delegated the next selection. Start with these bounded capabilities,
specifying each implementation ticket before coding:

1. **Optional profile prompts:** at most three curated prompt answers, short
   bounded text, explicit save/remove and public-profile preview. No mandatory
   onboarding expansion. Owner writes and public projection remain separate;
   render text without HTML and preserve profiles with no prompts.
2. **Shared public interests and editable starters:** display exact normalized
   interest/hobby overlap, with no fabricated compatibility probability. In an
   active chat, an explicit suggestion action may place one short deterministic
   question in an empty draft; preserve existing drafts, allow editing and require
   the normal Send action. Never send automatically, analyze private messages or
   use an external AI processor.
3. **Notification controls:** explicit opt-in browser permission, separate
   match/message effect preferences, accessible status and failure feedback.
   Preferences must be account-owned; canonical inbox/unread data still updates
   when browser effects are off. Test two accounts sharing one browser, multiple
   tabs, denied permission and reconnect.

These are engineering/product judgments drawn from the comparison, not proven
engagement improvements. Preserve meaningful assertions and measure behavior
before expanding them.

## Later candidates requiring their own decisions

- Discovery pause needs explicit treatment of previous Likes and existing chats.
- Block/report needs separate visibility, communication, evidence retention,
  post-unmatch reporting and an actual review owner before release.
- Pre-match comments add a new unsolicited-content and moderation surface.
- Photo/identity verification requires vendor, consent, retention and accurate
  badge semantics; it cannot promise safety.
- Date-plan sharing requires a recipient preview, minimal disclosed data,
  expiry/revocation and explicit initiation. No background location tracking.
- Large-scale ranking/search work requires load/query evidence. Dependency
  advisories need supported upgrade testing rather than a forced downgrade.

## Delivery and verification

Use one ticket per PR and atomic Conventional Commits authored and committed by
Maricel Montuya `<montuyamaricela@gmail.com>`, with no coauthor trailers and no
`codex` in branch names. Research documentation is one cohesive documentation PR.
After each implementation PR passes its exact-head checks, merge to main, push,
pull main explicitly and verify a clean synchronized checkout before the next.

Follow [verification](../../.agents/skills/bondi-change-verification/SKILL.md)
and [data boundaries](../../.agents/skills/bondi-data-boundaries/SKILL.md).
Runtime commits run the actual full feature hook; native coverage and migration
rehearsal remain separate CI evidence. Schema changes use new immutable migrations
applied explicitly to the known test target. Report unit, browser, native and
hosted-provider coverage separately; documentation research does not prove runtime
correctness.

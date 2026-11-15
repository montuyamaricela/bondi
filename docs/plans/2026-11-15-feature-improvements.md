# Feature improvements and account migration

Decision date: 15 November 2026. Inventory baseline:
`d692c11ee7ccb0e07fe322b11eb5e6301b7c3148`. This plan records intended behavior;
it does not claim the work is already implemented or production-qualified.

The user selected this order: improve existing features, then authentication and
account management, then implement bounded feature additions chosen from research.
Authentication will move from Better Auth to **Supabase Auth**, with **Resend SMTP**
for production transactional email. The user subsequently approved **starting with
fresh auth accounts**, so legacy password import, account migration and session
continuity are no longer requirements. This is not authorization to delete an
unspecified database. The earlier Database/Realtime migration kept Better Auth.

The user also selected **Supabase Storage with fresh photos/files**, replacing
UploadThing. There is no legacy-media copy requirement. Existing external assets
stay untouched until a separately approved cleanup. This replaces the original R3
UploadThing-host repair; finish the other repairs, then Auth/account, then Storage.

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
3. **R3: superseded by the Storage cutover (#96).** Current `*.ufs.sh` URLs fail
   Next's allowlist and a remote placeholder is unsupported. The user selected a
   fresh Storage provider instead of investing further in UploadThing-specific
   rendering. Move this work after Auth/account; the Storage ticket owns protected
   delivery and the existing local/initials fallback for missing photos.
4. **R4: distinguish failed history from successful empty history.** The first
   failed fetch currently renders the empty-conversation copy. Provide loading,
   error/retry, empty and populated states; retain access recovery and durable
   sends. Test transient failure recovery and authorization denial.
   #97 keeps the composer mounted during pending/offline reads and explicit retry,
   retains cached rows on refresh failures, and uses existing access recovery for
   denied history. Its browser cases separate controlled failures, real offline
   behavior and native hint-triggered recovery; HTTP ownership remains unchanged.
5. **R5: bound each Realtime credential attempt.** A pending fetch currently
   prevents all renewal/retry. Bound headers and body consumption without aborting
   the reusable owner lifetime. Test retry, late responses, disposal and focus.
   #98 bounds each POST/body read to eight seconds, releases pending work into
   the existing retry path and ignores late continuations. Deterministic unit
   clocks and real native credential/channel recovery qualify separate layers;
   no server authorization or SDK dependency change is required.
6. **R7: make photo deletion and ordering keyboard accessible.** Name controls,
   provide an actual keyboard ordering alternative and preserve focus and primary
   photo semantics. Test keyboard-only reordering and saved order after reload.
   #99 uses native named controls, boundary/deletion focus recovery and safe
   position announcements. It retains drag and deferred full-order saves, keeps
   deletion immediate, and preserves the latest owned draft during async gallery
   completions. The existing uploader gains a named busy/disabled keyboard action.
7. **R8: separate owner and public profile contracts.** Public profiles omit
   private gender preferences correctly, but the client types/rendering expect
   the owner field. Keep it omitted, type the public DTO accurately and remove
   the empty private-field section. Test serialized privacy and public rendering.
8. **R9: bind upload initiation to its captured account/session (#108).** A
   follow-up probe confirmed that all three upload endpoints accept a replacement
   cookie owner while ignoring the stale UI owner. Validate first-party owner
   headers before provider contact; cancel owned uploads and reject delayed drops
   after unmount. This follows R1 before auth, with separate native handler and
   controlled browser coverage; it does not require live provider assets.

R6 (UI/server password-policy disagreement) belongs in Phase B, avoiding a new
Better-Auth-only account implementation immediately before migration.

## Phase B: Supabase Auth and account management

[Auth compatibility research](../research/2026-11-15-supabase-auth-migration.md)
owns current primary-source details. Resolve compatibility in a disposable native
test environment before switching login. Do not provision a hosted service,
rotate credentials or cut over production as a side effect of build/tests.

- Start new users in native Supabase Auth. Use the verified native UUID as the
  existing text application User ID, avoiding an unnecessary mapping table.
  Provision app data only from the server-verified subject, never editable
  metadata, browser IDs or an email-only match. Domain foreign keys and ownership
  checks retain their existing structure.
- Do not implement a legacy credential bridge, copy password hashes, import old
  sessions or maintain two login providers. Retired Better Auth cookies must fail.
  Existing legacy-account continuity tests must be replaced by meaningful fresh
  native-account and retired-cookie rejection coverage because the user changed
  that requirement; preserve all unrelated privacy/access/failure assertions.
- Replace session resolution, browser auth state, middleware and Realtime
  credential/audience checks coherently. Native JWT verification alone does not
  prove a live session: retain rejection on the next protected request after
  revocation and independently authorize dispatch and subsequent HTTP reads.
- Add forgot/reset password and signed-in change-password UI using Supabase's
  actual recovery flow. Use allowlisted callbacks, generic request feedback,
  expiry/replay handling, rate controls and consistent server/client policy.
  Native Auth owns password policy and email confirmation. Test confirmation,
  recovery and password changes against the selected native runtime, with no
  fabricated verified-email state.
- Configure production email through Resend SMTP on an approved verified sending
  domain. SMTP transports mail; Supabase owns credentials/tokens. Local native
  email capture can establish end-to-end recovery without delivering real mail.
  Hosted sender/domain credentials and delivery qualification remain explicit
  operator prerequisites.

Split the work into a coherent fresh native-auth cutover (server/browser identity,
live session authorization, Realtime and retired-provider cleanup), followed by
recovery/change-password UI and deployment qualification. Use atomic commits
inside each ticket's PR. Test local captured mail before claiming recovery works.
Every runtime PR must work against its stated configuration; no half-switched
default. Database reset/provisioning is a separate explicit operator action against
a known target, never an implicit test/build side effect.

## Phase B continued: private Supabase Storage

Approved sequence: remaining repairs → fresh Auth (#101) → recovery/account
(#103) → Storage (#96) → selected additions (#104–#106). Auth no longer depends on
#96, preventing a dependency cycle. Use the installed Supabase SDK and remove
UploadThing's routes, adapters, dependencies and credentials once all callers and
tests use native Storage. Do not introduce a permanent dual-provider bridge.

Supabase private buckets apply access control to downloads as well as writes;
public bucket URLs are accessible to anyone who has them. Keep dating media in
private buckets, with explicitly authorized application access and restrictive
native policies. [Bucket access models](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

- Start with fresh profile photos and attachment bytes. No bulk import or copying
  from UploadThing is required; do not delete old external assets or reset an
  unspecified database. Hosted bucket setup is an explicit operator action.
- Preserve captured account/session commands, six-photo quota under concurrency,
  saved order/main-photo semantics, owned replay and deletion/retry. Storage does
  not implement these application rules automatically. Validate bounded size/type
  and actual content, strip image location metadata and keep processing bounded.
- Prefer stable authenticated application media URLs and private/no-store reads,
  avoiding public Next image caching of protected assets. Persist object metadata
  rather than expiring access URLs. Any signed capability needs explicit expiry,
  revocation and cache qualification; it is not a live application session.
- Preserve the current authenticated profile audience. Unregistered attachments
  are owner-only; saved attachments follow authorized chat history, including
  read-only history after unmatch. Never expose service keys or authorize from
  editable metadata, browser-supplied paths or cached claims alone.
- Specify registration/finalization and partial-failure compensation so accepted
  bytes and app records cannot silently diverge. Cover retries, quota races,
  abandoned work and wrong-owner deletion without building a generalized media
  framework or adding a chat attachment composer.
- Enable the actual guarded local Storage service for verification. It is
  currently disabled/excluded; do not reset unrelated local projects or rotate
  their marker just to enable it. Test actual synthetic upload/read/reload/order/
  delete, direct native denials, session revocation, account changes, rollback,
  cleanup and metadata privacy. SDK mocks alone do not qualify this migration.

Paid image transformation features are not prerequisites. Report local native
proof separately from hosted setup/delivery. Preserve meaningful verification
while replacing provider-specific fixtures for the approved fresh-media contract.

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

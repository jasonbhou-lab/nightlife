# NightOut

A React Native (Expo) app built from `PRD_Nightlife_Dining_Discovery_Platform.md` — venue
discovery, review, and booking across the PRD's five verticals: restaurants, bars, lounges,
cigar lounges, and nightclubs.

Visual direction is taken from `Blue and White Modern Mobile Prototype.png`: a deep-blue
gradient ground, white rounded cards floating on it with soft shadows, circular blue icon
badges, dark-navy inset pills for the numbers that matter, and bold section headers with a
small white pill button pushed to the right edge.

## Running it

```bash
npm install
```

```bash
npx expo start
```

Then press `a` for Android, `i` for iOS (macOS only), or `w` for web. Scan the QR code with
Expo Go to run on a physical device.

## What is implemented

Phase 1 and Phase 2 **consumer** scope from the PRD, against a seeded Houston database of
19 venues, 39 reviews, and 20 events.

| Area | Requirements covered |
|---|---|
| Search and discovery | F-SEARCH-01 through 07, 09 through 12 |
| Venue profile | F-PROFILE-01 through 06, 07, 08, 10, 11, 12 |
| Reviews | F-REVIEW-01 through 13 (client surface) |
| Media | F-MEDIA-01, 04, 05, 06 |
| Social | F-SOCIAL-01 through 07 |
| Booking | F-BOOK-01 through 04, 06, 09, 09a, 10, 11 |
| Events | F-EVENT-01 through 06 |
| Messaging | F-MSG-01, 02 (scoped), 03, 04 |
| Notifications | F-NOTIF-01 through 04 (preference surface) |
| Business portal | F-BIZ-01, 03, 04, 05, 06, 07, 09, 11, 13, 15 (each scoped down — see below) |
| Trust & Safety | F-TRUST-01, 04, 06, 08 (scoped — see below) |
| Usability | U-01 through U-11 (not U-12 — see *What is deliberately not implemented*) |

### The parts that carry the most weight

**Typed attribute registry** (`src/data/attributes.ts`). One declaration per attribute drives
four things: the category-aware filter sheet, the grouped profile panel, the six above-the-fold
decision attributes per category, and staleness expiry. This is the PRD's stated differentiator
from a general-purpose platform, so it is a registry rather than scattered fields.

**After-midnight hours** (`src/lib/hours.ts`). A club closing at 4 AM Saturday is open at 2 AM
on the Saturday-into-Sunday boundary. Every range whose close is not after its open is treated
as crossing midnight, and yesterday's range is checked against right now.

**Split schedules.** Kitchen, bar, retail, and lounge hours are separate labeled schedules, never
merged. "The kitchen closes before the bar" is answered on the profile without opening a review,
which the PRD names as the most common hours question at a bar or gastropub.

**Category-aware filters.** Selecting Cigar Lounge exposes humidor, locker, membership,
ventilation, and BYOC filters and *hides* the bar filters entirely — hidden, not disabled. The
result count updates live so over-filtering is visible before it produces an empty list.

**Zero-result recovery.** Names the specific filter to drop and how many venues dropping it
returns, rather than saying "try broadening your search".

**Provenance and staleness.** Every attribute carries a source and timestamp. Volatile fields
expire and are surfaced with their age: cover charge, tap lists, and lineups after 14 days,
happy hour after 60, hours after 90. A cover charge without a fresh timestamp renders as a dated
report, not as fact.

**Tonight Mode.** Time-aware module stack that reorders by hour — dinner and happy hour before
9 PM, bars/lounges/cigar from 9 to 11, clubs and late kitchens after 11. Happy hour shows time
remaining in the window, not a boolean flag. A clock control on the Tonight and Profile screens
lets you preview any hour without waiting for it.

**Booking adapted to the venue.** A single Reserve flow does not survive these five verticals, so
the form is chosen from the venue's booking modes: reservation grid, table service with a room
map and deposit, remote waitlist, bar holds (game-day table, tour slot, buyout), or a membership
and locker inquiry. A walk-in-only bar presents as walk-in-only rather than showing a dead
Reserve button.

**Review integrity.** Reviews the recommendation software does not recommend are excluded from
the rating and the default view but remain reachable behind a disclosed link, with no per-review
rationale exposed. Comped visits carry a disclosure badge. The aggregate rating weights recency,
reviewer trust, and detail, and the plain-language explanation of that is published in the app.

**Vibe search** (`src/lib/vibes.ts`, F-SEARCH-12). "Dressy," "date night," "low-key," and "bottle
service crowd" are the PRD's own examples, and none of them are things a venue says about itself —
they're what its reviews and photos show. Same honesty as F-SEARCH-11's natural-language parser:
a modest keyword-and-signal scorer, not an embedding model. It's a ranking layer, not a filter — a
named vibe reranks whatever the other active filters already turned up (paid placements still
pinned per F-SEARCH-09) by real evidence pulled from three places at once: the venue's own typed
attributes (a `dressCode` of `dressy` is the strongest single signal there is), its recommended
reviews' free text and structured occasion tags, and how many of its photos landed in a
correlated album. A venue with zero evidence does not appear, and every one that does shows
exactly what convinced it — "Dress code: Dressy · 1 review mentions it," not an unexplained score.

**Bar/Lounge tiebreak** (PRD Open Question 8). Dual-assigned venues filter on their primary
category, and in Tonight they surface as a Bar before 11 PM and as a Lounge after, since dwell
rises later. The rule is stated in the UI rather than left implicit.

**Messaging** (`app/messages/`). Consumer-to-business only, per F-MSG-05's deferral of
consumer-to-consumer messaging. The venue side of a conversation is real or it does not appear —
that discipline predates F-MSG-02 (see below) and still holds, it just means something different
now that a venue side can actually exist. What is real: the venue's published response time
(F-MSG-01, `venues.avg_response_minutes`), a structured intake form for private-event and buyout
requests (F-MSG-03), and abuse controls (F-MSG-04) — a client-side rate-limit courtesy backed by a
database trigger that is the actual control, plus block and report. Every message thread is
verified-account-only (R3) on the guest's side, the same gate as booking, since the PRD's
permission matrix requires it.

**Business replies, quick-reply templates, and auto-response** (`app/venue/messages.tsx`,
F-MSG-02, scoped). The original messaging migration locked `messages.sender` to `'user'` at the
schema level, with its own header explaining why: there was no business portal, so there was no
authenticated party on the venue side who could write a reply, and inventing one would have meant
modelling a conversation that never happened. There is a real business portal now, so that
constraint was stale, not principled — `sender` is `'user' | 'business'`, and a `'business'` row
requires holding a business role at the thread's venue, checked in the database the same way every
other business write in this app is. Two things sit on top of that real capability: quick-reply
templates (`business_reply_templates`, tap-to-insert into the composer, no keyword matching or
rules engine) and a single auto-response text sent once, synchronously, on the first message in a
new thread — not a "no human replied within N minutes" system, which would need a scheduler this
build doesn't have.

Building this surfaced a second stale assumption from the same original migration: the consumer's
own thread screen (`app/messages/[id].tsx`) never re-fetched anything from the backend after a
thread was created, which was entirely reasonable when nothing else could ever write into it. It
stops being reasonable the moment a business can reply, so this build added a real
refetch-on-open (`AppProvider.refreshThread`) — not a realtime subscription, matching the
fetch-on-mount pattern the moderation queue and bookings console already use. A business's reply
replaces local thread state with server truth rather than merging into it, which is what avoids
ever double-showing a message the consumer sent this session under its own temporary local id.

**Following, activity, and collaborative collections** (`app/community/`, F-SOCIAL-02, 04, 05).
"Follow users" has no real directory to search, because this build has no multi-user backend —
the account you sign in as is the only real account on the device. Rather than fake that with an
empty search box, the roster of followable people is the platform's own recurring reviewers
(`src/data/community.ts`), with `trust` and `elite` copied from their actual seeded reviews so the
two data sources cannot disagree. The activity feed (F-SOCIAL-02) is built from data that already
exists — reviews, events, and seeded check-ins — rather than a separate feed table. Check-ins
(F-SOCIAL-05) default to `'private'`, the explicit non-broadcast default the requirement asks for;
`'friends'` visibility is enforced in the feed-building code, not just in what the UI happens to
show, and one seeded check-in is `'private'` specifically to prove that filter has something to
reject. Collections (F-SOCIAL-04) carry per-venue attribution (`addedBy`) and an invitable
collaborator list, not just a `shared`-by-link flag with no one behind it — the seed data includes
one collection with a contribution pre-attributed to a community member, since a fresh local-only
collection could otherwise never show that the model supports it.

**Photo upload** (`app/photo/new.tsx`, `src/lib/media.ts`, F-MEDIA-01). A real upload path, not a
count-only stepper: pick from the camera or the library, and the image is re-encoded through
`expo-image-manipulator` before it ever reaches the network — producing a new JPEG drops embedded
EXIF (including GPS tags) as a side effect of how virtually every encoder works, which is the
closest a client-only build gets to F-MEDIA-05's metadata-stripping requirement without a server
in the loop to verify it. `by` (owner vs. community) is computed server-side from `business_roles`,
the same conflict-of-interest pattern F-TRUST-06 uses for reviews — a client cannot claim to be the
venue. A daily upload cap and the removal-*request* flow (F-MEDIA-04) are both real, database-backed
records; there is no moderation queue behind them to act on the request, for the same reason F-BIZ
and F-TRUST are out of scope for this client.

**Venue claim** (`app/claim/new.tsx`, F-BIZ-01, scoped). The PRD's actual requirement is
multi-path verification: an automated phone call, a postcard to the listed address, an email at
a matching domain, or manual document review. None of those exist here. What exists instead:
signing in and asserting a role (`owner` or `manager`) files a `venue_claims` row and stops
there — it neither creates a `business_roles` row nor flips `venues.claimed` on its own anymore.
Both of those now happen only once an admin approves it (see *Venue claim approval* right below);
before this session that self-attested confirmation took effect instantly, the same way filing a
photo removal request creates a real record with no queue behind it (see *Photo upload* below) —
claiming a venue no longer works that way, on request, specifically because letting anyone
instantly gain control of any unclaimed listing was too permissive for what it actually unlocks
(booking, messaging, and review-management tools on someone else's business). `venues.verified` is
still deliberately never touched by this path — it stays false, which the venue profile already
renders as "Claimed and unverified owner," so the self-attested state is not a broken one even
once approved. Only one claim or dispute can be pending on a venue at a time (a partial unique
index, not a client-side check); a rejected one frees the venue up for another attempt.

**Venue claim approval** (`app/admin/claims.tsx`, `app/(tabs)/profile.tsx`'s entry card). A new
`admin` platform role (`20260828100000_add_admin_platform_role.sql`) — distinct from moderator and
trust_safety, since deciding who runs a venue isn't a content-moderation call — with the same no
self-serve path every platform role in this app has: granted directly in the database, never
through the client. An admin sees every pending claim and can approve or reject it, with an
optional note shown back to the claimant on rejection; approving is what actually inserts the
`business_roles` row and flips `venues.claimed`, done atomically inside
`venue_claims_apply_decision()` (a `BEFORE UPDATE` trigger, the same shape
`content_reports_apply_moderation()` already uses for the moderation queue), not assembled by the
client across separate writes. Retiring the original self-serve path meant closing the door it
wrote through entirely, not just routing around it: `business_roles_claim_own` — the policy that
let any authenticated account insert its own `business_roles` row — is dropped outright, which
also surfaced and fixed a real, separate bug: that same policy's role check only ever allowed
`owner`/`manager`, so an invited **staff** member accepting their own invite (F-BIZ-13) had been
silently rejected by RLS this whole time. What replaces it now checks a real, unconsumed invite for
the exact venue, role, and the caller's own confirmed email, for both invite roles.
Verifying the approval path live also surfaced a second bug, caught before it shipped: the
existing `business_roles_mark_venue_claimed()` trigger had always relied on the account performing
the insert already holding a business role at the venue, true for the original self-serve claim and
for invite acceptance, false for an admin approving *someone else's* claim — so approval silently
failed to ever flip `claimed` on the first pass. Fixed with an explicit, narrow bypass flag rather
than loosening the actor check (see the header on `20260828100200_fix_claim_approval_venue_write.sql`).

**Ownership transfer and dispute** (`app/claim/new.tsx`, `app/claim/invite.tsx`, F-BIZ-02, scoped).
No defined SLA — the same reasoning every other SLA in this PRD has been cut for: there is no
notification/timer infrastructure to enforce one against, only a queue a human has to look at.
The PRD pairs two different actions under one requirement, and this build treats them
differently on purpose: **transfer** is cooperative — a current owner hands the venue to another
account through the same `business_invites` mechanism F-BIZ-13 already uses for staff and
managers, extended to allow `role = 'owner'` only when the sender already holds owner at that
venue. Accepting a transfer invite (the same "pending invite" card on Profile every other invite
uses) replaces the sender's own owner row rather than adding a second owner alongside it, but
leaves the outgoing owner's existing manager/staff invites untouched — nothing about a cooperative
handoff suggests the existing team is illegitimate. **Dispute** is adversarial — someone who is
*not* the current claimant contests an already-claimed venue, through the exact same
`venue_claims` table and admin queue a fresh claim uses, with evidence required (the database
enforces non-empty evidence exactly when the venue is already claimed, not this screen). Approving
a dispute is different from approving a fresh claim in one deliberate way:
`venue_claims_apply_decision()` checks whether the venue is *currently* claimed at decision time
and, if so, clears every existing `business_roles` row at the venue before installing the new
claimant — a dispute being approved means an admin decided the prior claim wasn't legitimate, so
nothing about who they'd invited should be assumed legitimate either. A venue's own detail page
only ever shows one of the two entry points, never both: "Claim this listing" when unclaimed,
"Dispute this claim" when claimed and this account doesn't already manage it.

**Real Supabase Auth** (`app/auth.tsx`, `src/data/repository.ts`). Every backend-write function in
this app — `publishReview`, `saveBooking`, `createMessageThread`, `uploadPhoto`, `submitVenueClaim` —
calls `supabase.auth.getUser()`, but nothing ever actually signed anyone in for real: `AppProvider`
only ever set local, unpersisted-past-this-device mock state. That is fixed for every user now,
not just for the claim flow: sign-in is a real one-time code emailed via Supabase Auth, no
password field, ever, matching the reasoning this screen already stated for why one never existed.
`handle_new_user()` (already in the schema since the first migration) seeds a real `profiles` row
from the display name on first sign-in. What this does *not* fix, on purpose: `phone_verified` and
`age_verified` remain self-attested, exactly as before — `profiles_guard_privileged_columns()`
rejects a client write to either column outright, and nothing server-side sets them, since there is
no real SMS provider wired up. That means real sign-in genuinely unblocks the writes that never
required verification — photo uploads, removal requests, and venue claims — but reviews, bookings,
and message threads stay exactly as blocked as before, since their RLS policies require
`private.is_verified()` and nothing here can make that true. With no backend configured, sign-in
falls back to the original local-only mock unchanged, so the app keeps working offline.

**Google sign-in** (`app/auth.tsx`, `src/data/repository.ts`'s `signInWithGoogle`). A second real path
onto the same account model as the one-time code above — there is no separate sign-up screen for
either, on purpose: the first successful sign-in for a given identity, email or Google, *is* the
account creation. Supabase Auth's OAuth flow is browser-based even from a native app: this app opens
Supabase's `/authorize` URL in `expo-web-browser`'s `openAuthSessionAsync` (a real system-managed
auth session on iOS/Android, not an in-app webview) and parses the session back out of the resulting
redirect with `expo-auth-session`'s `QueryParams` helper — Google's own consent screen, and the OAuth
client secret, never pass through this app at all, both stay on Supabase's side. `handle_new_user()`
was extended to read `full_name`/`name` out of Google's own profile data when `display_name` isn't
set (only the email-code path ever sets that key), so a first-time Google sign-in gets a real name
instead of the literal fallback "Guest" — see the migration header on
`20260827140000_add_google_oauth_display_name.sql`.
This needs configuration this repository cannot do on its own: a Google Cloud OAuth 2.0 Client
(type "Web application", authorized redirect URI `https://wfrgebdwbddhitjvqrhl.supabase.co/auth/v1/callback`),
its Client ID and Secret entered directly into the Supabase Dashboard under Authentication → Providers
→ Google (never through this app or this chat — the secret has to stay off the client and out of
version control), and this app's own redirect (`nightout://**`, or the exact `exp://` URL the dev
server prints, for Expo Go) added to Authentication → URL Configuration → Redirect URLs. Until that's
done, the button is fully wired and fails the same honest, visible way every other not-yet-configured
path in this app does — `signInWithOAuth` returns Supabase's own "provider not enabled" error, shown
in the same callout the email-code path already uses, not a silent no-op. On web specifically, local
development needs `expo start --web --https`; the redirect's crypto-state check requires the same
origin the flow started from, which plain `http://localhost` cannot satisfy — native and
standalone/dev-client builds are unaffected.

**Review response composer** (`app/reviews/[id].tsx`, F-BIZ-07, scoped). The full requirement also
asks for a sentiment summary, keyword themes, and alerting on new reviews below a threshold — those
need real analytics or ML this build does not have, the same reason F-MEDIA-02/03's automated
classification and screening are out of scope. The composer itself needed no invention: the
`owner_response`/`owner_response_at` columns have existed since the very first migration, and their
own guard trigger already said "owner responses are written through the business portal" — there
just wasn't a portal yet. A signed-in account only ever sees "Respond as owner" on a venue it
actually holds a `business_roles` row for (`AppProvider.isManagingVenue`, populated from a real
query, not a guess), and the database — not the client — rejects an update from that account that
touches anything on the review besides the response, so this can never become a backdoor to edit
someone else's review.

**Review alerting** (`app/venue/reviews.tsx`, F-BIZ-07's remaining half). Sentiment summary and
keyword themes stay out of scope for the reason above, but alerting on a low-rated review doesn't
actually need that infrastructure — it only needs a threshold and the same `rating`/`owner_response`
columns the composer already reads. A business account sets a star threshold on its own venue
(`venues.review_alert_threshold`, written through the same guard trigger as the auto-response and
hours, one more column in its allowlist); a review at or below it with no `owner_response` yet
surfaces here, with a count badge on the venue page's "Manage reviews" row. There is no push
notification behind this — nothing in this build has one (see F-MSG-01/02) — so "alerting" means
what it already means for the moderation queue and the bookings console: a number in the business
portal, not an out-of-band ping.

**Analytics dashboard** (`app/venue/analytics.tsx`, F-BIZ-08, scoped). Profile views, click-throughs
by action, traffic by daypart, a rating trend, and a category/neighborhood rating benchmark — all
from one new `venue_events` log plus data the app already has. Cut from the full requirement: search
impressions and the search terms driving them, which would mean instrumenting the discovery surfaces
(home feed, filter results, "Tonight") — a materially larger, more invasive change than this
venue-detail-page slice, and a reasonable next slice on its own rather than folded in here; a real
conversion funnel, since there is no impression stage to fund one without the above; click-throughs
for a website link (none is rendered anywhere in this app yet — a separate, pre-existing gap, not
something this quietly fixes on the side) or for ordering (F-ORDER stays deferred); and view-count
competitor benchmarking, which would need a `SECURITY DEFINER` aggregate crossing into other venues'
private event data — a new trust boundary not worth adding for a first version when a rating
benchmark, computed from data the `venues` table already makes public, satisfies the same PRD line
honestly. `venue_events` captures no actor at all — not a user id, not a device fingerprint, not even
for a signed-in visitor — so a business account refreshing its own listing inflates its own view
count; that is a known, accepted limitation, the same honesty this build already applies to other
simple counters, not a hidden one. The rating benchmark only shows once at least three other venues
share the same primary category and neighborhood — below that floor, a "median" is really just one
or two competitors' actual ratings with extra steps, and the PRD calls for this to be anonymized.

**Hours and happy hour editor** (`app/hours/edit.tsx`, F-BIZ-04, scoped). Dropped from the full
requirement: bulk/multi-location editing (F-BIZ-14 is out of scope, so there's nowhere to
bulk-apply to) and temporary closure scheduling (`closure_state`/`closure_note` are Trust &
Safety's field per F-PROFILE-12, not a business self-declaration). `venues` had no write policy at
all before this — not even for the account that claimed it. The guard trigger is a jsonb diff, not
an exhaustive column list: it allows a change to `schedules`, `happy_hours`, or `updated_at`, and
rejects the update outright if anything else on the row differs, so confirming hours can never
quietly become rewriting the venue's name, address, or claimed/verified flags through the same
door. The happy-hour summary field is free text and unmoderated — the screen carries the same
per-jurisdiction drink-pricing caveat the read-only hours screen already showed, rather than
pretending to enforce rules it can't.

Building this surfaced a real bug in three existing "sign in to continue" screens
(`app/photo/new.tsx`, `app/claim/new.tsx`, and this new one): each called `attemptContribution()`
directly in the render body when the session was a guest, which increments session state, which
re-renders the component, which called it again — an infinite loop (React's "Maximum update depth
exceeded") that this browser hit live. Fixed in all three by moving the call into a one-time
`useEffect`, not just the new screen.

**Menu and tap-list editor** (`app/menu/edit.tsx`, F-BIZ-05, scoped). Manual editing only — import
from CSV, PDF, or photo needs real OCR/parsing this build doesn't have, the same reason F-MEDIA-02's
automated photo classification is out of scope. A business account can add, edit, and remove
sections and items, and flip `soldOut` the moment a rotating tap kicks. Extends the same jsonb-diff
venue guard trigger `updateVenueHours` uses — one growing allowlist (`schedules`, `happy_hours`,
`menus`, `updated_at`) rather than a second competing trigger. Dietary tags reuse the exact label
set (`DIET_LABELS`, now shared from `src/lib/format.ts`) the read-only menu screen already renders,
so an owner can't type a tag value the display side doesn't recognize.

**Invite a manager or staff member** (`app/claim/invite.tsx`, F-BIZ-13, scoped). No role beyond
`manager`/`staff` (owner is a claim, not an invite; `group_admin` presupposes multi-location,
F-BIZ-14, which is out of scope) and no access audit log — an invite's own row is the only record
kept. This is honestly buildable now in a way it would not have been before real Supabase Auth
existed: acceptance is matched against the invited account's actual confirmed email
(`auth.jwt() ->> 'email'`), not a name someone typed, and it happens as a real `business_roles`
insert the database itself validates against a matching, unconsumed invite — not a status flip a
client could fake. Accepted invites surface on the Profile tab, addressed to whichever email the
signed-in account actually confirmed.

Directly simulating this flow under RLS (creating throwaway test accounts inside a transaction,
switching `request.jwt.claims` between them, and rolling back — not something reachable from this
sandbox's no-backend browser) surfaced a real, already-shipped bug: the hours-editor migration's
venue-write guard only allowed `schedules`/`happy_hours`/`menus`/`updated_at` to change, and never
knew about `claimed` — so `business_roles_mark_venue_claimed()`'s own `UPDATE venues SET claimed =
true` had been failing since the moment that guard shipped, meaning **every claim, self-serve or
invited, against a real backend was silently broken**. Fixed by adding `claimed` to the allowlist.

**Listing tagline and about editor** (`app/venue/edit.tsx`, F-BIZ-03, scoped way down). The full
requirement is a listing editor covering every Section 3 typed attribute — dress code, cover
charge, noise level, and dozens more, each per category — with change history and rollback. That
is a real, separate feature, not something to rush alongside two free-text fields, so this is just
`tagline` and `about`. Extends the same jsonb-diff venue guard every prior F-BIZ venue-write
feature has used. Caught before it shipped, by exercising the same direct-RLS-simulation technique
the invite feature needed: `tagline` feeds `search_text` (recomputed by the original schema's own
`venues_before_write_trg`, which — alphabetically before this guard — runs first), so the first
version of this migration rejected every tagline edit outright for changing a column it didn't
know was a legitimate side effect. Fixed by adding `search_text` to the allowlist alongside
`tagline` itself.

**Own-data export** (`src/lib/export.ts`, F-BIZ-15, scoped). A managing account downloads its own
venue's reviews received, media, and listing basics as JSON. Left out on purpose: "analytics" —
there is no page-view/impression tracking anywhere in this build to export, the same honesty gap
as F-BIZ-08 — and the team roster/sent invites, since `business_invites_select`'s RLS only lets
the signed-in account see invites *it* sent, so a multi-manager venue would export a silently
incomplete team list rather than a complete one. Everything included here (reviews, photos) is
already public; this packages it for the business rather than granting new access. Web gets a real
file download; native gets the OS share sheet with the same JSON as text, since there's no
file-download API to reach for without a new dependency and the PRD makes web the primary business
portal surface anyway. The one feature in this list verifiable fully end-to-end in this sandbox,
since it never touches the backend at all — confirmed live by spying on `URL.createObjectURL` and
reading the resulting blob back.

**Offers and promotions** (`app/venue/offers.tsx`, F-BIZ-09, scoped). A self-published offer — a
first-visit incentive, a no-cover window, a membership special — not a purchased placement:
deliberately no budget, targeting, or ranking boost (F-BIZ-10 stays out of scope). This is the one
F-BIZ feature built as its own table with real RLS rather than another jsonb-diff venue-write
guard, since an offer is naturally a list with a lifecycle — created, expires, removed early — not
one blob a business rewrites wholesale, the same shape as photos and business_invites. Carries the
same per-jurisdiction drink-pricing disclaimer the happy-hour editor already showed, since alcohol
and tobacco promotion rules vary by state and this build doesn't attempt to enforce them. Verified
directly against the database before building the client at all: a throwaway owner account could
post and edit an offer, an unrelated account's edit attempt silently touched nothing, an unrelated
account's insert attempt hard-failed, and an anonymous read saw the same row — all inside a rolled-
back transaction, the same technique that had already caught two real bugs in earlier F-BIZ
migrations.

**Moderation queue and Trust & Safety tools** (`app/moderation/index.tsx`, `app/venue/[id].tsx`'s
Trust & Safety card, F-TRUST, scoped). Before this, "Report this review" was a local
`Alert.alert` with five reasons and no submission anywhere — this build's one genuine,
previously-undiscovered gap of the same shape as the age-gate bug: a real-looking control with
nothing behind it. It is real now: a `content_reports` row, a queue, and two roles with
different power, matching R11/R12 from PRD Section 2.3 — a moderator can dismiss, remove, or
escalate a report; only a trust_safety account can resolve what gets escalated, restore a
review it removed, apply or clear a Consumer Alert (`venues.consumer_alert`, present in the
schema since the very first migration but never written until now), or freeze new reviews at a
listing. There is no self-serve way to acquire either role — unlike a business claim, "I work
in Trust & Safety" isn't a claim a client should ever get to assert, so a `platform_roles` row
is granted directly in the database, the same honest gap as `elite`/`trust` on profiles having
no client-side path to earn them. Every removal, restoration, and Consumer Alert change writes
an entry to `moderation_actions`, a table with no update, delete, *or insert* policy for any
client role at all — every row is written by a `SECURITY DEFINER` trigger reacting to an
already-RLS-gated client action, which is the actual meaning of "immutable" here rather than
a naming convention. Left out on purpose: automated pre-screening and coordinated-behavior
detection (F-TRUST-02/05, need real ML/heuristics this build doesn't have, the same reason
F-MEDIA-02/03 and F-BIZ-08 are out), an appeal flow reviewed by a second, distinct person
(F-TRUST-03, needs a case-assignment model this build doesn't have), transparency reporting
(F-TRUST-07, priority C, needs aggregate reporting), and photos/Q&A in the queue (reviews are
the only content type with a real report entry point in this client). Every moderation action
resolves a specific report on file — there is no "just remove this" door for a moderator
patrolling without one.

**Reservation and waitlist console** (`app/venue/bookings.tsx`, F-BIZ-11, scoped). Real visibility
into bookings and waitlist entries at a venue a business account manages — confirm a requested
table, cancel a no-show, seat or remove someone waitlisted — matching the "manage reservations and
waitlist" cell the permission matrix (Section 2.4) already claimed for R7/R8/R9. No floor map, no
real-time table-tier status, no staff assignment: those need an interactive room-map UI built
against `table_tiers`, a genuinely different feature from giving a business a list it can act on.
`guestName` comes from a device-side join against `profiles`, and is absent (falls back to
"Guest") rather than invented when the guest's own profile isn't public.

Building this surfaced the largest gap found this session: `saveBooking` had existed in the
repository layer since early in the build, fully wired to real RLS, and **nothing had ever called
it**. Every one of `app/book/[id].tsx`'s five booking forms (reservation, table service, waitlist,
bar hold, inquiry) only ever wrote to local device state. No booking made through this app, in any
prior session, had ever reached the backend — a business console reading the real `bookings` table
would have shown nothing, for anything, ever. Fixed alongside this feature, not as a separate
pass, because a console with permanently zero real data is not a feature, it's decoration: all
five forms now call `saveBooking` when a backend is configured, use its real id, and only show a
confirmation once that succeeds — falling back to a local-only id exactly as before when there is
no backend (U-07). A second, smaller instance of the same shape of bug came with it:
`AppProvider.cancelBooking` also only ever updated local device state, so a guest cancelling their
own booking would have left a permanently-stale row for the venue to see. Both are fixed the same
way messaging already handles this — local state updates immediately, the remote write mirrors it
best-effort afterward.

**Cover photo and reorder** (`app/venue/photos.tsx`, F-BIZ-06 / F-MEDIA-06, scoped). A business
account can select one of its own venue's owner-credited photos as the cover and reorder its own
uploads — the `Photo` type has carried a comment anticipating exactly this since the original
photos migration ("Owner media can be reordered by the owner; community media cannot"), but
nothing implemented it until now: the original migration's own header said "once posted, a photo
is immutable from the client," no update policy at all. Cover selection is scoped to
owner-credited photos too, not any public-read photo a business might like — the PRD draws the
reorder line at community media, and this build draws cover selection the same line, so community
photos stay genuinely untouchable by a business account either way. At most one cover per venue,
enforced by a trigger that clears any previous cover automatically rather than trusting the client
to unset it. Building this also fixed a real, separate bug it exposed: the photo fetch in
`repository.ts` had no `.order()` clause at all, so gallery order was undefined — whatever
Postgres happened to return, not a real sort.

## What is deliberately not implemented

- **No payments.** Deposit flows display real terms and capture affirmative acceptance, then stop.
  No card fields exist anywhere in the app.
- **No password, anywhere, ever.** Sign-in is a real Supabase Auth account when a backend is
  configured (see *Real Supabase Auth* above) — a one-time emailed code, not a mock. Without a
  backend, it falls back to a local, unpersisted-past-this-device identity. Neither path has, or
  will ever have, a password field: a prototype that collects credentials teaches people to hand
  them over.
- **No real phone or age verification.** The second sign-in step is self-attestation only, and
  cannot become anything else without a real SMS provider — the database actively rejects a client
  attempt to set `phone_verified`/`age_verified` itself. What standard is actually required, and
  whether it differs for browsing versus transacting, is PRD Open Question 3.
- **No age gate at all (U-12 removed, not just deferred).** The PRD requires one ("Age gating is a
  single friction point per session, not a repeated interruption," priority M), and this build had
  one (`src/components/AgeGate.tsx`) until it was deliberately removed. While it existed, its "Yes,
  I'm 21+" button — reachable by any guest, no sign-in required — called the same `verifyAge()` used
  by the real phone-verification step, silently granting full `phoneVerified`/`role: 'verified'`
  status (and therefore booking and review eligibility) to an anonymous guest who never signed in or
  gave a phone number. Removing the gate removes that path along with it. This is a genuine gap
  against a must-have requirement for an app whose every venue serves alcohol or permits tobacco,
  not a cosmetic simplification — treat it as something to revisit with counsel before any of this
  became a real product, per the PRD's own framing of age standards as an open legal question
  (Section 9, Open Question 3) rather than a product team's default to set.
- **Business portal and internal tooling** (F-BIZ, F-ADMIN). Out of scope for a consumer client;
  the PRD makes web the primary surface for these. Their consumer-visible *outputs* are
  implemented: Consumer Alert banners, owner-answer badges, paid-placement labels,
  claimed/unclaimed states, closure and successor handling. Fourteen exceptions are real, scoped-down
  business-portal actions rather than just consumer-visible outputs: F-BIZ-01's claim step
  (self-attestation gated behind admin approval, not the PRD's actual multi-path verification),
  F-BIZ-02's ownership transfer (cooperative, via invite) and dispute (adversarial, via the same
  admin queue as a fresh claim, evidence required) — no defined SLA, either, same reasoning as
  F-BIZ-01, F-BIZ-03's tagline/about editor
  (not the full typed attribute registry, and no change history/rollback), F-BIZ-04's
  hours/happy-hour editor (no bulk/multi-location, no closure scheduling), F-BIZ-05's menu/tap-list
  editor (no CSV/PDF/photo import), F-BIZ-06's cover photo and reorder (owner-credited photos only,
  same as F-MEDIA-06 draws it), F-BIZ-07's review response composer and threshold-based alerting (no
  sentiment summary or keyword themes, and no push notification behind the alert — see F-MSG-01/02),
  F-BIZ-08's analytics dashboard (profile views, click-throughs, daypart traffic, a rating trend, and
  a rating-only competitor benchmark — no search impressions, funnel, website/order click-through, or
  view-count benchmarking), F-BIZ-09's offers (self-published only — no budget, targeting, or
  ranking boost, and no per-jurisdiction pricing enforcement), F-BIZ-11's reservation and waitlist
  console (no floor map, real-time table-tier status, or staff assignment), F-BIZ-13's
  invite-a-manager flow (manager/staff only, no access audit log), and F-BIZ-15's own-data export
  (reviews and media, not the new analytics — that lives in its own dashboard, not the export file —
  and not the team roster). Everything else — the typed attributes themselves beyond a cover flag,
  advertising, and the rest of F-BIZ-10, 12, and 14 — has no dashboard here at all. F-TRUST is a
  partial exception of
  its own now — see
  *Moderation queue and Trust & Safety tools* above — covering a reviews report queue and Consumer
  Alert/contribution-freeze controls, not the full moderation console (no automated pre-screening,
  coordinated-behavior detection, appeal flow, or transparency reporting).
- **Ordering and delivery** (F-ORDER). Menus render with availability and the alcohol-delivery
  rule is stated; checkout is not built.
- **Automated photo classification into albums** (F-MEDIA-02). Album is a real, stored field —
  it's just chosen by the uploader from a chip list rather than by a vision model. Seed photos
  still render as a deterministic gradient plus the album icon, since the app bundles no stock
  photography; a real upload renders as the actual image (see *Photo upload* below).
- **Automated content screening** (F-MEDIA-03). Screening only means something with a moderation
  queue and reviewers to act on it, and F-TRUST/F-ADMIN are out of scope for the same reason F-BIZ
  is — there is no internal tooling in this client. What's real instead: the removal-*request*
  flow itself, and a database-enforced daily upload cap.
- **Map tiles.** `MiniMap` is a schematic map with normalized coordinates, because the demo has no
  network dependency or API key. It implements the requirement that matters — pin interaction and
  map-bounded re-search. Swapping in `react-native-maps` later replaces that one component; the
  bounds contract is unchanged.

## Backend

Supabase. The schema, row-level security, and seed live in `supabase/`; the client and data
access layer in `src/lib/supabase.ts` and `src/data/`.

### Bringing it up

```bash
cp .env.example .env
```

Put the project URL and publishable key in `.env` (Supabase dashboard → Project Settings → API
Keys). Then apply the schema and seed:

```bash
npx supabase link --project-ref wfrgebdwbddhitjvqrhl
```

```bash
npm run db:push && npm run db:seed && npm run db:types
```

Restart the bundler with `npx expo start --clear` so the new env vars are inlined. The Profile
screen shows which source is live; the Search screen shows a banner whenever it is not the
database.

### What the schema does

Venue *documents* — schedules, menus, photos, Q&A, attributes — are `jsonb` on the venue row,
because they are always read as a whole venue. Things written or queried on their own get real
tables: reviews, bookings, collections, events, table tiers, profiles.

The PRD requires attributes to be filterable, not merely displayable, and `jsonb` does not give
that up: containment filters run off a GIN index, and the numeric comparisons the filter sheet
actually issues (tap count, humidor size, cover ceiling) have expression indexes. The attribute
*registry* stays in `src/data/attributes.ts` as the schema of record, which is what keeps one
declaration driving the filter sheet, the profile panel, and staleness expiry. The alternative —
roughly a hundred typed columns, most of them null for any given vertical — buys stricter typing
at the cost of a migration every time a vertical gains an attribute.

### Rules enforced in the database, not the client

NFR-07 says role-based access control is enforced server-side and client-side gating is
presentation only. So:

- Writing a review requires a verified account, your own `author_id`, and no business role at
  that venue — the conflict-of-interest rule from F-TRUST-06 is a policy predicate, not a UI check.
- `recommended`, the community feedback counts, and owner responses are rejected by trigger if a
  client tries to set them. A reviewer cannot place their own review into the rating.
- `trust`, `elite`, and the verification flags are server-maintained; a user updating their own
  profile cannot raise them.
- Bookings, collections, and drafts are readable and writable only by their owner. Shared
  collections are readable by link, which is the one deliberate exception.
- A deposit cannot be recorded without the terms acceptance that F-BOOK-11 requires.
- A business account can see and move a booking through its lifecycle at a venue it manages, but
  only through `status`, `wait_minutes`, and `waitlist_position` — the guest's own submission
  (date, time, party size, deposit, notes) is off limits through that door (F-BIZ-11).
- A `messages` row can only ever carry `sender = 'user'` from the account that owns the thread, or
  `sender = 'business'` from an account holding a business role at the thread's venue — never the
  other way around, and never both at once from the same account (F-MSG-02).
- A business account can set `sort_order`/`is_cover` on its own venue's owner-credited photos and
  nothing else — not caption, album, or any community photo, regardless of how convincing the shot
  is (F-BIZ-06).
- A message thread's `sender` column is constrained to `'user'` at the schema level, and a rate
  limit (5 seconds per thread, 40 per account per hour) is enforced by trigger, not just by the
  composer disabling Send (F-MSG-04, NFR-11).
- A photo's `by` (owner vs. community) is computed from `business_roles` by trigger, never trusted
  from the client, and a daily upload cap (8 photos, 40 for Elite) is enforced the same way
  (F-MEDIA-01). An upload's storage path is checked against real venue ids before it's accepted,
  not just organized by convention.
- A business account can set `review_alert_threshold` on its own venue and nothing else through
  that write — the check constraint also rejects a value outside 1–5 at the row level, not just in
  the chip picker the client happens to offer (F-BIZ-07).
- Any client can log a `venue_events` row for a real venue (an insert-only, no-actor-captured log —
  a foreign key is what keeps `venue_id` honest), but only a `business_roles` holder for that venue
  can read its own venue's raw events back; a different venue's events are invisible even to a
  business account, and the client-side aggregation in `src/lib/analytics.ts` never sees them to
  begin with (F-BIZ-08).
- A venue claim can only ever be inserted as `pending`, by the claimant, for a venue that isn't
  already claimed; only an admin's `UPDATE` can move it to `approved` or `rejected`, and that
  `UPDATE` may only ever touch `status` and `note` — a jsonb-diff guard rejects anything else on
  the row changing in the same statement. `business_roles` itself has no client-facing insert path
  left for a fresh claim at all; the only doors onto it are accepting a real invite (checked against
  an actual, unconsumed `business_invites` row) and the claim-approval trigger, which runs as the
  system, not as the admin who triggered it (F-BIZ-01).
- A venue claim against an *already-claimed* venue is only accepted with non-empty `evidence` — a
  `WITH CHECK` on the insert, not a client-side form validation, so there is no way to submit a
  bare dispute even by calling the table directly. An owner-transfer invite (`role = 'owner'` in
  `business_invites`) can only be sent by an account that already holds `owner` at that venue, and
  accepting one deletes the sender's own owner row in the same trigger that inserts the new one —
  there is no window where two accounts hold owner at once (F-BIZ-02).

One thing deliberately *not* a table constraint: the 60-character floor on review text. It is
enforced by trigger on client inserts instead, because as a `CHECK` it would make the corpus
unable to hold the low-effort spam the recommendation software exists to catch, or to ingest
historical rows from a provider feed.

### Offline and fallback

`src/data/repository.ts` never throws. If the backend is absent or unreachable it returns the
bundled seed and reports why, and the UI says so rather than showing a spinner or a blank screen.
That is not politeness — U-07 requires saved venues and confirmations to stay readable without
connectivity, and the PRD is explicit that club basements have poor signal.

The catalogue is fetched whole and filtered on-device by the existing engine. That is the right
shape at launch-metro scale — one round trip, then instant filtering, and it works offline. It is
**not** the right shape at the 50M-venue scale of NFR-03; at that point the filter predicates move
into a Postgres RPC and `repository.ts` starts passing filters down instead of fetching everything.
The seam is in one file so that change stays contained.

### Keys

`EXPO_PUBLIC_*` variables are inlined into the shipped bundle. That is correct for the project URL
and publishable key, which are designed to live in a client and are backed by RLS. The service role
key must never go in an `EXPO_PUBLIC_` variable or in `.env` — it bypasses RLS entirely, and in a
client bundle it would hand every user full access to the database. `.env` and `.env.local` are
gitignored; `.env.example` is the committed template.

## Compliance posture

The PRD flags a set of areas as carrying real legal exposure. This build takes the conservative
side of each rather than guessing:

- Indoor smoking at a cigar lounge is recorded and labeled as **the venue's own declaration**, and
  the app never asserts legality as platform fact.
- Ventilation is shown as venue-declared alongside an independent community rating dimension.
- Happy hour windows are presented as published by the venue, with a note that drink-price
  promotion rules are state-by-state and that the offers system is built for per-jurisdiction
  enforcement rather than one national template.
- Alcohol is excluded from delivery unless both the venue and the jurisdiction permit it and age
  is verified at handoff.
- There is **no consumption-volume gamification** anywhere — no drink counts, no bar-crawl
  streaks, no check-in rewards tied to bars. The PRD recommends avoiding it entirely over dram
  shop exposure, and that recommendation is followed.
- Paid placements are labeled at every breakpoint and excluded from the "similar venues" module.
- Transactional notifications are structurally separate from marketing consent.
- No face detection is performed.

None of the above is legal advice, and the PRD's own instruction stands: qualified legal and
compliance counsel should review each area before the corresponding functionality ships.

## Layout

```
app/                     expo-router routes
  (tabs)/                Home, Search, Tonight, Saved, Profile
  venue/[id].tsx         venue profile
  reviews/[id].tsx       all reviews, incl. the disclosed filtered set
  hours/[id].tsx         full-week split schedules
  menu/[id].tsx          menus, tap lists, bottle lists, humidor highlights
  book/[id].tsx          the five booking forms
  review/new.tsx         composer with draft autosave
  events/index.tsx       event discovery
  collection/[id].tsx    a saved collection
  auth.tsx, onboarding.tsx
src/
  theme/                 design tokens, light and dark
  types.ts               domain model
  data/
    attributes.ts        the typed attribute registry
    taxonomy.ts          verticals and categories
    venues|reviews|events.ts   bundled seed / offline fallback
    catalogue.tsx        catalogue context: whichever source is live
    repository.ts        Supabase reads and writes, with seed fallback
  lib/
    hours.ts             operating calendar, after-midnight math
    search.ts            filtering, ranking, zero-result recovery
    ratings.ts           aggregate weighting and its published explanation
    decide.ts            per-category decision attributes
    format.ts            value rendering, provenance, action sets
    supabase.ts          client
    database.types.ts    generated by `npm run db:types`
  state/AppProvider.tsx  session, filters, saves, bookings, drafts, prefs, clock
  components/            design-system primitives and composites
supabase/
  migrations/            schema, RLS, triggers
  seed.sql               generated from src/data by npm run db:generate-seed
scripts/
  generate-seed-sql.ts   keeps the SQL seed from drifting off the TS seed
```

## Notes on the seed data

Composition is deliberate. Bars outnumber every other vertical, matching the PRD's own
observation (Open Question 10) that bars will dominate the corpus. The set also carries the
awkward cases on purpose, so the UI has to handle them rather than pretending they are rare:

- **Verso Rooftop** is a restaurant until 10 PM and a dance club after, at one address.
- **Bramble & Bloom** carries both Bar and Lounge, exercising the tiebreak rule.
- **Ratchet & Rail** is unclaimed, cash-only, and not wheelchair accessible, with
  community-sourced attributes going stale.
- **Halcyon Room** is permanently closed and points at its successor listing.
- **Sala Roja** carries a Consumer Alert and two coordinated fake reviews.
- **Kirby & Third** and **Zafeera Lounge** are paid placements.
- **Bayou Leaf** has retail hours that genuinely differ from its lounge hours.

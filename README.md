# Nightlife

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
| Booking | F-BOOK-01 through 04, 06, 07, 09, 09a, 10, 11 |
| Events | F-EVENT-01 through 06 |
| Messaging | F-MSG-01, 02 (scoped), 03, 04 |
| Notifications | F-NOTIF-01 through 04 (preference surface) |
| Business portal | F-BIZ-01, 03 (full), 04, 05, 06, 07, 09, 10, 11, 13, 15 (rest scoped down — see below) |
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

**The composer's "Publish review" button used to do nothing real** (`app/review/new.tsx`). It
called `clearDraft` and jumped straight to the "Published" success screen — `publishReview()`
(`src/data/repository.ts`) already existed, already inserted a real row, and was never called from
here. No review written through this screen had ever actually reached the database; the draft was
simply discarded and the app lied about the rest. Now wired for real: the button calls
`publishReview`, shows a loading state while it's in flight, and — with no backend configured, the
one case this could not previously be told apart from a real publish — surfaces the actual failure
in a callout instead of the same fake success screen, leaving the draft intact so nothing already
typed is lost. A successful publish triggers a full catalogue `reload()` rather than an optimistic
local patch, the same fetch-on-write pattern already used for threads and bookings, since there is
no local append path for a freshly published review the way `addLocalPhoto` exists for photos.

**Vibe Rating** (`src/components/Flames.tsx`, `Review.vibeRating`, `Venue.vibeRating`). A second
1-5 rating axis — energy/atmosphere rather than quality — given the exact same treatment as the
star rating: a mandatory whole-number tap per review (`FlameInput`, alongside `Overall` in the
composer), the same weighted aggregate (`aggregateFor` now returns `vibeRating`/`vibeDistribution`
next to `rating`/`distribution`, using the identical recency/trust/detail weights), the same static
seeded rollup column on `venues` with no server-side recompute trigger, shown everywhere the star
rating is: the venue card, the profile header, the reviews list, and as its own "Vibe" sort key and
3/4/4.5-flame filter in the search sheet. Seed reviews predate this axis, so their `vibeRating`
defaults to their `rating` (documented in `src/data/reviews.ts`) rather than inventing sentiment no
reviewer expressed; venue-level `vibeRating` was hand-set per venue to reflect atmosphere
independent of quality — a rowdy nightclub with a middling star rating can carry the highest vibe
rating in the corpus, and a quiet excellent cocktail bar the lowest, which is the point of a second
axis. Named `Flames`/`FlameInput`/`vibeRating` rather than reusing `vibes.ts`'s `VibeKey`/`VibeDef`
(F-SEARCH-12's mood-based *search ranking* concept) — same English word, two unrelated systems, so
the code makes them look unrelated too.

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

**Cuisine and atmosphere filter** (`src/components/FilterSheet.tsx`, `FilterState.categories`,
extends F-SEARCH-04). Lets a consumer filter on the venue's own subcategory — Tex-Mex, Speakeasy,
Dive Bar, Latin Club — which previously only surfaced through free-text search and typeahead, not
as a discrete filter chip. This exists because of an explicit steer away from a different request:
the initial ask was a consumer-facing picker for the *race or ethnicity associated with a venue's
environment*, built from a list of U.S. Census-style ancestry categories. That was declined rather
than scoped down — a "pick the venue's racial/ethnic environment" filter is a mechanism for
racially steering customers toward or away from venues, which is exactly what public-accommodation
law (Title II of the Civil Rights Act, and state equivalents, both of which cover bars,
restaurants, and nightclubs) prohibits, regardless of neutral framing or good intent on any single
user's part. What shipped instead describes the venue, never its patrons: culinary tradition,
music/programming (layered on the existing `genres` attribute, F-SEARCH-04/F-EVENT), and
atmosphere/theme, all drawn from the taxonomy in `src/data/taxonomy.ts` that already existed for
every venue. Selecting a vertical narrows which subcategories show, same discipline as every other
category-aware filter here; deselecting one drops any now-irrelevant picks rather than leaving a
stale, invisible filter active.

**Google Maps** (`src/components/MiniMap.web.tsx`, `MiniMap.native.tsx`, F-SEARCH-03). The map
toggle in search used to be a schematic gradient-and-grid placeholder with hand-picked 0..1
coordinates — no network dependency, no API key, no real geography. It's now a real Google Map on
every platform, which turned out to need two files, not one: there is no single library today that
renders Google Maps on web *and* iOS *and* Android from one component in a Metro-bundled Expo app.
Web uses `@vis.gl/react-google-maps` (Google's own actively-maintained wrapper around the Maps
JavaScript API); native uses `react-native-maps` with `provider="google"` set explicitly — without
it, iOS quietly falls back to Apple Maps, which is not what "Google Maps everywhere" means. Both
files export the identical `{ venues, onSearchArea }` shape the old single component did, so
nothing calling `MiniMap` had to change; Metro's own filename-suffix resolution (`.web.tsx` /
`.native.tsx`) picks the right one per platform, the same mechanism `app/(tabs)/index.tsx` and
every other screen already rely on implicitly. `tsconfig.json` gained a `moduleSuffixes` entry so
`tsc` can follow that same resolution — worth knowing if a future platform-split file's import
mysteriously "can't be found" by the type checker despite building fine.

Real venue coordinates didn't exist before this either: `venues.lat`/`lng` were columns in the
schema (added for a haversine distance calculation in `withDistances()`) but had never actually
been populated, so that function's real-math branch was always silently skipped in favor of the
seed's hand-set `distanceMi`. Backfilling real Houston coordinates for all 19 seed venues fixes
that as a side effect, not just feeds the map. The old normalized `map_x`/`map_y` columns had no
remaining reader once the schematic map was deleted and were dropped rather than left as dead
schema — see `20260828160000_add_real_coordinates.sql`.

**Setup this repository cannot do on its own**, the same shape as the Google Sign-In section
above: three separate Google Maps Platform API keys from a Google Cloud project with billing
enabled (a monthly credit covers ordinary development use, but it is not free-forever the way the
Supabase publishable key is) — one for "Maps JavaScript API" (web, HTTP-referrer restricted), one
for "Maps SDK for iOS" (bundle-id restricted), one for "Maps SDK for Android" (package + SHA-1
restricted). Exact instructions and env var names are in `.env.example`. The web key is
`EXPO_PUBLIC_*` on purpose (a JS API key is designed to ship in a page; the referrer restriction is
what protects it); the two native keys are read only by `app.config.ts` at `expo prebuild` time and
never enter the JS bundle. Without the web key, `MiniMap.web.tsx` shows an honest "Map unavailable"
message rather than a blank screen or a fetch loop against an undefined key. `mapId="DEMO_MAP_ID"`
on the web map is Google's own published sandbox id for `AdvancedMarker` — it needs no Cloud
Console styling setup, but Google's docs are explicit that it should not ship to production; a real
Map ID takes five minutes to create once this has a production Cloud project. Native maps also
need a development build, not Expo Go, once a real key is configured — standard for any Expo
project using `react-native-maps`, not specific to this one.

**What's out of scope**: the "Directions" action on a venue profile still deep-links out to
`maps.google.com` with the address (`Linking.openURL`, no API key needed for that) rather than
rendering turn-by-turn directions in-app — the Directions API and route rendering are a
meaningfully different feature from "show pins on a map," and nothing asked for in-app navigation.
Marker clustering at low zoom, satellite/traffic layer toggles, and a single-venue mini-map on the
profile screen itself are all real Google Maps features this build doesn't turn on — the ask was
parity with the schematic map's own feature set (pins, pan/zoom, bounded re-search), now on real
tiles, not a superset of it.

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

**Real account deletion** (`delete_own_account()`,
`20260829100000_add_delete_own_account.sql`). "Delete my account" on the profile screen used to
show a confirmation dialog and then only sign the device out — the account and every row under it
were still there on the next sign-in. `profiles.id` carries no formal foreign key to `auth.users`
(checked directly against the schema before writing this), so the function deletes both explicitly,
`profiles` first. Every table that references `profiles(id)` already does so `ON DELETE CASCADE` or
`ON DELETE SET NULL` — verified against `pg_constraint`, then simulated with `BEGIN`/`ROLLBACK`
against a real profile before this was ever applied for real — so deleting the profile alone already
removes bookings, collections, message threads, photos, review drafts, and this account's business
and platform roles, while reviews and moderation history keep existing rows with `author_id`/
`actor_id` set to null rather than disappearing, the same pattern `content_reports` and
`venue_claims` already use elsewhere in this schema. Out of scope, on purpose: this account's
uploaded photos' `storage.objects` rows are not swept — this build has no established path for that
at all yet, the same real gap `photo_removal_requests` already has (a request is filed, never
auto-executed). With no backend configured, deletion falls back to the same local sign-out the
no-backend mock always did, honestly matching what that identity ever was.

**The emailed link, and why consuming one is gated twice** (`src/data/repository.ts`'s
`completeAuthFromUrl`). Whether Supabase's email carries a 6-digit code or a tappable link is a
dashboard template choice, so the app accepts both; the link arrives back as an OS deep link and is
exchanged for a session. A session installed that way *becomes the device's identity*, and
everything written afterwards — reviews, bookings, messages, photos, drafts — is written into
whatever account those tokens belong to, so two checks gate the exchange. First, the URL has to be
the auth callback: the first cut consumed any deep link carrying `access_token`/`refresh_token`,
which on native meant a QR code or SMS pointing at `nightout://venue/vela?access_token=…`, and on
web meant an ordinary hyperlink to the deployed origin, since expo-linking's `getInitialURL()` there
returns `window.location.href` verbatim and `vercel.json` rewrites every path to the app. Second,
this device has to have actually requested a link within the hour, because the path check alone
still leaves forced-login open — nothing stops an attacker from spelling the callback path correctly
and appending their own tokens, and the victim would go on using an account that is not theirs.
Supabase's implicit flow carries no state or nonce to verify against, so a locally recorded request
stands in for one and an unsolicited callback is refused. The cost is that a link requested on one
device cannot be opened on another; that is already true of a custom-scheme deep link, and the code
in the same email is the cross-device path. A real `state` parameter or PKCE would replace the local
gate with a server-verified one, and is the right next step — it is a larger change because Google
sign-in shares the same implicit-flow client. Google's own path never went through this listener:
`openAuthSessionAsync` captures its redirect directly.

**Google sign-in** (`app/auth.tsx`, `src/data/repository.ts`'s `signInWithGoogle`). A second real path
onto the same account model as the one-time code above — there is no separate sign-up screen for
either, on purpose: the first successful sign-in for a given identity, email or Google, *is* the
account creation. How the browser gets to Google differs by platform. Native opens a real system-managed auth session,
which is both the platform-correct pattern and a hard requirement, since Google refuses OAuth inside
an embedded webview. Web hands over the current tab instead: `expo-web-browser` implements
`openAuthSessionAsync` with `window.open`, so routing web through it popped a second window, and
leaving `skipBrowserRedirect` off instead lets supabase-js `window.location.assign` the tab in place.
The web leg therefore comes back through the ordinary callback route on the next page load rather
than returning inline, which means it has to satisfy the same gate the emailed link does — so the
auth-flow mark is written *before* navigating away, and survives the round trip because AsyncStorage
is localStorage on web. `signInWithGoogle` returns a distinct `'redirecting'` outcome for this case:
nothing queued after the call is guaranteed to run once navigation starts, so the caller keeps
showing progress rather than flashing "signed in" at a page about to unload.

Supabase Auth's OAuth flow is browser-based even from a native app: this app opens
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

**Attribute editor and change history** (`app/venue/attributes.tsx`, `app/venue/attribute-history.tsx`,
F-BIZ-03, full). The listing editor above was scoped down to tagline/about specifically because the
rest — every Section 3 typed attribute, with change history and rollback — was a real, separate
feature. This is that feature: every field `src/data/attributes.ts` defines for a venue's vertical
(dozens, across boolean, enum, multi-select, integer, currency, and time types) is editable, grouped
and ordered identically to the read-only profile panel (both now call the registry's own
`groupOrderForVertical` rather than each keeping their own copy of the ordering, after the second one
very nearly drifted from the first while this was being built).

Two things a client-submitted write is never trusted with, because both are trust signals rendered
to every consumer, not cosmetic labels: provenance and history. `venues_guard_owner_write()`
(`20260830100000_add_venue_attribute_edit.sql`) computes `attribute_meta` itself from the diff
between the old and new `attributes` — `source: 'owner', updatedAt: today`, only for keys that
actually changed — rather than accepting whatever the client sends; a client that could set its own
`updatedAt` could claim any stale value as freshly confirmed, and one that could set its own `source`
could claim a self-report as `operator_verified`. The same diff pass logs the state immediately
*before* every real change to `venue_attribute_history`. Rollback is not a special code path — the
history screen's "Restore this version" calls the same `updateVenueAttributes` an ordinary edit
does, with an old snapshot's values, which itself logs a fresh history row for the state right
before the restore, exactly like any other edit would.

Verified before this was ever applied for real, the same way the invite feature's RLS was: `auth.uid()`
reads `current_setting('request.jwt.claim.sub', true)`, which a `BEGIN`/`ROLLBACK` transaction can set
directly, so the full path — a real business-role holder, a real venue, a real diff — was exercised
against live data without a live session, and rolled back rather than committed. That caught nothing
this time (the design held), but it's what confirmed removing an attribute correctly drops its meta
entry too, that an untouched key resubmitted with its unchanged value never gets a spurious
timestamp bump, and that a disallowed column write still fails exactly as before. Out of scope, on
purpose: attribute *keys* are not schema-validated at the database level — the jsonb column accepts
whatever object the client sends, the same trust boundary this build already applies to `schedules`
and `menus`. The registry-driven editor is what keeps a legitimate client from ever sending anything
else; a client that bypassed the app entirely could write garbage keys the UI would just never
render, not a new capability an already-untrusted caller wouldn't otherwise have.

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
deliberately no budget, targeting, or ranking boost of its own (see F-BIZ-10 below for the actual
purchased-placement path). This is the one F-BIZ feature built as its own table with real RLS
rather than another jsonb-diff venue-write guard, since an offer is naturally a list with a
lifecycle — created, expires, removed early — not one blob a business rewrites wholesale, the same
shape as photos and business_invites. Carries the same per-jurisdiction drink-pricing disclaimer
the happy-hour editor already showed, since alcohol and tobacco promotion rules vary by state and
this build doesn't attempt to enforce them. Verified directly against the database before building
the client at all: a throwaway owner account could post and edit an offer, an unrelated account's
edit attempt silently touched nothing, an unrelated account's insert attempt hard-failed, and an
anonymous read saw the same row — all inside a rolled-back transaction, the same technique that
had already caught two real bugs in earlier F-BIZ migrations.

**Advertising** (`app/venue/advertising.tsx`, `src/lib/advertising.ts`, F-BIZ-10, scoped). Replaced
what `venues.promoted` actually was before this: a static boolean with no business-facing write
path at all — nothing in this build ever set it except the seed, so "paid placement" had no
purchase, no schedule, and no way to ever turn itself off. A business now schedules a real campaign
instead: budget tier, a date range, and optional daypart targeting are all real — a venue is only
pinned and labeled as a paid placement within its own campaign's dates and, if set, its targeted
dayparts (morning/afternoon/evening/late night, the exact buckets F-BIZ-08's traffic chart already
uses — both now read from one shared definition in `src/lib/daypart.ts` rather than two that could
drift). Whether a venue is *currently* promoted is never stored; it's computed against `now` at
read time (`isPromotedNow`), the same pattern `venueState` and happy-hour windows already use,
because nothing in this build could flip a stored flag the instant a date or daypart boundary
passes. Geography targeting (`targetNeighborhoods`) is collected and shown back to the business but
does not change ranking or visibility — this build has no per-request geo-serving engine, and a
venue's own neighborhood already determines which searches it can appear in at all, so narrowing
further would be a UI promise the backend can't keep. No payment is captured: `budgetTier` only
picks which published flat price was disclosed before submission, the same disclosed-not-charged
treatment F-BOOK-11's deposit terms already get. Creative management is one optional headline
shown in place of the venue's tagline while a campaign runs, not new asset upload — F-BIZ-06's
photo management already covers a venue's images. Performance reporting reuses F-BIZ-08's existing
`venue_events` log filtered to the campaign's own date range rather than a second tracking system.
The two venues that used to carry the bare `promoted` flag were reseeded as real campaigns so
existing demo behavior didn't just disappear when the column was dropped.

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

**Guest list** (`app/book/[id].tsx`'s `GuestListForm`, F-BOOK-07). Previously a stub: tapping
"Guest list" on a nightclub profile silently routed into the generic walk-in-bar waitlist form —
same host-stand position/wait-time simulation a dive bar gets, header mislabeled "Waitlist," no
cutoff, no capacity, no promoter distinction, even though `guestListCutoff` and
`promoterAffiliated` attributes already existed on the venue (the former read in exactly one
place, a headline sentence; the latter read nowhere at all). `guest_list` is now its own
`BookingMode`, and cutoff and capacity are real, enforced twice: once client-side for a fast
message, and again by a trigger on `bookings` for the actual decision — the same "the database is
what actually decides" discipline the review character floor already uses. The venue's remaining
capacity for tonight is shown before submitting, read through a `SECURITY DEFINER` function
(`guest_list_count`) rather than a relaxed read policy on `bookings`, so a guest learns how many
spots are taken without ever seeing who holds them. `promoterAffiliated` finally does something:
true routes the request to `status: 'requested'` for approval, false auto-confirms it exactly like
a reservation does. Approval needed no new console — F-BIZ-11's existing Confirm/Cancel actions
already work off `status`, not `kind`, so a pending guest-list request surfaces there for free.

**Reservation and waitlist console** (`app/venue/bookings.tsx`, F-BIZ-11, scoped). Real visibility
into bookings and waitlist entries at a venue a business account manages — confirm a requested
table, cancel a no-show, seat or remove someone waitlisted, approve or decline a guest-list request
(F-BOOK-07) — matching the "manage reservations and waitlist" cell the permission matrix
(Section 2.4) already claimed for R7/R8/R9. No floor map, no real-time table-tier status, no staff
assignment: those need an interactive room-map UI built against `table_tiers`, a genuinely
different feature from giving a business a list it can act on. `guestName` comes from a
device-side join against `profiles`, and is absent (falls back to "Guest") rather than invented
when the guest's own profile isn't public.

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
  F-BIZ-01, F-BIZ-04's
  hours/happy-hour editor (no bulk/multi-location, no closure scheduling), F-BIZ-05's menu/tap-list
  editor (no CSV/PDF/photo import), F-BIZ-06's cover photo and reorder (owner-credited photos only,
  same as F-MEDIA-06 draws it), F-BIZ-07's review response composer and threshold-based alerting (no
  sentiment summary or keyword themes, and no push notification behind the alert — see F-MSG-01/02),
  F-BIZ-08's analytics dashboard (profile views, click-throughs, daypart traffic, a rating trend, and
  a rating-only competitor benchmark — no search impressions, funnel, website/order click-through, or
  view-count benchmarking), F-BIZ-09's offers (self-published only — no budget, targeting, or
  ranking boost, and no per-jurisdiction pricing enforcement), F-BIZ-10's advertising (budget tier and
  daypart targeting are real; geography targeting is collected but not enforced, and no payment is
  captured), F-BIZ-11's reservation and waitlist console (no floor map, real-time table-tier status,
  or staff assignment), F-BIZ-13's invite-a-manager flow (manager/staff only, no access audit log),
  and F-BIZ-15's own-data export (reviews and media, not the new analytics — that lives in its own
  dashboard, not the export file — and not the team roster). Everything else — the typed attributes
  themselves beyond a cover flag, and F-BIZ-12 and 14 — has no dashboard here at all. F-TRUST is a
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
  not just organized by convention. That last check was silently broken until
  `20260828170000_fix_venue_photos_upload_policy.sql`: the policy's `exists (select 1 from venues v
  where v.id = (storage.foldername(v.name))[1])` looked like it read the object's path, but `venues`
  has a `name` column of its own, so the unqualified `name` bound to the *venue's display name* and
  the predicate never referenced the upload at all. It evaluated identically for every object in the
  bucket — false for the current data, so every upload was being rejected, and true for all of them
  at once had any venue name ever contained a `/` with a leading segment matching a venue id. The
  rewrite evaluates `name` at the top level of the policy, where nothing can shadow it, and uses the
  venues subquery only to supply ids. The bucket also carries a 10 MiB size cap and an
  `image/jpeg|png|webp|heic` MIME allowlist, because it is public-read and the daily cap is a trigger
  on the metadata row — neither constrains a direct storage write, so an account could otherwise have
  parked an arbitrarily large file, or an HTML/SVG payload, on the project's own storage origin.
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
- `ios.infoPlist.ITSAppUsesNonExemptEncryption` is set to `false` in `app.config.ts` — the US
  export-compliance declaration Apple otherwise stops every build to ask by hand. It asserts the app
  uses no *non-exempt* encryption, which was checked rather than assumed: every network call is
  HTTPS/TLS (Supabase, Google Maps, the OAuth browser hop) and Supabase's JWTs are used for
  authentication, both OS-provided and both standard published algorithms. There is no crypto
  library in the dependency tree, no call to any crypto API anywhere in `src/` or `app/`, and no
  encryption at rest — auth tokens sit in plain AsyncStorage. Adding `expo-secure-store`, encrypting
  anything locally, or shipping a proprietary algorithm can each change that answer, so this needs
  re-checking whenever the crypto surface does.

None of the above is legal advice, and the PRD's own instruction stands: qualified legal and
compliance counsel should review each area before the corresponding functionality ships. The export
declaration in particular is an attestation the publisher makes to Apple and, through them, under US
export regulations — the bullet above records what the code does, which is the input to that
decision, not the decision itself.

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

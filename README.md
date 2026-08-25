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
| Messaging | F-MSG-01, 03, 04 |
| Notifications | F-NOTIF-01 through 04 (preference surface) |
| Business portal | F-BIZ-01 (scoped to self-serve claim) |
| Usability | U-01 through U-12 |

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
consumer-to-consumer messaging. There is no business portal in this build, so nothing here
invents a reply "from the venue" — the venue side of the conversation is real or it does not
appear. What is real: the venue's published response time (F-MSG-01, `venues.avg_response_minutes`),
a structured intake form for private-event and buyout requests (F-MSG-03), and abuse controls
(F-MSG-04) — a client-side rate-limit courtesy backed by a database trigger that is the actual
control, plus block and report. Every message thread is verified-account-only (R3), the same gate
as booking, since the PRD's permission matrix requires it.

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
a matching domain, or manual document review. None of those exist here. This was originally built
before real Supabase Auth existed in this client at all, back when nothing could check a domain
against a confirmed email even in principle — that gap is closed now (see *Real Supabase Auth*
below), but this feature's scope did not change with it: signing in and asserting a role (`owner`
or `manager`) creates a genuine `business_roles` row and flips `venues.claimed`, exactly the way
filing a photo removal request creates a real record with no queue behind it (see *Photo upload*
below). `venues.verified` is deliberately never touched by this path — it stays false, which the
venue profile already rendered as "Claimed and unverified owner" before this feature existed, so
the self-attested state is not a broken one. First claim wins; a venue with an existing
`business_roles` row rejects further self-serve claims, and ownership transfer and disputes
(F-BIZ-02) are out of scope.

**Real Supabase Auth** (`app/auth.tsx`, `src/data/repository.ts`). Every backend-write function in
this app — `publishReview`, `saveBooking`, `createMessageThread`, `uploadPhoto`, `claimVenue` —
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
- **Business portal, moderation console, internal tooling** (F-BIZ, F-TRUST, F-ADMIN). Out of
  scope for a consumer client; the PRD makes web the primary surface for these. Their consumer-
  visible *outputs* are implemented: Consumer Alert banners, owner responses, owner-answer badges,
  paid-placement labels, claimed/unclaimed states, closure and successor handling. The one
  exception is F-BIZ-01's claim step itself (see *Venue claim* above) — real, but scoped down to
  self-attestation rather than the PRD's actual verification paths. Everything past that first
  claim (the listing editor, hours/menu/media management, review response, analytics, and the
  rest of F-BIZ-02 through 15) has no dashboard here at all.
- **Messaging quick-reply templates and auto-responses** (F-MSG-02). These are a venue-side
  configuration and there is no business portal to configure them from.
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
- A message thread's `sender` column is constrained to `'user'` at the schema level, and a rate
  limit (5 seconds per thread, 40 per account per hour) is enforced by trigger, not just by the
  composer disabling Send (F-MSG-04, NFR-11).
- A photo's `by` (owner vs. community) is computed from `business_roles` by trigger, never trusted
  from the client, and a daily upload cap (8 photos, 40 for Elite) is enforced the same way
  (F-MEDIA-01). An upload's storage path is checked against real venue ids before it's accepted,
  not just organized by convention.

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

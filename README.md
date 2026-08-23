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
| Search and discovery | F-SEARCH-01 through 07, 09, 10, 11 |
| Venue profile | F-PROFILE-01 through 06, 07, 08, 10, 11, 12 |
| Reviews | F-REVIEW-01 through 13 (client surface) |
| Media | F-MEDIA-01, 02, 05, 06 (metadata and album model) |
| Social | F-SOCIAL-01, 03, 06, 07 |
| Booking | F-BOOK-01 through 04, 06, 09, 09a, 10, 11 |
| Events | F-EVENT-01 through 06 |
| Messaging | F-MSG-01, 03, 04 |
| Notifications | F-NOTIF-01 through 04 (preference surface) |
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

## What is deliberately not implemented

- **No payments.** Deposit flows display real terms and capture affirmative acceptance, then stop.
  No card fields exist anywhere in the app.
- **No real authentication.** Sign-in collects a display name and a phone number and creates
  nothing. There is no password field, on purpose — a prototype that collects credentials teaches
  people to hand them over.
- **No age verification.** The age gate is self-attestation only. What standard is actually
  required, and whether it differs for browsing versus transacting, is PRD Open Question 3.
- **Business portal, moderation console, internal tooling** (F-BIZ, F-TRUST, F-ADMIN). Out of
  scope for a consumer client; the PRD makes web the primary surface for these. Their consumer-
  visible *outputs* are implemented: Consumer Alert banners, owner responses, owner-answer badges,
  paid-placement labels, claimed/unclaimed states, closure and successor handling.
- **Messaging quick-reply templates and auto-responses** (F-MSG-02). These are a venue-side
  configuration and there is no business portal to configure them from.
- **Ordering and delivery** (F-ORDER). Menus render with availability and the alcohol-delivery
  rule is stated; checkout is not built.
- **Photography.** The app bundles no images. `PhotoTile` renders a deterministic gradient plus
  the album icon. What the PRD actually asks for around media *is* implemented: album
  classification, owner versus community segmentation, and alternative text on every image.
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

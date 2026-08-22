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
19 venues, 39 reviews, and 26 events.

| Area | Requirements covered |
|---|---|
| Search and discovery | F-SEARCH-01 through 07, 09, 10, 11 |
| Venue profile | F-PROFILE-01 through 06, 07, 08, 10, 11, 12 |
| Reviews | F-REVIEW-01 through 13 (client surface) |
| Media | F-MEDIA-01, 02, 05, 06 (metadata and album model) |
| Social | F-SOCIAL-01, 03, 06, 07 |
| Booking | F-BOOK-01 through 04, 06, 09, 09a, 10, 11 |
| Events | F-EVENT-01 through 06 |
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

## What is deliberately not implemented

- **No backend.** All data is seeded in `src/data/`. Persistence is `AsyncStorage` on the device.
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
- **Messaging** (F-MSG). Inquiry and request forms route and confirm, but there is no thread view.
- **Ordering and delivery** (F-ORDER). Menus render with availability and the alcohol-delivery
  rule is stated; checkout is not built.
- **Photography.** The app bundles no images. `PhotoTile` renders a deterministic gradient plus
  the album icon. What the PRD actually asks for around media *is* implemented: album
  classification, owner versus community segmentation, and alternative text on every image.
- **Map tiles.** `MiniMap` is a schematic map with normalized coordinates, because the demo has no
  network dependency or API key. It implements the requirement that matters — pin interaction and
  map-bounded re-search. Swapping in `react-native-maps` later replaces that one component; the
  bounds contract is unchanged.

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
  data/                  taxonomy, attribute registry, venues, reviews, events
  lib/                   hours, search and ranking, ratings, decision chips, formatting
  state/AppProvider.tsx  session, filters, saves, bookings, drafts, prefs, clock
  components/            design-system primitives and composites
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

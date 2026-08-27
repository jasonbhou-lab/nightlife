/**
 * Domain types for the venue discovery platform (PRD section 3).
 *
 * The important structural choice here mirrors PRD 3.3: attributes are *typed*
 * and live in a registry, so the same declaration drives the filter sheet, the
 * profile attribute panel, and staleness expiry. Nothing is a free-text blob.
 */

/** PRD 3.1 — five verticals, no more. */
export type Vertical = 'dining' | 'bar' | 'lounge' | 'cigar' | 'nightclub';

export type AttributeType =
  | 'boolean'
  | 'enum'
  | 'multi'
  | 'integer'
  | 'currency'
  | 'time'
  | 'text';

/** PRD 3.4 — every attribute value carries a source. */
export type Provenance =
  | 'owner'
  | 'community'
  | 'provider'
  | 'operator_verified';

export type AttributeValue = string | number | boolean | string[] | null;

export type AttributeGroup =
  | 'decide'
  | 'drink'
  | 'food'
  | 'humidor'
  | 'entry'
  | 'entertainment'
  | 'seating'
  | 'crowd'
  | 'access'
  | 'money'
  | 'smoking';

export type AttributeDef = {
  key: string;
  label: string;
  type: AttributeType;
  group: AttributeGroup;
  /** Which verticals expose this attribute. Empty means universal. */
  verticals: Vertical[];
  /** Options for enum / multi. */
  options?: { value: string; label: string }[];
  /** Shown in the filter sheet for the selected vertical (PRD F-SEARCH-04). */
  filterable?: boolean;
  /** Filter is "at least this much" rather than exact (tap count, TV count). */
  filterAsMinimum?: boolean;
  /** Volatile field: value expires after N days and is re-solicited (PRD 3.4). */
  ttlDays?: number;
  unit?: string;
  /** Rendered as a caveat under the value. Used for the indoor-smoking flag. */
  caveat?: string;
};

export type AttributeMeta = { source: Provenance; updatedAt: string };

/** A named schedule. Bars keep kitchen hours separately (PRD F-PROFILE-06). */
export type ScheduleKind = 'venue' | 'kitchen' | 'bar' | 'retail' | 'lounge';

/** `close` earlier than `open` means the range crosses midnight. */
export type DayRange = { open: string; close: string };

export type Schedule = {
  kind: ScheduleKind;
  label: string;
  /** Index 0 = Sunday, matching Date#getDay. `null` = closed that day. */
  days: (DayRange | null)[];
  updatedAt: string;
};

export type HappyHourWindow = {
  /** Day indices, 0 = Sunday. */
  days: number[];
  start: string;
  end: string;
  summary: string;
};

/**
 * F-BIZ-09, scoped: a self-published offer, not a purchased placement —
 * there is no budget, targeting, or ranking boost attached (F-BIZ-10 is out
 * of scope). `endsAt` absent means ongoing rather than time-boxed.
 */
export type VenueOffer = {
  id: string;
  venueId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt?: string;
  createdAt: string;
};

export type Photo = {
  id: string;
  album: 'food' | 'drink' | 'interior' | 'exterior' | 'menu' | 'crowd' | 'humidor' | 'stage' | 'table';
  caption: string;
  /**
   * Owner media can be reordered by the owner, and one owner photo can be
   * selected as the cover; community media cannot be touched either way
   * (F-BIZ-06 / F-MEDIA-06). Only ever true on an owner-credited real
   * upload — never on a seeded placeholder, which has no row behind it to
   * select in the first place.
   */
  by: 'owner' | 'community';
  isCover?: boolean;
  /** Auto-generated for community photos, owner-editable for owner photos (5.4). */
  alt: string;
  /**
   * A real uploaded image's public URL (F-MEDIA-01). Absent on the seeded
   * placeholder photos, which render as a deterministic gradient instead —
   * see `PhotoTile`.
   */
  uri?: string;
  /** F-MEDIA-04: a removal request exists for this photo. */
  removalRequested?: boolean;
};

export type MenuItem = {
  name: string;
  price?: number;
  detail?: string;
  /** Dietary tags for restaurants (PRD 3.3). */
  tags?: string[];
  /** Live availability, e.g. a tapped-out keg (F-ORDER-01). */
  soldOut?: boolean;
};

export type MenuSection = {
  title: string;
  /** Tap lists at rotating-tap bars are the fastest-moving field in the model. */
  volatile?: boolean;
  note?: string;
  items: MenuItem[];
};

/** Nightclub / lounge table service tiers (PRD F-BOOK-06). */
export type TableTier = {
  id: string;
  name: string;
  section: string;
  minimumSpend: number;
  seats: number;
  /** Position on the room map, 0..1 in both axes. */
  x: number;
  y: number;
  available: boolean;
};

/**
 * F-BIZ-01. Only 'owner' and 'manager' are self-claimable — 'staff' and
 * 'group_admin' presuppose an invite from someone who already holds a role.
 */
export type ClaimableBusinessRole = 'owner' | 'manager';

/**
 * F-BIZ-13, scoped. An existing role holder may invite 'manager' or
 * 'staff' — not 'owner' (that's a claim, not an invite) and not
 * 'group_admin' (multi-location, F-BIZ-14, is out of scope).
 */
export type InvitableBusinessRole = 'manager' | 'staff';

/**
 * F-BIZ-02: `role` can also be 'owner' here — not a normal invite, an
 * ownership-transfer request from the current owner (see
 * repository.transferOwnership and 20260828120000_add_ownership_transfer_and_dispute.sql).
 * Accepting one replaces the sender's own owner row instead of adding a
 * second owner alongside it.
 */
export type BusinessInvite = {
  id: string;
  venueId: string;
  email: string;
  role: InvitableBusinessRole | 'owner';
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
};

export type VenueClaimStatus = 'pending' | 'approved' | 'rejected';

/**
 * F-BIZ-01, tightened: a claim no longer creates a business_roles row on
 * its own. It sits here, pending, until an admin decides it — see the
 * migration header on 20260828100100_add_venue_claim_approval.sql.
 * `claimantName` is only ever populated for the admin queue (a device-side
 * join against `profiles`, the same convention Booking.guestName uses) —
 * the claimant reading their own claim already knows who they are.
 *
 * F-BIZ-02: the same row also carries a dispute against an already-claimed
 * venue — `evidence` is what distinguishes the two client-side (the
 * database enforces it as required, non-empty, exactly when the venue was
 * already claimed at submission time; see
 * 20260828120000_add_ownership_transfer_and_dispute.sql). Approving a
 * dispute replaces every business_roles row at the venue; approving a
 * fresh claim just creates one.
 */
export type VenueClaim = {
  id: string;
  venueId: string;
  userId: string;
  claimantName?: string;
  role: ClaimableBusinessRole;
  status: VenueClaimStatus;
  note?: string;
  evidence?: string;
  createdAt: string;
  decidedAt?: string;
};

/**
 * F-TRUST, scoped. There is no self-serve claim for a platform role the way
 * business_roles has one — a row is granted directly in the database (see
 * the migration header on 20260826110000_add_trust_and_safety.sql). Moderator
 * works the reviews queue; trust_safety adds Consumer Alerts, freezing
 * contribution on a listing, and resolving what a moderator escalates;
 * admin decides venue claims (F-BIZ-01) — see
 * 20260828100000_add_admin_platform_role.sql for why it's a separate role
 * from the other two rather than an overload of "moderator".
 */
export type PlatformRole = 'moderator' | 'trust_safety' | 'admin';

export type ReportReason =
  | 'not_a_real_visit' | 'conflict_of_interest' | 'harassment_or_hate_speech'
  | 'privacy_violation' | 'irrelevant_or_promotional';

export type ReportStatus = 'pending' | 'dismissed' | 'removed' | 'escalated';

/**
 * Deliberately not denormalized with the reported review's own text or venue —
 * the moderation queue cross-references `reviewId` against the reviews the
 * catalogue already has loaded (`useCatalogue().reviews`), the same
 * device-side-join convention the rest of this app's repository layer uses
 * rather than a PostgREST embedded join.
 */
export type ContentReport = {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: ReportReason;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string;
};

export type ModerationActionKind =
  | 'report_dismissed' | 'report_escalated' | 'review_removed' | 'review_restored'
  | 'consumer_alert_applied' | 'consumer_alert_cleared'
  | 'contribution_frozen' | 'contribution_unfrozen';

export type ModerationAction = {
  id: string;
  action: ModerationActionKind;
  reviewId?: string;
  reportId?: string;
  venueId?: string;
  note?: string;
  createdAt: string;
};

export type BookingMode =
  /** Restaurant-style reservations with a time grid. */
  | 'reservation'
  /** Table service with a room map, tier minimum, and deposit. */
  | 'table_service'
  /** Remote waitlist only. */
  | 'waitlist'
  /** Bar primitives: large party, game-day table, tour slot (F-BOOK-09a). */
  | 'bar_hold'
  /** Membership / locker inquiry (F-BOOK-09). */
  | 'inquiry'
  /** No booking at all. Presents as walk-in-only, never a dead Reserve button. */
  | 'walk_in';

export type VenueEvent = {
  id: string;
  venueId: string;
  title: string;
  /** ISO date for one-offs. */
  date?: string;
  /** Weekly programming, 0 = Sunday (F-EVENT-05). */
  weekday?: number;
  start: string;
  end: string;
  genre?: string;
  lineup?: string[];
  cover?: number;
  agePolicy?: string;
  description: string;
  ticketUrl?: string;
  recurring: boolean;
};

export type SubRatingKey =
  | 'food' | 'service' | 'ambiance' | 'value'
  | 'drinkSelection' | 'pourValue' | 'bartender' | 'atmosphere' | 'noise'
  | 'music' | 'crowd' | 'door'
  | 'drinks' | 'comfort'
  | 'selection' | 'ventilation' | 'staffKnowledge';

export type Review = {
  id: string;
  venueId: string;
  author: string;
  /** Drives review weighting (F-REVIEW-08) and Elite badging (R4). */
  authorTrust: number;
  elite: boolean;
  rating: number;
  subRatings: Partial<Record<SubRatingKey, number>>;
  text: string;
  date: string;
  edited?: boolean;
  helpful: number;
  insightful: number;
  funny: number;
  /** Structured tags (F-REVIEW-03) — these power filtering, so they are cheap to add. */
  tags: {
    occasion?: string;
    partySize?: number;
    timeOfVisit?: string;
    waitMinutes?: number;
    coverPaid?: number;
    spendRange?: string;
  };
  photoCount: number;
  /** Comped or hosted visit disclosure (F-REVIEW-12). */
  comped?: boolean;
  /**
   * False when the recommendation software filtered it out of the aggregate
   * and the default view (F-REVIEW-07). The reason is deliberately not
   * exposed in detail — that would be an evasion roadmap.
   */
  recommended: boolean;
  ownerResponse?: { text: string; date: string };
};

export type Venue = {
  id: string;
  name: string;
  alternateNames?: string[];
  /** Exactly one primary category, up to four secondary (PRD 3.1). */
  primary: { vertical: Vertical; category: string };
  secondary: { vertical: Vertical; category: string }[];
  priceTier: 1 | 2 | 3 | 4;
  neighborhood: string;
  address: string;
  /** Straight-line distance from the user in miles, precomputed for the demo. */
  distanceMi: number;
  /** Normalized position on the demo map, 0..1. */
  map: { x: number; y: number };
  phone: string;
  website?: string;
  rating: number;
  reviewCount: number;
  claimed: boolean;
  verified: boolean;
  openedYear?: number;
  /** F-PROFILE-12 */
  closure?: { state: 'temporary' | 'permanent' | 'moved' | 'seasonal'; note: string; successorId?: string };
  /** F-PROFILE-11 — applied by Trust & Safety, never by Sales. */
  consumerAlert?: string;
  /** F-TRUST-04 / R12: Trust & Safety can freeze new reviews on a listing. */
  contributionFrozen?: boolean;
  /** Paid placement. Always labeled (F-SEARCH-09, U-11). */
  promoted?: boolean;
  tagline: string;
  about: string;
  schedules: Schedule[];
  happyHours?: HappyHourWindow[];
  offers?: VenueOffer[];
  attributes: Record<string, AttributeValue>;
  /** Per-attribute provenance. Falls back to `defaultMeta` when absent. */
  meta: Record<string, AttributeMeta>;
  defaultMeta: AttributeMeta;
  photos: Photo[];
  menus: MenuSection[];
  tables?: TableTier[];
  bookingModes: BookingMode[];
  /** Deposit / cancellation terms shown before payment (F-BOOK-11). */
  bookingTerms?: string;
  /** Aggregated, non-identifying busyness by hour, 0..1 (F-PROFILE-07). */
  busyness?: Partial<Record<number, number>>;
  qa: { q: string; a: string; byOwner: boolean; date: string }[];
  /** Community rating dimensions specific to the category. */
  subRatingAverages: Partial<Record<SubRatingKey, number>>;
  /** F-MSG-01: published response-time metric. Absent means not published. */
  avgResponseMinutes?: number;
  /** F-MSG-02: sent automatically on the first message in a new thread, if set. */
  autoResponseText?: string;
  /** F-BIZ-07: a review at or below this rating with no owner response counts as needing attention. */
  reviewAlertThreshold?: number;
};

/* --------------------------------------------------------------- messaging */

/**
 * F-MSG. Consumer-to-business only (F-MSG-05 defers consumer-to-consumer).
 *
 * `sender` was 'user' only for most of this build's life: there was no
 * business portal, so there was no authenticated party on the venue side who
 * could write a reply, and the database enforced that with a column check.
 * F-MSG-02 is what changed it — a business account holding a role at the
 * thread's venue can now reply, either free text or from a saved template
 * (see BusinessReplyTemplate below), and the database enforces *that*
 * instead: a 'business'-sender row requires holding a business role at the
 * thread's venue, checked the same way every other business write in this
 * app is (see 20260827090000_add_business_messaging.sql).
 */
export type MessageThreadKind = 'general' | 'quote_request';

export type Message = {
  id: string;
  sender: 'user' | 'business';
  text: string;
  createdAt: string;
};

/**
 * F-MSG-02, scoped: a saved canned reply a business account can tap to
 * insert into the composer rather than typing the same answer again. Not a
 * rules engine — no keyword matching, no scheduling beyond the one
 * auto-response text on Venue.autoResponseText.
 */
export type BusinessReplyTemplate = {
  id: string;
  venueId: string;
  label: string;
  body: string;
  createdAt: string;
};

/* --------------------------------------------------------------- analytics */

/**
 * F-BIZ-08, scoped: a single logged view or click on a venue's profile.
 * No actor is captured — see the migration header on
 * 20260827130000_add_venue_analytics.sql for why. `click_book` covers every
 * booking intent `runAction` routes to `/book/[id]` (reserve, table
 * service, bar hold, waitlist, membership, guest list) — the PRD's five
 * booking modes don't reduce to one button in this app's actual UI, so one
 * event kind for all of them is the honest mapping to the PRD's "reserve"
 * action type. There is no `click_website` (no website link exists
 * anywhere in this app yet) or `click_order` (F-ORDER stays deferred).
 */
export type VenueEventKind = 'view' | 'click_call' | 'click_directions' | 'click_book';

export type VenueAnalyticsEvent = {
  id: string;
  venueId: string;
  kind: VenueEventKind;
  createdAt: string;
};

/** F-MSG-03: structured intake for a private event, buyout, or large party. */
export type QuoteIntake = {
  date?: string;
  headcount?: number;
  budgetRange?: string;
  foodAndBeverage?: string;
  av?: string;
};

export type MessageThread = {
  id: string;
  venueId: string;
  kind: MessageThreadKind;
  subject?: string;
  intake?: QuoteIntake;
  /** F-MSG-04: a blocked thread accepts no further messages. */
  blocked: boolean;
  createdAt: string;
  lastMessageAt: string;
  messages: Message[];
};

/* ---------------------------------------------------------------- community */

/**
 * F-SOCIAL-02. A followable person, distinct from the local session.
 *
 * This build has no real multi-user backend — the account you're signed in
 * as is the only real account on the device, and review authorship is a
 * free-text name with no stable id (see `Review.author`). "Follow users"
 * is modelled here as a fixed roster of recurring contributors drawn from
 * the seed review corpus, so following someone has real history (their
 * existing reviews) to show rather than an empty profile. `trust` and
 * `elite` are copied from that person's actual seeded review rather than
 * invented, so the two data sources cannot disagree.
 */
export type CommunityMember = {
  id: string;
  name: string;
  tagline: string;
  homeNeighborhood: string;
  joinedYear: number;
  trust: number;
  elite: boolean;
};

/** F-SOCIAL-05. Non-broadcast ('private') is the explicit default. */
export type CheckInVisibility = 'private' | 'friends';

export type CheckIn = {
  id: string;
  venueId: string;
  /** ISO date. */
  date: string;
  visibility: CheckInVisibility;
  note?: string;
  /** Set on seeded community activity; absent on the signed-in user's own check-ins. */
  memberId?: string;
};

/* ---------------------------------------------------------------- app state */

export type SessionRole = 'guest' | 'registered' | 'verified' | 'elite';

export type Booking = {
  id: string;
  venueId: string;
  kind: BookingMode;
  date: string;
  time: string;
  partySize: number;
  /** Table tier for table service. */
  tier?: string;
  deposit?: number;
  status: 'confirmed' | 'requested' | 'waitlisted' | 'cancelled';
  notes?: string;
  createdAt: string;
  /** Position in the remote waitlist (F-BOOK-04). */
  waitlistPosition?: number;
  waitMinutes?: number;
  /**
   * F-BIZ-11, business-console reads only. `bookings` has no denormalized
   * guest name the way reviews does — this comes from a device-side join
   * against `profiles.display_name`, which is only visible when the guest's
   * profile is public (the default) or the reader is the guest themselves.
   * Absent on a private profile; the console falls back to "Guest" rather
   * than inventing a name.
   */
  guestName?: string;
};

/**
 * F-SOCIAL-04. `addedBy` is `'you'` for the signed-in device or a
 * `CommunityMember.id` — the attribution the requirement actually asks for.
 * Real simultaneous multi-device editing needs a backend this build does not
 * have; the seed data demonstrates the model with a couple of entries
 * pre-attributed to a community member, as if they had contributed earlier.
 */
export type CollectionEntry = {
  venueId: string;
  addedBy: string;
  addedAt: string;
};

export type Collection = {
  id: string;
  name: string;
  entries: CollectionEntry[];
  shared: boolean;
  /** Community members invited as contributors (F-SOCIAL-04). */
  collaboratorIds: string[];
};

export type ReviewDraft = {
  venueId: string;
  rating: number;
  subRatings: Partial<Record<SubRatingKey, number>>;
  text: string;
  tags: Review['tags'];
  photoCount: number;
  savedAt: string;
};

export type SortKey =
  | 'relevance'
  | 'rating'
  | 'distance'
  | 'reviewCount'
  | 'price'
  | 'availability';

export type FilterState = {
  verticals: Vertical[];
  /**
   * Subcategory values from `taxonomy.ts`'s per-vertical `categories` list —
   * the venue's own cuisine or theme (Tex-Mex, Speakeasy, Dive Bar, Latin
   * Club), matched against `primary`/`secondary`. Distinct from `verticals`,
   * which only picks the five top-level categories.
   */
  categories: string[];
  /** Attribute key -> required value. Booleans mean "must be true". */
  attributes: Record<string, AttributeValue>;
  priceTiers: number[];
  minRating: number | null;
  openNow: boolean;
  /** "Open at" in HH:mm, evaluated against the operating calendar. */
  openAt: string | null;
  maxDistanceMi: number | null;
  query: string;
  sort: SortKey;
};

export type Preferences = {
  cuisines: string[];
  dietary: string[];
  priceComfort: number[];
  nightlifeInterest: boolean;
  cigarInterest: boolean;
  typicalPartySize: number;
  /** Personalization can be reset or adjusted by the user (F-SOCIAL-06). */
  personalized: boolean;
  completedOnboarding: boolean;
};

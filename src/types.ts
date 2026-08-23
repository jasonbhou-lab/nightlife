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

export type Photo = {
  id: string;
  album: 'food' | 'drink' | 'interior' | 'exterior' | 'menu' | 'crowd' | 'humidor' | 'stage' | 'table';
  caption: string;
  /** Owner media can be reordered by the owner; community media cannot (F-MEDIA-06). */
  by: 'owner' | 'community';
  /** Auto-generated for community photos, owner-editable for owner photos (5.4). */
  alt: string;
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
  /** Paid placement. Always labeled (F-SEARCH-09, U-11). */
  promoted?: boolean;
  tagline: string;
  about: string;
  schedules: Schedule[];
  happyHours?: HappyHourWindow[];
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
};

/* --------------------------------------------------------------- messaging */

/**
 * F-MSG. Consumer-to-business only (F-MSG-05 defers consumer-to-consumer).
 *
 * `sender` is always 'user': there is no business portal in this build, so
 * there is no authenticated party on the venue side who could write a reply.
 * The database enforces this (messages.sender is constrained to 'user'), so
 * the type does the same rather than modelling a reply that can never exist.
 */
export type MessageThreadKind = 'general' | 'quote_request';

export type Message = {
  id: string;
  sender: 'user';
  text: string;
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
};

export type Collection = {
  id: string;
  name: string;
  venueIds: string[];
  shared: boolean;
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

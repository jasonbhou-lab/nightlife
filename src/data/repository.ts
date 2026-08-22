import { events as seedEvents } from '@/data/events';
import { reviews as seedReviews } from '@/data/reviews';
import { venues as seedVenues } from '@/data/venues';
import { hasBackend, supabase } from '@/lib/supabase';
import type {
  EventRow, ReviewRow, TableTierRow, VenueRow,
} from '@/lib/database.types';
import type { Review, Venue, VenueEvent } from '@/types';

/**
 * The single place the app gets venue data from.
 *
 * Two sources behind one interface: Supabase when it is configured and
 * reachable, the bundled seed otherwise. That fallback is not a convenience —
 * U-07 requires saved venues and recent searches to stay readable without
 * connectivity, and the PRD is explicit that club basements have poor signal.
 * A discovery app that shows a spinner when the network drops has failed at the
 * moment it is most needed.
 *
 * The catalogue is fetched whole and then filtered on-device by the existing
 * engine in src/lib/search.ts. That is the right shape at launch-metro scale:
 * one round trip, then instant filtering, and it keeps working offline. It is
 * *not* the right shape at the 50M-venue scale of NFR-03 — at that point the
 * filter predicates move into a Postgres RPC and this module starts passing
 * filters down instead of fetching everything. The seam is here so that change
 * touches one file.
 */

export type Source = 'remote' | 'seed';

export type CatalogueResult = {
  venues: Venue[];
  events: VenueEvent[];
  reviews: Review[];
  source: Source;
  /** Set when a remote fetch was attempted and failed. */
  error?: string;
};

/* ------------------------------------------------------------- row mapping */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** "18:00:00" from Postgres `time` back to the "18:00" the app uses. */
function trimTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function mapVenue(row: VenueRow, tiers: TableTierRow[]): Venue {
  return {
    id: row.id,
    name: row.name,
    alternateNames: row.alternate_names?.length ? row.alternate_names : undefined,
    primary: { vertical: row.primary_vertical, category: row.primary_category },
    secondary: asArray(row.secondary),
    priceTier: row.price_tier as 1 | 2 | 3 | 4,
    neighborhood: row.neighborhood,
    address: row.address,
    // Distance is a function of the user's position, not a stored column.
    // Computed below once we know where they are.
    distanceMi: 0,
    map: { x: row.map_x ?? 0.5, y: row.map_y ?? 0.5 },
    phone: row.phone ?? '',
    website: row.website ?? undefined,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    claimed: row.claimed,
    verified: row.verified,
    openedYear: row.opened_year ?? undefined,
    closure: row.closure_state
      ? {
          state: row.closure_state,
          note: row.closure_note ?? '',
          successorId: row.closure_successor_id ?? undefined,
        }
      : undefined,
    consumerAlert: row.consumer_alert ?? undefined,
    promoted: row.promoted || undefined,
    tagline: row.tagline ?? '',
    about: row.about ?? '',
    schedules: asArray(row.schedules),
    happyHours: asArray(row.happy_hours),
    attributes: asRecord(row.attributes) as Venue['attributes'],
    meta: asRecord(row.attribute_meta) as Venue['meta'],
    defaultMeta: { source: row.default_source, updatedAt: row.default_updated_at },
    photos: asArray(row.photos),
    menus: asArray(row.menus),
    tables: tiers.length
      ? tiers.map((t) => ({
          id: t.id,
          name: t.name,
          section: t.section,
          minimumSpend: t.minimum_spend,
          seats: t.seats,
          x: t.x,
          y: t.y,
          available: t.available,
        }))
      : undefined,
    bookingModes: row.booking_modes ?? [],
    bookingTerms: row.booking_terms ?? undefined,
    busyness: Object.fromEntries(
      Object.entries(asRecord(row.busyness)).map(([k, v]) => [Number(k), Number(v)]),
    ),
    qa: asArray(row.qa),
    subRatingAverages: asRecord(row.sub_rating_averages) as Venue['subRatingAverages'],
  };
}

function mapEvent(row: EventRow): VenueEvent {
  return {
    id: row.id,
    venueId: row.venue_id,
    title: row.title,
    recurring: row.recurring,
    weekday: row.weekday ?? undefined,
    date: row.event_date ?? undefined,
    start: trimTime(row.start_time),
    end: trimTime(row.end_time),
    genre: row.genre ?? undefined,
    lineup: row.lineup?.length ? row.lineup : undefined,
    cover: row.cover ?? undefined,
    agePolicy: row.age_policy ?? undefined,
    description: row.description ?? '',
    ticketUrl: row.ticket_url ?? undefined,
  };
}

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    venueId: row.venue_id,
    author: row.author_name,
    authorTrust: Number(row.author_trust),
    elite: row.elite,
    rating: row.rating,
    subRatings: asRecord(row.sub_ratings) as Review['subRatings'],
    text: row.body,
    date: (row.visited_on ?? row.created_at).slice(0, 10),
    edited: row.edited,
    helpful: row.helpful,
    insightful: row.insightful,
    funny: row.funny,
    tags: asRecord(row.tags) as Review['tags'],
    photoCount: row.photo_count,
    comped: row.comped || undefined,
    recommended: row.recommended,
    ownerResponse: row.owner_response
      ? {
          text: row.owner_response,
          date: (row.owner_response_at ?? row.created_at).slice(0, 10),
        }
      : undefined,
  };
}

/* ------------------------------------------------------------ distance */

/**
 * Straight-line miles between the user and each venue.
 *
 * The seed carries hand-set distances for a fixed downtown origin; rows from the
 * database carry lat/lng and get a real haversine. Either way the field the UI
 * reads is the same.
 */
export function withDistances(
  list: Venue[],
  origin: { lat: number; lng: number } | null,
  rows?: Map<string, VenueRow>,
): Venue[] {
  if (!origin || !rows) return list;
  return list.map((v) => {
    const row = rows.get(v.id);
    if (!row?.lat || !row?.lng) return v;
    return { ...v, distanceMi: haversineMi(origin, { lat: row.lat, lng: row.lng }) };
  });
}

function haversineMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/* --------------------------------------------------------------- fetching */

const seedCatalogue: CatalogueResult = {
  venues: seedVenues,
  events: seedEvents,
  reviews: seedReviews,
  source: 'seed',
};

/**
 * Load the catalogue. Never throws: a failed remote read falls back to the seed
 * and reports why, so the caller can surface a banner rather than an error page.
 */
export async function loadCatalogue(
  origin: { lat: number; lng: number } | null = null,
): Promise<CatalogueResult> {
  if (!hasBackend || !supabase) return seedCatalogue;

  try {
    const [venuesRes, tiersRes, eventsRes, reviewsRes] = await Promise.all([
      supabase.from('venues').select('*'),
      supabase.from('table_tiers').select('*'),
      supabase.from('events').select('*'),
      supabase.from('reviews').select('*'),
    ]);

    const firstError = venuesRes.error ?? tiersRes.error ?? eventsRes.error ?? reviewsRes.error;
    if (firstError) throw new Error(firstError.message);

    const venueRows = venuesRes.data ?? [];
    if (venueRows.length === 0) {
      return {
        ...seedCatalogue,
        error:
          'The database is reachable but has no venues yet. Apply supabase/seed.sql, then reload.',
      };
    }

    const tiersByVenue = new Map<string, TableTierRow[]>();
    for (const t of tiersRes.data ?? []) {
      const list = tiersByVenue.get(t.venue_id) ?? [];
      list.push(t);
      tiersByVenue.set(t.venue_id, list);
    }

    const rowsById = new Map(venueRows.map((r) => [r.id, r]));
    const mapped = venueRows.map((r) => mapVenue(r, tiersByVenue.get(r.id) ?? []));

    // Preserve the seed's hand-set distances where the row has no coordinates,
    // so the demo data still sorts sensibly by distance.
    const seedDistances = new Map(seedVenues.map((v) => [v.id, v.distanceMi]));
    const withFallbackDistance = mapped.map((v) =>
      v.distanceMi === 0 ? { ...v, distanceMi: seedDistances.get(v.id) ?? 0 } : v,
    );

    return {
      venues: withDistances(withFallbackDistance, origin, rowsById),
      events: (eventsRes.data ?? []).map(mapEvent),
      reviews: (reviewsRes.data ?? []).map(mapReview),
      source: 'remote',
    };
  } catch (err) {
    return {
      ...seedCatalogue,
      error: err instanceof Error ? err.message : 'Could not reach the database.',
    };
  }
}

/* ---------------------------------------------------------------- writes */

/**
 * Publish a review. Returns the created row, or an error message.
 *
 * Note what this does *not* send: `recommended`, the community feedback counts,
 * and the owner response are all rejected by a database trigger if a client
 * tries to set them. The conflict-of-interest rule and the character floor are
 * likewise enforced server-side (F-TRUST-06, NFR-07). The client validates the
 * same rules for a fast message, but the database is what actually decides.
 */
export async function publishReview(input: {
  venueId: string;
  rating: number;
  subRatings: Review['subRatings'];
  text: string;
  tags: Review['tags'];
  photoCount: number;
  comped: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) {
    return { ok: false, error: 'No backend configured; the review was kept as a local draft.' };
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to publish a review.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      venue_id: input.venueId,
      author_id: user.id,
      author_name: profile?.display_name ?? 'Guest',
      rating: input.rating,
      sub_ratings: input.subRatings as never,
      body: input.text,
      tags: input.tags as never,
      photo_count: input.photoCount,
      comped: input.comped,
      visited_on: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/** Persist a booking. Deposit terms acceptance is stored with the text shown. */
export async function saveBooking(input: {
  venueId: string;
  kind: string;
  date: string;
  time: string;
  partySize: number;
  tier?: string;
  deposit?: number;
  status: string;
  notes?: string;
  waitlistPosition?: number;
  waitMinutes?: number;
  termsText?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) {
    return { ok: false, error: 'No backend configured; the booking was kept on this device.' };
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to book.' };

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: user.id,
      venue_id: input.venueId,
      kind: input.kind as never,
      booking_date: input.date,
      booking_time: input.time,
      party_size: input.partySize,
      tier: input.tier ?? null,
      deposit: input.deposit ?? null,
      status: input.status as never,
      notes: input.notes ?? null,
      waitlist_position: input.waitlistPosition ?? null,
      wait_minutes: input.waitMinutes ?? null,
      // F-BOOK-11: store the acceptance alongside the terms that were shown, so
      // there is a record of what the guest actually agreed to.
      terms_accepted_at: input.deposit ? new Date().toISOString() : null,
      terms_text: input.termsText ?? null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/** Mirror a locally-saved review draft to the account so it follows devices. */
export async function syncDraft(input: {
  venueId: string;
  rating: number;
  subRatings: Review['subRatings'];
  text: string;
  tags: Review['tags'];
  photoCount: number;
}): Promise<void> {
  if (!hasBackend || !supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return;

  await supabase.from('review_drafts').upsert({
    user_id: auth.user.id,
    venue_id: input.venueId,
    rating: input.rating || null,
    sub_ratings: input.subRatings as never,
    body: input.text || null,
    tags: input.tags as never,
    photo_count: input.photoCount,
    saved_at: new Date().toISOString(),
  });
}

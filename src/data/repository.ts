import { events as seedEvents } from '@/data/events';
import { reviews as seedReviews } from '@/data/reviews';
import { venues as seedVenues } from '@/data/venues';
import { hasBackend, supabase } from '@/lib/supabase';
import type {
  EventRow, PhotoRow, ReviewRow, TableTierRow, VenueRow,
} from '@/lib/database.types';
import type {
  ClaimableBusinessRole, HappyHourWindow, MenuSection, Photo, Review, Schedule, Venue, VenueEvent,
} from '@/types';

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
    avgResponseMinutes: row.avg_response_minutes ?? undefined,
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

/** A row from the real `photos` table, with its storage path resolved to a public URL. */
function mapPhotoRow(row: PhotoRow, publicUrl: string): Photo {
  return {
    id: row.id,
    album: row.album,
    caption: row.caption ?? '',
    by: row.by,
    alt: row.alt ?? 'Community-uploaded photo',
    uri: publicUrl,
    removalRequested: row.removal_requested || undefined,
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
    const [venuesRes, tiersRes, eventsRes, reviewsRes, photosRes] = await Promise.all([
      supabase.from('venues').select('*'),
      supabase.from('table_tiers').select('*'),
      supabase.from('events').select('*'),
      supabase.from('reviews').select('*'),
      supabase.from('photos').select('*'),
    ]);

    const firstError = venuesRes.error ?? tiersRes.error ?? eventsRes.error ?? reviewsRes.error ?? photosRes.error;
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

    // Real uploads (F-MEDIA-01) live in their own table, additive to the
    // owner-provided photos already embedded in the venue's jsonb document —
    // appended, not replacing them.
    const photosByVenue = new Map<string, Photo[]>();
    for (const row of photosRes.data ?? []) {
      const { data: pub } = supabase.storage.from('venue-photos').getPublicUrl(row.storage_path);
      const list = photosByVenue.get(row.venue_id) ?? [];
      list.push(mapPhotoRow(row, pub.publicUrl));
      photosByVenue.set(row.venue_id, list);
    }
    const withUploadedPhotos = withFallbackDistance.map((v) => {
      const uploaded = photosByVenue.get(v.id);
      return uploaded?.length ? { ...v, photos: [...v.photos, ...uploaded] } : v;
    });

    return {
      venues: withDistances(withUploadedPhotos, origin, rowsById),
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

/**
 * Open a message thread (F-MSG). Returns the row's id so the caller can use
 * one identifier for the thread everywhere. If there is no backend, or the
 * caller is not signed in, the thread is kept on this device only — the
 * caller is expected to fall back to a locally-generated id in that case
 * rather than treat it as an error, the same way an offline booking does.
 */
export async function createMessageThread(input: {
  venueId: string;
  kind: string;
  subject?: string;
  intake?: Record<string, unknown>;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; kept on this device only.' };

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to message a venue.' };

  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      user_id: user.id,
      venue_id: input.venueId,
      kind: input.kind as never,
      subject: input.subject ?? null,
      intake: (input.intake ?? {}) as never,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/**
 * Send a message. `sender` is never sent — the column defaults to and is
 * constrained to 'user', so there is nothing else it could be from a client.
 * Silently a no-op for threads that only exist locally (see above); the
 * caller does not need to branch on that, since the thread already carries
 * its own full message history on-device either way.
 */
export async function sendMessage(input: {
  threadId: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; kept on this device only.' };
  const { error } = await supabase.from('messages').insert({ thread_id: input.threadId, body: input.text });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Upload a photo (F-MEDIA-01). `localUri` should already be the prepared
 * image from `src/lib/media.ts` — resized and re-encoded, not the raw pick.
 *
 * `by` and `alt` are never sent: the server computes ownership from
 * `business_roles` and fills a fallback alt text if none is given, the same
 * shape as `recommended` on a review — the client proposes, the database
 * decides. The daily upload cap (F-MEDIA-01) and the storage path check that
 * an upload actually lands under a real venue's folder are both enforced by
 * the database, not by this function declining to try.
 */
export async function uploadPhoto(input: {
  venueId: string;
  album: Photo['album'];
  caption?: string;
  localUri: string;
}): Promise<{ ok: true; photo: Photo } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) {
    return { ok: false, error: 'No backend configured; the photo could not be uploaded.' };
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to add a photo.' };

  const path = `${input.venueId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`;

  try {
    const response = await fetch(input.localUri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('venue-photos')
      .upload(path, blob, { contentType: 'image/jpeg' });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { data: row, error: insertError } = await supabase
      .from('photos')
      .insert({
        venue_id: input.venueId,
        uploaded_by: user.id,
        album: input.album as never,
        caption: input.caption ?? null,
        storage_path: path,
      })
      .select('*')
      .single();
    if (insertError) return { ok: false, error: insertError.message };

    const { data: pub } = supabase.storage.from('venue-photos').getPublicUrl(path);
    return { ok: true, photo: mapPhotoRow(row, pub.publicUrl) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not upload the photo.' };
  }
}

/** F-MEDIA-04: file a removal request. There is no moderation queue in this
 * build to act on it — see the migration header — but the record is real. */
export async function requestPhotoRemoval(input: {
  photoId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the request was not sent.' };
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to request removal.' };

  const { error } = await supabase
    .from('photo_removal_requests')
    .insert({ photo_id: input.photoId, requested_by: user.id, reason: input.reason });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * F-BIZ-01 (scoped): self-serve claim. See the migration header for why this
 * is self-attestation rather than the PRD's real multi-path verification —
 * it flips `venues.claimed`, never `venues.verified`. The database rejects
 * the insert outright if the venue already has a business_roles row held by
 * someone else, which surfaces here as `error`.
 */
export async function claimVenue(input: {
  venueId: string;
  role: ClaimableBusinessRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) {
    return { ok: false, error: 'No backend configured; this listing could not be claimed.' };
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to claim this listing.' };

  const { error } = await supabase
    .from('business_roles')
    .insert({ user_id: user.id, venue_id: input.venueId, role: input.role });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Venue ids the signed-in account holds a business role at (RLS restricts this to your own rows). */
export async function getManagedVenueIds(): Promise<string[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase.from('business_roles').select('venue_id');
  return (data ?? []).map((row) => row.venue_id);
}

/**
 * F-BIZ-07 (scoped): post or edit the owner response on a review at a venue
 * this account manages. The database is what actually enforces "only these
 * two columns, only for your own venue" (see 20260825150000_add_review_response.sql)
 * — this just sends the one field, the same shape as every other write here.
 */
export async function respondToReview(input: {
  reviewId: string;
  text: string;
}): Promise<{ ok: true; response: { text: string; date: string } } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the response could not be posted.' };
  const { data, error } = await supabase
    .from('reviews')
    .update({ owner_response: input.text })
    .eq('id', input.reviewId)
    .select('owner_response, owner_response_at')
    .single();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    response: { text: data.owner_response ?? input.text, date: (data.owner_response_at ?? new Date().toISOString()).slice(0, 10) },
  };
}

/**
 * F-BIZ-04 (scoped): overwrite a managed venue's hours and happy hours.
 * The database — not this function — is what actually enforces "only these
 * two fields, only for a venue you manage" (see
 * 20260825160000_add_venue_hours_edit.sql), the same shape as every other
 * write here.
 */
export async function updateVenueHours(input: {
  venueId: string;
  schedules: Schedule[];
  happyHours: HappyHourWindow[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; hours could not be updated.' };
  const { error } = await supabase
    .from('venues')
    .update({ schedules: input.schedules as never, happy_hours: input.happyHours as never })
    .eq('id', input.venueId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * F-BIZ-05 (scoped): overwrite a managed venue's menus. No import from CSV,
 * PDF, or photo — see the migration header on
 * 20260825170000_add_venue_menu_edit.sql for why. The database enforces
 * "only for a venue you manage," the same shape as updateVenueHours above.
 */
export async function updateVenueMenus(input: {
  venueId: string;
  menus: MenuSection[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the menu could not be updated.' };
  const { error } = await supabase
    .from('venues')
    .update({ menus: input.menus as never })
    .eq('id', input.venueId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ------------------------------------------------------------------- auth */

/**
 * Real Supabase Auth, scoped to a one-time emailed code — no password
 * field, the same reasoning `app/auth.tsx` already states for why one never
 * existed. This is the account itself: who you are, real and persisted
 * across devices. It is deliberately *not* R3's phone/age verification,
 * which stays self-attested (see `profiles_guard_privileged_columns` in
 * 20260822000100_init_schema.sql — `phone_verified` and `age_verified` are
 * server-maintained columns a client can never set, and nothing server-side
 * in this build sets them either, since there is no real SMS provider wired
 * up). Signing in for real unblocks photo uploads, removal requests, and
 * venue claims, which never required verification — reviews, bookings, and
 * messaging still cannot succeed, since their RLS policies require
 * `private.is_verified()` and nothing can make that true here.
 */
export type AuthProfile = { displayName: string; phoneVerified: boolean; ageVerified: boolean };

function toAuthProfile(
  row: { display_name: string; phone_verified: boolean; age_verified: boolean } | null,
): AuthProfile {
  return row
    ? { displayName: row.display_name, phoneVerified: row.phone_verified, ageVerified: row.age_verified }
    : { displayName: 'You', phoneVerified: false, ageVerified: false };
}

/**
 * `displayName` only takes effect the first time this email signs in —
 * `handle_new_user()` seeds `profiles.display_name` from it on account
 * creation and ignores it on every later code request for the same email.
 */
export async function sendSignInCode(input: {
  email: string;
  displayName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; there is nowhere to send a code.' };
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: { data: { display_name: input.displayName } },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function verifySignInCode(input: {
  email: string;
  code: string;
}): Promise<{ ok: true; profile: AuthProfile } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; there is no code to verify.' };
  const { data, error } = await supabase.auth.verifyOtp({ email: input.email, token: input.code, type: 'email' });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: 'Could not confirm that code.' };

  const { data: row } = await supabase
    .from('profiles')
    .select('display_name, phone_verified, age_verified')
    .eq('id', data.user.id)
    .maybeSingle();
  return { ok: true, profile: toAuthProfile(row) };
}

/** A snapshot of an already-signed-in session, read once at launch. */
export async function getAuthSnapshot(): Promise<AuthProfile | null> {
  if (!hasBackend || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const { data: row } = await supabase
      .from('profiles')
      .select('display_name, phone_verified, age_verified')
      .eq('id', user.id)
      .maybeSingle();
    return toAuthProfile(row);
  } catch {
    return null;
  }
}

export async function signOutRemote(): Promise<void> {
  if (!hasBackend || !supabase) return;
  await supabase.auth.signOut();
}

/**
 * Fires on a real sign-out, including one this device did not initiate —
 * an expired or revoked refresh token — but not on routine token refresh,
 * which fires its own event this deliberately ignores.
 */
export function onAuthSignedOut(callback: () => void): () => void {
  if (!hasBackend || !supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') callback();
  });
  return () => data.subscription.unsubscribe();
}

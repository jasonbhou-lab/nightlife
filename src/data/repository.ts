import { events as seedEvents } from '@/data/events';
import { reviews as seedReviews } from '@/data/reviews';
import { venues as seedVenues } from '@/data/venues';
import { hasBackend, supabase } from '@/lib/supabase';
import type {
  BookingRow, BusinessInviteRow, BusinessReplyTemplateRow, ContentReportRow, EventRow,
  MessageRow, MessageThreadRow, ModerationActionRow, PhotoRow, ReviewRow, TableTierRow,
  VenueEventRow, VenueOfferRow, VenueRow,
} from '@/lib/database.types';
import type {
  Booking, BusinessInvite, BusinessReplyTemplate, ClaimableBusinessRole, ContentReport,
  HappyHourWindow, InvitableBusinessRole, MenuSection, Message, MessageThread, ModerationAction,
  Photo, PlatformRole, ReportReason, Review, Schedule, Venue, VenueAnalyticsEvent, VenueEvent,
  VenueEventKind, VenueOffer,
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
    contributionFrozen: row.contribution_frozen || undefined,
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
    autoResponseText: row.auto_response_text ?? undefined,
    reviewAlertThreshold: row.review_alert_threshold ?? undefined,
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

function mapVenueOffer(row: VenueOfferRow): VenueOffer {
  return {
    id: row.id,
    venueId: row.venue_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapBooking(row: BookingRow, guestName?: string): Booking {
  return {
    id: row.id,
    venueId: row.venue_id,
    kind: row.kind,
    date: row.booking_date,
    time: trimTime(row.booking_time),
    partySize: row.party_size,
    tier: row.tier ?? undefined,
    deposit: row.deposit ?? undefined,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    waitlistPosition: row.waitlist_position ?? undefined,
    waitMinutes: row.wait_minutes ?? undefined,
    guestName,
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sender: row.sender,
    text: row.body,
    createdAt: row.created_at,
  };
}

function mapMessageThread(row: MessageThreadRow, messages: Message[]): MessageThread {
  return {
    id: row.id,
    venueId: row.venue_id,
    kind: row.kind,
    subject: row.subject ?? undefined,
    intake: Object.keys(asRecord(row.intake)).length ? (row.intake as MessageThread['intake']) : undefined,
    blocked: row.blocked,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    messages,
  };
}

function mapBusinessReplyTemplate(row: BusinessReplyTemplateRow): BusinessReplyTemplate {
  return {
    id: row.id,
    venueId: row.venue_id,
    label: row.label,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapContentReport(row: ContentReportRow): ContentReport {
  return {
    id: row.id,
    reviewId: row.review_id,
    reporterId: row.reporter_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

function mapModerationAction(row: ModerationActionRow): ModerationAction {
  return {
    id: row.id,
    action: row.action,
    reviewId: row.review_id ?? undefined,
    reportId: row.report_id ?? undefined,
    venueId: row.venue_id ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function mapVenueEvent(row: VenueEventRow): VenueAnalyticsEvent {
  return {
    id: row.id,
    venueId: row.venue_id,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

/** A row from the real `photos` table, with its storage path resolved to a public URL. */
function mapPhotoRow(row: PhotoRow, publicUrl: string): Photo {
  return {
    id: row.id,
    album: row.album,
    caption: row.caption ?? '',
    by: row.by,
    isCover: row.is_cover || undefined,
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
    const [venuesRes, tiersRes, eventsRes, reviewsRes, photosRes, offersRes] = await Promise.all([
      supabase.from('venues').select('*'),
      supabase.from('table_tiers').select('*'),
      supabase.from('events').select('*'),
      supabase.from('reviews').select('*'),
      supabase
        .from('photos')
        .select('*')
        .order('is_cover', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('venue_offers').select('*'),
    ]);

    const firstError =
      venuesRes.error ?? tiersRes.error ?? eventsRes.error ?? reviewsRes.error ?? photosRes.error ?? offersRes.error;
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
    // A selected cover (F-BIZ-06) leads the whole gallery, not just the
    // uploaded segment, or choosing one would have no visible effect next
    // to the seeded placeholder photos already at the front of the array.
    const withUploadedPhotos = withFallbackDistance.map((v) => {
      const uploaded = photosByVenue.get(v.id);
      if (!uploaded?.length) return v;
      const cover = uploaded.find((p) => p.isCover);
      const rest = cover ? uploaded.filter((p) => p.id !== cover.id) : uploaded;
      return { ...v, photos: cover ? [cover, ...v.photos, ...rest] : [...v.photos, ...rest] };
    });

    const offersByVenue = new Map<string, VenueOffer[]>();
    for (const row of offersRes.data ?? []) {
      const list = offersByVenue.get(row.venue_id) ?? [];
      list.push(mapVenueOffer(row));
      offersByVenue.set(row.venue_id, list);
    }
    const withOffers = withUploadedPhotos.map((v) => {
      const offers = offersByVenue.get(v.id);
      return offers?.length ? { ...v, offers } : v;
    });

    return {
      venues: withDistances(withOffers, origin, rowsById),
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

/**
 * Cancel your own booking on the backend. Found missing while building the
 * F-BIZ-11 business console: AppProvider's cancelBooking only ever flipped
 * local device state, so a business reading the real `bookings` table would
 * see a permanently-stale status for anything its own guest had "cancelled."
 * Best-effort, mirrored the same way sendMessage is — the local state is
 * already updated by the time this is called (see AppProvider.cancelBooking).
 */
export async function cancelBookingRemote(bookingId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; kept on this device only.' };
  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
 * F-BIZ-06 / F-MEDIA-06: select a cover photo among a venue's own
 * owner-credited uploads. The database — not this function — is what
 * actually restricts this to `by = 'owner'` rows at a venue the caller
 * manages (photos_business_update in 20260827110000_add_photo_management.sql),
 * and clears any previous cover at the same venue as a side effect.
 */
export async function setPhotoCover(photoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing was changed.' };
  const { error } = await supabase.from('photos').update({ is_cover: true }).eq('id', photoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * F-BIZ-06 / F-MEDIA-06: persist a new relative order for a venue's own
 * owner-credited photos — `orderedPhotoIds` is the full list, front to back,
 * and each photo's `sort_order` becomes its index. Small, bounded list
 * (owner uploads only, capped by the daily upload limit), so one update per
 * photo rather than a bulk statement.
 */
export async function reorderOwnerPhotos(orderedPhotoIds: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing was changed.' };
  const client = supabase;
  const results = await Promise.all(
    orderedPhotoIds.map((id, index) => client.from('photos').update({ sort_order: index }).eq('id', id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
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

function mapBusinessInvite(row: BusinessInviteRow): BusinessInvite {
  return {
    id: row.id,
    venueId: row.venue_id,
    email: row.email,
    role: row.role as InvitableBusinessRole,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? undefined,
  };
}

/**
 * F-BIZ-13 (scoped): invite a manager or staff member by email. See the
 * migration header on 20260825180000_add_business_invites.sql for how
 * acceptance works — this only creates the record.
 */
export async function inviteToManageVenue(input: {
  venueId: string;
  email: string;
  role: InvitableBusinessRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the invite could not be sent.' };
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to invite someone.' };

  const { error } = await supabase
    .from('business_invites')
    .insert({ venue_id: input.venueId, email: input.email.trim().toLowerCase(), role: input.role, invited_by: user.id });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Invites this account sent for a venue, pending and accepted alike. */
export async function getSentInvites(venueId: string): Promise<BusinessInvite[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase
    .from('business_invites')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapBusinessInvite);
}

/** Pending invites addressed to the signed-in account's own confirmed email. */
export async function getMyPendingInvites(): Promise<BusinessInvite[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase.from('business_invites').select('*').is('accepted_at', null);
  return (data ?? []).map(mapBusinessInvite);
}

/**
 * Accepting an invite is a real business_roles insert, not a status flip on
 * the invite row — the database's own guard is what actually checks a
 * matching invite exists before allowing it (see the migration header on
 * 20260825180000_add_business_invites.sql), and marks the invite accepted
 * as a side effect once it succeeds.
 */
export async function acceptInvite(input: {
  venueId: string;
  role: InvitableBusinessRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the invite could not be accepted.' };
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to accept this invite.' };

  const { error } = await supabase
    .from('business_roles')
    .insert({ user_id: user.id, venue_id: input.venueId, role: input.role });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Doubles as revoke (sender, before acceptance) and decline (invitee). */
export async function deleteInvite(inviteId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing to remove.' };
  const { error } = await supabase.from('business_invites').delete().eq('id', inviteId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

/**
 * F-BIZ-03 (scoped way down): tagline and about only, not the full typed
 * attribute registry with change history — see the migration header on
 * 20260825190000_add_venue_listing_edit.sql.
 */
export async function updateVenueListing(input: {
  venueId: string;
  tagline: string;
  about: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the listing could not be updated.' };
  const { error } = await supabase
    .from('venues')
    .update({ tagline: input.tagline, about: input.about })
    .eq('id', input.venueId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * F-BIZ-09 (scoped): a self-published offer, not a purchased placement —
 * see the migration header on 20260826100000_add_venue_offers.sql for why
 * there is no alcohol/tobacco price-advertising enforcement or targeting
 * here. The database enforces "only for a venue you manage," same shape as
 * every other write here.
 */
export async function createVenueOffer(input: {
  venueId: string;
  title: string;
  description: string;
  endsAt?: string;
}): Promise<{ ok: true; offer: VenueOffer } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the offer could not be posted.' };
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to post an offer.' };

  const { data, error } = await supabase
    .from('venue_offers')
    .insert({
      venue_id: input.venueId,
      title: input.title,
      description: input.description,
      ends_at: input.endsAt ?? null,
      created_by: user.id,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, offer: mapVenueOffer(data) };
}

export async function deleteVenueOffer(offerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing to remove.' };
  const { error } = await supabase.from('venue_offers').delete().eq('id', offerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* -------------------------------------------------------------------- F-TRUST */

/** Platform roles (moderator, trust_safety) this account holds — see the
 * migration header on 20260826110000_add_trust_and_safety.sql for why there
 * is no self-serve path to acquire one, the same shape as getManagedVenueIds
 * above but with nothing analogous to a claim. */
export async function getPlatformRoles(): Promise<PlatformRole[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase.from('platform_roles').select('role');
  return (data ?? []).map((row) => row.role);
}

/**
 * F-REVIEW-10. Reporting only needs a signed-in account (private.is_verified()
 * is not part of the insert policy) — a safety action should not sit behind
 * the same wall as writing content.
 */
export async function reportReview(input: {
  reviewId: string;
  reason: ReportReason;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the report was not sent.' };
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: 'Sign in to report this review.' };

  const { error } = await supabase
    .from('content_reports')
    .insert({ review_id: input.reviewId, reporter_id: user.id, reason: input.reason });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'You already reported this review.' };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** F-TRUST-01: every report a moderator or trust_safety account can see — RLS
 * restricts a non-platform-role account to only its own reports. */
export async function getModerationQueue(): Promise<ContentReport[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase.from('content_reports').select('*').order('created_at', { ascending: false });
  return (data ?? []).map(mapContentReport);
}

/**
 * F-TRUST-01/08. The single write a moderator or trust_safety account makes
 * to resolve a report — content_reports_apply_moderation() is what actually
 * flips the review's `recommended` flag and writes the audit entry as a side
 * effect, atomically, and what actually enforces which role may make which
 * transition (see the migration header). This just sends the new status.
 */
export async function moderateReport(input: {
  reportId: string;
  status: 'dismissed' | 'removed' | 'escalated';
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing to update.' };
  const { error } = await supabase.from('content_reports').update({ status: input.status }).eq('id', input.reportId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Restoring a removed review reuses the same transition machinery (removed -> dismissed). */
export async function restoreReview(reportId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return moderateReport({ reportId, status: 'dismissed' });
}

/**
 * F-TRUST-04, trust_safety only. `alert` null clears it. The database — not
 * this function — is what actually restricts this to exactly these two
 * columns for a trust_safety account (venues_guard_owner_write's second
 * branch) and writes the audit entry as a side effect.
 */
export async function setConsumerAlert(input: {
  venueId: string;
  alert: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the alert could not be updated.' };
  const { error } = await supabase.from('venues').update({ consumer_alert: input.alert }).eq('id', input.venueId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** F-TRUST-04 / R12: "freeze contribution on a listing." */
export async function setContributionFrozen(input: {
  venueId: string;
  frozen: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing was changed.' };
  const { error } = await supabase.from('venues').update({ contribution_frozen: input.frozen }).eq('id', input.venueId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** F-TRUST-08: the immutable audit log, read-only here — moderator/trust_safety only. */
export async function getModerationHistory(): Promise<ModerationAction[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase.from('moderation_actions').select('*').order('created_at', { ascending: false }).limit(100);
  return (data ?? []).map(mapModerationAction);
}

/* ------------------------------------------------------------------ F-BIZ-11 */

/**
 * F-BIZ-11, scoped: every booking and waitlist entry at a venue this account
 * manages — see the migration header on 20260826120000_add_business_bookings.sql
 * for why there's no floor map or staff assignment. `guestName` is a
 * device-side join against `profiles`, and is absent when the guest's
 * profile isn't public — this never fabricates a name.
 */
/**
 * F-BIZ-08: log a single profile view or click. Fire-and-forget by design —
 * an analytics write should never block or break the screen a guest is
 * actually trying to use, so failures (including "no backend configured")
 * are swallowed rather than surfaced. See the migration header on
 * 20260827130000_add_venue_analytics.sql for why no actor is captured.
 */
export function logVenueEvent(venueId: string, kind: VenueEventKind): void {
  if (!hasBackend || !supabase) return;
  supabase
    .from('venue_events')
    .insert({ venue_id: venueId, kind })
    .then(() => {}, () => {});
}

/**
 * F-BIZ-08: a business account's own raw event log for a venue it manages —
 * RLS is what actually restricts this to that account (venue_events_business_read).
 * Aggregation (views by day, clicks by kind, traffic by daypart) happens on
 * the device, in src/lib/analytics.ts, the same split ratings.ts already
 * uses for reviews.
 */
export async function getVenueEvents(venueId: string): Promise<VenueAnalyticsEvent[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase
    .from('venue_events')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapVenueEvent);
}

export async function getVenueBookings(venueId: string): Promise<Booking[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('venue_id', venueId)
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true });
  const rows = data ?? [];
  if (!rows.length) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profileRows } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
  const nameById = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p.display_name]));

  return rows.map((row) => mapBooking(row, nameById[row.user_id]));
}

/**
 * The database — not this function — enforces "only status, wait time, and
 * waitlist position, only for a venue you manage" (bookings_guard_business_write
 * in the migration above), the same shape as every other business write here.
 */
export async function updateBookingStatus(input: {
  bookingId: string;
  status: 'confirmed' | 'waitlisted' | 'cancelled';
  waitMinutes?: number;
  waitlistPosition?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing was changed.' };
  const patch: { status: 'confirmed' | 'waitlisted' | 'cancelled'; wait_minutes?: number; waitlist_position?: number } = {
    status: input.status,
  };
  if (input.waitMinutes != null) patch.wait_minutes = input.waitMinutes;
  if (input.waitlistPosition != null) patch.waitlist_position = input.waitlistPosition;
  const { error } = await supabase.from('bookings').update(patch).eq('id', input.bookingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ------------------------------------------------------------------ F-MSG-02 */

/**
 * Fresh messages for one thread, in either direction. Used by the consumer's
 * own thread screen (a business reply never appears there without this —
 * see the migration header on 20260827090000_add_business_messaging.sql)
 * and by the business console reading the same thread.
 */
export async function getThreadMessages(threadId: string): Promise<Message[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapMessage);
}

/**
 * F-MSG-02: a business account replying free text or from a saved template.
 * The database — not this function — is what actually restricts a
 * 'business'-sender row to an account holding a business role at the
 * thread's venue (messages_business_insert).
 */
export async function sendBusinessReply(input: {
  threadId: string;
  text: string;
}): Promise<{ ok: true; message: Message } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the reply was not sent.' };
  const { data, error } = await supabase
    .from('messages')
    .insert({ thread_id: input.threadId, sender: 'business', body: input.text })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: mapMessage(data) };
}

/**
 * Every thread at a venue this account manages, each with its own messages
 * already loaded — the business console shows both in one screen, so there
 * is no separate per-thread fetch. `guestName` is a device-side join
 * against `profiles`, the same pattern getVenueBookings uses, and absent
 * (falls back to "Guest") rather than invented when the guest's profile
 * isn't public.
 */
export async function getVenueThreads(venueId: string): Promise<(MessageThread & { guestName?: string })[]> {
  if (!hasBackend || !supabase) return [];
  const { data: threadRows } = await supabase
    .from('message_threads')
    .select('*')
    .eq('venue_id', venueId)
    .order('last_message_at', { ascending: false });
  const threads = threadRows ?? [];
  if (!threads.length) return [];

  const threadIds = threads.map((t) => t.id);
  const { data: messageRows } = await supabase
    .from('messages')
    .select('*')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: true });
  const messagesByThread: Record<string, Message[]> = {};
  for (const row of messageRows ?? []) (messagesByThread[row.thread_id] ||= []).push(mapMessage(row));

  const userIds = Array.from(new Set(threads.map((t) => t.user_id)));
  const { data: profileRows } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
  const nameById = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p.display_name]));

  return threads.map((row) => ({
    ...mapMessageThread(row, messagesByThread[row.id] ?? []),
    guestName: nameById[row.user_id],
  }));
}

/** F-MSG-02: saved canned replies for a venue this account manages. */
export async function getBusinessReplyTemplates(venueId: string): Promise<BusinessReplyTemplate[]> {
  if (!hasBackend || !supabase) return [];
  const { data } = await supabase
    .from('business_reply_templates')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapBusinessReplyTemplate);
}

export async function createBusinessReplyTemplate(input: {
  venueId: string;
  label: string;
  body: string;
}): Promise<{ ok: true; template: BusinessReplyTemplate } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; the template was not saved.' };
  const { data, error } = await supabase
    .from('business_reply_templates')
    .insert({ venue_id: input.venueId, label: input.label, body: input.body })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, template: mapBusinessReplyTemplate(data) };
}

export async function deleteBusinessReplyTemplate(templateId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing to remove.' };
  const { error } = await supabase.from('business_reply_templates').delete().eq('id', templateId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * F-MSG-02: the venue's own configured auto-response, sent once by the
 * database itself on the first message in a new thread (messages_auto_respond).
 * `text` null clears it. The database restricts this to a business account
 * managing the venue, the same as every other listing write here.
 */
export async function setVenueAutoResponse(input: {
  venueId: string;
  text: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing was changed.' };
  const { error } = await supabase.from('venues').update({ auto_response_text: input.text }).eq('id', input.venueId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * F-BIZ-07: the threshold a business account sets for which reviews should
 * surface as needing attention. Null disables it. See the migration header
 * on 20260827120000_add_review_alerts.sql for why this doesn't need the
 * sentiment/keyword-theme infrastructure the rest of the PRD requirement
 * asks for.
 */
export async function setVenueReviewAlertThreshold(input: {
  venueId: string;
  threshold: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasBackend || !supabase) return { ok: false, error: 'No backend configured; nothing was changed.' };
  const { error } = await supabase
    .from('venues')
    .update({ review_alert_threshold: input.threshold })
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

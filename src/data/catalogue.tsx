import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loadCatalogue, type Source } from '@/data/repository';
import { events as seedEvents } from '@/data/events';
import { reviews as seedReviews } from '@/data/reviews';
import { venues as seedVenues } from '@/data/venues';
import type {
  HappyHourWindow, MenuSection, Photo, Review, Schedule, Venue, VenueEvent, VenueOffer,
} from '@/types';

/**
 * The catalogue: venues, events, and reviews, from whichever source is
 * available.
 *
 * Screens read this instead of importing the seed arrays directly, which is
 * what makes the backend swap a one-line change per screen rather than a
 * rewrite. It starts populated with the bundled seed so the first frame has
 * content — no spinner on a cold start — and replaces it if the remote fetch
 * succeeds.
 */

type CatalogueCtx = {
  venues: Venue[];
  events: VenueEvent[];
  reviews: Review[];
  source: Source;
  /** Non-null when a remote read was attempted and failed; the seed is showing. */
  error: string | null;
  loading: boolean;
  reload: () => void;

  venueById: Record<string, Venue>;
  getVenue: (id: string | undefined) => Venue | undefined;
  /** Recommended reviews by default; pass true to include the filtered ones. */
  venueReviews: (venueId: string, includeFiltered?: boolean) => Review[];
  filteredCount: (venueId: string) => number;
  eventsForVenue: (venueId: string) => VenueEvent[];
  /**
   * F-MEDIA-01: append a just-uploaded photo to a venue's gallery in this
   * session, without waiting on a full `reload()`. The upload already
   * persisted server-side by the time this is called — this only updates
   * what's on screen.
   */
  addLocalPhoto: (venueId: string, photo: Photo) => void;
  /**
   * F-BIZ-01: reflect a just-succeeded claim in this session without waiting
   * on a full `reload()`. Only ever flips `claimed` — never `verified`,
   * which self-attestation does not earn. See repository.claimVenue.
   */
  markVenueClaimed: (venueId: string) => void;
  /**
   * F-BIZ-07: reflect a just-posted owner response in this session without
   * waiting on a full `reload()`. See repository.respondToReview.
   */
  setReviewOwnerResponse: (reviewId: string, response: { text: string; date: string }) => void;
  /**
   * F-BIZ-04: reflect a just-saved hours edit in this session without
   * waiting on a full `reload()`. See repository.updateVenueHours.
   */
  setVenueHours: (venueId: string, schedules: Schedule[], happyHours: HappyHourWindow[]) => void;
  /**
   * F-BIZ-05: reflect a just-saved menu edit in this session without
   * waiting on a full `reload()`. See repository.updateVenueMenus.
   */
  setVenueMenus: (venueId: string, menus: MenuSection[]) => void;
  /**
   * F-BIZ-03: reflect a just-saved tagline/about edit in this session
   * without waiting on a full `reload()`. See repository.updateVenueListing.
   */
  setVenueListing: (venueId: string, tagline: string, about: string) => void;
  /**
   * F-BIZ-09: reflect a just-posted offer, or its removal, in this session
   * without waiting on a full `reload()`. See repository.createVenueOffer /
   * deleteVenueOffer.
   */
  addVenueOffer: (venueId: string, offer: VenueOffer) => void;
  removeVenueOffer: (venueId: string, offerId: string) => void;
  /**
   * F-TRUST-01: reflect a just-moderated review (removed or restored) in this
   * session without waiting on a full `reload()`. See repository.moderateReport
   * / restoreReview.
   */
  setReviewRecommended: (reviewId: string, recommended: boolean) => void;
  /**
   * F-TRUST-04: reflect a just-applied or -cleared Consumer Alert, or a
   * contribution freeze/unfreeze, in this session without waiting on a full
   * `reload()`. See repository.setConsumerAlert / setContributionFrozen.
   */
  setVenueConsumerAlert: (venueId: string, alert: string | undefined) => void;
  setVenueContributionFrozen: (venueId: string, frozen: boolean) => void;
  /**
   * F-BIZ-06 / F-MEDIA-06: reflect a just-selected cover, or a just-saved
   * reorder of the venue's own owner-credited photos, in this session
   * without waiting on a full `reload()`. See repository.setPhotoCover /
   * reorderOwnerPhotos.
   */
  setVenuePhotoCover: (venueId: string, photoId: string) => void;
  setVenuePhotoOrder: (venueId: string, orderedOwnerPhotoIds: string[]) => void;
};

const Ctx = createContext<CatalogueCtx | null>(null);

export function CatalogueProvider({ children }: { children: React.ReactNode }) {
  const [venues, setVenues] = useState<Venue[]>(seedVenues);
  const [events, setEvents] = useState<VenueEvent[]>(seedEvents);
  const [reviews, setReviews] = useState<Review[]>(seedReviews);
  const [source, setSource] = useState<Source>('seed');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCatalogue()
      .then((result) => {
        if (cancelled) return;
        setVenues(result.venues);
        setEvents(result.events);
        setReviews(result.reviews);
        setSource(result.source);
        setError(result.error ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((v) => v + 1), []);

  const addLocalPhoto = useCallback((venueId: string, photo: Photo) => {
    setVenues((prev) =>
      prev.map((v) => (v.id === venueId ? { ...v, photos: [...v.photos, photo] } : v)),
    );
  }, []);

  const markVenueClaimed = useCallback((venueId: string) => {
    setVenues((prev) => prev.map((v) => (v.id === venueId ? { ...v, claimed: true } : v)));
  }, []);

  const setReviewOwnerResponse = useCallback(
    (reviewId: string, response: { text: string; date: string }) => {
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, ownerResponse: response } : r)));
    },
    [],
  );

  const setVenueHours = useCallback(
    (venueId: string, schedules: Schedule[], happyHours: HappyHourWindow[]) => {
      setVenues((prev) =>
        prev.map((v) => (v.id === venueId ? { ...v, schedules, happyHours } : v)),
      );
    },
    [],
  );

  const setVenueMenus = useCallback((venueId: string, menus: MenuSection[]) => {
    setVenues((prev) => prev.map((v) => (v.id === venueId ? { ...v, menus } : v)));
  }, []);

  const setVenueListing = useCallback((venueId: string, tagline: string, about: string) => {
    setVenues((prev) => prev.map((v) => (v.id === venueId ? { ...v, tagline, about } : v)));
  }, []);

  const addVenueOffer = useCallback((venueId: string, offer: VenueOffer) => {
    setVenues((prev) =>
      prev.map((v) => (v.id === venueId ? { ...v, offers: [...(v.offers ?? []), offer] } : v)),
    );
  }, []);

  const removeVenueOffer = useCallback((venueId: string, offerId: string) => {
    setVenues((prev) =>
      prev.map((v) =>
        v.id === venueId ? { ...v, offers: (v.offers ?? []).filter((o) => o.id !== offerId) } : v,
      ),
    );
  }, []);

  const setReviewRecommended = useCallback((reviewId: string, recommended: boolean) => {
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, recommended } : r)));
  }, []);

  const setVenueConsumerAlert = useCallback((venueId: string, alert: string | undefined) => {
    setVenues((prev) => prev.map((v) => (v.id === venueId ? { ...v, consumerAlert: alert } : v)));
  }, []);

  const setVenueContributionFrozen = useCallback((venueId: string, frozen: boolean) => {
    setVenues((prev) =>
      prev.map((v) => (v.id === venueId ? { ...v, contributionFrozen: frozen || undefined } : v)),
    );
  }, []);

  const setVenuePhotoCover = useCallback((venueId: string, photoId: string) => {
    setVenues((prev) =>
      prev.map((v) => {
        if (v.id !== venueId) return v;
        const target = v.photos.find((p) => p.id === photoId);
        if (!target) return v;
        const rest = v.photos
          .filter((p) => p.id !== photoId)
          .map((p) => (p.isCover ? { ...p, isCover: undefined } : p));
        return { ...v, photos: [{ ...target, isCover: true }, ...rest] };
      }),
    );
  }, []);

  const setVenuePhotoOrder = useCallback((venueId: string, orderedOwnerPhotoIds: string[]) => {
    setVenues((prev) =>
      prev.map((v) => {
        if (v.id !== venueId) return v;
        const byId = new Map(v.photos.map((p) => [p.id, p]));
        const orderedSet = new Set(orderedOwnerPhotoIds);
        let cursor = 0;
        // Reassigns which photo occupies each slot an owner photo already
        // held, rather than rebuilding the array — seed and community
        // photos keep their exact positions.
        const photos = v.photos.map((p) => {
          if (!orderedSet.has(p.id)) return p;
          const replacement = byId.get(orderedOwnerPhotoIds[cursor]);
          cursor += 1;
          return replacement ?? p;
        });
        return { ...v, photos };
      }),
    );
  }, []);

  const venueById = useMemo(
    () => Object.fromEntries(venues.map((v) => [v.id, v])),
    [venues],
  );

  const reviewsByVenue = useMemo(() => {
    const map: Record<string, Review[]> = {};
    for (const r of reviews) (map[r.venueId] ||= []).push(r);
    for (const list of Object.values(map)) list.sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }, [reviews]);

  const eventsByVenue = useMemo(() => {
    const map: Record<string, VenueEvent[]> = {};
    for (const e of events) (map[e.venueId] ||= []).push(e);
    return map;
  }, [events]);

  const value = useMemo<CatalogueCtx>(
    () => ({
      venues,
      events,
      reviews,
      source,
      error,
      loading,
      reload,
      venueById,
      getVenue: (id) => (id ? venueById[id] : undefined),
      venueReviews: (venueId, includeFiltered = false) => {
        const list = reviewsByVenue[venueId] ?? [];
        return includeFiltered ? list : list.filter((r) => r.recommended);
      },
      filteredCount: (venueId) =>
        (reviewsByVenue[venueId] ?? []).filter((r) => !r.recommended).length,
      eventsForVenue: (venueId) => eventsByVenue[venueId] ?? [],
      addLocalPhoto,
      markVenueClaimed,
      setReviewOwnerResponse,
      setVenueHours,
      setVenueMenus,
      setVenueListing,
      addVenueOffer,
      removeVenueOffer,
      setReviewRecommended,
      setVenueConsumerAlert,
      setVenueContributionFrozen,
      setVenuePhotoCover,
      setVenuePhotoOrder,
    }),
    [
      venues, events, reviews, source, error, loading, reload, venueById, reviewsByVenue,
      eventsByVenue, addLocalPhoto, markVenueClaimed, setReviewOwnerResponse, setVenueHours,
      setVenueMenus, setVenueListing, addVenueOffer, removeVenueOffer, setReviewRecommended,
      setVenueConsumerAlert, setVenueContributionFrozen, setVenuePhotoCover, setVenuePhotoOrder,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalogue(): CatalogueCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalogue must be used inside CatalogueProvider');
  return ctx;
}

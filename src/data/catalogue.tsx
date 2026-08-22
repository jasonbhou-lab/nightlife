import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loadCatalogue, type Source } from '@/data/repository';
import { events as seedEvents } from '@/data/events';
import { reviews as seedReviews } from '@/data/reviews';
import { venues as seedVenues } from '@/data/venues';
import type { Review, Venue, VenueEvent } from '@/types';

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
    }),
    [venues, events, reviews, source, error, loading, reload, venueById, reviewsByVenue, eventsByVenue],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalogue(): CatalogueCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalogue must be used inside CatalogueProvider');
  return ctx;
}

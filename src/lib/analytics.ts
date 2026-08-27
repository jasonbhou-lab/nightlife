import type { Review, Venue, VenueAnalyticsEvent, VenueEventKind } from '@/types';

/**
 * F-BIZ-08's client-side aggregation. `getVenueEvents` fetches the raw log,
 * these functions turn it into what the dashboard shows — the same split
 * src/lib/ratings.ts already uses for reviews, rather than a server-side
 * rollup table this build has no need for at this scale.
 */

const RECENT_DAYS = 14;

const DAYPARTS: { label: string; test: (hour: number) => boolean }[] = [
  { label: 'Morning (5–11a)', test: (h) => h >= 5 && h < 11 },
  { label: 'Afternoon (11a–5p)', test: (h) => h >= 11 && h < 17 },
  { label: 'Evening (5–9p)', test: (h) => h >= 17 && h < 21 },
  { label: 'Late night (9p–5a)', test: (h) => h >= 21 || h < 5 },
];

export type EventSummary = {
  totalViews: number;
  clicksByKind: Partial<Record<Exclude<VenueEventKind, 'view'>, number>>;
  /** Last 14 days, oldest first, zero-filled for days with no views. */
  viewsByDay: { date: string; count: number }[];
  viewsByDaypart: { label: string; count: number }[];
};

/** Traffic by daypart only counts `view` events — clicks are already broken out by kind above. */
export function summarizeEvents(events: VenueAnalyticsEvent[], now: Date): EventSummary {
  const clicksByKind: EventSummary['clicksByKind'] = {};
  let totalViews = 0;

  const dayBuckets = new Map<string, number>();
  for (let i = RECENT_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }

  const daypartCounts = DAYPARTS.map(() => 0);

  for (const e of events) {
    if (e.kind === 'view') {
      totalViews += 1;
      const dayKey = e.createdAt.slice(0, 10);
      if (dayBuckets.has(dayKey)) dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + 1);
      const hour = new Date(e.createdAt).getHours();
      const idx = DAYPARTS.findIndex((d) => d.test(hour));
      if (idx >= 0) daypartCounts[idx] += 1;
    } else {
      clicksByKind[e.kind] = (clicksByKind[e.kind] ?? 0) + 1;
    }
  }

  return {
    totalViews,
    clicksByKind,
    viewsByDay: Array.from(dayBuckets.entries()).map(([date, count]) => ({ date, count })),
    viewsByDaypart: DAYPARTS.map((d, i) => ({ label: d.label, count: daypartCounts[i] })),
  };
}

export type RatingTrendPoint = { label: string; avg: number; count: number };

/**
 * Monthly average of the venue's own recommended reviews — the same rating
 * basis the public number already uses (F-REVIEW-08, src/lib/ratings.ts),
 * not a second, different definition of "the rating" shown only to the
 * owner. A month with no recommended reviews shows `count: 0` rather than
 * being silently dropped, so a real quiet month reads as quiet, not absent.
 */
export function ratingTrend(reviews: Review[], now: Date, months = 6): RatingTrendPoint[] {
  const buckets: { key: string; label: string; sum: number; count: number }[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    buckets.push({ key, label, sum: 0, count: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const r of reviews) {
    if (!r.recommended) continue;
    const bucket = byKey.get(r.date.slice(0, 7));
    if (!bucket) continue;
    bucket.sum += r.rating;
    bucket.count += 1;
  }

  return buckets.map((b) => ({
    label: b.label,
    avg: b.count ? Math.round((b.sum / b.count) * 10) / 10 : 0,
    count: b.count,
  }));
}

export type CompetitorBenchmark = {
  peerCount: number;
  /** Null below MIN_PEERS_FOR_BENCHMARK — see the comment on that constant. */
  medianRating: number | null;
  venueRating: number;
};

/**
 * With too few peers, a "median" is really just one or two competitors'
 * actual ratings with extra steps — the PRD calls for this benchmark to be
 * anonymized, so below this floor nothing is shown rather than a number
 * that would de-anonymize a specific nearby venue.
 */
const MIN_PEERS_FOR_BENCHMARK = 3;

/**
 * F-BIZ-08's competitor set benchmarking, scoped to rating — see the
 * migration header on 20260827130000_add_venue_analytics.sql for why
 * view-count benchmarking is cut. A peer is another venue sharing this
 * venue's primary category and neighborhood; `allVenues` is the catalogue's
 * already-loaded, publicly-readable venue list, so this needs no new query
 * and no cross-tenant read of anything private.
 */
export function competitorBenchmark(venue: Venue, allVenues: Venue[]): CompetitorBenchmark {
  const peers = allVenues.filter(
    (v) => v.id !== venue.id && v.primary.category === venue.primary.category && v.neighborhood === venue.neighborhood,
  );
  if (peers.length < MIN_PEERS_FOR_BENCHMARK) {
    return { peerCount: peers.length, medianRating: null, venueRating: venue.rating };
  }
  const sorted = peers.map((v) => v.rating).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianRating = sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  return { peerCount: peers.length, medianRating, venueRating: venue.rating };
}

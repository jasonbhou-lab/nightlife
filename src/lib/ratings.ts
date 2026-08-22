import type { Review, SubRatingKey, Vertical } from '@/types';

/**
 * Aggregate rating computation (F-REVIEW-08) and the plain-language explanation
 * that has to be publishable alongside it.
 *
 * Weights: recency, reviewer trust, and detail. Reviews the recommendation
 * software filtered out are excluded entirely (F-REVIEW-07).
 */

const HALF_LIFE_DAYS = 240;

function ageDays(iso: string, now: Date): number {
  const then = new Date(`${iso}T12:00:00`).getTime();
  return Math.max(0, (now.getTime() - then) / 86_400_000);
}

function weightOf(r: Review, now: Date): number {
  const recency = Math.pow(0.5, ageDays(r.date, now) / HALF_LIFE_DAYS);
  const trust = 0.35 + r.authorTrust * 0.65;
  const detailChars = Math.min(r.text.length, 900) / 900;
  const structured = Object.keys(r.tags).length > 0 ? 0.1 : 0;
  const subs = Object.keys(r.subRatings).length > 0 ? 0.1 : 0;
  const photos = r.photoCount > 0 ? 0.05 : 0;
  const detail = 0.6 + detailChars * 0.4 + structured + subs + photos;
  return recency * trust * detail;
}

export type Aggregate = {
  rating: number;
  count: number;
  /** Reviews excluded by the recommendation software. */
  filtered: number;
  distribution: [number, number, number, number, number];
  subRatings: Partial<Record<SubRatingKey, number>>;
};

/**
 * Aggregate over a venue's reviews. Takes the review list rather than fetching
 * it, so the same function serves the bundled seed and the database.
 */
export function aggregateFor(all: Review[], now: Date): Aggregate {
  const recommended = all.filter((r) => r.recommended);
  const filtered = all.length - recommended.length;

  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let wSum = 0;
  let wTotal = 0;
  const subAcc: Partial<Record<SubRatingKey, { sum: number; w: number }>> = {};

  for (const r of recommended) {
    const w = weightOf(r, now);
    wSum += r.rating * w;
    wTotal += w;
    distribution[Math.min(4, Math.max(0, r.rating - 1))] += 1;
    for (const [k, v] of Object.entries(r.subRatings)) {
      if (typeof v !== 'number') continue;
      const key = k as SubRatingKey;
      const cur = subAcc[key] ?? { sum: 0, w: 0 };
      cur.sum += v * w;
      cur.w += w;
      subAcc[key] = cur;
    }
  }

  const subRatings: Partial<Record<SubRatingKey, number>> = {};
  for (const [k, v] of Object.entries(subAcc)) {
    if (v && v.w > 0) subRatings[k as SubRatingKey] = Math.round((v.sum / v.w) * 10) / 10;
  }

  return {
    rating: wTotal > 0 ? Math.round((wSum / wTotal) * 10) / 10 : 0,
    count: recommended.length,
    filtered,
    distribution,
    subRatings,
  };
}

/** Published verbatim to users, per F-REVIEW-08. */
export const RATING_EXPLANATION = [
  'The number is not a plain average.',
  'Recent visits count for more than old ones, because a bar in August is not the bar it was two years ago.',
  'Reviews from people with a long, clean contribution history count for more than brand-new accounts.',
  'Reviews that say something specific — sub-ratings, a party size, a wait time, photos — count for more than a line of praise.',
  'Reviews our software does not recommend are left out of the number entirely. You can still read them.',
].join(' ');

export const FILTERED_EXPLANATION =
  'These reviews are not counted in the rating and are hidden by default. Automated software flagged ' +
  'them on authenticity and quality signals. We do not publish the specific reason for any one review, ' +
  'because that would be a roadmap for working around it. Being filtered is not an accusation against ' +
  'the reviewer.';

/** PRD F-REVIEW-02 — sub-rating dimensions differ by category. */
export const subRatingDimensions: Record<Vertical, { key: SubRatingKey; label: string }[]> = {
  dining: [
    { key: 'food', label: 'Food' },
    { key: 'service', label: 'Service' },
    { key: 'ambiance', label: 'Ambiance' },
    { key: 'value', label: 'Value' },
  ],
  bar: [
    { key: 'drinkSelection', label: 'Drink selection' },
    { key: 'pourValue', label: 'Pour value' },
    { key: 'bartender', label: 'Bartender' },
    { key: 'atmosphere', label: 'Atmosphere' },
    { key: 'noise', label: 'Noise (5 = easy to talk)' },
  ],
  lounge: [
    { key: 'drinks', label: 'Drinks' },
    { key: 'atmosphere', label: 'Atmosphere' },
    { key: 'service', label: 'Service' },
    { key: 'comfort', label: 'Comfort' },
  ],
  cigar: [
    { key: 'selection', label: 'Selection' },
    { key: 'ventilation', label: 'Ventilation' },
    { key: 'comfort', label: 'Comfort' },
    { key: 'staffKnowledge', label: 'Staff knowledge' },
    { key: 'value', label: 'Value' },
  ],
  nightclub: [
    { key: 'music', label: 'Music' },
    { key: 'crowd', label: 'Crowd' },
    { key: 'service', label: 'Service' },
    { key: 'value', label: 'Value' },
    { key: 'door', label: 'Door experience' },
  ],
};

/** Structured tag vocabulary for the review composer (F-REVIEW-03). */
export const tagVocabulary = {
  occasion: ['Date night', 'Casual', 'Business dinner', 'Birthday', 'Anniversary', 'Game day', 'Late night', 'Happy hour', 'Live music', 'Regular visit'],
  timeOfVisit: ['Afternoon', '5 to 7 PM', '7 to 9 PM', '9 to 11 PM', '11 PM to 1 AM', 'After 1 AM'],
  waitMinutes: [0, 10, 20, 30, 45, 60],
  spendRange: ['Under $25', '$25 to $50', '$50 to $100', '$100 to $150', '$150 to $250', '$250 and up'],
};

import { formatAttribute } from '@/lib/format';
import type { Photo, Review, Venue } from '@/types';

/**
 * F-SEARCH-12: semantic vibe search, matching against review text and photo
 * classification. Same honesty as F-SEARCH-11's natural-language parser: this
 * is a deliberately modest keyword-and-signal scorer, not an embedding model.
 * It is also a ranking layer, not a hard filter — vibes are fuzzy by
 * definition, so a venue either has enough evidence to surface with a reason
 * attached, or it does not appear at all. There is no PRD-scale reason to
 * model more than a handful of named vibes; these four are the ones the PRD
 * names as examples.
 */

export type VibeKey = 'dressy' | 'date_night' | 'low_key' | 'bottle_service_crowd';

export type VibeDef = {
  key: VibeKey;
  label: string;
  /** Phrases in the user's own query that name this vibe. */
  triggers: RegExp;
  /** Phrases to look for in the venue's own recommended review text. */
  textSignals: string[];
  /** Structured review tags that count as evidence (F-REVIEW-03). */
  occasionTags?: string[];
  /** The typed attribute (PRD 3.3) that most literally *is* this vibe. */
  attributeMatch?: (v: Venue) => boolean;
  attributeEvidence?: (v: Venue) => string;
  /** Photo albums whose presence correlates with the vibe ("photo classification"). */
  albums?: Photo['album'][];
};

export const vibeDefs: VibeDef[] = [
  {
    key: 'dressy',
    label: 'Dressy',
    triggers: /dressy|dress code|dress up/,
    textSignals: ['dress code', 'dressy', 'dress up', 'no shorts', 'collared shirt'],
    attributeMatch: (v) => v.attributes.dressCode === 'dressy' || v.attributes.dressCode === 'upscale',
    attributeEvidence: (v) => `Dress code: ${formatAttribute('dressCode', v.attributes.dressCode)}`,
  },
  {
    key: 'date_night',
    label: 'Date night',
    triggers: /date night|romantic|anniversary/,
    textSignals: ['date night', 'romantic', 'anniversary'],
    occasionTags: ['Date night', 'Anniversary'],
    albums: ['table'],
  },
  {
    key: 'low_key',
    label: 'Low-key',
    triggers: /low-key|low key|chill\b|laid back|laid-back|relaxed/,
    textSignals: ['low-key', 'low key', 'chill', 'laid back', 'relaxed'],
    occasionTags: ['Casual'],
    attributeMatch: (v) => v.attributes.noiseLevel === 'quiet',
    attributeEvidence: () => 'Quiet noise level',
  },
  {
    key: 'bottle_service_crowd',
    label: 'Bottle service crowd',
    triggers: /bottle service|table minimum|vip crowd/,
    textSignals: ['bottle service', 'table minimum', 'vip crowd', 'bottle service crowd'],
    occasionTags: ['Birthday'],
    attributeMatch: (v) => v.attributes.bottleService === true,
    attributeEvidence: () => 'Bottle service',
    albums: ['crowd', 'table'],
  },
];

export function detectVibe(query: string): VibeDef | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return vibeDefs.find((v) => v.triggers.test(q)) ?? null;
}

export type VibeMatch = { score: number; evidence: string[] };

function scoreVenueForVibe(venue: Venue, reviews: Review[], vibe: VibeDef): VibeMatch {
  let score = 0;
  const evidence: string[] = [];

  if (vibe.attributeMatch?.(venue)) {
    score += 5;
    evidence.push(vibe.attributeEvidence?.(venue) ?? 'Matches the venue’s own attributes');
  }

  let textHits = 0;
  for (const r of reviews) {
    const body = r.text.toLowerCase();
    if (vibe.textSignals.some((s) => body.includes(s))) textHits += 1;
  }
  if (textHits > 0) {
    score += Math.min(textHits, 3) * 4;
    evidence.push(`${textHits} review${textHits === 1 ? '' : 's'} mention it`);
  }

  const tagHits = vibe.occasionTags
    ? reviews.filter((r) => r.tags.occasion && vibe.occasionTags!.includes(r.tags.occasion)).length
    : 0;
  if (tagHits > 0) {
    score += Math.min(tagHits, 3) * 3;
    evidence.push(`${tagHits} review${tagHits === 1 ? '' : 's'} tagged ${vibe.occasionTags!.join(' or ')}`);
  }

  const albumHits = vibe.albums ? venue.photos.filter((p) => vibe.albums!.includes(p.album)).length : 0;
  if (albumHits > 0) {
    score += Math.min(albumHits, 4);
    evidence.push(`${albumHits} photo${albumHits === 1 ? '' : 's'} in ${vibe.albums!.join('/')}`);
  }

  return { score, evidence };
}

/**
 * Rank a pool of venues by how well their reviews and photos support a vibe.
 * A venue with no evidence at all does not appear — this is a ranking of
 * evidence, not a filter with a default-true fallback.
 */
export function rankByVibe(
  venues: Venue[],
  reviewsByVenue: Record<string, Review[]>,
  vibe: VibeDef,
  limit = 20,
): { venue: Venue; match: VibeMatch }[] {
  return venues
    .map((venue) => ({ venue, match: scoreVenueForVibe(venue, reviewsByVenue[venue.id] ?? [], vibe) }))
    .filter((r) => r.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit);
}

import { attributeByKey } from '@/data/attributes';
import { isOpenAt, venueState } from '@/lib/hours';
import type { AttributeValue, FilterState, SortKey, Venue, Vertical } from '@/types';

/**
 * Search, filtering, ranking, and — the part that usually gets skipped — the
 * zero-result recovery that names the specific filter to drop (F-SEARCH-10).
 */

export const emptyFilters: FilterState = {
  verticals: [],
  categories: [],
  attributes: {},
  priceTiers: [],
  minRating: null,
  openNow: false,
  openAt: null,
  maxDistanceMi: null,
  query: '',
  sort: 'relevance',
};

export function activeFilterCount(f: FilterState): number {
  return (
    f.verticals.length +
    f.categories.length +
    Object.keys(f.attributes).length +
    f.priceTiers.length +
    (f.minRating != null ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.openAt ? 1 : 0) +
    (f.maxDistanceMi != null ? 1 : 0)
  );
}

/** Every vertical a venue carries, primary plus secondary. */
export function verticalsOf(v: Venue): Vertical[] {
  return Array.from(new Set([v.primary.vertical, ...v.secondary.map((s) => s.vertical)]));
}

export function categoriesOf(v: Venue): string[] {
  return [v.primary.category, ...v.secondary.map((s) => s.category)];
}

function textHaystack(v: Venue): string {
  const brands = Array.isArray(v.attributes.brands) ? (v.attributes.brands as string[]).join(' ') : '';
  const genres = Array.isArray(v.attributes.genres) ? (v.attributes.genres as string[]).join(' ') : '';
  const games = Array.isArray(v.attributes.games) ? (v.attributes.games as string[]).join(' ') : '';
  const dishes = v.menus.flatMap((m) => m.items.map((i) => i.name)).join(' ');
  return [
    v.name,
    ...(v.alternateNames ?? []),
    v.neighborhood,
    v.tagline,
    v.about,
    ...categoriesOf(v),
    brands,
    genres,
    games,
    dishes,
  ]
    .join(' ')
    .toLowerCase();
}

/** Does a single attribute filter pass? */
function attributeMatches(venue: Venue, key: string, wanted: AttributeValue): boolean {
  const def = attributeByKey[key];
  const actual = venue.attributes[key];

  // Price tier is a venue field rather than an attribute but reads as one in the sheet.
  if (key === 'priceTier') return venue.priceTier === wanted;

  if (wanted === true) {
    if (typeof actual === 'boolean') return actual;
    if (typeof actual === 'number') return actual > 0;
    if (Array.isArray(actual)) return actual.length > 0;
    return actual != null;
  }
  if (actual == null) return false;

  if (def?.filterAsMinimum && typeof wanted === 'number' && typeof actual === 'number') {
    return actual >= wanted;
  }
  if (def?.type === 'currency' && typeof wanted === 'number' && typeof actual === 'number') {
    // Currency filters read as a ceiling: "bottle minimum under $500".
    return actual <= wanted;
  }
  if (Array.isArray(wanted)) {
    const have = Array.isArray(actual) ? actual : [String(actual)];
    return wanted.every((x) => have.includes(x));
  }
  if (Array.isArray(actual)) return actual.includes(String(wanted));
  return actual === wanted;
}

type Predicate = { key: string; label: string; test: (v: Venue) => boolean };

/** Build one named predicate per active filter, so any single one can be dropped. */
export function buildPredicates(f: FilterState, now: Date): Predicate[] {
  const out: Predicate[] = [];

  if (f.query.trim()) {
    const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
    out.push({
      key: 'query',
      label: `“${f.query.trim()}”`,
      test: (v) => {
        const hay = textHaystack(v);
        return terms.every((t) => hay.includes(t));
      },
    });
  }

  if (f.verticals.length) {
    out.push({
      key: 'verticals',
      label: f.verticals.length === 1 ? `the ${f.verticals[0]} category` : 'the category selection',
      test: (v) => verticalsOf(v).some((x) => f.verticals.includes(x)),
    });
  }

  if (f.categories.length) {
    out.push({
      key: 'categories',
      label: f.categories.length === 1 ? `“${f.categories[0]}”` : 'the cuisine/atmosphere selection',
      test: (v) => categoriesOf(v).some((c) => f.categories.includes(c)),
    });
  }

  if (f.priceTiers.length) {
    out.push({
      key: 'priceTiers',
      label: `the price filter (${f.priceTiers.map((t) => '$'.repeat(t)).join(', ')})`,
      test: (v) => f.priceTiers.includes(v.priceTier),
    });
  }

  if (f.minRating != null) {
    const min = f.minRating;
    out.push({ key: 'minRating', label: `the ${min}+ star filter`, test: (v) => v.rating >= min });
  }

  if (f.openNow) {
    out.push({ key: 'openNow', label: '“open now”', test: (v) => venueState(v, now).open });
  }

  if (f.openAt) {
    const at = f.openAt;
    out.push({
      key: 'openAt',
      label: `“open at ${at}”`,
      test: (v) => isOpenAt(v, now.getDay(), at),
    });
  }

  if (f.maxDistanceMi != null) {
    const max = f.maxDistanceMi;
    out.push({ key: 'maxDistanceMi', label: `the ${max} mile radius`, test: (v) => v.distanceMi <= max });
  }

  for (const [key, wanted] of Object.entries(f.attributes)) {
    const def = attributeByKey[key];
    out.push({
      key: `attr:${key}`,
      label: def ? `“${def.label}”` : key,
      test: (v) => attributeMatches(v, key, wanted),
    });
  }

  return out;
}

function relevanceScore(v: Venue, f: FilterState, now: Date): number {
  let score = v.rating * 12 + Math.log10(v.reviewCount + 1) * 8;
  score -= v.distanceMi * 2.2;
  if (venueState(v, now).open) score += 14;
  if (v.claimed) score += 3;
  if (v.verified) score += 2;
  if (v.closure) score -= 60;
  if (v.consumerAlert) score -= 10;
  if (f.query.trim() && v.name.toLowerCase().includes(f.query.trim().toLowerCase())) score += 25;
  return score;
}

function comparator(sort: SortKey, f: FilterState, now: Date) {
  return (a: Venue, b: Venue): number => {
    switch (sort) {
      case 'rating':
        return b.rating - a.rating || b.reviewCount - a.reviewCount;
      case 'distance':
        return a.distanceMi - b.distanceMi;
      case 'reviewCount':
        return b.reviewCount - a.reviewCount;
      case 'price':
        return a.priceTier - b.priceTier || b.rating - a.rating;
      case 'availability': {
        // Soonest reservation availability, approximated by booking capability
        // and whether the venue is open right now.
        const rank = (v: Venue) =>
          (v.bookingModes.includes('reservation') || v.bookingModes.includes('table_service') ? 0 : 1) +
          (venueState(v, now).open ? 0 : 2);
        return rank(a) - rank(b) || b.rating - a.rating;
      }
      case 'relevance':
      default:
        return relevanceScore(b, f, now) - relevanceScore(a, f, now);
    }
  };
}

export type SearchResult = {
  results: Venue[];
  /** Paid placements, pinned above organic and always labeled (F-SEARCH-09). */
  promoted: Venue[];
  /**
   * Zero/low-result recovery. Each suggestion names one filter and how many
   * results dropping it would return, so the copy can be specific rather than
   * "try broadening your search".
   */
  relaxations: { key: string; label: string; wouldReturn: number }[];
  /** Adjacent categories that do have results.  */
  adjacentCategories: Vertical[];
};

/**
 * `pool` is required rather than defaulting to the bundled seed: the catalogue
 * can come from the database now, and a function that silently searches stale
 * bundled data when a caller forgets an argument is worse than one that will
 * not compile.
 */
export function searchVenues(f: FilterState, now: Date, pool: Venue[]): SearchResult {
  const predicates = buildPredicates(f, now);
  const passes = (v: Venue) => predicates.every((p) => p.test(v));

  // Closed-permanently listings stay reachable by name but never rank in a browse.
  const searchable = pool.filter((v) => !(v.closure?.state === 'permanent' && !f.query.trim()));

  const matched = searchable.filter(passes);
  const sorted = matched.slice().sort(comparator(f.sort, f, now));

  const promoted = sorted.filter((v) => v.promoted);
  const organic = sorted.filter((v) => !v.promoted);

  let relaxations: SearchResult['relaxations'] = [];
  let adjacentCategories: Vertical[] = [];

  if (sorted.length < 3 && predicates.length > 0) {
    relaxations = predicates
      .map((p) => {
        const rest = predicates.filter((x) => x.key !== p.key);
        const wouldReturn = searchable.filter((v) => rest.every((x) => x.test(v))).length;
        return { key: p.key, label: p.label, wouldReturn };
      })
      .filter((r) => r.wouldReturn > sorted.length)
      .sort((a, b) => b.wouldReturn - a.wouldReturn)
      .slice(0, 3);

    if (f.verticals.length) {
      const others = (['dining', 'bar', 'lounge', 'cigar', 'nightclub'] as Vertical[]).filter(
        (v) => !f.verticals.includes(v),
      );
      const rest = predicates.filter((p) => p.key !== 'verticals');
      adjacentCategories = others.filter((cat) =>
        searchable.some((v) => verticalsOf(v).includes(cat) && rest.every((p) => p.test(v))),
      );
    }
  }

  return { results: [...promoted, ...organic], promoted, relaxations, adjacentCategories };
}

/* ------------------------------------------------------------- typeahead */

export type Suggestion = {
  kind: 'venue' | 'category' | 'dish' | 'brand';
  label: string;
  detail?: string;
  venueId?: string;
  vertical?: Vertical;
};

/**
 * F-SEARCH-02: venues, categories, dishes, and cigar brands come back as
 * distinct result groups rather than one undifferentiated list.
 */
export function suggest(query: string, pool: Venue[], limitPerGroup = 4): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: Suggestion[] = [];

  for (const v of pool) {
    if (v.name.toLowerCase().includes(q) || (v.alternateNames ?? []).some((a) => a.toLowerCase().includes(q))) {
      out.push({ kind: 'venue', label: v.name, detail: `${v.primary.category} · ${v.neighborhood}`, venueId: v.id });
    }
  }

  const cats = new Set<string>();
  for (const v of pool) {
    for (const c of categoriesOf(v)) {
      if (c.toLowerCase().includes(q) && !cats.has(c)) {
        cats.add(c);
        out.push({ kind: 'category', label: c, detail: 'Category', vertical: v.primary.vertical });
      }
    }
  }

  const dishes = new Set<string>();
  for (const v of pool) {
    for (const section of v.menus) {
      for (const item of section.items) {
        if (item.name.toLowerCase().includes(q) && !dishes.has(item.name)) {
          dishes.add(item.name);
          out.push({ kind: 'dish', label: item.name, detail: `at ${v.name}`, venueId: v.id });
        }
      }
    }
  }

  const brandDef = attributeByKey.brands;
  for (const opt of brandDef?.options ?? []) {
    if (opt.label.toLowerCase().includes(q)) {
      const carriers = pool.filter(
        (v) => Array.isArray(v.attributes.brands) && (v.attributes.brands as string[]).includes(opt.value),
      );
      if (carriers.length) {
        out.push({
          kind: 'brand',
          label: opt.label,
          detail: `Cigar brand · ${carriers.length} lounge${carriers.length === 1 ? '' : 's'}`,
        });
      }
    }
  }

  const grouped: Suggestion[] = [];
  for (const kind of ['venue', 'category', 'dish', 'brand'] as const) {
    grouped.push(...out.filter((s) => s.kind === kind).slice(0, limitPerGroup));
  }
  return grouped;
}

/**
 * F-SEARCH-11: compound natural-language intent. This is a deliberately modest
 * keyword-and-pattern parser, not a language model — it maps recognizable
 * phrases onto the same typed filters the sheet produces, and reports what it
 * understood so the user can see and correct it.
 */
export function parseNaturalQuery(text: string): { filters: Partial<FilterState>; understood: string[] } {
  const q = text.toLowerCase();
  const understood: string[] = [];
  const filters: Partial<FilterState> = {};
  const attributes: Record<string, AttributeValue> = {};
  const verticals: Vertical[] = [];

  const vocab: [RegExp, () => void][] = [
    [/cigar|humidor|tobacconist/, () => { verticals.push('cigar'); understood.push('cigar lounges'); }],
    [/nightclub|club|dance floor|dj/, () => { verticals.push('nightclub'); understood.push('nightclubs'); }],
    // "cigar lounge" already resolved to the cigar vertical above; adding the
    // lounge vertical again would double the readback and widen the search.
    [/lounge|hookah|speakeasy|rooftop/, () => {
      if (/cigar\s+lounge/.test(q)) return;
      verticals.push('lounge');
      understood.push('lounges');
    }],
    [/\bbar\b|taproom|brewery|pub|dive/, () => { verticals.push('bar'); understood.push('bars'); }],
    [/restaurant|dinner|eat|food|brunch/, () => { verticals.push('dining'); understood.push('restaurants'); }],
    [/walk-?in humidor/, () => { attributes.humidorType = 'walk_in'; understood.push('walk-in humidor'); }],
    [/locker/, () => { attributes.lockerProgram = 'available'; understood.push('lockers available'); }],
    [/quiet|conversation|hear/, () => { attributes.noiseLevel = 'quiet'; understood.push('quiet'); }],
    [/loud/, () => { attributes.noiseLevel = 'loud'; understood.push('loud'); }],
    [/dog/, () => { attributes.dogFriendly = 'patio'; understood.push('dog friendly'); }],
    [/patio|outdoor|outside/, () => { attributes.outdoorSeating = true; understood.push('outdoor seating'); }],
    [/happy hour/, () => { attributes.happyHour = true; understood.push('happy hour'); }],
    [/sports|game|match|football|nfl/, () => { attributes.sportsViewing = true; understood.push('shows games'); }],
    [/pool table|billiards/, () => { attributes.games = ['pool']; understood.push('pool tables'); }],
    [/no cover|without a cover/, () => { attributes.coverCharge = 0; understood.push('no cover'); }],
    [/bottle service/, () => { attributes.bottleService = true; understood.push('bottle service'); }],
    [/vegan|vegetarian/, () => { attributes.dietary = ['vegetarian']; understood.push('vegetarian options'); }],
    [/reservation|reserve|book a table/, () => { attributes.acceptsReservations = true; understood.push('takes reservations'); }],
    [/on tap|beer selection|craft beer/, () => { attributes.tapCount = 12; understood.push('12+ taps'); }],
  ];

  for (const [re, apply] of vocab) if (re.test(q)) apply();

  if (/(past|after|until) ?midnight|late night|after 1 ?am|after 2 ?am/.test(q)) {
    filters.openAt = '00:30';
    understood.push('open past midnight');
  } else if (/open now|right now|tonight/.test(q)) {
    filters.openNow = true;
    understood.push('open now');
  }

  if (/near me|nearby|close by|walking distance/.test(q)) {
    filters.maxDistanceMi = /walking/.test(q) ? 1 : 3;
    understood.push(`within ${filters.maxDistanceMi} mi`);
  }

  if (/cheap|inexpensive|budget/.test(q)) { filters.priceTiers = [1, 2]; understood.push('$ to $$'); }
  if (/upscale|fancy|nice|splurge/.test(q)) { filters.priceTiers = [3, 4]; understood.push('$$$ to $$$$'); }

  if (verticals.length) filters.verticals = Array.from(new Set(verticals));
  if (Object.keys(attributes).length) filters.attributes = attributes;
  return { filters, understood };
}

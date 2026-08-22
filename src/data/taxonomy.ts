import type { Vertical } from '@/types';

export const VERTICALS: Vertical[] = ['dining', 'bar', 'lounge', 'cigar', 'nightclub'];

export const verticalMeta: Record<
  Vertical,
  { label: string; plural: string; icon: string; blurb: string }
> = {
  dining: {
    label: 'Restaurant',
    plural: 'Restaurants',
    icon: 'restaurant',
    blurb: 'Dining rooms, late-night kitchens, supper clubs',
  },
  bar: {
    label: 'Bar',
    plural: 'Bars',
    icon: 'beer',
    blurb: 'Throughput-oriented: order at the bar, bar and high-top seating',
  },
  lounge: {
    label: 'Lounge',
    plural: 'Lounges',
    icon: 'wine',
    blurb: 'Dwell-oriented: table seating, table service, atmosphere is the product',
  },
  cigar: {
    label: 'Cigar Lounge',
    plural: 'Cigar Lounges',
    icon: 'flame',
    blurb: 'Humidors, lockers, memberships, ventilation',
  },
  nightclub: {
    label: 'Nightclub',
    plural: 'Nightclubs',
    icon: 'musical-notes',
    blurb: 'Cover, lineup, table service, door policy',
  },
};

/**
 * Subcategories, abridged from PRD 3.1. The full restaurant cuisine list runs
 * to ~120 values; the demo seed carries a representative slice.
 */
export const categories: Record<Vertical, string[]> = {
  dining: [
    'Steakhouse', 'Gulf Seafood', 'Tex-Mex', 'Vietnamese', 'Italian',
    'Barbecue', 'Fine Dining', 'Casual', 'Fast Casual', 'Food Hall Stall',
    'Supper Club', 'Late-Night Dining', 'Raw Bar', 'Brunch', 'Sushi',
  ],
  bar: [
    'Neighborhood Bar', 'Dive Bar', 'Sports Bar', 'Gastropub', 'Irish Pub',
    'Brewery Taproom', 'Brewpub', 'Beer Garden', 'Beer Hall', 'Cider House',
    'Distillery Tasting Room', 'Winery Tasting Room', 'Wine Bar',
    'Whiskey Bar', 'Tiki Bar', 'Cocktail Bar', 'Hotel Bar', 'Airport Bar',
    'Pool Hall Bar', 'Barcade', 'Bowling Bar', 'Dart Bar', 'Karaoke Bar',
    'Jazz or Blues Bar', 'Live Music Bar', 'Country and Western Bar',
    'LGBTQ+ Bar', 'Biker Bar', 'College Bar', 'Pool Bar', 'Activity Bar',
  ],
  lounge: [
    'Cocktail Lounge', 'Wine Lounge', 'Hookah Lounge', 'Hotel Lounge',
    'Speakeasy', 'Piano Lounge', 'Rooftop Lounge', 'Sports Lounge',
    'Karaoke Lounge',
  ],
  cigar: [
    'Cigar Lounge', 'Cigar Bar', 'Tobacconist with Lounge',
    'Private Cigar Club', 'Outdoor Cigar Patio',
  ],
  nightclub: [
    'Nightclub', 'Dance Club', 'Live Music Venue with Dancing', 'EDM Club',
    'Hip-Hop Club', 'Latin Club', 'LGBTQ+ Club', 'Day Club and Pool Party',
    'After-Hours Club',
  ],
};

/**
 * PRD Open Question 8 — the Bar/Lounge boundary. The taxonomy permits dual
 * assignment, so ranking and the Tonight module stack need a tiebreak. The
 * rule implemented here: the primary category wins for filtering, and the
 * Tonight stack uses dwell orientation, so a venue carrying both surfaces in
 * the Bar module before 11 PM and the Lounge module after.
 */
export const BAR_LOUNGE_TIEBREAK =
  'Venues carrying both Bar and Lounge are filtered on their primary category. ' +
  'In Tonight, they surface as a Bar before 11 PM and as a Lounge after, since ' +
  'dwell rises later in the night.';

import type { CheckIn, CommunityMember } from '@/types';

/**
 * The followable roster for F-SOCIAL-02.
 *
 * Each entry is a real seeded reviewer (see `src/data/reviews.ts`), not an
 * invented profile: `trust` and `elite` are copied from that person's actual
 * review rather than made up, so the roster and the review corpus cannot
 * drift apart. All eight are Elite or near-Elite contributors on purpose —
 * they are exactly the people a "follow" feature is for.
 */
export const communityMembers: CommunityMember[] = [
  {
    id: 'cm-dana',
    name: 'Dana R.',
    tagline: 'Steakhouses and quiet lounges',
    homeNeighborhood: 'Downtown',
    joinedYear: 2023,
    trust: 0.94,
    elite: true,
  },
  {
    id: 'cm-kevin',
    name: 'Kevin O.',
    tagline: 'Tap lists and cask ale',
    homeNeighborhood: 'The Heights',
    joinedYear: 2022,
    trust: 0.91,
    elite: true,
  },
  {
    id: 'cm-iris',
    name: 'Iris K.',
    tagline: 'Cocktail bars where you can still talk',
    homeNeighborhood: 'Montrose',
    joinedYear: 2021,
    trust: 0.92,
    elite: true,
  },
  {
    id: 'cm-curtis',
    name: 'Curtis M.',
    tagline: 'Humidors and ventilation, mostly ventilation',
    homeNeighborhood: 'River Oaks',
    joinedYear: 2020,
    trust: 0.93,
    elite: true,
  },
  {
    id: 'cm-adele',
    name: 'Adele F.',
    tagline: 'Anniversaries and rooms you can hear in',
    homeNeighborhood: 'Rice Village',
    joinedYear: 2022,
    trust: 0.89,
    elite: true,
  },
  {
    id: 'cm-jas',
    name: 'Jas P.',
    tagline: 'Door times and table minimums',
    homeNeighborhood: 'Midtown',
    joinedYear: 2024,
    trust: 0.78,
    elite: false,
  },
  {
    id: 'cm-marisol',
    name: 'Marisol A.',
    tagline: 'Brewery tours on a Saturday',
    homeNeighborhood: 'EaDo',
    joinedYear: 2023,
    trust: 0.86,
    elite: true,
  },
  {
    id: 'cm-tony',
    name: 'Tony V.',
    tagline: 'Game day, every day',
    homeNeighborhood: 'Upper Kirby',
    joinedYear: 2021,
    trust: 0.83,
    elite: true,
  },
];

export const communityById: Record<string, CommunityMember> = Object.fromEntries(
  communityMembers.map((m) => [m.id, m]),
);

export const communityByName: Record<string, CommunityMember> = Object.fromEntries(
  communityMembers.map((m) => [m.name, m]),
);

/**
 * Seeded activity beyond their reviews, so the activity feed has real
 * content as soon as you follow someone, not an empty screen.
 *
 * One row is `visibility: 'private'` on purpose (F-SOCIAL-05's non-broadcast
 * default) — not because a private check-in needs to exist for its own sake,
 * but so the feed-building code has something to prove it actually filters
 * on visibility rather than having nothing to filter.
 */
export const communityCheckIns: CheckIn[] = [
  { id: 'ci-1', memberId: 'cm-dana', venueId: 'quietpart', date: '2026-08-19', visibility: 'friends', note: 'Back for the piano set.' },
  { id: 'ci-2', memberId: 'cm-kevin', venueId: 'cistern', date: '2026-08-18', visibility: 'friends', note: 'The 2 PM tour again, worth it every time.' },
  { id: 'ci-3', memberId: 'cm-iris', venueId: 'bramble', date: '2026-08-17', visibility: 'friends' },
  { id: 'ci-4', memberId: 'cm-curtis', venueId: 'bayouleaf', date: '2026-08-16', visibility: 'private', note: 'Scouting a locker for a friend.' },
  { id: 'ci-5', memberId: 'cm-jas', venueId: 'verso', date: '2026-08-15', visibility: 'friends' },
  { id: 'ci-6', memberId: 'cm-marisol', venueId: 'loyalpour', date: '2026-08-14', visibility: 'friends', note: 'Trivia night. We lost.' },
  { id: 'ci-7', memberId: 'cm-tony', venueId: 'pocketaces', date: '2026-08-13', visibility: 'friends' },
  { id: 'ci-8', memberId: 'cm-adele', venueId: 'vela', date: '2026-08-12', visibility: 'friends', note: 'Raw bar again. No regrets.' },
  { id: 'ci-9', memberId: 'cm-dana', venueId: 'bramble', date: '2026-08-05', visibility: 'friends' },
  { id: 'ci-10', memberId: 'cm-kevin', venueId: 'kirby3', date: '2026-08-02', visibility: 'friends', note: 'Watching the Astros with the sound on, for once.' },
];

import type { VenueEvent } from '@/types';

/**
 * Events (F-EVENT). Recurring weekly programming is the dominant event type at
 * bars, so it is modelled as a first-class `weekday` rather than a stack of
 * one-off dates (F-EVENT-05). One-offs carry a `date`.
 */

export const events: VenueEvent[] = [
  /* recurring weekly programming */
  { id: 'ev-1', venueId: 'loyalpour', title: 'Trivia Night', weekday: 2, start: '19:30', end: '21:30', description: 'Six rounds, teams up to six, bar tab prizes. Arrive by 7 for a table.', recurring: true, cover: 0, agePolicy: '21+', genre: 'Trivia' },
  { id: 'ev-2', venueId: 'loyalpour', title: 'Tap Takeover', weekday: 4, start: '17:00', end: '23:00', description: 'A visiting brewery takes eight lines. Rotates weekly.', recurring: true, cover: 0, agePolicy: '21+' },
  { id: 'ev-3', venueId: 'cistern', title: 'Brewery Tour and Tasting', weekday: 6, start: '14:00', end: '15:00', description: 'Forty-five minutes through production, four tasting pours. Books out most weeks.', recurring: true, cover: 15, agePolicy: '21+' },
  { id: 'ev-4', venueId: 'cistern', title: 'Run Club', weekday: 3, start: '18:30', end: '20:00', description: 'Three miles from the taproom door, first pint discounted after.', recurring: true, cover: 0 },
  { id: 'ev-5', venueId: 'kirby3', title: 'Sunday Ticket, All Games', weekday: 0, start: '12:00', end: '19:00', description: 'Every game on, sound on the Texans. Booth holds open two weeks out.', recurring: true, cover: 0, agePolicy: '21+ after 9 PM' },
  { id: 'ev-6', venueId: 'pocketaces', title: 'Karaoke, Upstairs', weekday: 3, start: '21:00', end: '01:00', description: 'No sign-up fee, two-song limit when it is busy.', recurring: true, cover: 0, agePolicy: '21+' },
  { id: 'ev-7', venueId: 'bramble', title: 'Industry Night', weekday: 1, start: '17:00', end: '00:00', description: 'Service industry gets 25 percent off with a paystub or a badge.', recurring: true, cover: 0, agePolicy: '21+' },
  { id: 'ev-8', venueId: 'quietpart', title: 'Piano, Live', weekday: 4, start: '20:00', end: '23:30', description: 'Standards and a little Monk. Unamplified. No cover, reservation required.', recurring: true, cover: 0, genre: 'Jazz', agePolicy: '21+' },
  { id: 'ev-9', venueId: 'salaroja', title: 'Salsa en Vivo', weekday: 4, start: '21:00', end: '23:00', description: 'Ten-piece band, then DJs until close. Free before 10 PM.', recurring: true, cover: 0, genre: 'Latin', agePolicy: '18+ with wristbands', lineup: ['Orquesta Roja'] },
  { id: 'ev-10', venueId: 'zafeera', title: 'Afrobeats Saturdays', weekday: 6, start: '23:00', end: '03:00', description: 'Resident rotation, no cover before 11 PM.', recurring: true, cover: 15, genre: 'Afrobeats', agePolicy: '21+' },
  { id: 'ev-11', venueId: 'verso', title: 'Rooftop House Sessions', weekday: 5, start: '22:00', end: '02:00', description: 'The floor clears at 10 and the DJ takes over. Dress code enforced after 9.', recurring: true, cover: 20, genre: 'House', agePolicy: '21+' },
  { id: 'ev-12', venueId: 'ashenoak', title: 'Brand Night', weekday: 4, start: '18:00', end: '22:00', description: 'Third Thursday of the month: brand rep on site, event pricing on the featured line.', recurring: true, cover: 0, agePolicy: '21+' },

  /* one-offs */
  { id: 'ev-20', venueId: 'kosmos', title: 'ODESZA b2b Lane 8', date: '2026-08-29', start: '22:00', end: '04:00', description: 'Touring headliner, doors at 10, set at 12:30. Table minimums raised for this date.', recurring: false, cover: 60, genre: 'Electronic', agePolicy: '21+', lineup: ['Ovra', 'ODESZA', 'Lane 8'], ticketUrl: 'https://tickets.example/kosmos-0829' },
  { id: 'ev-21', venueId: 'kosmos', title: 'Sable Kid, Resident Set', date: '2026-08-23', start: '22:00', end: '04:00', description: 'Resident night, guest list until 11.', recurring: false, cover: 25, genre: 'House', agePolicy: '21+', lineup: ['Sable Kid', 'Marius V'] },
  { id: 'ev-22', venueId: 'ashenoak', title: 'Roller on Site: Padrón', date: '2026-09-05', start: '17:00', end: '22:00', description: 'Live rolling, limited house-blend release, whiskey pairing flight at a set price.', recurring: false, cover: 0, agePolicy: '21+' },
  { id: 'ev-23', venueId: 'emberroom', title: 'Members Herf', date: '2026-08-28', start: '19:00', end: '01:00', description: 'Last Friday of the month. Members plus three guests.', recurring: false, cover: 0, agePolicy: '21+' },
  { id: 'ev-24', venueId: 'vela', title: "Winemaker's Dinner", date: '2026-09-11', start: '18:30', end: '21:30', description: 'Five courses, five pours, one long table. Prepaid, non-refundable inside a week.', recurring: false, cover: 165, agePolicy: '21+' },
  { id: 'ev-25', venueId: 'pier9', title: 'Gulf Oyster Fest', date: '2026-09-06', start: '12:00', end: '20:00', description: 'Patio takeover, shucking contest, dollar oysters until they run out.', recurring: false, cover: 0 },
  { id: 'ev-26', venueId: 'salaroja', title: 'Reggaetón Clásico', date: '2026-08-30', start: '22:00', end: '03:00', description: 'Throwback set, 18+ with wristbands.', recurring: false, cover: 20, genre: 'Reggaetón', agePolicy: '18+' },
  { id: 'ev-27', venueId: 'tortilla9', title: 'Mariachi Brunch', weekday: 0, start: '11:00', end: '14:00', description: 'Live mariachi on the patio every Sunday. No reservations, join the waitlist.', recurring: true, cover: 0 },
];

export function eventsForVenue(venueId: string): VenueEvent[] {
  return events.filter((e) => e.venueId === venueId);
}

/** Events landing on a given date, folding weekly programming into the day. */
export function eventsOnDate(date: Date): VenueEvent[] {
  const iso = date.toISOString().slice(0, 10);
  const dow = date.getDay();
  return events.filter((e) => (e.recurring ? e.weekday === dow : e.date === iso));
}

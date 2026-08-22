import type { Review } from '@/types';

/**
 * Seed review corpus.
 *
 * Two things here are load-bearing rather than decorative:
 *  - `recommended: false` on a few reviews, so the profile has to implement
 *    F-REVIEW-07 (filtered out of the aggregate and the default view, reachable
 *    behind a disclosed link, with no detailed rationale exposed).
 *  - `comped: true` on one, so the disclosure badge from F-REVIEW-12 has
 *    something to render.
 */

const r = (v: Partial<Review> & Pick<Review, 'id' | 'venueId' | 'author' | 'rating' | 'text' | 'date'>): Review => ({
  authorTrust: 0.6,
  elite: false,
  subRatings: {},
  edited: false,
  helpful: 0,
  insightful: 0,
  funny: 0,
  tags: {},
  photoCount: 0,
  recommended: true,
  ...v,
});

export const reviews: Review[] = [
  /* ------------------------------------------------------------- vela */
  r({
    id: 'rv-1', venueId: 'vela', author: 'Dana R.', authorTrust: 0.94, elite: true,
    rating: 5, date: '2026-08-14',
    subRatings: { food: 5, service: 5, ambiance: 5, value: 4 },
    text:
      'Sat at the raw bar instead of a table and it was the right call. The 45-day ribeye is worth ' +
      'the number on the menu. Worth knowing: the kitchen stops at 9:30 on a Tuesday but the bar ' +
      'keeps going, so a late arrival still eats, just off the snack list.',
    tags: { occasion: 'Date night', partySize: 2, timeOfVisit: '8:00 PM', waitMinutes: 0, spendRange: '$150 to $250' },
    helpful: 41, insightful: 12, funny: 1, photoCount: 3,
    ownerResponse: { text: 'Thank you Dana. The raw bar is the best seat in the room and we will not argue.', date: '2026-08-15' },
  }),
  r({
    id: 'rv-2', venueId: 'vela', author: 'Marcus L.', authorTrust: 0.71,
    rating: 4, date: '2026-07-30',
    subRatings: { food: 5, service: 3, ambiance: 5, value: 3 },
    text:
      'Food is excellent. Service got thin once the room filled at 8. We waited 15 minutes for a ' +
      'second drink with a nearly empty glass in front of us. Still going back.',
    tags: { occasion: 'Business dinner', partySize: 4, timeOfVisit: '8:30 PM', spendRange: '$250 and up' },
    helpful: 18, insightful: 6, funny: 0,
  }),
  r({
    id: 'rv-3', venueId: 'vela', author: 'A. Nonymous', authorTrust: 0.11,
    rating: 5, date: '2026-08-18',
    text: 'BEST STEAK IN HOUSTON!!! Ask for Tony he is the best!!! Five stars all day!!!',
    recommended: false, helpful: 0,
  }),

  /* ----------------------------------------------------------- anhbep */
  r({
    id: 'rv-4', venueId: 'anhbep', author: 'Thuy N.', authorTrust: 0.88, elite: true,
    rating: 5, date: '2026-08-10',
    subRatings: { food: 5, service: 4, ambiance: 4, value: 5 },
    text:
      'The 1 AM bowl after a shift is the whole reason this place matters. Broth is clean, not ' +
      'over-salted the way late-night kitchens usually go. Cash is faster than card here at that hour.',
    tags: { occasion: 'Late night', partySize: 1, timeOfVisit: '1:00 AM', waitMinutes: 5, spendRange: 'Under $25' },
    helpful: 63, insightful: 21, funny: 4, photoCount: 2,
  }),
  r({
    id: 'rv-5', venueId: 'anhbep', author: 'Greg P.', authorTrust: 0.65,
    rating: 4, date: '2026-07-19',
    subRatings: { food: 5, service: 3, ambiance: 3, value: 5 },
    text: 'Great food, tight room, expect to share a table when it is busy. The vegan phở is real, not just the beef bowl minus beef.',
    tags: { partySize: 3, timeOfVisit: '7:30 PM', waitMinutes: 20 },
    helpful: 22, insightful: 9,
  }),

  /* ------------------------------------------------------------ pier9 */
  r({
    id: 'rv-6', venueId: 'pier9', author: 'Renee C.', authorTrust: 0.79,
    rating: 4, date: '2026-08-06',
    subRatings: { food: 4, service: 4, ambiance: 5, value: 4 },
    text:
      'Happy hour oysters at a dollar fifty are the deal in Montrose. Patio is the move. ' +
      'It gets genuinely loud inside after 7, so if you need to hear anyone, sit outside.',
    tags: { occasion: 'Happy hour', partySize: 4, timeOfVisit: '5:30 PM', spendRange: '$50 to $100' },
    helpful: 34, insightful: 11, photoCount: 2,
  }),
  r({
    id: 'rv-7', venueId: 'pier9', author: 'Bill T.', authorTrust: 0.55,
    rating: 3, date: '2026-06-28',
    subRatings: { food: 3, service: 2, ambiance: 4, value: 3 },
    text: 'Reverse happy hour listed at 9 was not running when we came in at 9:15. Staff said it ended last month. Fish was fine.',
    tags: { partySize: 2, timeOfVisit: '9:15 PM' },
    helpful: 47, insightful: 19,
    ownerResponse: { text: 'You are right and the listing was stale. Reverse happy hour runs Tuesday through Thursday only now, and we have corrected it here.', date: '2026-06-30' },
  }),

  /* -------------------------------------------------------- tortilla9 */
  r({
    id: 'rv-8', venueId: 'tortilla9', author: 'Sam K.', authorTrust: 0.62,
    rating: 4, date: '2026-08-02',
    subRatings: { food: 4, service: 4, ambiance: 5, value: 4 },
    text: 'Brunch on the patio with a dog under the table is exactly what I want on a Saturday. Wait was 45 minutes, joined the list from the car.',
    tags: { occasion: 'Brunch', partySize: 4, timeOfVisit: '11:30 AM', waitMinutes: 45 },
    helpful: 29, insightful: 5, photoCount: 1,
  }),
  r({
    id: 'rv-9', venueId: 'tortilla9', author: 'Priya M.', authorTrust: 0.58,
    rating: 2, date: '2026-07-11',
    subRatings: { food: 2, service: 2, ambiance: 4, value: 3 },
    text: 'Queso was cold and it took 25 minutes to get anyone to the table on a half-empty Tuesday. The patio is great, the service was not.',
    tags: { partySize: 2, timeOfVisit: '7:00 PM' },
    helpful: 16,
  }),

  /* -------------------------------------------------------- loyalpour */
  r({
    id: 'rv-10', venueId: 'loyalpour', author: 'Kevin O.', authorTrust: 0.91, elite: true,
    rating: 5, date: '2026-08-16',
    subRatings: { drinkSelection: 5, pourValue: 4, bartender: 5, atmosphere: 5, noise: 4 },
    text:
      'The tap list on this app matched what was actually pouring, which almost never happens. ' +
      '42 lines with real rotation, a cask engine that they actually use, and a bartender who ' +
      'will tell you when the thing you ordered is not the thing you want. Kitchen closes at 10 ' +
      'on weeknights, plan around it.',
    tags: { occasion: 'Casual', partySize: 2, timeOfVisit: '7:00 PM', spendRange: '$50 to $100' },
    helpful: 88, insightful: 34, funny: 2, photoCount: 4,
    ownerResponse: { text: 'The tap list is fed straight from our system, so it should always match. Thanks Kevin.', date: '2026-08-17' },
  }),
  r({
    id: 'rv-11', venueId: 'loyalpour', author: 'Hannah B.', authorTrust: 0.74,
    rating: 4, date: '2026-07-25',
    subRatings: { drinkSelection: 5, pourValue: 4, bartender: 4, atmosphere: 4, noise: 3 },
    text: 'Trivia Tuesday is packed and loud, which is fine, but do not come then expecting a conversation. Shuffleboard has a waitlist on a clipboard.',
    tags: { occasion: 'Trivia', partySize: 6, timeOfVisit: '8:00 PM', waitMinutes: 15 },
    helpful: 31, insightful: 14,
  }),
  r({
    id: 'rv-12', venueId: 'loyalpour', author: 'Drew F.', authorTrust: 0.68,
    rating: 5, date: '2026-06-14',
    subRatings: { drinkSelection: 5, pourValue: 5, bartender: 5, atmosphere: 4, noise: 4 },
    text: 'Hosted for a brand night and they comped the flight, noting that here. The cask bitter is the best pint in the city right now.',
    tags: { partySize: 2, timeOfVisit: '6:00 PM' },
    comped: true, helpful: 12, insightful: 8,
  }),

  /* ----------------------------------------------------------- kirby3 */
  r({
    id: 'rv-13', venueId: 'kirby3', author: 'Tony V.', authorTrust: 0.83, elite: true,
    rating: 4, date: '2026-08-11',
    subRatings: { drinkSelection: 4, pourValue: 4, bartender: 4, atmosphere: 5, noise: 2 },
    text:
      'Reserved a booth for the Aggies game two weeks out and it was actually held. Sound was on ' +
      'for Astros on the main wall. It is deafening, which is the point, but do not bring anyone ' +
      'who wants to talk. Twenty-five dollar per person minimum goes on your tab, not on top of it.',
    tags: { occasion: 'Game day', partySize: 8, timeOfVisit: '3:00 PM', spendRange: '$50 to $100' },
    helpful: 57, insightful: 22, photoCount: 2,
  }),
  r({
    id: 'rv-14', venueId: 'kirby3', author: 'Lauren S.', authorTrust: 0.6,
    rating: 3, date: '2026-07-20',
    subRatings: { drinkSelection: 3, pourValue: 4, bartender: 3, atmosphere: 4, noise: 1 },
    text: 'Standing room by 8 on a Saturday even with no big game on. Wells are cheap. Bathroom line is long.',
    tags: { partySize: 4, timeOfVisit: '8:30 PM' },
    helpful: 19,
  }),
  r({
    id: 'rv-15', venueId: 'kirby3', author: 'FanZone Promo', authorTrust: 0.08,
    rating: 5, date: '2026-08-19',
    text: 'The BEST sports bar experience — 28 screens!! Book your game day table now!! Link in bio!!',
    recommended: false, helpful: 0,
  }),

  /* ---------------------------------------------------------- ratchet */
  r({
    id: 'rv-16', venueId: 'ratchet', author: 'Jo D.', authorTrust: 0.77,
    rating: 5, date: '2026-08-04',
    subRatings: { drinkSelection: 3, pourValue: 5, bartender: 5, atmosphere: 5, noise: 4 },
    text:
      'Cash only, the ATM eats five dollars, the pool tables are level, and the pour is a real pour. ' +
      'Do not come here for a cocktail. Come here for a tallboy and a game of nine ball.',
    tags: { partySize: 2, timeOfVisit: '10:00 PM', spendRange: 'Under $25' },
    helpful: 44, insightful: 17, funny: 9,
  }),
  r({
    id: 'rv-17', venueId: 'ratchet', author: 'Elena G.', authorTrust: 0.52,
    rating: 3, date: '2026-06-21',
    subRatings: { drinkSelection: 2, pourValue: 5, bartender: 4, atmosphere: 4, noise: 3 },
    text: 'No card, no food, no wifi, no step-free entry. Know what you are walking into and it is great. Bring cash.',
    tags: { partySize: 3, timeOfVisit: '11:00 PM' },
    helpful: 27, insightful: 15,
  }),

  /* ---------------------------------------------------------- cistern */
  r({
    id: 'rv-18', venueId: 'cistern', author: 'Marisol A.', authorTrust: 0.86, elite: true,
    rating: 5, date: '2026-08-15',
    subRatings: { drinkSelection: 5, pourValue: 5, bartender: 5, atmosphere: 5, noise: 4 },
    text:
      'Booked the 2 PM Saturday tour and it was worth it. The barrel batch is taproom-only and ' +
      'it sells out by early evening. Dogs inside, communal tables, a food truck that changes weekly. ' +
      'Closed Monday and Tuesday, which catches people out.',
    tags: { occasion: 'Brewery tour', partySize: 4, timeOfVisit: '2:00 PM', spendRange: '$25 to $50' },
    helpful: 52, insightful: 20, photoCount: 3,
  }),
  r({
    id: 'rv-19', venueId: 'cistern', author: 'Ray H.', authorTrust: 0.64,
    rating: 4, date: '2026-07-08',
    subRatings: { drinkSelection: 5, pourValue: 4, bartender: 4, atmosphere: 4, noise: 3 },
    text: 'Kölsch is the one. Garden is gravel, so heels are a bad idea. No kitchen of their own, so if the truck leaves you are out of luck.',
    tags: { partySize: 2, timeOfVisit: '6:00 PM' },
    helpful: 23, insightful: 8,
  }),

  /* ------------------------------------------------------ pocketaces */
  r({
    id: 'rv-20', venueId: 'pocketaces', author: 'Nate W.', authorTrust: 0.7,
    rating: 4, date: '2026-08-09',
    subRatings: { drinkSelection: 4, pourValue: 4, bartender: 4, atmosphere: 5, noise: 1 },
    text: 'Free play is genuinely free play. After 10 it is shoulder to shoulder and you will not hear your friends. Kitchen quits at 11, get the tots before then.',
    tags: { partySize: 5, timeOfVisit: '10:30 PM', spendRange: '$25 to $50' },
    helpful: 38, insightful: 13, funny: 3,
  }),

  /* --------------------------------------------------------- bramble */
  r({
    id: 'rv-21', venueId: 'bramble', author: 'Iris K.', authorTrust: 0.92, elite: true,
    rating: 5, date: '2026-08-17',
    subRatings: { drinkSelection: 5, pourValue: 4, bartender: 5, atmosphere: 5, noise: 5 },
    text:
      'The rarest thing in this city: a bar with no televisions where you can hear the person ' +
      'across the table at 11 PM on a Saturday. Reserve the back room. The whiskey list is 180 deep ' +
      'and they will pour you a half if you ask.',
    tags: { occasion: 'Date night', partySize: 2, timeOfVisit: '10:00 PM', spendRange: '$50 to $100' },
    helpful: 71, insightful: 29, photoCount: 2,
  }),
  r({
    id: 'rv-22', venueId: 'bramble', author: 'Omar S.', authorTrust: 0.66,
    rating: 4, date: '2026-07-12',
    subRatings: { drinkSelection: 5, pourValue: 3, bartender: 5, atmosphere: 5, noise: 5 },
    text: 'Seventeen dollars for an old fashioned is a lot until you drink it. Front bar is first come. Patio takes cigars, inside does not.',
    tags: { partySize: 2, timeOfVisit: '8:00 PM' },
    helpful: 26, insightful: 11,
  }),

  /* ----------------------------------------------------------- verso */
  r({
    id: 'rv-23', venueId: 'verso', author: 'Chelsea D.', authorTrust: 0.75,
    rating: 4, date: '2026-08-13',
    subRatings: { drinks: 4, atmosphere: 5, service: 3, comfort: 4 },
    text:
      'Came at 7 for dinner, stayed until the floor cleared at 10 and it became a different place. ' +
      'Two venues at one address. Cover was waived because we had a table. The 22 percent service ' +
      'charge on the minimum is real and it is not the tip.',
    tags: { occasion: 'Birthday', partySize: 6, timeOfVisit: '7:00 PM', coverPaid: 0, spendRange: '$250 and up' },
    helpful: 49, insightful: 24, photoCount: 3,
  }),
  r({
    id: 'rv-24', venueId: 'verso', author: 'Trent B.', authorTrust: 0.57,
    rating: 2, date: '2026-07-26',
    subRatings: { drinks: 3, atmosphere: 4, service: 1, comfort: 2 },
    text: 'Paid a 20 dollar cover at 10:30 and then waited 25 minutes at the bar. Turned away a friend in shorts. That is on us for not reading the dress code, but nobody said it at the door until we were up the elevator.',
    tags: { partySize: 3, timeOfVisit: '10:30 PM', coverPaid: 20 },
    helpful: 62, insightful: 27,
    ownerResponse: { text: 'The dress code should have been stated downstairs and we have changed how the door handles it. Sorry about the wait.', date: '2026-07-28' },
  }),

  /* ------------------------------------------------------- quietpart */
  r({
    id: 'rv-25', venueId: 'quietpart', author: 'Adele F.', authorTrust: 0.89, elite: true,
    rating: 5, date: '2026-08-12',
    subRatings: { drinks: 5, atmosphere: 5, service: 5, comfort: 5 },
    text: 'Thirty-eight seats, no cover, no standing, and a piano that is not amplified into the ground. Two-hour table and they mean it, which is the only reason it stays this good.',
    tags: { occasion: 'Anniversary', partySize: 2, timeOfVisit: '9:00 PM', coverPaid: 0, spendRange: '$100 to $150' },
    helpful: 55, insightful: 26, photoCount: 1,
  }),

  /* --------------------------------------------------------- zafeera */
  r({
    id: 'rv-26', venueId: 'zafeera', author: 'Yusuf A.', authorTrust: 0.72,
    rating: 4, date: '2026-08-08',
    subRatings: { drinks: 4, atmosphere: 4, service: 4, comfort: 5 },
    text: 'Forty-six flavors is not marketing, the board is real. Got there at 10:40 and skipped the cover by twenty minutes. East room is the enclosed smoking room, patio is better.',
    tags: { partySize: 6, timeOfVisit: '10:40 PM', coverPaid: 0, spendRange: '$100 to $150' },
    helpful: 33, insightful: 12, photoCount: 2,
  }),
  r({
    id: 'rv-27', venueId: 'zafeera', author: 'Bianca R.', authorTrust: 0.54,
    rating: 3, date: '2026-07-05',
    subRatings: { drinks: 3, atmosphere: 4, service: 2, comfort: 4 },
    text: 'Cover was 20 not 15 on a Saturday and the listing said 15. Service slowed to nothing after midnight. Hookah itself was great.',
    tags: { partySize: 4, timeOfVisit: '11:30 PM', coverPaid: 20 },
    helpful: 41, insightful: 18,
  }),

  /* -------------------------------------------------------- ashenoak */
  r({
    id: 'rv-28', venueId: 'ashenoak', author: 'Curtis M.', authorTrust: 0.93, elite: true,
    rating: 5, date: '2026-08-18',
    subRatings: { selection: 5, ventilation: 5, comfort: 5, staffKnowledge: 5, value: 4 },
    text:
      'The ventilation here is the reason to come. You can spend four hours in the room and your ' +
      'jacket does not need a dry clean. Walk-in is 320 square feet and actually held at humidity, ' +
      'not a closet with a Cigar Oasis in it. Retail closes an hour before the lounge, buy early.',
    tags: { occasion: 'Regular visit', partySize: 1, timeOfVisit: '7:00 PM', spendRange: '$50 to $100' },
    helpful: 67, insightful: 31, photoCount: 4,
    ownerResponse: { text: 'The ventilation system was the single biggest line item in the build and we are glad it shows. Locker list moves in about four months.', date: '2026-08-19' },
  }),
  r({
    id: 'rv-29', venueId: 'ashenoak', author: 'Wes P.', authorTrust: 0.7,
    rating: 4, date: '2026-07-22',
    subRatings: { selection: 5, ventilation: 4, comfort: 5, staffKnowledge: 5, value: 3 },
    text: 'Full bar and a 200-plus whiskey list next to a real humidor is a rare combination. Fifteen dollar cut fee if you bring your own, waived for members. Dues are 120 a month, which is the part people should know before walking in.',
    tags: { partySize: 2, timeOfVisit: '8:00 PM', spendRange: '$100 to $150' },
    helpful: 39, insightful: 21,
  }),

  /* ------------------------------------------------------- bayouleaf */
  r({
    id: 'rv-30', venueId: 'bayouleaf', author: 'Hank J.', authorTrust: 0.81,
    rating: 4, date: '2026-08-01',
    subRatings: { selection: 5, ventilation: 3, comfort: 4, staffKnowledge: 5, value: 5 },
    text:
      'Best selection in the city and the staff actually know what they are selling. Ventilation is ' +
      'adequate rather than good, so a full room gets thick. BYOB with glassware provided and no ' +
      'corkage is a genuinely good deal.',
    tags: { partySize: 2, timeOfVisit: '5:00 PM', spendRange: '$25 to $50' },
    helpful: 28, insightful: 16,
  }),
  r({
    id: 'rv-31', venueId: 'bayouleaf', author: 'Sylvia T.', authorTrust: 0.59,
    rating: 5, date: '2026-06-30',
    subRatings: { selection: 5, ventilation: 4, comfort: 4, staffKnowledge: 5, value: 5 },
    text: 'Got a medium locker the week I asked, thirty a month. Retail closes earlier than the lounge here too, worth checking the two schedules.',
    tags: { partySize: 1, timeOfVisit: '4:00 PM' },
    helpful: 21, insightful: 9,
  }),

  /* ------------------------------------------------------ emberroom */
  r({
    id: 'rv-32', venueId: 'emberroom', author: 'Gordon E.', authorTrust: 0.85, elite: true,
    rating: 4, date: '2026-07-17',
    subRatings: { selection: 5, ventilation: 5, comfort: 5, staffKnowledge: 5, value: 3 },
    text: 'Went as a member’s guest. The whiskey library is absurd, 420 labels. 350 a month plus an invitation is the real barrier, and lockers are full with no list.',
    tags: { partySize: 2, timeOfVisit: '8:00 PM', spendRange: '$250 and up' },
    helpful: 24, insightful: 18,
  }),

  /* ---------------------------------------------------------- kosmos */
  r({
    id: 'rv-33', venueId: 'kosmos', author: 'Jas P.', authorTrust: 0.78,
    rating: 4, date: '2026-08-16',
    subRatings: { music: 5, crowd: 4, service: 3, value: 3, door: 3 },
    text:
      'Got in at 10:45 with no wait, friends showed at 11:40 and stood 45 minutes. The cutoff is ' +
      'real. Headliner went on at 12:30. Floor table minimum was 800 and the 22 percent service ' +
      'charge was on the full minimum, not what we drank, which is disclosed but easy to miss.',
    tags: { partySize: 6, timeOfVisit: '10:45 PM', waitMinutes: 0, coverPaid: 0, spendRange: '$250 and up' },
    helpful: 94, insightful: 47, photoCount: 2,
  }),
  r({
    id: 'rv-34', venueId: 'kosmos', author: 'Devon C.', authorTrust: 0.61,
    rating: 2, date: '2026-07-29',
    subRatings: { music: 4, crowd: 3, service: 2, value: 1, door: 1 },
    text: 'Thirty dollar cover, no re-entry, and a digital ID got us turned away at the front while the group waited. Bring the physical card. Music was good.',
    tags: { partySize: 4, timeOfVisit: '11:30 PM', waitMinutes: 40, coverPaid: 30 },
    helpful: 78, insightful: 35,
    ownerResponse: { text: 'Physical ID only is a house rule we cannot flex on. It is listed on the profile and at the door, and we should have made it louder online.', date: '2026-07-30' },
  }),
  r({
    id: 'rv-35', venueId: 'kosmos', author: 'VIP Tables HTX', authorTrust: 0.05,
    rating: 5, date: '2026-08-20',
    text: 'BOOK YOUR TABLE WITH US FOR THE BEST RATES!! DM for guest list!! Best club in Texas!!!',
    recommended: false, helpful: 0,
  }),

  /* -------------------------------------------------------- salaroja */
  r({
    id: 'rv-36', venueId: 'salaroja', author: 'Camila O.', authorTrust: 0.8,
    rating: 5, date: '2026-08-07',
    subRatings: { music: 5, crowd: 5, service: 4, value: 4, door: 4 },
    text: 'The Thursday band is the reason to come, 9 to 11, then DJs. Free before 10 on Thursday. Mixed ages and the wristband system actually works.',
    tags: { occasion: 'Live music', partySize: 4, timeOfVisit: '9:00 PM', coverPaid: 0, spendRange: '$50 to $100' },
    helpful: 45, insightful: 19, photoCount: 2,
  }),
  r({
    id: 'rv-37', venueId: 'salaroja', author: 'Nico B.', authorTrust: 0.63,
    rating: 3, date: '2026-07-14',
    subRatings: { music: 4, crowd: 4, service: 3, value: 3, door: 2 },
    text: 'Cover was 20 on Saturday, not the 15 listed. Card machine was down so it was cash at the door only, and the ATM inside was out.',
    tags: { partySize: 2, timeOfVisit: '11:00 PM', coverPaid: 20 },
    helpful: 36, insightful: 15,
  }),
  r({
    id: 'rv-38', venueId: 'salaroja', author: 'Guest1188', authorTrust: 0.04,
    rating: 5, date: '2026-08-19',
    text: 'amazing amazing amazing best club best music best staff',
    recommended: false, helpful: 0,
  }),
  r({
    id: 'rv-39', venueId: 'salaroja', author: 'Guest2041', authorTrust: 0.04,
    rating: 5, date: '2026-08-19',
    text: 'amazing place best music best staff five stars',
    recommended: false, helpful: 0,
  }),
];

export const reviewsByVenue: Record<string, Review[]> = reviews.reduce<Record<string, Review[]>>(
  (acc, rev) => {
    (acc[rev.venueId] ||= []).push(rev);
    return acc;
  },
  {},
);

export function venueReviews(venueId: string, includeFiltered = false): Review[] {
  const list = reviewsByVenue[venueId] ?? [];
  return (includeFiltered ? list : list.filter((x) => x.recommended)).slice().sort((a, b) => b.date.localeCompare(a.date));
}

export function filteredCount(venueId: string): number {
  return (reviewsByVenue[venueId] ?? []).filter((x) => !x.recommended).length;
}

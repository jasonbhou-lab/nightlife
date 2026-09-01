import type { AttributeDef, AttributeGroup, Vertical } from '@/types';

/**
 * The attribute registry (PRD 3.3) — the primary differentiator from a
 * general-purpose review platform.
 *
 * One declaration per attribute drives four things:
 *   1. the category-aware filter sheet (F-SEARCH-04: irrelevant filters are
 *      hidden, not disabled),
 *   2. the grouped attribute panel on the profile (F-PROFILE-04),
 *   3. the six above-the-fold decision attributes per category (U-01),
 *   4. staleness expiry on volatile fields (3.4: cover/tap/lineup 14 days,
 *      happy hour 60, hours 90).
 *
 * `verticals: []` means universal across all five.
 */

const B = 'boolean' as const;
const I = 'integer' as const;
const E = 'enum' as const;
const M = 'multi' as const;
const C = 'currency' as const;
const T = 'time' as const;
const X = 'text' as const;

const def = (
  key: string,
  label: string,
  type: AttributeDef['type'],
  group: AttributeGroup,
  verticals: Vertical[],
  extra: Partial<AttributeDef> = {},
): AttributeDef => ({ key, label, type, group, verticals, ...extra });

export const attributeDefs: AttributeDef[] = [
  /* ------------------------------------------------ universal (PRD 3.3) */
  def('parking', 'Parking', M, 'access', [], {
    options: [
      { value: 'street', label: 'Street' },
      { value: 'lot', label: 'Lot' },
      { value: 'valet', label: 'Valet' },
      { value: 'garage', label: 'Garage' },
      { value: 'validated', label: 'Validated' },
    ],
    filterable: true,
  }),
  def('wheelchair', 'Wheelchair accessible', B, 'access', [], { filterable: true }),
  def('restroomAccessible', 'Accessible restroom', B, 'access', []),
  def('outdoorSeating', 'Outdoor seating', B, 'seating', [], { filterable: true }),
  def('heatedPatio', 'Heated patio', B, 'seating', []),
  def('coveredPatio', 'Covered patio', B, 'seating', []),
  def('tvCount', 'TVs', I, 'entertainment', [], { filterAsMinimum: true }),
  def('wifi', 'WiFi', B, 'access', []),
  def('noiseLevel', 'Noise level', E, 'crowd', [], {
    options: [
      { value: 'quiet', label: 'Quiet' },
      { value: 'average', label: 'Average' },
      { value: 'loud', label: 'Loud' },
      { value: 'very_loud', label: 'Very loud' },
    ],
    filterable: true,
  }),
  def('goodForGroups', 'Good for groups', B, 'seating', [], { filterable: true }),
  def('groupCeiling', 'Largest party seated', I, 'seating', [], { filterAsMinimum: true, unit: 'guests' }),
  def('acceptsReservations', 'Accepts reservations', B, 'entry', [], { filterable: true }),
  def('walkInsWelcome', 'Walk-ins welcome', B, 'entry', [], { filterable: true }),
  def('cashless', 'Cashless', B, 'money', []),
  def('cashOnly', 'Cash only', B, 'money', []),
  def('gratuityPolicy', 'Gratuity / service charge', X, 'money', []),
  def('ageMinimumLate', 'Age minimum after 9 PM', I, 'entry', [], { unit: '+', filterable: true }),
  def('dressCode', 'Dress code', E, 'entry', [], {
    options: [
      { value: 'none', label: 'No dress code' },
      { value: 'casual', label: 'Casual' },
      { value: 'smart_casual', label: 'Smart casual' },
      { value: 'dressy', label: 'Dressy' },
      { value: 'upscale', label: 'Upscale' },
    ],
    filterable: true,
  }),
  def('lastCall', 'Last call', T, 'entry', [], { ttlDays: 90 }),
  def('dogFriendly', 'Dog friendly', E, 'access', ['bar', 'dining', 'cigar'], {
    options: [
      { value: 'no', label: 'Not dog friendly' },
      { value: 'patio', label: 'Patio only' },
      { value: 'indoors', label: 'Indoors and patio' },
    ],
    filterable: true,
  }),

  /* ------------------------------------------------------- restaurant */
  def('dietary', 'Dietary options', M, 'food', ['dining'], {
    options: [
      { value: 'vegetarian', label: 'Vegetarian' },
      { value: 'vegan', label: 'Vegan' },
      { value: 'gluten_free', label: 'Gluten-free' },
      { value: 'halal', label: 'Halal' },
      { value: 'kosher', label: 'Kosher' },
      { value: 'nut_free_kitchen', label: 'Nut-free kitchen' },
    ],
    filterable: true,
  }),
  def('allergenNotes', 'Allergen notes', X, 'food', ['dining']),
  def('kidsMenu', 'Kids menu', B, 'food', ['dining'], { filterable: true }),
  def('highChairs', 'High chairs', B, 'food', ['dining']),
  def('takeout', 'Takeout', B, 'food', ['dining'], { filterable: true }),
  def('delivery', 'Delivery', B, 'food', ['dining'], { filterable: true }),
  def('curbside', 'Curbside', B, 'food', ['dining']),
  def('catering', 'Catering', B, 'food', ['dining']),
  def('privateDining', 'Private dining room', B, 'seating', ['dining', 'lounge'], { filterable: true }),
  def('privateDiningCapacity', 'Private room capacity', I, 'seating', ['dining', 'lounge'], { unit: 'guests' }),
  def('chefsTable', "Chef's table", B, 'food', ['dining']),
  def('tastingMenu', 'Tasting menu', B, 'food', ['dining'], { filterable: true }),
  def('corkageFee', 'Corkage fee', C, 'money', ['dining']),
  def('byob', 'BYOB', B, 'drink', ['dining', 'cigar'], { filterable: true }),
  def('brunch', 'Brunch service', B, 'food', ['dining'], { filterable: true }),
  def('reservationLeadDays', 'Typical reservation lead time', I, 'entry', ['dining'], { unit: 'days' }),
  def('avgTurnMinutes', 'Average table turn', I, 'seating', ['dining'], { unit: 'min' }),

  /* -------------------------------------------------------------- bar */
  def('tapCount', 'Beers on tap', I, 'drink', ['bar'], { filterable: true, filterAsMinimum: true, ttlDays: 14 }),
  def('rotatingTaps', 'Rotating taps', B, 'drink', ['bar'], { ttlDays: 14 }),
  def('liveTapList', 'Live tap list', B, 'drink', ['bar'], {
    caveat: 'Integration-fed where true; otherwise user-reported with a timestamp.',
  }),
  def('houseBrewed', 'Brewed on premises', B, 'drink', ['bar'], { filterable: true }),
  def('breweryTours', 'Brewery tours', B, 'entertainment', ['bar'], { filterable: true }),
  def('growlerFills', 'Growler and crowler fills', B, 'drink', ['bar']),
  def('caskAle', 'Cask ale', B, 'drink', ['bar']),
  def('wineByGlass', 'Wines by the glass', I, 'drink', ['bar', 'lounge', 'dining'], { filterAsMinimum: true }),
  def('sommelier', 'Sommelier on staff', B, 'drink', ['bar', 'lounge', 'dining']),
  def('whiskeyCount', 'Whiskey or agave pours', I, 'drink', ['bar', 'lounge', 'cigar'], {
    filterable: true,
    filterAsMinimum: true,
  }),
  def('rarePours', 'Rare and allocated pours', B, 'drink', ['bar', 'cigar']),
  def('flights', 'Tasting flights', B, 'drink', ['bar', 'cigar'], { filterable: true }),
  def('cocktailStyle', 'Cocktail program', E, 'drink', ['bar', 'lounge'], {
    options: [
      { value: 'classic', label: 'Classic' },
      { value: 'craft', label: 'Craft' },
      { value: 'high_volume', label: 'High volume' },
      { value: 'frozen', label: 'Frozen and slushie' },
      { value: 'shots_forward', label: 'Shots-forward' },
    ],
    filterable: true,
  }),
  def('happyHour', 'Happy hour', B, 'money', ['bar', 'lounge', 'dining'], {
    filterable: true,
    ttlDays: 60,
  }),
  def('reverseHappyHour', 'Reverse happy hour', B, 'money', ['bar', 'lounge'], { ttlDays: 60 }),
  def('lateNightSpecials', 'Late-night specials', B, 'money', ['bar', 'lounge'], { ttlDays: 60 }),
  def('foodService', 'Food', E, 'food', ['bar', 'lounge', 'cigar'], {
    options: [
      { value: 'none', label: 'No food' },
      { value: 'snacks', label: 'Bar snacks' },
      { value: 'full_kitchen', label: 'Full kitchen' },
      { value: 'food_truck', label: 'Food truck on site' },
    ],
    filterable: true,
  }),
  def('outsideFoodOk', 'Outside food permitted', B, 'food', ['bar', 'cigar']),
  def('sportsViewing', 'Shows games', B, 'entertainment', ['bar', 'lounge'], { filterable: true }),
  def('largestScreenInches', 'Largest screen', I, 'entertainment', ['bar'], { unit: '"', filterAsMinimum: true }),
  def('projector', 'Projector', B, 'entertainment', ['bar']),
  def('soundOnForGames', 'Sound on for games', B, 'entertainment', ['bar'], { filterable: true }),
  def('supportersBar', 'Supporters bar for', M, 'entertainment', ['bar'], {
    options: [
      { value: 'texans', label: 'Texans' },
      { value: 'astros', label: 'Astros' },
      { value: 'rockets', label: 'Rockets' },
      { value: 'dynamo', label: 'Dynamo' },
      { value: 'liverpool', label: 'Liverpool' },
      { value: 'longhorns', label: 'Longhorns' },
      { value: 'aggies', label: 'Aggies' },
    ],
    filterable: true,
  }),
  def('gameDaySpecials', 'Game-day specials', B, 'money', ['bar'], { ttlDays: 60 }),
  def('games', 'Games and activities', M, 'entertainment', ['bar', 'lounge'], {
    options: [
      { value: 'pool', label: 'Pool tables' },
      { value: 'darts', label: 'Darts' },
      { value: 'shuffleboard', label: 'Shuffleboard' },
      { value: 'arcade', label: 'Arcade cabinets' },
      { value: 'pinball', label: 'Pinball' },
      { value: 'jukebox', label: 'Jukebox' },
      { value: 'trivia', label: 'Trivia night' },
      { value: 'karaoke', label: 'Karaoke' },
      { value: 'open_mic', label: 'Open mic' },
      { value: 'comedy', label: 'Comedy night' },
      { value: 'bingo', label: 'Bingo' },
      { value: 'board_games', label: 'Board games' },
      { value: 'axe_throwing', label: 'Axe throwing' },
      { value: 'mini_golf', label: 'Mini golf' },
      { value: 'pickleball', label: 'Pickleball' },
    ],
    filterable: true,
  }),
  def('poolTableCount', 'Pool tables', I, 'entertainment', ['bar'], { filterAsMinimum: true }),
  def('liveMusic', 'Live music', B, 'entertainment', ['bar', 'lounge', 'cigar'], { filterable: true }),
  def('dancingPermitted', 'Dancing permitted', B, 'entertainment', ['bar', 'lounge'], {
    filterable: true,
    caveat: 'Many bars have neither dancing nor a dance floor, which materially changes expectation.',
  }),
  def('danceFloor', 'Dance floor', B, 'entertainment', ['bar', 'lounge', 'nightclub']),
  def('seatingProfile', 'Seating profile', E, 'seating', ['bar', 'lounge'], {
    options: [
      { value: 'bar_stools', label: 'Mostly bar stools' },
      { value: 'mixed', label: 'Bar and tables' },
      { value: 'tables', label: 'Mostly tables' },
      { value: 'standing', label: 'Standing room' },
    ],
    filterable: true,
  }),
  def('barStools', 'Bar stools', I, 'seating', ['bar']),
  def('tableCount', 'Tables', I, 'seating', ['bar', 'lounge']),
  def('sroAfter', 'Standing room only after', T, 'seating', ['bar'], { ttlDays: 60 }),
  def('booths', 'Booths', B, 'seating', ['bar', 'dining']),
  def('communalTables', 'Communal tables', B, 'seating', ['bar']),
  def('patioSeats', 'Patio seats', I, 'seating', ['bar', 'lounge', 'cigar']),
  def('crowdAge', 'Typical crowd', E, 'crowd', ['bar', 'lounge', 'nightclub'], {
    options: [
      { value: '21_25', label: '21 to 25' },
      { value: '25_35', label: '25 to 35' },
      { value: '30_45', label: '30 to 45' },
      { value: '35_plus', label: '35 and up' },
      { value: 'mixed', label: 'Mixed' },
    ],
    filterable: true,
  }),
  def('conversationAtPeak', 'Conversation-friendly at peak', B, 'crowd', ['bar', 'lounge'], { filterable: true }),
  def('industryNight', 'Industry night', B, 'crowd', ['bar', 'lounge']),
  def('tabCardHold', 'Card hold required for a tab', B, 'money', ['bar']),
  def('atmOnSite', 'ATM on site', B, 'money', ['bar', 'nightclub']),
  def('gaming', 'Games of chance where legal', M, 'entertainment', ['bar'], {
    options: [
      { value: 'keno', label: 'Keno' },
      { value: 'pull_tabs', label: 'Pull tabs' },
      { value: 'sports_betting', label: 'Sports betting kiosk' },
      { value: 'poker_night', label: 'Poker night' },
    ],
  }),

  /* ---------------------------------------------------- smoking (shared) */
  def('smokingOutdoor', 'Outdoor smoking area', B, 'smoking', ['bar', 'lounge', 'cigar', 'nightclub'], {
    filterable: true,
  }),
  def('cigarFriendlyPatio', 'Cigar-friendly patio', B, 'smoking', ['bar', 'lounge'], { filterable: true }),
  def('hookah', 'Hookah available', B, 'smoking', ['bar', 'lounge'], { filterable: true }),

  /* ----------------------------------------------------------- lounge */
  def('coverCharge', 'Cover charge', C, 'money', ['lounge', 'nightclub', 'bar'], {
    filterable: true,
    ttlDays: 14,
    caveat: 'Cover moves constantly. A cover charge without a timestamp is not shown as fact.',
  }),
  def('coverNights', 'Cover applies', M, 'money', ['lounge', 'nightclub', 'bar'], {
    options: [
      { value: 'thu', label: 'Thursday' },
      { value: 'fri', label: 'Friday' },
      { value: 'sat', label: 'Saturday' },
      { value: 'events', label: 'Event nights' },
    ],
    ttlDays: 14,
  }),
  def('coverWaived', 'Cover waived when', X, 'money', ['lounge', 'nightclub'], { ttlDays: 14 }),
  def('bottleService', 'Bottle service', B, 'money', ['lounge', 'nightclub', 'bar'], { filterable: true }),
  def('bottleMinimum', 'Bottle minimum from', C, 'money', ['lounge', 'nightclub'], { filterable: true }),
  def('hookahFlavorCount', 'Hookah flavors', I, 'smoking', ['lounge'], { filterAsMinimum: true }),
  def('shishaPrice', 'Shisha from', C, 'money', ['lounge']),
  def('djNights', 'DJ nights', M, 'entertainment', ['lounge', 'nightclub'], {
    options: [
      { value: 'wed', label: 'Wednesday' },
      { value: 'thu', label: 'Thursday' },
      { value: 'fri', label: 'Friday' },
      { value: 'sat', label: 'Saturday' },
      { value: 'sun', label: 'Sunday' },
    ],
    ttlDays: 14,
  }),
  def('vipArea', 'VIP area', B, 'seating', ['lounge', 'nightclub'], { filterable: true }),
  def('minimumSpend', 'Minimum spend', C, 'money', ['lounge', 'nightclub']),
  def('smokingZones', 'Smoking permitted zones', X, 'smoking', ['lounge']),

  /* ------------------------------------------------------------ cigar */
  def('humidorType', 'Humidor', E, 'humidor', ['cigar'], {
    options: [
      { value: 'none', label: 'No humidor' },
      { value: 'retail_cabinet', label: 'Retail cabinet' },
      { value: 'walk_in', label: 'Walk-in humidor' },
      { value: 'multi_walk_in', label: 'Multiple walk-ins' },
    ],
    filterable: true,
  }),
  def('humidorSqFt', 'Humidor size', I, 'humidor', ['cigar'], { unit: 'sq ft', filterAsMinimum: true }),
  def('skuCount', 'Approximate SKUs', I, 'humidor', ['cigar'], { filterAsMinimum: true }),
  def('brands', 'Brands carried', M, 'humidor', ['cigar'], {
    options: [
      { value: 'padron', label: 'Padrón' },
      { value: 'oliva', label: 'Oliva' },
      { value: 'my_father', label: 'My Father' },
      { value: 'arturo_fuente', label: 'Arturo Fuente' },
      { value: 'davidoff', label: 'Davidoff' },
      { value: 'rocky_patel', label: 'Rocky Patel' },
      { value: 'drew_estate', label: 'Drew Estate' },
      { value: 'ashton', label: 'Ashton' },
      { value: 'plasencia', label: 'Plasencia' },
      { value: 'foundation', label: 'Foundation' },
    ],
    filterable: true,
  }),
  def('houseBlend', 'House blend or private label', B, 'humidor', ['cigar'], { filterable: true }),
  def('cutLightService', 'Cutting and lighting service', B, 'humidor', ['cigar']),
  def('lockerProgram', 'Personal lockers', E, 'humidor', ['cigar'], {
    options: [
      { value: 'available', label: 'Available' },
      { value: 'waitlist', label: 'Waitlist' },
      { value: 'full', label: 'Full' },
      { value: 'not_offered', label: 'Not offered' },
    ],
    filterable: true,
  }),
  def('lockerPriceMonthly', 'Locker from', C, 'money', ['cigar'], { unit: '/mo' }),
  def('membershipModel', 'Membership', E, 'entry', ['cigar'], {
    options: [
      { value: 'none', label: 'No membership' },
      { value: 'dues', label: 'Dues-based' },
      { value: 'purchase_minimum', label: 'Purchase minimum' },
      { value: 'invitation', label: 'Invitation only' },
    ],
    filterable: true,
  }),
  def('membershipPrice', 'Membership from', C, 'money', ['cigar'], { unit: '/mo' }),
  def('membershipGuests', 'Guest privileges', X, 'entry', ['cigar']),
  def('ventilationDeclared', 'Ventilation (venue-declared)', E, 'smoking', ['cigar'], {
    options: [
      { value: 'basic', label: 'Basic' },
      { value: 'good', label: 'Good' },
      { value: 'excellent', label: 'Excellent, purpose-built' },
    ],
    filterable: true,
    caveat: 'Self-declared. The community ventilation rating is the independent signal.',
  }),
  def('indoorSmokingDeclared', 'Indoor smoking (venue-declared)', B, 'smoking', ['cigar'], {
    filterable: true,
    caveat:
      'Recorded as the venue’s own declaration. Indoor smoking legality depends on state ' +
      'and local clean-indoor-air law and any exemption; the platform does not assert it as fact.',
  }),
  def('outdoorCigarPatio', 'Outdoor smoking patio', B, 'smoking', ['cigar'], { filterable: true }),
  def('alcoholService', 'Alcohol', E, 'drink', ['cigar'], {
    options: [
      { value: 'none', label: 'No alcohol' },
      { value: 'byob', label: 'BYOB' },
      { value: 'beer_wine', label: 'Beer and wine' },
      { value: 'full_bar', label: 'Full bar' },
    ],
    filterable: true,
  }),
  def('seatCount', 'Lounge seats', I, 'seating', ['cigar'], { filterAsMinimum: true }),
  def('privateRooms', 'Private rooms', B, 'seating', ['cigar', 'lounge']),
  def('seatingComfort', 'Seating comfort (venue-declared)', E, 'seating', ['cigar'], {
    options: [
      { value: 'basic', label: 'Basic' },
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'leather_club', label: 'Leather club chairs' },
    ],
  }),
  def('byocPolicy', 'Bring your own cigar', E, 'humidor', ['cigar'], {
    options: [
      { value: 'not_permitted', label: 'Not permitted' },
      { value: 'permitted_with_fee', label: 'Permitted, cut fee applies' },
      { value: 'permitted_free', label: 'Permitted, no fee' },
    ],
    filterable: true,
  }),
  def('cutFee', 'Cut fee', C, 'money', ['cigar']),
  def('pairingProgram', 'Pairing program', B, 'drink', ['cigar'], { filterable: true }),
  def('rollersOnSite', 'Roller on site', B, 'entertainment', ['cigar'], { ttlDays: 14 }),
  def('herfSchedule', 'Herf and brand nights', X, 'entertainment', ['cigar'], { ttlDays: 14 }),
  def('retailHoursDiffer', 'Retail hours differ from lounge hours', B, 'entry', ['cigar']),
  def('coffeeService', 'Coffee and espresso', B, 'drink', ['cigar'], { filterable: true }),
  def('gamingOnSite', 'On site', M, 'entertainment', ['cigar'], {
    options: [
      { value: 'poker', label: 'Poker' },
      { value: 'pool', label: 'Pool' },
      { value: 'shuffleboard', label: 'Shuffleboard' },
    ],
  }),

  /* -------------------------------------------------------- nightclub */
  /**
   * F-BOOK-07: this is the search-filterable "does this venue run a guest
   * list at all" declaration. The profile's "Guest list" action button is
   * gated separately, on `bookingModes.includes('guest_list')`, so it can
   * never point a tap at this attribute being true while the real booking
   * flow isn't actually wired up for the venue.
   */
  def('guestList', 'Guest list', B, 'entry', ['nightclub'], { filterable: true, ttlDays: 14 }),
  def('guestListCutoff', 'Guest list cutoff', T, 'entry', ['nightclub'], { ttlDays: 14 }),
  def('guestListCapacity', 'Guest list capacity', I, 'entry', ['nightclub'], { unit: 'names/night' }),
  def('promoterAffiliated', 'Promoter-driven guest list', B, 'entry', ['nightclub']),
  def('bottleMenuPublished', 'Bottle menu published', B, 'money', ['nightclub', 'lounge']),
  def('capacity', 'Capacity', I, 'crowd', ['nightclub'], { filterAsMinimum: true }),
  def('peakHour', 'Peak hour', T, 'crowd', ['nightclub']),
  def('typicalWaitAtPeak', 'Typical wait at peak', I, 'crowd', ['nightclub'], { unit: 'min', ttlDays: 14 }),
  def('genres', 'Music', M, 'entertainment', ['nightclub', 'lounge'], {
    options: [
      { value: 'house', label: 'House' },
      { value: 'edm', label: 'EDM' },
      { value: 'hip_hop', label: 'Hip-hop' },
      { value: 'latin', label: 'Latin' },
      { value: 'reggaeton', label: 'Reggaetón' },
      { value: 'top_40', label: 'Top 40' },
      { value: 'afrobeats', label: 'Afrobeats' },
      { value: 'throwback', label: 'Throwback' },
      { value: 'jazz', label: 'Jazz' },
      { value: 'country', label: 'Country' },
    ],
    filterable: true,
    ttlDays: 14,
  }),
  def('residentDJs', 'Resident DJs', M, 'entertainment', ['nightclub'], { ttlDays: 14 }),
  def('agePolicy', 'Age policy', E, 'entry', ['nightclub', 'lounge'], {
    options: [
      { value: '18_plus', label: '18 and up' },
      { value: '21_plus', label: '21 and up' },
      { value: 'mixed_wristband', label: '18+ with 21+ wristbanding' },
    ],
    filterable: true,
  }),
  def('dressProhibitions', 'Dress code prohibits', M, 'entry', ['nightclub'], {
    options: [
      { value: 'athletic', label: 'Athletic wear' },
      { value: 'shorts', label: 'Shorts' },
      { value: 'sandals', label: 'Sandals' },
      { value: 'hats', label: 'Hats' },
      { value: 'baggy', label: 'Baggy clothing' },
      { value: 'tennis_shoes', label: 'Tennis shoes' },
    ],
  }),
  def('idRequirement', 'ID required', E, 'entry', ['nightclub'], {
    options: [
      { value: 'any_government', label: 'Any government ID' },
      { value: 'physical_only', label: 'Physical ID only, no photos' },
      { value: 'passport_ok', label: 'Passport accepted' },
    ],
  }),
  def('coatCheck', 'Coat check', B, 'entry', ['nightclub', 'lounge'], { filterable: true }),
  def('bagPolicy', 'Bag policy', E, 'entry', ['nightclub'], {
    options: [
      { value: 'no_bags', label: 'No bags' },
      { value: 'small_only', label: 'Small bags only' },
      { value: 'clear_only', label: 'Clear bags only' },
      { value: 'any', label: 'Any bag' },
    ],
  }),
  def('reEntry', 'Re-entry permitted', B, 'entry', ['nightclub'], { filterable: true }),
  def('securityScreening', 'Security screening', E, 'entry', ['nightclub'], {
    options: [
      { value: 'visual', label: 'Visual' },
      { value: 'wand', label: 'Wand' },
      { value: 'metal_detector', label: 'Metal detector' },
    ],
  }),
  def('vipEntrance', 'VIP entrance', B, 'entry', ['nightclub'], { filterable: true }),
  def('closingTime', 'Typical closing time', T, 'entry', ['nightclub'], { ttlDays: 90 }),
];

export const attributeByKey: Record<string, AttributeDef> = Object.fromEntries(
  attributeDefs.map((d) => [d.key, d]),
);

export function attributesForVertical(v: Vertical): AttributeDef[] {
  return attributeDefs.filter((d) => d.verticals.length === 0 || d.verticals.includes(v));
}

/**
 * Which attribute groups matter most for a vertical, first — shared between
 * the read-only profile panel and the business editor so the two never show
 * a different order for the same venue.
 */
export function groupOrderForVertical(v: Vertical): AttributeGroup[] {
  switch (v) {
    case 'cigar':
      return ['humidor', 'smoking', 'drink', 'entry', 'seating', 'money', 'food', 'entertainment', 'crowd', 'access'];
    case 'nightclub':
      return ['entry', 'money', 'entertainment', 'crowd', 'seating', 'smoking', 'access', 'drink', 'food', 'humidor'];
    case 'bar':
      return ['drink', 'entertainment', 'seating', 'crowd', 'food', 'money', 'entry', 'smoking', 'access', 'humidor'];
    case 'lounge':
      return ['money', 'entry', 'entertainment', 'smoking', 'seating', 'drink', 'crowd', 'food', 'access', 'humidor'];
    default:
      return ['food', 'seating', 'entry', 'drink', 'money', 'crowd', 'access', 'entertainment', 'smoking', 'humidor'];
  }
}

export function filterableForVerticals(vs: Vertical[]): AttributeDef[] {
  const active = vs.length ? vs : (['dining', 'bar', 'lounge', 'cigar', 'nightclub'] as Vertical[]);
  return attributeDefs.filter(
    (d) =>
      d.filterable &&
      (d.verticals.length === 0 || d.verticals.some((v) => active.includes(v))),
  );
}

export const groupLabels: Record<AttributeGroup, string> = {
  decide: 'The short version',
  drink: 'Drink program',
  food: 'Food',
  humidor: 'Humidor and cigars',
  entry: 'Getting in',
  entertainment: 'Entertainment',
  seating: 'Seating and space',
  crowd: 'Crowd and noise',
  access: 'Access and parking',
  money: 'Cover, minimums, and money',
  smoking: 'Smoking',
};

/**
 * U-01: the six most decision-relevant attributes per category, surfaced above
 * the fold. For bars this is deliberately drink depth, noise, seating profile,
 * sports and games, kitchen hours, and happy hour — not a generic amenity list.
 * Kitchen hours are handled by the schedule renderer rather than an attribute.
 */
export const decisionKeys: Record<Vertical, string[]> = {
  dining: ['acceptsReservations', 'priceTier', 'noiseLevel', 'dietary', 'brunch', 'privateDining'],
  bar: ['tapCount', 'noiseLevel', 'seatingProfile', 'sportsViewing', 'games', 'happyHour'],
  lounge: ['coverCharge', 'bottleMinimum', 'hookah', 'dressCode', 'djNights', 'vipArea'],
  cigar: ['humidorType', 'indoorSmokingDeclared', 'lockerProgram', 'alcoholService', 'membershipModel', 'seatCount'],
  nightclub: ['coverCharge', 'genres', 'agePolicy', 'dressCode', 'typicalWaitAtPeak', 'bottleMinimum'],
};

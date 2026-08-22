import { Ionicons } from '@expo/vector-icons';

import { attributeByKey, decisionKeys } from '@/data/attributes';
import { activeHappyHour, formatDuration, kitchenGap, scheduleOf, toMinutes } from '@/lib/hours';
import { formatAttribute, freshness, priceLabel } from '@/lib/format';
import type { Venue } from '@/types';

export type DecisionChip = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Volatile value past its TTL: rendered as a dated report, not fact (U-05). */
  stale?: boolean;
};

const iconFor: Record<string, keyof typeof Ionicons.glyphMap> = {
  tapCount: 'beer',
  noiseLevel: 'volume-high',
  seatingProfile: 'grid',
  sportsViewing: 'american-football',
  games: 'game-controller',
  happyHour: 'pricetag',
  acceptsReservations: 'calendar',
  priceTier: 'cash',
  dietary: 'leaf',
  brunch: 'sunny',
  privateDining: 'people',
  coverCharge: 'ticket',
  bottleMinimum: 'wine',
  hookah: 'cloud',
  dressCode: 'shirt',
  djNights: 'disc',
  vipArea: 'star',
  humidorType: 'cube',
  indoorSmokingDeclared: 'flame',
  lockerProgram: 'lock-closed',
  alcoholService: 'wine',
  membershipModel: 'card',
  seatCount: 'people',
  genres: 'musical-notes',
  agePolicy: 'card',
  typicalWaitAtPeak: 'time',
};

/**
 * U-01, progressive disclosure: the six most decision-relevant attributes for
 * the category, phrased the way a person would ask about them. For a bar that
 * is drink depth, noise, seating profile, sports, games, and happy hour — not a
 * generic amenity list.
 */
export function decisionChips(venue: Venue, now: Date, limit = 6): DecisionChip[] {
  const keys = decisionKeys[venue.primary.vertical];
  const out: DecisionChip[] = [];

  for (const key of keys) {
    if (key === 'priceTier') {
      out.push({ key, label: priceLabel(venue.priceTier), icon: 'cash' });
      continue;
    }

    const value = venue.attributes[key];
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;

    const def = attributeByKey[key];
    const fresh = freshness(venue, key, now);
    const icon = iconFor[key] ?? 'ellipse';

    let label: string;
    switch (key) {
      case 'tapCount':
        label = `${value} taps${venue.attributes.rotatingTaps ? ', rotating' : ''}`;
        break;
      case 'noiseLevel':
        label = `${formatAttribute(key, value)} noise`;
        break;
      case 'sportsViewing':
        label = value
          ? `${venue.attributes.tvCount ?? ''} TVs${venue.attributes.soundOnForGames ? ', sound on' : ''}`.trim()
          : 'No games';
        break;
      case 'games': {
        const arr = value as string[];
        const first = def?.options?.find((o) => o.value === arr[0])?.label ?? arr[0];
        label = arr.length > 1 ? `${first} +${arr.length - 1}` : first;
        break;
      }
      case 'happyHour': {
        const active = activeHappyHour(venue, now);
        label = active
          ? `Happy hour, ${formatDuration(active.minutesLeft)} left`
          : value
            ? 'Has happy hour'
            : 'No happy hour';
        break;
      }
      case 'acceptsReservations':
        label = value ? 'Takes reservations' : 'Walk-in only';
        break;
      case 'coverCharge':
        label = value === 0 ? 'No cover' : `$${value} cover`;
        break;
      case 'bottleMinimum':
        label = `Tables from $${value}`;
        break;
      case 'hookah':
        label = value ? `Hookah, ${venue.attributes.hookahFlavorCount ?? ''} flavors`.trim() : 'No hookah';
        break;
      case 'dressCode':
        label = value === 'none' ? 'No dress code' : formatAttribute(key, value);
        break;
      case 'djNights':
        label = `DJ ${(value as string[]).length} nights`;
        break;
      case 'humidorType':
        label = formatAttribute(key, value);
        break;
      case 'indoorSmokingDeclared':
        label = value ? 'Indoor smoking, declared' : 'Outdoor smoking only';
        break;
      case 'lockerProgram':
        label = `Lockers: ${String(formatAttribute(key, value)).toLowerCase()}`;
        break;
      case 'membershipModel':
        label =
          value === 'none'
            ? 'No membership'
            : venue.attributes.membershipPrice
              ? `${formatAttribute(key, value)}, $${venue.attributes.membershipPrice}/mo`
              : formatAttribute(key, value);
        break;
      case 'seatCount':
        label = `${value} seats`;
        break;
      case 'typicalWaitAtPeak':
        label = `~${value} min at peak`;
        break;
      case 'agePolicy':
        label = formatAttribute(key, value);
        break;
      case 'genres':
        label = formatAttribute(key, (value as string[]).slice(0, 2));
        break;
      case 'dietary':
        label = formatAttribute(key, (value as string[]).slice(0, 2));
        break;
      case 'alcoholService':
        label = formatAttribute(key, value);
        break;
      case 'privateDining':
        label = value ? `Private room, ${venue.attributes.privateDiningCapacity ?? ''}`.trim() : 'No private room';
        break;
      case 'brunch':
        label = value ? 'Brunch' : 'No brunch';
        break;
      case 'vipArea':
        label = value ? 'VIP area' : 'No VIP area';
        break;
      case 'seatingProfile':
        label = formatAttribute(key, value);
        break;
      default:
        label = `${def?.label ?? key}: ${formatAttribute(key, value)}`;
    }

    out.push({ key, label, icon, stale: fresh.stale });
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * The one-line answer to the question this category's users actually ask first.
 * Bars get the kitchen-versus-bar gap, because that is the most common hours
 * question at a bar or gastropub (F-PROFILE-06).
 */
export function headlineAnswer(venue: Venue, now: Date): string | null {
  const v = venue.primary.vertical;

  if (v === 'bar' || v === 'dining') {
    const gap = kitchenGap(venue, now);
    if (gap) return gap;
  }

  if (v === 'bar') {
    const sro = venue.attributes.sroAfter;
    if (typeof sro === 'string') {
      const hour = toMinutes(sro);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return nowMin >= hour
        ? 'Standing room only at this hour. Do not count on a table.'
        : `Seated now, but it goes standing room only after ${sro.slice(0, 2)}:${sro.slice(3)}.`;
    }
  }

  if (v === 'cigar') {
    const retail = scheduleOf(venue, 'retail');
    const lounge = scheduleOf(venue, 'lounge');
    if (retail && lounge) {
      const d = now.getDay();
      const r = retail.days[d];
      const l = lounge.days[d];
      if (r && l && toMinutes(r.close) !== toMinutes(l.close)) {
        return 'Humidor closes before the lounge does. Buy before retail shuts.';
      }
    }
  }

  if (v === 'nightclub') {
    const wait = venue.attributes.typicalWaitAtPeak;
    const cutoff = venue.attributes.guestListCutoff;
    if (typeof wait === 'number' && typeof cutoff === 'string') {
      return `Typical wait at peak is ${wait} minutes. Guest list closes at ${cutoff}.`;
    }
  }

  if (v === 'lounge') {
    const waived = venue.attributes.coverWaived;
    if (typeof waived === 'string' && waived) return waived;
  }

  return null;
}

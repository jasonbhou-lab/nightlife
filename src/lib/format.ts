import { attributeByKey } from '@/data/attributes';
import { verticalMeta } from '@/data/taxonomy';
import type { AttributeValue, BookingMode, Provenance, Venue, Vertical } from '@/types';
import { formatTime } from '@/lib/hours';

/** Value rendering, provenance/staleness, and the category-adaptive action set. */

export function priceLabel(tier: number): string {
  return '$'.repeat(Math.max(1, Math.min(4, tier)));
}

export function money(n: number): string {
  return n === 0 ? 'No charge' : `$${n.toLocaleString('en-US')}`;
}

export function plural(n: number, one: string, many?: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many ?? `${one}s`}`;
}

/** Render a typed attribute value for display. */
export function formatAttribute(key: string, value: AttributeValue): string {
  const def = attributeByKey[key];
  if (value == null) return 'Not reported';

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (Array.isArray(value)) {
    if (!value.length) return 'None';
    const opts = def?.options;
    return value
      .map((v) => opts?.find((o) => o.value === v)?.label ?? titleize(v))
      .join(', ');
  }

  if (def?.type === 'enum') {
    return def.options?.find((o) => o.value === value)?.label ?? titleize(String(value));
  }
  if (def?.type === 'time') return formatTime(String(value));
  if (def?.type === 'currency') return typeof value === 'number' ? `${money(value)}${def.unit ?? ''}` : String(value);
  if (def?.type === 'integer') {
    const unit = def.unit ? (def.unit === '+' || def.unit === '"' ? def.unit : ` ${def.unit}`) : '';
    return `${value}${unit}`;
  }
  return String(value);
}

export function titleize(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const DIET_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  gluten_free: 'Gluten-free',
  halal: 'Halal',
  kosher: 'Kosher',
  nut_free_kitchen: 'Nut-free kitchen',
};

/* ------------------------------------------------------------ provenance */

export const provenanceLabel: Record<Provenance, string> = {
  owner: 'Owner-provided',
  community: 'Community-reported',
  provider: 'Data provider',
  operator_verified: 'Operator-verified',
};

export function metaFor(venue: Venue, key: string) {
  return venue.meta[key] ?? venue.defaultMeta;
}

export function daysSince(iso: string, now: Date): number {
  const then = new Date(`${iso}T12:00:00`).getTime();
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export function relativeDate(iso: string, now: Date): string {
  const d = daysSince(iso, now);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

/**
 * PRD 3.4 + U-05. Volatile fields expire and are re-solicited: cover charge,
 * tap list, and lineup after 14 days; happy hour after 60; hours after 90.
 * A stale value is still shown, but it is shown as a report with an age, never
 * as fact.
 */
export type Freshness = { stale: boolean; ageDays: number; note: string | null };

export function freshness(venue: Venue, key: string, now: Date): Freshness {
  const def = attributeByKey[key];
  const meta = metaFor(venue, key);
  const age = daysSince(meta.updatedAt, now);
  if (!def?.ttlDays) return { stale: false, ageDays: age, note: null };
  const stale = age > def.ttlDays;
  return {
    stale,
    ageDays: age,
    note: stale
      ? `Last confirmed ${relativeDate(meta.updatedAt, now)}. We re-ask after ${def.ttlDays} days, so treat this as a report rather than fact.`
      : `${provenanceLabel[meta.source]}, ${relativeDate(meta.updatedAt, now)}`,
  };
}

/* --------------------------------------------------------- action sets */

export type Action = { key: string; label: string; icon: string; primary?: boolean };

/**
 * F-PROFILE-02: the primary action set adapts by category. Notably, Reserve
 * only appears where the venue actually accepts reservations — a dead Reserve
 * button on a walk-in-only bar is the thing F-BOOK-09a exists to prevent.
 */
export function actionsFor(venue: Venue): Action[] {
  const v = venue.primary.vertical;
  const modes = venue.bookingModes;
  const acts: Action[] = [];

  const canReserve = modes.includes('reservation');
  const canTable = modes.includes('table_service');
  const canHold = modes.includes('bar_hold');
  const canWaitlist = modes.includes('waitlist');
  const canInquire = modes.includes('inquiry');

  if (v === 'dining') {
    if (canReserve) acts.push({ key: 'reserve', label: 'Reserve', icon: 'calendar', primary: true });
    else if (canWaitlist) acts.push({ key: 'waitlist', label: 'Join waitlist', icon: 'time', primary: true });
    if (venue.attributes.takeout || venue.attributes.delivery) {
      acts.push({ key: 'order', label: 'Order', icon: 'bag-handle' });
    }
    acts.push({ key: 'directions', label: 'Directions', icon: 'navigate' });
    acts.push({ key: 'call', label: 'Call', icon: 'call' });
  } else if (v === 'bar') {
    acts.push({ key: 'directions', label: 'Directions', icon: 'navigate', primary: true });
    if (venue.menus.some((m) => m.volatile)) acts.push({ key: 'taplist', label: 'Tap list', icon: 'beer' });
    if (venue.happyHours?.length) acts.push({ key: 'specials', label: 'Specials', icon: 'pricetag' });
    if (canReserve) acts.push({ key: 'reserve', label: 'Reserve', icon: 'calendar' });
    else if (canHold) acts.push({ key: 'hold', label: 'Hold a table', icon: 'calendar' });
    acts.push({ key: 'call', label: 'Call', icon: 'call' });
  } else if (v === 'lounge') {
    if (canTable) acts.push({ key: 'table', label: 'Book a table', icon: 'wine', primary: true });
    else if (canReserve) acts.push({ key: 'reserve', label: 'Reserve', icon: 'calendar', primary: true });
    acts.push({ key: 'directions', label: 'Directions', icon: 'navigate' });
    acts.push({ key: 'call', label: 'Call', icon: 'call' });
  } else if (v === 'cigar') {
    acts.push({ key: 'directions', label: 'Directions', icon: 'navigate', primary: true });
    acts.push({ key: 'hours', label: 'Hours', icon: 'time' });
    if (canInquire) acts.push({ key: 'membership', label: 'Membership', icon: 'card' });
    acts.push({ key: 'call', label: 'Call', icon: 'call' });
  } else {
    if (canTable) acts.push({ key: 'table', label: 'Book a table', icon: 'wine', primary: true });
    if (venue.attributes.guestList) acts.push({ key: 'guestlist', label: 'Guest list', icon: 'people' });
    acts.push({ key: 'tickets', label: 'Tickets', icon: 'ticket' });
    acts.push({ key: 'directions', label: 'Directions', icon: 'navigate' });
  }

  return acts.slice(0, 4);
}

export const bookingModeLabel: Record<BookingMode, string> = {
  reservation: 'Reservation',
  table_service: 'Table service',
  waitlist: 'Waitlist',
  bar_hold: 'Table hold',
  inquiry: 'Inquiry',
  walk_in: 'Walk-in only',
};

export function verticalLabel(v: Vertical): string {
  return verticalMeta[v].label;
}

export function categoryLine(venue: Venue): string {
  const all = [venue.primary.category, ...venue.secondary.map((s) => s.category)];
  return all.slice(0, 3).join(' · ');
}

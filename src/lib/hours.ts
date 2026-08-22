import type { HappyHourWindow, Schedule, ScheduleKind, Venue } from '@/types';

/**
 * Operating-calendar math.
 *
 * The whole point of this module is F-SEARCH-05: a club that closes at 4 AM on
 * Saturday is open at 2 AM on the Saturday-into-Sunday boundary. A naive
 * "is now between open and close" check gets that wrong every weekend, so every
 * range whose close is not after its open is treated as spilling into the next day.
 */

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "23:30" -> "11:30 PM", "00:00" -> "midnight", "02:00" -> "2 AM". */
export function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm) % 1440;
  if (mins === 0) return 'midnight';
  if (mins === 720) return 'noon';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export type OpenState = {
  open: boolean;
  /** Minutes until close if open, until open if closed. Null when the schedule is dark all week. */
  minutes: number | null;
  /** "Closes at 2 AM" / "Opens 5 PM" / "Closed today". */
  label: string;
  /** True when close is under an hour away. */
  closingSoon: boolean;
  /** True when open is within two hours (drives Tonight's "opening soon"). */
  openingSoon: boolean;
};

/**
 * Evaluate a schedule at an instant. Ranges are checked against both today's
 * entry and yesterday's entry, because yesterday's range may still be running.
 */
export function scheduleState(schedule: Schedule, at: Date): OpenState {
  const dow = at.getDay();
  const nowMin = at.getHours() * 60 + at.getMinutes();

  // Yesterday's range spilling past midnight into right now.
  const prev = schedule.days[(dow + 6) % 7];
  if (prev) {
    const o = toMinutes(prev.open);
    const c = toMinutes(prev.close);
    if (c <= o) {
      const closeToday = c;
      if (nowMin < closeToday) {
        const left = closeToday - nowMin;
        return {
          open: true,
          minutes: left,
          label: `Open, closes at ${formatTime(prev.close)}`,
          closingSoon: left <= 60,
          openingSoon: false,
        };
      }
    }
  }

  const today = schedule.days[dow];
  if (today) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    const crosses = c <= o;
    const closeAbs = crosses ? c + 1440 : c;
    if (nowMin >= o && nowMin < closeAbs) {
      const left = closeAbs - nowMin;
      return {
        open: true,
        minutes: left,
        label: `Open, closes at ${formatTime(today.close)}`,
        closingSoon: left <= 60,
        openingSoon: false,
      };
    }
    if (nowMin < o) {
      const until = o - nowMin;
      return {
        open: false,
        minutes: until,
        label: `Opens ${formatTime(today.open)}`,
        closingSoon: false,
        openingSoon: until <= 120,
      };
    }
  }

  // Nothing today, or today already finished. Find the next open day.
  for (let i = 1; i <= 7; i += 1) {
    const d = schedule.days[(dow + i) % 7];
    if (d) {
      const until = i * 1440 - nowMin + toMinutes(d.open);
      return {
        open: false,
        minutes: until,
        label: `Opens ${DAY_LABELS[(dow + i) % 7]} ${formatTime(d.open)}`,
        closingSoon: false,
        openingSoon: until <= 120,
      };
    }
  }

  return { open: false, minutes: null, label: 'Hours not available', closingSoon: false, openingSoon: false };
}

/** The schedule a consumer means when they ask "is it open" — venue, then lounge, then bar, then retail. */
export function primarySchedule(venue: Venue): Schedule | undefined {
  const order: ScheduleKind[] = ['venue', 'lounge', 'bar', 'retail', 'kitchen'];
  for (const kind of order) {
    const s = venue.schedules.find((x) => x.kind === kind);
    if (s) return s;
  }
  return venue.schedules[0];
}

export function venueState(venue: Venue, at: Date): OpenState {
  const s = primarySchedule(venue);
  if (!s) return { open: false, minutes: null, label: 'Hours not available', closingSoon: false, openingSoon: false };
  return scheduleState(s, at);
}

export function scheduleOf(venue: Venue, kind: ScheduleKind): Schedule | undefined {
  return venue.schedules.find((s) => s.kind === kind);
}

/**
 * "Kitchen closes before the bar" is the single most common hours question at a
 * bar or gastropub (F-PROFILE-06), so it gets a dedicated answer rather than
 * making the user diff two tables.
 */
export function kitchenGap(venue: Venue, at: Date): string | null {
  const kitchen = scheduleOf(venue, 'kitchen');
  const main = primarySchedule(venue);
  if (!kitchen || !main || kitchen === main) return null;

  const dow = at.getDay();
  const k = kitchen.days[dow];
  const v = main.days[dow];
  if (!k || !v) return null;

  const kClose = toMinutes(k.close) + (toMinutes(k.close) <= toMinutes(k.open) ? 1440 : 0);
  const vClose = toMinutes(v.close) + (toMinutes(v.close) <= toMinutes(v.open) ? 1440 : 0);
  const gap = vClose - kClose;
  if (gap < 30) return null;

  const hrs = gap / 60;
  const gapText = hrs >= 1 ? `${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hour${hrs === 1 ? '' : 's'}` : `${gap} minutes`;
  return `Kitchen closes at ${formatTime(k.close)}, ${gapText} before the ${
    main.kind === 'venue' ? 'bar' : main.kind
  } at ${formatTime(v.close)}.`;
}

/** Same idea for cigar lounges, where retail and lounge hours routinely differ. */
export function retailGap(venue: Venue, at: Date): string | null {
  const retail = scheduleOf(venue, 'retail');
  const lounge = scheduleOf(venue, 'lounge');
  if (!retail || !lounge) return null;
  const dow = at.getDay();
  const rDay = retail.days[dow];
  const lDay = lounge.days[dow];
  if (!rDay || !lDay) return null;

  const rClose = toMinutes(rDay.close) + (toMinutes(rDay.close) <= toMinutes(rDay.open) ? 1440 : 0);
  const lClose = toMinutes(lDay.close) + (toMinutes(lDay.close) <= toMinutes(lDay.open) ? 1440 : 0);
  if (lClose - rClose < 30) return null;
  return `Humidor and retail close at ${formatTime(rDay.close)}; the lounge stays open until ${formatTime(
    lDay.close,
  )}. Buy before retail closes.`;
}

/** Is the venue open at a specific wall-clock time on the given day? */
export function isOpenAt(venue: Venue, day: number, hhmm: string): boolean {
  const s = primarySchedule(venue);
  if (!s) return false;
  const target = toMinutes(hhmm);

  const today = s.days[day];
  if (today) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    const closeAbs = c <= o ? c + 1440 : c;
    if (target >= o && target < closeAbs) return true;
  }
  // A late-night target may belong to yesterday's range.
  const prev = s.days[(day + 6) % 7];
  if (prev) {
    const o = toMinutes(prev.open);
    const c = toMinutes(prev.close);
    if (c <= o && target < c) return true;
  }
  return false;
}

/* ------------------------------------------------------------ happy hour */

export type ActiveHappyHour = { window: HappyHourWindow; minutesLeft: number };

/**
 * Happy hour is the strongest early-evening module in Tonight, and PRD 5.1 asks
 * for time remaining rather than a boolean flag.
 */
export function activeHappyHour(venue: Venue, at: Date): ActiveHappyHour | null {
  if (!venue.happyHours?.length) return null;
  const dow = at.getDay();
  const now = at.getHours() * 60 + at.getMinutes();
  for (const win of venue.happyHours) {
    if (!win.days.includes(dow)) continue;
    const s = toMinutes(win.start);
    const e = toMinutes(win.end);
    const endAbs = e <= s ? e + 1440 : e;
    if (now >= s && now < endAbs) return { window: win, minutesLeft: endAbs - now };
  }
  return null;
}

export function upcomingHappyHour(venue: Venue, at: Date): { window: HappyHourWindow; minutesUntil: number } | null {
  if (!venue.happyHours?.length) return null;
  const dow = at.getDay();
  const now = at.getHours() * 60 + at.getMinutes();
  let best: { window: HappyHourWindow; minutesUntil: number } | null = null;
  for (const win of venue.happyHours) {
    if (!win.days.includes(dow)) continue;
    const s = toMinutes(win.start);
    if (s > now && (!best || s - now < best.minutesUntil)) best = { window: win, minutesUntil: s - now };
  }
  return best;
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d} day${d === 1 ? '' : 's'}`;
  }
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatRange(open: string, close: string): string {
  return `${formatTime(open)} – ${formatTime(close)}`;
}

import type { Daypart } from '@/types';

/**
 * The one definition of what each daypart means, by hour of day. F-BIZ-08's
 * traffic-by-daypart chart and F-BIZ-10's daypart ad targeting both need this
 * exact boundary set to agree, so it lives here rather than in either one.
 */
export const DAYPART_DEFS: { key: Daypart; label: string; test: (hour: number) => boolean }[] = [
  { key: 'morning', label: 'Morning (5–11a)', test: (h) => h >= 5 && h < 11 },
  { key: 'afternoon', label: 'Afternoon (11a–5p)', test: (h) => h >= 11 && h < 17 },
  { key: 'evening', label: 'Evening (5–9p)', test: (h) => h >= 17 && h < 21 },
  { key: 'late_night', label: 'Late night (9p–5a)', test: (h) => h >= 21 || h < 5 },
];

export function daypartAt(date: Date): Daypart {
  const hour = date.getHours();
  return (DAYPART_DEFS.find((d) => d.test(hour)) ?? DAYPART_DEFS[0]).key;
}

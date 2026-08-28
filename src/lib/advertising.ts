import { DAYPART_DEFS } from '@/lib/daypart';
import type { AdBudgetTier, AdCampaign } from '@/types';

/**
 * F-BIZ-10: whether a venue is *currently* a paid placement is never stored
 * — it's computed here against `now`, the same pattern `venueState` and
 * happy-hour windows already use, because this build has no scheduler that
 * could flip a stored flag the moment a date or daypart boundary passes.
 */

/** Published flat prices. No payment is captured — see AdCampaign's own doc comment. */
export const BUDGET_TIERS: Record<AdBudgetTier, { label: string; priceLabel: string }> = {
  starter: { label: 'Starter', priceLabel: '$49/week' },
  growth: { label: 'Growth', priceLabel: '$99/week' },
  spotlight: { label: 'Spotlight', priceLabel: '$199/week' },
};

export function isCampaignActive(c: AdCampaign, now: Date): boolean {
  const today = now.toISOString().slice(0, 10);
  if (today < c.startsOn || today > c.endsOn) return false;
  if (c.targetDayparts?.length) {
    const hour = now.getHours();
    const daypart = DAYPART_DEFS.find((d) => d.test(hour))?.key;
    if (!daypart || !c.targetDayparts.includes(daypart)) return false;
  }
  return true;
}

/** The campaign making a venue a paid placement right now, if any. */
export function activeCampaign(campaigns: AdCampaign[] | undefined, now: Date): AdCampaign | undefined {
  return campaigns?.find((c) => isCampaignActive(c, now));
}

export function isPromotedNow(campaigns: AdCampaign[] | undefined, now: Date): boolean {
  return activeCampaign(campaigns, now) != null;
}

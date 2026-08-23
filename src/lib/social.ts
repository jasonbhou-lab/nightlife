import { communityById, communityByName, communityCheckIns } from '@/data/community';
import type { CommunityMember, Review, VenueEvent } from '@/types';

/**
 * F-SOCIAL-02's activity feed of followed entities, built from data that
 * already exists (reviews, events, seeded check-ins) rather than a separate
 * feed table. An item can be attributed two ways: to a followed *person*
 * (their review or check-in), or to a followed *venue* (any recommended
 * review or dated event there, regardless of who wrote it).
 */
export type ActivityItem = {
  id: string;
  kind: 'review' | 'checkin' | 'event';
  date: string;
  venueId: string;
  member?: CommunityMember;
  authorName?: string;
  rating?: number;
  text?: string;
  note?: string;
  title?: string;
  reason: 'followed_member' | 'followed_venue';
};

export function buildActivityFeed(input: {
  followedMemberIds: string[];
  followedVenueIds: string[];
  reviews: Review[];
  events: VenueEvent[];
}): ActivityItem[] {
  const { followedMemberIds, followedVenueIds, reviews, events } = input;
  const items: ActivityItem[] = [];

  for (const r of reviews) {
    if (!r.recommended) continue;
    const member = communityByName[r.author];
    const isFollowedMember = !!member && followedMemberIds.includes(member.id);
    const isFollowedVenue = followedVenueIds.includes(r.venueId);
    if (!isFollowedMember && !isFollowedVenue) continue;
    items.push({
      id: `review-${r.id}`,
      kind: 'review',
      date: r.date,
      venueId: r.venueId,
      member: isFollowedMember ? member : undefined,
      authorName: r.author,
      rating: r.rating,
      text: r.text,
      reason: isFollowedMember ? 'followed_member' : 'followed_venue',
    });
  }

  // F-SOCIAL-05: a 'private' check-in never surfaces here, followed or not.
  for (const c of communityCheckIns) {
    if (c.visibility !== 'friends' || !c.memberId) continue;
    if (!followedMemberIds.includes(c.memberId)) continue;
    items.push({
      id: `checkin-${c.id}`,
      kind: 'checkin',
      date: c.date,
      venueId: c.venueId,
      member: communityById[c.memberId],
      note: c.note,
      reason: 'followed_member',
    });
  }

  for (const e of events) {
    if (!e.date || !followedVenueIds.includes(e.venueId)) continue;
    items.push({
      id: `event-${e.id}`,
      kind: 'event',
      date: e.date,
      venueId: e.venueId,
      title: e.title,
      reason: 'followed_venue',
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

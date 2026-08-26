import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Meter, Stars } from '@/components/Stars';
import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
  SectionHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { communityByName } from '@/data/community';
import { reportReview, respondToReview } from '@/data/repository';
import { relativeDate, REPORT_REASON_LABELS } from '@/lib/format';
import {
  aggregateFor, FILTERED_EXPLANATION, RATING_EXPLANATION, subRatingDimensions,
} from '@/lib/ratings';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { ReportReason, Review } from '@/types';

/**
 * All reviews for a venue.
 *
 * F-REVIEW-07 is the structural requirement here: reviews the recommendation
 * software filters out are excluded from the rating and the default view, but
 * they remain reachable behind a disclosed link. The specific rationale for any
 * one review is never shown, because publishing it would be a roadmap for
 * evading the filter.
 */
export default function ReviewsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { now, session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, venueReviews, setReviewOwnerResponse } = useCatalogue();
  const [showFiltered, setShowFiltered] = useState(false);
  const [sort, setSort] = useState<'recent' | 'helpful' | 'high' | 'low'>('recent');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const venue = getVenue(id);
  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Reviews" onBack={() => router.back()} />
      </Screen>
    );
  }

  const all = venueReviews(venue.id, true);
  const agg = aggregateFor(all, now);
  const recommended = all.filter((r) => r.recommended);
  const filtered = all.filter((r) => !r.recommended);
  const dims = subRatingDimensions[venue.primary.vertical];
  const canRespond = isManagingVenue(venue.id);

  const respond = async (reviewId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const result = await respondToReview({ reviewId, text });
    if (!result.ok) return result;
    setReviewOwnerResponse(reviewId, result.response);
    return { ok: true };
  };

  const occasions = useMemo(
    () => Array.from(new Set(recommended.map((r) => r.tags.occasion).filter(Boolean))) as string[],
    [recommended],
  );

  const list = useMemo(() => {
    let l = recommended.slice();
    if (tagFilter) l = l.filter((r) => r.tags.occasion === tagFilter);
    switch (sort) {
      case 'helpful':
        return l.sort((a, b) => b.helpful - a.helpful);
      case 'high':
        return l.sort((a, b) => b.rating - a.rating);
      case 'low':
        return l.sort((a, b) => a.rating - b.rating);
      default:
        return l.sort((a, b) => b.date.localeCompare(a.date));
    }
  }, [recommended, sort, tagFilter]);

  const write = () => {
    attemptContribution();
    if (session.role === 'guest' || session.role === 'registered') {
      Alert.alert('Verification required', 'Writing a review at a venue that serves alcohol requires a verified account.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    router.push({ pathname: '/review/new', params: { id: venue.id } });
  };

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="Reviews" subtitle={venue.name} onBack={() => router.back()} />

      {/* The number, and how it was computed. */}
      <View style={gutter()}>
        <Card>
          <View style={[ui.row, { gap: space.lg }]}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[font.display, { color: theme.text }]}>{venue.rating.toFixed(1)}</Text>
              <Stars value={venue.rating} size={13} />
              <Text style={[font.small, { color: theme.textDim, marginTop: 4 }]}>
                {venue.reviewCount.toLocaleString('en-US')} counted
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const n = agg.distribution[star - 1];
                const pct = agg.count ? n / agg.count : 0;
                return (
                  <View key={star} style={[ui.row, { gap: space.sm, marginBottom: 4 }]}>
                    <Text style={[font.small, { color: theme.textDim, width: 10 }]}>{star}</Text>
                    <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.cardMuted }}>
                      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 3, backgroundColor: theme.star }} />
                    </View>
                    <Text style={[font.small, { color: theme.textFaint, width: 22, textAlign: 'right' }]}>{n}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <Text style={[font.small, { color: theme.textFaint, marginTop: space.md }]}>
            Distribution shown across the {agg.count} reviews loaded here. The headline rating is
            computed across the venue&apos;s full corpus using the weighting below.
          </Text>

          <Divider style={{ marginVertical: space.md }} />
          <Pressable
            onPress={() => Alert.alert('How this number is calculated', RATING_EXPLANATION)}
            accessibilityRole="button"
            accessibilityLabel="How this rating is calculated"
            style={[ui.row, { gap: 6, minHeight: 40 }]}
          >
            <Ionicons name="information-circle" size={16} color={theme.accent} />
            <Text style={[font.small, { color: theme.accent, flex: 1 }]}>
              Not a plain average. See how it is calculated.
            </Text>
          </Pressable>
        </Card>
      </View>

      {Object.keys(venue.subRatingAverages).length ? (
        <View style={gutter()}>
          <SectionHeader title="Rated on" />
          <Card>
            {dims.map((d) => {
              const v = venue.subRatingAverages[d.key];
              return v == null ? null : <Meter key={d.key} label={d.label} value={v} />;
            })}
          </Card>
        </View>
      ) : null}

      {/* Sort and structured-tag filtering — the reason tags are worth collecting. */}
      <View style={[gutter(), { gap: space.sm }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {([['recent', 'Most recent'], ['helpful', 'Most helpful'], ['high', 'Highest'], ['low', 'Lowest']] as const).map(
            ([k, label]) => (
              <Chip key={k} label={label} tone="ground" selected={sort === k} onPress={() => setSort(k)} />
            ),
          )}
        </View>
        {occasions.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {occasions.map((o) => (
              <Chip
                key={o}
                label={o}
                tone="ground"
                selected={tagFilter === o}
                onPress={() => setTagFilter(tagFilter === o ? null : o)}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={gutter()}>
        {list.map((r) => (
          <ReviewCard key={r.id} review={r} now={now} canRespond={canRespond} onRespond={respond} />
        ))}
        {list.length === 0 ? (
          <Card>
            <Body dim>No reviews match that tag. Clear it to see all {recommended.length}.</Body>
            <Button label="Clear tag" variant="secondary" style={{ marginTop: space.md }} onPress={() => setTagFilter(null)} />
          </Card>
        ) : null}
      </View>

      {/* Disclosed link to filtered reviews. */}
      {filtered.length ? (
        <View style={gutter()}>
          <Card>
            <Text style={[font.cardTitle, { color: theme.text }]}>
              {filtered.length} {filtered.length === 1 ? 'review is' : 'reviews are'} not recommended
            </Text>
            <Body dim style={{ marginTop: space.sm }}>{FILTERED_EXPLANATION}</Body>
            <Button
              label={showFiltered ? 'Hide them' : 'Read them anyway'}
              variant="secondary"
              full
              style={{ marginTop: space.md }}
              onPress={() => setShowFiltered((s) => !s)}
            />
          </Card>
          {showFiltered ? (
            <View style={{ marginTop: space.md }}>
              {filtered.map((r) => (
                <ReviewCard key={r.id} review={r} now={now} notCounted canRespond={canRespond} onRespond={respond} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Policy notes that are enforced, not just stated. */}
      <View style={gutter()}>
        <SectionHeader title="Review policy" />
        <Card style={{ gap: space.md }}>
          <PolicyRow
            icon="funnel-outline"
            title="No review gating"
            body="A venue cannot solicit reviews only from happy customers. Owner tools have no mechanism for it, and off-platform gating patterns are detected and actioned."
          />
          <Divider />
          <PolicyRow
            icon="gift-outline"
            title="Comped visits must be disclosed"
            body="Paid reviews are prohibited outright. A hosted or comped visit has to be disclosed and carries a badge on the review."
          />
          <Divider />
          <PolicyRow
            icon="people-outline"
            title="No self, staff, or competitor reviews"
            body="Accounts holding a business role at a venue cannot review it, and cannot review competitors in the same category and radius."
          />
          <Divider />
          <PolicyRow
            icon="trending-up-outline"
            title="Burst detection"
            body="An unusual spike in reviews temporarily freezes contribution on the listing while it is checked."
          />
        </Card>
      </View>

      <View style={gutter()}>
        <Button label="Write a review" icon="create" variant="onGround" full onPress={write} />
      </View>
    </Screen>
  );
}

function ReviewCard({
  review: r,
  now,
  notCounted,
  canRespond,
  onRespond,
}: {
  review: Review;
  now: Date;
  notCounted?: boolean;
  canRespond?: boolean;
  onRespond?: (reviewId: string, text: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { session, attemptContribution } = useApp();
  const [voted, setVoted] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(r.ownerResponse?.text ?? '');
  const [posting, setPosting] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const member = communityByName[r.author];

  const postResponse = async () => {
    if (!onRespond) return;
    setPosting(true);
    setRespondError(null);
    const result = await onRespond(r.id, draft.trim());
    setPosting(false);
    if (!result.ok) {
      setRespondError(result.error);
      return;
    }
    setComposing(false);
  };

  /**
   * F-REVIEW-10 / F-TRUST-01. This used to be a local Alert.alert with no
   * submission at all — the reasons below existed but nothing was ever sent
   * anywhere. Reporting only needs a signed-in account, not a verified one
   * (see reportReview's own comment): a safety action should not sit behind
   * the same wall as writing content.
   */
  const openReport = () => {
    if (session.role === 'guest') {
      attemptContribution();
      Alert.alert('Sign in required', 'Reporting a review needs an account.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    if (reported) {
      Alert.alert('Already reported', 'You already reported this review — it is in the moderation queue.');
      return;
    }
    Alert.alert(
      'Report this review',
      'Pick the reason that fits',
      [
        ...(Object.entries(REPORT_REASON_LABELS) as [ReportReason, string][]).map(([reason, label]) => ({
          text: label,
          onPress: async () => {
            const result = await reportReview({ reviewId: r.id, reason });
            if (result.ok) {
              setReported(true);
              Alert.alert('Reported', 'Thanks — this has been sent to the moderation queue.');
            } else {
              Alert.alert('Could not report this', result.error);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  return (
    <Card style={{ marginBottom: space.md, opacity: notCounted ? 0.86 : 1 }}>
      {notCounted ? (
        <View style={{ marginBottom: space.md }}>
          <Callout tone="warn" icon="eye-off" title="Not counted in the rating" />
        </View>
      ) : null}

      <View style={[ui.row, { alignItems: 'flex-start' }]}>
        <IconBadge icon="person" size={38} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <View style={[ui.row, { gap: space.sm, flexWrap: 'wrap' }]}>
            {member ? (
              <Pressable onPress={() => router.push(`/community/${member.id}`)} hitSlop={4}>
                <Text style={[font.bodyStrong, { color: theme.accent, textDecorationLine: 'underline' }]}>
                  {r.author}
                </Text>
              </Pressable>
            ) : (
              <Text style={[font.bodyStrong, { color: theme.text }]}>{r.author}</Text>
            )}
            {r.elite ? (
              <View style={{ backgroundColor: theme.accentSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={[font.micro, { color: theme.accentSoftText }]}>ELITE</Text>
              </View>
            ) : null}
          </View>
          <View style={[ui.row, { gap: space.sm, marginTop: 2 }]}>
            <Stars value={r.rating} size={12} />
            <Text style={[font.small, { color: theme.textFaint }]}>
              {relativeDate(r.date, now)}
              {r.edited ? ' · edited' : ''}
            </Text>
          </View>
        </View>
      </View>

      {r.comped ? (
        <View style={{ marginTop: space.sm }}>
          <Callout tone="warn" icon="gift" title="Comped or hosted visit, disclosed" />
        </View>
      ) : null}

      <Body style={{ marginTop: space.md }}>{r.text}</Body>

      {Object.keys(r.subRatings).length ? (
        <View style={{ marginTop: space.md, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {Object.entries(r.subRatings).map(([k, v]) => (
            <View
              key={k}
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 3,
                borderRadius: radius.sm,
                backgroundColor: theme.cardMuted,
              }}
            >
              <Text style={[font.small, { color: theme.textDim }]}>
                {k.replace(/([A-Z])/g, ' $1').toLowerCase()} {v}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
        {r.tags.occasion ? <Chip label={r.tags.occasion} /> : null}
        {r.tags.partySize ? <Chip label={`Party of ${r.tags.partySize}`} /> : null}
        {r.tags.timeOfVisit ? <Chip label={r.tags.timeOfVisit} /> : null}
        {r.tags.waitMinutes != null ? (
          <Chip label={r.tags.waitMinutes === 0 ? 'No wait' : `${r.tags.waitMinutes} min wait`} />
        ) : null}
        {r.tags.coverPaid != null ? (
          <Chip label={r.tags.coverPaid === 0 ? 'No cover' : `$${r.tags.coverPaid} cover`} />
        ) : null}
        {r.tags.spendRange ? <Chip label={r.tags.spendRange} /> : null}
        {r.photoCount ? <Chip label={`${r.photoCount} photos`} icon="image" /> : null}
      </View>

      {r.ownerResponse && !composing ? (
        <View style={{ marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: theme.cardMuted }}>
          <View style={[ui.row, { gap: 5, marginBottom: 4 }]}>
            <Ionicons name="checkmark-circle" size={13} color={theme.accent} />
            <Text style={[font.small, { color: theme.accent, flex: 1 }]}>
              Response from the owner · {relativeDate(r.ownerResponse.date, now)}
            </Text>
          </View>
          <Body dim>{r.ownerResponse.text}</Body>
        </View>
      ) : null}

      {/* F-BIZ-07, scoped: a business account managing this venue can post or
          edit the owner response here. Everyone else never sees this. */}
      {canRespond && !composing ? (
        <Button
          label={r.ownerResponse ? 'Edit response' : 'Respond as owner'}
          variant="ghost"
          icon={r.ownerResponse ? 'create-outline' : 'chatbox-ellipses-outline'}
          style={{ marginTop: space.md, alignSelf: 'flex-start' }}
          onPress={() => {
            setDraft(r.ownerResponse?.text ?? '');
            setRespondError(null);
            setComposing(true);
          }}
        />
      ) : null}

      {canRespond && composing ? (
        <View style={{ marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: theme.cardMuted }}>
          <Label>Response from the owner</Label>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Thanks for the visit — here's our side..."
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Owner response"
            multiline
            style={[
              font.body,
              {
                color: theme.text,
                backgroundColor: theme.card,
                borderRadius: radius.md,
                padding: space.md,
                marginTop: space.sm,
                minHeight: 80,
                textAlignVertical: 'top',
              },
            ]}
          />
          {respondError ? (
            <Text style={[font.small, { color: theme.closed, marginTop: space.sm }]}>{respondError}</Text>
          ) : null}
          <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
            <Button
              label={r.ownerResponse ? 'Save' : 'Post response'}
              loading={posting}
              disabled={!draft.trim()}
              onPress={postResponse}
            />
            <Button label="Cancel" variant="ghost" onPress={() => setComposing(false)} />
          </View>
        </View>
      ) : null}

      <Divider style={{ marginVertical: space.md }} />

      {/* No downvote mechanic, per F-REVIEW-06. */}
      <View style={[ui.row, { gap: space.lg }]}>
        {([['helpful', 'Helpful', 'thumbs-up-outline'], ['insightful', 'Insightful', 'bulb-outline'], ['funny', 'Funny', 'happy-outline']] as const).map(
          ([key, label, icon]) => {
            const base = key === 'helpful' ? r.helpful : key === 'insightful' ? r.insightful : r.funny;
            const on = voted === key;
            return (
              <Pressable
                key={key}
                onPress={() => setVoted(on ? null : key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Mark as ${label}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40 }}
              >
                <Ionicons name={icon} size={15} color={on ? theme.accent : theme.textFaint} />
                <Text style={[font.small, { color: on ? theme.accent : theme.textDim }]}>
                  {label} {base + (on ? 1 : 0)}
                </Text>
              </Pressable>
            );
          },
        )}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={openReport}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={reported ? 'Already reported' : 'Report this review'}
        >
          <Ionicons name={reported ? 'flag' : 'flag-outline'} size={15} color={reported ? theme.accent : theme.textFaint} />
        </Pressable>
      </View>
    </Card>
  );
}

function PolicyRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const theme = useTheme();
  return (
    <View style={[ui.row, { gap: space.md, alignItems: 'flex-start' }]}>
      <Ionicons name={icon} size={18} color={theme.accent} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[font.bodyStrong, { color: theme.text }]}>{title}</Text>
        <Body dim style={{ marginTop: 2 }}>{body}</Body>
      </View>
    </View>
  );
}

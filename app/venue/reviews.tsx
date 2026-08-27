import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Stars } from '@/components/Stars';
import {
  Body, Button, Callout, Card, Chip, Divider, gutter, Label, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { respondToReview, setVenueReviewAlertThreshold } from '@/data/repository';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Review } from '@/types';

const THRESHOLD_OPTIONS = [1, 2, 3, 4] as const;

/**
 * F-BIZ-07, the remaining half: alerting on new reviews below a threshold.
 * The response composer itself has existed since 20260825150000_add_review_response.sql
 * (see app/reviews/[id].tsx) — what was missing was any way for a business
 * account to know a low-rated review needed one without reading every review
 * at the venue. See the migration header on 20260827120000_add_review_alerts.sql
 * for why sentiment summary and keyword themes stay out of scope.
 */
export default function VenueReviewsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, now, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, venueReviews, setReviewOwnerResponse, setVenueReviewAlertThreshold: setLocalThreshold } = useCatalogue();

  const venue = getVenue(venueId);
  const [thresholdBusy, setThresholdBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Reviews" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Reviews" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Managing reviews needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Reviews" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can manage its reviews.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const threshold = venue.reviewAlertThreshold;
  const all = venueReviews(venue.id, true);
  const needsResponse = all
    .filter((r) => threshold != null && r.rating <= threshold && !r.ownerResponse)
    .sort((a, b) => a.date.localeCompare(b.date));

  const applyThreshold = async (next: number | null) => {
    setThresholdBusy(true);
    setError(null);
    const result = await setVenueReviewAlertThreshold({ venueId: venue.id, threshold: next });
    setThresholdBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLocalThreshold(venue.id, next ?? undefined);
  };

  const startResponse = (r: Review) => {
    setDraft(r.ownerResponse?.text ?? '');
    setError(null);
    setExpandedId(r.id);
  };

  const postResponse = async (reviewId: string) => {
    setPosting(true);
    setError(null);
    const result = await respondToReview({ reviewId, text: draft.trim() });
    setPosting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReviewOwnerResponse(reviewId, result.response);
    setExpandedId(null);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Reviews" subtitle={venue.name} onBack={() => router.back()} />

      {error ? (
        <View style={gutter()}>
          <Text style={[font.small, { color: theme.closed }]}>{error}</Text>
        </View>
      ) : null}

      <View style={gutter()}>
        <Label>Alert threshold</Label>
        <Card style={{ marginTop: space.sm }}>
          <Body dim>
            Surface a review here when it comes in at or below this rating and hasn't been
            responded to yet.
          </Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
            <Chip
              label="Off"
              tone="ground"
              selected={threshold == null}
              onPress={() => !thresholdBusy && applyThreshold(null)}
            />
            {THRESHOLD_OPTIONS.map((n) => (
              <Chip
                key={n}
                label={`${n} star${n === 1 ? '' : 's'} or below`}
                tone="ground"
                selected={threshold === n}
                onPress={() => !thresholdBusy && applyThreshold(n)}
              />
            ))}
          </View>
        </Card>
      </View>

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>
          Needs a response{needsResponse.length ? ` (${needsResponse.length})` : ''}
        </Text>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {threshold == null ? (
            <Body dim style={{ padding: space.lg }}>Turn on an alert threshold above to see reviews here.</Body>
          ) : needsResponse.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>Nothing needs a response right now.</Body>
          ) : (
            needsResponse.map((r, i) => {
              const open = expandedId === r.id;
              return (
                <View key={r.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: space.lg, gap: space.sm }}>
                    <View style={[ui.row, { gap: space.sm }]}>
                      <Stars value={r.rating} size={13} />
                      <Text style={[font.small, { color: theme.textFaint, flex: 1 }]}>
                        {r.author} · {relativeDate(r.date, now)}
                      </Text>
                    </View>
                    <Body numberOfLines={open ? undefined : 2}>{r.text}</Body>
                    {!open ? (
                      <Button
                        label="Respond"
                        variant="ghost"
                        icon="chatbox-ellipses-outline"
                        style={{ alignSelf: 'flex-start' }}
                        onPress={() => startResponse(r)}
                      />
                    ) : (
                      <View style={{ marginTop: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: theme.cardMuted }}>
                        <Label>Response from the owner</Label>
                        <TextInput
                          value={draft}
                          onChangeText={setDraft}
                          placeholder="Thanks for the feedback — here's our side..."
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
                        <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
                          <Button
                            label="Post response"
                            loading={posting}
                            disabled={!draft.trim()}
                            onPress={() => postResponse(r.id)}
                          />
                          <Button label="Cancel" variant="ghost" onPress={() => setExpandedId(null)} />
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </View>

      <View style={gutter()}>
        <Button
          label="See all reviews"
          variant="secondary"
          full
          icon="list-outline"
          onPress={() => router.push(`/reviews/${venue.id}`)}
        />
      </View>
    </Screen>
  );
}

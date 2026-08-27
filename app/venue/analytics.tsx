import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Meter } from '@/components/Stars';
import {
  Body, Callout, Card, gutter, Screen, ScreenHeader, SectionHeader,
} from '@/components/ui';
import { competitorBenchmark, ratingTrend, summarizeEvents } from '@/lib/analytics';
import { useCatalogue } from '@/data/catalogue';
import { getVenueEvents } from '@/data/repository';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { VenueAnalyticsEvent, VenueEventKind } from '@/types';

const CLICK_LABELS: Record<Exclude<VenueEventKind, 'view'>, string> = {
  click_call: 'Call',
  click_directions: 'Directions',
  click_book: 'Reserve / book',
};

/**
 * F-BIZ-08, scoped: profile views, click-throughs by action, traffic by
 * daypart, a rating trend, and a category/neighborhood rating benchmark.
 * No search impressions, no full conversion funnel, no website or order
 * click-through, no view-count competitor benchmarking — see the migration
 * header on 20260827130000_add_venue_analytics.sql for why each is cut.
 */
export default function VenueAnalyticsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, now, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, venueReviews, venues } = useCatalogue();

  const venue = getVenue(venueId);
  const [events, setEvents] = useState<VenueAnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  const load = useCallback(() => {
    if (!venue) return;
    setLoading(true);
    getVenueEvents(venue.id)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [venue?.id]);

  useEffect(() => {
    if (venue && isManagingVenue(venue.id)) load();
    else setLoading(false);
  }, [venue?.id]);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Analytics" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Analytics" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Viewing analytics needs an account. Reading and browsing do not.</Body>
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Analytics" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can see its analytics.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Analytics" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card><Body dim>Loading…</Body></Card>
        </View>
      </Screen>
    );
  }

  const summary = summarizeEvents(events, now);
  const trend = ratingTrend(venueReviews(venue.id, true), now);
  const benchmark = competitorBenchmark(venue, venues);

  const last14Days = summary.viewsByDay.reduce((sum, d) => sum + d.count, 0);
  const maxClick = Math.max(1, ...Object.values(summary.clicksByKind));
  const maxDaypart = Math.max(1, ...summary.viewsByDaypart.map((d) => d.count));
  const maxRatingCount = Math.max(1, ...trend.map((t) => t.count));

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="Analytics" subtitle={venue.name} onBack={() => router.back()} />

      <View style={gutter()}>
        <SectionHeader title="Profile views" />
        <Card>
          <Text style={[font.display, { color: theme.text }]}>{summary.totalViews.toLocaleString('en-US')}</Text>
          <Body dim style={{ marginTop: 2 }}>
            all-time views logged · {last14Days.toLocaleString('en-US')} in the last 14 days
          </Body>
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Click-throughs by action" />
        <Card>
          {(Object.keys(CLICK_LABELS) as (keyof typeof CLICK_LABELS)[]).map((kind) => (
            <Meter
              key={kind}
              label={CLICK_LABELS[kind]}
              value={summary.clicksByKind[kind] ?? 0}
              max={maxClick}
              right={String(summary.clicksByKind[kind] ?? 0)}
            />
          ))}
          <Body dim style={{ marginTop: space.sm }}>
            No click-through for a website link (none is shown on a listing yet) or for ordering
            (F-ORDER is not built).
          </Body>
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Traffic by daypart" />
        <Card>
          {summary.viewsByDaypart.map((d) => (
            <Meter key={d.label} label={d.label} value={d.count} max={maxDaypart} right={String(d.count)} />
          ))}
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Rating trend" />
        <Card>
          {trend.map((t) => (
            <Meter
              key={t.label}
              label={t.label}
              value={t.avg}
              max={5}
              right={t.count ? `${t.avg.toFixed(1)} (${t.count})` : '—'}
            />
          ))}
          <Body dim style={{ marginTop: space.sm }}>
            Monthly average of recommended reviews only — the same basis the public rating uses.
          </Body>
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Compared to nearby competitors" />
        <Card>
          {benchmark.medianRating == null ? (
            <Body dim>
              Not enough other {venue.primary.category.toLowerCase()} venues in {venue.neighborhood} yet
              to benchmark against anonymously.
            </Body>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: space.xl }}>
                <View>
                  <Text style={[font.small, { color: theme.textFaint }]}>This venue</Text>
                  <Text style={[font.display, { color: theme.text }]}>{benchmark.venueRating.toFixed(1)}</Text>
                </View>
                <View>
                  <Text style={[font.small, { color: theme.textFaint }]}>
                    Category median in {venue.neighborhood}
                  </Text>
                  <Text style={[font.display, { color: theme.text }]}>{benchmark.medianRating.toFixed(1)}</Text>
                </View>
              </View>
              <Body dim style={{ marginTop: space.md }}>
                Across {benchmark.peerCount} other {venue.primary.category.toLowerCase()} venues in the same
                neighborhood. No individual competitor is ever identified.
              </Body>
            </>
          )}
        </Card>
      </View>
    </Screen>
  );
}

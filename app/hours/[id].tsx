import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  Body, Callout, Card, Divider, gutter, Label, Screen, ScreenHeader, SectionHeader, styles as ui,
} from '@/components/ui';
import { getVenue } from '@/data/venues';
import { relativeDate } from '@/lib/format';
import {
  DAY_LABELS_LONG, activeHappyHour, formatDuration, formatRange, formatTime, kitchenGap, retailGap,
  scheduleState,
} from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

/**
 * Full-week hours (F-PROFILE-06).
 *
 * Each schedule is rendered as its own labeled table rather than merged into one
 * range. Merging is how a general-purpose platform ends up telling someone the
 * kitchen is open at 11 PM because the bar is.
 */
export default function HoursScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { now } = useApp();
  const venue = getVenue(id);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Hours" onBack={() => router.back()} />
      </Screen>
    );
  }

  const today = now.getDay();
  const hh = activeHappyHour(venue, now);

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="Hours" subtitle={venue.name} onBack={() => router.back()} />

      {kitchenGap(venue, now) ? (
        <View style={gutter()}>
          <Callout tone="warn" icon="restaurant" title="Kitchen closes before the bar">
            <Body dim>{kitchenGap(venue, now)}</Body>
          </Callout>
        </View>
      ) : null}

      {retailGap(venue, now) ? (
        <View style={gutter()}>
          <Callout tone="warn" icon="cube" title="Retail closes before the lounge">
            <Body dim>{retailGap(venue, now)}</Body>
          </Callout>
        </View>
      ) : null}

      {venue.schedules.map((s) => {
        const state = scheduleState(s, now);
        return (
          <View key={s.kind} style={gutter()}>
            <SectionHeader title={s.label} subtitle={state.label} />
            <Card>
              {s.days.map((d, i) => (
                <View key={i}>
                  {i > 0 ? <Divider /> : null}
                  <View style={[ui.row, { paddingVertical: space.sm, minHeight: 40 }]}>
                    <Text
                      style={[
                        i === today ? font.bodyStrong : font.body,
                        { color: i === today ? theme.text : theme.textDim, flex: 1 },
                      ]}
                    >
                      {DAY_LABELS_LONG[i]}
                      {i === today ? ' · today' : ''}
                    </Text>
                    <Text
                      style={[
                        i === today ? font.bodyStrong : font.body,
                        { color: d ? (i === today ? theme.text : theme.textDim) : theme.textFaint },
                      ]}
                    >
                      {d ? formatRange(d.open, d.close) : 'Closed'}
                    </Text>
                  </View>
                </View>
              ))}
              <Divider style={{ marginTop: space.sm }} />
              <Text style={[font.small, { color: theme.textFaint, marginTop: space.sm }]}>
                Ranges that end earlier than they start cross midnight. Last confirmed{' '}
                {relativeDate(s.updatedAt, now)}; hours expire after 90 days and are re-solicited.
              </Text>
            </Card>
          </View>
        );
      })}

      {/* Happy hour windows, with time remaining where one is live. */}
      {venue.happyHours?.length ? (
        <View style={gutter()}>
          <SectionHeader
            title="Happy hour"
            subtitle={hh ? `Running now, ${formatDuration(hh.minutesLeft)} left` : 'Not running right now'}
          />
          <Card>
            {venue.happyHours.map((w, i) => (
              <View key={`${w.start}-${i}`}>
                {i > 0 ? <Divider style={{ marginVertical: space.md }} /> : null}
                <View style={[ui.row, { gap: space.md }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.bodyStrong, { color: theme.text }]}>
                      {w.days.map((d) => DAY_LABELS_LONG[d].slice(0, 3)).join(', ')}
                    </Text>
                    <Text style={[font.meta, { color: theme.textDim, marginTop: 2 }]}>{w.summary}</Text>
                  </View>
                  <Text style={[font.body, { color: theme.text }]}>
                    {formatTime(w.start)} – {formatTime(w.end)}
                  </Text>
                </View>
              </View>
            ))}
            <Divider style={{ marginVertical: space.md }} />
            <Label>Note on promotions</Label>
            <Body dim style={{ marginTop: 4 }}>
              Drink-price promotions are regulated differently state by state, and some states
              restrict how reduced pricing may be advertised at all. Windows and terms here are as
              published by the venue, and the offers system is built to enforce per-jurisdiction
              rules rather than one national template.
            </Body>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Body, Button, Card, Chip, EmptyState, gutter, IconBadge, Label, Screen, ScreenHeader,
  SectionHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { DAY_LABELS, DAY_LABELS_LONG, formatTime } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

/**
 * Event discovery (F-EVENT-02): filterable by date, genre, neighborhood, cover,
 * and age policy. Recurring weekly programming is folded into whichever day it
 * lands on rather than living in a separate list, because to a person deciding
 * what to do tonight, "trivia every Tuesday" and "a touring DJ on the 29th" are
 * the same kind of answer.
 */
export default function EventsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { now, session } = useApp();
  const { events, venueById } = useCatalogue();

  const [dayOffset, setDayOffset] = useState(0);
  const [genre, setGenre] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [neighborhood, setNeighborhood] = useState<string | null>(null);
  const [ageFilter, setAgeFilter] = useState<string | null>(null);
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());

  const days = useMemo(() => {
    const out: { offset: number; label: string; dow: number; iso: string }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      out.push({
        offset: i,
        label: i === 0 ? 'Tonight' : i === 1 ? 'Tomorrow' : DAY_LABELS[d.getDay()],
        dow: d.getDay(),
        iso: d.toISOString().slice(0, 10),
      });
    }
    return out;
  }, [now]);

  const day = days[dayOffset];

  const onDay = useMemo(
    () => events.filter((e) => (e.recurring ? e.weekday === day.dow : e.date === day.iso)),
    [events, day],
  );

  const genres = useMemo(
    () => Array.from(new Set(events.map((e) => e.genre).filter(Boolean))) as string[],
    [events],
  );
  const neighborhoods = useMemo(
    () => Array.from(new Set(events.map((e) => venueById[e.venueId]?.neighborhood).filter(Boolean))) as string[],
    [events, venueById],
  );

  const filtered = useMemo(
    () =>
      onDay.filter((e) => {
        if (genre && e.genre !== genre) return false;
        if (freeOnly && (e.cover ?? 0) > 0) return false;
        if (neighborhood && venueById[e.venueId]?.neighborhood !== neighborhood) return false;
        if (ageFilter && !(e.agePolicy ?? '').includes(ageFilter)) return false;
        return true;
      }),
    [onDay, genre, freeOnly, neighborhood, ageFilter],
  );

  const toggleRsvp = (id: string) =>
    setRsvps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const activeFilters = [genre, freeOnly ? 'free' : null, neighborhood, ageFilter].filter(Boolean).length;

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title="Events"
        subtitle={`${events.filter((e) => e.recurring).length} weekly, ${events.filter((e) => !e.recurring).length} one-off`}
        onBack={() => router.back()}
      />

      {/* Date. */}
      <View style={[gutter(), { gap: space.sm }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {days.map((d) => (
            <Chip
              key={d.offset}
              label={d.label}
              tone="ground"
              selected={dayOffset === d.offset}
              onPress={() => setDayOffset(d.offset)}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label="No cover" tone="ground" selected={freeOnly} onPress={() => setFreeOnly((f) => !f)} />
          {(['18+', '21+'] as const).map((a) => (
            <Chip
              key={a}
              label={a}
              tone="ground"
              selected={ageFilter === a}
              onPress={() => setAgeFilter(ageFilter === a ? null : a)}
            />
          ))}
          {genres.map((g) => (
            <Chip key={g} label={g} tone="ground" selected={genre === g} onPress={() => setGenre(genre === g ? null : g)} />
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {neighborhoods.map((n) => (
            <Chip
              key={n}
              label={n}
              tone="ground"
              selected={neighborhood === n}
              onPress={() => setNeighborhood(neighborhood === n ? null : n)}
            />
          ))}
        </View>
      </View>

      <View style={gutter()}>
        <SectionHeader
          title={day.offset === 0 ? 'Tonight' : DAY_LABELS_LONG[day.dow]}
          subtitle={`${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`}
          actionLabel={activeFilters ? 'Clear' : undefined}
          onAction={
            activeFilters
              ? () => {
                  setGenre(null);
                  setFreeOnly(false);
                  setNeighborhood(null);
                  setAgeFilter(null);
                }
              : undefined
          }
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nothing matches on this day"
            body={
              activeFilters
                ? 'Clear the filters to see everything programmed for this day, or try another day.'
                : 'No events are programmed for this day. Weekly programming is heaviest Tuesday through Saturday.'
            }
            actionLabel={activeFilters ? 'Clear filters' : 'Try tonight'}
            onAction={() => {
              if (activeFilters) {
                setGenre(null);
                setFreeOnly(false);
                setNeighborhood(null);
                setAgeFilter(null);
              } else {
                setDayOffset(0);
              }
            }}
          />
        ) : (
          filtered.map((e) => {
            const v = venueById[e.venueId];
            const going = rsvps.has(e.id);
            return (
              <Card key={e.id} style={{ marginBottom: space.md }}>
                <View style={[ui.row, { alignItems: 'flex-start' }]}>
                  <IconBadge icon={e.recurring ? 'repeat' : 'star'} size={46} variant={e.recurring ? 'soft' : 'solid'} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={[font.cardTitle, { color: theme.text }]}>{e.title}</Text>
                    <Pressable
                      onPress={() => router.push(`/venue/${e.venueId}`)}
                      accessibilityRole="link"
                      accessibilityLabel={`Open ${v?.name}`}
                      style={{ minHeight: 24, justifyContent: 'center' }}
                    >
                      <Text style={[font.meta, { color: theme.accent }]} numberOfLines={1}>
                        {v?.name} · {v?.neighborhood}
                      </Text>
                    </Pressable>
                    <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]}>
                      {e.recurring ? `Every ${DAY_LABELS_LONG[e.weekday ?? 0]}` : e.date} ·{' '}
                      {formatTime(e.start)} to {formatTime(e.end)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[font.cardTitle, { color: e.cover ? theme.text : theme.open }]}>
                      {e.cover ? `$${e.cover}` : 'Free'}
                    </Text>
                    {e.recurring ? (
                      <Text style={[font.micro, { color: theme.textFaint }]}>WEEKLY</Text>
                    ) : null}
                  </View>
                </View>

                <Body dim style={{ marginTop: space.md }}>{e.description}</Body>

                {e.lineup?.length ? (
                  <View style={{ marginTop: space.md }}>
                    <Label>Lineup</Label>
                    <Text style={[font.body, { color: theme.text, marginTop: 2 }]}>{e.lineup.join(' · ')}</Text>
                  </View>
                ) : null}

                <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
                  {e.genre ? <Chip label={e.genre} /> : null}
                  {e.agePolicy ? <Chip label={e.agePolicy} icon="card" /> : null}
                </View>

                <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
                  <Button
                    label={going ? 'Interested' : 'I’m interested'}
                    icon={going ? 'checkmark' : 'add'}
                    variant={going ? 'primary' : 'secondary'}
                    onPress={() => toggleRsvp(e.id)}
                  />
                  {e.ticketUrl ? (
                    <Button
                      label="Tickets"
                      icon="ticket"
                      variant="ghost"
                      onPress={() =>
                        router.push(`/venue/${e.venueId}`)
                      }
                    />
                  ) : null}
                </View>

                {going ? (
                  <View
                    style={{
                      marginTop: space.md,
                      padding: space.md,
                      borderRadius: radius.md,
                      backgroundColor: theme.cardMuted,
                    }}
                  >
                    <Text style={[font.small, { color: theme.textDim, lineHeight: 16 }]}>
                      Private by default — nobody sees this but you. You will be notified if the
                      lineup changes or the event is cancelled.
                    </Text>
                  </View>
                ) : null}

                {e.ticketUrl ? (
                  <View style={[ui.row, { gap: 5, marginTop: space.sm }]}>
                    <Ionicons name="open-outline" size={12} color={theme.textFaint} />
                    <Text style={[font.small, { color: theme.textFaint }]}>
                      Ticketing is handled by a partner, not by NightOut
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </View>

      {session.role === 'guest' && rsvps.size ? (
        <View style={gutter()}>
          <Card>
            <Body dim>
              Your interest is held on this device only. Sign in to be notified about lineup changes
              and cancellations.
            </Body>
            <Button label="Sign in" variant="secondary" style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

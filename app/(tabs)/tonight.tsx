import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { VenueCard } from '@/components/VenueCard';
import {
  Body, Card, Chip, gutter, HeroCard, IconBadge, Label, Screen, ScreenHeader, SectionHeader,
  styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { BAR_LOUNGE_TIEBREAK, verticalMeta } from '@/data/taxonomy';
import { verticalsOf } from '@/lib/search';
import {
  activeHappyHour, formatDuration, formatTime, upcomingHappyHour, venueState,
} from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Venue, Vertical } from '@/types';

/**
 * Tonight Mode (F-SEARCH-07, PRD 5.1).
 *
 * The deliberate departure from a general-purpose review app. It is time-aware
 * and location-aware, defaults to venues open now or opening within two hours,
 * and reorders its module stack by time of day: dinner and happy hour forward
 * before 9 PM; bar, lounge, and cigar forward from 9 to 11; nightclub and
 * late-night forward after 11.
 *
 * Happy hour is surfaced with the time remaining in the window rather than as a
 * flag, because "ends in 25 minutes" changes the decision and "has happy hour"
 * does not.
 */

type ModuleKey = 'happyHour' | 'dinner' | 'bars' | 'lounges' | 'cigar' | 'clubs' | 'lateFood' | 'openingSoon' | 'programming';

function moduleOrder(hour: number): ModuleKey[] {
  if (hour >= 5 && hour < 21) {
    return ['happyHour', 'dinner', 'programming', 'bars', 'lounges', 'cigar', 'clubs', 'openingSoon'];
  }
  if (hour >= 21 && hour < 23) {
    return ['bars', 'lounges', 'cigar', 'programming', 'clubs', 'happyHour', 'lateFood', 'openingSoon'];
  }
  // 23:00 through 05:00
  return ['clubs', 'lateFood', 'lounges', 'programming', 'bars', 'cigar', 'openingSoon'];
}

export default function TonightScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { now, clockOverride, setClockOverride } = useApp();
  const { venues, events, venueById } = useCatalogue();

  const hour = now.getHours();
  const order = moduleOrder(hour);

  const live = useMemo(() => venues.filter((v) => !v.closure), [venues]);
  const openNow = useMemo(() => live.filter((v) => venueState(v, now).open), [live, now]);
  const openingSoon = useMemo(
    () => live.filter((v) => { const s = venueState(v, now); return !s.open && s.openingSoon; }),
    [live, now],
  );

  const happy = useMemo(
    () =>
      live
        .map((v) => ({ v, hh: activeHappyHour(v, now) }))
        .filter((x): x is { v: Venue; hh: NonNullable<ReturnType<typeof activeHappyHour>> } => x.hh != null)
        .sort((a, b) => a.hh.minutesLeft - b.hh.minutesLeft),
    [live, now],
  );

  const upcomingHappy = useMemo(
    () =>
      live
        .map((v) => ({ v, hh: upcomingHappyHour(v, now) }))
        .filter((x): x is { v: Venue; hh: NonNullable<ReturnType<typeof upcomingHappyHour>> } => x.hh != null)
        .sort((a, b) => a.hh.minutesUntil - b.hh.minutesUntil)
        .slice(0, 2),
    [live, now],
  );

  /**
   * PRD Open Question 8, the Bar/Lounge tiebreak. Dual-assigned venues surface
   * under Bar before 11 PM and under Lounge after, because dwell rises later.
   */
  const inVertical = (v: Venue, want: Vertical): boolean => {
    const has = verticalsOf(v);
    if (!has.includes(want)) return false;
    const dual = has.includes('bar') && has.includes('lounge');
    if (!dual || (want !== 'bar' && want !== 'lounge')) return true;
    const lateNight = hour >= 23 || hour < 5;
    return want === 'lounge' ? lateNight : !lateNight;
  };

  const byVertical = (want: Vertical) =>
    openNow.filter((v) => inVertical(v, want)).sort((a, b) => b.rating - a.rating - (a.distanceMi - b.distanceMi) * 0.4);

  const lateFood = useMemo(
    () =>
      openNow.filter(
        (v) =>
          (v.attributes.foodService === 'full_kitchen' || verticalsOf(v).includes('dining')) &&
          (hour >= 22 || hour < 5),
      ),
    [openNow, hour],
  );

  const programming = useMemo(() => {
    const dow = now.getDay();
    const iso = now.toISOString().slice(0, 10);
    return events.filter((e) => (e.recurring ? e.weekday === dow : e.date === iso));
  }, [events, now]);

  const phase =
    hour >= 5 && hour < 21 ? 'Early' : hour >= 21 && hour < 23 ? 'Bar hours' : 'Late';

  const modules: Record<ModuleKey, React.ReactNode> = {
    happyHour: (
      <Module
        key="happyHour"
        title="Happy hour"
        subtitle={happy.length ? 'Sorted by how soon the window closes' : 'Nothing running right now'}
      >
        {happy.length ? (
          happy.slice(0, 4).map(({ v, hh }) => (
            <Card key={v.id} style={{ marginBottom: space.md }} onPress={() => router.push(`/venue/${v.id}`)}>
              <View style={[ui.row, { alignItems: 'flex-start' }]}>
                <IconBadge icon="pricetag" size={42} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>{v.name}</Text>
                  <Text style={[font.meta, { color: theme.textDim }]} numberOfLines={2}>{hh.window.summary}</Text>
                  <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                    {formatTime(hh.window.start)} to {formatTime(hh.window.end)} · {v.distanceMi.toFixed(1)} mi
                  </Text>
                </View>
                <View
                  style={{
                    alignItems: 'center',
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.md,
                    backgroundColor: hh.minutesLeft <= 45 ? theme.warnSoft : theme.accentSoft,
                    minWidth: 74,
                  }}
                >
                  <Text style={[font.cardTitle, { color: hh.minutesLeft <= 45 ? theme.warn : theme.accentSoftText }]}>
                    {formatDuration(hh.minutesLeft)}
                  </Text>
                  <Text style={[font.micro, { color: hh.minutesLeft <= 45 ? theme.warn : theme.accentSoftText }]}>LEFT</Text>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <Card>
            <Body dim>
              {upcomingHappy.length
                ? `Next window: ${upcomingHappy[0].v.name} in ${formatDuration(upcomingHappy[0].hh.minutesUntil)} — ${upcomingHappy[0].hh.window.summary}`
                : 'No happy hour windows left today.'}
            </Body>
          </Card>
        )}
      </Module>
    ),
    dinner: (
      <Module key="dinner" title="Dinner" subtitle="Open now, reservation or waitlist available">
        {byVertical('dining').slice(0, 3).map((v) => <VenueCard key={v.id} venue={v} />)}
      </Module>
    ),
    bars: (
      <Module key="bars" title="Bars" subtitle={verticalMeta.bar.blurb}>
        {byVertical('bar').slice(0, 4).map((v) => <VenueCard key={v.id} venue={v} />)}
      </Module>
    ),
    lounges: (
      <Module key="lounges" title="Lounges" subtitle={verticalMeta.lounge.blurb}>
        {byVertical('lounge').slice(0, 3).map((v) => <VenueCard key={v.id} venue={v} />)}
      </Module>
    ),
    cigar: (
      <Module key="cigar" title="Cigar lounges" subtitle="Humidor, ventilation, and lounge hours">
        {byVertical('cigar').slice(0, 3).map((v) => <VenueCard key={v.id} venue={v} />)}
      </Module>
    ),
    clubs: (
      <Module key="clubs" title="Nightclubs" subtitle="Reported cover, tonight's lineup, wait at peak">
        {byVertical('nightclub').slice(0, 3).map((v) => <VenueCard key={v.id} venue={v} />)}
      </Module>
    ),
    lateFood: (
      <Module key="lateFood" title="Still serving food" subtitle="Kitchens open at this hour">
        {lateFood.slice(0, 3).map((v) => <VenueCard key={v.id} venue={v} />)}
      </Module>
    ),
    programming: (
      <Module key="programming" title="On tonight" subtitle="Weekly programming and one-offs">
        {programming.slice(0, 4).map((e) => {
          const v = venueById[e.venueId];
          return (
            <Card key={e.id} style={{ marginBottom: space.md }} onPress={() => router.push(`/venue/${e.venueId}`)}>
              <View style={[ui.row, { alignItems: 'flex-start' }]}>
                <IconBadge icon={e.recurring ? 'repeat' : 'star'} size={40} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>{e.title}</Text>
                  <Text style={[font.meta, { color: theme.textDim }]} numberOfLines={1}>
                    {v?.name} · {formatTime(e.start)}
                  </Text>
                  {e.lineup?.length ? (
                    <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]} numberOfLines={1}>
                      {e.lineup.join(', ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={[font.small, { color: e.cover ? theme.text : theme.open }]}>
                  {e.cover ? `$${e.cover}` : 'Free'}
                </Text>
              </View>
            </Card>
          );
        })}
      </Module>
    ),
    openingSoon: (
      <Module key="openingSoon" title="Opening soon" subtitle="Within the next two hours">
        {openingSoon.slice(0, 3).map((v) => <VenueCard key={v.id} venue={v} compact />)}
      </Module>
    ),
  };

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader
        title="Tonight"
        subtitle={`${phase} · ${openNow.length} open now · ${openingSoon.length} opening soon`}
      />

      <View style={gutter()}>
        <HeroCard
          icon="moon"
          title={phaseTitle(hour)}
          subtitle={phaseSubtitle(hour)}
          value={formatTime(`${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}
          valueCaption="now"
        />
      </View>

      {/* Clock control. The stack reorders by hour, and a demo needs to be able
          to see that without waiting until 11 PM. */}
      <View style={gutter()}>
        <Card>
          <View style={[ui.row, { marginBottom: space.md }]}>
            <View style={{ flex: 1 }}>
              <Label>Preview another hour</Label>
              <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                The module order below changes with the clock.
              </Text>
            </View>
            {clockOverride != null ? (
              <Pressable
                onPress={() => setClockOverride(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Use the real time"
                style={{ minHeight: 34, justifyContent: 'center' }}
              >
                <Text style={[font.small, { color: theme.accent }]}>Use real time</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {[18, 20, 22, 23, 0, 1].map((h) => (
              <Chip
                key={h}
                label={formatTime(`${String(h).padStart(2, '0')}:00`)}
                selected={clockOverride === h}
                onPress={() => setClockOverride(clockOverride === h ? null : h)}
              />
            ))}
          </View>
          <View style={[ui.row, { gap: 6, marginTop: space.md }]}>
            <Ionicons name="git-branch" size={14} color={theme.textFaint} />
            <Text style={[font.small, { color: theme.textFaint, flex: 1 }]}>
              Stack order now: {order.slice(0, 4).map(moduleTitle).join(' → ')}
            </Text>
          </View>
        </Card>
      </View>

      {order.map((k) => modules[k])}

      {/* The dual-category tiebreak, stated rather than hidden. */}
      <View style={gutter()}>
        <Card>
          <Label>Bar or lounge</Label>
          <Body dim style={{ marginTop: space.sm }}>
            {BAR_LOUNGE_TIEBREAK}
          </Body>
        </Card>
      </View>
    </Screen>
  );
}

function Module({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const hasChildren = React.Children.toArray(children).length > 0;
  if (!hasChildren) return null;
  return (
    <View style={gutter()}>
      <SectionHeader title={title} subtitle={subtitle} />
      {children}
    </View>
  );
}

const MODULE_TITLES: Record<ModuleKey, string> = {
  happyHour: 'Happy hour',
  dinner: 'Dinner',
  bars: 'Bars',
  lounges: 'Lounges',
  cigar: 'Cigar',
  clubs: 'Clubs',
  lateFood: 'Late food',
  openingSoon: 'Opening soon',
  programming: 'On tonight',
};

function moduleTitle(k: ModuleKey): string {
  return MODULE_TITLES[k];
}

/**
 * Order matters here: the after-midnight case has to be tested first, or an
 * hour of 0 falls through into the "before 9 PM" branch and the app tells
 * someone at half past midnight that it is happy hour.
 */
function phaseTitle(hour: number): string {
  if (hour < 5) return 'Late';
  if (hour < 17) return 'Early yet';
  if (hour < 21) return 'Happy hour and dinner';
  if (hour < 23) return 'Bar hours';
  return 'Late';
}

function phaseSubtitle(hour: number): string {
  if (hour < 5) return 'Clubs and late kitchens lead';
  if (hour < 17) return 'Dinner and happy hour lead the stack';
  if (hour < 21) return 'Windows closing soonest are listed first';
  if (hour < 23) return 'Bars, lounges, and cigar lounges lead';
  return 'Clubs and late kitchens lead';
}

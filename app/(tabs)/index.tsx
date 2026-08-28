import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, Text, View } from 'react-native';

import { VenueCard } from '@/components/VenueCard';
import {
  Body, Button, Card, GlassButton, gutter, HeroCard, IconBadge, QuickActions, Screen,
  SectionHeader, StatCard, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { activeHappyHour, formatDuration, formatTime, venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Venue } from '@/types';

/**
 * Home: the personalized feed (F-SOCIAL-06), laid out in the prototype's
 * language — a gradient hero card, a four-up row of white quick-action tiles,
 * paired stat cards with dark navy inset pills, then bold section headers with a
 * small white pill button on the right and white list rows beneath.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { now, session, prefs, setPrefs, bookings } = useApp();
  const { venues, events, venueById } = useCatalogue();

  const openNow = useMemo(
    () => venues.filter((v) => !v.closure && venueState(v, now).open),
    [venues, now],
  );

  const happyNow = useMemo(
    () =>
      venues
        .filter((v) => !v.closure)
        .map((v) => ({ v, hh: activeHappyHour(v, now) }))
        .filter((x) => x.hh != null)
        .sort((a, b) => (a.hh!.minutesLeft - b.hh!.minutesLeft)),
    [venues, now],
  );

  const noCover = useMemo(
    () =>
      openNow.filter(
        (v) =>
          (v.primary.vertical === 'nightclub' || v.primary.vertical === 'lounge') &&
          (v.attributes.coverCharge === 0 || v.attributes.coverWaived),
      ),
    [openNow],
  );

  /** Personalization: stated preferences, then history, then distance. */
  const forYou = useMemo(() => {
    if (!prefs.personalized) {
      return venues.filter((v) => !v.closure).slice().sort((a, b) => b.rating - a.rating).slice(0, 3);
    }
    const score = (v: Venue) => {
      let s = v.rating * 10 - v.distanceMi * 1.5;
      if (prefs.cigarInterest && v.primary.vertical === 'cigar') s += 22;
      if (prefs.nightlifeInterest && (v.primary.vertical === 'nightclub' || v.primary.vertical === 'lounge')) s += 10;
      if (prefs.priceComfort.length && prefs.priceComfort.includes(v.priceTier)) s += 8;
      if (prefs.dietary.length) {
        const diet = Array.isArray(v.attributes.dietary) ? (v.attributes.dietary as string[]) : [];
        if (prefs.dietary.some((d) => diet.includes(d))) s += 10;
      }
      if (prefs.typicalPartySize >= 5 && v.attributes.goodForGroups) s += 6;
      if (venueState(v, now).open) s += 6;
      return s;
    };
    return venues.filter((v) => !v.closure).slice().sort((a, b) => score(b) - score(a)).slice(0, 3);
  }, [venues, prefs, now]);

  const tonightProgramming = useMemo(() => {
    const dow = now.getDay();
    return events
      .filter((e) => (e.recurring ? e.weekday === dow : e.date === now.toISOString().slice(0, 10)))
      .slice(0, 3);
  }, [events, now]);

  const upcoming = bookings.filter((b) => b.status !== 'cancelled');

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <View style={gutter()}>
        <Image
          source={
            theme.mode === 'dark'
              ? require('../../assets/kulture-wordmark-dark.png')
              : require('../../assets/kulture-wordmark.png')
          }
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          style={{ width: 126, height: 26, alignSelf: 'flex-start' }}
        />
      </View>

      {/* Top bar: avatar left, circular action right. */}
      <View style={[ui.row, gutter()]}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: 'rgba(255,255,255,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[font.title, { color: theme.onGround }]}>
            {session.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={[font.meta, { color: theme.onGroundDim }]}>
            {greeting(now)} · Houston
          </Text>
          <Text style={[font.title, { color: theme.onGround }]} numberOfLines={1}>
            {session.role === 'guest' ? 'Decide where to go' : session.name}
          </Text>
        </View>
        <GlassButton
          icon="notifications"
          label="Notifications"
          badge={upcoming.length || undefined}
          onPress={() => router.push('/(tabs)/profile')}
        />
      </View>

      {/* Hero: the count that answers "is anything even open". */}
      <View style={gutter()}>
        <HeroCard
          icon="moon"
          title="Tonight in Houston"
          subtitle={`${openNow.length} open now · ${happyNow.length} in happy hour`}
          value={formatTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}
          valueCaption="local"
          onPress={() => router.push('/(tabs)/tonight')}
          footer={
            <View style={{ marginTop: space.lg, flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {(['Bars', 'Cigar', 'Clubs', 'Late food'] as const).map((t) => (
                <View
                  key={t}
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: 5,
                    borderRadius: radius.pill,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  <Text style={[font.small, { color: '#FFFFFF' }]}>{t}</Text>
                </View>
              ))}
            </View>
          }
        />
      </View>

      {/* Four-up quick actions, exactly the prototype's row. */}
      <View style={gutter()}>
        <QuickActions
          items={[
            { key: 'reserve', icon: 'calendar', label: 'Reserve', onPress: () => router.push('/(tabs)/search') },
            { key: 'tonight', icon: 'flash', label: 'Tonight', onPress: () => router.push('/(tabs)/tonight') },
            { key: 'events', icon: 'musical-notes', label: 'Events', onPress: () => router.push('/events') },
            { key: 'saved', icon: 'bookmark', label: 'Saved', onPress: () => router.push('/(tabs)/saved') },
          ]}
        />
      </View>

      {/* Paired stat cards with navy inset pills. */}
      <View style={[ui.row, gutter(), { gap: space.md, alignItems: 'stretch' }]}>
        <StatCard
          icon="pricetag"
          title="Happy hour"
          value={happyNow.length ? `${happyNow.length} running` : 'None now'}
          caption={
            happyNow.length
              ? `Soonest to end: ${happyNow[0].v.name}, ${formatDuration(happyNow[0].hh!.minutesLeft)} left`
              : 'Check back before 7 PM'
          }
          tone={happyNow.length && happyNow[0].hh!.minutesLeft < 45 ? 'warn' : 'default'}
          onPress={() => router.push('/(tabs)/tonight')}
        />
        <StatCard
          icon="ticket"
          title="No cover"
          value={`${noCover.length} spots`}
          caption={noCover.length ? noCover.map((v) => v.name).slice(0, 2).join(', ') : 'Cover applies everywhere open right now'}
          tone={noCover.length ? 'good' : 'default'}
          onPress={() => router.push('/(tabs)/tonight')}
        />
      </View>

      {/* Upcoming bookings, if any. */}
      {upcoming.length ? (
        <View style={gutter()}>
          <SectionHeader
            title="Your bookings"
            subtitle="Confirmation details stay readable offline"
            actionLabel="All"
            onAction={() => router.push('/(tabs)/profile')}
          />
          {upcoming.slice(0, 2).map((b) => {
            const v = venueById[b.venueId];
            return (
              <Card key={b.id} style={{ marginBottom: space.md }} onPress={() => router.push(`/venue/${b.venueId}`)}>
                <View style={ui.row}>
                  <IconBadge icon={b.status === 'waitlisted' ? 'time' : 'checkmark-circle'} size={40} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>
                      {v?.name ?? 'Venue'}
                    </Text>
                    <Text style={[font.meta, { color: theme.textDim }]}>
                      {b.status === 'waitlisted'
                        ? `Waitlist · position ${b.waitlistPosition} · about ${b.waitMinutes} min`
                        : `${b.date} at ${formatTime(b.time)} · ${b.partySize} guests`}
                    </Text>
                  </View>
                  <Text style={[font.small, { color: b.status === 'confirmed' ? theme.open : theme.warn }]}>
                    {b.status}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {/* Personalized, with the visible personalization control F-SOCIAL-06 requires. */}
      <View style={gutter()}>
        <SectionHeader
          title={prefs.personalized ? 'For you' : 'Top rated'}
          subtitle={
            prefs.personalized
              ? 'From your stated preferences, history, and distance'
              : 'Personalization is off, showing rating order'
          }
          actionLabel={prefs.personalized ? 'Adjust' : 'Turn on'}
          onAction={() => {
            if (prefs.personalized) router.push('/onboarding');
            else setPrefs({ ...prefs, personalized: true });
          }}
        />
        {forYou.map((v) => (
          <VenueCard key={v.id} venue={v} />
        ))}
      </View>

      {/* Weekly programming: the dominant event type at bars. */}
      {tonightProgramming.length ? (
        <View style={gutter()}>
          <SectionHeader
            title="On tonight"
            subtitle="Recurring programming and one-offs"
            actionLabel="Events"
            onAction={() => router.push('/events')}
          />
          {tonightProgramming.map((e) => {
            const v = venueById[e.venueId];
            return (
              <Card key={e.id} style={{ marginBottom: space.md }} onPress={() => router.push(`/venue/${e.venueId}`)}>
                <View style={[ui.row, { alignItems: 'flex-start' }]}>
                  <IconBadge icon={e.recurring ? 'repeat' : 'star'} size={40} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={[font.meta, { color: theme.textDim }]} numberOfLines={1}>
                      {v?.name} · {formatTime(e.start)} to {formatTime(e.end)}
                    </Text>
                    <View style={[ui.row, { gap: space.sm, marginTop: 4 }]}>
                      <Text style={[font.small, { color: theme.textDim }]}>
                        {e.cover ? `$${e.cover} cover` : 'No cover'}
                      </Text>
                      {e.recurring ? (
                        <>
                          <Text style={[font.small, { color: theme.textFaint }]}>·</Text>
                          <Text style={[font.small, { color: theme.textDim }]}>Weekly</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {/* Open now, ordered by distance. */}
      <View style={gutter()}>
        <SectionHeader
          title="Open right now"
          subtitle="Closest first"
          actionLabel="Map"
          onAction={() => router.push('/(tabs)/search')}
        />
        {openNow
          .slice()
          .sort((a, b) => a.distanceMi - b.distanceMi)
          .slice(0, 4)
          .map((v) => (
            <VenueCard key={v.id} venue={v} compact />
          ))}
        {openNow.length === 0 ? (
          <Card>
            <Body dim>
              Nothing in the seed database is open at {formatTime(`${now.getHours()}:00`)}. The clock
              control on your profile lets you jump to a different hour to see how Tonight reorders.
            </Body>
            <Button
              label="Change the hour"
              variant="secondary"
              style={{ marginTop: space.md }}
              onPress={() => router.push('/(tabs)/profile')}
            />
          </Card>
        ) : null}
      </View>

      {/* Guest nudge, deferred until it is relevant (U-02). */}
      {session.role === 'guest' ? (
        <View style={gutter()}>
          <Card>
            <View style={[ui.row, { gap: space.md, alignItems: 'flex-start' }]}>
              <IconBadge icon="person-add" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={[font.cardTitle, { color: theme.text }]}>Browsing does not need an account</Text>
                <Body dim style={{ marginTop: 4 }}>
                  Reviewing, booking, and saving across devices do. Sign in when you hit one of those,
                  not before.
                </Body>
                <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
                  <Button label="Sign in" variant="secondary" onPress={() => router.push('/auth')} />
                  <Button label="Sign up" variant="ghost" onPress={() => router.push('/auth')} />
                </View>
              </View>
            </View>
          </Card>
        </View>
      ) : null}

      {/* A short honest note about what this build is. */}
      <View style={gutter()}>
        <Card>
          <View style={[ui.row, { gap: space.sm, marginBottom: space.sm }]}>
            <Ionicons name="information-circle" size={16} color={theme.textDim} />
            <Text style={[font.small, { color: theme.textDim }]}>Prototype build</Text>
          </View>
          <Body dim>
            Phase 1 and 2 consumer scope from the PRD, running against a seeded Houston database of{' '}
            {venues.length} venues. No backend, no payments, no real reservation inventory. The
            business portal, moderation console, and internal tooling are out of scope for this
            client.
          </Body>
        </Card>
      </View>
    </Screen>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Tonight';
}

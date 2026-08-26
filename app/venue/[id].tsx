import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';

import { AttributePanel } from '@/components/AttributePanel';
import { PhotoTile, albumLabel } from '@/components/PhotoTile';
import { Meter, Stars } from '@/components/Stars';
import { OpenPill, VenueCard } from '@/components/VenueCard';
import {
  AdLabel, Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen,
  ScreenHeader, SectionHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { communityByName } from '@/data/community';
import { requestPhotoRemoval, setConsumerAlert, setContributionFrozen } from '@/data/repository';
import { verticalMeta } from '@/data/taxonomy';
import { decisionChips, headlineAnswer } from '@/lib/decide';
import { exportVenueData } from '@/lib/export';
import { actionsFor, categoryLine, freshness, metaFor, priceLabel, relativeDate } from '@/lib/format';
import {
  activeHappyHour, DAY_LABELS_LONG, formatDuration, formatRange, formatTime, kitchenGap,
  primarySchedule, retailGap, venueState,
} from '@/lib/hours';
import { aggregateFor, subRatingDimensions } from '@/lib/ratings';
import { verticalsOf } from '@/lib/search';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Photo, Venue } from '@/types';

export default function VenueProfile() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    now, isSaved, toggleSave, session, canBook, attemptContribution, startThread,
    isFollowingVenue, toggleFollowVenue, addCheckIn, isManagingVenue, isTrustSafety,
  } = useApp();
  const {
    venues, getVenue, venueReviews, filteredCount, eventsForVenue,
    setVenueConsumerAlert, setVenueContributionFrozen,
  } = useCatalogue();
  const [album, setAlbum] = useState<Photo['album'] | 'all'>('all');
  const [alertDraft, setAlertDraft] = useState<string | null>(null);
  const [tsBusy, setTsBusy] = useState(false);

  const venue = getVenue(id);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Not found" onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>That venue is not in the database. It may have been merged into another listing.</Body>
            <Button label="Back to search" style={{ marginTop: space.md }} onPress={() => router.replace('/(tabs)/search')} />
          </Card>
        </View>
      </Screen>
    );
  }

  const state = venueState(venue, now);
  const agg = aggregateFor(venueReviews(venue.id, true), now);
  const chips = decisionChips(venue, now, 6);
  const headline = headlineAnswer(venue, now);
  const actions = actionsFor(venue);
  const saved = isSaved(venue.id);
  const hh = activeHappyHour(venue, now);
  const activeOffers = (venue.offers ?? []).filter((o) => !o.endsAt || new Date(o.endsAt).getTime() > now.getTime());
  const events = eventsForVenue(venue.id);
  const recommended = venueReviews(venue.id);
  const hidden = filteredCount(venue.id);
  const dims = subRatingDimensions[venue.primary.vertical];
  const successor = venue.closure?.successorId ? getVenue(venue.closure.successorId) : undefined;

  const photos = useMemo(
    () => (album === 'all' ? venue.photos : venue.photos.filter((p) => p.album === album)),
    [album, venue.photos],
  );
  const albums = useMemo(
    () => Array.from(new Set(venue.photos.map((p) => p.album))),
    [venue.photos],
  );

  const similar = useMemo(
    () =>
      venues
        .filter(
          (v) =>
            v.id !== venue.id &&
            !v.closure &&
            !v.promoted &&
            verticalsOf(v).some((x) => verticalsOf(venue).includes(x)),
        )
        .sort((a, b) => Math.abs(a.priceTier - venue.priceTier) - Math.abs(b.priceTier - venue.priceTier) || b.rating - a.rating)
        .slice(0, 2),
    [venues, venue],
  );

  const runAction = (key: string) => {
    switch (key) {
      case 'reserve':
      case 'table':
      case 'hold':
      case 'waitlist':
      case 'membership':
      case 'guestlist':
        if (!canBook) {
          // R1: hard wall on booking.
          Alert.alert(
            'Verification required to book',
            'Booking at a venue that serves alcohol or permits tobacco requires a confirmed phone number and age verification. Browsing does not.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Verify', onPress: () => router.push('/auth') },
            ],
          );
          return;
        }
        router.push({ pathname: `/book/${venue.id}`, params: { intent: key } });
        return;
      case 'directions':
        Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`${venue.name} ${venue.address}`)}`).catch(
          () => Alert.alert('Could not open maps', 'No maps application is available on this device.'),
        );
        return;
      case 'call':
        Linking.openURL(`tel:${venue.phone.replace(/[^0-9]/g, '')}`).catch(() =>
          Alert.alert('Could not place the call', `Dial ${venue.phone} manually.`),
        );
        return;
      case 'taplist':
      case 'order':
        router.push(`/menu/${venue.id}`);
        return;
      case 'hours':
        router.push(`/hours/${venue.id}`);
        return;
      case 'specials':
        router.push(`/hours/${venue.id}`);
        return;
      case 'tickets':
        router.push('/events');
        return;
      default:
        return;
    }
  };

  const openThread = async (kind: 'general' | 'quote_request') => {
    if (!canBook) {
      // Same gate as booking: PRD 2.4 requires a verified account (R3) to
      // message a business, not merely a registered one (R2).
      Alert.alert(
        'Verification required to message a venue',
        'Messaging a venue requires a confirmed phone number and age verification. Browsing does not.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Verify', onPress: () => router.push('/auth') },
        ],
      );
      return;
    }
    const threadId = await startThread(venue.id, kind, kind === 'quote_request' ? 'Private event / buyout inquiry' : undefined);
    router.push(`/messages/${threadId}`);
  };

  const writeReview = () => {
    const gate = attemptContribution();
    if (session.role === 'guest') {
      Alert.alert(
        gate === 'soft_wall' ? 'Sign in to keep going' : 'Reviewing needs an account',
        'Reviews at venues that serve alcohol require a verified account. Reading and browsing do not.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => router.push('/auth') },
        ],
      );
      return;
    }
    router.push({ pathname: '/review/new', params: { id: venue.id } });
  };

  // F-SOCIAL-02 / F-SOCIAL-05. Following and checking in are R2 capabilities
  // per the PRD's role list (2.1) — lighter than the R3 gate on booking and
  // messaging, so a registered-but-unverified account can do both.
  const requireAccount = (action: () => void) => {
    const gate = attemptContribution();
    if (session.role === 'guest') {
      Alert.alert(
        gate === 'soft_wall' ? 'Sign in to keep going' : 'This needs an account',
        'Following and checking in need an account. Reading and browsing do not.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => router.push('/auth') },
        ],
      );
      return;
    }
    action();
  };

  const following = isFollowingVenue(venue.id);

  const checkIn = () =>
    requireAccount(() =>
      Alert.alert(`Check in at ${venue.name}?`, 'Who can see this?', [
        {
          text: 'Just me',
          onPress: () => addCheckIn(venue.id, 'private'),
        },
        {
          text: 'Followers can see it',
          onPress: () => addCheckIn(venue.id, 'friends'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]),
    );

  const addPhoto = () => requireAccount(() => router.push(`/photo/new?venueId=${venue.id}`));

  const exportData = () =>
    exportVenueData(venue, venueReviews(venue.id, true)).catch(() =>
      Alert.alert('Could not export', 'Something went wrong preparing the file.'),
    );

  /**
   * F-TRUST-04, trust_safety only. venues_guard_owner_write's second branch
   * is what actually restricts this account to exactly these two columns
   * (see the migration header on 20260826110000_add_trust_and_safety.sql)
   * and writes the audit entry as a side effect — this just sends the write.
   */
  const applyAlert = async () => {
    if (!venue) return;
    setTsBusy(true);
    const alert = (alertDraft ?? venue.consumerAlert ?? '').trim();
    const result = await setConsumerAlert({ venueId: venue.id, alert: alert || null });
    setTsBusy(false);
    if (result.ok) {
      setVenueConsumerAlert(venue.id, alert || undefined);
      setAlertDraft(null);
    } else {
      Alert.alert('Could not update the alert', result.error);
    }
  };

  const clearAlert = async () => {
    if (!venue) return;
    setTsBusy(true);
    const result = await setConsumerAlert({ venueId: venue.id, alert: null });
    setTsBusy(false);
    if (result.ok) {
      setVenueConsumerAlert(venue.id, undefined);
      setAlertDraft(null);
    } else {
      Alert.alert('Could not clear the alert', result.error);
    }
  };

  const toggleFreeze = async () => {
    if (!venue) return;
    setTsBusy(true);
    const next = !venue.contributionFrozen;
    const result = await setContributionFrozen({ venueId: venue.id, frozen: next });
    setTsBusy(false);
    if (result.ok) setVenueContributionFrozen(venue.id, next);
    else Alert.alert('Could not update contribution state', result.error);
  };

  const requestRemoval = (photo: Photo) =>
    requireAccount(() =>
      Alert.alert('Report this photo', 'Choose the reason that fits', [
        { text: "I'm in this photo and want it removed", onPress: () => fileRemoval(photo.id, 'subject_removal') },
        { text: 'Inappropriate content', onPress: () => fileRemoval(photo.id, 'inappropriate') },
        { text: 'Wrong venue or mislabeled', onPress: () => fileRemoval(photo.id, 'mislabeled') },
        { text: 'Cancel', style: 'cancel' },
      ]),
    );

  const fileRemoval = async (photoId: string, reason: string) => {
    const result = await requestPhotoRemoval({ photoId, reason });
    Alert.alert(
      result.ok ? 'Request sent' : 'Could not send the request',
      result.ok ? "We've recorded it." : result.error,
    );
  };

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader
        title={venue.name}
        subtitle={`${categoryLine(venue)} · ${venue.neighborhood}`}
        onBack={() => router.back()}
        right={
          <View style={[ui.row, { gap: space.sm }]}>
            <Pressable
              onPress={() => toggleSave(venue.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: saved }}
              accessibilityLabel={saved ? 'Remove from saved' : 'Save this venue'}
              style={ui.glassCircle}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={theme.onGround} />
            </Pressable>
            <Pressable
              onPress={() =>
                Share.share({
                  message: `${venue.name} — ${venue.tagline}. ${venue.address}. ${state.label}. (NightOut)`,
                }).catch(() => undefined)
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share this venue"
              style={ui.glassCircle}
            >
              <Ionicons name="share-outline" size={19} color={theme.onGround} />
            </Pressable>
          </View>
        }
      />

      {/* Trust & Safety banner, above everything else it could affect. */}
      {venue.consumerAlert ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="warning" title="Consumer Alert">
            <Body style={{ color: theme.closed }}>{venue.consumerAlert}</Body>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'About Consumer Alerts',
                  'Trust & Safety applies an alert when there is evidence of review manipulation, undisclosed compensation, or threats against reviewers. Contribution on the listing can be frozen while it is investigated. Sales and account management have no ability to place, lift, or influence an alert.',
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Learn more about Consumer Alerts"
              style={{ marginTop: space.sm, minHeight: 34, justifyContent: 'center' }}
            >
              <Text style={[font.small, { color: theme.closed, textDecorationLine: 'underline' }]}>
                Why am I seeing this?
              </Text>
            </Pressable>
          </Callout>
        </View>
      ) : null}

      {/* Closure states. */}
      {venue.closure ? (
        <View style={gutter()}>
          <Callout
            tone={venue.closure.state === 'temporary' || venue.closure.state === 'seasonal' ? 'warn' : 'danger'}
            icon={venue.closure.state === 'moved' ? 'arrow-forward-circle' : 'close-circle'}
            title={
              venue.closure.state === 'moved'
                ? 'This location moved'
                : venue.closure.state === 'permanent'
                  ? 'Permanently closed'
                  : venue.closure.state === 'seasonal'
                    ? 'Seasonal, currently closed'
                    : 'Temporarily closed'
            }
          >
            <Body dim>{venue.closure.note}</Body>
            {successor ? (
              <Button
                label={`Go to ${successor.name}`}
                variant="secondary"
                style={{ marginTop: space.md }}
                onPress={() => router.replace(`/venue/${successor.id}`)}
              />
            ) : null}
          </Callout>
        </View>
      ) : null}

      {/* Header card: rating, price, open state, and primary actions. */}
      <View style={gutter()}>
        <Card>
          {venue.promoted ? (
            <View style={{ marginBottom: space.md }}>
              <AdLabel />
            </View>
          ) : null}

          <View style={[ui.row, { alignItems: 'flex-start' }]}>
            <IconBadge
              icon={verticalMeta[venue.primary.vertical].icon as keyof typeof Ionicons.glyphMap}
              size={52}
              variant="solid"
            />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={[font.title, { color: theme.text }]}>{venue.name}</Text>
              <Text style={[font.meta, { color: theme.textDim, marginTop: 2 }]} numberOfLines={2}>
                {venue.tagline}
              </Text>
            </View>
          </View>

          <View style={[ui.row, { marginTop: space.lg, gap: space.md, flexWrap: 'wrap' }]}>
            <Pressable
              onPress={() => router.push(`/reviews/${venue.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${venue.rating} stars from ${venue.reviewCount} reviews. Open all reviews.`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}
            >
              <Text style={[font.display, { color: theme.text }]}>{venue.rating.toFixed(1)}</Text>
              <View>
                <Stars value={venue.rating} size={13} />
                <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]}>
                  {venue.reviewCount.toLocaleString('en-US')} reviews
                </Text>
              </View>
            </Pressable>
            <Divider style={{ width: 1, height: 40 }} />
            <View>
              <Text style={[font.cardTitle, { color: theme.text }]}>{priceLabel(venue.priceTier)}</Text>
              <Text style={[font.small, { color: theme.textDim }]}>{venue.distanceMi.toFixed(1)} mi away</Text>
            </View>
          </View>

          <View style={{ marginTop: space.lg }}>
            <OpenPill state={state} />
          </View>

          {/* The one thing this category's users ask first. */}
          {headline ? (
            <View style={{ marginTop: space.md }}>
              <Callout tone="info" icon="alert-circle" title="Worth knowing">
                <Body dim>{headline}</Body>
              </Callout>
            </View>
          ) : null}

          {hh ? (
            <View style={{ marginTop: space.sm }}>
              <Callout
                tone={hh.minutesLeft <= 45 ? 'warn' : 'info'}
                icon="pricetag"
                title={`Happy hour, ${formatDuration(hh.minutesLeft)} left`}
              >
                <Body dim>{hh.window.summary}</Body>
              </Callout>
            </View>
          ) : null}

          {/* F-PROFILE-02: action set adapts by category. */}
          <View style={[ui.row, { gap: space.sm, marginTop: space.lg, flexWrap: 'wrap' }]}>
            {actions.map((a) => (
              <Button
                key={a.key}
                label={a.label}
                icon={a.icon as keyof typeof Ionicons.glyphMap}
                variant={a.primary ? 'primary' : 'secondary'}
                onPress={() => runAction(a.key)}
              />
            ))}
          </View>

          {/* F-SOCIAL-02 / F-SOCIAL-05: lighter-weight than booking, so they
              sit apart from the primary action set above rather than in it. */}
          <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
            <Button
              label={following ? 'Following updates' : 'Follow for updates'}
              icon={following ? 'notifications' : 'notifications-outline'}
              variant="ghost"
              onPress={() => requireAccount(() => toggleFollowVenue(venue.id))}
            />
            <Button label="Check in" icon="location-outline" variant="ghost" onPress={checkIn} />
          </View>

          {/* Never a dead Reserve button (F-BOOK-09a). */}
          {venue.bookingModes.length === 1 && venue.bookingModes[0] === 'walk_in' ? (
            <Text style={[font.small, { color: theme.textDim, marginTop: space.md }]}>
              Walk-in only. This venue takes no reservations, holds, or waitlist, so there is no
              booking button to press.
            </Text>
          ) : null}

          {!venue.claimed ? (
            <View style={{ marginTop: space.md }}>
              <Callout tone="warn" icon="help-circle" title="Unclaimed listing">
                <Body dim>
                  No owner has verified this listing, so the details below are community-reported and
                  the venue has not confirmed them.
                </Body>
                <Button
                  label="Claim this listing"
                  variant="secondary"
                  icon="shield-checkmark"
                  style={{ marginTop: space.md }}
                  onPress={() => requireAccount(() => router.push(`/claim/new?venueId=${venue.id}`))}
                />
              </Callout>
            </View>
          ) : null}
        </Card>
      </View>

      {/* F-BIZ-09: self-published offers, not a purchased placement — no
          budget, targeting, or ranking boost. */}
      {activeOffers.length || isManagingVenue(venue.id) ? (
        <View style={gutter()}>
          <SectionHeader
            title="Offers"
            actionLabel={isManagingVenue(venue.id) ? 'Manage' : undefined}
            onAction={isManagingVenue(venue.id) ? () => router.push(`/venue/offers?venueId=${venue.id}`) : undefined}
          />
          {activeOffers.length ? (
            <Card padded={false}>
              {activeOffers.map((o, i) => (
                <View key={o.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: space.lg }}>
                    <Text style={[font.bodyStrong, { color: theme.text }]}>{o.title}</Text>
                    <Body dim style={{ marginTop: 4 }}>{o.description}</Body>
                    <Text style={[font.small, { color: theme.textFaint, marginTop: 6 }]}>
                      {o.endsAt ? `Through ${relativeDate(o.endsAt, now)}` : 'Ongoing'}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Body dim>No offers posted yet.</Body>
            </Card>
          )}
        </View>
      ) : null}

      {/* U-01: the six decision attributes above the fold. */}
      <View style={gutter()}>
        <SectionHeader
          title="The short version"
          subtitle={`What people decide on at a ${verticalMeta[venue.primary.vertical].label.toLowerCase()}`}
        />
        <Card>
          <View style={{ gap: space.sm }}>
            {chips.map((c) => (
              <View key={c.key} style={[ui.row, { gap: space.md, minHeight: 34 }]}>
                <Ionicons name={c.icon} size={17} color={c.stale ? theme.warn : theme.accent} />
                <Text style={[font.body, { color: c.stale ? theme.warn : theme.text, flex: 1 }]}>
                  {c.label}
                  {c.stale ? ' · dated report' : ''}
                </Text>
              </View>
            ))}
          </View>
          {venue.attributes.coverCharge != null ? (
            <StaleNote venue={venue} attrKey="coverCharge" />
          ) : null}

          {/*
            The indoor-smoking claim appears above the fold, so its caveat has to
            appear with it rather than one tap away inside a collapsed group.
            Whether a lounge may permit indoor smoking turns on state and local
            clean-indoor-air law and any exemption, so the platform records the
            venue's declaration and does not assert legality itself.
          */}
          {venue.attributes.indoorSmokingDeclared === true ? (
            <View style={{ marginTop: space.md }}>
              <Callout tone="warn" icon="information-circle" title="Indoor smoking is the venue's own declaration">
                <Body dim>
                  Whether indoor smoking is permitted at this address depends on state and local
                  clean-indoor-air law and any applicable exemption. We record what the venue
                  reports and do not assert it as fact. Declared{' '}
                  {relativeDate(metaFor(venue, 'indoorSmokingDeclared').updatedAt, now)}.
                </Body>
              </Callout>
            </View>
          ) : null}
        </Card>
      </View>

      {/* Hours, with split schedules. */}
      <View style={gutter()}>
        <SectionHeader
          title="Hours"
          subtitle={venue.schedules.length > 1 ? 'Separate schedules, not one merged range' : undefined}
          actionLabel="Full week"
          onAction={() => router.push(`/hours/${venue.id}`)}
        />
        <Card>
          {venue.schedules.map((s, i) => {
            const today = s.days[now.getDay()];
            return (
              <View key={s.kind}>
                {i > 0 ? <Divider style={{ marginVertical: space.md }} /> : null}
                <View style={[ui.row, { gap: space.md }]}>
                  <Text style={[font.bodyStrong, { color: theme.text, flex: 1 }]}>{s.label}</Text>
                  <Text style={[font.body, { color: today ? theme.text : theme.textFaint }]}>
                    {today ? formatRange(today.open, today.close) : 'Closed today'}
                  </Text>
                </View>
              </View>
            );
          })}
          {kitchenGap(venue, now) ? (
            <View style={{ marginTop: space.md }}>
              <Callout tone="warn" icon="restaurant" title="Kitchen closes first">
                <Body dim>{kitchenGap(venue, now)}</Body>
              </Callout>
            </View>
          ) : null}
          {retailGap(venue, now) ? (
            <View style={{ marginTop: space.md }}>
              <Callout tone="warn" icon="cube" title="Retail closes first">
                <Body dim>{retailGap(venue, now)}</Body>
              </Callout>
            </View>
          ) : null}
          <Text style={[font.small, { color: theme.textFaint, marginTop: space.md }]}>
            Hours last confirmed {relativeDate(primarySchedule(venue)?.updatedAt ?? venue.defaultMeta.updatedAt, now)}.
          </Text>
        </Card>
      </View>

      {/* Photos with album segmentation. */}
      <View style={gutter()}>
        <SectionHeader
          title="Photos"
          subtitle={`${venue.photos.filter((p) => p.by === 'owner').length} from the owner, ${venue.photos.filter((p) => p.by === 'community').length} from the community`}
          actionLabel="Add"
          onAction={() => addPhoto()}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          <View style={[ui.row, { gap: space.sm }]}>
            <Chip label="All" tone="ground" selected={album === 'all'} onPress={() => setAlbum('all')} />
            {albums.map((a) => (
              <Chip key={a} label={albumLabel[a]} tone="ground" selected={album === a} onPress={() => setAlbum(a)} />
            ))}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[ui.row, { gap: space.sm }]}>
            {photos.map((p) => (
              <PhotoTile
                key={p.id}
                photo={p}
                width={200}
                height={150}
                onRequestRemoval={p.uri ? () => requestRemoval(p) : undefined}
              />
            ))}
          </View>
        </ScrollView>
        <Text style={[font.small, { color: theme.onGroundFaint, marginTop: space.sm }]}>
          Location and device metadata are stripped on upload. Every image carries alternative text.
        </Text>
      </View>

      {/* Menus, tap lists, bottle lists, humidor highlights. */}
      {venue.menus.length ? (
        <View style={gutter()}>
          <SectionHeader
            title={menuTitle(venue.primary.vertical)}
            actionLabel="Full menu"
            onAction={() => router.push(`/menu/${venue.id}`)}
          />
          <Card>
            {venue.menus[0].volatile ? (
              <View style={{ marginBottom: space.md }}>
                <Callout tone="info" icon="time" title="Changes fast">
                  <Body dim>{venue.menus[0].note ?? 'This list rotates. Timestamped rather than treated as fixed.'}</Body>
                </Callout>
              </View>
            ) : null}
            {venue.menus[0].items.slice(0, 4).map((item) => (
              <View key={item.name} style={[ui.row, { paddingVertical: space.sm, gap: space.md }]}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      font.body,
                      { color: item.soldOut ? theme.textFaint : theme.text, textDecorationLine: item.soldOut ? 'line-through' : 'none' },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.detail ? (
                    <Text style={[font.small, { color: theme.textDim }]}>{item.detail}</Text>
                  ) : null}
                </View>
                {item.soldOut ? (
                  <Text style={[font.small, { color: theme.closed }]}>Tapped out</Text>
                ) : item.price != null ? (
                  <Text style={[font.bodyStrong, { color: theme.text }]}>${item.price}</Text>
                ) : null}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {/* Events. */}
      {events.length ? (
        <View style={gutter()}>
          <SectionHeader
            title="Events"
            subtitle={`${events.filter((e) => e.recurring).length} weekly, ${events.filter((e) => !e.recurring).length} one-off`}
            actionLabel="All events"
            onAction={() => router.push('/events')}
          />
          {events.slice(0, 3).map((e) => (
            <Card key={e.id} style={{ marginBottom: space.md }}>
              <View style={[ui.row, { alignItems: 'flex-start' }]}>
                <IconBadge icon={e.recurring ? 'repeat' : 'star'} size={40} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={[font.cardTitle, { color: theme.text }]}>{e.title}</Text>
                  <Text style={[font.meta, { color: theme.textDim }]}>
                    {e.recurring ? `Every ${DAY_LABELS_LONG[e.weekday ?? 0]}` : e.date} ·{' '}
                    {formatTime(e.start)} to {formatTime(e.end)}
                  </Text>
                  <Body dim style={{ marginTop: 4 }}>{e.description}</Body>
                  <View style={[ui.row, { gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }]}>
                    <Chip label={e.cover ? `$${e.cover} cover` : 'No cover'} />
                    {e.agePolicy ? <Chip label={e.agePolicy} /> : null}
                    {e.genre ? <Chip label={e.genre} /> : null}
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {/* Structured attributes with provenance. */}
      <View style={gutter()}>
        <SectionHeader title="Everything else" subtitle="Grouped, with where each value came from" />
        <AttributePanel venue={venue} />
      </View>

      {/* Popular times. */}
      {venue.busyness ? (
        <View style={gutter()}>
          <SectionHeader title="Popular times" subtitle="Aggregated, non-identifying" />
          <Card>
            <Busyness data={venue.busyness} now={now} />
            <Text style={[font.small, { color: theme.textFaint, marginTop: space.md }]}>
              Derived from consented, aggregated device signals and venue-reported counts. It cannot
              identify an individual visit.
            </Text>
          </Card>
        </View>
      ) : null}

      {/* Ratings breakdown with category-specific dimensions. */}
      {Object.keys(venue.subRatingAverages).length ? (
        <View style={gutter()}>
          <SectionHeader title="Rated on" subtitle={`Dimensions specific to ${verticalMeta[venue.primary.vertical].plural.toLowerCase()}`} />
          <Card>
            {dims.map((d) => {
              const v = venue.subRatingAverages[d.key];
              if (v == null) return null;
              return <Meter key={d.key} label={d.label} value={v} />;
            })}
          </Card>
        </View>
      ) : null}

      {/* Reviews. */}
      <View style={gutter()}>
        <SectionHeader
          title="Reviews"
          subtitle={`${venue.reviewCount.toLocaleString('en-US')} total${hidden ? `, ${hidden} not recommended` : ''}`}
          actionLabel="All"
          onAction={() => router.push(`/reviews/${venue.id}`)}
        />
        {recommended.slice(0, 2).map((r) => (
          <Card key={r.id} style={{ marginBottom: space.md }}>
            <View style={[ui.row, { alignItems: 'flex-start' }]}>
              <IconBadge icon="person" size={38} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <View style={[ui.row, { gap: space.sm }]}>
                  {communityByName[r.author] ? (
                    <Pressable onPress={() => router.push(`/community/${communityByName[r.author].id}`)} hitSlop={4}>
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
                  <Text style={[font.small, { color: theme.textFaint }]}>{relativeDate(r.date, now)}</Text>
                </View>
              </View>
            </View>
            {r.comped ? (
              <View style={{ marginTop: space.sm }}>
                <Callout tone="warn" icon="gift" title="Comped or hosted visit, disclosed by the reviewer" />
              </View>
            ) : null}
            <Body style={{ marginTop: space.md }} numberOfLines={5}>{r.text}</Body>
            <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
              {r.tags.partySize ? <Chip label={`Party of ${r.tags.partySize}`} /> : null}
              {r.tags.timeOfVisit ? <Chip label={r.tags.timeOfVisit} /> : null}
              {r.tags.waitMinutes != null ? <Chip label={r.tags.waitMinutes === 0 ? 'No wait' : `${r.tags.waitMinutes} min wait`} /> : null}
              {r.tags.coverPaid != null ? <Chip label={r.tags.coverPaid === 0 ? 'No cover paid' : `$${r.tags.coverPaid} cover`} /> : null}
            </View>
            {r.ownerResponse ? (
              <View style={{ marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: theme.cardMuted }}>
                <View style={[ui.row, { gap: 5, marginBottom: 4 }]}>
                  <Ionicons name="checkmark-circle" size={13} color={theme.accent} />
                  <Text style={[font.small, { color: theme.accent }]}>Response from the owner</Text>
                </View>
                <Body dim>{r.ownerResponse.text}</Body>
              </View>
            ) : null}
          </Card>
        ))}

        <Button label="Write a review" icon="create" variant="onGround" full onPress={writeReview} />
      </View>

      {/* Q&A. */}
      {venue.qa.length ? (
        <View style={gutter()}>
          <SectionHeader title="Questions" subtitle="Owner answers are badged" />
          {venue.qa.map((q) => (
            <Card key={q.q} style={{ marginBottom: space.md }}>
              <Text style={[font.bodyStrong, { color: theme.text }]}>{q.q}</Text>
              <Body dim style={{ marginTop: space.sm }}>{q.a}</Body>
              <View style={[ui.row, { gap: space.sm, marginTop: space.sm }]}>
                {q.byOwner ? (
                  <View style={[ui.row, { gap: 4 }]}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.accent} />
                    <Text style={[font.small, { color: theme.accent }]}>Owner</Text>
                  </View>
                ) : (
                  <Text style={[font.small, { color: theme.textFaint }]}>Community</Text>
                )}
                <Text style={[font.small, { color: theme.textFaint }]}>· {relativeDate(q.date, now)}</Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {/* About, address, contact. */}
      <View style={gutter()}>
        <SectionHeader
          title="About"
          actionLabel={isManagingVenue(venue.id) ? 'Edit' : undefined}
          onAction={isManagingVenue(venue.id) ? () => router.push(`/venue/edit?venueId=${venue.id}`) : undefined}
        />
        <Card>
          <Body dim>{venue.about}</Body>
          <Divider style={{ marginVertical: space.md }} />
          <Pressable
            onPress={() => runAction('directions')}
            accessibilityRole="button"
            accessibilityLabel={`Directions to ${venue.address}`}
            style={[ui.row, { gap: space.md, minHeight: 44 }]}
          >
            <Ionicons name="location" size={18} color={theme.accent} />
            <Text style={[font.body, { color: theme.text, flex: 1 }]}>{venue.address}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
          </Pressable>
          <Divider />
          <Pressable
            onPress={() => runAction('call')}
            accessibilityRole="button"
            accessibilityLabel={`Call ${venue.phone}`}
            style={[ui.row, { gap: space.md, minHeight: 44 }]}
          >
            <Ionicons name="call" size={18} color={theme.accent} />
            <Text style={[font.body, { color: theme.text, flex: 1 }]}>{venue.phone}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
          </Pressable>
          {venue.claimed ? (
            <>
              <Divider />
              <View style={[ui.row, { gap: space.md, minHeight: 44 }]}>
                <Ionicons name="shield-checkmark" size={18} color={theme.open} />
                <Text style={[font.body, { color: theme.text, flex: 1 }]}>
                  Claimed and {venue.verified ? 'verified' : 'unverified'} owner
                </Text>
              </View>
            </>
          ) : null}
          {isManagingVenue(venue.id) ? (
            <>
              <Divider />
              <Pressable
                onPress={() => router.push(`/claim/invite?venueId=${venue.id}`)}
                accessibilityRole="button"
                accessibilityLabel="Manage team"
                style={[ui.row, { gap: space.md, minHeight: 44 }]}
              >
                <Ionicons name="people" size={18} color={theme.accent} />
                <Text style={[font.body, { color: theme.text, flex: 1 }]}>Manage team</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
              </Pressable>
              <Divider />
              <Pressable
                onPress={exportData}
                accessibilityRole="button"
                accessibilityLabel="Export venue data"
                style={[ui.row, { gap: space.md, minHeight: 44 }]}
              >
                <Ionicons name="download" size={18} color={theme.accent} />
                <Text style={[font.body, { color: theme.text, flex: 1 }]}>Export venue data</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
              </Pressable>
            </>
          ) : null}
        </Card>
      </View>

      {/* F-TRUST-04, trust_safety only. Nobody else on this screen ever sees
          this card — isTrustSafety comes from a platform_roles row that has
          no self-serve path at all (see the migration header on
          20260826110000_add_trust_and_safety.sql). */}
      {isTrustSafety ? (
        <View style={gutter()}>
          <SectionHeader title="Trust & Safety" />
          <Card>
            <Label>Consumer Alert</Label>
            <TextInput
              value={alertDraft ?? venue.consumerAlert ?? ''}
              onChangeText={setAlertDraft}
              placeholder="Reason shown to consumers on this listing"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="Consumer alert text"
              multiline
              style={[
                font.body,
                {
                  color: theme.text,
                  backgroundColor: theme.cardMuted,
                  borderRadius: radius.md,
                  padding: space.md,
                  minHeight: 60,
                  textAlignVertical: 'top',
                  marginTop: space.sm,
                },
              ]}
            />
            <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
              <Button label="Apply" loading={tsBusy} disabled={!(alertDraft ?? venue.consumerAlert)} onPress={applyAlert} />
              {venue.consumerAlert ? (
                <Button label="Clear" variant="ghost" loading={tsBusy} onPress={clearAlert} />
              ) : null}
            </View>
            <Divider style={{ marginVertical: space.md }} />
            <View style={[ui.row, { gap: space.md }]}>
              <Ionicons
                name={venue.contributionFrozen ? 'snow' : 'snow-outline'}
                size={18}
                color={venue.contributionFrozen ? theme.closed : theme.textFaint}
              />
              <Text style={[font.body, { color: theme.text, flex: 1 }]}>
                {venue.contributionFrozen ? 'New reviews are frozen' : 'Contribution is open'}
              </Text>
              <Button
                label={venue.contributionFrozen ? 'Unfreeze' : 'Freeze'}
                variant="secondary"
                loading={tsBusy}
                onPress={toggleFreeze}
              />
            </View>
            <Body dim style={{ marginTop: space.md }}>
              Freezing blocks new reviews at this listing (R12: "freeze contribution on a
              listing"). It does not touch reviews already published.
            </Body>
          </Card>
        </View>
      ) : null}

      {/* F-MSG: message the venue directly, or send a structured private-event
          request. R3 (verified) is required, same as booking. */}
      <View style={gutter()}>
        <SectionHeader title="Message this venue" />
        <Card>
          <View style={[ui.row, { gap: space.md }]}>
            <IconBadge icon="chatbubbles" size={38} />
            <View style={{ flex: 1 }}>
              <Text style={[font.bodyStrong, { color: theme.text }]}>
                {venue.avgResponseMinutes
                  ? `Usually responds within ${
                      venue.avgResponseMinutes < 60
                        ? `${venue.avgResponseMinutes} min`
                        : venue.avgResponseMinutes < 24 * 60
                          ? `${Math.round(venue.avgResponseMinutes / 60)} hr`
                          : `${Math.round(venue.avgResponseMinutes / (24 * 60))} days`
                    }`
                  : 'Response time not published'}
              </Text>
              <Body dim style={{ marginTop: 2 }}>
                Nothing is charged and no commitment is created by messaging.
              </Body>
            </View>
          </View>
          <View style={[ui.row, { gap: space.sm, marginTop: space.lg, flexWrap: 'wrap' }]}>
            <Button label="Message" icon="chatbubble" variant="secondary" onPress={() => openThread('general')} />
            <Button label="Request a quote" icon="calendar" variant="secondary" onPress={() => openThread('quote_request')} />
          </View>
        </Card>
      </View>

      {/* Similar venues, excluding paid placement. */}
      {similar.length ? (
        <View style={gutter()}>
          <SectionHeader title="Similar venues" subtitle="Organic only, no paid placement in this module" />
          {similar.map((v) => (
            <VenueCard key={v.id} venue={v} compact />
          ))}
        </View>
      ) : null}

      {/* Report path. */}
      <View style={gutter()}>
        <Pressable
          onPress={() =>
            Alert.alert('Report this listing', 'Choose a reason', [
              { text: 'Closed or moved' },
              { text: 'Wrong category or attributes' },
              { text: 'Duplicate listing' },
              { text: 'Cancel', style: 'cancel' },
            ])
          }
          accessibilityRole="button"
          accessibilityLabel="Report a problem with this listing"
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[font.small, { color: theme.onGroundDim, textDecorationLine: 'underline' }]}>
            Report a problem with this listing
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function StaleNote({ venue, attrKey }: { venue: Venue; attrKey: string }) {
  const theme = useTheme();
  const { now } = useApp();
  const f = freshness(venue, attrKey, now);
  if (!f.note) return null;
  return (
    <Text style={[font.small, { color: f.stale ? theme.warn : theme.textFaint, marginTop: space.md }]}>
      {f.stale ? '⚠ ' : ''}
      Cover charge: {f.note}
    </Text>
  );
}

function Busyness({ data, now }: { data: Partial<Record<number, number>>; now: Date }) {
  const theme = useTheme();
  const hours = Object.keys(data)
    .map(Number)
    .sort((a, b) => (a < 5 ? a + 24 : a) - (b < 5 ? b + 24 : b));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 }}>
        {hours.map((h) => {
          const v = data[h] ?? 0;
          const isNow = h === now.getHours();
          return (
            <View key={h} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: '100%',
                  height: Math.max(4, v * 68),
                  borderRadius: 4,
                  backgroundColor: isNow ? theme.accent : theme.accentSoft,
                }}
                accessibilityLabel={`${formatTime(`${String(h).padStart(2, '0')}:00`)}: ${Math.round(v * 100)} percent of peak`}
              />
              <Text style={[font.micro, { color: isNow ? theme.accent : theme.textFaint }]}>
                {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function menuTitle(v: string): string {
  switch (v) {
    case 'bar':
      return 'On tap';
    case 'cigar':
      return 'Humidor highlights';
    case 'nightclub':
      return 'Bottle menu';
    case 'lounge':
      return 'Menu and bottle service';
    default:
      return 'Menu';
  }
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Body, Button, Callout, Card, Divider, gutter, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { getVenueBookings, updateBookingStatus } from '@/data/repository';
import { bookingModeLabel, money } from '@/lib/format';
import { formatTime } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { Booking } from '@/types';

/**
 * F-BIZ-11, scoped: a business account's view of bookings and waitlist
 * entries at a venue it manages, with the operational actions R7/R8/R9 are
 * supposed to have per the permission matrix (Section 2.4) — confirm,
 * cancel a no-show, seat or remove a waitlisted party. No floor map, no
 * real-time table-tier status, no staff assignment — see the migration
 * header on 20260826120000_add_business_bookings.sql for why those are a
 * separate, larger feature.
 */
export default function VenueBookingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue } = useCatalogue();

  const venue = getVenue(venueId);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  const load = useCallback(() => {
    if (!venue) return;
    setLoading(true);
    getVenueBookings(venue.id)
      .then(setBookings)
      .finally(() => setLoading(false));
  }, [venue?.id]);

  useEffect(() => {
    if (venue && isManagingVenue(venue.id)) load();
    else setLoading(false);
  }, [venue?.id]);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Bookings" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Bookings" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Managing bookings needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Bookings" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can see its bookings.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const act = async (booking: Booking, status: 'confirmed' | 'cancelled') => {
    setBusyId(booking.id);
    setError(null);
    const result = await updateBookingStatus({ bookingId: booking.id, status });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
  };

  const open = bookings.filter((b) => b.status !== 'cancelled');
  const cancelled = bookings.filter((b) => b.status === 'cancelled');

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Bookings" subtitle={venue.name} onBack={() => router.back()} />

      {error ? (
        <View style={gutter()}>
          <Text style={[font.small, { color: theme.closed }]}>{error}</Text>
        </View>
      ) : null}

      <View style={gutter()}>
        <Card padded={false}>
          {loading ? (
            <Body dim style={{ padding: space.lg }}>Loading…</Body>
          ) : open.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>Nothing on the books yet.</Body>
          ) : (
            open.map((b, i) => (
              <View key={b.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ padding: space.lg }}>
                  <View style={[ui.row, { gap: space.sm }]}>
                    <Text style={[font.body, { color: theme.text, flex: 1 }]}>
                      {b.guestName ?? 'Guest'} · {b.partySize} {b.partySize === 1 ? 'guest' : 'guests'}
                    </Text>
                    <Text style={[font.small, { color: theme.textFaint }]}>{bookingModeLabel[b.kind]}</Text>
                  </View>
                  <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]}>
                    {b.date} · {formatTime(b.time)}
                    {b.tier ? ` · ${b.tier}` : ''}
                    {b.deposit ? ` · ${money(b.deposit)} deposit` : ''}
                  </Text>
                  {b.status === 'waitlisted' ? (
                    <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                      Waitlist position {b.waitlistPosition ?? '—'} · ~{b.waitMinutes ?? '—'} min
                    </Text>
                  ) : null}
                  {b.notes ? (
                    <Body dim style={{ marginTop: space.sm }}>{b.notes}</Body>
                  ) : null}
                  <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
                    <Text
                      style={[
                        font.small,
                        {
                          color:
                            b.status === 'confirmed' ? theme.open
                              : b.status === 'requested' ? theme.warn
                                : theme.textDim,
                        },
                      ]}
                    >
                      {b.status === 'confirmed' ? 'Confirmed' : b.status === 'requested' ? 'Requested' : 'Waitlisted'}
                    </Text>
                    <View style={{ flex: 1 }} />
                    {b.status !== 'confirmed' ? (
                      <Button
                        label={b.status === 'waitlisted' ? 'Seat now' : 'Confirm'}
                        loading={busyId === b.id}
                        onPress={() => act(b, 'confirmed')}
                      />
                    ) : null}
                    <Button
                      label={b.status === 'waitlisted' ? 'Remove' : 'Cancel'}
                      variant="ghost"
                      loading={busyId === b.id}
                      onPress={() => act(b, 'cancelled')}
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>
      </View>

      {cancelled.length ? (
        <>
          <View style={gutter()}>
            <Text style={[font.cardTitle, { color: theme.onGround }]}>Cancelled</Text>
          </View>
          <View style={gutter()}>
            <Card padded={false}>
              {cancelled.map((b, i) => (
                <View key={b.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: space.lg }}>
                    <Text style={[font.body, { color: theme.textDim }]}>
                      {b.guestName ?? 'Guest'} · {b.date} · {formatTime(b.time)} · {bookingModeLabel[b.kind]}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

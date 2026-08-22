import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { TableMap } from '@/components/TableMap';
import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
  SectionHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { bookingModeLabel, money } from '@/lib/format';
import { formatTime, isOpenAt, venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Booking, BookingMode, TableTier, Venue } from '@/types';

/**
 * Booking, adapted to what the venue actually does (F-BOOK).
 *
 * A single "Reserve" flow does not survive contact with these five verticals.
 * A steakhouse takes reservations; a dive bar takes nothing; a taproom books
 * tour slots; a sports bar holds a booth for a specific game; a club sells a
 * table with a minimum and a deposit; a cigar lounge routes a membership
 * inquiry. Each of those is a different form, so this screen picks the form from
 * the venue's booking modes rather than showing a Reserve button that fails.
 */
export default function BookScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id, intent } = useLocalSearchParams<{ id: string; intent?: string }>();
  const { getVenue } = useCatalogue();
  const venue = getVenue(id);

  const initial = useMemo<BookingMode | null>(() => {
    if (!venue) return null;
    const map: Record<string, BookingMode> = {
      reserve: 'reservation',
      table: 'table_service',
      hold: 'bar_hold',
      waitlist: 'waitlist',
      membership: 'inquiry',
      guestlist: 'waitlist',
    };
    const wanted = intent ? map[intent] : undefined;
    const usable: BookingMode[] = venue.bookingModes.filter((m) => m !== 'walk_in');
    if (wanted && usable.includes(wanted)) return wanted;
    return usable[0] ?? null;
  }, [venue, intent]);

  const [mode, setMode] = useState<BookingMode | null>(initial);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Book" onBack={() => router.back()} />
      </Screen>
    );
  }

  const usable = venue.bookingModes.filter((m) => m !== 'walk_in');

  if (!usable.length) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Walk-in only" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="walk" size={52} />
              <Text style={[font.cardTitle, { color: theme.text, textAlign: 'center' }]}>
                This venue takes no bookings
              </Text>
              <Body dim style={{ textAlign: 'center' }}>
                No reservations, no holds, no waitlist. Turn up and see. That is a real answer, not a
                missing feature, so there is no Reserve button on the profile either.
              </Body>
              <Button label="Back to the venue" onPress={() => router.back()} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title={mode ? bookingModeLabel[mode] : 'Book'}
        subtitle={venue.name}
        onBack={() => router.back()}
      />

      {usable.length > 1 ? (
        <View style={[gutter(), { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }]}>
          {usable.map((m) => (
            <Chip
              key={m}
              label={bookingModeLabel[m]}
              tone="ground"
              selected={mode === m}
              onPress={() => setMode(m)}
            />
          ))}
        </View>
      ) : null}

      {mode === 'reservation' ? <ReservationForm venue={venue} /> : null}
      {mode === 'table_service' ? <TableServiceForm venue={venue} /> : null}
      {mode === 'waitlist' ? <WaitlistForm venue={venue} /> : null}
      {mode === 'bar_hold' ? <BarHoldForm venue={venue} /> : null}
      {mode === 'inquiry' ? <InquiryForm venue={venue} /> : null}
    </Screen>
  );
}

/* ------------------------------------------------------------ shared bits */

function useDates(count = 7): { iso: string; label: string; dow: number }[] {
  const { now } = useApp();
  return useMemo(() => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      out.push({
        iso: d.toISOString().slice(0, 10),
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getDate()}`,
        dow: d.getDay(),
      });
    }
    return out;
  }, [now, count]);
}

function PartySize({ value, onChange, max = 20 }: { value: number; onChange: (n: number) => void; max?: number }) {
  const theme = useTheme();
  return (
    <View>
      <Label>Party size</Label>
      <View style={[ui.row, { gap: space.md, marginTop: space.sm }]}>
        <Pressable
          onPress={() => onChange(Math.max(1, value - 1))}
          accessibilityRole="button"
          accessibilityLabel="Decrease party size"
          style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: theme.cardMuted,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="remove" size={20} color={theme.text} />
        </Pressable>
        <Text style={[font.title, { color: theme.text, minWidth: 44, textAlign: 'center' }]} accessibilityLabel={`${value} guests`}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          accessibilityRole="button"
          accessibilityLabel="Increase party size"
          style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: theme.cardMuted,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={20} color={theme.text} />
        </Pressable>
        <Text style={[font.small, { color: theme.textDim, flex: 1 }]}>
          {value >= 8 ? 'Large parties may require a card hold' : 'guests'}
        </Text>
      </View>
    </View>
  );
}

/** Deterministic pseudo-availability so the grid is stable across renders. */
function slotOpen(venueId: string, iso: string, time: string, party: number): boolean {
  let h = 0;
  const s = `${venueId}|${iso}|${time}|${party > 6 ? 'big' : 'small'}`;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 10 > (party > 6 ? 4 : 2);
}

function slotsFor(venue: Venue, dow: number): string[] {
  const out: string[] = [];
  for (let m = 17 * 60; m <= 22 * 60; m += 30) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    if (isOpenAt(venue, dow, t)) out.push(t);
  }
  return out;
}

/** F-BOOK-11: terms shown before payment, with affirmative acceptance captured. */
function TermsBlock({
  venue,
  accepted,
  onAccept,
  deposit,
}: {
  venue: Venue;
  accepted: boolean;
  onAccept: (v: boolean) => void;
  deposit?: number;
}) {
  const theme = useTheme();
  if (!venue.bookingTerms) return null;
  return (
    <Card>
      <Label>Deposit, cancellation, and refund terms</Label>
      <Body dim style={{ marginTop: space.sm }}>{venue.bookingTerms}</Body>
      {deposit ? (
        <View
          style={{
            marginTop: space.md,
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: theme.inset,
          }}
        >
          <Text style={[font.small, { color: theme.insetDim }]}>Charged now</Text>
          <Text style={[font.title, { color: theme.insetText }]}>{money(deposit)}</Text>
          <Text style={[font.small, { color: theme.insetDim, marginTop: 2 }]}>
            Applied to your minimum, not additional to it
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={() => onAccept(!accepted)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel="I accept the deposit, cancellation, and refund terms"
        style={[ui.row, { gap: space.md, marginTop: space.md, minHeight: 44 }]}
      >
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={22} color={accepted ? theme.accent : theme.textFaint} />
        <Text style={[font.body, { color: theme.text, flex: 1 }]}>
          I have read and accept these terms
        </Text>
      </Pressable>
    </Card>
  );
}

function Confirmed({ booking, venue }: { booking: Booking; venue: Venue }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={[gutter(), { gap: space.md }]}>
      <Card>
        <View style={{ alignItems: 'center', gap: space.md }}>
          <IconBadge
            icon={booking.status === 'waitlisted' ? 'time' : booking.status === 'requested' ? 'paper-plane' : 'checkmark-circle'}
            size={56}
            variant="solid"
          />
          <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>
            {booking.status === 'waitlisted'
              ? 'You are on the list'
              : booking.status === 'requested'
                ? 'Request sent'
                : 'Confirmed'}
          </Text>
          <Body dim style={{ textAlign: 'center' }}>
            {booking.status === 'waitlisted'
              ? `Position ${booking.waitlistPosition}, roughly ${booking.waitMinutes} minutes. We will notify you when your table is ready.`
              : booking.status === 'requested'
                ? 'The venue will reply here and by email. Nothing has been charged.'
                : 'Confirmation sent by push and email. It stays readable on this device without signal.'}
          </Body>
        </View>

        <Divider style={{ marginVertical: space.lg }} />

        <Row label="Venue" value={venue.name} />
        <Row label="Type" value={bookingModeLabel[booking.kind]} />
        {booking.kind !== 'waitlist' && booking.kind !== 'inquiry' ? (
          <>
            <Row label="Date" value={booking.date} />
            <Row label="Time" value={formatTime(booking.time)} />
          </>
        ) : null}
        <Row label="Party" value={`${booking.partySize} guests`} />
        {booking.tier ? <Row label="Table" value={booking.tier} /> : null}
        {booking.deposit ? <Row label="Deposit charged" value={money(booking.deposit)} /> : null}
        {booking.notes ? <Row label="Notes" value={booking.notes} /> : null}
      </Card>

      <Button label="Done" full onPress={() => router.replace(`/venue/${venue.id}`)} />
      <Text style={[font.small, { color: theme.onGroundFaint, textAlign: 'center' }]}>
        Prototype: nothing was actually reserved and no payment was taken.
      </Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[ui.row, { paddingVertical: 6, alignItems: 'flex-start' }]}>
      <Text style={[font.body, { color: theme.textDim, flex: 1 }]}>{label}</Text>
      <Text style={[font.bodyStrong, { color: theme.text, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------- reservation form */

function ReservationForm({ venue }: { venue: Venue }) {
  const theme = useTheme();
  const { addBooking, now } = useApp();
  const { venues } = useCatalogue();
  const dates = useDates();
  const [dateIdx, setDateIdx] = useState(0);
  const [party, setParty] = useState(2);
  const [time, setTime] = useState<string | null>(null);
  const [seating, setSeating] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);

  const date = dates[dateIdx];
  const slots = slotsFor(venue, date.dow);
  const availability = slots.map((t) => ({ time: t, open: slotOpen(venue.id, date.iso, t, party) }));
  const anyOpen = availability.some((a) => a.open);

  /** F-BOOK-02: nearby alternatives when the requested slot is unavailable. */
  const alternatives = useMemo(
    () =>
      venues
        .filter(
          (v) =>
            v.id !== venue.id &&
            !v.closure &&
            v.bookingModes.includes('reservation') &&
            v.primary.vertical === venue.primary.vertical,
        )
        .slice(0, 2),
    [venue],
  );

  if (booking) return <Confirmed booking={booking} venue={venue} />;

  const needsTerms = party >= 8 && !!venue.bookingTerms;

  return (
    <View style={[gutter(), { gap: space.lg }]}>
      <Card>
        <Label>Date</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {dates.map((d, i) => (
            <Chip key={d.iso} label={d.label} selected={dateIdx === i} onPress={() => { setDateIdx(i); setTime(null); }} />
          ))}
        </View>
        <Divider style={{ marginVertical: space.lg }} />
        <PartySize value={party} onChange={(n) => { setParty(n); setTime(null); }} />
      </Card>

      <Card>
        <Label>Times</Label>
        {slots.length === 0 ? (
          <Body dim style={{ marginTop: space.sm }}>
            Closed on {date.label.toLowerCase()}. Pick another date.
          </Body>
        ) : (
          <>
            <Text style={[font.small, { color: theme.textFaint, marginTop: 2, marginBottom: space.md }]}>
              Adjacent slots are shown so you can see what is near your first choice.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {availability.map((a) => (
                <Pressable
                  key={a.time}
                  disabled={!a.open}
                  onPress={() => setTime(a.time)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: time === a.time, disabled: !a.open }}
                  accessibilityLabel={`${formatTime(a.time)}${a.open ? '' : ', unavailable'}`}
                  style={{
                    minWidth: 78,
                    minHeight: 44,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: time === a.time ? theme.accent : a.open ? theme.cardMuted : 'transparent',
                    borderWidth: a.open ? 0 : 1,
                    borderColor: theme.cardBorder,
                    opacity: a.open ? 1 : 0.5,
                  }}
                >
                  <Text
                    style={[
                      font.bodyStrong,
                      {
                        color: time === a.time ? theme.accentText : a.open ? theme.text : theme.textFaint,
                        textDecorationLine: a.open ? 'none' : 'line-through',
                      },
                    ]}
                  >
                    {formatTime(a.time)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {!anyOpen && slots.length > 0 ? (
          <View style={{ marginTop: space.md }}>
            <Callout tone="warn" icon="calendar" title={`Nothing open for ${party} on ${date.label.toLowerCase()}`}>
              <Body dim>
                Try a smaller party, another date, or one of the alternatives below.
              </Body>
            </Callout>
          </View>
        ) : null}
      </Card>

      {venue.attributes.avgTurnMinutes ? (
        <Card>
          <View style={[ui.row, { gap: space.md }]}>
            <IconBadge icon="hourglass" size={38} />
            <View style={{ flex: 1 }}>
              <Text style={[font.bodyStrong, { color: theme.text }]}>
                Table turn is about {venue.attributes.avgTurnMinutes} minutes
              </Text>
              <Body dim style={{ marginTop: 2 }}>
                Useful if you have somewhere to be after, or want to know how long you can linger.
              </Body>
            </View>
          </View>
        </Card>
      ) : null}

      <Card>
        <Label>Seating preference</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {['No preference', 'Booth', 'Bar', 'Patio', 'Quiet corner'].map((s) => (
            <Chip key={s} label={s} selected={seating === s} onPress={() => setSeating(seating === s ? null : s)} />
          ))}
        </View>
        <Divider style={{ marginVertical: space.lg }} />
        <Label>Special requests</Label>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Allergies, occasion, accessibility needs, anything the host should know"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel="Special requests"
          style={[
            font.body,
            {
              color: theme.text,
              backgroundColor: theme.cardMuted,
              borderRadius: radius.md,
              padding: space.md,
              minHeight: 88,
              marginTop: space.sm,
              textAlignVertical: 'top',
            },
          ]}
        />
      </Card>

      {needsTerms ? (
        <TermsBlock venue={venue} accepted={accepted} onAccept={setAccepted} />
      ) : null}

      <Button
        label={time ? `Confirm ${formatTime(time)} for ${party}` : 'Pick a time'}
        full
        disabled={!time || (needsTerms && !accepted)}
        onPress={() => {
          if (!time) return;
          const b: Booking = {
            id: `b-${Date.now()}`,
            venueId: venue.id,
            kind: 'reservation',
            date: date.iso,
            time,
            partySize: party,
            status: 'confirmed',
            notes: [seating && seating !== 'No preference' ? seating : null, notes.trim() || null]
              .filter(Boolean)
              .join(' · ') || undefined,
            createdAt: now.toISOString(),
          };
          addBooking(b);
          setBooking(b);
        }}
      />

      {alternatives.length && !anyOpen ? (
        <View>
          <SectionHeader title="Nearby alternatives" subtitle="Same category, taking reservations" />
          {alternatives.map((v) => (
            <Card key={v.id} style={{ marginBottom: space.md }}>
              <View style={[ui.row]}>
                <View style={{ flex: 1 }}>
                  <Text style={[font.cardTitle, { color: theme.text }]}>{v.name}</Text>
                  <Text style={[font.meta, { color: theme.textDim }]}>
                    {v.primary.category} · {v.distanceMi.toFixed(1)} mi · {venueState(v, now).label}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------- table service form */

function TableServiceForm({ venue }: { venue: Venue }) {
  const theme = useTheme();
  const { addBooking, now } = useApp();
  const dates = useDates();
  const [dateIdx, setDateIdx] = useState(0);
  const [table, setTable] = useState<TableTier | null>(null);
  const [party, setParty] = useState(4);
  const [window, setWindow] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);

  const tables = venue.tables ?? [];
  const sections = Array.from(new Set(tables.map((t) => t.section)));
  const depositPct = venue.primary.vertical === 'nightclub' ? 0.3 : 0.25;
  const deposit = table ? Math.round(table.minimumSpend * depositPct) : 0;
  const serviceCharge = table ? Math.round(table.minimumSpend * 0.22) : 0;

  const windows = ['21:30', '22:30', '23:30', '00:30'];

  if (booking) return <Confirmed booking={booking} venue={venue} />;

  return (
    <View style={[gutter(), { gap: space.lg }]}>
      <Card>
        <Label>Date</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {dates.slice(0, 5).map((d, i) => (
            <Chip key={d.iso} label={d.label} selected={dateIdx === i} onPress={() => setDateIdx(i)} />
          ))}
        </View>
      </Card>

      <Card>
        <Label>Choose a table</Label>
        <Text style={[font.small, { color: theme.textFaint, marginTop: 2, marginBottom: space.md }]}>
          Minimums are per table, not per person, and shown before you pick.
        </Text>
        <TableMap tables={tables} selectedId={table?.id ?? null} onSelect={setTable} />

        <Divider style={{ marginVertical: space.lg }} />
        {sections.map((s) => {
          const inSection = tables.filter((t) => t.section === s);
          const min = Math.min(...inSection.map((t) => t.minimumSpend));
          const free = inSection.filter((t) => t.available).length;
          return (
            <View key={s} style={[ui.row, { paddingVertical: space.sm }]}>
              <View style={{ flex: 1 }}>
                <Text style={[font.bodyStrong, { color: theme.text }]}>{s}</Text>
                <Text style={[font.small, { color: theme.textDim }]}>
                  {free} of {inSection.length} available · seats {inSection[0].seats}
                </Text>
              </View>
              <Text style={[font.bodyStrong, { color: theme.text }]}>from {money(min)}</Text>
            </View>
          );
        })}
      </Card>

      {table ? (
        <Card>
          <Label>What this costs</Label>
          <View style={{ marginTop: space.sm }}>
            <Row label={`Table ${table.name} minimum`} value={money(table.minimumSpend)} />
            <Row label="Service charge, 22% of minimum" value={money(serviceCharge)} />
            <Row label={`Deposit now (${Math.round(depositPct * 100)}%)`} value={money(deposit)} />
            <Divider style={{ marginVertical: space.sm }} />
            <Row label="Applied to your tab" value={money(deposit)} />
          </View>
          <View style={{ marginTop: space.md }}>
            <Callout tone="warn" icon="alert-circle" title="The service charge is calculated on the full minimum">
              <Body dim>
                Not on what you actually spend, and it is not the tip. This is the single most common
                surprise in table-service reviews, so it is stated here rather than at the table.
              </Body>
            </Callout>
          </View>
        </Card>
      ) : null}

      <Card>
        <PartySize value={party} onChange={setParty} max={table?.seats ?? 12} />
        {table && party > table.seats ? (
          <Text style={[font.small, { color: theme.warn, marginTop: space.sm }]}>
            Table {table.name} seats {table.seats}. Larger parties need a bigger section.
          </Text>
        ) : null}
        <Divider style={{ marginVertical: space.lg }} />
        <Label>Arrival window</Label>
        <Text style={[font.small, { color: theme.textFaint, marginTop: 2, marginBottom: space.sm }]}>
          Tables are held for 30 minutes past the start of the window.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {windows.map((w) => (
            <Chip key={w} label={formatTime(w)} selected={window === w} onPress={() => setWindow(w)} />
          ))}
        </View>
      </Card>

      <TermsBlock venue={venue} accepted={accepted} onAccept={setAccepted} deposit={deposit} />

      <Button
        label={
          !table ? 'Pick a table' : !window ? 'Pick an arrival window' : `Pay ${money(deposit)} deposit`
        }
        icon="card"
        full
        disabled={!table || !window || !accepted || party > table.seats}
        onPress={() => {
          if (!table || !window) return;
          // U-03: a financial action confirms with the consequence stated.
          Alert.alert(
            `Charge ${money(deposit)} now?`,
            `This deposit is applied to your ${money(table.minimumSpend)} minimum. ${
              venue.bookingTerms ?? ''
            }`,
            [
              { text: 'Go back', style: 'cancel' },
              {
                text: `Pay ${money(deposit)}`,
                onPress: () => {
                  const b: Booking = {
                    id: `b-${Date.now()}`,
                    venueId: venue.id,
                    kind: 'table_service',
                    date: dates[dateIdx].iso,
                    time: window,
                    partySize: party,
                    tier: `${table.name} · ${table.section}`,
                    deposit,
                    status: 'confirmed',
                    createdAt: now.toISOString(),
                  };
                  addBooking(b);
                  setBooking(b);
                },
              },
            ],
          );
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------- waitlist form */

function WaitlistForm({ venue }: { venue: Venue }) {
  const theme = useTheme();
  const { addBooking, now } = useApp();
  const [party, setParty] = useState(2);
  const [booking, setBooking] = useState<Booking | null>(null);

  const state = venueState(venue, now);
  const hour = now.getHours();
  const busy = venue.busyness?.[hour] ?? 0.5;
  const position = Math.max(1, Math.round(busy * 14) + (party > 4 ? 3 : 0));
  const wait = Math.max(5, Math.round(position * (party > 4 ? 7 : 4.5)));

  if (booking) return <Confirmed booking={booking} venue={venue} />;

  return (
    <View style={[gutter(), { gap: space.lg }]}>
      {!state.open ? (
        <Callout tone="warn" icon="time" title="Closed right now">
          <Body dim>{state.label}. The waitlist opens when the doors do.</Body>
        </Callout>
      ) : null}

      <Card>
        <View style={[ui.row, { gap: space.md, marginBottom: space.lg }]}>
          <IconBadge icon="people" size={44} />
          <View style={{ flex: 1 }}>
            <Text style={[font.cardTitle, { color: theme.text }]}>Join from wherever you are</Text>
            <Body dim style={{ marginTop: 2 }}>
              You keep your place while you travel. We notify you when the table is ready.
            </Body>
          </View>
        </View>
        <PartySize value={party} onChange={setParty} max={12} />
      </Card>

      <Card>
        <Label>Current estimate</Label>
        <View style={[ui.row, { gap: space.md, marginTop: space.md }]}>
          <View style={{ flex: 1, backgroundColor: theme.inset, borderRadius: radius.md, padding: space.md }}>
            <Text style={[font.small, { color: theme.insetDim }]}>Position</Text>
            <Text style={[font.title, { color: theme.insetText }]}>{position}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: theme.inset, borderRadius: radius.md, padding: space.md }}>
            <Text style={[font.small, { color: theme.insetDim }]}>Estimated wait</Text>
            <Text style={[font.title, { color: theme.insetText }]}>{wait} min</Text>
          </View>
        </View>
        <Text style={[font.small, { color: theme.textFaint, marginTop: space.md }]}>
          Estimated from reported busyness at this hour and your party size. Larger parties wait
          longer because fewer tables fit them.
        </Text>
      </Card>

      <Button
        label={`Join the waitlist for ${party}`}
        full
        disabled={!state.open}
        onPress={() => {
          const b: Booking = {
            id: `b-${Date.now()}`,
            venueId: venue.id,
            kind: 'waitlist',
            date: now.toISOString().slice(0, 10),
            time: `${String(hour).padStart(2, '0')}:00`,
            partySize: party,
            status: 'waitlisted',
            waitlistPosition: position,
            waitMinutes: wait,
            createdAt: now.toISOString(),
          };
          addBooking(b);
          setBooking(b);
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------- bar hold form */

/**
 * F-BOOK-09a. Most bars do not take conventional reservations, but they do hold
 * a booth for a specific game, block high-tops for a stated arrival window, take
 * a large-party or buyout request, and book brewery tour slots. Those are the
 * bar-appropriate primitives.
 */
function BarHoldForm({ venue }: { venue: Venue }) {
  const theme = useTheme();
  const { addBooking, now } = useApp();
  const dates = useDates();
  const [dateIdx, setDateIdx] = useState(0);
  const [kind, setKind] = useState<string | null>(null);
  const [party, setParty] = useState(6);
  const [window, setWindow] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);

  const options = useMemo(() => {
    const out: { key: string; label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
      { key: 'high_top', label: 'High-top or booth hold', detail: 'Held for a stated arrival window, then released', icon: 'grid' },
      { key: 'large_party', label: 'Large party', detail: 'Eight or more, food and beverage minimum quoted first', icon: 'people' },
    ];
    if (venue.attributes.sportsViewing) {
      out.push({ key: 'game_day', label: 'Game-day table', detail: 'Reserve a booth for a specific game', icon: 'american-football' });
    }
    if (venue.attributes.breweryTours) {
      out.push({ key: 'tour', label: 'Brewery tour or flight', detail: 'Timed slot, tours fill on Saturdays', icon: 'beer' });
    }
    out.push({ key: 'buyout', label: 'Buyout or private event', detail: 'Whole bar or a section, quoted by the venue', icon: 'lock-closed' });
    return out;
  }, [venue]);

  const windows = venue.attributes.breweryTours && kind === 'tour' ? ['14:00', '16:00'] : ['17:00', '19:00', '21:00', '22:30'];
  const requestOnly = kind === 'large_party' || kind === 'buyout';

  if (booking) return <Confirmed booking={booking} venue={venue} />;

  return (
    <View style={[gutter(), { gap: space.lg }]}>
      <Callout tone="info" icon="information-circle" title="This bar does not take conventional reservations">
        <Body dim>
          What it does take is listed below. A bar that takes none of these presents as walk-in-only
          instead of showing a button that goes nowhere.
        </Body>
      </Callout>

      <Card>
        <Label>What do you need</Label>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {options.map((o) => {
            const on = kind === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => { setKind(o.key); setWindow(null); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${o.label}. ${o.detail}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.md,
                  minHeight: 60,
                  borderRadius: radius.md,
                  backgroundColor: on ? theme.accentSoft : theme.cardMuted,
                }}
              >
                <Ionicons name={o.icon} size={20} color={on ? theme.accent : theme.textDim} />
                <View style={{ flex: 1 }}>
                  <Text style={[font.bodyStrong, { color: theme.text }]}>{o.label}</Text>
                  <Text style={[font.small, { color: theme.textDim }]}>{o.detail}</Text>
                </View>
                <Ionicons
                  name={on ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={on ? theme.accent : theme.textFaint}
                />
              </Pressable>
            );
          })}
        </View>
      </Card>

      {kind ? (
        <Card>
          <Label>Date</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {dates.map((d, i) => (
              <Chip key={d.iso} label={d.label} selected={dateIdx === i} onPress={() => setDateIdx(i)} />
            ))}
          </View>
          <Divider style={{ marginVertical: space.lg }} />
          <Label>{kind === 'tour' ? 'Tour slot' : 'Arrival window'}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {windows.map((w) => (
              <Chip key={w} label={formatTime(w)} selected={window === w} onPress={() => setWindow(w)} />
            ))}
          </View>
          <Divider style={{ marginVertical: space.lg }} />
          <PartySize value={party} onChange={setParty} max={40} />
          {kind === 'game_day' || requestOnly ? (
            <>
              <Divider style={{ marginVertical: space.lg }} />
              <Label>{kind === 'game_day' ? 'Which game' : 'Details'}</Label>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={
                  kind === 'game_day'
                    ? 'Texans vs. Colts, Sunday 12 PM'
                    : 'Headcount, budget range, food and beverage needs, AV needs'
                }
                placeholderTextColor={theme.textFaint}
                accessibilityLabel="Details"
                style={[
                  font.body,
                  {
                    color: theme.text,
                    backgroundColor: theme.cardMuted,
                    borderRadius: radius.md,
                    padding: space.md,
                    minHeight: 80,
                    marginTop: space.sm,
                    textAlignVertical: 'top',
                  },
                ]}
              />
            </>
          ) : null}
        </Card>
      ) : null}

      {kind && venue.bookingTerms ? (
        <TermsBlock venue={venue} accepted={accepted} onAccept={setAccepted} />
      ) : null}

      <Button
        label={!kind ? 'Pick what you need' : !window ? 'Pick a time' : requestOnly ? 'Send request' : 'Hold it'}
        full
        disabled={!kind || !window || (!!venue.bookingTerms && !accepted)}
        onPress={() => {
          if (!kind || !window) return;
          const b: Booking = {
            id: `b-${Date.now()}`,
            venueId: venue.id,
            kind: 'bar_hold',
            date: dates[dateIdx].iso,
            time: window,
            partySize: party,
            status: requestOnly ? 'requested' : 'confirmed',
            notes: [options.find((o) => o.key === kind)?.label, notes.trim() || null].filter(Boolean).join(' · '),
            createdAt: now.toISOString(),
          };
          addBooking(b);
          setBooking(b);
        }}
      />
    </View>
  );
}

/* ----------------------------------------------------------- inquiry form */

/** F-BOOK-09: cigar lounge membership inquiry and locker waitlist request. */
function InquiryForm({ venue }: { venue: Venue }) {
  const theme = useTheme();
  const { addBooking, now } = useApp();
  const [topic, setTopic] = useState<'membership' | 'locker' | 'event'>('membership');
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);

  const locker = venue.attributes.lockerProgram;
  const model = venue.attributes.membershipModel;
  const dues = venue.attributes.membershipPrice;
  const lockerPrice = venue.attributes.lockerPriceMonthly;

  if (booking) return <Confirmed booking={booking} venue={venue} />;

  return (
    <View style={[gutter(), { gap: space.lg }]}>
      <Card>
        <Label>What are you asking about</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          <Chip label="Membership" selected={topic === 'membership'} onPress={() => setTopic('membership')} />
          <Chip label="Locker" selected={topic === 'locker'} onPress={() => setTopic('locker')} />
          <Chip label="Private event" selected={topic === 'event'} onPress={() => setTopic('event')} />
        </View>
      </Card>

      <Card>
        <Label>What the venue publishes</Label>
        <View style={{ marginTop: space.sm }}>
          {model ? (
            <Row
              label="Membership model"
              value={
                model === 'invitation'
                  ? 'Invitation only'
                  : model === 'dues'
                    ? `Dues-based${dues ? `, ${money(Number(dues))}/mo` : ''}`
                    : model === 'purchase_minimum'
                      ? 'Purchase minimum'
                      : 'No membership'
              }
            />
          ) : null}
          {venue.attributes.membershipGuests ? (
            <Row label="Guest privileges" value={String(venue.attributes.membershipGuests)} />
          ) : null}
          {locker ? (
            <Row
              label="Lockers"
              value={
                locker === 'available'
                  ? `Available${lockerPrice ? ` from ${money(Number(lockerPrice))}/mo` : ''}`
                  : locker === 'waitlist'
                    ? 'Waitlist'
                    : locker === 'full'
                      ? 'Full, no list'
                      : 'Not offered'
              }
            />
          ) : null}
          {venue.attributes.byocPolicy ? (
            <Row
              label="Bring your own cigar"
              value={
                venue.attributes.byocPolicy === 'permitted_free'
                  ? 'Permitted, no fee'
                  : venue.attributes.byocPolicy === 'permitted_with_fee'
                    ? `Permitted, ${venue.attributes.cutFee ? money(Number(venue.attributes.cutFee)) : ''} cut fee`
                    : 'Not permitted'
              }
            />
          ) : null}
        </View>

        {locker === 'full' && topic === 'locker' ? (
          <View style={{ marginTop: space.md }}>
            <Callout tone="warn" icon="lock-closed" title="Lockers are full with no waitlist">
              <Body dim>
                The venue reports no list at the moment. You can still ask to be told when that
                changes.
              </Body>
            </Callout>
          </View>
        ) : null}
      </Card>

      <Card>
        <Label>Your message</Label>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder={
            topic === 'membership'
              ? 'How often you visit, what you smoke, whether you want guest privileges'
              : topic === 'locker'
                ? 'Locker size you want and whether you are already a member'
                : 'Date, headcount, and what you need from the space'
          }
          placeholderTextColor={theme.textFaint}
          accessibilityLabel="Your message"
          style={[
            font.body,
            {
              color: theme.text,
              backgroundColor: theme.cardMuted,
              borderRadius: radius.md,
              padding: space.md,
              minHeight: 110,
              marginTop: space.sm,
              textAlignVertical: 'top',
            },
          ]}
        />
        <Text style={[font.small, { color: theme.textFaint, marginTop: space.sm }]}>
          Sent to the venue. Nothing is charged and no commitment is created on either side. Response
          time is published on the venue profile.
        </Text>
      </Card>

      <Button
        label="Send inquiry"
        icon="paper-plane"
        full
        disabled={!notes.trim()}
        onPress={() => {
          const b: Booking = {
            id: `b-${Date.now()}`,
            venueId: venue.id,
            kind: 'inquiry',
            date: now.toISOString().slice(0, 10),
            time: `${String(now.getHours()).padStart(2, '0')}:00`,
            partySize: 1,
            status: 'requested',
            notes: `${topic}: ${notes.trim()}`,
            createdAt: now.toISOString(),
          };
          addBooking(b);
          setBooking(b);
        }}
      />
    </View>
  );
}

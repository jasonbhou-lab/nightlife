import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import {
  Body, Button, Card, Chip, Divider, gutter, HeroCard, IconBadge, InsetPill, Label, Screen,
  ScreenHeader, SectionHeader, styles as ui,
} from '@/components/ui';
import { reviews } from '@/data/reviews';
import { venueById } from '@/data/venues';
import { RATING_EXPLANATION } from '@/lib/ratings';
import { formatTime } from '@/lib/hours';
import { useApp, useTheme, type ThemeSetting } from '@/state/AppProvider';
import { font, space } from '@/theme';

/**
 * Profile: contribution history and badges (F-SOCIAL-01), notification
 * preferences (F-NOTIF-01 to 04), theme, personalization controls, and the
 * account-deletion path (NFR-08).
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    session, signOut, verifyAge, themeSetting, setThemeSetting, prefs, setPrefs,
    bookings, cancelBooking, drafts, clearDraft, clockOverride, setClockOverride, now,
  } = useApp();

  // Notification preferences are per-category and cannot be bundled with
  // transactional messages (F-NOTIF-02).
  const [notif, setNotif] = useState({
    bookings: true,
    waitlist: true,
    orders: true,
    marketing: false,
    newReviews: true,
    quietHours: true,
  });

  const draftList = Object.values(drafts);
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="Profile" subtitle={roleLine(session.role)} />

      <View style={gutter()}>
        <HeroCard
          icon="person"
          title={session.role === 'guest' ? 'Not signed in' : session.name}
          subtitle={
            session.role === 'guest'
              ? 'Browsing works without an account'
              : session.ageVerified
                ? 'Verified · phone confirmed, age attested'
                : 'Registered · verification needed to review or book'
          }
          value={session.role === 'elite' ? 'Elite' : session.role === 'verified' ? 'Verified' : undefined}
        />
      </View>

      {session.role === 'guest' ? (
        <View style={gutter()}>
          <Card>
            <Text style={[font.cardTitle, { color: theme.text }]}>Sign in</Text>
            <Body dim style={{ marginTop: 4 }}>
              Needed to write reviews, book, message a venue, or sync saves across devices.
            </Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      ) : null}

      {session.role === 'registered' ? (
        <View style={gutter()}>
          <Card>
            <View style={[ui.row, { gap: space.md, alignItems: 'flex-start' }]}>
              <IconBadge icon="shield-checkmark" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={[font.cardTitle, { color: theme.text }]}>Finish verification</Text>
                <Body dim style={{ marginTop: 2 }}>
                  Every venue here serves alcohol or permits tobacco, so reviewing and booking need a
                  confirmed phone number and an age attestation. In practice the registered-only
                  state is temporary.
                </Body>
                <Button label="Verify now" variant="secondary" style={{ marginTop: space.md }} onPress={verifyAge} />
              </View>
            </View>
          </Card>
        </View>
      ) : null}

      {/* Contribution history and badges. */}
      <View style={[ui.row, gutter(), { gap: space.md, alignItems: 'stretch' }]}>
        <Card style={{ flex: 1 }}>
          <View style={[ui.row, { marginBottom: space.md }]}>
            <IconBadge icon="create" size={34} />
            <Text style={[font.cardTitle, { color: theme.text, marginLeft: space.sm, flex: 1 }]}>Reviews</Text>
          </View>
          <InsetPill value={session.role === 'guest' ? '0' : '0'} caption="Written by you in this build" />
        </Card>
        <Card style={{ flex: 1 }}>
          <View style={[ui.row, { marginBottom: space.md }]}>
            <IconBadge icon="images" size={34} />
            <Text style={[font.cardTitle, { color: theme.text, marginLeft: space.sm, flex: 1 }]}>Drafts</Text>
          </View>
          <InsetPill value={`${draftList.length}`} caption="Autosaved, resume any time" tone={draftList.length ? 'warn' : 'default'} />
        </Card>
      </View>

      {/* U-09: drafts survive across sessions and are resumable. */}
      {draftList.length ? (
        <View style={gutter()}>
          <SectionHeader title="Unfinished reviews" subtitle="Autosaved on this device" />
          {draftList.map((d) => {
            const v = venueById[d.venueId];
            return (
              <Card key={d.venueId} style={{ marginBottom: space.md }}>
                <View style={[ui.row, { alignItems: 'flex-start' }]}>
                  <IconBadge icon="document-text" size={40} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>{v?.name}</Text>
                    <Text style={[font.small, { color: theme.textDim }]} numberOfLines={2}>
                      {d.rating ? `${d.rating} stars · ` : ''}
                      {d.text ? `${d.text.slice(0, 70)}${d.text.length > 70 ? '…' : ''}` : 'No text yet'}
                    </Text>
                  </View>
                </View>
                <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
                  <Button
                    label="Resume"
                    variant="secondary"
                    onPress={() => router.push({ pathname: '/review/new', params: { id: d.venueId } })}
                  />
                  <Button
                    label="Discard"
                    variant="ghost"
                    onPress={() =>
                      Alert.alert(
                        'Discard this draft?',
                        'The text and ratings you saved for this venue will be deleted. This cannot be undone.',
                        [
                          { text: 'Keep it', style: 'cancel' },
                          { text: 'Discard', style: 'destructive', onPress: () => clearDraft(d.venueId) },
                        ],
                      )
                    }
                  />
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {/* Bookings with cancellation, consequences stated. */}
      {activeBookings.length ? (
        <View style={gutter()}>
          <SectionHeader title="Bookings" subtitle="Rebook in one tap from history" />
          {activeBookings.map((b) => {
            const v = venueById[b.venueId];
            return (
              <Card key={b.id} style={{ marginBottom: space.md }}>
                <Text style={[font.cardTitle, { color: theme.text }]}>{v?.name}</Text>
                <Text style={[font.meta, { color: theme.textDim, marginTop: 2 }]}>
                  {b.kind === 'waitlist'
                    ? `Waitlist, position ${b.waitlistPosition}, about ${b.waitMinutes} min`
                    : `${b.date} at ${formatTime(b.time)} · ${b.partySize} guests${b.tier ? ` · table ${b.tier}` : ''}`}
                </Text>
                {b.deposit ? (
                  <Text style={[font.small, { color: theme.warn, marginTop: 4 }]}>
                    ${b.deposit} deposit on file
                  </Text>
                ) : null}
                <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
                  <Button
                    label="Rebook"
                    variant="secondary"
                    onPress={() => router.push(`/book/${b.venueId}`)}
                  />
                  <Button
                    label="Cancel"
                    variant="danger"
                    onPress={() =>
                      Alert.alert(
                        'Cancel this booking?',
                        b.deposit
                          ? `Your $${b.deposit} deposit is forfeited if you cancel inside the venue's cancellation window. ${v?.bookingTerms ?? ''}`
                          : 'The table is released immediately and the time may be taken by someone else.',
                        [
                          { text: 'Keep booking', style: 'cancel' },
                          { text: 'Cancel booking', style: 'destructive', onPress: () => cancelBooking(b.id) },
                        ],
                      )
                    }
                  />
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {/* Appearance. Dark mode is a real theme, not an inversion. */}
      <View style={gutter()}>
        <SectionHeader title="Appearance" subtitle="Dark mode matters in a dim venue" />
        <Card>
          <Label>Theme</Label>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            {(['system', 'light', 'dark'] as ThemeSetting[]).map((t) => (
              <Chip
                key={t}
                label={t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}
                selected={themeSetting === t}
                onPress={() => setThemeSetting(t)}
              />
            ))}
          </View>
        </Card>
      </View>

      {/* Personalization control. */}
      <View style={gutter()}>
        <SectionHeader title="Personalization" subtitle="What drives your home feed" />
        <Card>
          <ToggleRow
            label="Personalize my feed"
            detail="Uses stated preferences, history, and location. Turning this off shows rating order."
            value={prefs.personalized}
            onChange={(v) => setPrefs({ ...prefs, personalized: v })}
          />
          <Divider style={{ marginVertical: space.md }} />
          <ToggleRow
            label="Nightlife interest"
            detail="Weights lounges and clubs higher"
            value={prefs.nightlifeInterest}
            onChange={(v) => setPrefs({ ...prefs, nightlifeInterest: v })}
          />
          <Divider style={{ marginVertical: space.md }} />
          <ToggleRow
            label="Cigar interest"
            detail="Weights cigar lounges higher"
            value={prefs.cigarInterest}
            onChange={(v) => setPrefs({ ...prefs, cigarInterest: v })}
          />
          <Button
            label="Edit preferences"
            variant="secondary"
            full
            style={{ marginTop: space.lg }}
            onPress={() => router.push('/onboarding')}
          />
        </Card>
      </View>

      {/* Notifications: transactional separated from marketing. */}
      <View style={gutter()}>
        <SectionHeader title="Notifications" subtitle="Per category, across push, email, and SMS" />
        <Card>
          <Label>Transactional</Label>
          <Text style={[font.small, { color: theme.textFaint, marginTop: 2, marginBottom: space.md }]}>
            Booking confirmations, waitlist-ready, and order status. Kept separate from marketing —
            one consent cannot cover both.
          </Text>
          <ToggleRow label="Booking confirmations and reminders" value={notif.bookings} onChange={(v) => setNotif({ ...notif, bookings: v })} />
          <Divider style={{ marginVertical: space.md }} />
          <ToggleRow label="Waitlist ready" value={notif.waitlist} onChange={(v) => setNotif({ ...notif, waitlist: v })} />
          <Divider style={{ marginVertical: space.md }} />
          <ToggleRow label="Order status" value={notif.orders} onChange={(v) => setNotif({ ...notif, orders: v })} />

          <Divider style={{ marginVertical: space.lg }} />
          <Label>Marketing</Label>
          <View style={{ height: space.sm }} />
          <ToggleRow
            label="Offers and promotions"
            detail="One-tap unsubscribe on every message. SMS honors STOP."
            value={notif.marketing}
            onChange={(v) => setNotif({ ...notif, marketing: v })}
          />
          <Divider style={{ marginVertical: space.md }} />
          <ToggleRow
            label="Quiet hours"
            detail="Non-transactional messages held between 2 AM and 10 AM, a window set for people who are out late."
            value={notif.quietHours}
            onChange={(v) => setNotif({ ...notif, quietHours: v })}
          />
        </Card>
      </View>

      {/* Demo clock. */}
      <View style={gutter()}>
        <SectionHeader title="Demo clock" subtitle="Everything time-aware follows this" />
        <Card>
          <Text style={[font.meta, { color: theme.textDim }]}>
            Currently {clockOverride == null ? 'using the real device time' : 'overridden'}:{' '}
            {formatTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
            {[12, 17, 19, 21, 23, 1, 3].map((h) => (
              <Chip
                key={h}
                label={formatTime(`${String(h).padStart(2, '0')}:00`)}
                selected={clockOverride === h}
                onPress={() => setClockOverride(clockOverride === h ? null : h)}
              />
            ))}
            {clockOverride != null ? (
              <Chip label="Real time" icon="refresh" onPress={() => setClockOverride(null)} />
            ) : null}
          </View>
        </Card>
      </View>

      {/* How the rating is computed, published in plain language. */}
      <View style={gutter()}>
        <SectionHeader title="How ratings work" />
        <Card>
          <Body dim>{RATING_EXPLANATION}</Body>
          <Text style={[font.small, { color: theme.textFaint, marginTop: space.md }]}>
            {reviews.length} reviews across {Object.keys(venueById).length} venues in this build,{' '}
            {reviews.filter((r) => !r.recommended).length} of them not recommended and excluded from
            every rating on the platform.
          </Text>
        </Card>
      </View>

      {/* Account and data. */}
      <View style={gutter()}>
        <SectionHeader title="Account and data" />
        <Card padded={false}>
          <LinkRow icon="download-outline" label="Export my data" detail="Reviews, photos, bookings" onPress={() => Alert.alert('Not in this build', 'Data export is a server-side path and is not implemented in the prototype.')} />
          <Divider />
          <LinkRow
            icon="trash-outline"
            label="Delete my account"
            detail="Propagates within 30 days"
            danger
            onPress={() =>
              Alert.alert(
                'Delete your account?',
                'This removes your profile, reviews, photos, collections, and bookings. Deletion propagates across systems within 30 days and cannot be undone.',
                [
                  { text: 'Keep my account', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: signOut },
                ],
              )
            }
          />
          {session.role !== 'guest' ? (
            <>
              <Divider />
              <LinkRow icon="log-out-outline" label="Sign out" onPress={signOut} />
            </>
          ) : null}
        </Card>
      </View>

      <View style={gutter()}>
        <Text style={[font.small, { color: theme.onGroundFaint, textAlign: 'center', lineHeight: 17 }]}>
          NightOut prototype · Houston launch metro{'\n'}
          Consumer scope only. No payments, no real inventory, no account system.
        </Text>
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[ui.row, { gap: space.md, minHeight: 44 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { color: theme.text }]}>{label}</Text>
        {detail ? (
          <Text style={[font.small, { color: theme.textFaint, marginTop: 2, lineHeight: 16 }]}>{detail}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.accent, false: theme.cardBorder }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function LinkRow({
  icon,
  label,
  detail,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? theme.closed : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        minHeight: 52,
      }}
    >
      <Ionicons name={icon} size={18} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { color }]}>{label}</Text>
        {detail ? <Text style={[font.small, { color: theme.textFaint }]}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
    </Pressable>
  );
}

function roleLine(role: string): string {
  switch (role) {
    case 'guest':
      return 'Guest · browsing only';
    case 'registered':
      return 'Registered · verification pending';
    case 'verified':
      return 'Verified · can review and book';
    case 'elite':
      return 'Elite contributor';
    default:
      return role;
  }
}

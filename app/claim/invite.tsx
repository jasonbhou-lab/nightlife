import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, Label, Screen, ScreenHeader,
  styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { deleteInvite, getSentInvites, inviteToManageVenue } from '@/data/repository';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { BusinessInvite, InvitableBusinessRole } from '@/types';

const ROLES: { key: InvitableBusinessRole; label: string }[] = [
  { key: 'manager', label: 'Manager' },
  { key: 'staff', label: 'Staff' },
];

/**
 * F-BIZ-13, scoped: invite a manager or staff member by email. See the
 * migration header on 20260825180000_add_business_invites.sql for why this
 * is honestly buildable now (matched against a real confirmed email) in a
 * way it would not have been before real Supabase Auth existed. No access
 * audit log — an invite's own record is the only history kept.
 */
export default function InviteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { now } = useApp();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue } = useCatalogue();

  const venue = getVenue(venueId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableBusinessRole>('manager');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<BusinessInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  useEffect(() => {
    if (!venue) return;
    getSentInvites(venue.id)
      .then(setInvites)
      .finally(() => setLoading(false));
  }, [venue?.id]);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Manage team" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Manage team" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Managing a team needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Manage team" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can invite others to it.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const send = async () => {
    setSending(true);
    setError(null);
    const result = await inviteToManageVenue({ venueId: venue.id, email, role });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEmail('');
    const next = await getSentInvites(venue.id);
    setInvites(next);
  };

  const revoke = async (id: string) => {
    const result = await deleteInvite(id);
    if (result.ok) setInvites((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Manage team" subtitle={venue.name} onBack={() => router.back()} />

      <View style={gutter()}>
        <Card>
          <Label>Invite by email</Label>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="teammate@example.com"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Email to invite"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[
              font.body,
              {
                color: theme.text,
                backgroundColor: theme.cardMuted,
                borderRadius: radius.md,
                paddingHorizontal: space.md,
                minHeight: 48,
                marginTop: space.sm,
              },
            ]}
          />
          <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
            {ROLES.map((r) => (
              <Chip key={r.key} label={r.label} selected={role === r.key} onPress={() => setRole(r.key)} />
            ))}
          </View>
          <Body dim style={{ marginTop: space.md }}>
            They'll be added automatically the next time they sign in with this exact email — no
            account is created for them here, and nothing is sent on your behalf outside this app.
          </Body>
          {error ? (
            <Text style={[font.small, { color: theme.closed, marginTop: space.sm }]}>{error}</Text>
          ) : null}
          <Button
            label="Send invite"
            icon="mail"
            full
            loading={sending}
            disabled={!email.trim()}
            style={{ marginTop: space.md }}
            onPress={send}
          />
        </Card>
      </View>

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>Invited</Text>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {loading ? (
            <Body dim style={{ padding: space.lg }}>Loading…</Body>
          ) : invites.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>No one invited yet.</Body>
          ) : (
            invites.map((inv, i) => (
              <View key={inv.id}>
                {i > 0 ? <Divider /> : null}
                <View style={[ui.row, { padding: space.lg, gap: space.md }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { color: theme.text }]}>{inv.email}</Text>
                    <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                      {inv.role === 'manager' ? 'Manager' : 'Staff'} ·{' '}
                      {inv.acceptedAt ? `Accepted ${relativeDate(inv.acceptedAt, now)}` : `Invited ${relativeDate(inv.createdAt, now)}`}
                    </Text>
                  </View>
                  {inv.acceptedAt ? (
                    <Text style={[font.small, { color: theme.open }]}>Accepted</Text>
                  ) : (
                    <Button label="Revoke" variant="ghost" onPress={() => revoke(inv.id)} />
                  )}
                </View>
              </View>
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}

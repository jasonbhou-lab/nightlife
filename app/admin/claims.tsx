import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Divider, gutter, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { decideVenueClaim, getVenueClaimQueue } from '@/data/repository';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { VenueClaim } from '@/types';

/**
 * F-BIZ-01, admin side: decide whether a self-attested claim gets accepted.
 * Approving here is the only thing that actually creates a business_roles
 * row and flips venues.claimed now — venue_claims_apply_decision() is what
 * enforces that and who may call it, not this screen; an account without
 * the admin platform role gets the database's own rejection back as
 * `error`, the same shape the moderation queue already uses.
 */
export default function AdminClaimsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, now, isAdmin } = useApp();
  const { getVenue, markVenueClaimed } = useCatalogue();

  const [claims, setClaims] = useState<VenueClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getVenueClaimQueue().then(setClaims).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  if (session.role === 'guest' || !isAdmin) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Venue claims" onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="Admin role required">
            <Body dim>
              This queue is only reachable with the admin platform role. There is no self-serve way
              to get one here — see the app README for why.
            </Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const approve = async (claim: VenueClaim) => {
    setBusyId(claim.id);
    setError(null);
    const result = await decideVenueClaim({ claimId: claim.id, status: 'approved' });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    markVenueClaimed(claim.venueId);
    load();
  };

  const startReject = (claim: VenueClaim) => {
    setRejectingId(claim.id);
    setRejectNote('');
    setError(null);
  };

  const confirmReject = async (claim: VenueClaim) => {
    setBusyId(claim.id);
    setError(null);
    const result = await decideVenueClaim({ claimId: claim.id, status: 'rejected', note: rejectNote.trim() || undefined });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRejectingId(null);
    load();
  };

  const pending = claims.filter((c) => c.status === 'pending');
  const decided = claims.filter((c) => c.status !== 'pending').slice(0, 20);

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Venue claims" subtitle="Admin" onBack={() => router.back()} />

      {error ? (
        <View style={gutter()}>
          <Text style={[font.small, { color: theme.closed }]}>{error}</Text>
        </View>
      ) : null}

      <View style={gutter()}>
        <Card padded={false}>
          {loading ? (
            <Body dim style={{ padding: space.lg }}>Loading…</Body>
          ) : pending.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>Nothing waiting on you.</Body>
          ) : (
            pending.map((claim, i) => {
              const venue = getVenue(claim.venueId);
              const rejecting = rejectingId === claim.id;
              return (
                <View key={claim.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: space.lg }}>
                    <Text style={[font.body, { color: theme.text }]}>{venue?.name ?? 'Unknown venue'}</Text>
                    <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                      {claim.claimantName ?? 'Someone'} · claiming {claim.role} · {relativeDate(claim.createdAt.slice(0, 10), now)}
                    </Text>
                    {rejecting ? (
                      <View style={{ marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: theme.cardMuted }}>
                        <TextInput
                          value={rejectNote}
                          onChangeText={setRejectNote}
                          placeholder="Reason (optional, shown to the claimant)"
                          placeholderTextColor={theme.textFaint}
                          accessibilityLabel="Rejection reason"
                          multiline
                          style={[
                            font.body,
                            {
                              color: theme.text,
                              backgroundColor: theme.card,
                              borderRadius: radius.md,
                              padding: space.md,
                              minHeight: 60,
                              textAlignVertical: 'top',
                            },
                          ]}
                        />
                        <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
                          <Button
                            label="Confirm rejection"
                            variant="danger"
                            loading={busyId === claim.id}
                            onPress={() => confirmReject(claim)}
                          />
                          <Button label="Cancel" variant="ghost" onPress={() => setRejectingId(null)} />
                        </View>
                      </View>
                    ) : (
                      <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
                        <Button label="Approve" loading={busyId === claim.id} onPress={() => approve(claim)} />
                        <Button
                          label="Reject"
                          variant="secondary"
                          loading={busyId === claim.id}
                          onPress={() => startReject(claim)}
                        />
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </View>

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>Recently decided</Text>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {decided.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>Nothing decided yet.</Body>
          ) : (
            decided.map((claim, i) => {
              const venue = getVenue(claim.venueId);
              return (
                <View key={claim.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={[ui.row, { padding: space.lg, gap: space.md }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[font.body, { color: theme.text }]}>{venue?.name ?? 'Unknown venue'}</Text>
                      <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                        {claim.claimantName ?? 'Someone'} · claiming {claim.role}
                        {claim.decidedAt ? ` · ${relativeDate(claim.decidedAt.slice(0, 10), now)}` : ''}
                      </Text>
                    </View>
                    <Text style={[font.small, { color: claim.status === 'approved' ? theme.open : theme.textDim }]}>
                      {claim.status === 'approved' ? 'Approved' : 'Rejected'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </View>
    </Screen>
  );
}

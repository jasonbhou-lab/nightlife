import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { getMyVenueClaim, submitVenueClaim, withdrawVenueClaim } from '@/data/repository';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { ClaimableBusinessRole, VenueClaim } from '@/types';

const ROLES: { key: ClaimableBusinessRole; label: string }[] = [
  { key: 'owner', label: 'Owner' },
  { key: 'manager', label: 'Manager' },
];

/**
 * F-BIZ-01, tightened: confirming "I run this place" no longer creates
 * business_roles on its own — it only ever files a pending venue_claims row
 * now, which sits until an admin decides it. See the migration header on
 * 20260828100100_add_venue_claim_approval.sql for why, and for why this is
 * still self-attestation, not real verification, either way — there is no
 * phone call, postcard, or document review behind it, just a human looking
 * at what was submitted instead of the database accepting it on sight.
 */
export default function ClaimVenueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, now, attemptContribution } = useApp();
  const { getVenue } = useCatalogue();

  const venue = getVenue(venueId);
  const [role, setRole] = useState<ClaimableBusinessRole>('owner');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myClaim, setMyClaim] = useState<VenueClaim | null>(null);
  const [loadingClaim, setLoadingClaim] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  // A one-time effect of viewing this gate, not something to redo every
  // render — calling it directly in the render body would change `session`,
  // re-rendering this component, which would call it again forever.
  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  const loadMyClaim = useCallback(() => {
    if (!venue) return;
    setLoadingClaim(true);
    getMyVenueClaim(venue.id).then(setMyClaim).finally(() => setLoadingClaim(false));
  }, [venue?.id]);

  useEffect(() => {
    if (venue && session.role !== 'guest') loadMyClaim();
    else setLoadingClaim(false);
  }, [venue?.id, session.role]);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Claim this listing" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Claim this listing" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Claiming a listing needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (venue.claimed) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Claim this listing" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="Already claimed">
            <Body dim>
              Someone already claimed this listing. Ownership transfer and disputes are not
              handled in this build — contact support outside the app if that account should not
              be the one managing it.
            </Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  if (loadingClaim) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Claim this listing" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card><Body dim>Loading…</Body></Card>
        </View>
      </Screen>
    );
  }

  if (myClaim?.status === 'pending') {
    const withdraw = async () => {
      setWithdrawing(true);
      setError(null);
      const result = await withdrawVenueClaim(myClaim.id);
      setWithdrawing(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMyClaim(null);
    };

    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Claim this listing" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="time" size={56} />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>
                Pending review
              </Text>
              <Body dim style={{ textAlign: 'center' }}>
                Submitted {relativeDate(myClaim.createdAt.slice(0, 10), now)} as {myClaim.role}. This listing opens up
                for you once an admin approves it — nothing about it has changed yet.
              </Body>
            </View>
          </Card>
        </View>
        {error ? (
          <View style={gutter()}>
            <Callout tone="danger" icon="alert-circle" title="Could not withdraw">
              <Body dim>{error}</Body>
            </Callout>
          </View>
        ) : null}
        <View style={gutter()}>
          <Button label="Withdraw this claim" variant="ghost" full loading={withdrawing} onPress={withdraw} />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await submitVenueClaim({ venueId: venue.id, role });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMyClaim(result.claim);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Claim this listing" subtitle={venue.name} onBack={() => router.back()} />

      {myClaim?.status === 'rejected' ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="close-circle" title="Your last claim was not accepted">
            <Body dim>
              {myClaim.note?.trim() ? myClaim.note : 'No reason was given.'} You can submit a new one below.
            </Body>
          </Callout>
        </View>
      ) : null}

      <View style={gutter()}>
        <Callout tone="warn" icon="help-circle" title="Self-attested, reviewed before it counts">
          <Body dim>
            Confirming this submits it for review — it does not verify you actually run {venue.name},
            just your say-so. An admin has to approve it before this listing shows as claimed and the
            business tools here open up.
          </Body>
        </Callout>
      </View>

      <View style={gutter()}>
        <Card>
          <Label>Your role at this listing</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {ROLES.map((r) => (
              <Chip key={r.key} label={r.label} selected={role === r.key} onPress={() => setRole(r.key)} />
            ))}
          </View>
          <Divider style={{ marginVertical: space.lg }} />
          <Body dim>
            Only one claim can be pending on {venue.name} at a time. If someone else's claim is
            already waiting on review, this one is rejected outright rather than queued behind it.
          </Body>
        </Card>
      </View>

      {error ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="alert-circle" title="Could not submit this claim">
            <Body dim>{error}</Body>
          </Callout>
        </View>
      ) : null}

      <View style={gutter()}>
        <Button label="Submit for review" icon="shield-checkmark" full loading={submitting} onPress={submit} />
      </View>
    </Screen>
  );
}

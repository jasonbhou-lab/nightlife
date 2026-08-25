import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { claimVenue } from '@/data/repository';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { ClaimableBusinessRole } from '@/types';

const ROLES: { key: ClaimableBusinessRole; label: string }[] = [
  { key: 'owner', label: 'Owner' },
  { key: 'manager', label: 'Manager' },
];

/**
 * F-BIZ-01, scoped: see the migration header on
 * 20260825140000_add_business_claims.sql for why this is self-attestation,
 * not real verification. Gated the same as writing a review or adding a
 * photo — a "contribution" in the PRD's own terms (2.1).
 */
export default function ClaimVenueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, attemptContribution, addManagedVenue } = useApp();
  const { getVenue, markVenueClaimed } = useCatalogue();

  const venue = getVenue(venueId);
  const [role, setRole] = useState<ClaimableBusinessRole>('owner');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // A one-time effect of viewing this gate, not something to redo every
  // render — calling it directly in the render body would change `session`,
  // re-rendering this component, which would call it again forever.
  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

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

  if (venue.claimed && !done) {
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

  if (done) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Claimed" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="checkmark-circle" size={56} variant="solid" />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>
                You manage this listing now
              </Text>
              <Body dim style={{ textAlign: 'center' }}>
                This is self-attested, not verified — the profile will show "Claimed and
                unverified owner" until a real verification step exists. Nothing about the listing
                itself changed yet.
              </Body>
            </View>
          </Card>
        </View>
        <View style={gutter()}>
          <Button label="Back to the venue" full onPress={() => router.replace(`/venue/${venue.id}`)} />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await claimVenue({ venueId: venue.id, role });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    markVenueClaimed(venue.id);
    addManagedVenue(venue.id);
    setDone(true);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Claim this listing" subtitle={venue.name} onBack={() => router.back()} />

      <View style={gutter()}>
        <Callout tone="warn" icon="help-circle" title="Self-attested, not verified">
          <Body dim>
            Confirming this is enough to have it show up as claimed and to open the business
            tools this build has, but it does not verify you actually run {venue.name}. There is
            no phone call, postcard, or document review behind this yet — just your say-so.
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
            First claim wins. If {venue.name} is already claimed by the time this submits, the
            claim is rejected rather than added alongside it.
          </Body>
        </Card>
      </View>

      {error ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="alert-circle" title="Could not claim this listing">
            <Body dim>{error}</Body>
          </Callout>
        </View>
      ) : null}

      <View style={gutter()}>
        <Button label="Claim this listing" icon="shield-checkmark" full loading={submitting} onPress={submit} />
      </View>
    </Screen>
  );
}

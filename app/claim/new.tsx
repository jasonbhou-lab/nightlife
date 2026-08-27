import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { getMyVenueClaim, submitVenueClaim, withdrawVenueClaim } from '@/data/repository';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
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
 *
 * F-BIZ-02: this screen also handles disputing an *already*-claimed venue —
 * the same form, gated to `role: 'owner'` only and requiring evidence text,
 * since the database itself requires evidence exactly when the venue is
 * already claimed (see 20260828120000_add_ownership_transfer_and_dispute.sql).
 * Approving a dispute replaces the venue's entire team, not just the
 * disputed role, so this is deliberately not offered lightly — someone who
 * already manages the listing never sees a dispute option, only a plain
 * "you already manage this" message.
 */
export default function ClaimVenueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, now, attemptContribution, isManagingVenue } = useApp();
  const { getVenue } = useCatalogue();

  const venue = getVenue(venueId);
  const disputing = Boolean(venue?.claimed);
  const [role, setRole] = useState<ClaimableBusinessRole>('owner');
  const [evidence, setEvidence] = useState('');
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

  const title = disputing ? 'Dispute this claim' : 'Claim this listing';

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title={title} onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title={title} subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>
              {disputing ? 'Disputing a claim' : 'Claiming a listing'} needs an account. Reading and
              browsing do not.
            </Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title={title} subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You already manage this listing">
            <Body dim>Nothing to claim or dispute here — this account already has access.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  if (loadingClaim) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title={title} subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card><Body dim>Loading…</Body></Card>
        </View>
      </Screen>
    );
  }

  if (myClaim?.status === 'pending') {
    const isDispute = Boolean(myClaim.evidence);
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
        <ScreenHeader title={title} subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="time" size={56} />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>
                Pending review
              </Text>
              <Body dim style={{ textAlign: 'center' }}>
                {isDispute ? 'Dispute submitted' : 'Submitted'} {relativeDate(myClaim.createdAt.slice(0, 10), now)} as{' '}
                {myClaim.role}. {isDispute
                  ? 'The current claimant keeps access until an admin decides this.'
                  : 'This listing opens up for you once an admin approves it.'} Nothing about it has
                changed yet.
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
    const result = await submitVenueClaim({
      venueId: venue.id,
      role: disputing ? 'owner' : role,
      evidence: disputing ? evidence.trim() : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMyClaim(result.claim);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title={title} subtitle={venue.name} onBack={() => router.back()} />

      {myClaim?.status === 'rejected' ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="close-circle" title="Your last one was not accepted">
            <Body dim>
              {myClaim.note?.trim() ? myClaim.note : 'No reason was given.'} You can submit a new one
              below.
            </Body>
          </Callout>
        </View>
      ) : null}

      {disputing ? (
        <View style={gutter()}>
          <Callout tone="warn" icon="alert-circle" title="This listing is already claimed">
            <Body dim>
              Submitting a dispute asks an admin to review who should really manage {venue.name}.
              If it's approved, the current claimant and everyone they've invited lose access — this
              is not a routine action, so explain why below.
            </Body>
          </Callout>
        </View>
      ) : (
        <View style={gutter()}>
          <Callout tone="warn" icon="help-circle" title="Self-attested, reviewed before it counts">
            <Body dim>
              Confirming this submits it for review — it does not verify you actually run {venue.name},
              just your say-so. An admin has to approve it before this listing shows as claimed and the
              business tools here open up.
            </Body>
          </Callout>
        </View>
      )}

      <View style={gutter()}>
        <Card>
          {disputing ? (
            <>
              <Label>Why should this listing be yours instead</Label>
              <TextInput
                value={evidence}
                onChangeText={setEvidence}
                placeholder="Business license, lease, or other detail an admin can actually check…"
                placeholderTextColor={theme.textFaint}
                accessibilityLabel="Evidence for this dispute"
                multiline
                style={[
                  font.body,
                  {
                    color: theme.text,
                    backgroundColor: theme.cardMuted,
                    borderRadius: radius.md,
                    padding: space.md,
                    marginTop: space.sm,
                    minHeight: 90,
                    textAlignVertical: 'top',
                  },
                ]}
              />
            </>
          ) : (
            <>
              <Label>Your role at this listing</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
                {ROLES.map((r) => (
                  <Chip key={r.key} label={r.label} selected={role === r.key} onPress={() => setRole(r.key)} />
                ))}
              </View>
            </>
          )}
          <Divider style={{ marginVertical: space.lg }} />
          <Body dim>
            Only one claim or dispute can be pending on {venue.name} at a time. If someone else's is
            already waiting on review, this one is rejected outright rather than queued behind it.
          </Body>
        </Card>
      </View>

      {error ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="alert-circle" title="Could not submit">
            <Body dim>{error}</Body>
          </Callout>
        </View>
      ) : null}

      <View style={gutter()}>
        <Button
          label="Submit for review"
          icon="shield-checkmark"
          full
          loading={submitting}
          disabled={disputing && !evidence.trim()}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

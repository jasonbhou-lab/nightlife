import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Divider, gutter, Label, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { createVenueOffer, deleteVenueOffer } from '@/data/repository';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

const END_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * F-BIZ-09, scoped: a self-published offer, not a purchased placement — see
 * the migration header on 20260826100000_add_venue_offers.sql for why there
 * is no alcohol/tobacco price-advertising enforcement or targeting here.
 */
export default function VenueOffersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { now, session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, addVenueOffer, removeVenueOffer } = useCatalogue();

  const venue = getVenue(venueId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Offers" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Offers" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Posting an offer needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Offers" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can post offers for it.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const endInvalid = endDate.trim() !== '' && (!END_RE.test(endDate.trim()) || Number.isNaN(new Date(endDate.trim()).getTime()));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const endsAt = endDate.trim() ? new Date(`${endDate.trim()}T23:59:59`).toISOString() : undefined;
    const result = await createVenueOffer({
      venueId: venue.id,
      title: title.trim(),
      description: description.trim(),
      endsAt,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    addVenueOffer(venue.id, result.offer);
    setTitle('');
    setDescription('');
    setEndDate('');
  };

  const remove = async (offerId: string) => {
    const result = await deleteVenueOffer(offerId);
    if (result.ok) removeVenueOffer(venue.id, offerId);
  };

  const offers = [...(venue.offers ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Offers" subtitle={venue.name} onBack={() => router.back()} />

      <View style={gutter()}>
        <Callout tone="info" icon="information-circle" title="Self-published, not a purchased placement">
          <Body dim>
            This posts exactly what you type below on your own listing — no budget, no targeting,
            no ranking boost. Drink-price promotions are regulated differently state by state; this
            screen doesn't check what you write against any jurisdiction's rules.
          </Body>
        </Callout>
      </View>

      <View style={gutter()}>
        <Card>
          <Label>Title</Label>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="First visit? Appetizer's on us"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Offer title"
            maxLength={80}
            style={[
              font.body,
              {
                color: theme.text,
                backgroundColor: theme.cardMuted,
                borderRadius: radius.md,
                paddingHorizontal: space.md,
                minHeight: 44,
                marginTop: space.sm,
              },
            ]}
          />
          <Label style={{ marginTop: space.md }}>Description</Label>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What it is and who it's for"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Offer description"
            multiline
            maxLength={280}
            style={[
              font.body,
              {
                color: theme.text,
                backgroundColor: theme.cardMuted,
                borderRadius: radius.md,
                padding: space.md,
                minHeight: 80,
                textAlignVertical: 'top',
                marginTop: space.sm,
              },
            ]}
          />
          <Label style={{ marginTop: space.md }}>Ends (optional)</Label>
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD, leave blank for ongoing"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Offer end date"
            maxLength={10}
            style={[
              font.body,
              {
                color: theme.text,
                backgroundColor: theme.cardMuted,
                borderRadius: radius.md,
                paddingHorizontal: space.md,
                minHeight: 44,
                marginTop: space.sm,
                borderWidth: endInvalid ? 1 : 0,
                borderColor: theme.closed,
              },
            ]}
          />
          {error ? (
            <Text style={[font.small, { color: theme.closed, marginTop: space.sm }]}>{error}</Text>
          ) : null}
          <Button
            label="Post offer"
            icon="megaphone-outline"
            full
            loading={submitting}
            disabled={!title.trim() || !description.trim() || endInvalid}
            style={{ marginTop: space.md }}
            onPress={submit}
          />
        </Card>
      </View>

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>Posted</Text>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {offers.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>Nothing posted yet.</Body>
          ) : (
            offers.map((o, i) => {
              const ended = o.endsAt && new Date(o.endsAt).getTime() <= now.getTime();
              return (
                <View key={o.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: space.lg }}>
                    <View style={[ui.row, { gap: space.sm }]}>
                      <Text style={[font.body, { color: theme.text, flex: 1 }]}>{o.title}</Text>
                      {ended ? <Text style={[font.small, { color: theme.textFaint }]}>Ended</Text> : null}
                    </View>
                    <Body dim style={{ marginTop: 4 }}>{o.description}</Body>
                    <Text style={[font.small, { color: theme.textFaint, marginTop: 6 }]}>
                      {o.endsAt ? `${ended ? 'Ended' : 'Through'} ${relativeDate(o.endsAt, now)}` : 'Ongoing'}
                    </Text>
                    <Button
                      label="Remove"
                      variant="ghost"
                      icon="trash-outline"
                      style={{ marginTop: space.sm, alignSelf: 'flex-start' }}
                      onPress={() => remove(o.id)}
                    />
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

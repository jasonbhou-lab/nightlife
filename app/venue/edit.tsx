import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, gutter, IconBadge, Label, Screen, ScreenHeader,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { updateVenueListing } from '@/data/repository';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

const TAGLINE_MAX = 140;
const ABOUT_MAX = 500;

/**
 * F-BIZ-03, scoped way down: tagline and about only. The full typed
 * attribute registry (dress code, cover charge, noise level, and dozens
 * more, per category) with change history and rollback is a real, separate
 * feature — see the migration header on
 * 20260825190000_add_venue_listing_edit.sql.
 */
export default function EditVenueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, setVenueListing } = useCatalogue();

  const venue = getVenue(venueId);
  const [tagline, setTagline] = useState(venue?.tagline ?? '');
  const [about, setAbout] = useState(venue?.about ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Edit listing" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Edit listing" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Editing the listing needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Edit listing" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can edit its description.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Saved" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="checkmark-circle" size={56} variant="solid" />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>Listing updated</Text>
              <Body dim style={{ textAlign: 'center' }}>
                Visible to everyone browsing {venue.name} now.
              </Body>
            </View>
          </Card>
        </View>
        <View style={gutter()}>
          <Button label="Back to the listing" full onPress={() => router.replace(`/venue/${venue.id}`)} />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const cleanTagline = tagline.trim();
    const cleanAbout = about.trim();
    const result = await updateVenueListing({ venueId: venue.id, tagline: cleanTagline, about: cleanAbout });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVenueListing(venue.id, cleanTagline, cleanAbout);
    setDone(true);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Edit listing" subtitle={venue.name} onBack={() => router.back()} />

      <View style={gutter()}>
        <Card>
          <Label>Tagline</Label>
          <Body dim style={{ marginTop: 2 }}>The one line shown right under the name.</Body>
          <TextInput
            value={tagline}
            onChangeText={setTagline}
            placeholder="What makes this place worth knowing about"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Tagline"
            maxLength={TAGLINE_MAX}
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
          <Text style={[font.small, { color: theme.textFaint, marginTop: 4, textAlign: 'right' }]}>
            {tagline.length}/{TAGLINE_MAX}
          </Text>

          <Label style={{ marginTop: space.md }}>About</Label>
          <Body dim style={{ marginTop: 2 }}>The longer description on the listing.</Body>
          <TextInput
            value={about}
            onChangeText={setAbout}
            placeholder="A few sentences on what to expect"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="About"
            multiline
            maxLength={ABOUT_MAX}
            style={[
              font.body,
              {
                color: theme.text,
                backgroundColor: theme.cardMuted,
                borderRadius: radius.md,
                padding: space.md,
                minHeight: 120,
                textAlignVertical: 'top',
                marginTop: space.sm,
              },
            ]}
          />
          <Text style={[font.small, { color: theme.textFaint, marginTop: 4, textAlign: 'right' }]}>
            {about.length}/{ABOUT_MAX}
          </Text>
        </Card>
      </View>

      {error ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="alert-circle" title="Could not save">
            <Body dim>{error}</Body>
          </Callout>
        </View>
      ) : null}

      <View style={gutter()}>
        <Button
          label="Save"
          icon="save-outline"
          full
          loading={submitting}
          disabled={!tagline.trim() || !about.trim()}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

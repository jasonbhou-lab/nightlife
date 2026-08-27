import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PhotoTile, albumLabel } from '@/components/PhotoTile';
import {
  Body, Button, Callout, Card, Divider, gutter, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { reorderOwnerPhotos, setPhotoCover } from '@/data/repository';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { Photo } from '@/types';

/**
 * F-BIZ-06 / F-MEDIA-06, scoped: a business account can select a cover
 * photo and reorder its own venue's owner-credited uploads. Community
 * photos are shown for context but carry no actions at all — the PRD draws
 * that line at reorder, and this build draws cover selection the same way,
 * so a business account genuinely cannot touch what the community posted.
 * See the migration header on 20260827110000_add_photo_management.sql.
 */
export default function VenuePhotosScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, setVenuePhotoCover, setVenuePhotoOrder } = useCatalogue();

  const venue = getVenue(venueId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Photos" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Photos" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Managing photos needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Photos" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can manage its photos.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const owned = venue.photos.filter((p) => p.by === 'owner');
  const community = venue.photos.filter((p) => p.by !== 'owner');

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= owned.length) return;
    const reordered = [...owned];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const orderedIds = reordered.map((p) => p.id);

    setBusyId(owned[index].id);
    const result = await reorderOwnerPhotos(orderedIds);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVenuePhotoOrder(venue.id, orderedIds);
  };

  const makeCover = async (photo: Photo) => {
    setBusyId(photo.id);
    const result = await setPhotoCover(photo.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVenuePhotoCover(venue.id, photo.id);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Photos" subtitle={venue.name} onBack={() => router.back()} />

      {error ? (
        <View style={gutter()}>
          <Text style={[font.small, { color: theme.closed }]}>{error}</Text>
        </View>
      ) : null}

      <View style={gutter()}>
        <Body dim>
          The cover photo leads the gallery on your listing. Reordering only applies to your own
          uploads — community photos stay exactly where they are.
        </Body>
      </View>

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>Your photos</Text>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {owned.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>You haven't uploaded any photos yet.</Body>
          ) : (
            owned.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <Divider /> : null}
                <View style={[ui.row, { padding: space.lg, gap: space.md, alignItems: 'center' }]}>
                  <PhotoTile photo={p} width={64} height={64} showMeta={false} />
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { color: theme.text }]}>{albumLabel[p.album]}</Text>
                    {p.isCover ? (
                      <View style={[ui.row, { gap: 4, marginTop: 2 }]}>
                        <Ionicons name="star" size={12} color={theme.accent} />
                        <Text style={[font.small, { color: theme.accent }]}>Cover photo</Text>
                      </View>
                    ) : (
                      <Button
                        label="Set as cover"
                        variant="ghost"
                        loading={busyId === p.id}
                        style={{ alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 0 }}
                        onPress={() => makeCover(p)}
                      />
                    )}
                  </View>
                  <View style={{ gap: 4 }}>
                    <Pressable
                      onPress={() => move(i, -1)}
                      disabled={i === 0}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Move photo up"
                    >
                      <Ionicons name="chevron-up" size={20} color={i === 0 ? theme.textFaint : theme.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => move(i, 1)}
                      disabled={i === owned.length - 1}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Move photo down"
                    >
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={i === owned.length - 1 ? theme.textFaint : theme.text}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>
      </View>

      {community.length ? (
        <>
          <View style={gutter()}>
            <Text style={[font.cardTitle, { color: theme.onGround }]}>Community photos</Text>
          </View>
          <View style={gutter()}>
            <Card padded={false}>
              {community.map((p, i) => (
                <View key={p.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={[ui.row, { padding: space.lg, gap: space.md, alignItems: 'center' }]}>
                    <PhotoTile photo={p} width={64} height={64} showMeta={false} />
                    <View style={{ flex: 1 }}>
                      <Text style={[font.body, { color: theme.text }]}>{albumLabel[p.album]}</Text>
                      <Text style={[font.small, { color: theme.textFaint }]}>Not editable here</Text>
                    </View>
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

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Text, TextInput, View } from 'react-native';

import { albumLabel } from '@/components/PhotoTile';
import {
  Body, Button, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { uploadPhoto } from '@/data/repository';
import { pickPhoto, type PickedPhoto } from '@/lib/media';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Photo } from '@/types';

const ALBUMS: Photo['album'][] = [
  'interior', 'exterior', 'food', 'drink', 'menu', 'crowd', 'humidor', 'stage', 'table',
];

/**
 * F-MEDIA-01: real upload, attached to a venue's gallery. Gated the same as
 * writing a review — R1 hits the same soft-then-hard wall, since both are
 * "contribution" actions in the PRD's own terms (2.1).
 */
export default function NewPhotoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, attemptContribution } = useApp();
  const { getVenue, addLocalPhoto } = useCatalogue();

  const venue = getVenue(venueId);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [album, setAlbum] = useState<Photo['album']>('interior');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  // Registering a contribution attempt is a one-time effect of viewing this
  // gate, not something to redo on every render — calling it unconditionally
  // in the render body changes `session`, which re-renders this component,
  // which would call it again forever ("Maximum update depth exceeded").
  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Add a photo" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Add a photo" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Adding a photo needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Added" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="checkmark-circle" size={56} variant="solid" />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>Published to the gallery</Text>
              <Body dim style={{ textAlign: 'center' }}>
                Visible to everyone browsing {venue.name} now. Anyone can request its removal from the photo
                itself if it's wrong or shows someone who'd rather it didn't.
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

  const pick = async (source: 'library' | 'camera') => {
    try {
      const result = await pickPhoto(source);
      if (result) setPicked(result);
    } catch {
      Alert.alert('Could not open the picker', 'Check that camera or photo permissions are allowed for this app.');
    }
  };

  const submit = async () => {
    if (!picked) return;
    setUploading(true);
    const result = await uploadPhoto({ venueId: venue.id, album, caption: caption.trim() || undefined, localUri: picked.uri });
    setUploading(false);
    if (!result.ok) {
      Alert.alert('Could not upload', result.error);
      return;
    }
    addLocalPhoto(venue.id, result.photo);
    setDone(true);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Add a photo" subtitle={venue.name} onBack={() => router.back()} />

      <View style={gutter()}>
        <Card>
          {picked ? (
            <View>
              <Image
                source={{ uri: picked.uri }}
                style={{ width: '100%', aspectRatio: picked.width / picked.height, borderRadius: radius.md }}
                resizeMode="cover"
              />
              <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
                <Button label="Retake" variant="secondary" icon="camera" onPress={() => pick('camera')} />
                <Button label="Choose different" variant="secondary" icon="images" onPress={() => pick('library')} />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
              <IconBadge icon="camera" size={52} />
              <Body dim style={{ textAlign: 'center' }}>
                Location and device metadata are stripped before it uploads.
              </Body>
              <View style={[ui.row, { gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' }]}>
                <Button label="Take a photo" icon="camera" onPress={() => pick('camera')} />
                <Button label="Choose from library" icon="images" variant="secondary" onPress={() => pick('library')} />
              </View>
            </View>
          )}
        </Card>
      </View>

      {picked ? (
        <>
          <View style={gutter()}>
            <Card>
              <Label>Album</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
                {ALBUMS.map((a) => (
                  <Chip key={a} label={albumLabel[a]} selected={album === a} onPress={() => setAlbum(a)} />
                ))}
              </View>
              <Divider style={{ marginVertical: space.lg }} />
              <Label>Caption</Label>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Optional"
                placeholderTextColor={theme.textFaint}
                accessibilityLabel="Caption"
                style={[
                  font.body,
                  { color: theme.text, backgroundColor: theme.cardMuted, borderRadius: radius.md, padding: space.md, marginTop: space.sm, minHeight: 44 },
                ]}
              />
            </Card>
          </View>

          <View style={gutter()}>
            <Button label="Upload" icon="cloud-upload" full loading={uploading} onPress={submit} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

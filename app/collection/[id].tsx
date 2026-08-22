import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';

import { VenueCard } from '@/components/VenueCard';
import {
  Body, Button, Card, EmptyState, gutter, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

export default function CollectionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { collections, removeFromCollection, now } = useApp();
  const { venueById } = useCatalogue();

  const collection = collections.find((c) => c.id === id);

  if (!collection) {
    return (
      <Screen>
        <ScreenHeader title="Collection" onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>This collection no longer exists.</Body>
            <Button label="Back to Saved" style={{ marginTop: space.md }} onPress={() => router.replace('/(tabs)/saved')} />
          </Card>
        </View>
      </Screen>
    );
  }

  const list = collection.venueIds.map((v) => venueById[v]).filter(Boolean);
  const openCount = list.filter((v) => venueState(v, now).open).length;

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title={collection.name}
        subtitle={`${list.length} saved · ${openCount} open now${collection.shared ? ' · shared by link' : ' · private'}`}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() =>
              Share.share({
                message: `${collection.name} — ${list.map((v) => v.name).join(', ')} (NightOut)`,
              }).catch(() => undefined)
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share this collection"
            style={ui.glassCircle}
          >
            <Ionicons name="share-outline" size={19} color={theme.onGround} />
          </Pressable>
        }
      />

      <View style={gutter()}>
        {list.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="Nothing saved here yet"
            body="Open any venue and tap the bookmark to add it. Collections are the fastest way to shortlist two or three places and compare them side by side."
            actionLabel="Find venues"
            onAction={() => router.push('/(tabs)/search')}
          />
        ) : (
          list.map((v) => (
            <VenueCard
              key={v.id}
              venue={v}
              rightSlot={
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      `Remove ${v.name}?`,
                      `It comes out of “${collection.name}”. The venue itself and its reviews are unaffected.`,
                      [
                        { text: 'Keep it', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => removeFromCollection(collection.id, v.id),
                        },
                      ],
                    )
                  }
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${v.name} from this collection`}
                  style={{ position: 'absolute', top: space.sm, right: space.sm, padding: 6 }}
                >
                  <Ionicons name="close-circle" size={20} color={theme.textFaint} />
                </Pressable>
              }
            />
          ))
        )}
      </View>

      {list.length > 1 ? (
        <View style={gutter()}>
          <Card>
            <Text style={[font.cardTitle, { color: theme.text }]}>Compare</Text>
            <View style={{ marginTop: space.md }}>
              {list.map((v) => {
                const s = venueState(v, now);
                return (
                  <View key={v.id} style={[ui.row, { paddingVertical: space.sm, gap: space.md }]}>
                    <Text style={[font.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                      {v.name}
                    </Text>
                    <Text style={[font.small, { color: theme.textDim, width: 44, textAlign: 'right' }]}>
                      {v.rating.toFixed(1)}
                    </Text>
                    <Text style={[font.small, { color: theme.textDim, width: 44, textAlign: 'right' }]}>
                      {'$'.repeat(v.priceTier)}
                    </Text>
                    <Text style={[font.small, { color: theme.textDim, width: 52, textAlign: 'right' }]}>
                      {v.distanceMi.toFixed(1)} mi
                    </Text>
                    <Text
                      style={[font.small, { color: s.open ? theme.open : theme.closed, width: 52, textAlign: 'right' }]}
                    >
                      {s.open ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

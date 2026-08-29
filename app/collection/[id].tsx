import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';

import { VenueCard } from '@/components/VenueCard';
import {
  Body, Button, Card, Chip, Divider, EmptyState, gutter, IconBadge, Screen, ScreenHeader,
  SectionHeader, styles as ui,
} from '@/components/ui';
import { communityById, communityMembers } from '@/data/community';
import { useCatalogue } from '@/data/catalogue';
import { relativeDate } from '@/lib/format';
import { venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

/**
 * F-SOCIAL-03 (saved) plus F-SOCIAL-04 (collaborative). Each entry carries
 * who added it, and the collaborator list is who was invited to contribute —
 * both real fields, not just a "shared by link" flag with no one behind it.
 */
export default function CollectionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { collections, removeFromCollection, inviteCollaborator, removeCollaborator, now } = useApp();
  const { venueById } = useCatalogue();
  const [inviting, setInviting] = useState(false);

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

  const rows = collection.entries
    .map((entry) => ({ entry, venue: venueById[entry.venueId] }))
    .filter((r) => r.venue);
  const list = rows.map((r) => r.venue);
  const openCount = list.filter((v) => venueState(v, now).open).length;
  const collaborators = collection.collaboratorIds.map((m) => communityById[m]).filter(Boolean);
  const invitable = communityMembers.filter((m) => !collection.collaboratorIds.includes(m.id));

  const attribution = (addedBy: string): string =>
    addedBy === 'you' ? 'you' : communityById[addedBy]?.name ?? 'a former collaborator';

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title={collection.name}
        subtitle={`${list.length} saved · ${openCount} open now${collaborators.length ? ` · ${collaborators.length} collaborating` : collection.shared ? ' · shared by link' : ' · private'}`}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() =>
              Share.share({
                message: `${collection.name} — ${list.map((v) => v.name).join(', ')} (Nightlife)`,
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

      {/* F-SOCIAL-04: who is actually contributing to this list. */}
      <View style={gutter()}>
        <SectionHeader
          title="Collaborators"
          subtitle="Invited contributors, credited for what they add"
          actionLabel={inviting ? 'Done' : 'Invite'}
          onAction={() => setInviting((v) => !v)}
        />
        <Card>
          {collaborators.length === 0 ? (
            <Body dim>Just you so far. Invite someone from the people you follow to plan this together.</Body>
          ) : (
            collaborators.map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <Divider style={{ marginVertical: space.md }} /> : null}
                <View style={[ui.row, { gap: space.md }]}>
                  <IconBadge icon="person" size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={[font.bodyStrong, { color: theme.text }]}>{m.name}</Text>
                    <Text style={[font.small, { color: theme.textDim }]}>{m.tagline}</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert(`Remove ${m.name}?`, 'They can no longer add or remove venues here. Anything they already added stays, credited to them.', [
                        { text: 'Keep them', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeCollaborator(collection.id, m.id) },
                      ])
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m.name} as a collaborator`}
                  >
                    <Ionicons name="close-circle" size={20} color={theme.textFaint} />
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {inviting ? (
            <>
              <Divider style={{ marginVertical: space.md }} />
              {invitable.length === 0 ? (
                <Body dim>Everyone you could invite is already collaborating.</Body>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {invitable.map((m) => (
                    <Chip
                      key={m.id}
                      label={m.name}
                      onPress={() => {
                        inviteCollaborator(collection.id, m.id);
                        setInviting(false);
                      }}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}
        </Card>
      </View>

      <View style={gutter()}>
        {rows.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="Nothing saved here yet"
            body="Open any venue and tap the bookmark to add it. Collections are the fastest way to shortlist two or three places and compare them side by side."
            actionLabel="Find venues"
            onAction={() => router.push('/(tabs)/search')}
          />
        ) : (
          rows.map(({ entry, venue: v }) => (
            <View key={v.id} style={{ marginBottom: space.md }}>
              <VenueCard
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
              <Text style={[font.small, { color: theme.onGroundFaint, marginTop: 4, marginLeft: space.sm }]}>
                Added by {attribution(entry.addedBy)} · {relativeDate(entry.addedAt.slice(0, 10), now)}
              </Text>
            </View>
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

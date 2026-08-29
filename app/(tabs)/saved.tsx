import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Share, Text, TextInput, View } from 'react-native';

import {
  Body, Button, Card, Divider, EmptyState, gutter, IconBadge, Label, Screen, ScreenHeader,
  SectionHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

/**
 * Saved (F-SOCIAL-03): named collections, held privately or shared by link.
 *
 * Everything on this screen is read from local storage, so it stays readable
 * without connectivity — U-07, written with club basements in mind.
 */
export default function SavedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { collections, createCollection, deleteCollection, now, bookings } = useApp();
  const { venueById } = useCatalogue();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const total = collections.reduce((n, c) => n + c.entries.length, 0);
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader
        title="Saved"
        subtitle={`${total} ${total === 1 ? 'venue' : 'venues'} in ${collections.length} ${collections.length === 1 ? 'collection' : 'collections'}`}
      />

      <View style={gutter()}>
        <Card>
          <View style={[ui.row, { gap: space.md }]}>
            <IconBadge icon="cloud-offline" size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[font.bodyStrong, { color: theme.text }]}>Readable without signal</Text>
              <Body dim style={{ marginTop: 2 }}>
                Saved venues, recent searches, and booking confirmations are stored on the device.
              </Body>
            </View>
          </View>
        </Card>
      </View>

      {activeBookings.length ? (
        <View style={gutter()}>
          <SectionHeader title="Confirmations" subtitle="Available offline" />
          {activeBookings.map((b) => {
            const v = venueById[b.venueId];
            return (
              <Card key={b.id} style={{ marginBottom: space.md }}>
                <View style={[ui.row, { alignItems: 'flex-start' }]}>
                  <IconBadge icon="receipt" size={40} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={[font.cardTitle, { color: theme.text }]}>{v?.name ?? b.venueId}</Text>
                    <Text style={[font.meta, { color: theme.textDim }]}>
                      {b.kind === 'waitlist'
                        ? `Waitlist · position ${b.waitlistPosition ?? '—'}`
                        : `${b.date} · ${b.time} · ${b.partySize} guests`}
                    </Text>
                    {b.tier ? (
                      <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]}>Table {b.tier}</Text>
                    ) : null}
                    {b.deposit ? (
                      <Text style={[font.small, { color: theme.textDim }]}>
                        Deposit paid ${b.deposit}, applied to your minimum
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[font.small, { color: b.status === 'confirmed' ? theme.open : theme.warn }]}>
                    {b.status}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      <View style={gutter()}>
        <SectionHeader
          title="Collections"
          subtitle="Private by default, shareable by link"
          actionLabel={adding ? 'Cancel' : 'Create'}
          onAction={() => setAdding((a) => !a)}
        />

        {adding ? (
          <Card style={{ marginBottom: space.md }}>
            <Label>Name this collection</Label>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Cigar spots in Houston"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="Collection name"
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
            <Button
              label="Create collection"
              full
              style={{ marginTop: space.md }}
              disabled={!newName.trim()}
              onPress={() => {
                createCollection(newName);
                setNewName('');
                setAdding(false);
              }}
            />
          </Card>
        ) : null}

        {collections.length === 0 ? (
          <EmptyState
            icon="bookmark"
            title="No collections yet"
            body="Collections are how you shortlist. Make one for the anniversary dinner and one for the cigar list, then add venues from any profile."
            actionLabel="Create a collection"
            onAction={() => setAdding(true)}
          />
        ) : (
          collections.map((c) => {
            const list = c.entries.map((e) => venueById[e.venueId]).filter(Boolean);
            const openCount = list.filter((v) => venueState(v, now).open).length;
            return (
              <Card key={c.id} style={{ marginBottom: space.md }} padded={false}>
                <Pressable
                  onPress={() => router.push(`/collection/${c.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, ${list.length} venues, ${openCount} open now`}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md }}
                >
                  <IconBadge icon={c.collaboratorIds.length ? 'people' : c.shared ? 'link' : 'lock-closed'} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[font.meta, { color: theme.textDim }]}>
                      {list.length} {list.length === 1 ? 'venue' : 'venues'} · {openCount} open now
                      {c.collaboratorIds.length
                        ? ` · ${c.collaboratorIds.length} ${c.collaboratorIds.length === 1 ? 'collaborator' : 'collaborators'}`
                        : c.shared
                          ? ' · shared by link'
                          : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textFaint} />
                </Pressable>

                <Divider />
                <View style={{ flexDirection: 'row' }}>
                  <RowAction
                    icon="share-outline"
                    label="Share"
                    onPress={() =>
                      Share.share({
                        message: `${c.name} — ${list.map((v) => v.name).join(', ')} (Nightlife)`,
                      }).catch(() => undefined)
                    }
                  />
                  <Divider style={{ width: 1, height: '100%' }} />
                  <RowAction
                    icon="trash-outline"
                    label="Delete"
                    danger
                    onPress={() =>
                      // U-03: destructive actions confirm with the consequence stated.
                      Alert.alert(
                        `Delete “${c.name}”?`,
                        `This removes the collection and its ${list.length} saved ${
                          list.length === 1 ? 'venue' : 'venues'
                        }. The venues themselves are unaffected. This cannot be undone.`,
                        [
                          { text: 'Keep it', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteCollection(c.id) },
                        ],
                      )
                    }
                  />
                </View>
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}

function RowAction({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? theme.closed : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[font.small, { color }]}>{label}</Text>
    </Pressable>
  );
}

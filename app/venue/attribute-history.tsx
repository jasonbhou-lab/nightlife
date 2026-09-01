import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { Body, Button, Callout, Card, Divider, gutter, IconBadge, Screen, ScreenHeader } from '@/components/ui';
import { attributeByKey } from '@/data/attributes';
import { useCatalogue } from '@/data/catalogue';
import { getVenueAttributeHistory, updateVenueAttributes } from '@/data/repository';
import { formatAttribute, relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { AttributeValue, VenueAttributeHistoryEntry } from '@/types';

/**
 * F-BIZ-03 (full): what changed, when, and by whom, with a real way back.
 * Every entry is a snapshot of `attributes` from immediately *before* that
 * edit (see venue_attribute_history's own header). "Restore this version" is
 * not a special code path — it calls `updateVenueAttributes` with that old
 * snapshot, the same write a normal edit makes, which is why doing it logs a
 * fresh history row for the state right before the restore rather than
 * silently rewriting history.
 */
export default function AttributeHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, now, isManagingVenue } = useApp();
  const { getVenue, setVenueAttributes } = useCatalogue();

  const venue = getVenue(venueId);
  const [entries, setEntries] = useState<VenueAttributeHistoryEntry[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!venueId) return;
    getVenueAttributeHistory(venueId).then(setEntries);
  }, [venueId]);

  useEffect(() => {
    if (venue && isManagingVenue(venue.id)) load();
  }, [venue, load]);

  // Each entry is the state *before* its own edit; pairing it with the state
  // right after (the next-newest entry, or the venue's current live
  // attributes for the newest entry) is what turns a bare snapshot into a
  // readable "here is what this edit actually changed" list.
  const withDiffs = useMemo(() => {
    if (!entries || !venue) return [];
    return entries.map((entry, i) => {
      const after = i === 0 ? venue.attributes : entries[i - 1].attributes;
      const keys = new Set([...Object.keys(entry.attributes), ...Object.keys(after)]);
      const changed = Array.from(keys)
        .filter((k) => JSON.stringify(entry.attributes[k] ?? null) !== JSON.stringify(after[k] ?? null))
        .sort();
      return { entry, changed };
    });
  }, [entries, venue]);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Change history" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest' || !isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Change history" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can see its change history.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const restore = (targetEntry: VenueAttributeHistoryEntry) => {
    Alert.alert(
      'Restore this version?',
      'Every attribute reverts to what it was at this point. This itself becomes a new change, so nothing already logged is lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setRestoringId(targetEntry.id);
            const result = await updateVenueAttributes({ venueId: venue.id, attributes: targetEntry.attributes });
            setRestoringId(null);
            if (!result.ok) {
              Alert.alert('Could not restore', result.error);
              return;
            }
            setVenueAttributes(venue.id, result.attributes, result.meta);
            load();
          },
        },
      ],
    );
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Change history" subtitle={venue.name} onBack={() => router.back()} />

      {entries === null ? (
        <View style={{ alignItems: 'center', paddingTop: space.xl }}>
          <ActivityIndicator color={theme.text} />
        </View>
      ) : entries.length === 0 ? (
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="time-outline" size={52} />
              <Text style={[font.cardTitle, { color: theme.text, textAlign: 'center' }]}>No edits yet</Text>
              <Body dim style={{ textAlign: 'center' }}>
                Changes to this listing's details will show up here once you make one.
              </Body>
            </View>
          </Card>
        </View>
      ) : (
        <View style={gutter()}>
          <Card padded={false}>
            {withDiffs.map(({ entry, changed }, i) => (
              <View key={entry.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ padding: space.lg, gap: space.sm }}>
                  <View style={[{ flexDirection: 'row', alignItems: 'center' }]}>
                    <Text style={[font.bodyStrong, { color: theme.text, flex: 1 }]}>
                      {relativeDate(entry.changedAt, now)}
                    </Text>
                    <Text style={[font.small, { color: theme.textFaint }]}>
                      {entry.changedByName ?? 'Unknown'}
                    </Text>
                  </View>
                  {changed.length ? (
                    <View style={{ gap: 4 }}>
                      {changed.map((key) => {
                        const label = attributeByKey[key]?.label ?? key;
                        const after = i === 0 ? venue.attributes : withDiffs[i - 1].entry.attributes;
                        return (
                          <Text key={key} style={[font.small, { color: theme.textDim }]}>
                            <Text style={{ color: theme.text }}>{label}</Text>: {valueOrNone(key, entry.attributes[key])}
                            {' → '}
                            {valueOrNone(key, after[key])}
                          </Text>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[font.small, { color: theme.textFaint }]}>No attribute fields changed.</Text>
                  )}
                  <Button
                    label="Restore this version"
                    variant="ghost"
                    loading={restoringId === entry.id}
                    onPress={() => restore(entry)}
                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  />
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}
      <View style={{ height: space.xxxl }} />
    </Screen>
  );
}

function valueOrNone(key: string, v: AttributeValue | undefined): string {
  if (v == null || v === '') return 'not set';
  return formatAttribute(key, v);
}

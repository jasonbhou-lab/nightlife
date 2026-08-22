import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  Body, Callout, Card, Chip, Divider, gutter, Label, Screen, ScreenHeader, SectionHeader,
  styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { formatAttribute, relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

const DIET_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  gluten_free: 'Gluten-free',
  halal: 'Halal',
  kosher: 'Kosher',
  nut_free_kitchen: 'Nut-free kitchen',
};

/**
 * Menus (F-PROFILE-05): item-level menus for restaurants, tap lists for bars,
 * bottle and table-service menus for clubs and lounges, humidor highlights for
 * cigar lounges.
 *
 * The volatile-list treatment is the point. A rotating tap list is the
 * fastest-moving field in the whole data model, so it is either integration-fed
 * or explicitly labeled as user-reported with a timestamp — never presented as
 * a settled menu.
 */
export default function MenuScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { now } = useApp();
  const { getVenue } = useCatalogue();
  const venue = getVenue(id);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Menu" onBack={() => router.back()} />
      </Screen>
    );
  }

  const liveFed = venue.attributes.liveTapList === true;
  const dietary = Array.isArray(venue.attributes.dietary) ? (venue.attributes.dietary as string[]) : [];

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="Menu" subtitle={venue.name} onBack={() => router.back()} />

      {venue.menus.some((m) => m.volatile) ? (
        <View style={gutter()}>
          <Callout
            tone={liveFed ? 'info' : 'warn'}
            icon={liveFed ? 'wifi' : 'time'}
            title={liveFed ? 'Integration-fed, updates within minutes of a keg change' : 'User-reported, timestamped'}
          >
            <Body dim>
              {liveFed
                ? 'This list comes from the venue’s own taproom system rather than from a person typing it in.'
                : `Reported by visitors and staff rather than fed from a system. Last touched ${relativeDate(
                    venue.defaultMeta.updatedAt,
                    now,
                  )}. Rotating lines change faster than any other field on the platform.`}
            </Body>
          </Callout>
        </View>
      ) : null}

      {dietary.length ? (
        <View style={gutter()}>
          <Card>
            <Label>Dietary</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
              {dietary.map((d) => (
                <Chip key={d} label={DIET_LABELS[d] ?? d} icon="leaf" />
              ))}
            </View>
            {venue.attributes.allergenNotes ? (
              <Body dim style={{ marginTop: space.md }}>
                {String(venue.attributes.allergenNotes)}
              </Body>
            ) : null}
          </Card>
        </View>
      ) : null}

      {venue.menus.length === 0 ? (
        <View style={gutter()}>
          <Card>
            <Body dim>
              No menu on file. This listing is unclaimed, so nobody has uploaded one. Menus can be
              added by photo and extracted, but a person confirms the result before it publishes.
            </Body>
          </Card>
        </View>
      ) : null}

      {venue.menus.map((section) => (
        <View key={section.title} style={gutter()}>
          <SectionHeader title={section.title} subtitle={section.note} />
          <Card padded={false}>
            {section.items.map((item, i) => (
              <View key={item.name}>
                {i > 0 ? <Divider /> : null}
                <View
                  style={[
                    ui.row,
                    { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md, alignItems: 'flex-start' },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        font.body,
                        {
                          color: item.soldOut ? theme.textFaint : theme.text,
                          textDecorationLine: item.soldOut ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.detail ? (
                      <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]}>{item.detail}</Text>
                    ) : null}
                    {item.tags?.length ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {item.tags.map((t) => (
                          <View
                            key={t}
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 5,
                              backgroundColor: theme.accentSoft,
                            }}
                          >
                            <Text style={[font.micro, { color: theme.accentSoftText }]}>
                              {(DIET_LABELS[t] ?? t).toUpperCase()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  {item.soldOut ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="close-circle" size={13} color={theme.closed} />
                      <Text style={[font.small, { color: theme.closed }]}>Out</Text>
                    </View>
                  ) : item.price != null && item.price > 0 ? (
                    <Text style={[font.bodyStrong, { color: theme.text }]}>${item.price}</Text>
                  ) : item.price === 0 ? (
                    <Text style={[font.small, { color: theme.open }]}>Included</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        </View>
      ))}

      {/* Ordering: honest about what is not built, and about the alcohol rule. */}
      {venue.attributes.takeout || venue.attributes.delivery ? (
        <View style={gutter()}>
          <SectionHeader title="Ordering" />
          <Card>
            <View style={{ gap: space.sm }}>
              <Row label="Takeout" value={formatAttribute('takeout', venue.attributes.takeout ?? false)} />
              <Row label="Delivery" value={formatAttribute('delivery', venue.attributes.delivery ?? false)} />
              <Row label="Curbside" value={formatAttribute('curbside', venue.attributes.curbside ?? false)} />
            </View>
            <View
              style={{
                marginTop: space.md,
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: theme.cardMuted,
              }}
            >
              <Text style={[font.small, { color: theme.textDim, lineHeight: 17 }]}>
                Alcohol is excluded from delivery unless both the venue and the jurisdiction permit
                it and age is verified at handoff. Where delivery is offered, every fee, service
                charge, and markup is itemized at checkout rather than rolled into one line. Checkout
                itself is not implemented in this prototype.
              </Text>
            </View>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[ui.row, { minHeight: 32 }]}>
      <Text style={[font.body, { color: theme.textDim, flex: 1 }]}>{label}</Text>
      <Text style={[font.bodyStrong, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Body, Button, Card, Chip, gutter, Label, Screen, ScreenHeader, SectionHeader, styles as ui,
} from '@/components/ui';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

const CUISINES = ['Steakhouse', 'Gulf Seafood', 'Tex-Mex', 'Vietnamese', 'Italian', 'Barbecue', 'Sushi', 'Brunch'];
const DIETARY = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
];

/**
 * Preference capture (F-SOCIAL-07). Skippable by design — a preference wall
 * before the first useful screen costs more sessions than it earns.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { prefs, setPrefs } = useApp();
  const [draft, setDraft] = useState(prefs);

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title="Preferences"
        subtitle="All optional, all changeable later"
        onBack={() => router.back()}
      />

      <View style={gutter()}>
        <Card>
          <Body dim>
            These weight your home feed and nothing else. They never filter search results, because
            silently hiding venues from a search someone typed is a worse failure than showing one
            they do not want.
          </Body>
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Food" subtitle="What you look for" />
        <Card>
          <Label>Cuisines</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            {CUISINES.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={draft.cuisines.includes(c)}
                onPress={() => setDraft({ ...draft, cuisines: toggle(draft.cuisines, c) })}
              />
            ))}
          </View>
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Dietary needs" subtitle="Surfaces venues that actually accommodate them" />
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {DIETARY.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                selected={draft.dietary.includes(d.value)}
                onPress={() => setDraft({ ...draft, dietary: toggle(draft.dietary, d.value) })}
              />
            ))}
          </View>
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Price comfort" />
        <Card>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {[1, 2, 3, 4].map((t) => (
              <Chip
                key={t}
                label={'$'.repeat(t)}
                selected={draft.priceComfort.includes(t)}
                onPress={() => setDraft({ ...draft, priceComfort: toggle(draft.priceComfort, t) })}
              />
            ))}
          </View>
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Nightlife" />
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip
              label="Bars, lounges, clubs"
              selected={draft.nightlifeInterest}
              onPress={() => setDraft({ ...draft, nightlifeInterest: !draft.nightlifeInterest })}
            />
            <Chip
              label="Cigar lounges"
              selected={draft.cigarInterest}
              onPress={() => setDraft({ ...draft, cigarInterest: !draft.cigarInterest })}
            />
          </View>
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Typical party size" />
        <Card>
          <View style={[ui.row, { gap: space.sm, flexWrap: 'wrap' }]}>
            {[1, 2, 4, 6, 8].map((n) => (
              <Chip
                key={n}
                label={n === 1 ? 'Just me' : `${n}`}
                selected={draft.typicalPartySize === n}
                onPress={() => setDraft({ ...draft, typicalPartySize: n })}
              />
            ))}
          </View>
        </Card>
      </View>

      <View style={[gutter(), { gap: space.sm }]}>
        <Button
          label="Save preferences"
          full
          onPress={() => {
            setPrefs({ ...draft, completedOnboarding: true });
            router.back();
          }}
        />
        <Button
          label="Skip"
          variant="ghost"
          full
          onPress={() => {
            setPrefs({ ...prefs, completedOnboarding: true });
            router.back();
          }}
        />
        <Text style={[font.small, { color: theme.onGroundFaint, textAlign: 'center', marginTop: space.sm }]}>
          Personalization can be turned off entirely from your profile.
        </Text>
      </View>
    </Screen>
  );
}

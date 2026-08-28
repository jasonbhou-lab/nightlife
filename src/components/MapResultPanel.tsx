import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Card, styles as ui } from '@/components/ui';
import { priceLabel } from '@/lib/format';
import { venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { Venue } from '@/types';

/**
 * The strip below the map: a tapped pin's detail card, or a plain count when
 * nothing is selected. Identical on both platforms (F-SEARCH-03), so it lives
 * outside `MiniMap.web.tsx` / `MiniMap.native.tsx` rather than being copied
 * into each — the map rendering is what differs by platform, not this.
 */
export function MapResultPanel({
  selected,
  visibleCount,
  totalCount,
}: {
  selected: Venue | null;
  visibleCount: number;
  totalCount: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { now } = useApp();

  if (selected) {
    return (
      <Card onPress={() => router.push(`/venue/${selected.id}`)} accessibilityLabel={`Open ${selected.name}`}>
        <View style={[ui.row]}>
          <View style={{ flex: 1 }}>
            <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {selected.name}
            </Text>
            <Text style={[font.meta, { color: theme.textDim }]} numberOfLines={1}>
              {selected.primary.category} · {priceLabel(selected.priceTier)} · {selected.distanceMi.toFixed(1)} mi
            </Text>
            <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]} numberOfLines={1}>
              {venueState(selected, now).label}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textFaint} />
        </View>
      </Card>
    );
  }

  return (
    <Text style={[font.small, { color: theme.onGroundDim, textAlign: 'center' }]}>
      {visibleCount} of {totalCount} results in view. Tap a pin for details.
    </Text>
  );
}

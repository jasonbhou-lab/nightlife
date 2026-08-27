import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdLabel, Card, IconBadge, styles as ui } from '@/components/ui';
import { Stars } from '@/components/Stars';
import { verticalMeta } from '@/data/taxonomy';
import { decisionChips } from '@/lib/decide';
import { categoryLine, priceLabel } from '@/lib/format';
import { formatDuration, venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Venue } from '@/types';

/**
 * The list row from the prototype: white card, circular icon badge on the left,
 * bold name with a meta line, and the value pushed to the right edge. Here the
 * right-edge value is the rating, and the row carries a category-specific
 * decision line underneath instead of a second currency figure.
 */
export function VenueCard({
  venue,
  compact = false,
  rightSlot,
  onPress,
}: {
  venue: Venue;
  compact?: boolean;
  rightSlot?: React.ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { now, isSaved, toggleSave } = useApp();

  const state = venueState(venue, now);
  const chips = decisionChips(venue, now, compact ? 2 : 3);
  const saved = isSaved(venue.id);

  /**
   * The bookmark button used to sit inside `Card`'s own onPress Pressable,
   * and on web both render as a real HTML `<button>` (react-native-web maps
   * `accessibilityRole="button"` straight to the `<button>` tag for both
   * native and web accessibility, not just a `<div role="button">`) — a
   * `<button>` nested inside another `<button>` is invalid HTML, which is
   * exactly what every "cannot contain a nested <button>" warning in this
   * app's browser console has been. Card itself stays a plain, non-pressable
   * wrapper here; the navigable content and the bookmark toggle are now two
   * sibling buttons instead of one nested inside the other, so both keep a
   * real accessibility role on every platform without ever nesting.
   */
  return (
    <Card padded={false} style={{ marginBottom: space.md }}>
      <Pressable
        onPress={onPress ?? (() => router.push(`/venue/${venue.id}`))}
        accessibilityRole="button"
        accessibilityLabel={`${venue.name}, ${venue.primary.category}, rated ${venue.rating} from ${venue.reviewCount} reviews, ${state.label}`}
        style={({ pressed }) => [{ padding: space.lg }, pressed && { opacity: 0.9 }]}
      >
      {venue.promoted ? (
        <View style={{ marginBottom: space.sm }}>
          <AdLabel />
        </View>
      ) : null}

      <View style={[ui.row, { alignItems: 'flex-start' }]}>
        <IconBadge
          icon={verticalMeta[venue.primary.vertical].icon as keyof typeof Ionicons.glyphMap}
          size={compact ? 38 : 46}
        />

        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {venue.name}
          </Text>
          <Text style={[font.meta, { color: theme.textDim, marginTop: 1 }]} numberOfLines={1}>
            {categoryLine(venue)}
          </Text>
          <View style={[ui.row, { marginTop: 4, gap: space.sm, flexWrap: 'wrap' }]}>
            <Text style={[font.small, { color: theme.textDim }]}>{priceLabel(venue.priceTier)}</Text>
            <Text style={[font.small, { color: theme.textFaint }]}>·</Text>
            <Text style={[font.small, { color: theme.textDim }]}>{venue.distanceMi.toFixed(1)} mi</Text>
            <Text style={[font.small, { color: theme.textFaint }]}>·</Text>
            <Text style={[font.small, { color: theme.textDim }]} numberOfLines={1}>
              {venue.neighborhood}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', marginLeft: space.sm }}>
          <Text style={[font.cardTitle, { color: theme.text }]}>{venue.rating.toFixed(1)}</Text>
          <Stars value={venue.rating} size={10} />
          <Text style={[font.small, { color: theme.textFaint, marginTop: 1 }]}>
            {venue.reviewCount.toLocaleString('en-US')}
          </Text>
        </View>
      </View>

      {/* Open state and the category's decision line. */}
      <View style={[ui.row, { marginTop: space.md, gap: space.sm, flexWrap: 'wrap' }]}>
        <OpenPill state={state} />
        {chips.map((c) => (
          <View
            key={c.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: space.sm,
              paddingVertical: 4,
              borderRadius: radius.sm,
              backgroundColor: theme.cardMuted,
            }}
          >
            <Ionicons name={c.icon} size={12} color={c.stale ? theme.warn : theme.textDim} />
            <Text style={[font.small, { color: c.stale ? theme.warn : theme.text }]} numberOfLines={1}>
              {c.stale ? `${c.label} (dated)` : c.label}
            </Text>
          </View>
        ))}
      </View>

      {venue.consumerAlert ? (
        <View style={[ui.row, { marginTop: space.sm, gap: 5 }]}>
          <Ionicons name="warning" size={13} color={theme.closed} />
          <Text style={[font.small, { color: theme.closed, flex: 1 }]} numberOfLines={1}>
            Consumer Alert on this listing
          </Text>
        </View>
      ) : null}

      {venue.closure ? (
        <View style={[ui.row, { marginTop: space.sm, gap: 5 }]}>
          <Ionicons name="close-circle" size={13} color={theme.closed} />
          <Text style={[font.small, { color: theme.closed, flex: 1 }]} numberOfLines={2}>
            {venue.closure.state === 'moved'
              ? 'Moved — see successor listing'
              : venue.closure.state === 'permanent'
                ? 'Permanently closed'
                : venue.closure.state === 'seasonal'
                  ? 'Seasonal, currently closed'
                  : 'Temporarily closed'}
          </Text>
        </View>
      ) : null}
      </Pressable>

      {rightSlot ?? (
        <Pressable
          onPress={() => toggleSave(venue.id)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${venue.name} from saved` : `Save ${venue.name}`}
          accessibilityState={{ selected: saved }}
          style={{ position: 'absolute', top: space.sm, right: space.sm, padding: 6 }}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? theme.accent : theme.textFaint} />
        </Pressable>
      )}
    </Card>
  );
}

export function OpenPill({
  state,
}: {
  state: { open: boolean; label: string; closingSoon: boolean; minutes: number | null };
}) {
  const theme = useTheme();
  const bg = state.open ? (state.closingSoon ? theme.warnSoft : theme.openSoft) : theme.closedSoft;
  const fg = state.open ? (state.closingSoon ? theme.warn : theme.open) : theme.closed;
  const text =
    state.open && state.closingSoon && state.minutes != null
      ? `Closes in ${formatDuration(state.minutes)}`
      : state.label;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: space.sm,
        paddingVertical: 4,
        borderRadius: radius.sm,
        backgroundColor: bg,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <Text style={[font.small, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

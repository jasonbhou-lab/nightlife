import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/state/AppProvider';
import { font, HIT, space } from '@/theme';

export function Stars({
  value,
  size = 14,
  showValue = false,
  count,
}: {
  value: number;
  size?: number;
  showValue?: boolean;
  count?: number;
}) {
  const theme = useTheme();
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
      accessibilityLabel={`${value.toFixed(1)} out of 5 stars${count != null ? `, ${count} reviews` : ''}`}
    >
      {showValue ? (
        <Text style={[font.bodyStrong, { color: theme.text, marginRight: 2 }]}>{value.toFixed(1)}</Text>
      ) : null}
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons
          key={i}
          name={i < full ? 'star' : i === full && half ? 'star-half' : 'star-outline'}
          size={size}
          color={theme.star}
        />
      ))}
      {count != null ? (
        <Text style={[font.small, { color: theme.textDim, marginLeft: 4 }]}>({count.toLocaleString('en-US')})</Text>
      ) : null}
    </View>
  );
}

/** Whole-star input, per F-REVIEW-01. */
export function StarInput({
  value,
  onChange,
  label,
  size = 30,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <View>
      {label ? <Text style={[font.meta, { color: theme.textDim, marginBottom: 4 }]}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === n }}
            accessibilityLabel={`${n} star${n === 1 ? '' : 's'}${label ? ` for ${label}` : ''}`}
            hitSlop={6}
            style={{ minWidth: HIT - 8, minHeight: HIT - 8, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={theme.star} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bar used for sub-rating averages and the rating distribution. */
export function Meter({
  label,
  value,
  max = 5,
  right,
}: {
  label: string;
  value: number;
  max?: number;
  right?: string;
}) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={{ marginBottom: space.sm }} accessibilityLabel={`${label}: ${value} of ${max}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={[font.meta, { color: theme.textDim, flex: 1 }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[font.small, { color: theme.text }]}>{right ?? value.toFixed(1)}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.cardMuted, overflow: 'hidden' }}>
        <View
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            borderRadius: 3,
            backgroundColor: pct >= 0.7 ? theme.accent : pct >= 0.45 ? theme.star : theme.closed,
          }}
        />
      </View>
    </View>
  );
}

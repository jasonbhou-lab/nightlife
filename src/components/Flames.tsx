import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/state/AppProvider';
import { font, HIT, space } from '@/theme';

/**
 * Vibe Rating: energy/atmosphere, rated on the same 1-5 scale and with the
 * same mandatory-per-review treatment as the star rating (`Stars`/`StarInput`
 * in `Stars.tsx`), but a distinct axis — a quiet, excellent restaurant and a
 * loud, mediocre one can land on opposite ends of this scale from their star
 * rating. Ionicons has no `flame-half` glyph, so unlike `Stars` (which shows
 * a half-star between whole values) this rounds to the nearest whole flame
 * rather than faking a half-fill.
 */
export function Flames({
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
  const full = Math.round(value);
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
      accessibilityLabel={`${value.toFixed(1)} out of 5 flames${count != null ? `, ${count} reviews` : ''}`}
    >
      {showValue ? (
        <Text style={[font.bodyStrong, { color: theme.text, marginRight: 2 }]}>{value.toFixed(1)}</Text>
      ) : null}
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons key={i} name={i < full ? 'flame' : 'flame-outline'} size={size} color={theme.flame} />
      ))}
      {count != null ? (
        <Text style={[font.small, { color: theme.textDim, marginLeft: 4 }]}>({count.toLocaleString('en-US')})</Text>
      ) : null}
    </View>
  );
}

/** Whole-flame input, treated the same as `StarInput` — tap to set, mandatory per review. */
export function FlameInput({
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
            accessibilityLabel={`${n} flame${n === 1 ? '' : 's'}${label ? ` for ${label}` : ''}`}
            hitSlop={6}
            style={{ minWidth: HIT - 8, minHeight: HIT - 8, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={n <= value ? 'flame' : 'flame-outline'} size={size} color={theme.flame} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

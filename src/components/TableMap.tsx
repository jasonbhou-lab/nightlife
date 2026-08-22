import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { TableTier } from '@/types';

/**
 * Interactive table map for nightclub and lounge table service (F-BOOK-06).
 * Sections are named, minimums are visible before selection, and unavailable
 * tables are shown as unavailable rather than hidden — a room that looks empty
 * when it is booked out is worse than an honest one.
 */
export function TableMap({
  tables,
  selectedId,
  onSelect,
}: {
  tables: TableTier[];
  selectedId: string | null;
  onSelect: (t: TableTier) => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <View
        style={{
          height: 260,
          borderRadius: radius.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.cardBorder,
        }}
        accessibilityLabel={`Room map with ${tables.length} tables`}
      >
        <LinearGradient
          colors={theme.mode === 'dark' ? ['#0A1128', '#111E44'] : ['#EEF3FF', '#D6E2FB']}
          style={{ flex: 1 }}
        >
          {/* Stage / bar reference marks so the map reads as a room. */}
          <View
            style={{
              position: 'absolute',
              top: 6,
              left: '30%',
              right: '30%',
              height: 16,
              borderRadius: 8,
              backgroundColor: theme.inset,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[font.micro, { color: '#FFFFFF' }]}>DJ / STAGE</Text>
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: 6,
              left: '8%',
              right: '8%',
              height: 14,
              borderRadius: 7,
              backgroundColor: theme.mode === 'dark' ? 'rgba(147,180,249,0.22)' : 'rgba(11,31,82,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[font.micro, { color: theme.textDim }]}>BAR</Text>
          </View>

          {tables.map((t) => {
            const sel = t.id === selectedId;
            const bg = !t.available ? theme.cardMuted : sel ? theme.accent : theme.card;
            const fg = !t.available ? theme.textFaint : sel ? theme.accentText : theme.text;
            return (
              <Pressable
                key={t.id}
                disabled={!t.available}
                onPress={() => onSelect(t)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel, disabled: !t.available }}
                accessibilityLabel={`Table ${t.name}, ${t.section}, seats ${t.seats}, minimum $${t.minimumSpend}${
                  t.available ? '' : ', unavailable'
                }`}
                style={{
                  position: 'absolute',
                  left: `${t.x * 100}%`,
                  top: `${18 + t.y * 68}%`,
                  transform: [{ translateX: -26 }, { translateY: -18 }],
                  width: 56,
                  minHeight: 44,
                  borderRadius: radius.sm,
                  backgroundColor: bg,
                  borderWidth: 1.5,
                  borderColor: sel ? theme.accent : theme.cardBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 4,
                  opacity: t.available ? 1 : 0.55,
                }}
              >
                <Text style={[font.small, { color: fg }]}>{t.name}</Text>
                <Text style={[font.micro, { color: fg }]}>${t.minimumSpend >= 1000 ? `${t.minimumSpend / 1000}k` : t.minimumSpend}</Text>
                {!t.available ? <Ionicons name="lock-closed" size={9} color={fg} /> : null}
              </Pressable>
            );
          })}
        </LinearGradient>
      </View>

      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm, flexWrap: 'wrap' }}>
        <Legend color={theme.card} label="Available" border={theme.cardBorder} />
        <Legend color={theme.accent} label="Selected" border={theme.accent} />
        <Legend color={theme.cardMuted} label="Booked" border={theme.cardBorder} />
      </View>
    </View>
  );
}

function Legend({ color, label, border }: { color: string; label: string; border: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color, borderWidth: 1, borderColor: border }} />
      <Text style={[font.small, { color: theme.textDim }]}>{label}</Text>
    </View>
  );
}

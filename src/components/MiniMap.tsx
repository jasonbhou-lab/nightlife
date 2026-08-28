import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, styles as ui } from '@/components/ui';
import { verticalMeta } from '@/data/taxonomy';
import { isPromotedNow } from '@/lib/advertising';
import { priceLabel } from '@/lib/format';
import { venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Venue } from '@/types';

/**
 * Map results view with map-bounded re-search (F-SEARCH-03).
 *
 * This is a schematic map rather than a tile-server map: the app has no network
 * dependency and no API key, and the requirement being demonstrated is
 * bounded re-search plus pin interaction, not cartography. Venue positions are
 * normalized coordinates. Swapping in react-native-maps later means replacing
 * this component only — the bounds contract stays the same.
 */

type Bounds = { x0: number; y0: number; x1: number; y1: number };
const FULL: Bounds = { x0: 0, y0: 0, x1: 1, y1: 1 };

const MAP_H = 320;

export function MiniMap({
  venues,
  onSearchArea,
}: {
  venues: Venue[];
  onSearchArea: (inBounds: Venue[]) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { now } = useApp();
  const [bounds, setBounds] = useState<Bounds>(FULL);
  const [selected, setSelected] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);

  const visible = useMemo(
    () =>
      venues.filter(
        (v) => v.map.x >= bounds.x0 && v.map.x <= bounds.x1 && v.map.y >= bounds.y0 && v.map.y <= bounds.y1,
      ),
    [venues, bounds],
  );

  const project = (v: Venue) => ({
    left: `${((v.map.x - bounds.x0) / (bounds.x1 - bounds.x0)) * 100}%` as const,
    top: `${((v.map.y - bounds.y0) / (bounds.y1 - bounds.y0)) * 100}%` as const,
  });

  const zoom = (factor: number) => {
    setBounds((b) => {
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      const w = Math.min(1, Math.max(0.2, (b.x1 - b.x0) * factor));
      const h = Math.min(1, Math.max(0.2, (b.y1 - b.y0) * factor));
      return {
        x0: Math.max(0, cx - w / 2),
        x1: Math.min(1, cx + w / 2),
        y0: Math.max(0, cy - h / 2),
        y1: Math.min(1, cy + h / 2),
      };
    });
    setMoved(true);
  };

  const pan = (dx: number, dy: number) => {
    setBounds((b) => {
      const w = b.x1 - b.x0;
      const h = b.y1 - b.y0;
      const nx = Math.max(0, Math.min(1 - w, b.x0 + dx * w));
      const ny = Math.max(0, Math.min(1 - h, b.y0 + dy * h));
      return { x0: nx, x1: nx + w, y0: ny, y1: ny + h };
    });
    setMoved(true);
  };

  const sel = visible.find((v) => v.id === selected);

  return (
    <View style={{ gap: space.md }}>
      <View
        style={{
          height: MAP_H,
          borderRadius: radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.cardBorder,
        }}
      >
        <LinearGradient
          colors={theme.mode === 'dark' ? ['#0A1128', '#0E1D42'] : ['#DCE8FF', '#B9CFFB']}
          style={{ flex: 1 }}
        >
          {/* Schematic street grid. */}
          {[0.2, 0.4, 0.6, 0.8].map((p) => (
            <View
              key={`h${p}`}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${p * 100}%`,
                height: 1,
                backgroundColor: theme.mode === 'dark' ? 'rgba(147,180,249,0.14)' : 'rgba(11,31,82,0.10)',
              }}
            />
          ))}
          {[0.25, 0.5, 0.75].map((p) => (
            <View
              key={`v${p}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${p * 100}%`,
                width: 1,
                backgroundColor: theme.mode === 'dark' ? 'rgba(147,180,249,0.14)' : 'rgba(11,31,82,0.10)',
              }}
            />
          ))}

          {visible.map((v) => {
            const pos = project(v);
            const open = venueState(v, now).open;
            const isSel = v.id === selected;
            return (
              <Pressable
                key={v.id}
                onPress={() => setSelected(isSel ? null : v.id)}
                accessibilityRole="button"
                accessibilityLabel={`${v.name}, ${v.primary.category}, ${open ? 'open' : 'closed'}`}
                hitSlop={8}
                style={{
                  position: 'absolute',
                  left: pos.left,
                  top: pos.top,
                  transform: [{ translateX: -16 }, { translateY: -16 }],
                }}
              >
                <View
                  style={{
                    width: isSel ? 38 : 32,
                    height: isSel ? 38 : 32,
                    borderRadius: 19,
                    backgroundColor: isPromotedNow(v.adCampaigns, now) ? theme.inset : open ? theme.accent : theme.textFaint,
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={verticalMeta[v.primary.vertical].icon as keyof typeof Ionicons.glyphMap}
                    size={isSel ? 18 : 15}
                    color="#FFFFFF"
                  />
                </View>
              </Pressable>
            );
          })}

          {/* Pan and zoom controls. No gesture handler needed. */}
          <View style={{ position: 'absolute', right: space.sm, top: space.sm, gap: 6 }}>
            <MapBtn icon="add" label="Zoom in" onPress={() => zoom(0.6)} />
            <MapBtn icon="remove" label="Zoom out" onPress={() => zoom(1.6)} />
            <MapBtn icon="locate" label="Reset map" onPress={() => { setBounds(FULL); setMoved(false); }} />
          </View>
          <View style={{ position: 'absolute', left: space.sm, bottom: space.sm, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <MapBtn icon="chevron-back" label="Pan west" onPress={() => pan(-0.4, 0)} />
              <MapBtn icon="chevron-up" label="Pan north" onPress={() => pan(0, -0.4)} />
              <MapBtn icon="chevron-down" label="Pan south" onPress={() => pan(0, 0.4)} />
              <MapBtn icon="chevron-forward" label="Pan east" onPress={() => pan(0.4, 0)} />
            </View>
          </View>
        </LinearGradient>
      </View>

      {moved ? (
        <Button
          label={`Search this area (${visible.length})`}
          icon="search"
          variant="onGround"
          full
          onPress={() => onSearchArea(visible)}
        />
      ) : null}

      {sel ? (
        <Card onPress={() => router.push(`/venue/${sel.id}`)} accessibilityLabel={`Open ${sel.name}`}>
          <View style={[ui.row]}>
            <View style={{ flex: 1 }}>
              <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>
                {sel.name}
              </Text>
              <Text style={[font.meta, { color: theme.textDim }]} numberOfLines={1}>
                {sel.primary.category} · {priceLabel(sel.priceTier)} · {sel.distanceMi.toFixed(1)} mi
              </Text>
              <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]} numberOfLines={1}>
                {venueState(sel, now).label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textFaint} />
          </View>
        </Card>
      ) : (
        <Text style={[font.small, { color: theme.onGroundDim, textAlign: 'center' }]}>
          {visible.length} of {venues.length} results in view. Tap a pin for details.
        </Text>
      )}
    </View>
  );
}

function MapBtn({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: theme.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.cardBorder,
      }}
    >
      <Ionicons name={icon} size={17} color={theme.text} />
    </Pressable>
  );
}

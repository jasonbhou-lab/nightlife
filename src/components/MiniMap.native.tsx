import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { MapResultPanel } from '@/components/MapResultPanel';
import { Button } from '@/components/ui';
import { verticalMeta } from '@/data/taxonomy';
import { isPromotedNow } from '@/lib/advertising';
import { venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { radius, space } from '@/theme';
import type { Venue } from '@/types';

/**
 * Native half of the platform split (F-SEARCH-03) — see MiniMap.web.tsx for
 * the web half and why this app has two files instead of one: no single
 * library covers a real Google Map on web, iOS, and Android at once with a
 * Metro-bundled Expo app today. `PROVIDER_GOOGLE` is explicit here because
 * without it iOS falls back to Apple Maps — the ask was Google Maps
 * everywhere, not "whatever each OS defaults to."
 *
 * Requires a development build, not Expo Go, once a real API key is set —
 * see the `react-native-maps` plugin block in app.config.ts.
 */

const HOUSTON_CENTER = { latitude: 29.7604, longitude: -95.3698 };
const MAP_H = 320;

type Bounds = { north: number; south: number; east: number; west: number };

function boundsOf(r: Region): Bounds {
  return {
    north: r.latitude + r.latitudeDelta / 2,
    south: r.latitude - r.latitudeDelta / 2,
    east: r.longitude + r.longitudeDelta / 2,
    west: r.longitude - r.longitudeDelta / 2,
  };
}

function inBounds(v: Venue, b: Bounds): boolean {
  return v.lat <= b.north && v.lat >= b.south && v.lng <= b.east && v.lng >= b.west;
}

export function MiniMap({
  venues,
  onSearchArea,
}: {
  venues: Venue[];
  onSearchArea: (inBounds: Venue[]) => void;
}) {
  const theme = useTheme();
  const { now } = useApp();

  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const mountedAt = useRef(Date.now());

  const initialRegion: Region = useMemo(() => {
    if (!venues.length) return { ...HOUSTON_CENTER, latitudeDelta: 0.2, longitudeDelta: 0.2 };
    return {
      latitude: venues.reduce((s, v) => s + v.lat, 0) / venues.length,
      longitude: venues.reduce((s, v) => s + v.lng, 0) / venues.length,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    };
  }, [venues]);

  const visible = useMemo(
    () => (bounds ? venues.filter((v) => inBounds(v, bounds)) : venues),
    [venues, bounds],
  );

  const selected = visible.find((v) => v.id === selectedId) ?? null;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ height: MAP_H, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.cardBorder }}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          onRegionChangeComplete={(region: Region) => {
            setBounds(boundsOf(region));
            if (Date.now() - mountedAt.current > 300) setMoved(true);
          }}
        >
          {visible.map((v) => {
            const open = venueState(v, now).open;
            const isSel = v.id === selectedId;
            const color = isPromotedNow(v.adCampaigns, now) ? theme.inset : open ? theme.accent : theme.textFaint;
            return (
              <Marker
                key={v.id}
                coordinate={{ latitude: v.lat, longitude: v.lng }}
                title={v.name}
                description={v.primary.category}
                onPress={() => setSelectedId(isSel ? null : v.id)}
              >
                <View
                  style={{
                    width: isSel ? 38 : 32,
                    height: isSel ? 38 : 32,
                    borderRadius: 19,
                    backgroundColor: color,
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
              </Marker>
            );
          })}
        </MapView>
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

      <MapResultPanel selected={selected} visibleCount={visible.length} totalCount={venues.length} />
    </View>
  );
}

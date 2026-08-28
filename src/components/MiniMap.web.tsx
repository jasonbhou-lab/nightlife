import { APIProvider, AdvancedMarker, Map as GoogleMap, Pin, type MapCameraChangedEvent } from '@vis.gl/react-google-maps';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { MapResultPanel } from '@/components/MapResultPanel';
import { Button } from '@/components/ui';
import { isPromotedNow } from '@/lib/advertising';
import { venueState } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Venue } from '@/types';

/**
 * Web half of the platform split (F-SEARCH-03) — see MiniMap.native.tsx for
 * the other half and why this app has two files instead of one. Renders a
 * real Google Map via the Maps JavaScript API (Google's own actively
 * maintained React wrapper, not the older community one), replacing the
 * schematic gradient-and-grid placeholder this used to be.
 *
 * `mapId="DEMO_MAP_ID"` is Google's own published sandbox id for
 * AdvancedMarker development — it works with any API key with zero Cloud
 * Console setup, but Google's own docs say not to ship it in production; a
 * real Map ID takes five minutes to create once this app has a production
 * Cloud project.
 */

const HOUSTON_CENTER = { lat: 29.7604, lng: -95.3698 };
const MAP_H = 320;

type Bounds = { north: number; south: number; east: number; west: number };

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
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;

  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const mountedAt = useRef(Date.now());

  const center = useMemo(() => {
    if (!venues.length) return HOUSTON_CENTER;
    return {
      lat: venues.reduce((s, v) => s + v.lat, 0) / venues.length,
      lng: venues.reduce((s, v) => s + v.lng, 0) / venues.length,
    };
  }, [venues]);

  const visible = useMemo(
    () => (bounds ? venues.filter((v) => inBounds(v, bounds)) : venues),
    [venues, bounds],
  );

  const selected = visible.find((v) => v.id === selectedId) ?? null;

  const onCameraChanged = useCallback((e: MapCameraChangedEvent) => {
    setBounds(e.detail.bounds);
    // The map fires its first camera-changed event on mount, from setting
    // the initial center/zoom — that is not the user moving the map, so it
    // must not trigger "Search this area" before anyone has touched it.
    if (Date.now() - mountedAt.current > 300) setMoved(true);
  }, []);

  if (!apiKey) {
    return (
      <View
        style={{
          height: MAP_H,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          backgroundColor: theme.cardMuted,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.lg,
        }}
      >
        <Text style={[font.bodyStrong, { color: theme.text, textAlign: 'center' }]}>Map unavailable</Text>
        <Text style={[font.small, { color: theme.textDim, textAlign: 'center', marginTop: 4 }]}>
          Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY (see .env.example) and restart the bundler.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ height: MAP_H, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.cardBorder }}>
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={center}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI={false}
            colorScheme={theme.mode === 'dark' ? 'DARK' : 'LIGHT'}
            onCameraChanged={onCameraChanged}
            style={{ width: '100%', height: '100%' }}
          >
            {visible.map((v) => {
              const open = venueState(v, now).open;
              const isSel = v.id === selectedId;
              const color = isPromotedNow(v.adCampaigns, now) ? theme.inset : open ? theme.accent : theme.textFaint;
              return (
                <AdvancedMarker
                  key={v.id}
                  position={{ lat: v.lat, lng: v.lng }}
                  title={v.name}
                  onClick={() => setSelectedId(isSel ? null : v.id)}
                >
                  <Pin background={color} borderColor="#FFFFFF" glyphColor="#FFFFFF" scale={isSel ? 1.15 : 1} />
                </AdvancedMarker>
              );
            })}
          </GoogleMap>
        </APIProvider>
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

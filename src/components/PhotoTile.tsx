import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Photo } from '@/types';

/**
 * Photo placeholder.
 *
 * The app ships no bundled photography, so a tile renders a deterministic
 * gradient keyed off the photo id plus the album's icon. What matters for the
 * PRD is the surrounding metadata, and that is all real: album classification
 * (F-PROFILE-03), owner versus community segmentation (F-MEDIA-06), and
 * alternative text on every image (PRD 5.4) — auto-generated for community
 * photos, owner-authored for owner photos.
 */

const albumIcon: Record<Photo['album'], keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant',
  drink: 'wine',
  interior: 'home',
  exterior: 'business',
  menu: 'document-text',
  crowd: 'people',
  humidor: 'leaf',
  stage: 'musical-notes',
  table: 'grid',
};

export const albumLabel: Record<Photo['album'], string> = {
  food: 'Food',
  drink: 'Drink',
  interior: 'Interior',
  exterior: 'Exterior',
  menu: 'Menu',
  crowd: 'Crowd',
  humidor: 'Humidor',
  stage: 'Stage',
  table: 'Table setup',
};

const RAMPS: [string, string][] = [
  ['#1B3FBF', '#5C8BFA'],
  ['#12307F', '#2E63F5'],
  ['#0A1A3F', '#1739A8'],
  ['#2E63F5', '#93B4F9'],
  ['#0B1F52', '#12307F'],
  ['#1739A8', '#5C8BFA'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function PhotoTile({
  photo,
  width,
  height,
  showMeta = true,
}: {
  photo: Photo;
  width: number | `${number}%`;
  height: number;
  showMeta?: boolean;
}) {
  const theme = useTheme();
  const ramp = RAMPS[hash(photo.id) % RAMPS.length];
  return (
    <View
      style={{ width, height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: ramp[0] }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={photo.alt}
    >
      <LinearGradient colors={ramp} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: space.sm, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(0,0,0,0.35)',
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <Ionicons name={albumIcon[photo.album]} size={11} color="#FFFFFF" />
            <Text style={[font.micro, { color: '#FFFFFF' }]}>{albumLabel[photo.album].toUpperCase()}</Text>
          </View>
          {showMeta ? (
            <View
              style={{
                backgroundColor: photo.by === 'owner' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.35)',
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text style={[font.micro, { color: photo.by === 'owner' ? theme.text : '#FFFFFF' }]}>
                {photo.by === 'owner' ? 'OWNER' : 'COMMUNITY'}
              </Text>
            </View>
          ) : null}
        </View>
        {showMeta ? (
          <Text style={[font.small, { color: '#FFFFFF' }]} numberOfLines={2}>
            {photo.caption}
          </Text>
        ) : null}
      </LinearGradient>
    </View>
  );
}

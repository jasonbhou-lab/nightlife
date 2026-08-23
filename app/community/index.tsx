import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import {
  Body, Button, Card, Chip, EmptyState, gutter, IconBadge, Screen, ScreenHeader, SectionHeader,
  styles as ui,
} from '@/components/ui';
import { communityMembers } from '@/data/community';
import { useCatalogue } from '@/data/catalogue';
import { relativeDate } from '@/lib/format';
import { buildActivityFeed } from '@/lib/social';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

/**
 * F-SOCIAL-02: follow people and venues, and the activity feed that
 * following produces. "People" here is a fixed roster (see
 * `src/data/community.ts`) rather than an open directory, because this
 * build has no real multi-user backend for a search-and-follow-anyone flow.
 */
export default function CommunityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    session, attemptContribution, now,
    followedMemberIds, followedVenueIds, isFollowingMember, toggleFollowMember, toggleFollowVenue,
  } = useApp();
  const { venueById, events: catalogueEvents, reviews: catalogueReviews } = useCatalogue();
  const [tab, setTab] = useState<'activity' | 'people'>('activity');

  const feed = useMemo(
    () =>
      buildActivityFeed({
        followedMemberIds,
        followedVenueIds,
        reviews: catalogueReviews,
        events: catalogueEvents,
      }),
    [followedMemberIds, followedVenueIds, catalogueReviews, catalogueEvents],
  );

  const followedVenues = followedVenueIds.map((id) => venueById[id]).filter(Boolean);

  const requireAccount = (action: () => void) => {
    if (session.role === 'guest') {
      attemptContribution();
      Alert.alert('Sign in to follow', 'Following people and venues needs an account, the same as writing a review.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    action();
  };

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="Community" subtitle="People and venues you follow" onBack={() => router.back()} />

      <View style={[gutter(), { flexDirection: 'row', gap: space.sm }]}>
        <Chip label="Activity" tone="ground" selected={tab === 'activity'} onPress={() => setTab('activity')} />
        <Chip label="People and venues" tone="ground" selected={tab === 'people'} onPress={() => setTab('people')} />
      </View>

      {tab === 'activity' ? (
        <View style={gutter()}>
          {feed.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Nothing here yet"
              body="Follow a few contributors or venues and their reviews, check-ins, and events show up here."
              actionLabel="Find people to follow"
              onAction={() => setTab('people')}
            />
          ) : (
            feed.map((item) => {
              const venue = venueById[item.venueId];
              return (
                <Card
                  key={item.id}
                  style={{ marginBottom: space.md }}
                  onPress={() => router.push(`/venue/${item.venueId}`)}
                  accessibilityLabel={`${item.kind} at ${venue?.name ?? 'a venue'}`}
                >
                  <View style={[ui.row, { alignItems: 'flex-start' }]}>
                    <IconBadge
                      icon={item.kind === 'review' ? 'star' : item.kind === 'checkin' ? 'location' : 'calendar'}
                      size={38}
                    />
                    <View style={{ flex: 1, marginLeft: space.md }}>
                      <View style={[ui.row, { gap: space.sm, flexWrap: 'wrap' }]}>
                        <Text style={[font.bodyStrong, { color: theme.text }]}>
                          {item.member?.name ?? item.authorName ?? venue?.name}
                        </Text>
                        <Text style={[font.small, { color: theme.textFaint }]}>
                          {relativeDate(item.date, now)}
                        </Text>
                      </View>
                      <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]}>
                        {item.kind === 'review'
                          ? `Reviewed ${venue?.name ?? 'a venue'}${item.rating ? `, ${item.rating} stars` : ''}`
                          : item.kind === 'checkin'
                            ? `Checked in at ${venue?.name ?? 'a venue'}`
                            : `New event at ${venue?.name ?? 'a venue'}: ${item.title}`}
                      </Text>
                      {item.text ? (
                        <Body dim numberOfLines={2} style={{ marginTop: space.sm }}>{item.text}</Body>
                      ) : item.note ? (
                        <Body dim numberOfLines={2} style={{ marginTop: space.sm }}>{item.note}</Body>
                      ) : null}
                      <Text style={[font.small, { color: theme.textFaint, marginTop: space.sm }]}>
                        {item.reason === 'followed_member' ? 'From someone you follow' : `From ${venue?.name ?? 'a venue you follow'}`}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      ) : (
        <>
          <View style={gutter()}>
            <SectionHeader title="People" subtitle="A fixed roster of the platform's most active contributors" />
            {communityMembers.map((m) => {
              const following = isFollowingMember(m.id);
              return (
                <Card
                  key={m.id}
                  style={{ marginBottom: space.md }}
                  onPress={() => router.push(`/community/${m.id}`)}
                  accessibilityLabel={`${m.name}. ${m.tagline}`}
                >
                  <View style={[ui.row, { alignItems: 'flex-start' }]}>
                    <IconBadge icon="person" size={40} />
                    <View style={{ flex: 1, marginLeft: space.md }}>
                      <View style={[ui.row, { gap: space.sm }]}>
                        <Text style={[font.bodyStrong, { color: theme.text }]}>{m.name}</Text>
                        {m.elite ? (
                          <View style={{ backgroundColor: theme.accentSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={[font.micro, { color: theme.accentSoftText }]}>ELITE</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[font.small, { color: theme.textDim, marginTop: 2 }]}>{m.tagline}</Text>
                      <Text style={[font.small, { color: theme.textFaint }]}>{m.homeNeighborhood}</Text>
                    </View>
                    <Button
                      label={following ? 'Following' : 'Follow'}
                      variant={following ? 'secondary' : 'primary'}
                      onPress={() => requireAccount(() => toggleFollowMember(m.id))}
                    />
                  </View>
                </Card>
              );
            })}
          </View>

          <View style={gutter()}>
            <SectionHeader title="Venues you follow" subtitle="New reviews and events surface in Activity" />
            {followedVenues.length === 0 ? (
              <Card>
                <Body dim>None yet. Follow a venue from its profile to get updates without messaging it.</Body>
              </Card>
            ) : (
              followedVenues.map((v) => (
                <Card
                  key={v.id}
                  style={{ marginBottom: space.md }}
                  onPress={() => router.push(`/venue/${v.id}`)}
                  accessibilityLabel={v.name}
                >
                  <View style={[ui.row]}>
                    <IconBadge icon="storefront" size={38} />
                    <View style={{ flex: 1, marginLeft: space.md }}>
                      <Text style={[font.cardTitle, { color: theme.text }]} numberOfLines={1}>{v.name}</Text>
                      <Text style={[font.small, { color: theme.textDim }]}>{v.neighborhood}</Text>
                    </View>
                    <Pressable
                      onPress={() => toggleFollowVenue(v.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Stop following ${v.name}`}
                    >
                      <Ionicons name="notifications" size={20} color={theme.accent} />
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

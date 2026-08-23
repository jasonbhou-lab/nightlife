import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Text, View } from 'react-native';

import { Stars } from '@/components/Stars';
import {
  Body, Button, Callout, Card, gutter, IconBadge, Screen, ScreenHeader, SectionHeader,
  styles as ui,
} from '@/components/ui';
import { communityById, communityCheckIns } from '@/data/community';
import { useCatalogue } from '@/data/catalogue';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

export default function CommunityMemberScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { now, session, attemptContribution, isFollowingMember, toggleFollowMember } = useApp();
  const { venueById, reviews } = useCatalogue();

  const member = id ? communityById[id] : undefined;

  if (!member) {
    return (
      <Screen>
        <ScreenHeader title="Not found" onBack={() => router.back()} />
      </Screen>
    );
  }

  const following = isFollowingMember(member.id);
  const theirReviews = useMemo(
    () => reviews.filter((r) => r.author === member.name && r.recommended).sort((a, b) => b.date.localeCompare(a.date)),
    [reviews, member.name],
  );
  const theirCheckIns = communityCheckIns.filter((c) => c.memberId === member.id && c.visibility === 'friends');

  const follow = () => {
    if (session.role === 'guest') {
      attemptContribution();
      Alert.alert('Sign in to follow', 'Following people needs an account, the same as writing a review.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    toggleFollowMember(member.id);
  };

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title={member.name} subtitle={`${member.homeNeighborhood} · joined ${member.joinedYear}`} onBack={() => router.back()} />

      <View style={gutter()}>
        <Card>
          <View style={[ui.row, { alignItems: 'flex-start' }]}>
            <IconBadge icon="person" size={52} variant="solid" />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <View style={[ui.row, { gap: space.sm }]}>
                <Text style={[font.title, { color: theme.text }]}>{member.name}</Text>
                {member.elite ? (
                  <View style={{ backgroundColor: theme.accentSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={[font.micro, { color: theme.accentSoftText }]}>ELITE</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[font.meta, { color: theme.textDim, marginTop: 2 }]}>{member.tagline}</Text>
            </View>
          </View>
          <Button
            label={following ? 'Following' : 'Follow'}
            variant={following ? 'secondary' : 'primary'}
            full
            style={{ marginTop: space.lg }}
            onPress={follow}
          />
        </Card>
      </View>

      <View style={gutter()}>
        <SectionHeader title="Reviews" subtitle={`${theirReviews.length} on the platform`} />
        {theirReviews.length === 0 ? (
          <Card><Body dim>No reviews from {member.name} in this build.</Body></Card>
        ) : (
          theirReviews.map((r) => {
            const venue = venueById[r.venueId];
            return (
              <Card key={r.id} style={{ marginBottom: space.md }} onPress={() => router.push(`/venue/${r.venueId}`)}>
                <View style={[ui.row, { gap: space.sm }]}>
                  <Text style={[font.bodyStrong, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                    {venue?.name ?? r.venueId}
                  </Text>
                  <Stars value={r.rating} size={12} />
                </View>
                <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>{relativeDate(r.date, now)}</Text>
                <Body dim numberOfLines={3} style={{ marginTop: space.sm }}>{r.text}</Body>
              </Card>
            );
          })
        )}
      </View>

      <View style={gutter()}>
        <SectionHeader title="Check-ins" subtitle="F-SOCIAL-05: visible to followers, not broadcast" />
        {following ? (
          theirCheckIns.length === 0 ? (
            <Card><Body dim>No check-ins from {member.name} right now.</Body></Card>
          ) : (
            theirCheckIns.map((c) => {
              const venue = venueById[c.venueId];
              return (
                <Card key={c.id} style={{ marginBottom: space.md }}>
                  <View style={[ui.row, { gap: space.md }]}>
                    <IconBadge icon="location" size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={[font.bodyStrong, { color: theme.text }]}>{venue?.name ?? c.venueId}</Text>
                      <Text style={[font.small, { color: theme.textFaint }]}>{relativeDate(c.date, now)}</Text>
                      {c.note ? <Body dim style={{ marginTop: 4 }}>{c.note}</Body> : null}
                    </View>
                  </View>
                </Card>
              );
            })
          )
        ) : (
          <Callout tone="info" icon="lock-closed" title="Follow to see check-ins">
            <Body dim>
              {member.name} shares check-ins with followers, not publicly. Follow them to see where they have
              been.
            </Body>
          </Callout>
        )}
      </View>
    </Screen>
  );
}

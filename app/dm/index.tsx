import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  Body, Card, EmptyState, gutter, IconBadge, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

/**
 * Direct messages with other people, gated to mutual follows at thread
 * creation (see `dm_threads_insert_mutual`). Separate from `messages/index`,
 * which is consumer-to-business only.
 */
export default function DmInboxScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { dmThreads, now } = useApp();

  const sorted = [...dmThreads].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="Direct messages" subtitle="Conversations with people you follow" onBack={() => router.back()} />

      <View style={gutter()}>
        {sorted.length === 0 ? (
          <EmptyState
            icon="people"
            title="No conversations yet"
            body="Message someone from a review they wrote, or from the people checked in at a venue. You can only message accounts that follow you back."
            actionLabel="Browse venues"
            onAction={() => router.replace('/(tabs)/search')}
          />
        ) : (
          sorted.map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <Card
                key={t.id}
                onPress={() => router.push(`/dm/${t.otherUserId}`)}
                style={{ marginBottom: space.md }}
                accessibilityLabel={`Conversation with ${t.otherUserName}`}
              >
                <View style={[ui.row, { alignItems: 'flex-start' }]}>
                  <IconBadge icon="person" size={40} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <View style={[ui.row, { gap: space.sm }]}>
                      <Text style={[font.cardTitle, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                        {t.otherUserName}
                      </Text>
                      <Text style={[font.small, { color: theme.textFaint }]}>
                        {relativeDate(t.lastMessageAt.slice(0, 10), now)}
                      </Text>
                    </View>
                    <Body dim numberOfLines={1} style={{ marginTop: 2 }}>
                      {last ? last.text : 'No messages yet'}
                    </Body>
                    {t.blocked ? (
                      <View style={[ui.row, { gap: 4, marginTop: 6 }]}>
                        <Ionicons name="ban" size={12} color={theme.textFaint} />
                        <Text style={[font.small, { color: theme.textFaint }]}>Blocked</Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
                </View>
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}

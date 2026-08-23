import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  Body, Card, EmptyState, gutter, IconBadge, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

/**
 * All message threads (F-MSG-01). Consumer-to-business only — F-MSG-05
 * explicitly defers consumer-to-consumer messaging, so every thread here has
 * exactly one venue on the other end.
 */
export default function MessagesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { threads, now } = useApp();
  const { venueById } = useCatalogue();

  const sorted = [...threads].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="Messages" subtitle="Conversations with venues" onBack={() => router.back()} />

      <View style={gutter()}>
        {sorted.length === 0 ? (
          <EmptyState
            icon="chatbubbles"
            title="No conversations yet"
            body="Message a venue from its profile to ask about availability, a private event, or anything else. Response time, where a venue publishes one, shows before you send."
            actionLabel="Browse venues"
            onAction={() => router.replace('/(tabs)/search')}
          />
        ) : (
          sorted.map((t) => {
            const venue = venueById[t.venueId];
            const last = t.messages[t.messages.length - 1];
            return (
              <Card
                key={t.id}
                onPress={() => router.push(`/messages/${t.id}`)}
                style={{ marginBottom: space.md }}
                accessibilityLabel={`Conversation with ${venue?.name ?? 'a venue'}`}
              >
                <View style={[ui.row, { alignItems: 'flex-start' }]}>
                  <IconBadge icon={t.kind === 'quote_request' ? 'calendar' : 'chatbubble'} size={40} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <View style={[ui.row, { gap: space.sm }]}>
                      <Text style={[font.cardTitle, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                        {venue?.name ?? 'Venue'}
                      </Text>
                      <Text style={[font.small, { color: theme.textFaint }]}>
                        {relativeDate(t.lastMessageAt.slice(0, 10), now)}
                      </Text>
                    </View>
                    <Body dim numberOfLines={1} style={{ marginTop: 2 }}>
                      {t.kind === 'quote_request' ? 'Private event / buyout request' : last ? last.text : 'No messages yet'}
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

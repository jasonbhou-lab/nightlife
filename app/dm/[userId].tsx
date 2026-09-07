import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, IconBadge, Screen, ScreenHeader, gutter, styles as ui,
} from '@/components/ui';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

/**
 * F-MSG-05, reversed at the product owner's explicit direction: one DM
 * thread with a real person, gated to mutual follows the same way
 * `app/reviews/[id].tsx`'s "Message" button and the venue profile's
 * "Checked in" list only ever offer this route in the first place. `userId`
 * is the *other* person, not a thread id — `startDm` resolves that to the
 * one real thread between the two accounts (finding it if it exists,
 * creating it if this is the first message), so every entry point can link
 * here with just the person's id and never has to know or guess a thread id.
 */
export default function DmThreadScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { now, dmThreads, startDm, sendDm, blockDm, refreshDmThread } = useApp();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!userId) return;
    startDm(userId).then((result) => {
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setThreadId(result.id);
      refreshDmThread(result.id);
    });
  }, [userId]);

  const thread = threadId ? dmThreads.find((t) => t.id === threadId) : undefined;

  if (loadError) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Message" onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="danger" icon="alert-circle" title="Could not open this conversation">
            <Body dim>{loadError}</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  if (!thread) {
    return (
      <Screen>
        <ScreenHeader title="Message" onBack={() => router.back()} />
      </Screen>
    );
  }

  const send = async () => {
    setSending(true);
    const result = await sendDm(thread.id, text);
    setSending(false);
    if (!result.ok) {
      Alert.alert('Could not send', result.error);
      return;
    }
    setText('');
  };

  const reportOrBlock = () =>
    Alert.alert('Report this conversation', 'Choose the reason that fits', [
      { text: 'Harassment or threats', onPress: () => blockDm(thread.id) },
      { text: 'Spam or unrelated', onPress: () => blockDm(thread.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title={thread.otherUserName}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={reportOrBlock}
            accessibilityRole="button"
            accessibilityLabel="Report or block this conversation"
            hitSlop={8}
            style={ui.glassCircle}
          >
            <Ionicons name="flag-outline" size={18} color={theme.onGround} />
          </Pressable>
        }
      />

      {thread.blocked ? (
        <View style={gutter()}>
          <Callout tone="warn" icon="ban" title="This conversation is blocked">
            <Body dim>You reported it, or it was blocked automatically. No further messages can be sent here.</Body>
          </Callout>
        </View>
      ) : null}

      <View style={[gutter(), { gap: space.md }]}>
        {thread.messages.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
              <IconBadge icon="chatbubble-ellipses" size={44} />
              <Body dim style={{ textAlign: 'center' }}>
                Nothing sent yet. Only the two of you can see this.
              </Body>
            </View>
          </Card>
        ) : (
          thread.messages.map((m) => {
            // The thread's only two participants are this account and
            // otherUserId — no sender id ever equals the latter except a
            // message the other person actually sent, so this needs no
            // separate "my own id" lookup.
            const fromThem = m.senderId === thread.otherUserId;
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: fromThem ? 'flex-start' : 'flex-end',
                  maxWidth: '84%',
                  backgroundColor: fromThem ? theme.cardMuted : theme.accent,
                  borderRadius: radius.md,
                  padding: space.md,
                }}
              >
                <Text style={[font.body, { color: fromThem ? theme.text : theme.accentText }]}>{m.text}</Text>
                <Text
                  style={[
                    font.small,
                    { color: fromThem ? theme.textFaint : theme.accentText, opacity: fromThem ? 1 : 0.75, marginTop: 4 },
                  ]}
                >
                  {relativeDate(m.createdAt.slice(0, 10), now)}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {!thread.blocked ? (
        <View style={[gutter(), { gap: space.sm }]}>
          <Card>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={`Message ${thread.otherUserName}`}
              placeholderTextColor={theme.textFaint}
              accessibilityLabel={`Message ${thread.otherUserName}`}
              style={[font.body, { color: theme.text, minHeight: 60, textAlignVertical: 'top' }]}
            />
          </Card>
          <Button label="Send" icon="paper-plane" full loading={sending} disabled={!text.trim()} onPress={send} />
        </View>
      ) : null}
    </Screen>
  );
}

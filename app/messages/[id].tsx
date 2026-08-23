import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
  styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { QuoteIntake } from '@/types';

/**
 * One thread (F-MSG). This is the piece the README calls out as missing:
 * inquiry and booking forms already route and confirm, but there was no
 * place to see the conversation or send a follow-up. This screen is that
 * place, for every vertical, not just the cigar-lounge inquiry form.
 *
 * There is no business portal in this build, so nothing here shows a reply
 * "from the venue" — that would be inventing a conversation that never
 * happened. What is real and shown instead: the venue's published response
 * time (F-MSG-01), and the fact that the message actually sent.
 */
export default function ThreadScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { now, threads, sendThreadMessage, blockThread } = useApp();
  const { getVenue } = useCatalogue();
  const [text, setText] = useState('');

  const thread = threads.find((t) => t.id === id);
  const venue = thread ? getVenue(thread.venueId) : undefined;

  const responseNote = useMemo(() => {
    if (!venue?.avgResponseMinutes) return 'This venue has not published a response time.';
    const mins = venue.avgResponseMinutes;
    if (mins < 60) return `Usually responds within ${mins} minutes`;
    if (mins < 24 * 60) return `Usually responds within ${Math.round(mins / 60)} hours`;
    return `Usually responds within ${Math.round(mins / (24 * 60))} days`;
  }, [venue]);

  if (!thread || !venue) {
    return (
      <Screen>
        <ScreenHeader title="Conversation" onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>This conversation is not available on this device.</Body>
          </Card>
        </View>
      </Screen>
    );
  }

  const send = () => {
    const result = sendThreadMessage(thread.id, text);
    if (!result.ok) {
      Alert.alert('Could not send', result.error);
      return;
    }
    setText('');
  };

  const reportOrBlock = () =>
    Alert.alert('Report this conversation', 'Choose the reason that fits', [
      { text: 'Harassment or threats', onPress: () => blockThread(thread.id) },
      { text: 'Off-platform payment request', onPress: () => blockThread(thread.id) },
      { text: 'Spam or unrelated', onPress: () => blockThread(thread.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const isUnsentQuote = thread.kind === 'quote_request' && thread.messages.length === 0;

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title={venue.name}
        subtitle={responseNote}
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

      {thread.kind === 'quote_request' && thread.intake ? (
        <View style={gutter()}>
          <Card>
            <Label>Your request</Label>
            <View style={{ marginTop: space.sm, gap: 2 }}>
              {thread.intake.date ? <Row label="Date" value={thread.intake.date} /> : null}
              {thread.intake.headcount ? <Row label="Headcount" value={`${thread.intake.headcount}`} /> : null}
              {thread.intake.budgetRange ? <Row label="Budget" value={thread.intake.budgetRange} /> : null}
              {thread.intake.foodAndBeverage ? <Row label="Food & beverage" value={thread.intake.foodAndBeverage} /> : null}
              {thread.intake.av ? <Row label="AV needs" value={thread.intake.av} /> : null}
            </View>
          </Card>
        </View>
      ) : null}

      {isUnsentQuote ? (
        <QuoteIntakeForm
          onSend={(intake, summary) => {
            const result = sendThreadMessage(thread.id, summary, intake);
            if (!result.ok) Alert.alert('Could not send', result.error);
          }}
        />
      ) : (
        <>
          <View style={[gutter(), { gap: space.md }]}>
            {thread.messages.length === 0 ? (
              <Card>
                <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
                  <IconBadge icon="chatbubble-ellipses" size={44} />
                  <Body dim style={{ textAlign: 'center' }}>
                    Nothing sent yet. What you write goes straight to {venue.name}.
                  </Body>
                </View>
              </Card>
            ) : (
              thread.messages.map((m) => (
                <View
                  key={m.id}
                  style={{
                    alignSelf: 'flex-end',
                    maxWidth: '84%',
                    backgroundColor: theme.accent,
                    borderRadius: radius.md,
                    padding: space.md,
                  }}
                >
                  <Text style={[font.body, { color: theme.accentText }]}>{m.text}</Text>
                  <Text style={[font.small, { color: theme.accentText, opacity: 0.75, marginTop: 4 }]}>
                    {relativeDate(m.createdAt.slice(0, 10), now)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {!thread.blocked ? (
            <View style={[gutter(), { gap: space.sm }]}>
              <Card>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder={`Message ${venue.name}`}
                  placeholderTextColor={theme.textFaint}
                  accessibilityLabel={`Message ${venue.name}`}
                  style={[font.body, { color: theme.text, minHeight: 60, textAlignVertical: 'top' }]}
                />
              </Card>
              <Button label="Send" icon="paper-plane" full disabled={!text.trim()} onPress={send} />
              <Text style={[font.small, { color: theme.onGroundFaint, textAlign: 'center' }]}>
                Nothing is charged and no commitment is created by messaging.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** F-MSG-03: structured intake for a private event, buyout, or large party. */
function QuoteIntakeForm({ onSend }: { onSend: (intake: QuoteIntake, summary: string) => void }) {
  const theme = useTheme();
  const [date, setDate] = useState('');
  const [headcount, setHeadcount] = useState('');
  const [budget, setBudget] = useState<string | null>(null);
  const [fb, setFb] = useState('');
  const [av, setAv] = useState('');

  const budgets = ['Under $500', '$500–1,500', '$1,500–5,000', '$5,000+'];

  return (
    <View style={[gutter(), { gap: space.lg }]}>
      <Callout tone="info" icon="information-circle" title="Structured intake, sent to the venue">
        <Body dim>
          Date, headcount, and budget help the venue quote you faster than a free-text message alone.
        </Body>
      </Callout>

      <Card>
        <Label>Date</Label>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="e.g. Saturday, October 17"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel="Event date"
          style={[font.body, { color: theme.text, backgroundColor: theme.cardMuted, borderRadius: radius.md, padding: space.md, marginTop: space.sm, minHeight: 44 }]}
        />
        <Divider style={{ marginVertical: space.lg }} />
        <Label>Headcount</Label>
        <TextInput
          value={headcount}
          onChangeText={(v) => setHeadcount(v.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 40"
          placeholderTextColor={theme.textFaint}
          keyboardType="number-pad"
          accessibilityLabel="Headcount"
          style={[font.body, { color: theme.text, backgroundColor: theme.cardMuted, borderRadius: radius.md, padding: space.md, marginTop: space.sm, minHeight: 44 }]}
        />
      </Card>

      <Card>
        <Label>Budget range</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {budgets.map((b) => (
            <Chip key={b} label={b} selected={budget === b} onPress={() => setBudget(budget === b ? null : b)} />
          ))}
        </View>
      </Card>

      <Card>
        <Label>Food and beverage needs</Label>
        <TextInput
          value={fb}
          onChangeText={setFb}
          multiline
          placeholder="Plated dinner, open bar for 2 hours, dietary restrictions"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel="Food and beverage needs"
          style={[font.body, { color: theme.text, backgroundColor: theme.cardMuted, borderRadius: radius.md, padding: space.md, marginTop: space.sm, minHeight: 70, textAlignVertical: 'top' }]}
        />
        <Divider style={{ marginVertical: space.lg }} />
        <Label>AV needs</Label>
        <TextInput
          value={av}
          onChangeText={setAv}
          multiline
          placeholder="Microphone, projector, house sound"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel="AV needs"
          style={[font.body, { color: theme.text, backgroundColor: theme.cardMuted, borderRadius: radius.md, padding: space.md, marginTop: space.sm, minHeight: 60, textAlignVertical: 'top' }]}
        />
      </Card>

      <Button
        label="Send request"
        icon="paper-plane"
        full
        disabled={!date.trim() && !headcount.trim()}
        onPress={() => {
          const intake: QuoteIntake = {
            date: date.trim() || undefined,
            headcount: headcount ? Number(headcount) : undefined,
            budgetRange: budget ?? undefined,
            foodAndBeverage: fb.trim() || undefined,
            av: av.trim() || undefined,
          };
          const summary = [
            'Private event / buyout request.',
            date.trim() ? `Date: ${date.trim()}.` : null,
            headcount ? `Headcount: ${headcount}.` : null,
            budget ? `Budget: ${budget}.` : null,
            fb.trim() ? `Food and beverage: ${fb.trim()}.` : null,
            av.trim() ? `AV: ${av.trim()}.` : null,
          ]
            .filter(Boolean)
            .join(' ');
          onSend(intake, summary);
        }}
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[ui.row, { paddingVertical: 4 }]}>
      <Text style={[font.small, { color: theme.textDim, flex: 1 }]}>{label}</Text>
      <Text style={[font.small, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, Label, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import {
  createBusinessReplyTemplate, deleteBusinessReplyTemplate, getBusinessReplyTemplates,
  getVenueThreads, sendBusinessReply, setVenueAutoResponse,
} from '@/data/repository';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { BusinessReplyTemplate, Message, MessageThread } from '@/types';

type VenueThread = MessageThread & { guestName?: string };

/**
 * F-MSG-02, scoped: quick-reply templates and a configurable auto-response,
 * plus the reply capability itself, which is what makes either one mean
 * anything — see the migration header on 20260827090000_add_business_messaging.sql
 * for why this didn't exist before and what it deliberately still doesn't do
 * (no keyword rules, no business-side blocking).
 */
export default function VenueMessagesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, now, attemptContribution, isManagingVenue } = useApp();
  const { getVenue } = useCatalogue();

  const venue = getVenue(venueId);
  const [threads, setThreads] = useState<VenueThread[]>([]);
  const [templates, setTemplates] = useState<BusinessReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [autoDraft, setAutoDraft] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);

  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  const load = useCallback(() => {
    if (!venue) return;
    setLoading(true);
    Promise.all([getVenueThreads(venue.id), getBusinessReplyTemplates(venue.id)])
      .then(([t, tpl]) => {
        setThreads(t);
        setTemplates(tpl);
      })
      .finally(() => setLoading(false));
  }, [venue?.id]);

  useEffect(() => {
    if (venue && isManagingVenue(venue.id)) load();
    else setLoading(false);
  }, [venue?.id]);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Messages" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Messages" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Managing messages needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Messages" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can see its messages.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const applyAutoResponse = async () => {
    const text = (autoDraft ?? venue.autoResponseText ?? '').trim();
    setAutoBusy(true);
    const result = await setVenueAutoResponse({ venueId: venue.id, text: text || null });
    setAutoBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAutoDraft(null);
  };

  const clearAutoResponse = async () => {
    setAutoBusy(true);
    const result = await setVenueAutoResponse({ venueId: venue.id, text: null });
    setAutoBusy(false);
    if (result.ok) setAutoDraft(null);
    else setError(result.error);
  };

  const saveTemplate = async () => {
    if (!newTemplateLabel.trim() || !newTemplateBody.trim()) return;
    setTemplateBusy(true);
    const result = await createBusinessReplyTemplate({
      venueId: venue.id,
      label: newTemplateLabel.trim(),
      body: newTemplateBody.trim(),
    });
    setTemplateBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTemplates((prev) => [...prev, result.template]);
    setNewTemplateLabel('');
    setNewTemplateBody('');
  };

  const removeTemplate = async (id: string) => {
    const result = await deleteBusinessReplyTemplate(id);
    if (result.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const sendReply = async (thread: VenueThread) => {
    if (!reply.trim()) return;
    setReplyBusy(true);
    const result = await sendBusinessReply({ threadId: thread.id, text: reply.trim() });
    setReplyBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setThreads((prev) =>
      prev.map((t) =>
        t.id === thread.id
          ? { ...t, messages: [...t.messages, result.message], lastMessageAt: result.message.createdAt }
          : t,
      ),
    );
    setReply('');
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Messages" subtitle={venue.name} onBack={() => router.back()} />

      {error ? (
        <View style={gutter()}>
          <Text style={[font.small, { color: theme.closed }]}>{error}</Text>
        </View>
      ) : null}

      <View style={gutter()}>
        <Label>Auto-response</Label>
        <Card style={{ marginTop: space.sm }}>
          <Body dim>Sent automatically on the first message in a new conversation. Leave blank for none.</Body>
          <TextInput
            value={autoDraft ?? venue.autoResponseText ?? ''}
            onChangeText={setAutoDraft}
            placeholder="Thanks for reaching out — we usually reply within the hour."
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Auto-response text"
            multiline
            style={[
              font.body,
              {
                color: theme.text,
                backgroundColor: theme.cardMuted,
                borderRadius: radius.md,
                padding: space.md,
                minHeight: 60,
                textAlignVertical: 'top',
                marginTop: space.md,
              },
            ]}
          />
          <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
            <Button label="Save" loading={autoBusy} disabled={!(autoDraft ?? venue.autoResponseText)} onPress={applyAutoResponse} />
            {venue.autoResponseText ? (
              <Button label="Clear" variant="ghost" loading={autoBusy} onPress={clearAutoResponse} />
            ) : null}
          </View>
        </Card>
      </View>

      <View style={gutter()}>
        <Label>Quick-reply templates</Label>
        <Card style={{ marginTop: space.sm }} padded={false}>
          {templates.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>No saved templates yet.</Body>
          ) : (
            templates.map((t, i) => (
              <View key={t.id}>
                {i > 0 ? <Divider /> : null}
                <View style={[ui.row, { padding: space.lg, gap: space.md }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { color: theme.text }]}>{t.label}</Text>
                    <Body dim style={{ marginTop: 2 }} numberOfLines={2}>{t.body}</Body>
                  </View>
                  <Button label="Remove" variant="ghost" onPress={() => removeTemplate(t.id)} />
                </View>
              </View>
            ))
          )}
          <Divider />
          <View style={{ padding: space.lg, gap: space.sm }}>
            <TextInput
              value={newTemplateLabel}
              onChangeText={setNewTemplateLabel}
              placeholder="Label, e.g. Hours"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="New template label"
              style={[font.body, { color: theme.text, backgroundColor: theme.cardMuted, borderRadius: radius.md, padding: space.md, minHeight: 44 }]}
            />
            <TextInput
              value={newTemplateBody}
              onChangeText={setNewTemplateBody}
              placeholder="What it says when tapped into the composer"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="New template body"
              multiline
              style={[font.body, { color: theme.text, backgroundColor: theme.cardMuted, borderRadius: radius.md, padding: space.md, minHeight: 60, textAlignVertical: 'top' }]}
            />
            <Button
              label="Save template"
              loading={templateBusy}
              disabled={!newTemplateLabel.trim() || !newTemplateBody.trim()}
              onPress={saveTemplate}
            />
          </View>
        </Card>
      </View>

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>Conversations</Text>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {loading ? (
            <Body dim style={{ padding: space.lg }}>Loading…</Body>
          ) : threads.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>No conversations yet.</Body>
          ) : (
            threads.map((t, i) => {
              const open = expandedId === t.id;
              const last = t.messages[t.messages.length - 1];
              return (
                <View key={t.id}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`Conversation with ${t.guestName ?? 'Guest'}`}
                    onPress={() => {
                      setExpandedId(open ? null : t.id);
                      setReply('');
                    }}
                    style={[ui.row, { padding: space.lg, gap: space.md, minHeight: 44 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[font.body, { color: theme.text }]}>{t.guestName ?? 'Guest'}</Text>
                      <Body dim numberOfLines={1} style={{ marginTop: 2 }}>
                        {last ? last.text : 'No messages yet'}
                      </Body>
                    </View>
                    <Text style={[font.small, { color: theme.textFaint }]}>{relativeDate(t.lastMessageAt.slice(0, 10), now)}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textFaint} />
                  </Pressable>
                  {open ? <ThreadDetail thread={t} templates={templates} reply={reply} setReply={setReply} busy={replyBusy} onSend={() => sendReply(t)} /> : null}
                </View>
              );
            })
          )}
        </Card>
      </View>
    </Screen>
  );
}

function ThreadDetail({
  thread, templates, reply, setReply, busy, onSend,
}: {
  thread: VenueThread;
  templates: BusinessReplyTemplate[];
  reply: string;
  setReply: (v: string) => void;
  busy: boolean;
  onSend: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md }}>
      {thread.blocked ? (
        <Callout tone="warn" icon="ban" title="This conversation is blocked">
          <Body dim>The guest reported or blocked this conversation. No replies can be sent.</Body>
        </Callout>
      ) : (
        <>
          <View style={{ gap: space.sm }}>
            {thread.messages.map((m: Message) => (
              <View
                key={m.id}
                style={{
                  alignSelf: m.sender === 'business' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                  backgroundColor: m.sender === 'business' ? theme.accent : theme.cardMuted,
                  borderRadius: radius.md,
                  padding: space.sm,
                }}
              >
                <Text style={[font.small, { color: m.sender === 'business' ? theme.accentText : theme.text }]}>{m.text}</Text>
              </View>
            ))}
          </View>
          {templates.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {templates.map((t) => (
                <Chip key={t.id} label={t.label} tone="ground" onPress={() => setReply(t.body)} />
              ))}
            </View>
          ) : null}
          <TextInput
            value={reply}
            onChangeText={setReply}
            multiline
            placeholder="Reply as the venue"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Reply as the venue"
            style={[font.body, { color: theme.text, backgroundColor: theme.cardMuted, borderRadius: radius.md, padding: space.md, minHeight: 50, textAlignVertical: 'top' }]}
          />
          <Button label="Send reply" icon="paper-plane" loading={busy} disabled={!reply.trim()} onPress={onSend} />
        </>
      )}
    </View>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
  styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { updateVenueMenus } from '@/data/repository';
import { DIET_LABELS } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { MenuItem, MenuSection } from '@/types';

const DIET_KEYS = Object.keys(DIET_LABELS);

function cloneSections(sections: MenuSection[]): MenuSection[] {
  return sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, tags: i.tags ? [...i.tags] : undefined })) }));
}

/**
 * F-BIZ-05, scoped: manual menu and tap-list editing only. See the migration
 * header on 20260825170000_add_venue_menu_edit.sql for why import from CSV,
 * PDF, or photo is out of scope. Gated the same as the hours editor.
 */
export default function EditMenuScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, setVenueMenus } = useCatalogue();

  const venue = getVenue(venueId);
  const [sections, setSections] = useState<MenuSection[]>(() => cloneSections(venue?.menus ?? []));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Edit menu" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Edit menu" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Editing the menu needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Edit menu" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can edit its menu.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Saved" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="checkmark-circle" size={56} variant="solid" />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>Menu updated</Text>
              <Body dim style={{ textAlign: 'center' }}>
                Visible to everyone browsing {venue.name} now.
              </Body>
            </View>
          </Card>
        </View>
        <View style={gutter()}>
          <Button label="Back to the menu" full onPress={() => router.replace(`/menu/${venue.id}`)} />
        </View>
      </Screen>
    );
  }

  const invalid = sections.some(
    (s) => !s.title.trim() || s.items.some((i) => !i.name.trim()),
  );

  const setSection = (si: number, patch: Partial<MenuSection>) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));

  const removeSection = (si: number) => setSections((prev) => prev.filter((_, i) => i !== si));

  const addSection = () =>
    setSections((prev) => [...prev, { title: 'New section', volatile: false, items: [] }]);

  const setItem = (si: number, ii: number, patch: Partial<MenuItem>) =>
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : s)),
    );

  const removeItem = (si: number, ii: number) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)));

  const addItem = (si: number) =>
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, items: [...s.items, { name: '' }] } : s)));

  const toggleTag = (si: number, ii: number, tag: string) =>
    setSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              items: s.items.map((it, j) => {
                if (j !== ii) return it;
                const tags = it.tags ?? [];
                return { ...it, tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] };
              }),
            }
          : s,
      ),
    );

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const cleaned = sections.map((s) => ({
      ...s,
      title: s.title.trim(),
      items: s.items.map((i) => ({ ...i, name: i.name.trim() })),
    }));
    const result = await updateVenueMenus({ venueId: venue.id, menus: cleaned });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVenueMenus(venue.id, cleaned);
    setDone(true);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Edit menu" subtitle={venue.name} onBack={() => router.back()} />

      {sections.map((s, si) => (
        <View key={si} style={gutter()}>
          <Card>
            <Label>Section title</Label>
            <TextInput
              value={s.title}
              onChangeText={(v) => setSection(si, { title: v })}
              placeholder="Small plates"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="Section title"
              style={[
                font.body,
                {
                  color: theme.text,
                  backgroundColor: theme.cardMuted,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  minHeight: 44,
                  marginTop: space.sm,
                },
              ]}
            />
            <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
              <Chip
                label="Rotates fast (tap list, daily specials)"
                selected={!!s.volatile}
                onPress={() => setSection(si, { volatile: !s.volatile })}
              />
            </View>
            <Label style={{ marginTop: space.md }}>Note (optional)</Label>
            <TextInput
              value={s.note ?? ''}
              onChangeText={(v) => setSection(si, { note: v || undefined })}
              placeholder="Kitchen closes at 10"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="Section note"
              style={[
                font.body,
                {
                  color: theme.text,
                  backgroundColor: theme.cardMuted,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  minHeight: 44,
                  marginTop: space.sm,
                },
              ]}
            />

            <Divider style={{ marginVertical: space.md }} />

            {s.items.map((item, ii) => (
              <View key={ii} style={{ marginBottom: space.md }}>
                {ii > 0 ? <Divider style={{ marginBottom: space.md }} /> : null}
                <View style={[ui.row, { gap: space.sm }]}>
                  <TextInput
                    value={item.name}
                    onChangeText={(v) => setItem(si, ii, { name: v })}
                    placeholder="Item name"
                    placeholderTextColor={theme.textFaint}
                    accessibilityLabel="Item name"
                    style={[
                      font.body,
                      {
                        flex: 1,
                        color: theme.text,
                        backgroundColor: theme.card,
                        borderRadius: radius.md,
                        paddingHorizontal: space.md,
                        minHeight: 44,
                      },
                    ]}
                  />
                  <TextInput
                    value={item.price != null ? String(item.price) : ''}
                    onChangeText={(v) => {
                      const n = v.trim() === '' ? undefined : Number(v);
                      setItem(si, ii, { price: n != null && !Number.isNaN(n) ? n : undefined });
                    }}
                    placeholder="$"
                    placeholderTextColor={theme.textFaint}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Price"
                    style={[
                      font.body,
                      {
                        width: 68,
                        color: theme.text,
                        backgroundColor: theme.card,
                        borderRadius: radius.md,
                        paddingHorizontal: space.sm,
                        minHeight: 44,
                        textAlign: 'center',
                      },
                    ]}
                  />
                </View>
                <TextInput
                  value={item.detail ?? ''}
                  onChangeText={(v) => setItem(si, ii, { detail: v || undefined })}
                  placeholder="Detail (optional)"
                  placeholderTextColor={theme.textFaint}
                  accessibilityLabel="Item detail"
                  style={[
                    font.body,
                    {
                      color: theme.text,
                      backgroundColor: theme.card,
                      borderRadius: radius.md,
                      paddingHorizontal: space.md,
                      minHeight: 40,
                      marginTop: space.sm,
                    },
                  ]}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
                  {DIET_KEYS.map((tag) => (
                    <Chip
                      key={tag}
                      label={DIET_LABELS[tag]}
                      selected={!!item.tags?.includes(tag)}
                      onPress={() => toggleTag(si, ii, tag)}
                    />
                  ))}
                  <Chip label="Sold out" selected={!!item.soldOut} onPress={() => setItem(si, ii, { soldOut: !item.soldOut })} />
                </View>
                <Button
                  label="Remove item"
                  variant="ghost"
                  icon="trash-outline"
                  style={{ marginTop: space.sm, alignSelf: 'flex-start' }}
                  onPress={() => removeItem(si, ii)}
                />
              </View>
            ))}

            <Button label="Add item" variant="secondary" icon="add" onPress={() => addItem(si)} />
            <Button
              label="Remove section"
              variant="ghost"
              icon="trash-outline"
              style={{ marginTop: space.md, alignSelf: 'flex-start' }}
              onPress={() => removeSection(si)}
            />
          </Card>
        </View>
      ))}

      <View style={gutter()}>
        <Button label="Add section" variant="secondary" icon="add" onPress={addSection} />
      </View>

      {error ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="alert-circle" title="Could not save">
            <Body dim>{error}</Body>
          </Callout>
        </View>
      ) : null}

      <View style={gutter()}>
        <Button label="Save menu" icon="save-outline" full loading={submitting} disabled={invalid} onPress={submit} />
      </View>
    </Screen>
  );
}

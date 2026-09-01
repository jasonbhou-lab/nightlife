import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
  styles as ui,
} from '@/components/ui';
import { attributesForVertical, groupLabels, groupOrderForVertical } from '@/data/attributes';
import { useCatalogue } from '@/data/catalogue';
import { updateVenueAttributes } from '@/data/repository';
import { metaFor, provenanceLabel, relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { AttributeDef, AttributeGroup, AttributeValue } from '@/types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * F-BIZ-03 (full): every typed attribute the registry defines for this
 * venue's vertical, editable — the feature every prior scoped-down
 * migration (listing, hours, menu) pointed at and deferred. See the
 * migration header on 20260830100000_add_venue_attribute_edit.sql for what
 * the database actually enforces beyond this screen's own validation:
 * provenance (source/updatedAt) is computed server-side from the diff, never
 * trusted from this screen, and every real change is logged to
 * venue_attribute_history.
 *
 * Same grouped, collapsible shape as the read-only AttributePanel — the
 * groups and their order come from the same registry functions
 * (attributesForVertical, groupOrderForVertical) so editing never shows a
 * different layout than viewing.
 */
export default function EditAttributesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, now, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, setVenueAttributes } = useCatalogue();

  const venue = getVenue(venueId);
  const [values, setValues] = useState<Record<string, AttributeValue>>(() => ({ ...(venue?.attributes ?? {}) }));
  const [expanded, setExpanded] = useState<Set<AttributeGroup>>(new Set(['decide']));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  const groups = useMemo(() => {
    if (!venue) return [];
    const defs = attributesForVertical(venue.primary.vertical);
    const map = new Map<AttributeGroup, AttributeDef[]>();
    for (const d of defs) {
      const list = map.get(d.group) ?? [];
      list.push(d);
      map.set(d.group, list);
    }
    return groupOrderForVertical(venue.primary.vertical)
      .filter((g) => map.has(g))
      .map((g) => [g, map.get(g)!] as [AttributeGroup, AttributeDef[]]);
  }, [venue]);

  const toggleGroup = (g: AttributeGroup) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const setValue = (key: string, value: AttributeValue) => setValues((prev) => ({ ...prev, [key]: value }));

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Edit details" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Edit details" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Editing this listing needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Edit details" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can edit its details.</Body>
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
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>Details updated</Text>
              <Body dim style={{ textAlign: 'center' }}>
                Visible to everyone browsing {venue.name} now, each changed value marked
                owner-provided as of today.
              </Body>
            </View>
          </Card>
        </View>
        <View style={[gutter(), { gap: space.sm }]}>
          <Button label="Back to the listing" full onPress={() => router.replace(`/venue/${venue.id}`)} />
          <Button
            label="View change history"
            variant="ghost"
            full
            onPress={() => router.replace(`/venue/attribute-history?venueId=${venue.id}`)}
          />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    // Client-side validation before the round trip -- the database does not
    // type-check jsonb, so a malformed time or a non-numeric currency would
    // otherwise be accepted verbatim and render wrong to every consumer
    // rather than being caught here.
    for (const [, defs] of groups) {
      for (const d of defs) {
        const v = values[d.key];
        if (v == null || v === '') continue;
        if (d.type === 'time' && !TIME_RE.test(String(v))) {
          setError(`"${d.label}" needs a 24-hour HH:MM time, like 23:00 — or leave it blank.`);
          return;
        }
        if ((d.type === 'integer' || d.type === 'currency') && (typeof v !== 'number' || Number.isNaN(v) || v < 0)) {
          setError(`"${d.label}" needs a whole number — or leave it blank.`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);
    const result = await updateVenueAttributes({ venueId: venue.id, attributes: values });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVenueAttributes(venue.id, result.attributes, result.meta);
    setDone(true);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title="Edit details"
        subtitle={venue.name}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push(`/venue/attribute-history?venueId=${venue.id}`)}
            accessibilityRole="button"
            accessibilityLabel="View change history"
            hitSlop={8}
            style={{ paddingTop: 4 }}
          >
            <Text style={[font.small, { color: theme.onGroundDim }]}>History</Text>
          </Pressable>
        }
      />

      <View style={gutter()}>
        <Callout tone="info" icon="information-circle" title="Only what you change is marked as updated">
          <Body dim>
            A field left exactly as it was keeps its existing source and date. A field you change is
            marked owner-provided as of today — that is what tells everyone else the value is fresh.
          </Body>
        </Callout>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {groups.map(([group, defs], i) => {
            const open = expanded.has(group) || i === 0;
            return (
              <View key={group}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => toggleGroup(group)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${groupLabels[group]}, ${defs.length} fields`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                    minHeight: 52,
                  }}
                >
                  <Text style={[font.bodyStrong, { color: theme.text, flex: 1 }]}>{groupLabels[group]}</Text>
                  <Text style={[font.small, { color: theme.textFaint, marginRight: space.sm }]}>{defs.length}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textFaint} />
                </Pressable>

                {open ? (
                  <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.lg }}>
                    {defs.map((d) => (
                      <AttributeEditRow
                        key={d.key}
                        def={d}
                        value={values[d.key] ?? null}
                        onChange={(v) => setValue(d.key, v)}
                        provenanceNote={
                          values[d.key] == null || values[d.key] === ''
                            ? null
                            : `${provenanceLabel[metaFor(venue, d.key).source]}, ${relativeDate(metaFor(venue, d.key).updatedAt, now)}`
                        }
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      </View>

      {error ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="alert-circle" title="Could not save">
            <Body dim>{error}</Body>
          </Callout>
        </View>
      ) : null}

      <View style={gutter()}>
        <Button label="Save" icon="save-outline" full loading={submitting} onPress={submit} />
      </View>
      <View style={{ height: space.xxxl }} />
    </Screen>
  );
}

/** One field, typed input chosen from `def.type` — the same seven types the
 * registry and `formatAttribute` already treat as canonical. */
function AttributeEditRow({
  def,
  value,
  onChange,
  provenanceNote,
}: {
  def: AttributeDef;
  value: AttributeValue;
  onChange: (v: AttributeValue) => void;
  provenanceNote: string | null;
}) {
  const theme = useTheme();

  const inputStyle = [
    font.body,
    {
      color: theme.text,
      backgroundColor: theme.cardMuted,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      minHeight: 44,
      marginTop: space.sm,
    },
  ];

  return (
    <View>
      <View style={[ui.row, { alignItems: 'center' }]}>
        <Label style={{ flex: 1 }}>{def.label}</Label>
        {def.unit && (def.type === 'integer' || def.type === 'currency') ? (
          <Text style={[font.small, { color: theme.textFaint }]}>{def.unit}</Text>
        ) : null}
      </View>

      {def.type === 'boolean' ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          <Chip label="Yes" selected={value === true} onPress={() => onChange(value === true ? null : true)} />
          <Chip label="No" selected={value === false} onPress={() => onChange(value === false ? null : false)} />
        </View>
      ) : def.type === 'enum' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {def.options?.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              selected={value === o.value}
              onPress={() => onChange(value === o.value ? null : o.value)}
            />
          ))}
        </View>
      ) : def.type === 'multi' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {def.options?.map((o) => {
            const arr = Array.isArray(value) ? value : [];
            const selected = arr.includes(o.value);
            return (
              <Chip
                key={o.value}
                label={o.label}
                selected={selected}
                onPress={() => {
                  const next = selected ? arr.filter((v) => v !== o.value) : [...arr, o.value];
                  onChange(next.length ? next : null);
                }}
              />
            );
          })}
        </View>
      ) : def.type === 'time' ? (
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChangeText={(t) => onChange(t.trim() === '' ? null : t.trim())}
          placeholder="HH:MM, e.g. 23:00"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={def.label}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={inputStyle}
        />
      ) : def.type === 'integer' || def.type === 'currency' ? (
        <TextInput
          value={typeof value === 'number' ? String(value) : ''}
          onChangeText={(t) => {
            const digits = t.replace(/[^0-9]/g, '');
            onChange(digits === '' ? null : Number(digits));
          }}
          placeholder={def.type === 'currency' ? '0' : '0'}
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={def.label}
          keyboardType="number-pad"
          style={inputStyle}
        />
      ) : (
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChangeText={(t) => onChange(t === '' ? null : t)}
          placeholder="Not set"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={def.label}
          multiline
          style={[inputStyle, { minHeight: 44, paddingVertical: 10, textAlignVertical: 'top' }]}
        />
      )}

      {provenanceNote ? (
        <Text style={[font.small, { color: theme.textFaint, marginTop: 4 }]}>{provenanceNote}</Text>
      ) : null}
      {def.caveat ? (
        <Text style={[font.small, { color: theme.textFaint, marginTop: 2, fontStyle: 'italic' }]}>{def.caveat}</Text>
      ) : null}
    </View>
  );
}

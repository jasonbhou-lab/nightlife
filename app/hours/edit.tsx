import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
  styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { updateVenueHours } from '@/data/repository';
import { DAY_LABELS_LONG } from '@/lib/hours';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { DayRange, HappyHourWindow, Schedule } from '@/types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validTime(v: string): boolean {
  return TIME_RE.test(v.trim());
}

/**
 * F-BIZ-04, scoped: hours and happy hours only. No bulk/multi-location edit
 * (F-BIZ-14 is out of scope, so there is nowhere to bulk-apply to) and no
 * temporary closure scheduling (that is Trust & Safety's field, F-PROFILE-12,
 * not a business self-declaration). See the migration header on
 * 20260825160000_add_venue_hours_edit.sql for what the database actually
 * enforces beyond this screen's own validation.
 */
export default function EditHoursScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, setVenueHours } = useCatalogue();

  const venue = getVenue(venueId);
  const [schedules, setSchedules] = useState<Schedule[]>(() => venue?.schedules.map((s) => ({ ...s, days: [...s.days] })) ?? []);
  const [happyHours, setHappyHours] = useState<HappyHourWindow[]>(
    () => venue?.happyHours?.map((w) => ({ ...w, days: [...w.days] })) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // A one-time effect of viewing this gate, not something to redo every
  // render — calling it directly in the render body would change `session`,
  // re-rendering this component, which would call it again forever.
  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Edit hours" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Edit hours" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Editing hours needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Edit hours" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can edit its hours.</Body>
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
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>Hours updated</Text>
              <Body dim style={{ textAlign: 'center' }}>
                Visible to everyone browsing {venue.name} now, and "last confirmed" resets to today.
              </Body>
            </View>
          </Card>
        </View>
        <View style={gutter()}>
          <Button label="Back to hours" full onPress={() => router.replace(`/hours/${venue.id}`)} />
        </View>
      </Screen>
    );
  }

  const invalid =
    schedules.some((s) => s.days.some((d) => d && (!validTime(d.open) || !validTime(d.close)))) ||
    happyHours.some(
      (w) => w.days.length === 0 || !validTime(w.start) || !validTime(w.end) || !w.summary.trim(),
    );

  const setDay = (scheduleIdx: number, dayIdx: number, next: DayRange | null) => {
    setSchedules((prev) =>
      prev.map((s, i) => (i === scheduleIdx ? { ...s, days: s.days.map((d, j) => (j === dayIdx ? next : d)) } : s)),
    );
  };

  const setWindow = (idx: number, patch: Partial<HappyHourWindow>) => {
    setHappyHours((prev) => prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  };

  const toggleWindowDay = (idx: number, day: number) => {
    setHappyHours((prev) =>
      prev.map((w, i) =>
        i === idx
          ? { ...w, days: w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day].sort() }
          : w,
      ),
    );
  };

  const addWindow = () =>
    setHappyHours((prev) => [...prev, { days: [], start: '16:00', end: '19:00', summary: '' }]);

  const removeWindow = (idx: number) => setHappyHours((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const nowIso = new Date().toISOString();
    const stamped = schedules.map((s) => ({ ...s, updatedAt: nowIso }));
    const result = await updateVenueHours({ venueId: venue.id, schedules: stamped, happyHours });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVenueHours(venue.id, stamped, happyHours);
    setDone(true);
  };

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Edit hours" subtitle={venue.name} onBack={() => router.back()} />

      {schedules.map((s, si) => (
        <View key={s.kind} style={gutter()}>
          <Card>
            <Text style={[font.cardTitle, { color: theme.text }]}>{s.label}</Text>
            <View style={{ marginTop: space.sm }}>
              {s.days.map((d, di) => (
                <View key={di}>
                  {di > 0 ? <Divider style={{ marginVertical: space.sm }} /> : null}
                  <View style={[ui.row, { gap: space.sm }]}>
                    <Text style={[font.body, { color: theme.text, width: 84 }]}>
                      {DAY_LABELS_LONG[di].slice(0, 3)}
                    </Text>
                    <Chip
                      label={d ? 'Open' : 'Closed'}
                      selected={!d}
                      onPress={() => setDay(si, di, d ? null : { open: '17:00', close: '02:00' })}
                    />
                    {d ? (
                      <>
                        <TimeField
                          value={d.open}
                          onChange={(v) => setDay(si, di, { ...d, open: v })}
                        />
                        <Text style={[font.body, { color: theme.textFaint }]}>–</Text>
                        <TimeField
                          value={d.close}
                          onChange={(v) => setDay(si, di, { ...d, close: v })}
                        />
                      </>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            <Text style={[font.small, { color: theme.textFaint, marginTop: space.md }]}>
              24-hour HH:MM. A close time earlier than open crosses midnight.
            </Text>
          </Card>
        </View>
      ))}

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>Happy hour</Text>
      </View>

      {happyHours.map((w, wi) => (
        <View key={wi} style={gutter()}>
          <Card>
            <Label>Days</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
              {DAY_LABELS_LONG.map((label, d) => (
                <Chip key={d} label={label.slice(0, 3)} selected={w.days.includes(d)} onPress={() => toggleWindowDay(wi, d)} />
              ))}
            </View>
            <Divider style={{ marginVertical: space.md }} />
            <View style={[ui.row, { gap: space.sm }]}>
              <TimeField value={w.start} onChange={(v) => setWindow(wi, { start: v })} />
              <Text style={[font.body, { color: theme.textFaint }]}>–</Text>
              <TimeField value={w.end} onChange={(v) => setWindow(wi, { end: v })} />
            </View>
            <Label style={{ marginTop: space.md }}>Summary</Label>
            <TextInput
              value={w.summary}
              onChangeText={(v) => setWindow(wi, { summary: v })}
              placeholder="$3 tallboys, $4 wells"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="Happy hour summary"
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
            <Button
              label="Remove window"
              variant="ghost"
              icon="trash-outline"
              style={{ marginTop: space.md, alignSelf: 'flex-start' }}
              onPress={() => removeWindow(wi)}
            />
          </Card>
        </View>
      ))}

      <View style={gutter()}>
        <Button label="Add happy hour window" variant="secondary" icon="add" onPress={addWindow} />
      </View>

      <View style={gutter()}>
        <Callout tone="info" icon="information-circle" title="A note on drink pricing">
          <Body dim>
            Drink-price promotions are regulated differently state by state. What's published here
            is exactly what you type — this screen doesn't check it against any jurisdiction's rules.
          </Body>
        </Callout>
      </View>

      {error ? (
        <View style={gutter()}>
          <Callout tone="danger" icon="alert-circle" title="Could not save">
            <Body dim>{error}</Body>
          </Callout>
        </View>
      ) : null}

      <View style={gutter()}>
        <Button label="Save hours" icon="save-outline" full loading={submitting} disabled={invalid} onPress={submit} />
      </View>
    </Screen>
  );
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  const ok = validTime(value);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="18:00"
      placeholderTextColor={theme.textFaint}
      accessibilityLabel="Time, 24-hour HH:MM"
      maxLength={5}
      style={[
        font.body,
        {
          color: theme.text,
          backgroundColor: theme.cardMuted,
          borderRadius: radius.md,
          paddingHorizontal: space.sm,
          minHeight: 40,
          width: 68,
          textAlign: 'center',
          borderWidth: ok ? 0 : 1,
          borderColor: theme.closed,
        },
      ]}
    />
  );
}

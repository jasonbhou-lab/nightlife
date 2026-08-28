import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Chip, Divider, gutter, Label, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { cancelAdCampaign, createAdCampaign, getVenueEvents } from '@/data/repository';
import { BUDGET_TIERS, isCampaignActive } from '@/lib/advertising';
import { DAYPART_DEFS } from '@/lib/daypart';
import { relativeDate } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { AdBudgetTier, Daypart, VenueAnalyticsEvent } from '@/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * F-BIZ-10, scoped: schedule a paid placement for this venue. See the
 * migration header on 20260828140000_add_ad_campaigns.sql for exactly what's
 * real (budget, dates, daypart targeting) versus collected-but-informational
 * (geography) versus not built at all (payment capture, creative asset
 * upload beyond one headline).
 */
export default function VenueAdvertisingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const { now, session, attemptContribution, isManagingVenue } = useApp();
  const { getVenue, addAdCampaign, removeAdCampaign } = useCatalogue();

  const venue = getVenue(venueId);
  const [events, setEvents] = useState<VenueAnalyticsEvent[]>([]);

  const [budgetTier, setBudgetTier] = useState<AdBudgetTier>('starter');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [dayparts, setDayparts] = useState<Daypart[]>([]);
  const [neighborhoods, setNeighborhoods] = useState('');
  const [headline, setHeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.role === 'guest') attemptContribution();
  }, []);

  const load = useCallback(() => {
    if (!venue) return;
    getVenueEvents(venue.id).then(setEvents);
  }, [venue?.id]);

  useEffect(() => {
    if (venue && isManagingVenue(venue.id)) load();
  }, [venue?.id]);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Advertising" onBack={() => router.back()} />
      </Screen>
    );
  }

  if (session.role === 'guest') {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Advertising" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <Body dim>Scheduling a campaign needs an account. Reading and browsing do not.</Body>
            <Button label="Sign in" full style={{ marginTop: space.md }} onPress={() => router.push('/auth')} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (!isManagingVenue(venue.id)) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Advertising" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="You don't manage this listing">
            <Body dim>Only an account that has claimed this listing can schedule campaigns for it.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const startInvalid = startsOn.trim() !== '' && (!DATE_RE.test(startsOn.trim()) || Number.isNaN(new Date(startsOn.trim()).getTime()));
  const endInvalid = endsOn.trim() !== '' && (!DATE_RE.test(endsOn.trim()) || Number.isNaN(new Date(endsOn.trim()).getTime()));
  const rangeInvalid = !startInvalid && !endInvalid && startsOn.trim() && endsOn.trim() && endsOn.trim() < startsOn.trim();
  const canSubmit = !!startsOn.trim() && !!endsOn.trim() && !startInvalid && !endInvalid && !rangeInvalid;

  const toggleDaypart = (d: Daypart) => {
    setDayparts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const targetNeighborhoods = neighborhoods
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const result = await createAdCampaign({
      venueId: venue.id,
      startsOn: startsOn.trim(),
      endsOn: endsOn.trim(),
      budgetTier,
      targetNeighborhoods: targetNeighborhoods.length ? targetNeighborhoods : undefined,
      targetDayparts: dayparts.length ? dayparts : undefined,
      headline: headline.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    addAdCampaign(venue.id, result.campaign);
    setBudgetTier('starter');
    setStartsOn('');
    setEndsOn('');
    setDayparts([]);
    setNeighborhoods('');
    setHeadline('');
  };

  const cancel = async (campaignId: string) => {
    const result = await cancelAdCampaign(campaignId);
    if (result.ok) removeAdCampaign(venue.id, campaignId);
  };

  const campaigns = [...(venue.adCampaigns ?? [])].sort((a, b) => b.startsOn.localeCompare(a.startsOn));

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Advertising" subtitle={venue.name} onBack={() => router.back()} />

      <View style={gutter()}>
        <Callout tone="info" icon="information-circle" title="What this actually does">
          <Body dim>
            Budget tier, dates, and daypart targeting are real — your placement is only pinned and
            labeled during the window and dayparts you pick. Neighborhood targeting is recorded and
            shown here, but this build has no per-search geo-targeting engine, so it does not change
            who sees you. No payment is captured — the prices below are published, not charged.
          </Body>
        </Callout>
      </View>

      <View style={gutter()}>
        <Card>
          <Label>Budget</Label>
          <View style={[ui.row, { gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }]}>
            {(Object.keys(BUDGET_TIERS) as AdBudgetTier[]).map((t) => (
              <Chip
                key={t}
                label={`${BUDGET_TIERS[t].label} · ${BUDGET_TIERS[t].priceLabel}`}
                selected={budgetTier === t}
                onPress={() => setBudgetTier(t)}
              />
            ))}
          </View>

          <View style={[ui.row, { gap: space.md, marginTop: space.lg }]}>
            <View style={{ flex: 1 }}>
              <Label>Starts</Label>
              <TextInput
                value={startsOn}
                onChangeText={setStartsOn}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textFaint}
                accessibilityLabel="Campaign start date"
                maxLength={10}
                style={[
                  font.body,
                  {
                    color: theme.text,
                    backgroundColor: theme.cardMuted,
                    borderRadius: radius.md,
                    paddingHorizontal: space.md,
                    minHeight: 44,
                    marginTop: space.sm,
                    borderWidth: startInvalid ? 1 : 0,
                    borderColor: theme.closed,
                  },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Label>Ends</Label>
              <TextInput
                value={endsOn}
                onChangeText={setEndsOn}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textFaint}
                accessibilityLabel="Campaign end date"
                maxLength={10}
                style={[
                  font.body,
                  {
                    color: theme.text,
                    backgroundColor: theme.cardMuted,
                    borderRadius: radius.md,
                    paddingHorizontal: space.md,
                    minHeight: 44,
                    marginTop: space.sm,
                    borderWidth: endInvalid || rangeInvalid ? 1 : 0,
                    borderColor: theme.closed,
                  },
                ]}
              />
            </View>
          </View>
          {rangeInvalid ? (
            <Text style={[font.small, { color: theme.closed, marginTop: space.sm }]}>
              Ends before it starts.
            </Text>
          ) : null}

          <Label style={{ marginTop: space.lg }}>Daypart targeting (optional)</Label>
          <Text style={[font.small, { color: theme.textFaint, marginTop: 2, marginBottom: space.sm }]}>
            Leave all unselected for no restriction.
          </Text>
          <View style={[ui.row, { gap: space.sm, flexWrap: 'wrap' }]}>
            {DAYPART_DEFS.map((d) => (
              <Chip
                key={d.key}
                label={d.label}
                selected={dayparts.includes(d.key)}
                onPress={() => toggleDaypart(d.key)}
              />
            ))}
          </View>

          <Label style={{ marginTop: space.lg }}>Target neighborhoods (optional)</Label>
          <TextInput
            value={neighborhoods}
            onChangeText={setNeighborhoods}
            placeholder="Downtown, Montrose — leave blank for citywide"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Target neighborhoods, comma separated"
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

          <Label style={{ marginTop: space.lg }}>Headline (optional)</Label>
          <TextInput
            value={headline}
            onChangeText={setHeadline}
            placeholder="Shown in place of your tagline while the campaign runs"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Campaign headline"
            maxLength={100}
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

          {error ? (
            <Text style={[font.small, { color: theme.closed, marginTop: space.sm }]}>{error}</Text>
          ) : null}
          <Button
            label="Schedule campaign"
            icon="megaphone-outline"
            full
            loading={submitting}
            disabled={!canSubmit}
            style={{ marginTop: space.md }}
            onPress={submit}
          />
        </Card>
      </View>

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>Campaigns</Text>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {campaigns.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>Nothing scheduled yet.</Body>
          ) : (
            campaigns.map((c, i) => {
              const today = now.toISOString().slice(0, 10);
              const started = c.startsOn <= today;
              const ended = c.endsOn < today;
              const active = isCampaignActive(c, now);
              const performance = events.filter(
                (e) => e.createdAt.slice(0, 10) >= c.startsOn && e.createdAt.slice(0, 10) <= c.endsOn,
              );
              const views = performance.filter((e) => e.kind === 'view').length;
              const clicks = performance.length - views;
              return (
                <View key={c.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: space.lg }}>
                    <View style={[ui.row, { gap: space.sm }]}>
                      <Text style={[font.body, { color: theme.text, flex: 1 }]}>
                        {BUDGET_TIERS[c.budgetTier].label}
                      </Text>
                      <Text style={[font.small, { color: active ? theme.open : theme.textFaint }]}>
                        {active ? 'Running now' : ended ? 'Ended' : started ? 'Active' : 'Scheduled'}
                      </Text>
                    </View>
                    {c.headline ? <Body dim style={{ marginTop: 4 }}>{c.headline}</Body> : null}
                    <Text style={[font.small, { color: theme.textFaint, marginTop: 6 }]}>
                      {relativeDate(c.startsOn, now)} through {relativeDate(c.endsOn, now)}
                      {c.targetDayparts?.length
                        ? ` · ${c.targetDayparts.map((d) => DAYPART_DEFS.find((x) => x.key === d)?.label ?? d).join(', ')}`
                        : ''}
                      {c.targetNeighborhoods?.length ? ` · ${c.targetNeighborhoods.join(', ')}` : ''}
                    </Text>
                    {started ? (
                      <Text style={[font.small, { color: theme.textDim, marginTop: 6 }]}>
                        {views.toLocaleString('en-US')} views · {clicks.toLocaleString('en-US')} clicks during this campaign
                      </Text>
                    ) : (
                      <Button
                        label="Cancel"
                        variant="ghost"
                        icon="close-circle-outline"
                        style={{ marginTop: space.sm, alignSelf: 'flex-start' }}
                        onPress={() => cancel(c.id)}
                      />
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </View>
    </Screen>
  );
}

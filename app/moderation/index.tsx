import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Body, Button, Callout, Card, Divider, gutter, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { getModerationQueue, moderateReport, restoreReview } from '@/data/repository';
import { relativeDate, REPORT_REASON_LABELS } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { ContentReport } from '@/types';

/**
 * F-TRUST-01, scoped to a single queue: reviews are the only content type
 * with a real report entry point in this client (see the migration header
 * on 20260826110000_add_trust_and_safety.sql for why photos/Q&A and
 * automated pre-screening are out). No per-severity SLA timer — every
 * report is one queue, oldest first.
 *
 * A moderator can dismiss, remove, or escalate a pending report. Only a
 * trust_safety account can resolve something escalated, or restore a
 * review it had removed — content_reports_apply_moderation() is what
 * actually enforces that, not this screen; a moderator hitting the wrong
 * button here gets the database's own rejection back as `error`.
 */
export default function ModerationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, now, isModerator, isTrustSafety } = useApp();
  const { reviews, venueById, setReviewRecommended } = useCatalogue();

  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canModerate = isModerator || isTrustSafety;

  const load = useCallback(() => {
    setLoading(true);
    getModerationQueue()
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (canModerate) load();
    else setLoading(false);
  }, [canModerate, load]);

  if (session.role === 'guest' || !canModerate) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Moderation queue" onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="info" icon="shield-checkmark" title="Platform role required">
            <Body dim>
              This queue is only reachable with a moderator or trust &amp; safety role. There is no
              self-serve way to get one here — see the app README for why.
            </Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  const act = async (report: ContentReport, status: 'dismissed' | 'removed' | 'escalated') => {
    setBusyId(report.id);
    setError(null);
    const result = await moderateReport({ reportId: report.id, status });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (status === 'removed') setReviewRecommended(report.reviewId, false);
    load();
  };

  const restore = async (report: ContentReport) => {
    setBusyId(report.id);
    setError(null);
    const result = await restoreReview(report.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReviewRecommended(report.reviewId, true);
    load();
  };

  const open = reports.filter((r) => r.status === 'pending' || r.status === 'escalated');
  const resolved = reports.filter((r) => r.status === 'dismissed' || r.status === 'removed').slice(0, 20);

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title="Moderation queue"
        subtitle={isTrustSafety ? 'Trust & Safety' : 'Moderator'}
        onBack={() => router.back()}
      />

      {error ? (
        <View style={gutter()}>
          <Text style={[font.small, { color: theme.closed }]}>{error}</Text>
        </View>
      ) : null}

      <View style={gutter()}>
        <Card padded={false}>
          {loading ? (
            <Body dim style={{ padding: space.lg }}>Loading…</Body>
          ) : open.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>Nothing waiting on you.</Body>
          ) : (
            open.map((report, i) => {
              const review = reviews.find((r) => r.id === report.reviewId);
              const venue = review ? venueById[review.venueId] : undefined;
              const canResolveEscalated = report.status !== 'escalated' || isTrustSafety;
              return (
                <View key={report.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: space.lg }}>
                    <View style={[ui.row, { gap: space.sm }]}>
                      <Text style={[font.body, { color: theme.text, flex: 1 }]}>
                        {venue?.name ?? 'Unknown venue'}
                      </Text>
                      {report.status === 'escalated' ? (
                        <Text style={[font.small, { color: theme.accent }]}>Escalated</Text>
                      ) : null}
                    </View>
                    <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                      {REPORT_REASON_LABELS[report.reason]} · reported {relativeDate(report.createdAt, now)}
                    </Text>
                    {review ? (
                      <Body dim style={{ marginTop: space.sm }} numberOfLines={3}>
                        &ldquo;{review.text}&rdquo; — {review.author}
                      </Body>
                    ) : (
                      <Body dim style={{ marginTop: space.sm }}>This review no longer exists.</Body>
                    )}
                    {!canResolveEscalated ? (
                      <Text style={[font.small, { color: theme.textFaint, marginTop: space.sm }]}>
                        Escalated — waiting on a trust &amp; safety account to resolve it.
                      </Text>
                    ) : (
                      <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
                        <Button
                          label="Dismiss"
                          variant="secondary"
                          loading={busyId === report.id}
                          onPress={() => act(report, 'dismissed')}
                        />
                        <Button
                          label="Remove"
                          variant="secondary"
                          loading={busyId === report.id}
                          onPress={() => act(report, 'removed')}
                        />
                        {report.status === 'pending' ? (
                          <Button
                            label="Escalate"
                            variant="ghost"
                            loading={busyId === report.id}
                            onPress={() => act(report, 'escalated')}
                          />
                        ) : null}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </View>

      <View style={gutter()}>
        <Text style={[font.cardTitle, { color: theme.onGround }]}>Recently resolved</Text>
      </View>

      <View style={gutter()}>
        <Card padded={false}>
          {resolved.length === 0 ? (
            <Body dim style={{ padding: space.lg }}>Nothing resolved yet.</Body>
          ) : (
            resolved.map((report, i) => {
              const review = reviews.find((r) => r.id === report.reviewId);
              const venue = review ? venueById[review.venueId] : undefined;
              return (
                <View key={report.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={[ui.row, { padding: space.lg, gap: space.md }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[font.body, { color: theme.text }]}>{venue?.name ?? 'Unknown venue'}</Text>
                      <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                        {REPORT_REASON_LABELS[report.reason]} ·{' '}
                        {report.resolvedAt ? relativeDate(report.resolvedAt, now) : ''}
                      </Text>
                    </View>
                    {report.status === 'removed' && isTrustSafety ? (
                      <Button
                        label="Restore"
                        variant="ghost"
                        loading={busyId === report.id}
                        onPress={() => restore(report)}
                      />
                    ) : (
                      <Text style={[font.small, { color: theme.textDim }]}>
                        {report.status === 'removed' ? 'Removed' : 'Dismissed'}
                      </Text>
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

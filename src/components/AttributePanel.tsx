import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Divider, KeyValue, Label } from '@/components/ui';
import { attributesForVertical, groupLabels } from '@/data/attributes';
import { formatAttribute, freshness, metaFor, provenanceLabel } from '@/lib/format';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';
import type { AttributeDef, AttributeGroup, Venue } from '@/types';

/**
 * F-PROFILE-04: the structured attribute panel, grouped by theme, showing
 * provenance and last-updated on volatile fields.
 *
 * Only attributes the venue actually reports are rendered. An unreported
 * attribute is absent rather than shown as "No", because "we do not know" and
 * "the venue does not have it" are different answers and conflating them is how
 * general-purpose platforms end up misinforming people.
 */
export function AttributePanel({ venue }: { venue: Venue }) {
  const theme = useTheme();
  const { now } = useApp();
  const [expanded, setExpanded] = useState<Set<AttributeGroup>>(new Set(['decide']));

  const groups = useMemo(() => {
    const defs = attributesForVertical(venue.primary.vertical).filter((d) => {
      const v = venue.attributes[d.key];
      return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
    });
    const map = new Map<AttributeGroup, AttributeDef[]>();
    for (const d of defs) {
      const list = map.get(d.group) ?? [];
      list.push(d);
      map.set(d.group, list);
    }
    // Put the groups that matter most for this vertical first.
    const order: AttributeGroup[] = venue.primary.vertical === 'cigar'
      ? ['humidor', 'smoking', 'drink', 'entry', 'seating', 'money', 'food', 'entertainment', 'crowd', 'access']
      : venue.primary.vertical === 'nightclub'
        ? ['entry', 'money', 'entertainment', 'crowd', 'seating', 'smoking', 'access', 'drink', 'food', 'humidor']
        : venue.primary.vertical === 'bar'
          ? ['drink', 'entertainment', 'seating', 'crowd', 'food', 'money', 'entry', 'smoking', 'access', 'humidor']
          : venue.primary.vertical === 'lounge'
            ? ['money', 'entry', 'entertainment', 'smoking', 'seating', 'drink', 'crowd', 'food', 'access', 'humidor']
            : ['food', 'seating', 'entry', 'drink', 'money', 'crowd', 'access', 'entertainment', 'smoking', 'humidor'];

    return order
      .filter((g) => map.has(g))
      .map((g) => [g, map.get(g)!] as [AttributeGroup, AttributeDef[]]);
  }, [venue]);

  const toggle = (g: AttributeGroup) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <Card padded={false}>
      {groups.map(([group, defs], i) => {
        const open = expanded.has(group) || i === 0;
        const staleCount = defs.filter((d) => freshness(venue, d.key, now).stale).length;
        return (
          <View key={group}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => toggle(group)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${groupLabels[group]}, ${defs.length} details`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                minHeight: 52,
              }}
            >
              <Text style={[font.bodyStrong, { color: theme.text, flex: 1 }]}>{groupLabels[group]}</Text>
              {staleCount > 0 && !open ? (
                <Text style={[font.small, { color: theme.warn, marginRight: space.sm }]}>
                  {staleCount} dated
                </Text>
              ) : null}
              <Text style={[font.small, { color: theme.textFaint, marginRight: space.sm }]}>{defs.length}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textFaint} />
            </Pressable>

            {open ? (
              <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
                {defs.map((d) => {
                  const value = venue.attributes[d.key];
                  const fresh = freshness(venue, d.key, now);
                  const meta = metaFor(venue, d.key);
                  return (
                    <KeyValue
                      key={d.key}
                      label={d.label}
                      value={formatAttribute(d.key, value)}
                      note={d.ttlDays ? fresh.note : `${provenanceLabel[meta.source]}`}
                      caveat={d.caveat}
                      stale={fresh.stale}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      <Divider />
      <View style={{ padding: space.lg, gap: 4 }}>
        <Label>Where this comes from</Label>
        <Text style={[font.small, { color: theme.textDim, lineHeight: 17 }]}>
          Owner-provided values take precedence, except where enough community reports contradict
          them, which routes the listing to Content Operations. Cover charge, tap lists, and lineups
          expire after 14 days; happy hour after 60; hours after 90. Expired values are shown with
          their age rather than as current fact.
        </Text>
      </View>
    </Card>
  );
}

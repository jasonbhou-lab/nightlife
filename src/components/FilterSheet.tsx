import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Divider, Label, styles as ui } from '@/components/ui';
import { filterableForVerticals, groupLabels } from '@/data/attributes';
import { useCatalogue } from '@/data/catalogue';
import { categories as categoriesByVertical, verticalMeta, VERTICALS } from '@/data/taxonomy';
import { searchVenues } from '@/lib/search';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { AttributeDef, AttributeGroup, AttributeValue, FilterState, Vertical } from '@/types';

/**
 * F-SEARCH-04: the filter set is category-aware. Selecting Cigar Lounge exposes
 * humidor, locker, and membership filters; Nightclub exposes cover, genre, and
 * age policy; Bar exposes tap count, sports viewing, games, happy hour, and
 * dog-friendly. Irrelevant filters are *hidden*, not disabled — a greyed-out
 * "Humidor" row on a sports bar search is noise, not information.
 *
 * The live result count updates as filters change, so the user finds out they
 * have over-filtered before they hit an empty list.
 */

/** Threshold ladders for numeric filters. */
const ladders: Record<string, number[]> = {
  tapCount: [8, 16, 24, 40],
  whiskeyCount: [25, 50, 100, 200],
  wineByGlass: [10, 15, 20, 30],
  largestScreenInches: [55, 75, 100, 150],
  tvCount: [4, 10, 20],
  poolTableCount: [1, 2, 3],
  humidorSqFt: [100, 250, 400],
  skuCount: [250, 500, 1000],
  seatCount: [20, 40, 60],
  hookahFlavorCount: [15, 30, 45],
  capacity: [300, 600, 900],
  groupCeiling: [10, 20, 40],
  ageMinimumLate: [18, 21],
};

const ceilings: Record<string, number[]> = {
  coverCharge: [0, 10, 20, 30],
  bottleMinimum: [350, 500, 800, 1500],
  lockerPriceMonthly: [30, 50, 100],
  membershipPrice: [0, 100, 200, 400],
};

export function FilterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { filters, setFilters, resetFilters, now } = useApp();
  const { venues } = useCatalogue();
  const [draft, setDraft] = useState<FilterState>(filters);

  // Re-seed the draft whenever the sheet opens.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setDraft(filters);
    setWasVisible(true);
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  const liveCount = useMemo(
    () => searchVenues(draft, now, venues).results.length,
    [draft, now, venues],
  );

  const defs = useMemo(() => filterableForVerticals(draft.verticals), [draft.verticals]);

  /**
   * Cuisine and atmosphere: the venue's own subcategory (Tex-Mex, Speakeasy,
   * Dive Bar, Latin Club), not the platform-race-based tagging that was
   * originally proposed — venues describe their own culinary tradition, music
   * programming, and theme; the taxonomy never describes who a venue's
   * customers are. Grouped by vertical whenever more than one is active, same
   * as the "showing filters common to all five" default the attribute list
   * already uses.
   */
  const categoryGroups = useMemo(() => {
    const active = draft.verticals.length ? draft.verticals : VERTICALS;
    return active.map((v) => ({ vertical: v, values: categoriesByVertical[v] }));
  }, [draft.verticals]);

  const toggleCategory = (cat: string) => {
    setDraft((prev) => {
      const has = prev.categories.includes(cat);
      const categories = has ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat];
      return { ...prev, categories };
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<AttributeGroup, AttributeDef[]>();
    for (const d of defs) {
      const list = map.get(d.group) ?? [];
      list.push(d);
      map.set(d.group, list);
    }
    return Array.from(map.entries());
  }, [defs]);

  const setAttr = (key: string, value: AttributeValue | undefined) => {
    setDraft((prev) => {
      const attributes = { ...prev.attributes };
      if (value === undefined) delete attributes[key];
      else attributes[key] = value;
      return { ...prev, attributes };
    });
  };

  const toggleVertical = (v: Vertical) => {
    setDraft((prev) => {
      const has = prev.verticals.includes(v);
      const verticals = has ? prev.verticals.filter((x) => x !== v) : [...prev.verticals, v];
      // Drop attribute filters that no longer apply to any selected vertical.
      const allowed = new Set(filterableForVerticals(verticals).map((d) => d.key));
      const attributes = Object.fromEntries(
        Object.entries(prev.attributes).filter(([k]) => allowed.has(k)),
      );
      // Same for cuisine/atmosphere picks tied to a vertical that just dropped out.
      const allowedCats = new Set((verticals.length ? verticals : VERTICALS).flatMap((x) => categoriesByVertical[x]));
      const categories = prev.categories.filter((c) => allowedCats.has(c));
      return { ...prev, verticals, attributes, categories };
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(4,7,15,0.55)', justifyContent: 'flex-end' }}>
        <View
          style={{
            maxHeight: '90%',
            backgroundColor: theme.mode === 'dark' ? '#0A1128' : '#F2F6FF',
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingTop: space.md,
          }}
        >
          <View style={[ui.row, { paddingHorizontal: space.lg, paddingBottom: space.md }]}>
            <Text style={[font.title, { color: theme.text, flex: 1 }]} accessibilityRole="header">
              Filters
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              style={{ padding: 6 }}
            >
              <Ionicons name="close" size={24} color={theme.textDim} />
            </Pressable>
          </View>
          <Divider />

          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
            {/* Category. Drives which attribute filters exist at all. */}
            <Card>
              <Label>Category</Label>
              <Text style={[font.small, { color: theme.textFaint, marginTop: 2, marginBottom: space.md }]}>
                Picking a category changes which filters below are available.
              </Text>
              <View style={{ gap: space.sm }}>
                {VERTICALS.map((v) => {
                  const on = draft.verticals.includes(v);
                  return (
                    <Pressable
                      key={v}
                      onPress={() => toggleVertical(v)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={verticalMeta[v].label}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.md,
                        padding: space.md,
                        borderRadius: radius.md,
                        backgroundColor: on ? theme.accentSoft : theme.cardMuted,
                        minHeight: 56,
                      }}
                    >
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={on ? theme.accent : theme.textFaint}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[font.bodyStrong, { color: theme.text }]}>{verticalMeta[v].label}</Text>
                        <Text style={[font.small, { color: theme.textDim }]} numberOfLines={2}>
                          {verticalMeta[v].blurb}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {/* Cuisine and atmosphere: the venue's own culinary tradition, music
                programming, and theme — not who its customers are. */}
            <Card>
              <Label>Cuisine & atmosphere</Label>
              <Text style={[font.small, { color: theme.textFaint, marginTop: 2, marginBottom: space.md }]}>
                The specific style of the space, like Tex-Mex, Speakeasy, or Latin Club.
              </Text>
              <View style={{ gap: space.md }}>
                {categoryGroups.map(({ vertical, values }) => (
                  <View key={vertical}>
                    {categoryGroups.length > 1 ? (
                      <Text style={[font.meta, { color: theme.textDim, marginBottom: space.sm }]}>
                        {verticalMeta[vertical].plural}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                      {values.map((cat) => (
                        <Chip
                          key={cat}
                          label={cat}
                          selected={draft.categories.includes(cat)}
                          onPress={() => toggleCategory(cat)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            {/* Time, price, rating, distance. */}
            <Card>
              <Label>When and how far</Label>
              <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
                <Chip
                  label="Open now"
                  icon="time"
                  selected={draft.openNow}
                  onPress={() => setDraft((p) => ({ ...p, openNow: !p.openNow, openAt: null }))}
                />
                {['21:00', '23:00', '00:30', '02:00'].map((t) => (
                  <Chip
                    key={t}
                    label={`Open at ${t}`}
                    selected={draft.openAt === t}
                    onPress={() =>
                      setDraft((p) => ({ ...p, openAt: p.openAt === t ? null : t, openNow: false }))
                    }
                  />
                ))}
              </View>
              <Text style={[font.small, { color: theme.textFaint, marginTop: space.sm }]}>
                After-midnight hours are handled properly: a club closing at 4 AM Saturday counts as
                open at 2 AM on the Saturday-into-Sunday boundary.
              </Text>

              <Divider style={{ marginVertical: space.md }} />
              <Label>Price</Label>
              <View style={[ui.row, { gap: space.sm, marginTop: space.sm }]}>
                {[1, 2, 3, 4].map((t) => (
                  <Chip
                    key={t}
                    label={'$'.repeat(t)}
                    selected={draft.priceTiers.includes(t)}
                    onPress={() =>
                      setDraft((p) => ({
                        ...p,
                        priceTiers: p.priceTiers.includes(t)
                          ? p.priceTiers.filter((x) => x !== t)
                          : [...p.priceTiers, t],
                      }))
                    }
                  />
                ))}
              </View>

              <Divider style={{ marginVertical: space.md }} />
              <Label>Rating</Label>
              <View style={[ui.row, { gap: space.sm, marginTop: space.sm }]}>
                {[3, 4, 4.5].map((r) => (
                  <Chip
                    key={r}
                    label={`${r}+`}
                    icon="star"
                    selected={draft.minRating === r}
                    onPress={() => setDraft((p) => ({ ...p, minRating: p.minRating === r ? null : r }))}
                  />
                ))}
              </View>

              <Divider style={{ marginVertical: space.md }} />
              <Label>Distance</Label>
              <View style={[ui.row, { gap: space.sm, marginTop: space.sm }]}>
                {[1, 3, 5, 10].map((d) => (
                  <Chip
                    key={d}
                    label={`${d} mi`}
                    selected={draft.maxDistanceMi === d}
                    onPress={() =>
                      setDraft((p) => ({ ...p, maxDistanceMi: p.maxDistanceMi === d ? null : d }))
                    }
                  />
                ))}
              </View>
            </Card>

            {/* Category-aware attribute filters. */}
            {grouped.map(([group, list]) => (
              <Card key={group}>
                <Label>{groupLabels[group]}</Label>
                <View style={{ gap: space.md, marginTop: space.md }}>
                  {list.map((d) => (
                    <AttributeFilterRow
                      key={d.key}
                      def={d}
                      value={draft.attributes[d.key]}
                      onChange={(v) => setAttr(d.key, v)}
                    />
                  ))}
                </View>
              </Card>
            ))}

            {draft.verticals.length === 0 ? (
              <Text style={[font.small, { color: theme.textDim, textAlign: 'center' }]}>
                Showing filters common to all five categories. Pick a category above to unlock the
                ones specific to it — humidors and lockers, cover and genre, taps and games.
              </Text>
            ) : null}
          </ScrollView>

          {/* Sticky footer with the live count. */}
          <View
            style={{
              padding: space.lg,
              paddingBottom: space.lg + insets.bottom,
              backgroundColor: theme.card,
              borderTopWidth: 1,
              borderTopColor: theme.cardBorder,
              flexDirection: 'row',
              gap: space.md,
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={() => {
                resetFilters();
                setDraft((p) => ({ ...p, verticals: [], categories: [], attributes: {}, priceTiers: [], minRating: null, openNow: false, openAt: null, maxDistanceMi: null }));
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm }}
            >
              <Text style={[font.bodyStrong, { color: theme.textDim }]}>Clear all</Text>
            </Pressable>
            <Button
              label={
                liveCount === 0
                  ? 'No venues match'
                  : `Show ${liveCount} ${liveCount === 1 ? 'venue' : 'venues'}`
              }
              onPress={() => {
                setFilters(draft);
                onClose();
              }}
              style={{ flex: 1 }}
              variant={liveCount === 0 ? 'secondary' : 'primary'}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AttributeFilterRow({
  def,
  value,
  onChange,
}: {
  def: AttributeDef;
  value: AttributeValue | undefined;
  onChange: (v: AttributeValue | undefined) => void;
}) {
  const theme = useTheme();

  if (def.type === 'boolean') {
    const on = value === true;
    return (
      <Pressable
        onPress={() => onChange(on ? undefined : true)}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={def.label}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.md }}
      >
        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? theme.accent : theme.textFaint} />
        <View style={{ flex: 1 }}>
          <Text style={[font.body, { color: theme.text }]}>{def.label}</Text>
          {def.caveat ? (
            <Text style={[font.small, { color: theme.textFaint }]} numberOfLines={2}>
              {def.caveat}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  if (def.type === 'enum' || def.type === 'multi') {
    const isMulti = def.type === 'multi';
    const selected: string[] = Array.isArray(value) ? value : value != null ? [String(value)] : [];
    return (
      <View>
        <Text style={[font.meta, { color: theme.textDim, marginBottom: space.sm }]}>{def.label}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(def.options ?? []).map((o) => {
            const on = selected.includes(o.value);
            return (
              <Chip
                key={o.value}
                label={o.label}
                selected={on}
                onPress={() => {
                  if (isMulti) {
                    const next = on ? selected.filter((x) => x !== o.value) : [...selected, o.value];
                    onChange(next.length ? next : undefined);
                  } else {
                    onChange(on ? undefined : o.value);
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    );
  }

  if (def.type === 'integer') {
    const steps = ladders[def.key] ?? [1, 5, 10];
    return (
      <View>
        <Text style={[font.meta, { color: theme.textDim, marginBottom: space.sm }]}>
          {def.label}
          {def.filterAsMinimum ? ', at least' : ''}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {steps.map((n) => (
            <Chip
              key={n}
              label={`${n}${def.filterAsMinimum ? '+' : ''}${def.unit && def.unit !== '+' ? ` ${def.unit}` : ''}`}
              selected={value === n}
              onPress={() => onChange(value === n ? undefined : n)}
            />
          ))}
        </View>
      </View>
    );
  }

  if (def.type === 'currency') {
    const steps = ceilings[def.key] ?? [25, 50, 100];
    return (
      <View>
        <Text style={[font.meta, { color: theme.textDim, marginBottom: space.sm }]}>{def.label}, up to</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {steps.map((n) => (
            <Chip
              key={n}
              label={n === 0 ? 'None' : `$${n}`}
              selected={value === n}
              onPress={() => onChange(value === n ? undefined : n)}
            />
          ))}
        </View>
        {def.caveat ? (
          <Text style={[font.small, { color: theme.textFaint, marginTop: 4 }]}>{def.caveat}</Text>
        ) : null}
      </View>
    );
  }

  return null;
}

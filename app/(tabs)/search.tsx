import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { BackendBanner } from '@/components/BackendBanner';
import { FilterSheet } from '@/components/FilterSheet';
import { MiniMap } from '@/components/MiniMap';
import { VenueCard } from '@/components/VenueCard';
import {
  Body, Button, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader, styles as ui,
} from '@/components/ui';
import { attributeByKey } from '@/data/attributes';
import { useCatalogue } from '@/data/catalogue';
import { verticalMeta } from '@/data/taxonomy';
import { formatAttribute } from '@/lib/format';
import { activeFilterCount, parseNaturalQuery, searchVenues, suggest, type Suggestion } from '@/lib/search';
import { detectVibe, rankByVibe, vibeDefs, type VibeDef } from '@/lib/vibes';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Review, SortKey, Venue, Vertical } from '@/types';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'rating', label: 'Rating' },
  { key: 'vibeRating', label: 'Vibe' },
  { key: 'distance', label: 'Distance' },
  { key: 'reviewCount', label: 'Most reviewed' },
  { key: 'price', label: 'Price' },
  { key: 'availability', label: 'Soonest table' },
];

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { filters, setFilters, resetFilters, now, recentSearches, pushRecentSearch } = useApp();
  const { venues, reviews, source, error: backendError } = useCatalogue();

  const [text, setText] = useState(filters.query);
  const [focused, setFocused] = useState(false);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [sheet, setSheet] = useState(false);
  const [areaLimited, setAreaLimited] = useState<Venue[] | null>(null);
  const [nlNote, setNlNote] = useState<string[] | null>(null);
  const [activeVibe, setActiveVibe] = useState<VibeDef | null>(null);

  const reviewsByVenue = useMemo(() => {
    const map: Record<string, Review[]> = {};
    for (const r of reviews) if (r.recommended) (map[r.venueId] ||= []).push(r);
    return map;
  }, [reviews]);

  const suggestions = useMemo(
    () => (focused ? suggest(text, venues) : []),
    [focused, text, venues],
  );

  const search = useMemo(
    () => searchVenues(filters, now, areaLimited ?? venues),
    [filters, now, areaLimited, venues],
  );

  // F-SEARCH-12: reranks whatever the other active filters already turned up
  // (promoted placements stay pinned per F-SEARCH-09) rather than replacing
  // the search pool, so a vibe composes with the filter sheet instead of
  // standing apart from it.
  const vibeResults = useMemo(
    () =>
      activeVibe
        ? rankByVibe(search.results.filter((v) => !v.promoted), reviewsByVenue, activeVibe)
        : null,
    [activeVibe, search.results, reviewsByVenue],
  );

  const count = activeFilterCount(filters);

  const submit = () => {
    setFocused(false);
    pushRecentSearch(text);
    // F-SEARCH-11: compound intent goes through the natural-language parser,
    // which reports back what it understood so it can be corrected.
    const { filters: parsed, understood } = parseNaturalQuery(text);
    const vibe = detectVibe(text);
    if (understood.length >= 2) {
      setFilters({ ...filters, ...parsed, query: '' });
      setNlNote(understood);
      setActiveVibe(null);
    } else if (vibe) {
      // F-SEARCH-12: a named vibe reranks by evidence rather than filtering by
      // literal text — venue copy rarely says "date night" about itself, but
      // its reviews do.
      setFilters({ ...filters, query: '' });
      setNlNote(null);
      setActiveVibe(vibe);
    } else {
      setFilters({ ...filters, query: text });
      setNlNote(null);
      setActiveVibe(null);
    }
  };

  const applyVibe = (vibe: VibeDef) => {
    setText(vibe.label);
    setFocused(false);
    pushRecentSearch(vibe.label);
    setFilters({ ...filters, query: '' });
    setNlNote(null);
    setActiveVibe(vibe);
  };

  const applySuggestion = (s: Suggestion) => {
    setFocused(false);
    if (s.kind === 'venue' && s.venueId) {
      router.push(`/venue/${s.venueId}`);
      return;
    }
    if (s.kind === 'dish' && s.venueId) {
      router.push(`/menu/${s.venueId}`);
      return;
    }
    setText(s.label);
    setFilters({ ...filters, query: s.label });
    pushRecentSearch(s.label);
    setActiveVibe(null);
  };

  /** U-10: one-tap clearing of individual filters. */
  const clearOne = (key: string) => {
    if (key === 'query') {
      setText('');
      setFilters({ ...filters, query: '' });
      setNlNote(null);
      setActiveVibe(null);
    } else if (key === 'verticals') setFilters({ ...filters, verticals: [] });
    else if (key === 'categories') setFilters({ ...filters, categories: [] });
    else if (key === 'priceTiers') setFilters({ ...filters, priceTiers: [] });
    else if (key === 'minRating') setFilters({ ...filters, minRating: null });
    else if (key === 'minVibeRating') setFilters({ ...filters, minVibeRating: null });
    else if (key === 'openNow') setFilters({ ...filters, openNow: false });
    else if (key === 'openAt') setFilters({ ...filters, openAt: null });
    else if (key === 'maxDistanceMi') setFilters({ ...filters, maxDistanceMi: null });
    else if (key.startsWith('attr:')) {
      const attrs = { ...filters.attributes };
      delete attrs[key.slice(5)];
      setFilters({ ...filters, attributes: attrs });
    }
  };

  const activeChips = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    if (filters.query.trim()) out.push({ key: 'query', label: `“${filters.query.trim()}”` });
    if (filters.verticals.length) {
      out.push({ key: 'verticals', label: filters.verticals.map((v) => verticalMeta[v].label).join(', ') });
    }
    if (filters.categories.length) {
      out.push({ key: 'categories', label: filters.categories.join(', ') });
    }
    if (filters.priceTiers.length) {
      out.push({ key: 'priceTiers', label: filters.priceTiers.map((t) => '$'.repeat(t)).join(' ') });
    }
    if (filters.minRating != null) out.push({ key: 'minRating', label: `${filters.minRating}+ stars` });
    if (filters.minVibeRating != null) out.push({ key: 'minVibeRating', label: `${filters.minVibeRating}+ flames` });
    if (filters.openNow) out.push({ key: 'openNow', label: 'Open now' });
    if (filters.openAt) out.push({ key: 'openAt', label: `Open at ${filters.openAt}` });
    if (filters.maxDistanceMi != null) out.push({ key: 'maxDistanceMi', label: `${filters.maxDistanceMi} mi` });
    for (const [k, v] of Object.entries(filters.attributes)) {
      const def = attributeByKey[k];
      const label =
        v === true ? def?.label ?? k : `${def?.label ?? k}: ${formatAttribute(k, v)}`;
      out.push({ key: `attr:${k}`, label });
    }
    return out;
  }, [filters]);

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title="Search"
        subtitle={`Houston · 3 mi default radius · ${venues.length} venues`}
      />

      {source !== 'remote' || backendError ? (
        <View style={gutter()}>
          <BackendBanner />
        </View>
      ) : null}

      {/* Unified search bar with a separate location input (F-SEARCH-01). */}
      <View style={[gutter(), { gap: space.sm }]}>
        <Card padded={false} style={{ paddingHorizontal: space.md, paddingVertical: 4 }}>
          <View style={ui.row}>
            <Ionicons name="search" size={18} color={theme.textFaint} />
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onSubmitEditing={submit}
              returnKeyType="search"
              placeholder="Venue, cuisine, dish, brand, or vibe"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="Search venues, cuisines, dishes, brands"
              style={[
                font.body,
                { flex: 1, color: theme.text, paddingVertical: 12, marginLeft: space.sm, minHeight: 44 },
              ]}
            />
            {text ? (
              <Pressable
                onPress={() => { setText(''); setFilters({ ...filters, query: '' }); setNlNote(null); setActiveVibe(null); }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
              >
                <Ionicons name="close-circle" size={18} color={theme.textFaint} />
              </Pressable>
            ) : null}
          </View>
          <Divider />
          <View style={[ui.row, { paddingVertical: 10 }]}>
            <Ionicons name="location" size={16} color={theme.accent} />
            <Text style={[font.meta, { color: theme.text, marginLeft: space.sm, flex: 1 }]}>
              Downtown Houston, TX (detected)
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Location is fixed for this prototype',
                  'There is no real device location or manual location search wired up — every distance and ' +
                    '"open now" result here is computed against Downtown Houston.',
                )
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Change location"
            >
              <Text style={[font.small, { color: theme.accent }]}>Change</Text>
            </Pressable>
          </View>
        </Card>

        {/* Typeahead: distinct groups per F-SEARCH-02. */}
        {focused && suggestions.length ? (
          <Card padded={false}>
            {(['venue', 'category', 'dish', 'brand'] as const).map((kind) => {
              const group = suggestions.filter((s) => s.kind === kind);
              if (!group.length) return null;
              return (
                <View key={kind}>
                  <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 4 }}>
                    <Label>
                      {kind === 'venue' ? 'Venues' : kind === 'category' ? 'Categories' : kind === 'dish' ? 'Dishes and drinks' : 'Cigar brands'}
                    </Label>
                  </View>
                  {group.map((s, i) => (
                    <Pressable
                      key={`${kind}-${s.label}-${i}`}
                      onPress={() => applySuggestion(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.label}, ${s.detail ?? kind}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: space.lg,
                        paddingVertical: space.sm,
                        minHeight: 44,
                        gap: space.md,
                      }}
                    >
                      <Ionicons
                        name={kind === 'venue' ? 'storefront' : kind === 'category' ? 'pricetags' : kind === 'dish' ? 'restaurant' : 'leaf'}
                        size={16}
                        color={theme.textFaint}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[font.body, { color: theme.text }]} numberOfLines={1}>{s.label}</Text>
                        {s.detail ? (
                          <Text style={[font.small, { color: theme.textDim }]} numberOfLines={1}>{s.detail}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              );
            })}
            <View style={{ height: space.sm }} />
          </Card>
        ) : null}

        {/* Recent searches, readable offline. */}
        {focused && !text && recentSearches.length ? (
          <Card>
            <Label>Recent</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
              {recentSearches.map((q) => (
                <Chip
                  key={q}
                  label={q}
                  onPress={() => {
                    setText(q);
                    setFilters({ ...filters, query: q });
                    setFocused(false);
                    setNlNote(null);
                    setActiveVibe(null);
                  }}
                />
              ))}
            </View>
          </Card>
        ) : null}

        {/* F-SEARCH-12: named vibes are not discoverable by guessing, so they
            get their own row rather than living only in the placeholder text. */}
        {focused && !text ? (
          <Card>
            <Label>Try a vibe</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
              {vibeDefs.map((v) => (
                <Chip key={v.key} label={v.label} icon="sparkles" onPress={() => applyVibe(v)} />
              ))}
            </View>
          </Card>
        ) : null}
      </View>

      {/* Natural-language readback. */}
      {nlNote ? (
        <View style={gutter()}>
          <Card>
            <View style={[ui.row, { gap: space.sm }]}>
              <IconBadge icon="sparkles" size={34} />
              <View style={{ flex: 1 }}>
                <Text style={[font.small, { color: theme.textDim }]}>Read as</Text>
                <Text style={[font.bodyStrong, { color: theme.text }]}>{nlNote.join(' · ')}</Text>
              </View>
              <Pressable onPress={() => setNlNote(null)} hitSlop={10} accessibilityLabel="Dismiss interpretation" accessibilityRole="button">
                <Ionicons name="close" size={18} color={theme.textFaint} />
              </Pressable>
            </View>
          </Card>
        </View>
      ) : null}

      {/* Vibe readback: what evidence backs this ranking, not a rationale for
          any one venue (same spirit as F-REVIEW-07 — the model, not the play
          by play). */}
      {activeVibe ? (
        <View style={gutter()}>
          <Card>
            <View style={[ui.row, { gap: space.sm }]}>
              <IconBadge icon="sparkles" size={34} />
              <View style={{ flex: 1 }}>
                <Text style={[font.small, { color: theme.textDim }]}>Matching the vibe</Text>
                <Text style={[font.bodyStrong, { color: theme.text }]}>{activeVibe.label}</Text>
                <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                  Ranked by what reviews and photos actually show, not by name matching.
                </Text>
              </View>
              <Pressable
                onPress={() => { setActiveVibe(null); setText(''); }}
                hitSlop={10}
                accessibilityLabel="Clear the vibe"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={18} color={theme.textFaint} />
              </Pressable>
            </View>
          </Card>
        </View>
      ) : null}

      {/* Controls: filters, list/map, sort. */}
      <View style={[gutter(), { gap: space.sm }]}>
        <View style={[ui.row, { gap: space.sm }]}>
          <Button
            label={count ? `Filters · ${count}` : 'Filters'}
            icon="options"
            variant={count ? 'primary' : 'onGround'}
            onPress={() => setSheet(true)}
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={() => setMode(mode === 'list' ? 'map' : 'list')}
            accessibilityRole="button"
            accessibilityLabel={mode === 'list' ? 'Show map' : 'Show list'}
            style={{
              minHeight: 44,
              paddingHorizontal: space.lg,
              borderRadius: radius.md,
              backgroundColor: theme.card,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name={mode === 'list' ? 'map' : 'list'} size={18} color={theme.text} />
            <Text style={[font.bodyStrong, { color: theme.text }]}>{mode === 'list' ? 'Map' : 'List'}</Text>
          </Pressable>
        </View>

        {/* Filter summary with per-chip clearing. */}
        {activeChips.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {activeChips.map((c) => (
              <Chip key={c.key} label={c.label} tone="ground" onRemove={() => clearOne(c.key)} />
            ))}
            <Chip label="Clear all" icon="close-circle" tone="ground" onPress={() => { resetFilters(); setText(''); setNlNote(null); setActiveVibe(null); }} />
          </View>
        ) : null}

        {areaLimited ? (
          <View style={[ui.row, { gap: space.sm }]}>
            <Chip label={`Limited to map area (${areaLimited.length})`} tone="ground" onRemove={() => setAreaLimited(null)} />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              tone="ground"
              selected={filters.sort === s.key}
              onPress={() => setFilters({ ...filters, sort: s.key })}
            />
          ))}
        </View>
      </View>

      {/* Results. */}
      <View style={gutter()}>
        <Text style={[font.meta, { color: theme.onGroundDim, marginBottom: space.md }]}>
          {activeVibe
            ? `${search.promoted.length + (vibeResults?.length ?? 0)} results`
            : `${search.results.length} ${search.results.length === 1 ? 'result' : 'results'}`}
          {search.promoted.length ? ` · ${search.promoted.length} paid placement` : ''}
        </Text>

        {mode === 'map' ? (
          <MiniMap
            venues={activeVibe ? [...search.promoted, ...(vibeResults ?? []).map((r) => r.venue)] : search.results}
            onSearchArea={(inBounds) => {
              setAreaLimited(inBounds);
              setMode('list');
            }}
          />
        ) : activeVibe ? (
          <>
            {search.promoted.map((v) => <VenueCard key={v.id} venue={v} />)}
            {vibeResults && vibeResults.length ? (
              vibeResults.map(({ venue, match }) => (
                <View key={venue.id}>
                  <VenueCard venue={venue} />
                  <Text style={[font.small, { color: theme.onGroundFaint, marginTop: -space.sm, marginBottom: space.md, marginLeft: space.sm }]}>
                    {match.evidence.join(' · ')}
                  </Text>
                </View>
              ))
            ) : (
              <Card>
                <Body dim>
                  No venues have enough evidence for “{activeVibe.label}” yet. Try a different vibe, or clear it
                  to see everything the other filters allow.
                </Body>
              </Card>
            )}
          </>
        ) : search.results.length ? (
          search.results.map((v) => <VenueCard key={v.id} venue={v} />)
        ) : null}

        {/* F-SEARCH-10: name the specific filter to drop, do not just say "broaden". */}
        {!activeVibe && mode === 'list' && search.results.length < 3 ? (
          <Card>
            <View style={[ui.row, { gap: space.sm, marginBottom: space.md }]}>
              <IconBadge icon={search.results.length === 0 ? 'search' : 'add-circle'} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={[font.cardTitle, { color: theme.text }]}>
                  {search.results.length === 0 ? 'Nothing matches all of that' : 'Only a few matches'}
                </Text>
                <Text style={[font.small, { color: theme.textDim }]}>
                  Here is exactly what to drop, and what it gets you.
                </Text>
              </View>
            </View>

            {search.relaxations.length ? (
              <View style={{ gap: space.sm }}>
                {search.relaxations.map((r) => (
                  <Pressable
                    key={r.key}
                    onPress={() => clearOne(r.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Drop ${r.label} to see ${r.wouldReturn} venues`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      minHeight: 48,
                      paddingHorizontal: space.md,
                      borderRadius: radius.md,
                      backgroundColor: theme.cardMuted,
                    }}
                  >
                    <Ionicons name="remove-circle" size={18} color={theme.accent} />
                    <Text style={[font.body, { color: theme.text, flex: 1 }]}>
                      Drop {r.label}
                    </Text>
                    <Text style={[font.bodyStrong, { color: theme.accent }]}>{r.wouldReturn}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {filters.maxDistanceMi != null ? (
              <Button
                label={`Widen to ${filters.maxDistanceMi * 2} miles`}
                icon="resize"
                variant="secondary"
                full
                style={{ marginTop: space.md }}
                onPress={() => setFilters({ ...filters, maxDistanceMi: filters.maxDistanceMi! * 2 })}
              />
            ) : null}

            {search.adjacentCategories.length ? (
              <View style={{ marginTop: space.lg }}>
                <Label>Adjacent categories that do have matches</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
                  {search.adjacentCategories.map((v: Vertical) => (
                    <Chip
                      key={v}
                      label={verticalMeta[v].plural}
                      onPress={() => setFilters({ ...filters, verticals: [v], attributes: {}, categories: [] })}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {activeChips.length === 0 ? (
              <Body dim style={{ marginTop: space.md }}>
                No filters are active, so this is the whole seeded database. Try a search term.
              </Body>
            ) : null}
          </Card>
        ) : null}
      </View>

      <FilterSheet visible={sheet} onClose={() => setSheet(false)} />
    </Screen>
  );
}

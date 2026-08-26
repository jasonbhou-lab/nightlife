import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PhotoTile } from '@/components/PhotoTile';
import { StarInput } from '@/components/Stars';
import {
  Body, Button, Callout, Card, Chip, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
  SectionHeader, styles as ui,
} from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { uploadPhoto } from '@/data/repository';
import { pickPhoto } from '@/lib/media';
import { subRatingDimensions, tagVocabulary } from '@/lib/ratings';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';
import type { Photo, Review, SubRatingKey, Vertical } from '@/types';

/** F-MEDIA-01: a sensible default album per vertical; the venue's own Photos
 * section lets anyone re-file a photo into a different album later. */
const defaultAlbumFor: Record<Vertical, Photo['album']> = {
  dining: 'food',
  bar: 'drink',
  lounge: 'drink',
  cigar: 'humidor',
  nightclub: 'crowd',
};

const MIN_CHARS = 60;

/**
 * Review composer.
 *
 * F-REVIEW-01 requires a whole-star rating plus text above a character floor.
 * F-REVIEW-02 makes the sub-rating dimensions category-specific — a bar is rated
 * on pour value and noise, a cigar lounge on ventilation and staff knowledge.
 * F-REVIEW-03 collects structured tags, which are optional but are what makes
 * "no wait at 8 PM on a Saturday" filterable later.
 * U-09 autosaves the draft, so closing the app mid-review does not lose it.
 */
export default function NewReviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { drafts, saveDraft, clearDraft, now, session } = useApp();
  const { getVenue, addLocalPhoto } = useCatalogue();

  const venue = getVenue(id);
  const existing = id ? drafts[id] : undefined;

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [subs, setSubs] = useState<Partial<Record<SubRatingKey, number>>>(existing?.subRatings ?? {});
  const [text, setText] = useState(existing?.text ?? '');
  const [tags, setTags] = useState<Review['tags']>(existing?.tags ?? {});
  // Resuming a draft cannot recover which actual photos were added in an
  // earlier session — only the count was ever saved. It starts empty; the
  // count itself still round-trips through the draft below.
  const [attachedPhotos, setAttachedPhotos] = useState<Photo[]>([]);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [comped, setComped] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(existing?.savedAt ?? null);
  const [submitted, setSubmitted] = useState(false);

  const dims = venue ? subRatingDimensions[venue.primary.vertical] : [];
  const photoCount = attachedPhotos.length || existing?.photoCount || 0;

  // Autosave with a short debounce.
  useEffect(() => {
    if (!venue || submitted) return;
    if (!rating && !text && Object.keys(subs).length === 0) return;
    const t = setTimeout(() => {
      const stamp = new Date().toISOString();
      saveDraft({ venueId: venue.id, rating, subRatings: subs, text, tags, photoCount, savedAt: stamp });
      setSavedAt(stamp);
    }, 900);
    return () => clearTimeout(t);
  }, [rating, subs, text, tags, photoCount, venue, saveDraft, submitted]);

  const addPhoto = async (source: 'library' | 'camera') => {
    if (!venue) return;
    setAddingPhoto(true);
    try {
      const picked = await pickPhoto(source);
      if (!picked) return;
      const result = await uploadPhoto({
        venueId: venue.id,
        album: defaultAlbumFor[venue.primary.vertical],
        localUri: picked.uri,
      });
      if (!result.ok) {
        Alert.alert('Could not upload', result.error);
        return;
      }
      addLocalPhoto(venue.id, result.photo);
      setAttachedPhotos((prev) => [...prev, result.photo]);
    } catch {
      Alert.alert('Could not open the picker', 'Check that camera or photo permissions are allowed for this app.');
    } finally {
      setAddingPhoto(false);
    }
  };

  const remaining = Math.max(0, MIN_CHARS - text.trim().length);
  const canSubmit = rating > 0 && remaining === 0;

  const tagCount = useMemo(() => Object.values(tags).filter((v) => v != null).length, [tags]);

  if (!venue) {
    return (
      <Screen>
        <ScreenHeader title="Write a review" onBack={() => router.back()} />
      </Screen>
    );
  }

  // F-TRUST-04 / R12: a courtesy copy of the same freeze the database itself
  // enforces on the insert — see reviews_insert_own in
  // 20260826110000_add_trust_and_safety.sql.
  if (venue.contributionFrozen) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Write a review" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Callout tone="warn" icon="snow" title="New reviews are paused here">
            <Body dim>Trust &amp; Safety has temporarily frozen new contributions at this listing.</Body>
          </Callout>
        </View>
      </Screen>
    );
  }

  if (submitted) {
    return (
      <Screen contentStyle={{ gap: space.lg }}>
        <ScreenHeader title="Submitted" subtitle={venue.name} onBack={() => router.back()} />
        <View style={gutter()}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="checkmark-circle" size={56} variant="solid" />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>Published</Text>
              <Body dim style={{ textAlign: 'center' }}>
                Your review is live. It may be re-evaluated by the recommendation software at any
                time, which can move it out of the rating without removing it.
              </Body>
              {session.role === 'elite' ? (
                <Text style={[font.small, { color: theme.accent }]}>
                  Elite status shortens pre-publication review latency.
                </Text>
              ) : null}
            </View>
          </Card>
        </View>
        <View style={gutter()}>
          <Button label="Back to the venue" full onPress={() => router.replace(`/venue/${venue.id}`)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title="Write a review"
        subtitle={venue.name}
        onBack={() => router.back()}
        right={
          savedAt ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[font.small, { color: theme.onGroundDim }]}>Draft saved</Text>
              <Text style={[font.small, { color: theme.onGroundFaint }]}>
                {new Date(savedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </View>
          ) : undefined
        }
      />

      {existing ? (
        <View style={gutter()}>
          <Callout tone="info" icon="document-text" title="Resumed from your saved draft" />
        </View>
      ) : null}

      <View style={gutter()}>
        <Card>
          <Label>Overall</Label>
          <View style={{ marginTop: space.md, alignItems: 'center' }}>
            <StarInput value={rating} onChange={setRating} size={36} />
            <Text style={[font.meta, { color: theme.textDim, marginTop: space.sm }]}>
              {rating === 0
                ? 'Tap to rate'
                : ['Bad', 'Poor', 'Okay', 'Good', 'Great'][rating - 1]}
            </Text>
          </View>
        </Card>
      </View>

      {/* Category-specific sub-ratings. */}
      <View style={gutter()}>
        <SectionHeader
          title="Rate the specifics"
          subtitle={`Optional, and specific to ${venue.primary.vertical === 'cigar' ? 'cigar lounges' : `${venue.primary.vertical}s`}`}
        />
        <Card style={{ gap: space.lg }}>
          {dims.map((d) => (
            <StarInput
              key={d.key}
              label={d.label}
              size={24}
              value={subs[d.key] ?? 0}
              onChange={(v) => setSubs({ ...subs, [d.key]: v })}
            />
          ))}
        </Card>
      </View>

      {/* Free text with the floor stated as remaining, not as a rule. */}
      <View style={gutter()}>
        <SectionHeader title="What happened" />
        <Card>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder={placeholderFor(venue.primary.vertical)}
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Review text"
            style={[
              font.body,
              {
                color: theme.text,
                backgroundColor: theme.cardMuted,
                borderRadius: radius.md,
                padding: space.md,
                minHeight: 160,
                textAlignVertical: 'top',
                lineHeight: 22,
              },
            ]}
          />
          <View style={[ui.row, { marginTop: space.sm }]}>
            <Text style={[font.small, { color: remaining ? theme.warn : theme.open, flex: 1 }]}>
              {remaining ? `${remaining} more characters needed` : 'Long enough to be useful'}
            </Text>
            <Text style={[font.small, { color: theme.textFaint }]}>{text.trim().length}</Text>
          </View>
          <Text style={[font.small, { color: theme.textFaint, marginTop: space.sm, lineHeight: 16 }]}>
            Detail counts for more in the rating than a line of praise does. Specifics — the wait, the
            hour, what you paid, whether the kitchen was still open — are what other people use.
          </Text>
        </Card>
      </View>

      {/* Structured tags: optional but incentivized, since they power filtering. */}
      <View style={gutter()}>
        <SectionHeader
          title="Add the details"
          subtitle={`${tagCount} added · these become filters for everyone else`}
        />
        <Card style={{ gap: space.lg }}>
          <TagRow
            label="Occasion"
            options={tagVocabulary.occasion}
            value={tags.occasion}
            onChange={(v) => setTags({ ...tags, occasion: v })}
          />
          <Divider />
          <View>
            <Label>Party size</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
              {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                <Chip
                  key={n}
                  label={`${n}`}
                  selected={tags.partySize === n}
                  onPress={() => setTags({ ...tags, partySize: tags.partySize === n ? undefined : n })}
                />
              ))}
            </View>
          </View>
          <Divider />
          <TagRow
            label="Time of visit"
            options={tagVocabulary.timeOfVisit}
            value={tags.timeOfVisit}
            onChange={(v) => setTags({ ...tags, timeOfVisit: v })}
          />
          <Divider />
          <View>
            <Label>Wait</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
              {tagVocabulary.waitMinutes.map((n) => (
                <Chip
                  key={n}
                  label={n === 0 ? 'None' : `${n} min`}
                  selected={tags.waitMinutes === n}
                  onPress={() => setTags({ ...tags, waitMinutes: tags.waitMinutes === n ? undefined : n })}
                />
              ))}
            </View>
          </View>
          {(venue.primary.vertical === 'nightclub' || venue.primary.vertical === 'lounge') ? (
            <>
              <Divider />
              <View>
                <Label>Cover paid</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
                  {[0, 10, 15, 20, 30, 40].map((n) => (
                    <Chip
                      key={n}
                      label={n === 0 ? 'None' : `$${n}`}
                      selected={tags.coverPaid === n}
                      onPress={() => setTags({ ...tags, coverPaid: tags.coverPaid === n ? undefined : n })}
                    />
                  ))}
                </View>
                <Text style={[font.small, { color: theme.textFaint, marginTop: space.sm }]}>
                  This is how cover charge stays current. Owner-published cover expires after 14 days
                  and reports like yours are what refresh it.
                </Text>
              </View>
            </>
          ) : null}
          <Divider />
          <TagRow
            label="Spend"
            options={tagVocabulary.spendRange}
            value={tags.spendRange}
            onChange={(v) => setTags({ ...tags, spendRange: v })}
          />
        </Card>
      </View>

      {/* Real upload (F-MEDIA-01), not the old count-only stepper. Each photo
          posts straight to the venue's public gallery as you add it — this
          composer doesn't hold a draft of the images the way it does the
          text, since there is nowhere unpublished to hold them. */}
      <View style={gutter()}>
        <SectionHeader title="Photos" subtitle="Posted to the gallery as you add them" />
        <Card>
          {attachedPhotos.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
              <View style={[ui.row, { gap: space.sm }]}>
                {attachedPhotos.map((p) => (
                  <PhotoTile key={p.id} photo={p} width={90} height={90} showMeta={false} />
                ))}
              </View>
            </ScrollView>
          ) : null}
          <View style={[ui.row, { gap: space.md }]}>
            <IconBadge icon="camera" size={44} />
            <View style={{ flex: 1 }}>
              <Text style={[font.bodyStrong, { color: theme.text }]}>
                {attachedPhotos.length ? `${attachedPhotos.length} added` : 'Add photos'}
              </Text>
              <Text style={[font.small, { color: theme.textDim }]}>
                Location and device metadata are stripped before upload. Remove one later from the
                venue's Photos section if you change your mind.
              </Text>
            </View>
          </View>
          <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
            <Button label="Camera" icon="camera" variant="secondary" loading={addingPhoto} onPress={() => addPhoto('camera')} />
            <Button label="Library" icon="images" variant="secondary" loading={addingPhoto} onPress={() => addPhoto('library')} />
          </View>
        </Card>
      </View>

      {/* Comped disclosure — required, not optional, when it applies. */}
      <View style={gutter()}>
        <Card>
          <Pressable
            onPress={() => setComped((c) => !c)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: comped }}
            accessibilityLabel="This visit was comped or hosted"
            style={[ui.row, { gap: space.md, minHeight: 44 }]}
          >
            <Ionicons name={comped ? 'checkbox' : 'square-outline'} size={22} color={comped ? theme.accent : theme.textFaint} />
            <View style={{ flex: 1 }}>
              <Text style={[font.body, { color: theme.text }]}>
                This visit was comped, hosted, or discounted
              </Text>
              <Text style={[font.small, { color: theme.textFaint, marginTop: 2 }]}>
                Disclosure is required and shows as a badge on your review. Paid reviews are
                prohibited outright.
              </Text>
            </View>
          </Pressable>
        </Card>
      </View>

      {/* Conflict-of-interest notice, enforced server-side. */}
      <View style={gutter()}>
        <Callout tone="info" icon="shield-checkmark" title="Conflict of interest">
          <Body dim>
            You cannot review a venue where your account holds a business role, or a competitor in the
            same category and radius. This is checked on submission, not on the honor system.
          </Body>
        </Callout>
      </View>

      <View style={[gutter(), { gap: space.sm }]}>
        <Button
          label={canSubmit ? 'Publish review' : rating === 0 ? 'Rate it first' : `${remaining} characters to go`}
          full
          disabled={!canSubmit}
          onPress={() => {
            clearDraft(venue.id);
            setSubmitted(true);
          }}
        />
        <Button
          label="Save and finish later"
          variant="ghost"
          full
          onPress={() => {
            saveDraft({
              venueId: venue.id,
              rating,
              subRatings: subs,
              text,
              tags,
              photoCount,
              savedAt: new Date().toISOString(),
            });
            router.back();
          }}
        />
        <Button
          label="Discard"
          variant="ghost"
          full
          onPress={() =>
            Alert.alert(
              'Discard this review?',
              'Your rating, text, and tags for this venue will be deleted. This cannot be undone.',
              [
                { text: 'Keep writing', style: 'cancel' },
                {
                  text: 'Discard',
                  style: 'destructive',
                  onPress: () => {
                    clearDraft(venue.id);
                    router.back();
                  },
                },
              ],
            )
          }
        />
        <Text style={[font.small, { color: theme.onGroundFaint, textAlign: 'center', marginTop: space.sm }]}>
          Drafts are stored on this device and survive closing the app. Signed in on another device,
          they would follow you. Nothing here is actually published in the prototype.
        </Text>
      </View>
      <View style={{ height: space.xxxl }} />
    </Screen>
  );
}

function TagRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <View>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
        {options.map((o) => (
          <Chip key={o} label={o} selected={value === o} onPress={() => onChange(value === o ? undefined : o)} />
        ))}
      </View>
    </View>
  );
}

function placeholderFor(vertical: string): string {
  switch (vertical) {
    case 'bar':
      return 'What was on tap, how loud it got, whether you could get a seat, whether the kitchen was still open…';
    case 'cigar':
      return 'What was in the humidor, how the ventilation held up, the seating, what the staff knew…';
    case 'nightclub':
      return 'The door, the wait, the music, what the table minimum actually cost you…';
    case 'lounge':
      return 'The cover, the service pace, whether you could hear each other, the seating…';
    default:
      return 'What you ate, the service, the noise, whether the wait matched the estimate…';
  }
}

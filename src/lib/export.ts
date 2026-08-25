import { Platform, Share } from 'react-native';

import type { Review, Venue } from '@/types';

/**
 * F-BIZ-15 (scoped): a business exports its own venue's data as JSON.
 * Deliberately not included: "analytics" (the PRD's own wording) — there is
 * no page-view/impression tracking anywhere in this build to export, the
 * same honesty gap as F-BIZ-08. Team roster and sent invites are left out
 * too: the client can only ever see the invites *this* signed-in account
 * sent (`business_invites_select`'s RLS), so a multi-manager venue would
 * export a silently incomplete team list — worse than not including it.
 *
 * All of this data is already public (reviews and photos are readable by
 * anyone); this is a packaging convenience for the business, not a new
 * access grant.
 */
export function buildVenueExport(venue: Venue, reviews: Review[]) {
  return {
    exportedAt: new Date().toISOString(),
    venue: {
      id: venue.id,
      name: venue.name,
      tagline: venue.tagline,
      about: venue.about,
      address: venue.address,
      phone: venue.phone,
      website: venue.website ?? null,
      schedules: venue.schedules,
      happyHours: venue.happyHours ?? [],
      menus: venue.menus,
      attributes: venue.attributes,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      subRatings: r.subRatings,
      text: r.text,
      date: r.date,
      tags: r.tags,
      recommended: r.recommended,
      comped: r.comped ?? false,
      ownerResponse: r.ownerResponse ?? null,
    })),
    photos: venue.photos.map((p) => ({
      id: p.id,
      album: p.album,
      caption: p.caption,
      by: p.by,
      alt: p.alt,
      uri: p.uri ?? null,
      removalRequested: p.removalRequested ?? false,
    })),
  };
}

/**
 * Web gets a real file download. Native gets the OS share sheet with the
 * JSON as text — there is no file-download API to reach for without a new
 * dependency, and the PRD itself makes web the primary surface for the
 * business portal.
 */
export async function exportVenueData(venue: Venue, reviews: Review[]): Promise<void> {
  const payload = buildVenueExport(venue, reviews);
  const json = JSON.stringify(payload, null, 2);
  const filename = `${venue.id}-nightout-export.json`;

  if (Platform.OS === 'web') {
    // React Native's own ambient types (Blob, no `document` at all) shadow
    // the real DOM ones here, even though this only ever executes inside an
    // actual browser at runtime — react-native-web doesn't reimplement these,
    // it runs on the real thing. `globalThis as any` reaches past the
    // mismatched types rather than fighting them.
    const w = globalThis as any;
    const blob = new w.Blob([json], { type: 'application/json' });
    const url = w.URL.createObjectURL(blob);
    const a = w.document.createElement('a');
    a.href = url;
    a.download = filename;
    w.document.body.appendChild(a);
    a.click();
    w.document.body.removeChild(a);
    w.URL.revokeObjectURL(url);
    return;
  }

  await Share.share({ message: json, title: filename });
}

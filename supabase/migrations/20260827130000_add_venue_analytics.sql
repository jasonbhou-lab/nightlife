-- F-BIZ-08 (scoped): profile views, click-throughs by action, traffic by
-- daypart, rating trend, and a category/neighborhood rating benchmark.
--
-- Cut from the full PRD requirement: search impressions and the search
-- terms driving them (would mean instrumenting the discovery/search
-- surfaces — the home feed, filter results, "Tonight" — a materially
-- larger and more invasive change than this venue-detail-page slice, and
-- a reasonable next slice on its own, not this one); a real conversion
-- funnel beyond view-to-click (there is no impression stage to fund it
-- without the above); click-throughs for "website" (no website link is
-- rendered anywhere in this app yet — a separate, pre-existing gap, not
-- something this migration quietly fixes on the side) or "order" (F-ORDER
-- stays deferred); and view-count competitor benchmarking (that would need
-- a SECURITY DEFINER aggregate crossing into other venues' private event
-- data — a new trust boundary not worth adding for a first version when a
-- rating benchmark, computed from data that is already public on the
-- venues table, satisfies the same PRD line honestly).
--
-- No actor is captured here — not user_id, not a device fingerprint, not
-- even for a signed-in account — so there is nothing to dedupe or
-- rate-limit against without inventing session-tracking infrastructure
-- this build does not have. A business account refreshing its own listing
-- inflates its own view count; that is a known, accepted limitation, the
-- same honesty this build already applies to other simple counters.

create type venue_event_kind as enum ('view', 'click_call', 'click_directions', 'click_book');

create table venue_events (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  kind venue_event_kind not null,
  created_at timestamptz not null default now()
);

create index venue_events_venue_created_idx on venue_events (venue_id, created_at desc);

alter table venue_events enable row level security;

-- Anyone can log an event for a real venue — no more standing is needed
-- here than filing a photo removal request or a review report already
-- requires none of either. The foreign key is what keeps venue_id honest.
create policy venue_events_insert_any on venue_events
  for insert to anon, authenticated
  with check (true);

-- Only a business role holder at the venue can read its own raw events.
-- The dashboard aggregates them client-side — the same pattern
-- src/lib/ratings.ts's aggregateFor already uses for reviews, rather than
-- a server-side rollup table this build has no need for yet.
create policy venue_events_business_read on venue_events
  for select to authenticated
  using (private.holds_business_role(venue_id));

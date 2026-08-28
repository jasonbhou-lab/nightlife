-- F-BIZ-10, scoped: a business schedules a paid placement for its own venue,
-- rather than a platform admin flipping a bare `venues.promoted` switch by
-- hand (which is all the previous implementation actually was -- a static
-- boolean with no purchase, no schedule, and no way for it to ever turn
-- itself off). That column is dropped below in favor of a real table with a
-- lifecycle, the same shift F-BIZ-09 already made for offers versus a
-- jsonb-diff venue-write guard.
--
-- What's real: budget tier and date range (a campaign is only a paid
-- placement within its own `starts_on`/`ends_on`), and daypart targeting
-- (F-BIZ-08 already buckets traffic into morning/afternoon/evening/late
-- night; a campaign can restrict itself to a subset of those, checked
-- against the clock at read time -- see src/lib/advertising.ts). Both are
-- computed client-side against `now`, the same pattern `venueState` and
-- happy-hour windows already use, because there is no scheduler in this
-- build that could flip a stored flag the moment a date or hour boundary
-- passes.
--
-- What's collected but not enforced: geography (`target_neighborhoods`) and
-- category targeting. A venue's own neighborhood and category already
-- determine which searches it can appear in at all, and this build has no
-- per-request geo/category ad-serving engine to narrow that further, so
-- these are stored and shown back to the business rather than silently
-- dropped, but do not change ranking or visibility.
--
-- What's not built at all: real payment capture. `budget_tier` is a
-- published flat price shown before submission and nothing more -- the same
-- disclosed-not-charged treatment F-BOOK-11's deposit terms already get.
-- Creative management is scoped to one optional headline override, not new
-- asset upload -- F-BIZ-06's existing photo management already covers a
-- venue's images.

create type ad_daypart as enum ('morning', 'afternoon', 'evening', 'late_night');
create type ad_budget_tier as enum ('starter', 'growth', 'spotlight');

create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  budget_tier ad_budget_tier not null,
  -- Informational only -- see header. Null/empty means "citywide" / "no daypart restriction".
  target_neighborhoods text[],
  target_dayparts ad_daypart[],
  headline text,
  -- Nullable, same reason reviews.author_id is: the two seed campaigns below
  -- predate any real account. A real submission always sets its own id here
  -- (enforced by the insert policy), so null only ever appears on seed rows.
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ad_campaigns_venue on ad_campaigns (venue_id);

alter table ad_campaigns enable row level security;

-- Public read, same as venues/reviews/photos/offers -- a paid placement only
-- works if every browsing guest can see it, not just the business that
-- bought it.
create policy ad_campaigns_public_read on ad_campaigns
  for select to anon, authenticated using (true);

create policy ad_campaigns_insert on ad_campaigns
  for insert to authenticated
  with check (created_by = auth.uid() and private.holds_business_role(venue_id));

-- No update policy: a campaign is immutable once created, the same
-- append-only shape as a booking or a claim rather than a form a business
-- can quietly rewrite after the fact.
--
-- Delete is only a cancellation of a campaign that has not started yet --
-- once it starts, its own performance history should not be erasable.
create policy ad_campaigns_delete_upcoming on ad_campaigns
  for delete to authenticated
  using (private.holds_business_role(venue_id) and starts_on > current_date);

-- The venues.promoted boolean this replaces was a static, unscheduled flag
-- with no business-facing write path at all in the end -- nothing in this
-- build ever set it except the seed. Two seed venues carried it; they are
-- reseeded below as real campaigns instead so existing demo behavior does
-- not silently disappear.
alter table venues drop column promoted;

insert into ad_campaigns (venue_id, starts_on, ends_on, budget_tier, target_dayparts, headline)
values (
  'kirby3', date '2026-08-01', date '2026-12-31', 'growth'::ad_budget_tier,
  array['evening', 'late_night']::ad_daypart[],
  'Reserve your booth for kickoff -- Texans and Astros on every screen.'
);

insert into ad_campaigns (venue_id, starts_on, ends_on, budget_tier, target_neighborhoods, target_dayparts, headline)
values (
  'zafeera', date '2026-08-01', date '2026-12-31', 'spotlight'::ad_budget_tier,
  array['Westchase', 'Montrose', 'Downtown'],
  array['late_night']::ad_daypart[],
  '46 shisha flavors. No cover before 11.'
);

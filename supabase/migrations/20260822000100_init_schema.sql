-- NightOut initial schema.
--
-- Modelling decision worth stating up front, because it is the one thing here
-- that is a genuine tradeoff rather than a mechanical translation:
--
-- Venue *documents* (schedules, menus, photos, Q&A, attributes) are stored as
-- jsonb on the venue row, because they are always read as a whole venue and
-- never queried independently. Things that are written or queried on their own
-- -- reviews, bookings, collections, events, table tiers -- get real tables
-- with real foreign keys and row-level security.
--
-- The PRD (3.3) requires attributes to be filterable, not just displayable.
-- jsonb does not give that up: containment filters are served by a GIN index,
-- and the numeric comparisons the filter sheet actually issues (tap count,
-- humidor size, cover ceiling) are served by the expression indexes below. The
-- attribute *registry* stays in the client (src/data/attributes.ts) as the
-- schema of record, which is what keeps one declaration driving the filter
-- sheet, the profile panel, and staleness expiry. The alternative -- ~100 typed
-- columns, most null for any given vertical -- buys stricter typing at the cost
-- of a migration every time a vertical gains an attribute.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type vertical as enum ('dining', 'bar', 'lounge', 'cigar', 'nightclub');

create type provenance as enum ('owner', 'community', 'provider', 'operator_verified');

create type booking_mode as enum (
  'reservation', 'table_service', 'waitlist', 'bar_hold', 'inquiry', 'walk_in'
);

create type booking_status as enum ('confirmed', 'requested', 'waitlisted', 'cancelled');

create type closure_state as enum ('temporary', 'permanent', 'moved', 'seasonal');

-- Business-side roles exist here only to enforce the conflict-of-interest rule
-- in F-TRUST-06. The business portal itself is out of scope for this client.
create type business_role as enum ('owner', 'manager', 'staff', 'group_admin');

-- ---------------------------------------------------------------- profiles

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  -- R3: reviewing and booking require a confirmed phone and age verification.
  phone_verified boolean not null default false,
  age_verified boolean not null default false,
  -- R4: earned status, not self-assigned.
  elite boolean not null default false,
  -- Feeds review weighting (F-REVIEW-08).
  trust numeric(3,2) not null default 0.50 check (trust >= 0 and trust <= 1),
  visibility text not null default 'public'
    check (visibility in ('public', 'followers', 'private')),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on column profiles.trust is
  'Reviewer trust signal. Server-maintained; never writable by the client.';

-- ---------------------------------------------------------------- venues

create table venues (
  id text primary key,
  name text not null,
  alternate_names text[] not null default '{}',
  primary_vertical vertical not null,
  primary_category text not null,
  -- Up to four secondary categories (PRD 3.1), each {vertical, category}.
  secondary jsonb not null default '[]'::jsonb,
  price_tier smallint not null check (price_tier between 1 and 4),
  neighborhood text not null,
  address text not null,
  lat double precision,
  lng double precision,
  -- Normalized map position for the schematic map view.
  map_x double precision,
  map_y double precision,
  phone text,
  website text,
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0,
  claimed boolean not null default false,
  verified boolean not null default false,
  opened_year integer,
  closure_state closure_state,
  closure_note text,
  closure_successor_id text references venues(id) on delete set null,
  -- F-PROFILE-11. Writable only by Trust & Safety, never by sales or the owner.
  consumer_alert text,
  -- Paid placement. Labeled at every breakpoint on the client (F-SEARCH-09).
  promoted boolean not null default false,
  tagline text,
  about text,
  attributes jsonb not null default '{}'::jsonb,
  -- Per-attribute {source, updatedAt}; falls back to default_meta.
  attribute_meta jsonb not null default '{}'::jsonb,
  default_source provenance not null default 'provider',
  default_updated_at date not null default current_date,
  schedules jsonb not null default '[]'::jsonb,
  happy_hours jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  menus jsonb not null default '[]'::jsonb,
  qa jsonb not null default '[]'::jsonb,
  sub_rating_averages jsonb not null default '{}'::jsonb,
  busyness jsonb not null default '{}'::jsonb,
  booking_modes booking_mode[] not null default '{}',
  booking_terms text,
  search_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Attribute containment: powers every boolean and enum filter in the sheet.
create index venues_attributes_gin on venues using gin (attributes jsonb_path_ops);

-- Numeric attribute filters the sheet actually issues, as expression indexes.
create index venues_tap_count on venues (((attributes->>'tapCount')::int))
  where attributes ? 'tapCount';
create index venues_cover_charge on venues (((attributes->>'coverCharge')::numeric))
  where attributes ? 'coverCharge';
create index venues_bottle_minimum on venues (((attributes->>'bottleMinimum')::numeric))
  where attributes ? 'bottleMinimum';
create index venues_humidor_sqft on venues (((attributes->>'humidorSqFt')::int))
  where attributes ? 'humidorSqFt';
create index venues_whiskey_count on venues (((attributes->>'whiskeyCount')::int))
  where attributes ? 'whiskeyCount';

create index venues_primary_vertical on venues (primary_vertical);
create index venues_neighborhood on venues (neighborhood);
create index venues_rating on venues (rating desc);
create index venues_price_tier on venues (price_tier);
-- Permanently closed listings stay reachable by name but must not rank in a browse.
create index venues_browsable on venues (rating desc) where closure_state is null;

-- Free-text search across name, categories, tagline, and neighborhood.
create index venues_search on venues using gin (to_tsvector('english', coalesce(search_text, '')));

-- ---------------------------------------------------- venue_categories

-- Flattened primary + secondary categories, so "every venue carrying the bar
-- vertical" is an indexed join rather than a jsonb scan. Maintained by trigger.
create table venue_categories (
  venue_id text not null references venues(id) on delete cascade,
  vertical vertical not null,
  category text not null,
  is_primary boolean not null default false,
  primary key (venue_id, vertical, category)
);

create index venue_categories_vertical on venue_categories (vertical);

create or replace function sync_venue_categories() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  delete from venue_categories where venue_id = new.id;

  insert into venue_categories (venue_id, vertical, category, is_primary)
  values (new.id, new.primary_vertical, new.primary_category, true)
  on conflict do nothing;

  for item in select * from jsonb_array_elements(coalesce(new.secondary, '[]'::jsonb))
  loop
    insert into venue_categories (venue_id, vertical, category, is_primary)
    values (new.id, (item->>'vertical')::vertical, item->>'category', false)
    on conflict do nothing;
  end loop;

  return new;
end;
$$;

create trigger venues_sync_categories
  after insert or update of primary_vertical, primary_category, secondary on venues
  for each row execute function sync_venue_categories();

-- Keep search_text and updated_at in step with the row.
create or replace function venues_before_write() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.search_text := concat_ws(' ',
    new.name,
    array_to_string(new.alternate_names, ' '),
    new.primary_category,
    new.neighborhood,
    new.tagline,
    (select string_agg(s->>'category', ' ')
       from jsonb_array_elements(coalesce(new.secondary, '[]'::jsonb)) s)
  );
  return new;
end;
$$;

create trigger venues_before_write_trg
  before insert or update on venues
  for each row execute function venues_before_write();

-- ---------------------------------------------------------- table tiers

create table table_tiers (
  id text primary key,
  venue_id text not null references venues(id) on delete cascade,
  name text not null,
  section text not null,
  minimum_spend integer not null check (minimum_spend >= 0),
  seats smallint not null check (seats > 0),
  x double precision not null,
  y double precision not null,
  available boolean not null default true
);

create index table_tiers_venue on table_tiers (venue_id);

-- --------------------------------------------------------------- events

create table events (
  id text primary key,
  venue_id text not null references venues(id) on delete cascade,
  title text not null,
  -- Recurring weekly programming is first-class (F-EVENT-05): a weekday, not a
  -- stack of one-off dates. One-offs carry event_date instead.
  recurring boolean not null default false,
  weekday smallint check (weekday between 0 and 6),
  event_date date,
  start_time time not null,
  end_time time not null,
  genre text,
  lineup text[] not null default '{}',
  cover integer,
  age_policy text,
  description text,
  ticket_url text,
  created_at timestamptz not null default now(),
  constraint events_recurrence_shape check (
    (recurring and weekday is not null and event_date is null)
    or (not recurring and event_date is not null)
  )
);

create index events_venue on events (venue_id);
create index events_weekday on events (weekday) where recurring;
create index events_date on events (event_date) where not recurring;

-- -------------------------------------------------------------- reviews

create table reviews (
  id uuid primary key default gen_random_uuid(),
  -- Stable natural key for seeded and provider-ingested rows, so re-running an
  -- import upserts instead of duplicating. Null for reviews written in-app.
  seed_key text unique,
  venue_id text not null references venues(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  -- Denormalized so seeded and deleted-author reviews still render.
  author_name text not null,
  author_trust numeric(3,2) not null default 0.50,
  elite boolean not null default false,
  rating smallint not null check (rating between 1 and 5),
  sub_ratings jsonb not null default '{}'::jsonb,
  -- No length CHECK here on purpose. F-REVIEW-01's character floor is a rule
  -- about *submissions*, enforced in the trigger below for client inserts. As a
  -- table constraint it would make the corpus unable to hold the low-effort
  -- spam that the recommendation software exists to catch, and unable to ingest
  -- historical rows from a provider feed.
  body text not null,
  visited_on date,
  created_at timestamptz not null default now(),
  edited boolean not null default false,
  helpful integer not null default 0,
  insightful integer not null default 0,
  funny integer not null default 0,
  tags jsonb not null default '{}'::jsonb,
  photo_count integer not null default 0,
  -- F-REVIEW-12: comped or hosted visits must be disclosed.
  comped boolean not null default false,
  -- F-REVIEW-07. Set by the recommendation software, never by the author.
  -- The reason is deliberately not stored in a client-readable column: exposing
  -- it would be a roadmap for working around the filter.
  recommended boolean not null default true,
  owner_response text,
  owner_response_at timestamptz
);

create index reviews_venue_recommended on reviews (venue_id, created_at desc)
  where recommended;
create index reviews_venue_all on reviews (venue_id, created_at desc);
create index reviews_author on reviews (author_id);
-- One review per person per venue; edits update in place (F-REVIEW-05).
create unique index reviews_one_per_author_venue on reviews (venue_id, author_id)
  where author_id is not null;

-- ------------------------------------------------------- business roles

-- Present only to enforce F-TRUST-06 server-side. NFR-07: RBAC is enforced in
-- the database, and client-side gating is presentation only.
create table business_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  venue_id text not null references venues(id) on delete cascade,
  role business_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

-- ------------------------------------------------------------- bookings

create table bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  venue_id text not null references venues(id) on delete cascade,
  kind booking_mode not null,
  booking_date date not null,
  booking_time time not null,
  party_size smallint not null check (party_size > 0),
  tier text,
  -- Recorded for display only. No card data ever touches this database; that
  -- stays with a PCI DSS compliant processor (NFR-05).
  deposit integer check (deposit >= 0),
  status booking_status not null default 'confirmed',
  notes text,
  waitlist_position integer,
  wait_minutes integer,
  -- F-BOOK-11: affirmative acceptance of deposit and cancellation terms,
  -- captured with the text that was actually shown.
  terms_accepted_at timestamptz,
  terms_text text,
  created_at timestamptz not null default now(),
  constraint bookings_deposit_needs_terms check (
    deposit is null or deposit = 0 or terms_accepted_at is not null
  )
);

create index bookings_user on bookings (user_id, created_at desc);
create index bookings_venue on bookings (venue_id, booking_date);

-- ---------------------------------------------------------- collections

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  -- F-SOCIAL-03: private by default, shared by link when the owner chooses.
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

create table collection_venues (
  collection_id uuid not null references collections(id) on delete cascade,
  venue_id text not null references venues(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, venue_id)
);

create index collections_user on collections (user_id);

-- -------------------------------------------------------- review drafts

-- U-09: drafts autosave and resume across sessions and devices. Server-side so
-- they follow the account, not just the device.
create table review_drafts (
  user_id uuid not null references profiles(id) on delete cascade,
  venue_id text not null references venues(id) on delete cascade,
  rating smallint,
  sub_ratings jsonb not null default '{}'::jsonb,
  body text,
  tags jsonb not null default '{}'::jsonb,
  photo_count integer not null default 0,
  saved_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

-- ===================================================== row level security

alter table profiles          enable row level security;
alter table venues            enable row level security;
alter table venue_categories  enable row level security;
alter table table_tiers       enable row level security;
alter table events            enable row level security;
alter table reviews           enable row level security;
alter table business_roles    enable row level security;
alter table bookings          enable row level security;
alter table collections       enable row level security;
alter table collection_venues enable row level security;
alter table review_drafts     enable row level security;

-- Public catalogue: readable by anyone, including unauthenticated guests.
-- U-02 and R1: browsing never requires an account.
create policy venues_public_read on venues
  for select to anon, authenticated using (true);

create policy venue_categories_public_read on venue_categories
  for select to anon, authenticated using (true);

create policy table_tiers_public_read on table_tiers
  for select to anon, authenticated using (true);

create policy events_public_read on events
  for select to anon, authenticated using (true);

-- Reviews are world-readable, including the not-recommended ones: they are
-- hidden by default in the UI but reachable behind a disclosed link.
create policy reviews_public_read on reviews
  for select to anon, authenticated using (true);

-- Profiles: public ones are readable; you can always read your own.
create policy profiles_read on profiles
  for select to anon, authenticated
  using (visibility = 'public' or id = auth.uid());

create policy profiles_insert_self on profiles
  for insert to authenticated with check (id = auth.uid());

-- Note the omission: trust and elite are not in this policy's gift. A user can
-- edit their name, visibility, and preferences. The trigger below rejects any
-- attempt to raise their own trust score or grant themselves Elite.
create policy profiles_update_self on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function profiles_guard_privileged_columns() returns trigger
language plpgsql
as $$
begin
  if new.trust is distinct from old.trust
     or new.elite is distinct from old.elite
     or new.phone_verified is distinct from old.phone_verified
     or new.age_verified is distinct from old.age_verified then
    raise exception 'trust, elite, and verification flags are server-maintained';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileged
  before update on profiles
  for each row
  when (current_setting('role', true) <> 'service_role')
  execute function profiles_guard_privileged_columns();

-- Reviews: writing one requires a verified account (R3), authorship must be
-- your own, and the conflict-of-interest rule is enforced here rather than
-- trusted to the client (F-TRUST-06).
create or replace function is_verified(uid uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select phone_verified and age_verified from profiles where id = uid),
    false
  );
$$;

create or replace function holds_business_role(uid uuid, vid text) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from business_roles where user_id = uid and venue_id = vid
  );
$$;

create policy reviews_insert_own on reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and is_verified(auth.uid())
    and not holds_business_role(auth.uid(), venue_id)
  );

-- F-REVIEW-01: star rating plus text above a minimum character floor. Applied
-- to client submissions only, so seeding and provider ingest are unaffected.
create or replace function reviews_enforce_submission_rules() returns trigger
language plpgsql
as $$
begin
  if char_length(btrim(new.body)) < 60 then
    raise exception 'A review needs at least 60 characters of text (got %)',
      char_length(btrim(new.body));
  end if;
  -- The author does not get to place their own review in the rating.
  new.recommended := true;
  new.helpful := 0;
  new.insightful := 0;
  new.funny := 0;
  new.owner_response := null;
  new.owner_response_at := null;
  return new;
end;
$$;

create trigger reviews_enforce_submission
  before insert on reviews
  for each row
  when (current_setting('role', true) <> 'service_role')
  execute function reviews_enforce_submission_rules();

create policy reviews_update_own on reviews
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy reviews_delete_own on reviews
  for delete to authenticated using (author_id = auth.uid());

-- `recommended` and the owner response are not the author's to set. Same shape
-- of guard as profiles: the policy allows the update, the trigger narrows it.
create or replace function reviews_guard_privileged_columns() returns trigger
language plpgsql
as $$
begin
  if new.recommended is distinct from old.recommended then
    raise exception 'review recommendation state is set by the platform';
  end if;
  if new.owner_response is distinct from old.owner_response then
    raise exception 'owner responses are written through the business portal';
  end if;
  if new.helpful is distinct from old.helpful
     or new.insightful is distinct from old.insightful
     or new.funny is distinct from old.funny then
    raise exception 'community feedback counts are maintained by the platform';
  end if;
  new.edited := true;
  return new;
end;
$$;

create trigger reviews_guard_privileged
  before update on reviews
  for each row
  when (current_setting('role', true) <> 'service_role')
  execute function reviews_guard_privileged_columns();

create policy business_roles_read_self on business_roles
  for select to authenticated using (user_id = auth.uid());

-- Bookings, collections, and drafts are strictly the owner's.
create policy bookings_own on bookings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_verified(auth.uid()));

create policy collections_read on collections
  for select to anon, authenticated
  using (shared or user_id = auth.uid());

create policy collections_write_own on collections
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy collection_venues_read on collection_venues
  for select to anon, authenticated
  using (exists (
    select 1 from collections c
    where c.id = collection_id and (c.shared or c.user_id = auth.uid())
  ));

create policy collection_venues_write_own on collection_venues
  for all to authenticated
  using (exists (
    select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()
  ));

create policy review_drafts_own on review_drafts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ================================================== new-user provisioning

create or replace function handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Guest')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

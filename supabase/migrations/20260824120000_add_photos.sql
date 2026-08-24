-- F-MEDIA: real photo upload.
--
-- Photos previously existed only as metadata on the venue's jsonb document
-- (owner-provided at seed time). This adds a real upload path: a storage
-- bucket for the bytes, and a `photos` table for everything queryable about
-- them, additive to the seeded jsonb photos rather than replacing them.
--
-- `by` (owner vs community) is computed server-side from business_roles via
-- the existing private.holds_business_role() helper, the same way F-TRUST-06
-- is enforced on reviews -- a client claiming to be the owner does not make
-- it so. In this build that will always resolve to 'community', since there
-- is no business portal through which anyone actually holds a business role.
--
-- F-MEDIA-03 (automated nudity/violence/PII screening) and the moderation
-- side of F-MEDIA-04 are not implemented here, for the same reason F-TRUST is
-- out of scope for this client: screening only means something with a queue
-- and reviewers to act on it, which does not exist in this build. What *is*
-- real: the removal-*request* flow itself (a row a human would act on), and
-- the daily upload cap, enforced here rather than trusted to the client.

insert into storage.buckets (id, name, public)
values ('venue-photos', 'venue-photos', true)
on conflict (id) do nothing;

create type photo_album as enum (
  'food', 'drink', 'interior', 'exterior', 'menu', 'crowd', 'humidor', 'stage', 'table'
);

create type photo_credit as enum ('owner', 'community');

create table photos (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  album photo_album not null,
  caption text,
  -- Auto-generated for community photos if left blank (5.4); trigger-filled,
  -- never required from the client.
  alt text,
  storage_path text not null,
  by photo_credit not null default 'community',
  removal_requested boolean not null default false,
  created_at timestamptz not null default now()
);

create index photos_venue on photos (venue_id, created_at desc);
create index photos_uploader on photos (uploaded_by, created_at desc);

create table photo_removal_requests (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos(id) on delete cascade,
  requested_by uuid not null references profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table photos                 enable row level security;
alter table photo_removal_requests enable row level security;

-- Galleries are public, same as venues_public_read -- browsing never
-- requires an account (U-02).
create policy photos_public_read on photos
  for select to anon, authenticated using (true);

create policy photos_insert_own on photos
  for insert to authenticated with check (uploaded_by = auth.uid());

-- No update/delete policy for regular accounts: once posted, a photo is
-- immutable from the client. Removal goes through the request table below,
-- not a mutation the uploader (or anyone else) can make directly.

create policy photo_removal_requests_insert_own on photo_removal_requests
  for insert to authenticated with check (requested_by = auth.uid());

create policy photo_removal_requests_read_own on photo_removal_requests
  for select to authenticated using (requested_by = auth.uid());

-- `by` and a fallback `alt` are computed here, not trusted from the client.
create or replace function photos_before_insert() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.by := case when private.holds_business_role(new.venue_id) then 'owner' else 'community' end;
  if new.alt is null or btrim(new.alt) = '' then
    new.alt := 'Auto-generated: ' || coalesce(new.caption, new.album::text || ' photo');
  end if;
  return new;
end;
$$;

create trigger photos_before_insert_trg
  before insert on photos
  for each row execute function photos_before_insert();

-- F-MEDIA-01: "per-review and per-day caps varying by role." Elite gets a
-- materially higher cap; everyone else gets a modest one. Enforced here, not
-- just by disabling the button after N uploads client-side.
create or replace function photos_enforce_daily_cap() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_elite boolean;
  today_count int;
  cap int;
begin
  select coalesce(elite, false) into is_elite from public.profiles where id = auth.uid();
  cap := case when is_elite then 40 else 8 end;

  select count(*) into today_count
  from public.photos
  where uploaded_by = auth.uid() and created_at > now() - interval '24 hours';

  if today_count >= cap then
    raise exception 'Daily upload limit reached (% of %). Try again tomorrow.', today_count, cap;
  end if;

  return new;
end;
$$;

create trigger photos_enforce_daily_cap_trg
  before insert on photos
  for each row
  when (current_setting('role', true) in ('anon', 'authenticated'))
  execute function photos_enforce_daily_cap();

-- Storage: readable by anyone (the gallery is public); an authenticated
-- upload must land under a real venue's folder, not an arbitrary path.
create policy venue_photos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'venue-photos');

create policy venue_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'venue-photos'
    and exists (select 1 from venues v where v.id = (storage.foldername(name))[1])
  );

-- Real check-ins, real follows, and real user-to-user messaging.
--
-- All three were UI-only illusions before this: `checkIns` and `follows` in
-- AppProvider were local-device state only, with no table to write to and no
-- way for a second real person to ever see either; consumer-to-consumer
-- messaging did not exist in any form -- app/messages/index.tsx's own header
-- comment says "F-MSG-05 explicitly defers consumer-to-consumer messaging."
-- This migration reverses that deferral, deliberately, at the product
-- owner's explicit direction, with two scope decisions made up front rather
-- than defaulted to the most permissive option: a check-in is visible to
-- someone else only if you *mutually* follow each other (not "anyone
-- browsing the venue" -- a real-time stranger-location broadcast is a real
-- safety concern for a nightlife app), and a DM thread can only ever be
-- started between two accounts that mutually follow each other (not
-- open-to-anyone messaging).
--
-- follows is intentionally one row per direction rather than a single
-- "friendship" row: it has to represent one-way follows (you follow someone
-- who doesn't follow back) as a real, storable state, not just a computed
-- non-mutual case, since the existing local-only follow model already
-- allowed that and nothing here should regress it.

create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

alter table follows enable row level security;

-- Only your own edges are readable -- who you follow, who follows you -- not
-- the whole graph. That is enough to render "Following"/"Followers" and to
-- compute mutuality; it is not enough to browse a stranger's social graph.
create policy follows_read_own on follows
  for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

create policy follows_insert_own on follows
  for insert to authenticated
  with check (follower_id = auth.uid());

create policy follows_delete_own on follows
  for delete to authenticated
  using (follower_id = auth.uid());

-- Shared by check_ins and dm_threads below, so "mutual" is defined exactly
-- once. SECURITY DEFINER because a caller's own RLS on `follows` only lets
-- them see edges touching their own id -- this function needs to look at the
-- *other* person's outgoing edge too, which a non-definer function running
-- as the caller could not see.
create or replace function private.are_mutual_follows(other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select
    exists (select 1 from follows where follower_id = auth.uid() and followee_id = other_id)
    and exists (select 1 from follows where follower_id = other_id and followee_id = auth.uid());
$$;

-- ---------------------------------------------------------------- check-ins

create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  venue_id text not null references venues(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'friends')),
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now()
);

create index check_ins_venue_created_idx on check_ins (venue_id, created_at desc);

alter table check_ins enable row level security;

-- Always visible to the person who made it; visible to someone else only
-- when marked 'friends' *and* that someone else mutually follows the check-in's
-- owner. 'private' (the default) is never visible to anyone else, matching
-- the visibility field's existing name and the original local-only feature's
-- own default.
create policy check_ins_read on check_ins
  for select to authenticated
  using (
    user_id = auth.uid()
    or (visibility = 'friends' and private.are_mutual_follows(user_id))
  );

create policy check_ins_insert_own on check_ins
  for insert to authenticated
  with check (user_id = auth.uid());

-- "Checking out" is deleting the row rather than an update -- there is
-- nothing else about a check-in worth mutating in place, and it keeps this
-- table free of the jsonb-diff guard every mutable venue-write table here
-- needs instead.
create policy check_ins_delete_own on check_ins
  for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------- direct messages

create table dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint dm_threads_distinct_users check (user_a <> user_b),
  constraint dm_threads_ordered check (user_a < user_b),
  constraint dm_threads_unique_pair unique (user_a, user_b)
);

alter table dm_threads enable row level security;

-- user_a/user_b order has no meaning to either participant -- it exists only
-- so (A, B) and (B, A) can never both exist as separate threads. Enforced
-- here rather than trusted from the client, the same "the database decides"
-- shape as every other computed-not-submitted column in this schema.
create or replace function public.dm_threads_normalize()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  a uuid;
  b uuid;
begin
  if new.user_a < new.user_b then
    a := new.user_a;
    b := new.user_b;
  else
    a := new.user_b;
    b := new.user_a;
  end if;
  new.user_a := a;
  new.user_b := b;
  return new;
end;
$function$;

create trigger dm_threads_normalize_trg
  before insert on dm_threads
  for each row execute function dm_threads_normalize();

-- Only `blocked` may change after creation -- the same jsonb-diff shape
-- venues_guard_owner_write already uses, sized down to one column.
create or replace function public.dm_threads_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (to_jsonb(new) - array['blocked']) is distinct from (to_jsonb(old) - array['blocked']) then
    raise exception 'only blocked may be changed on a dm thread';
  end if;
  return new;
end;
$function$;

create trigger dm_threads_guard_update_trg
  before update on dm_threads
  for each row execute function dm_threads_guard_update();

create policy dm_threads_read_own on dm_threads
  for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- A thread can only ever be *created* between two mutual follows. Whether
-- they later unfollow each other is not re-checked on every message, the
-- same "checked at creation, not retroactively" shape
-- business_invites_insert already uses for its own role check.
create policy dm_threads_insert_mutual on dm_threads
  for insert to authenticated
  with check (
    (user_a = auth.uid() or user_b = auth.uid())
    and private.are_mutual_follows(case when user_a = auth.uid() then user_b else user_a end)
  );

-- Either participant can flip `blocked` -- symmetric, like venue message
-- threads: once set, the trigger above stops anything else in the row from
-- changing, and dm_messages_insert below stops new messages regardless of
-- who set it.
create policy dm_threads_update_participant on dm_threads
  for update to authenticated
  using (user_a = auth.uid() or user_b = auth.uid())
  with check (user_a = auth.uid() or user_b = auth.uid());

create table dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dm_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0 and length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index dm_messages_thread_created_idx on dm_messages (thread_id, created_at);

alter table dm_messages enable row level security;

create policy dm_messages_read on dm_messages
  for select to authenticated
  using (
    exists (
      select 1 from dm_threads t
      where t.id = dm_messages.thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

create policy dm_messages_insert on dm_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from dm_threads t
      where t.id = dm_messages.thread_id
        and not t.blocked
        and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

-- Same two limits messages_rate_limit already enforces for venue messaging:
-- 5 seconds between messages in one thread, 40 messages per account per
-- hour. A new, unmoderated way for two strangers-until-a-mutual-follow to
-- reach each other is exactly the kind of surface that needs this from day
-- one, not added after the first abuse report.
create or replace function public.dm_messages_rate_limit()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
declare
  recent_in_thread int;
  recent_by_user int;
begin
  select count(*) into recent_in_thread
  from dm_messages
  where thread_id = new.thread_id and created_at > now() - interval '5 seconds';
  if recent_in_thread > 0 then
    raise exception 'Sending too quickly. Wait a moment before the next message.';
  end if;

  select count(*) into recent_by_user
  from dm_messages
  where sender_id = auth.uid() and created_at > now() - interval '1 hour';
  if recent_by_user >= 40 then
    raise exception 'Message limit reached for this hour. Try again later.';
  end if;

  return new;
end;
$function$;

create trigger dm_messages_rate_limit_trg
  before insert on dm_messages
  for each row execute function dm_messages_rate_limit();

create or replace function public.dm_messages_touch_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.dm_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$function$;

create trigger dm_messages_touch_thread_trg
  after insert on dm_messages
  for each row execute function dm_messages_touch_thread();

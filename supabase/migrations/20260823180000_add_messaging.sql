-- F-MSG: consumer-to-business messaging.
--
-- There is no business portal in this build (F-BIZ is explicitly out of scope
-- for the consumer client -- see the README), which means there is no
-- authenticated party on the venue side who could ever write a reply. Rather
-- than fake a venue-authored message, `messages.sender` is constrained to
-- 'user': every row in this table was actually typed by the person who owns
-- the thread. F-MSG-01's "venue response-time metrics displayed publicly"
-- requirement is met by `venues.avg_response_minutes`, a plain published
-- number, not by synthesizing a reply that never happened.
--
-- F-MSG-05 explicitly defers consumer-to-consumer messaging pending a
-- harassment-risk assessment, so this is consumer-to-business only, matching
-- the shape of `bookings`: owner-only rows, no cross-user visibility.

alter table venues
  add column avg_response_minutes integer check (avg_response_minutes >= 0);

comment on column venues.avg_response_minutes is
  'F-MSG-01: published response-time metric shown on the profile and in the message composer.';

create type message_thread_kind as enum ('general', 'quote_request');

create table message_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  venue_id text not null references venues(id) on delete cascade,
  kind message_thread_kind not null default 'general',
  subject text,
  -- F-MSG-03: structured intake for private events, buyouts, and large parties.
  intake jsonb not null default '{}'::jsonb,
  -- F-MSG-04: a blocked thread stops accepting new messages from either side.
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index message_threads_user on message_threads (user_id, last_message_at desc);
create index message_threads_venue on message_threads (venue_id, last_message_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender text not null default 'user' check (sender = 'user'),
  body text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index messages_thread on messages (thread_id, created_at);

alter table message_threads enable row level security;
alter table messages         enable row level security;

-- Same shape as bookings_own: strictly the owner's, and only a verified
-- account may open one (R2 can read/write nothing here; R3 is required to
-- message a business per the permission matrix in PRD 2.4).
create policy message_threads_own on message_threads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.is_verified());

create policy messages_read_own on messages
  for select to authenticated
  using (exists (
    select 1 from message_threads t where t.id = thread_id and t.user_id = auth.uid()
  ));

create policy messages_insert_own on messages
  for insert to authenticated
  with check (
    exists (
      select 1 from message_threads t
      where t.id = thread_id and t.user_id = auth.uid() and not t.blocked
    )
  );

-- F-MSG-04 / NFR-11: rate limiting enforced where the client cannot bypass it.
-- The composer also disables Send for 5 seconds after a message, but that is
-- a courtesy, not the control -- this trigger is the control. Runs only for
-- client-facing roles, for the same reason the review and profile guards do:
-- an admin or migration connection reports the role GUC as 'none', and must
-- not be caught by a rule meant for PostgREST traffic.
create or replace function messages_rate_limit() returns trigger
language plpgsql
as $$
declare
  recent_in_thread int;
  recent_by_user int;
begin
  select count(*) into recent_in_thread
  from messages
  where thread_id = new.thread_id and created_at > now() - interval '5 seconds';
  if recent_in_thread > 0 then
    raise exception 'Sending too quickly. Wait a moment before the next message.';
  end if;

  select count(*) into recent_by_user
  from messages m
  join message_threads t on t.id = m.thread_id
  where t.user_id = auth.uid() and m.created_at > now() - interval '1 hour';
  if recent_by_user >= 40 then
    raise exception 'Message limit reached for this hour. Try again later.';
  end if;

  return new;
end;
$$;

create trigger messages_rate_limit_trg
  before insert on messages
  for each row
  when (current_setting('role', true) in ('anon', 'authenticated'))
  execute function messages_rate_limit();

-- Keeps thread previews and sort order correct without a second round trip
-- from the client. Ordinary privileges suffice: the sender already has update
-- rights on their own thread via message_threads_own.
create or replace function messages_touch_thread() returns trigger
language plpgsql
as $$
begin
  update message_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

create trigger messages_touch_thread_trg
  after insert on messages
  for each row execute function messages_touch_thread();

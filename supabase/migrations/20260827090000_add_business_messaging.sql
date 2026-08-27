-- F-MSG-02, scoped: quick-reply templates and a configurable auto-response
-- for venues. Neither means anything without the thing the original
-- messaging migration deliberately left out — a business account actually
-- being able to reply. That migration's own header explains why `sender`
-- was locked to 'user': there was no business portal, so there was no
-- authenticated party on the venue side who could write a reply, and
-- inventing one would have meant modelling a conversation that never
-- happened. There is a real business portal now (F-BIZ-01 through 15), so
-- that constraint is stale, not principled, and this migration replaces it
-- with a real one: a 'business'-sender message requires holding a business
-- role at the thread's venue, the same check every other business write in
-- this app already uses.
--
-- Scoped out, and why:
--  - No keyword-matched or scheduled auto-responses -- one plain text field,
--    sent once, on the first message in a thread. A rules engine is a
--    different, larger feature.
--  - No business-side blocking or thread management beyond replying --
--    F-MSG-04's abuse controls stay consumer-side (block/report), which is
--    what they were built for.
--  - The consumer's own thread screen previously never re-fetched anything
--    from the backend after the thread was created -- entirely believable
--    when there was truly nothing else to fetch, since nothing else could
--    write to a thread. That stops being true the moment a business can
--    reply, so the client change accompanying this migration adds a real
--    refetch-on-open, not a realtime subscription (out of scope, matching
--    the fetch-on-mount pattern the moderation queue and bookings console
--    already use rather than a push channel).

alter table venues add column auto_response_text text;

-- Extends the same two-branch guard venues_guard_owner_write already has
-- (see 20260826110000_add_trust_and_safety.sql) rather than a third one:
-- one more column a business account may write here.
create or replace function venues_guard_owner_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.holds_platform_role(array['trust_safety']::public.platform_role[]) then
    if (to_jsonb(new) - array['consumer_alert', 'contribution_frozen', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['consumer_alert', 'contribution_frozen', 'updated_at']) then
      raise exception 'trust & safety may only write the consumer alert and contribution freeze here';
    end if;
    if new.consumer_alert is distinct from old.consumer_alert then
      insert into public.moderation_actions (actor_id, action, venue_id, note)
      values (
        auth.uid(),
        (case when new.consumer_alert is null then 'consumer_alert_cleared' else 'consumer_alert_applied' end)::public.moderation_action_kind,
        new.id,
        new.consumer_alert
      );
    end if;
    if new.contribution_frozen is distinct from old.contribution_frozen then
      insert into public.moderation_actions (actor_id, action, venue_id)
      values (
        auth.uid(),
        (case when new.contribution_frozen then 'contribution_frozen' else 'contribution_unfrozen' end)::public.moderation_action_kind,
        new.id
      );
    end if;
    new.updated_at := now();
    return new;
  end if;

  if not private.holds_business_role(new.id) then
    raise exception 'venues are not directly editable';
  end if;
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'menus', 'claimed', 'tagline', 'about', 'search_text', 'auto_response_text', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'menus', 'claimed', 'tagline', 'about', 'search_text', 'auto_response_text', 'updated_at']) then
    raise exception 'a business account may only write hours, happy hours, menus, claimed, tagline, about, and the auto-response here';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------- messages

alter table messages drop constraint if exists messages_sender_check;
alter table messages add constraint messages_sender_check check (sender in ('user', 'business'));

drop policy if exists messages_insert_own on messages;
create policy messages_insert_own on messages
  for insert to authenticated
  with check (
    sender = 'user'
    and exists (
      select 1 from message_threads t
      where t.id = thread_id and t.user_id = auth.uid() and not t.blocked
    )
  );

create policy message_threads_business_read on message_threads
  for select to authenticated
  using (private.holds_business_role(venue_id));

create policy messages_business_read on messages
  for select to authenticated
  using (
    exists (
      select 1 from message_threads t
      where t.id = thread_id and private.holds_business_role(t.venue_id)
    )
  );

create policy messages_business_insert on messages
  for insert to authenticated
  with check (
    sender = 'business'
    and exists (
      select 1 from message_threads t
      where t.id = thread_id and not t.blocked and private.holds_business_role(t.venue_id)
    )
  );

-- A business reply, or the auto-response inserted below on its behalf, is
-- not the abuse vector F-MSG-04 / NFR-11 were written for -- that limit is
-- about a consumer flooding a venue, not the other way around. Also picks
-- up `set search_path = public` while being touched anyway: the original
-- version of this function (20260823180000_add_messaging.sql) had none,
-- which the security advisor flags as a role-mutable search_path -- the
-- same class of finding 20260822000300_harden_functions.sql fixed on four
-- other trigger functions, just missed on this one at the time.
create or replace function messages_rate_limit() returns trigger
language plpgsql
set search_path = public
as $$
declare
  recent_in_thread int;
  recent_by_user int;
begin
  if new.sender <> 'user' then
    return new;
  end if;

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

-- Fires once, synchronously, on the first message in a thread -- not a
-- "no human replied within N minutes" system, which would need a scheduler
-- this build doesn't have. SECURITY DEFINER because the actual caller here
-- is the *guest* sending their first message, who does not hold a business
-- role at the venue and could never pass messages_business_insert's check
-- on their own; the entry point stays gated by messages_insert_own above
-- exactly as before, and this only ever inserts the venue's own configured
-- text, verbatim, never anything the trigger's caller supplied.
create or replace function messages_auto_respond() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  auto_text text;
  msg_count int;
begin
  if new.sender <> 'user' then
    return new;
  end if;

  select count(*) into msg_count from messages where thread_id = new.thread_id;
  if msg_count <> 1 then
    return new;
  end if;

  select v.auto_response_text into auto_text
  from message_threads t join venues v on v.id = t.venue_id
  where t.id = new.thread_id;

  if auto_text is null or btrim(auto_text) = '' then
    return new;
  end if;

  insert into messages (thread_id, sender, body) values (new.thread_id, 'business', auto_text);
  return new;
end;
$$;

revoke execute on function messages_auto_respond() from public, anon, authenticated;

create trigger messages_auto_respond_trg
  after insert on messages
  for each row execute function messages_auto_respond();

-- ------------------------------------------------------ reply templates

create table business_reply_templates (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  label text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index business_reply_templates_venue on business_reply_templates (venue_id, created_at);

alter table business_reply_templates enable row level security;

create policy business_reply_templates_read on business_reply_templates
  for select to authenticated
  using (private.holds_business_role(venue_id));

create policy business_reply_templates_write on business_reply_templates
  for all to authenticated
  using (private.holds_business_role(venue_id))
  with check (private.holds_business_role(venue_id));

-- F-MSG-04's remaining gap: rate limiting and manual block/report already
-- exist for both message surfaces (dm_messages, messages), but nothing
-- automatically detects harassment or off-platform-payment solicitation --
-- the two things the requirement actually names. This adds a heuristic
-- detector, not real ML/NLP: the same honest scope F-TRUST-02's own
-- migration comment already states a reason for ("needs real ML/heuristics
-- infrastructure this build does not have"). Deliberately narrow on the
-- harassment axis too -- explicit threat/self-harm phrasing only, not a
-- hate-speech or slur classifier. That needs real NLP to do without a
-- flood of false positives, and hardcoding slur strings into a migration
-- file that lives in git history forever is its own bad idea regardless.
--
-- Detection is silent by design: the message still sends normally.
-- F-REVIEW-07's own reasoning ("Rationale must never be exposed in
-- detail, to avoid providing an evasion roadmap") applies just as much
-- here -- telling a sender what tripped a filter is a roadmap to evade it.
-- Only moderator/trust_safety ever see a flag, and only the flagged
-- message's own text as it existed at flag time -- not the rest of the
-- thread, not the other party's messages. That is a deliberately narrower
-- grant than "moderators can read DMs," which this does not do and is not
-- a decision to make lightly given DMs are otherwise mutual-follow-private.

-- Pre-existing bug, found while testing the detector below on business
-- threads: messages_touch_thread() was never SECURITY DEFINER, unlike its
-- sibling dm_messages_touch_thread(). message_threads_own's policy is
-- `for all using (user_id = auth.uid())` -- true for the consumer who owns
-- the thread, but a `business`-sender message is written by a business
-- account, not the consumer, so this trigger's own `update
-- message_threads set last_message_at = ...` fails RLS for every business
-- reply. `messages` has 0 rows in production, so this had never actually
-- been exercised -- no business has successfully sent a reply yet. Fixed
-- the same way dm_messages_touch_thread() already does it.
create or replace function messages_touch_thread() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.message_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

revoke execute on function messages_touch_thread() from public, anon, authenticated;

create type message_flag_reason as enum ('off_platform_payment', 'threat_or_self_harm');
create type message_flag_status as enum ('pending', 'dismissed', 'reviewed');

create table message_abuse_flags (
  id uuid primary key default gen_random_uuid(),
  dm_message_id uuid references dm_messages(id) on delete cascade,
  business_message_id uuid references messages(id) on delete cascade,
  thread_id uuid not null,
  sender_id uuid not null references profiles(id) on delete cascade,
  reason message_flag_reason not null,
  flagged_text text not null,
  status message_flag_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  constraint message_abuse_flags_one_source check (
    (dm_message_id is not null and business_message_id is null) or
    (dm_message_id is null and business_message_id is not null)
  )
);

create index message_abuse_flags_queue on message_abuse_flags (status, created_at);

alter table message_abuse_flags enable row level security;

-- No insert policy at all -- every row is written by the SECURITY DEFINER
-- detector trigger below, reacting to an already-RLS-gated message insert,
-- never assembled by the client. Same "immutable, system-only write"
-- shape content_reports/moderation_actions already use for F-TRUST-08.
create policy message_abuse_flags_read on message_abuse_flags
  for select to authenticated
  using (private.holds_platform_role(array['moderator', 'trust_safety']::platform_role[]));

create policy message_abuse_flags_resolve on message_abuse_flags
  for update to authenticated
  using (private.holds_platform_role(array['moderator', 'trust_safety']::platform_role[]))
  with check (private.holds_platform_role(array['moderator', 'trust_safety']::platform_role[]));

-- Restricts a resolve to exactly status/resolved_at/resolved_by, the same
-- column-guard shape venues_guard_owner_write() and content_reports's own
-- trigger already use elsewhere in this schema, and only away from
-- 'pending' -- a resolved flag cannot be reopened or re-resolved.
create or replace function message_abuse_flags_guard_resolve() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'pending' then
    raise exception 'This flag has already been resolved.';
  end if;
  if (to_jsonb(new) - array['status', 'resolved_at', 'resolved_by']) is distinct from
     (to_jsonb(old) - array['status', 'resolved_at', 'resolved_by']) then
    raise exception 'Only status may be changed when resolving a message flag.';
  end if;
  new.resolved_at := now();
  new.resolved_by := auth.uid();
  return new;
end;
$$;

revoke execute on function message_abuse_flags_guard_resolve() from public, anon, authenticated;

create trigger message_abuse_flags_guard_resolve_trg
  before update on message_abuse_flags
  for each row execute function message_abuse_flags_guard_resolve();

-- The detector itself. AFTER INSERT, not BEFORE: unlike the rate-limit
-- triggers on these same tables, this must never block or delay a send --
-- it only ever adds a row somewhere else once the message already exists.
-- SECURITY DEFINER because the sender has no insert policy on
-- message_abuse_flags (nor should they).
--
-- `messages` (business threads) only ever records sender as the literal
-- string 'user' or 'business' -- there is no per-staff-account column, so
-- a 'business' row can't be attributed to a specific person the way every
-- other sender_id in this schema means "this exact account." Scoping
-- detection to sender = 'user' here rather than inventing a fake
-- attribution is the honest choice; teaching this detector to also watch
-- the business side needs a real schema change to `messages` first
-- (a sender_user_id column), not a workaround bolted onto this migration.
create or replace function detect_message_abuse() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_sender_id uuid;
  v_reason message_flag_reason;
begin
  -- A nested if, not `tg_table_name = 'messages' and new.sender <> 'user'`
  -- in one expression: `new` is a polymorphic RECORD here (this function
  -- backs triggers on two different tables), and dm_messages has no
  -- `sender` column at all -- referencing new.sender while new is a
  -- dm_messages row fails outright, regardless of AND short-circuiting,
  -- because the record-field lookup happens independently of it. A
  -- separate outer IF is a distinct plpgsql statement that's fully
  -- skipped, not just a short-circuited boolean operand.
  if tg_table_name = 'messages' then
    if new.sender <> 'user' then
      return new;
    end if;
  end if;

  if new.body ~* '\y(venmo|cash\s*app|cashapp|zelle|paypal(\.me)?|western union|wire transfer)\y' then
    v_reason := 'off_platform_payment';
  elsif new.body ~* '(kill (you|yourself)|\ykys\y|hurt you|come to your house|i know where you live)' then
    v_reason := 'threat_or_self_harm';
  else
    return new;
  end if;

  if tg_table_name = 'dm_messages' then
    v_thread_id := new.thread_id;
    v_sender_id := new.sender_id;
    insert into message_abuse_flags (dm_message_id, thread_id, sender_id, reason, flagged_text)
    values (new.id, v_thread_id, v_sender_id, v_reason, new.body);
  else
    v_thread_id := new.thread_id;
    select user_id into v_sender_id from message_threads where id = v_thread_id;
    insert into message_abuse_flags (business_message_id, thread_id, sender_id, reason, flagged_text)
    values (new.id, v_thread_id, v_sender_id, v_reason, new.body);
  end if;

  return new;
end;
$$;

revoke execute on function detect_message_abuse() from public, anon, authenticated;

create trigger dm_messages_detect_abuse_trg
  after insert on dm_messages
  for each row execute function detect_message_abuse();

create trigger messages_detect_abuse_trg
  after insert on messages
  for each row execute function detect_message_abuse();

-- Same class of finding as 20260822000300_harden_functions.sql: a trigger
-- function with a role-mutable search_path is a privilege-escalation vector.
-- Pin it empty and qualify every table reference, since an empty path means
-- unqualified names resolve to nothing.

create or replace function messages_rate_limit() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent_in_thread int;
  recent_by_user int;
begin
  select count(*) into recent_in_thread
  from public.messages
  where thread_id = new.thread_id and created_at > now() - interval '5 seconds';
  if recent_in_thread > 0 then
    raise exception 'Sending too quickly. Wait a moment before the next message.';
  end if;

  select count(*) into recent_by_user
  from public.messages m
  join public.message_threads t on t.id = m.thread_id
  where t.user_id = auth.uid() and m.created_at > now() - interval '1 hour';
  if recent_by_user >= 40 then
    raise exception 'Message limit reached for this hour. Try again later.';
  end if;

  return new;
end;
$$;

create or replace function messages_touch_thread() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.message_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

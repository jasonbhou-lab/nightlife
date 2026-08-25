-- F-BIZ-04 (scoped): a business_roles holder edits their own venue's hours
-- and happy hours. Dropped from the full requirement: bulk/multi-location
-- editing (F-BIZ-14 is out of scope, so there is nowhere to bulk-apply to)
-- and temporary closure scheduling (closure_state/closure_note are Trust &
-- Safety-only per F-PROFILE-12, not something a business self-declares).
--
-- venues has had no write policy at all until now -- not even for the
-- account that claimed it. The guard trigger below is a jsonb-diff rather
-- than an exhaustive column list: it allows a change to schedules,
-- happy_hours, or updated_at, and rejects the update outright if anything
-- else on the row differs, so a business account can confirm hours but
-- cannot quietly rewrite its own name, address, attributes, or claimed/
-- verified flags through the same door.

create policy venues_owner_write on venues
  for update to authenticated
  using (private.holds_business_role(id))
  with check (private.holds_business_role(id));

create or replace function venues_guard_owner_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.holds_business_role(new.id) then
    raise exception 'venues are not directly editable';
  end if;
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'updated_at']) then
    raise exception 'a business account may only write hours and happy hours here';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger venues_guard_owner_write
  before update on venues
  for each row
  when (current_setting('role', true) <> 'service_role')
  execute function venues_guard_owner_write();

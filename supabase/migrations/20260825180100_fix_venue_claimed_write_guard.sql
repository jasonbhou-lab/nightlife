-- Fixes a real regression, confirmed by directly simulating the claim flow
-- under RLS while testing the invite feature (business_invites' AFTER
-- INSERT chain runs through the same business_roles insert path a claim
-- does): business_roles_mark_venue_claimed() sets venues.claimed = true,
-- but venues_guard_owner_write() (added later, in
-- 20260825160000_add_venue_hours_edit.sql) only allowed schedules,
-- happy_hours, menus, and updated_at to change. SECURITY DEFINER changes
-- which role's *privileges* apply, not the `role` GUC venues_guard_owner_write
-- reads via current_setting('role') to decide whether to run at all -- so
-- the guard fired anyway and rejected every claim, self-serve or invited,
-- ever attempted against a real backend. `claimed` is now in the allowlist.

create or replace function venues_guard_owner_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.holds_business_role(new.id) then
    raise exception 'venues are not directly editable';
  end if;
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'menus', 'claimed', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'menus', 'claimed', 'updated_at']) then
    raise exception 'a business account may only write hours, happy hours, menus, and claimed here';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

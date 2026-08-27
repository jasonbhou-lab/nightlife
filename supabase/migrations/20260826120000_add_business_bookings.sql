-- F-BIZ-11, scoped: a business account gets visibility into bookings and
-- waitlist entries at a venue it holds a role for, and can move them
-- through their operational lifecycle -- confirm, cancel a no-show, adjust
-- a waitlisted party's estimated wait or position. Left out: the floor map,
-- real-time table-tier status, and staff assignment the full requirement
-- asks for. Those need an interactive room-map UI built against
-- `table_tiers`, a genuinely different (and larger) feature than giving a
-- business a list it can act on -- not something to rush alongside this.
--
-- Building this surfaced a real, unrelated bug: AppProvider's
-- `cancelBooking` only ever updated local device state -- it never wrote to
-- the backend at all. A business console reading the real `bookings` table
-- would have shown a permanently-stale status for any booking its own
-- guest had "cancelled" from their side. Fixed alongside this migration;
-- see repository.cancelBookingRemote and its call site in AppProvider.

create policy bookings_business_read on bookings
  for select to authenticated
  using (private.holds_business_role(venue_id));

create policy bookings_business_write on bookings
  for update to authenticated
  using (private.holds_business_role(venue_id))
  with check (private.holds_business_role(venue_id));

-- A business account may only move a booking through {status, wait_minutes,
-- waitlist_position} -- never the guest's own submission (date, time, party
-- size, tier, deposit, notes, terms). The consumer's own path (cancelling
-- their own booking) is untouched by this guard and keeps whatever freedom
-- it already had under bookings_own.
create or replace function bookings_guard_business_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id = auth.uid() then
    return new;
  end if;
  if not private.holds_business_role(new.venue_id) then
    raise exception 'bookings are not directly editable by another account';
  end if;
  if (to_jsonb(new) - array['status', 'wait_minutes', 'waitlist_position'])
     is distinct from
     (to_jsonb(old) - array['status', 'wait_minutes', 'waitlist_position']) then
    raise exception 'a business account may only update status, wait time, and waitlist position here';
  end if;
  return new;
end;
$$;

create trigger bookings_guard_business_write_trg
  before update on bookings
  for each row execute function bookings_guard_business_write();

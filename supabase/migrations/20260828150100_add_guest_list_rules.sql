-- F-BOOK-07, scoped: guest list requests with venue-defined cutoff times,
-- capacity limits, and approval or auto-approval.
--
-- Before this, "Guest List" on a nightclub profile silently routed into the
-- generic walk-in-bar waitlist form (bookingMode 'waitlist') -- same header
-- mislabeled "Waitlist", no cutoff, no capacity, no promoter distinction.
-- `venues.attributes.guestListCutoff` already existed but was read in
-- exactly one place (a headline sentence on the profile) and never
-- enforced; `promoterAffiliated` was defined and seeded but read nowhere at
-- all. Both get a real job here.
--
-- What's real: cutoff time and capacity are enforced server-side, not just
-- shown -- the same "client validates for a fast message, the database is
-- what actually decides" discipline the review character floor and
-- conflict-of-interest checks already use. `promoterAffiliated` decides
-- auto-approval: true means the request lands as 'requested' (surfaced in
-- the existing F-BIZ-11 console's generic Confirm/Cancel actions, which
-- already work off `status` regardless of `kind` -- no console changes
-- needed); false auto-confirms, the same as a reservation does today.
--
-- What's not built: a public capacity count is intentionally the only
-- cross-account read exposed here (via a security-definer function, not a
-- relaxed RLS policy on bookings) -- a guest still cannot see who else is
-- on the list, only how many spots are taken.

create or replace function public.guest_list_count(p_venue_id text, p_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(party_size), 0)::integer
  from public.bookings
  where venue_id = p_venue_id
    and kind = 'guest_list'
    and booking_date = p_date
    and status <> 'cancelled';
$$;

create or replace function public.bookings_enforce_guest_list_rules() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_cutoff text;
  v_taken integer;
begin
  if new.kind <> 'guest_list' then
    return new;
  end if;

  select (attributes->>'guestListCapacity')::integer, attributes->>'guestListCutoff'
    into v_capacity, v_cutoff
    from public.venues where id = new.venue_id;

  if v_cutoff is not null and new.booking_date = current_date and localtime > v_cutoff::time then
    raise exception 'the guest list is closed for tonight';
  end if;

  if v_capacity is not null then
    select coalesce(sum(party_size), 0) into v_taken
      from public.bookings
      where venue_id = new.venue_id
        and kind = 'guest_list'
        and booking_date = new.booking_date
        and status <> 'cancelled';
    if v_taken + new.party_size > v_capacity then
      raise exception 'the guest list is full for tonight';
    end if;
  end if;

  return new;
end;
$$;

create trigger bookings_enforce_guest_list_rules_trg
  before insert on bookings
  for each row execute function public.bookings_enforce_guest_list_rules();

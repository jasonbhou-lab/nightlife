-- F-BIZ-13 (scoped): invite a manager or staff member by email. No role
-- assignment beyond manager/staff (owner and group_admin are not
-- invitable -- group_admin presupposes multi-location, F-BIZ-14, which is
-- out of scope), and no access audit log -- an invite's own row (sender,
-- email, role, sent/accepted timestamps) is the only record kept.
--
-- This is honestly buildable now in a way it would not have been before
-- real Supabase Auth existed: acceptance is matched against the invited
-- account's actual confirmed email (auth.jwt() ->> 'email'), not a name
-- someone typed.
--
-- The interesting problem this raises: business_roles_guard_claim()
-- (20260825140000_add_business_claims.sql) blocks a second business_roles
-- row for a venue that already has one, by design -- first self-serve
-- claim wins, no disputes handled here. An accepted invite is a second row
-- on purpose, so the guard is extended to make an exception for exactly
-- that case: a matching, unconsumed invite for this account's own email,
-- this venue, and this role. Nothing else changes about the guard.

create table business_invites (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  email text not null,
  role business_role not null,
  invited_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references profiles(id) on delete set null
);

alter table business_invites enable row level security;

-- Avoids a pile of duplicate outstanding invites for the same person.
create unique index business_invites_pending_unique
  on business_invites (venue_id, lower(email), role)
  where accepted_at is null;

create policy business_invites_insert on business_invites
  for insert to authenticated
  with check (
    invited_by = auth.uid()
    and private.holds_business_role(venue_id)
    and role in ('manager', 'staff')
  );

-- The sender sees invites they sent; the invitee sees invites addressed to
-- their own confirmed email. Neither can see the other's unrelated invites.
create policy business_invites_select on business_invites
  for select to authenticated
  using (
    invited_by = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Doubles as both "revoke" (sender, before acceptance) and "decline"
-- (invitee). Accepting is a business_roles insert, not a row edit here --
-- see business_roles_consume_invite() below.
create policy business_invites_delete on business_invites
  for delete to authenticated
  using (
    invited_by = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create or replace function business_roles_guard_claim() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.business_roles
    where venue_id = new.venue_id and user_id <> new.user_id
  ) and not exists (
    select 1 from public.business_invites
    where venue_id = new.venue_id
      and role = new.role
      and accepted_at is null
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) then
    raise exception 'This listing has already been claimed by another account.';
  end if;
  return new;
end;
$$;

create or replace function business_roles_consume_invite() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.business_invites
  set accepted_at = now(), accepted_by = new.user_id
  where venue_id = new.venue_id
    and role = new.role
    and accepted_at is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  return new;
end;
$$;

create trigger business_roles_consume_invite
  after insert on business_roles
  for each row
  execute function business_roles_consume_invite();

-- Both are trigger-only, callable by no one directly. CREATE OR REPLACE
-- does not reliably carry a prior REVOKE forward, so both are restated
-- here rather than assumed still in effect from the earlier migration.
revoke execute on function business_roles_guard_claim() from public, anon, authenticated;
revoke execute on function business_roles_consume_invite() from public, anon, authenticated;

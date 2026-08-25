-- F-BIZ-01 (scoped): self-serve venue claim.
--
-- The PRD calls for multi-path verification: an automated phone call,
-- a postcard to the listed address, an email at a matching domain, or a
-- manually reviewed document upload. None of those are real here — there is
-- no telephony, no mail, no document-review queue, and (separately) no real
-- Supabase Auth session anywhere in the client yet, so there is no confirmed
-- email to match a domain against either.
--
-- What this migration adds instead is the honest, self-attested version:
-- signing in and asserting "I run this place" is enough to flip
-- venues.claimed and create the business_roles row, exactly the way filing a
-- photo removal request is enough to create a real row with no queue behind
-- it yet (see 20260824120000_add_photos.sql). venues.verified is left
-- strictly alone — it stays false until some future real verification step
-- exists, which is why the app already renders "Claimed and unverified
-- owner" as a normal, expected state rather than a broken one.
--
-- Only 'owner' and 'manager' are claimable this way. 'staff' and
-- 'group_admin' presuppose someone who already holds a role inviting you
-- (F-BIZ-13), which this build does not implement, so self-serve claiming
-- does not offer them.
--
-- First claim wins. A venue that already has any business_roles row rejects
-- further self-serve claims outright — ownership transfer and dispute
-- resolution (F-BIZ-02) is out of scope, so a legitimate second claimant has
-- no path here beyond contacting support outside the app.

create policy business_roles_claim_own on business_roles
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role in ('owner', 'manager')
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
  ) then
    raise exception 'This listing has already been claimed by another account.';
  end if;
  return new;
end;
$$;

create trigger business_roles_guard_claim
  before insert on business_roles
  for each row
  execute function business_roles_guard_claim();

create or replace function business_roles_mark_venue_claimed() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.venues set claimed = true where id = new.venue_id;
  return new;
end;
$$;

create trigger business_roles_mark_venue_claimed
  after insert on business_roles
  for each row
  execute function business_roles_mark_venue_claimed();

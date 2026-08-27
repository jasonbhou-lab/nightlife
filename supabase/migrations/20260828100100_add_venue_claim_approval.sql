-- F-BIZ-01, tightened: claiming a venue now requires an admin's approval
-- before it takes effect, rather than the original self-serve design where
-- confirming "I run this place" instantly created the business_roles row
-- and flipped venues.claimed. Everything else about F-BIZ-01's own scoping
-- is unchanged — still self-attested, still no phone call, postcard, or
-- document review behind it (see 20260825140000_add_business_claims.sql) —
-- this only adds a human checkpoint in front of it.
--
-- business_roles_claim_own, the original self-serve INSERT policy, is
-- dropped outright, not just left unused: a client that could still insert
-- business_roles directly would make the approval queue optional rather
-- than mandatory. What replaces it is narrower on purpose —
-- business_roles_accept_invite only allows a row a real, unconsumed
-- business_invites entry addressed to the caller's own confirmed email
-- actually backs, checked in the policy's own WITH CHECK rather than left to
-- business_roles_guard_claim's looser "no existing claimant yet" logic.
-- That also fixes a real, separate bug this surfaced: business_roles_claim_own's
-- role check was `in ('owner', 'manager')`, so an invited *staff* member
-- accepting their own invite has been rejected by RLS this whole time —
-- staff was never actually claimable through the door that existed for it.

create type venue_claim_status as enum ('pending', 'approved', 'rejected');

create table venue_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role business_role not null check (role in ('owner', 'manager')),
  status venue_claim_status not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id) on delete set null
);

-- Only one active claim per venue at a time — the same "first claim wins"
-- shape the original self-serve design had, just decided by a person now
-- instead of instantly. A rejected claim frees the venue up for another
-- attempt, by the same account or a different one.
create unique index venue_claims_one_pending_per_venue
  on venue_claims (venue_id) where status = 'pending';

create index venue_claims_queue on venue_claims (status, created_at);

alter table venue_claims enable row level security;

create policy venue_claims_insert_own on venue_claims
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (select 1 from venues where id = venue_id and claimed)
  );

-- The claimant sees their own claim's status; an admin sees the whole queue.
create policy venue_claims_read on venue_claims
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.holds_platform_role(array['admin']::platform_role[])
  );

-- A claimant can withdraw their own claim only while it is still pending —
-- once decided, the row is the record of that decision, not theirs to erase.
create policy venue_claims_delete_own_pending on venue_claims
  for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

create policy venue_claims_decide on venue_claims
  for update to authenticated
  using (private.holds_platform_role(array['admin']::platform_role[]))
  with check (private.holds_platform_role(array['admin']::platform_role[]));

-- Mirrors content_reports_apply_moderation()'s shape (20260826110000): the
-- client's own UPDATE only ever needs to set `status` and optionally `note`
-- (e.g. a rejection reason) — everything else here is a side effect this
-- applies atomically. Tighter than that function in one respect: this
-- explicitly rejects a client UPDATE that touches any column besides those
-- two, rather than trusting the caller not to. SECURITY DEFINER because
-- approval's actual effect — inserting into business_roles — has no
-- client-facing INSERT policy for this at all now that business_roles_claim_own
-- is gone; this trigger is the only door left onto it besides invite
-- acceptance.
create or replace function venue_claims_apply_decision() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(new) - array['status', 'note']) is distinct from (to_jsonb(old) - array['status', 'note']) then
    raise exception 'an admin may only change status and note here';
  end if;
  if old.status <> 'pending' then
    raise exception 'this claim has already been decided';
  end if;
  if new.status not in ('approved', 'rejected') then
    raise exception 'a claim can only be approved or rejected';
  end if;

  new.decided_at := now();
  new.decided_by := auth.uid();

  if new.status = 'approved' then
    insert into business_roles (user_id, venue_id, role)
    values (new.user_id, new.venue_id, new.role);
  end if;

  return new;
end;
$$;

revoke execute on function venue_claims_apply_decision() from public, anon, authenticated;

create trigger venue_claims_apply_decision_trg
  before update on venue_claims
  for each row execute function venue_claims_apply_decision();

-- ------------------------------------------------------------- business_roles

drop policy if exists business_roles_claim_own on business_roles;

-- Accepting an invite is the one remaining client-facing door onto
-- business_roles. Requires a real, unconsumed invite for this exact
-- venue/role addressed to the caller's own confirmed email — checked here,
-- not left to business_roles_guard_claim's "no existing claimant yet"
-- shortcut, which was only ever a safe assumption while self-serve claiming
-- was the *other* door onto this table. Now that it is not, this stands on
-- its own.
create policy business_roles_accept_invite on business_roles
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from business_invites
      where venue_id = business_roles.venue_id
        and role = business_roles.role
        and accepted_at is null
        and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

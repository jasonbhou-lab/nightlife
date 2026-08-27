-- F-BIZ-02, scoped: ownership transfer (cooperative) and dispute resolution
-- (adversarial), built on the approval infrastructure F-BIZ-01 just got
-- (20260828100100_add_venue_claim_approval.sql). No defined SLA — the same
-- reasoning every other SLA in this PRD has been cut for: there is no
-- notification/timer infrastructure to enforce one against, only a queue a
-- human has to look at.
--
-- Transfer: a *current owner* hands the venue to another account through
-- the same invite mechanism F-BIZ-13 already uses for staff and managers
-- (20260825180000_add_business_invites.sql), extended to allow role =
-- 'owner' — but only when the sender already holds owner at that venue, and
-- acceptance replaces the sender's own owner row rather than adding a
-- second owner alongside it. Cooperative, so no admin involved, and the
-- outgoing owner's existing manager/staff invites are left alone — unlike
-- a dispute, nothing about a transfer suggests the existing team is
-- illegitimate.
--
-- Dispute: someone who is *not* the current claimant contests an
-- already-claimed venue, with evidence required — this is the one
-- venue_claims path that isn't take-my-word-for-it, since a bare "I run
-- this place" is not enough once someone already holds the role. Routes
-- through the exact same venue_claims table and admin queue a fresh claim
-- does; the only difference is what approving it does.
-- venue_claims_apply_decision() now checks whether the venue is *currently*
-- claimed at decision time (not submission time, which could be stale by
-- the time an admin looks at it) and, if so, clears every existing
-- business_roles row at that venue before installing the new claimant — a
-- real ownership change, not a second owner alongside a disputed one.
-- Unlike transfer, this does wipe the outgoing owner's whole team: a
-- dispute being approved means an admin decided the prior claim was not
-- legitimate, so nothing about who they invited should be assumed
-- legitimate either.

alter table venue_claims add column evidence text;

drop policy if exists venue_claims_insert_own on venue_claims;
create policy venue_claims_insert_own on venue_claims
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      not exists (select 1 from venues where id = venue_id and claimed)
      or (evidence is not null and length(trim(evidence)) > 0)
    )
  );

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
    if exists (select 1 from venues where id = new.venue_id and claimed) then
      delete from business_roles where venue_id = new.venue_id;
    end if;
    insert into business_roles (user_id, venue_id, role)
    values (new.user_id, new.venue_id, new.role);
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------- business_invites

drop policy if exists business_invites_insert on business_invites;
create policy business_invites_insert on business_invites
  for insert to authenticated
  with check (
    invited_by = auth.uid()
    and private.holds_business_role(venue_id)
    and (
      role in ('manager', 'staff')
      or (
        role = 'owner'
        and exists (
          select 1 from business_roles
          where user_id = auth.uid() and venue_id = business_invites.venue_id and role = 'owner'
        )
      )
    )
  );

-- ------------------------------------------------------- business_roles

create or replace function business_roles_consume_invite() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'owner' then
    delete from public.business_roles
    where venue_id = new.venue_id and role = 'owner' and user_id <> new.user_id;
  end if;

  update public.business_invites
  set accepted_at = now(), accepted_by = new.user_id
  where venue_id = new.venue_id
    and role = new.role
    and accepted_at is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  return new;
end;
$$;

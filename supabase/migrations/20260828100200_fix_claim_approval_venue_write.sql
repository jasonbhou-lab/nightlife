-- Fix: approving a venue claim could not actually flip venues.claimed.
--
-- business_roles_mark_venue_claimed() (20260825140000_add_business_claims.sql)
-- has always relied on auth.uid() already holding a business role at the
-- venue by the time its own cascading `update venues set claimed = true`
-- runs — true for the original self-serve claim (the claimant was
-- auth.uid(), and their business_roles row already existed earlier in the
-- very same insert) and true for invite acceptance (same reasoning, the
-- invitee is auth.uid()). venue_claims_apply_decision() (20260828100100)
-- breaks that assumption: the actor is the *admin* approving someone
-- else's claim, who never holds a business role at that venue at all.
-- venues_guard_owner_write() rejected the cascading update outright —
-- "venues are not directly editable" — so approval silently failed to
-- ever flip `claimed`, caught live while verifying this migration rather
-- than shipped.
--
-- Fixed with an explicit, narrow bypass rather than loosening the actor
-- check: business_roles_mark_venue_claimed() sets a transaction-local flag
-- immediately before its own cascading write and clears it right after, and
-- venues_guard_owner_write() trusts that specific flag and nothing broader
-- (not "any nested trigger", which would also wave through anything else
-- that happens to call into venues from inside a trigger later). The flag
-- grants exactly the one write this function already made on its own
-- before this bug existed — nothing else.
--
-- Also drops `claimed` from the set a business account may write directly:
-- with self-serve claiming retired, there is no legitimate reason left for
-- an owner/manager's own UPDATE to touch it — every real path onto
-- `claimed` now goes through this same system-write bypass instead.

create or replace function business_roles_mark_venue_claimed() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('nightout.system_write', 'venues.claimed', true);
  update public.venues set claimed = true where id = new.venue_id;
  perform set_config('nightout.system_write', '', true);
  return new;
end;
$$;

create or replace function venues_guard_owner_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('nightout.system_write', true), '') = 'venues.claimed' then
    if (to_jsonb(new) - array['claimed', 'updated_at']) is distinct from (to_jsonb(old) - array['claimed', 'updated_at']) then
      raise exception 'the system-write bypass may only flip claimed';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if private.holds_platform_role(array['trust_safety']::public.platform_role[]) then
    if (to_jsonb(new) - array['consumer_alert', 'contribution_frozen', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['consumer_alert', 'contribution_frozen', 'updated_at']) then
      raise exception 'trust & safety may only write the consumer alert and contribution freeze here';
    end if;
    if new.consumer_alert is distinct from old.consumer_alert then
      insert into public.moderation_actions (actor_id, action, venue_id, note)
      values (
        auth.uid(),
        (case when new.consumer_alert is null then 'consumer_alert_cleared' else 'consumer_alert_applied' end)::public.moderation_action_kind,
        new.id,
        new.consumer_alert
      );
    end if;
    if new.contribution_frozen is distinct from old.contribution_frozen then
      insert into public.moderation_actions (actor_id, action, venue_id)
      values (
        auth.uid(),
        (case when new.contribution_frozen then 'contribution_frozen' else 'contribution_unfrozen' end)::public.moderation_action_kind,
        new.id
      );
    end if;
    new.updated_at := now();
    return new;
  end if;

  if not private.holds_business_role(new.id) then
    raise exception 'venues are not directly editable';
  end if;
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'menus', 'tagline', 'about', 'search_text', 'auto_response_text', 'review_alert_threshold', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'menus', 'tagline', 'about', 'search_text', 'auto_response_text', 'review_alert_threshold', 'updated_at']) then
    raise exception 'a business account may only write hours, happy hours, menus, tagline, about, the auto-response, and the review alert threshold here';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

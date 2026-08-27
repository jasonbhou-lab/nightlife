-- F-BIZ-07, the remaining half: alerting on new reviews below a threshold.
-- The response composer already exists (20260825150000_add_review_response.sql).
-- Sentiment summary and keyword themes still need real NLP infrastructure
-- this build does not have, same reasoning as that migration's header.
-- Alerting doesn't need that: it's a threshold a business account sets,
-- checked against a review's own rating and whether it already has an
-- owner_response — both columns that already exist. No push notifications
-- exist anywhere in this build (see F-MSG-01/02's own scoping), so
-- "alerting" here means what it already means for the moderation queue and
-- the bookings console: a count surfaced in the business portal, not an
-- out-of-band notification.

alter table venues add column review_alert_threshold numeric
  check (review_alert_threshold is null or (review_alert_threshold between 1 and 5));

-- Extends the same business-role branch venues_guard_owner_write already
-- has (see 20260827090000_add_business_messaging.sql) with one more column.
create or replace function venues_guard_owner_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'menus', 'claimed', 'tagline', 'about', 'search_text', 'auto_response_text', 'review_alert_threshold', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'menus', 'claimed', 'tagline', 'about', 'search_text', 'auto_response_text', 'review_alert_threshold', 'updated_at']) then
    raise exception 'a business account may only write hours, happy hours, menus, claimed, tagline, about, the auto-response, and the review alert threshold here';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

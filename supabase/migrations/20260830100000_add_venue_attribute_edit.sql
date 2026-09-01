-- F-BIZ-03 (full): the typed attribute registry itself becomes owner-editable,
-- not just tagline/about. Every prior migration that scoped this down said
-- the same thing -- see 20260825190000_add_venue_listing_edit.sql,
-- 20260825160000_add_venue_hours_edit.sql, 20260825170000_add_venue_menu_edit.sql:
-- "a real, separate feature, not something to rush." This is that feature.
--
-- Two things a client-submitted `attributes` write cannot be trusted with, so
-- neither is ever read from the client at all:
--
--   1. Provenance. attribute_meta's source/updatedAt is what
--      src/lib/format.ts's freshness()/provenanceLabel renders to every
--      consumer as "Owner-provided, 2 days ago" -- a trust signal, not a
--      cosmetic label. A client that could set its own updatedAt could claim
--      any stale value as freshly confirmed; one that could set its own
--      source could claim a self-report as "operator_verified". So
--      attribute_meta is computed here, not accepted from the client: every
--      key whose value actually changed gets source='owner',
--      updatedAt=current_date, unconditionally, regardless of whatever the
--      client sent for that column. Keys that did not change keep whatever
--      meta they already had. In practice the client never even sends
--      attribute_meta -- updateVenueAttributes() only ever writes
--      `attributes` -- but the trigger does not rely on that; it overwrites
--      attribute_meta outright rather than trusting the client's omission.
--
--   2. History. Every write that actually changes attributes logs the state
--      immediately before the change to venue_attribute_history, so "what
--      did this used to say, and who changed it" is answerable and a bad
--      edit is recoverable. Rollback is not a special code path -- it is
--      updateVenueAttributes() called again with an old snapshot's values,
--      which itself logs a new history row for the state right before the
--      rollback, the same as any other edit.

create table venue_attribute_history (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  previous_attributes jsonb not null,
  previous_meta jsonb not null
);

create index venue_attribute_history_venue_changed_idx
  on venue_attribute_history (venue_id, changed_at desc);

alter table venue_attribute_history enable row level security;

-- Populated only by venues_guard_owner_write() below (SECURITY DEFINER, the
-- same shape moderation_actions already uses) -- no client-facing insert,
-- update, or delete path exists on this table at all.
create policy venue_attribute_history_business_read on venue_attribute_history
  for select to authenticated
  using (private.holds_business_role(venue_id));

create or replace function public.venues_guard_owner_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  k text;
  computed_meta jsonb;
  attrs_changed boolean := false;
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
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'menus', 'tagline', 'about', 'search_text', 'auto_response_text', 'review_alert_threshold', 'attributes', 'attribute_meta', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'menus', 'tagline', 'about', 'search_text', 'auto_response_text', 'review_alert_threshold', 'attributes', 'attribute_meta', 'updated_at']) then
    raise exception 'a business account may only write hours, happy hours, menus, tagline, about, the auto-response, the review alert threshold, and attributes here';
  end if;

  computed_meta := coalesce(old.attribute_meta, '{}'::jsonb);
  for k in
    select key from (
      select jsonb_object_keys(coalesce(old.attributes, '{}'::jsonb)) as key
      union
      select jsonb_object_keys(coalesce(new.attributes, '{}'::jsonb)) as key
    ) all_keys
  loop
    if (coalesce(new.attributes, '{}'::jsonb) -> k) is distinct from (coalesce(old.attributes, '{}'::jsonb) -> k) then
      attrs_changed := true;
      if (coalesce(new.attributes, '{}'::jsonb) -> k) is null or (coalesce(new.attributes, '{}'::jsonb) -> k) = 'null'::jsonb then
        computed_meta := computed_meta - k;
      else
        computed_meta := jsonb_set(
          computed_meta,
          array[k],
          jsonb_build_object('source', 'owner', 'updatedAt', to_char(current_date, 'YYYY-MM-DD')),
          true
        );
      end if;
    end if;
  end loop;
  new.attribute_meta := computed_meta;

  if attrs_changed then
    insert into public.venue_attribute_history (venue_id, changed_by, previous_attributes, previous_meta)
    values (old.id, auth.uid(), coalesce(old.attributes, '{}'::jsonb), coalesce(old.attribute_meta, '{}'::jsonb));
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

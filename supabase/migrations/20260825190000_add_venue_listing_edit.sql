-- F-BIZ-03 (scoped way down): tagline and about only. The full requirement
-- is a listing editor covering every Section 3 typed attribute with change
-- history and rollback -- dozens of fields across enum, multi-select,
-- currency, and time types, each per-category, plus a history table this
-- build does not have. That is a real, separate feature, not something to
-- rush alongside two free-text fields. tagline/about carry no per-field
-- provenance tracking the way typed attributes do (no attribute_meta entry
-- exists for either), so there is nothing else this migration needs to
-- touch.
--
-- Extends the same jsonb-diff venue guard every prior F-BIZ venue-write
-- feature has used, rather than a new one.
--
-- Caught by directly exercising this under RLS before it shipped: tagline
-- feeds `search_text`, which venues_before_write_trg (the original schema's
-- own trigger, alphabetically before this one so it runs first) recomputes
-- on every write. That makes `search_text` a legitimate side effect of a
-- tagline change, not something a client sets directly, so it belongs in
-- the allowlist alongside tagline itself -- the first version of this
-- migration did not include it and rejected every tagline edit outright.

create or replace function venues_guard_owner_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.holds_business_role(new.id) then
    raise exception 'venues are not directly editable';
  end if;
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'menus', 'claimed', 'tagline', 'about', 'search_text', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'menus', 'claimed', 'tagline', 'about', 'search_text', 'updated_at']) then
    raise exception 'a business account may only write hours, happy hours, menus, claimed, tagline, and about here';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

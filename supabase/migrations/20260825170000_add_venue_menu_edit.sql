-- F-BIZ-05 (scoped): manual menu and tap-list editing only. Import from
-- CSV, PDF, or photo needs real OCR/parsing infrastructure this build does
-- not have -- the same reason F-MEDIA-02's automated photo classification
-- is out of scope. A business account can add, edit, and remove menu
-- sections and items, and flip `soldOut` on a rotating tap the moment it
-- kicks, all by typing, which is honest about what this client can
-- actually do.
--
-- Extends the same jsonb-diff guard 20260825160000_add_venue_hours_edit.sql
-- introduced, rather than a second parallel trigger -- one venue-write
-- guard, one growing allowlist, not two competing ones.

create or replace function venues_guard_owner_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.holds_business_role(new.id) then
    raise exception 'venues are not directly editable';
  end if;
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'menus', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'menus', 'updated_at']) then
    raise exception 'a business account may only write hours, happy hours, and menus here';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

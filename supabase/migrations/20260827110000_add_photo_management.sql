-- F-BIZ-06 / F-MEDIA-06: "Owner ability to select a cover photo and to
-- reorder owner-uploaded media, but not to delete or reorder community
-- media." The Photo type has carried a comment anticipating exactly this
-- since the original photos migration ("Owner media can be reordered by the
-- owner; community media cannot") but nothing implemented it -- the
-- original migration's own header explains why: "once posted, a photo is
-- immutable from the client," no update policy at all.
--
-- Scoped: cover selection is restricted to owner-uploaded photos too, not
-- any public-read photo a business might like the look of. The PRD sentence
-- draws the reorder line at community media; treating cover selection the
-- same way keeps one rule instead of two, and keeps community photos
-- genuinely untouchable by a business account through this door, which is
-- the actual protection F-MEDIA-06 is asking for.
--
-- Also fixes something this surfaced: the photo fetch in repository.ts had
-- no `.order()` clause at all, so gallery order was undefined -- whatever
-- Postgres happened to return, not a real sort. That is fixed alongside
-- this migration by adding an explicit order to the fetch.

alter table photos add column sort_order integer not null default 0;
alter table photos add column is_cover boolean not null default false;

create index photos_venue_order on photos (venue_id, is_cover desc, sort_order, created_at);

-- A business account may update only its own venue's owner-credited photos,
-- and only sort_order/is_cover -- never caption, album, storage_path, or
-- anyone else's row. The `by = 'owner'` condition here is what keeps
-- community photos out of reach even though holds_business_role(venue_id)
-- alone would otherwise be broad enough to touch them.
create policy photos_business_update on photos
  for update to authenticated
  using (by = 'owner' and private.holds_business_role(venue_id))
  with check (by = 'owner' and private.holds_business_role(venue_id));

create or replace function photos_guard_business_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['sort_order', 'is_cover'])
     is distinct from
     (to_jsonb(old) - array['sort_order', 'is_cover']) then
    raise exception 'a business account may only change sort order and cover selection here';
  end if;
  return new;
end;
$$;

create trigger photos_guard_business_write_trg
  before update on photos
  for each row execute function photos_guard_business_write();

-- At most one cover photo per venue. Setting is_cover true on one photo
-- clears it on every other photo at that venue -- no security definer
-- needed, since every row this touches is, by construction, already an
-- owner-credited photo at a venue the acting account manages (the only way
-- is_cover can ever be true is through photos_business_update above), so
-- the normal policy already covers it.
create or replace function photos_enforce_single_cover() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.photos set is_cover = false
  where venue_id = new.venue_id and id <> new.id and is_cover;
  return new;
end;
$$;

create trigger photos_enforce_single_cover_trg
  after update of is_cover on photos
  for each row
  when (new.is_cover)
  execute function photos_enforce_single_cover();

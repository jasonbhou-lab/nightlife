-- F-BIZ-09 (scoped): a business posts a short-lived, self-published offer
-- on its own venue profile -- first-visit incentive, no-cover-before-9,
-- membership special, that kind of thing. Deliberately not built as an
-- alcohol/tobacco price-advertising system: happy hour publishing already
-- exists (F-BIZ-04) with its own per-jurisdiction pricing disclaimer, and
-- this table carries the same one rather than trying to enforce rules that
-- vary state by state, the same honesty already applied there. Also not
-- built: F-BIZ-10's paid advertising/targeting -- this is the venue's own
-- announcement, not a purchased placement, so there is no budget, no
-- targeting, and no ranking boost tied to it.
--
-- Unlike schedules/happy_hours/menus, offers are naturally a list with a
-- lifecycle (created, expires, removed early) rather than one blob a
-- business rewrites wholesale, so this is a real table with its own RLS --
-- the same shape as photos and business_invites, not another jsonb-diff
-- venue-write guard.

create table venue_offers (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  title text not null,
  description text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index venue_offers_venue on venue_offers (venue_id);

alter table venue_offers enable row level security;

-- Public read, same as venues/reviews/photos -- browsing never requires an
-- account (U-02), and an offer is only useful if a guest can see it.
create policy venue_offers_public_read on venue_offers
  for select to anon, authenticated using (true);

create policy venue_offers_insert on venue_offers
  for insert to authenticated
  with check (created_by = auth.uid() and private.holds_business_role(venue_id));

create policy venue_offers_update on venue_offers
  for update to authenticated
  using (private.holds_business_role(venue_id))
  with check (private.holds_business_role(venue_id));

create policy venue_offers_delete on venue_offers
  for delete to authenticated
  using (private.holds_business_role(venue_id));

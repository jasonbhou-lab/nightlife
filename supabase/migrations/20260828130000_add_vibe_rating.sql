-- Vibe Rating: a second 1-5 rating axis, energy/atmosphere rather than
-- quality, given the exact same treatment as the star rating (`rating`) —
-- same input shape (a mandatory smallint per review), same storage shape (a
-- numeric(2,1) rollup on venues), and the same lack of a server-side
-- recompute trigger `rating` already has (the client aggregates client-side
-- via `aggregateFor`, same as the analytics rollups in
-- 20260827130000_add_venue_analytics.sql).

-- venues.vibe_rating: a static, seeded rollup, same as venues.rating. No
-- historical value exists yet, so it defaults to 0 like rating does.
alter table venues
  add column vibe_rating numeric(2,1) not null default 0
    check (vibe_rating >= 0 and vibe_rating <= 5);

create index venues_vibe_rating on venues (vibe_rating desc);

-- reviews.vibe_rating: added nullable, backfilled from the review's own star
-- rating (the only signal available for reviews written before this axis
-- existed), then locked to not-null so every review submitted from here on
-- must carry one, exactly like `rating`.
alter table reviews add column vibe_rating smallint;
update reviews set vibe_rating = rating where vibe_rating is null;
alter table reviews alter column vibe_rating set not null;
alter table reviews add constraint reviews_vibe_rating_range check (vibe_rating between 1 and 5);

-- review_drafts.vibe_rating: nullable, same as the draft's own `rating` column.
alter table review_drafts add column vibe_rating smallint;

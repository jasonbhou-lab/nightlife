-- ad_campaigns.id is a real uuid for actual submissions, generated at
-- insert time -- exactly the shape reviews already has. The generated seed
-- script (scripts/generate-seed-sql.ts) needs a stable natural key to make
-- reseeding idempotent, the same reason reviews carries seed_key instead of
-- upserting on its own uuid id.
alter table ad_campaigns add column seed_key text unique;

update ad_campaigns set seed_key = 'ac-kirby3-1' where venue_id = 'kirby3' and headline like 'Reserve your booth%';
update ad_campaigns set seed_key = 'ac-zafeera-1' where venue_id = 'zafeera' and headline like '46 shisha flavors%';

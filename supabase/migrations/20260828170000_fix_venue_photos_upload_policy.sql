-- Security fix: the venue-photos upload policy checked the wrong column.
--
-- The original WITH CHECK read:
--
--   exists (select 1 from venues v where v.id = (storage.foldername(v.name))[1])
--
-- The intent (README, F-MEDIA-01) was "the first path segment of the object
-- being uploaded must be a real venue id". But `venues` also has a `name`
-- column, so the unqualified `name` inside that subquery bound to the
-- *venue's display name* rather than to storage.objects.name. Classic
-- correlated-subquery shadowing: the predicate never referenced the upload at
-- all, so it evaluated the same way for every object in the bucket.
--
-- With the current seed data no venue name contains a '/', so
-- storage.foldername(v.name) returns an empty array, subscript [1] is null,
-- `v.id = null` is null, and the EXISTS is false — the policy has been
-- denying *every* photo upload (a silent break of F-MEDIA-01), while the
-- documented path check was never actually enforced. Had any venue name
-- contained a '/' whose leading segment matched some venue id, the same
-- predicate would have flipped to true for every upload at once, letting any
-- signed-in account write to any path in the bucket. Deny-all and allow-all
-- were both one row of unrelated data away.
--
-- The rewrite below evaluates `name` at the top level of the policy, where it
-- unambiguously means storage.objects.name, and uses the venues subquery only
-- to supply ids — so nothing can shadow it again. Verified against the paths
-- uploadVenuePhoto actually writes (`<venueId>/<timestamp>-<rand>.jpg`):
-- a real venue prefix passes; '../evil/x.html', an unknown venue prefix, and a
-- bare root-level file are all rejected.

drop policy if exists venue_photos_insert_own on storage.objects;

create policy venue_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'venue-photos'
    and (storage.foldername(name))[1] in (select id from public.venues)
  );

-- The bucket is public-read and had neither a size cap nor a MIME allowlist,
-- so an authenticated account could store an object of any size and any type
-- and then serve it from the project's own storage origin — an arbitrary-file
-- host useful for phishing pages or a stored-XSS payload (text/html, or an
-- SVG carrying script), plus unbounded storage cost. The photos table's daily
-- upload cap is a trigger on the metadata row and does not constrain a direct
-- storage write, so this has to be enforced on the bucket itself.
--
-- 10 MiB matches what the client already produces: uploadVenuePhoto sends a
-- re-encoded image/jpeg blob, and expo-image-manipulator compresses before it
-- ever reaches here.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
 where id = 'venue-photos';

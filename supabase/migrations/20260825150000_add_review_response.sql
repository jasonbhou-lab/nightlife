-- F-BIZ-07 (scoped): review response composer only. The full requirement
-- also asks for sentiment summary, keyword themes, and alerting on new
-- reviews below a threshold — those need real analytics/ML infrastructure
-- this build does not have, for the same reason F-MEDIA-02/03's automated
-- classification and screening are out of scope. A response composer is
-- honest to build on its own: it is exactly the column this schema already
-- reserved for it (`reviews.owner_response`, present since the very first
-- migration) and the exact thing its own guard trigger already named —
-- "owner responses are written through the business portal" — with no
-- portal having existed yet to write through.
--
-- Only a business_roles holder for the review's own venue may write these
-- two columns, and only these two columns: the guard trigger below rejects
-- an update from that account that touches anything else on the row, so
-- there is no way for "respond to this review" to become "edit this
-- review." The existing author-only path is unchanged.

create policy reviews_owner_respond on reviews
  for update to authenticated
  using (private.holds_business_role(venue_id))
  with check (private.holds_business_role(venue_id));

create or replace function reviews_guard_privileged_columns() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.holds_business_role(new.venue_id) then
    if new.author_id is distinct from old.author_id
       or new.body is distinct from old.body
       or new.rating is distinct from old.rating
       or new.sub_ratings is distinct from old.sub_ratings
       or new.tags is distinct from old.tags
       or new.recommended is distinct from old.recommended
       or new.helpful is distinct from old.helpful
       or new.insightful is distinct from old.insightful
       or new.funny is distinct from old.funny
       or new.comped is distinct from old.comped
       or new.edited is distinct from old.edited then
      raise exception 'a business account may only write the owner response';
    end if;
    if new.owner_response is distinct from old.owner_response then
      new.owner_response_at := now();
    end if;
    return new;
  end if;

  if new.recommended is distinct from old.recommended then
    raise exception 'review recommendation state is set by the platform';
  end if;
  if new.owner_response is distinct from old.owner_response then
    raise exception 'owner responses are written through the business portal';
  end if;
  if new.helpful is distinct from old.helpful
     or new.insightful is distinct from old.insightful
     or new.funny is distinct from old.funny then
    raise exception 'community feedback counts are maintained by the platform';
  end if;
  new.edited := true;
  return new;
end;
$$;

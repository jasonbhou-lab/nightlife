-- Real account deletion (Apple Guideline 5.1.1(v): an app that supports
-- account creation must support account deletion in the app, not a support
-- ticket). The client previously showed a confirmation dialog promising this
-- and then only called signOut() -- the account, and everything in it,
-- was still there on the next sign-in.
--
-- profiles.id has no formal foreign key to auth.users (checked: zero
-- constraints reference auth.users from this schema), so both rows are
-- deleted explicitly, profiles first. Every table that references
-- profiles(id) already does so ON DELETE CASCADE or ON DELETE SET NULL --
-- verified against pg_constraint before writing this, and simulated with
-- BEGIN/ROLLBACK against a real profile -- so deleting the profiles row
-- alone already removes bookings, collections, message threads, photos,
-- review drafts, business roles, platform roles, and this account's venue
-- claims and offers, while reviews and moderation history keep existing
-- rows with author_id/actor_id set to null rather than disappearing, the
-- same "the record is real, the identity isn't" pattern content_reports and
-- venue_claims already use elsewhere in this schema.
--
-- Out of scope, on purpose: the storage.objects rows for this account's
-- uploaded photos are not swept here. This build has no established path for
-- that at all yet -- photo_removal_requests is itself only ever a filed
-- request, never auto-executed (see its migration header) -- so this does
-- not regress anything that worked before; it is a real, separate gap.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;

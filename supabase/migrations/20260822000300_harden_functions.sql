-- Clears every finding from the Supabase security advisor after the initial
-- migration. Two distinct problems, two distinct fixes.
--
-- 1. Four trigger functions had a role-mutable search_path. On a trigger
--    function that is a privilege-escalation vector: a caller who can influence
--    the path can shadow an unqualified reference. These four resolve nothing
--    outside pg_catalog, so an empty path is safe and exact.
--
-- 2. Four SECURITY DEFINER functions were reachable as public REST endpoints at
--    /rest/v1/rpc/... Two of them were genuinely leaky: is_verified(uid) and
--    holds_business_role(uid, vid) took a user id, so anyone holding the
--    publishable key could ask whether an arbitrary account was verified, or
--    which venues an arbitrary account held a business role at -- reading
--    straight past the RLS on profiles and business_roles.
--
--    They now derive the caller from auth.uid() and take no user id, so a caller
--    can only ask about themselves, and they live in a `private` schema that
--    PostgREST does not expose, so they are not endpoints at all. Revoking
--    EXECUTE was not an option: RLS policy expressions evaluate as the querying
--    role, which therefore must be able to execute them.
--
--    handle_new_user() and sync_venue_categories() are trigger-only. Triggers
--    fire as the table owner, so no caller needs the privilege. Note the revoke
--    must target PUBLIC: EXECUTE is granted to PUBLIC by default, so revoking
--    from anon and authenticated individually accomplishes nothing.

alter function venues_before_write() set search_path = '';
alter function profiles_guard_privileged_columns() set search_path = '';
alter function reviews_enforce_submission_rules() set search_path = '';
alter function reviews_guard_privileged_columns() set search_path = '';

revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function sync_venue_categories() from public, anon, authenticated;

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Policies must be dropped before the functions they reference can be replaced.
drop policy if exists reviews_insert_own on reviews;
drop policy if exists bookings_own on bookings;

drop function if exists public.is_verified(uuid);
drop function if exists public.holds_business_role(uuid, text);
drop function if exists public.is_verified();
drop function if exists public.holds_business_role(text);

create or replace function private.is_verified() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select phone_verified and age_verified from profiles where id = auth.uid()),
    false
  );
$$;

create or replace function private.holds_business_role(vid text) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from business_roles
    where user_id = auth.uid() and venue_id = vid
  );
$$;

-- R3 plus F-TRUST-06: a verified account, your own authorship, and no business
-- role at the venue you are reviewing.
create policy reviews_insert_own on reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and private.is_verified()
    and not private.holds_business_role(venue_id)
  );

create policy bookings_own on bookings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.is_verified());

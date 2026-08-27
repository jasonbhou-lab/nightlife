-- Google sign-in: extend handle_new_user() so a first-time Google account
-- gets a real display name instead of the literal fallback "Guest".
--
-- handle_new_user() has only ever read `raw_user_meta_data->>'display_name'`
-- because that was the only path onto an account (sendSignInCode sets it
-- explicitly in signInWithOtp's options.data). Google's OAuth consent flow
-- populates raw_user_meta_data with `full_name` and `name` instead — Supabase
-- itself puts them there from Google's ID token, this app sets neither —  so
-- without this change every Google sign-in would read a real person's name
-- straight through Google's own consent screen and then throw it away.

create or replace function handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      'Guest'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

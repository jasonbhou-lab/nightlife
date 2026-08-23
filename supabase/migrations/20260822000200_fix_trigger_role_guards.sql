-- The submission and privileged-column guards were keyed on
--   current_setting('role', true) <> 'service_role'
-- which is wrong in the direction that matters. PostgREST sets the role per
-- request (SET LOCAL ROLE anon | authenticated), so client traffic is caught
-- either way. But an administrative or migration connection reports the role
-- GUC as 'none', which is also <> 'service_role', so the guards fired on
-- server-side writes too.
--
-- Caught while seeding: the 60-character submission floor would have rejected
-- the two short spam reviews outright, and the guard would have force-set
-- `recommended = true` on all five of them and nulled six owner responses --
-- silently destroying exactly the data F-REVIEW-07 exists to demonstrate.
--
-- Test for the client-facing roles explicitly instead. Anything that is not a
-- PostgREST client request (seeding, provider imports, admin work) bypasses the
-- guards, which is what the original comments described.

drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged
  before update on profiles
  for each row
  when (current_setting('role', true) in ('anon', 'authenticated'))
  execute function profiles_guard_privileged_columns();

drop trigger if exists reviews_enforce_submission on reviews;
create trigger reviews_enforce_submission
  before insert on reviews
  for each row
  when (current_setting('role', true) in ('anon', 'authenticated'))
  execute function reviews_enforce_submission_rules();

drop trigger if exists reviews_guard_privileged on reviews;
create trigger reviews_guard_privileged
  before update on reviews
  for each row
  when (current_setting('role', true) in ('anon', 'authenticated'))
  execute function reviews_guard_privileged_columns();

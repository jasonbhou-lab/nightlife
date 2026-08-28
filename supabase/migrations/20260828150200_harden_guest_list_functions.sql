-- bookings_enforce_guest_list_rules() is a trigger function, not something
-- any client should call directly -- PostgREST exposes every public-schema
-- function as an RPC endpoint by default, which is what surfaced this.
-- Trigger firing does not require an EXECUTE grant, so revoking it here
-- only closes the direct-call path; guest_list_count() is left untouched,
-- since a publicly callable capacity count is the entire point of it.
revoke execute on function public.bookings_enforce_guest_list_rules() from public, anon, authenticated;

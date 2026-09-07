-- dm_threads_normalize, dm_threads_guard_update, and dm_messages_touch_thread
-- exist only to be invoked by their own triggers, the same as
-- bookings_enforce_guest_list_rules before it (see
-- 20260828150200_harden_guest_list_functions.sql) -- but a SECURITY DEFINER
-- function is auto-exposed by PostgREST as /rest/v1/rpc/<name> unless EXECUTE
-- is revoked, which get_advisors flagged for all three after the previous
-- migration. Trigger firing needs no EXECUTE grant to the querying role at
-- all, so revoking it here changes nothing about how these actually run.
revoke execute on function public.dm_threads_normalize() from public, anon, authenticated;
revoke execute on function public.dm_threads_guard_update() from public, anon, authenticated;
revoke execute on function public.dm_messages_touch_thread() from public, anon, authenticated;

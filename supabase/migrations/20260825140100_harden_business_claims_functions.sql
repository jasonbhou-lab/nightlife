-- business_roles_guard_claim() and business_roles_mark_venue_claimed() are
-- trigger-only. Triggers fire as the table owner, so no caller needs the
-- privilege -- revoke from PUBLIC, since EXECUTE is granted there by default
-- and revoking from anon/authenticated individually accomplishes nothing.

revoke execute on function business_roles_guard_claim() from public, anon, authenticated;
revoke execute on function business_roles_mark_venue_claimed() from public, anon, authenticated;

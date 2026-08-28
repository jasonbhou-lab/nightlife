-- F-BOOK-07: guest list requests need their own booking_mode rather than
-- continuing to borrow 'waitlist' (the stub this replaces -- see
-- 20260828150100_add_guest_list_rules.sql for the real logic). Postgres
-- cannot reference a newly added enum value in the same transaction that
-- adds it, so this is its own migration, the same split already used for
-- 'admin' in 20260828100000_add_admin_platform_role.sql.
alter type booking_mode add value 'guest_list';

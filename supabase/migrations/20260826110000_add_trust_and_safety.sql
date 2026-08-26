-- F-TRUST, scoped: this is a new kind of actor for this schema. Every prior
-- F-BIZ migration added a *business* role, self-claimable by whoever signs
-- in and asserts it, checked against the venue's own claim state. A platform
-- role (moderator, trust & safety) cannot work that way -- there is no
-- honest self-serve claim for "trust me, I work here," and F-ADMIN's role
-- and entitlement management (R16) is out of scope for this client, the
-- same reason F-BIZ-14 and F-TRUST-02/05/07 are out of scope elsewhere.
-- platform_roles therefore has no insert policy at all: a row is granted
-- directly in the database, exactly the same honest gap as `elite`/`trust`
-- on profiles having no client-side path to earn them either.
--
-- Scoped out of F-TRUST entirely, and why:
--  - F-TRUST-02 (automated pre-screening) and F-TRUST-05 (coordinated-
--    behavior detection) need real ML/heuristics infrastructure this build
--    does not have, the same reason F-MEDIA-02/03 and F-BIZ-08 are out.
--  - F-TRUST-03 (appeal flow "reviewed by a different person") needs a
--    second, distinct reviewer identity and a case-assignment model on top
--    of what's built here -- a real, separate feature, not something to
--    rush alongside the queue itself.
--  - F-TRUST-07 (transparency reporting) is priority C and needs aggregate
--    reporting this build has no dashboard for.
--  - Photos and Q&A are not in the report queue. Reviews are the only
--    content type with a real report entry point in this client
--    (F-MEDIA-04's photo removal-request flow is a different, already-real
--    mechanism); extending the queue to other content types is future work.
--  - Proactive, non-report-driven removal is out too: every removal and
--    restore here resolves a specific content_reports row, so there is
--    always something on file explaining why. A moderator patrolling for
--    content with no report yet would have to file one first; there is no
--    separate "just remove this" door.
--
-- What's real: F-TRUST-01 as a single reviews queue (no formal per-severity
-- SLA timer, but genuinely segmented from everything else by content type),
-- F-TRUST-04 (Consumer Alerts, plus "freeze contribution on a listing" from
-- R12's own permission description in Section 2.3), and F-TRUST-08 (an
-- insert-only audit table with no update or delete policy at all, and no
-- insert policy for a client either -- every row is written by a
-- SECURITY DEFINER trigger function reacting to an already-RLS-gated client
-- action, never assembled by the client itself. That is the actual meaning
-- of "immutable" here, not just a naming convention).

create type platform_role as enum ('moderator', 'trust_safety');

create type report_reason as enum (
  'not_a_real_visit', 'conflict_of_interest', 'harassment_or_hate_speech',
  'privacy_violation', 'irrelevant_or_promotional'
);

create type report_status as enum ('pending', 'dismissed', 'removed', 'escalated');

create type moderation_action_kind as enum (
  'report_dismissed', 'report_escalated', 'review_removed', 'review_restored',
  'consumer_alert_applied', 'consumer_alert_cleared',
  'contribution_frozen', 'contribution_unfrozen'
);

-- R12: "freeze contribution on a listing." consumer_alert already existed in
-- the initial schema, comment-flagged for Trust & Safety since day one, but
-- nothing has ever written it until this migration.
alter table venues add column contribution_frozen boolean not null default false;

create table platform_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role platform_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table content_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason report_reason not null,
  note text,
  status report_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

-- One report per person per review, the same shape as one review per person
-- per venue -- discourages report-spam without a second table.
create unique index content_reports_one_per_reporter on content_reports (review_id, reporter_id);
create index content_reports_queue on content_reports (status, created_at);

create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  -- set null, not cascade: the audit trail outlives the account that made
  -- the entry, the entire point of F-TRUST-08.
  actor_id uuid references profiles(id) on delete set null,
  action moderation_action_kind not null,
  review_id uuid references reviews(id) on delete set null,
  report_id uuid references content_reports(id) on delete set null,
  venue_id text references venues(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index moderation_actions_recent on moderation_actions (created_at desc);
create index moderation_actions_venue on moderation_actions (venue_id, created_at desc) where venue_id is not null;

alter table platform_roles     enable row level security;
alter table content_reports    enable row level security;
alter table moderation_actions enable row level security;

create policy platform_roles_read_self on platform_roles
  for select to authenticated using (user_id = auth.uid());

-- Derives the caller from auth.uid(), takes no user id, lives in `private` --
-- the same leak-prevention shape as is_verified()/holds_business_role() in
-- 20260822000300_harden_functions.sql, and for the same reason: this gets
-- called from RLS policies on other tables, so any authenticated caller must
-- be able to execute it, but only about themselves.
create or replace function private.holds_platform_role(roles platform_role[]) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_roles where user_id = auth.uid() and role = any(roles)
  );
$$;

create or replace function private.venue_contribution_frozen(vid text) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select contribution_frozen from venues where id = vid), false);
$$;

-- ------------------------------------------------------------ content_reports

create policy content_reports_insert_own on content_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

-- A reporter can see their own report's resolution; a moderator or T&S
-- account can see every report, which is what makes it a queue.
create policy content_reports_read on content_reports
  for select to authenticated
  using (
    reporter_id = auth.uid()
    or private.holds_platform_role(array['moderator', 'trust_safety']::platform_role[])
  );

create policy content_reports_moderate on content_reports
  for update to authenticated
  using (private.holds_platform_role(array['moderator', 'trust_safety']::platform_role[]))
  with check (private.holds_platform_role(array['moderator', 'trust_safety']::platform_role[]));

-- The only thing a client actually does through this table is change
-- `status`; who resolved it and when, the review's own `recommended` flag,
-- and the audit trail are side effects this trigger applies atomically, not
-- something assembled by hand across separate writes that could partially
-- fail or (worse) be called out of order by a client that skips the review
-- update but keeps the audit entry.
--
-- SECURITY DEFINER on purpose: moderation_actions grants no INSERT policy to
-- any client role at all (see the comment at the top of this file), and this
-- function is the only writer. The *entry point* stays fully RLS-gated
-- regardless -- content_reports_moderate above is what the client's own
-- UPDATE statement must pass before this trigger ever runs -- and
-- reviews_guard_privileged_columns below independently re-checks the
-- platform-role condition on its own before touching `recommended`, so nothing
-- here depends on this function's elevated privilege for its actual safety,
-- only for reaching a table the client has no direct door into.
create or replace function content_reports_apply_moderation() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_ts boolean := private.holds_platform_role(array['trust_safety']::platform_role[]);
begin
  if new.status = old.status then
    raise exception 'no status change to apply';
  end if;
  if old.status = 'escalated' and not is_ts then
    raise exception 'only trust & safety may resolve an escalated report';
  end if;
  if old.status = 'removed' and not is_ts then
    raise exception 'only trust & safety may restore a removed review';
  end if;

  new.resolved_by := auth.uid();
  new.resolved_at := now();

  if old.status = 'pending' and new.status = 'escalated' then
    insert into moderation_actions (actor_id, action, review_id, report_id, venue_id)
      select auth.uid(), 'report_escalated', new.review_id, new.id, r.venue_id
      from reviews r where r.id = new.review_id;
  elsif new.status = 'removed' and old.status in ('pending', 'escalated') then
    update reviews set recommended = false where id = new.review_id;
    insert into moderation_actions (actor_id, action, review_id, report_id, venue_id)
      select auth.uid(), 'review_removed', new.review_id, new.id, r.venue_id
      from reviews r where r.id = new.review_id;
  elsif new.status = 'dismissed' and old.status in ('pending', 'escalated') then
    insert into moderation_actions (actor_id, action, review_id, report_id, venue_id)
      select auth.uid(), 'report_dismissed', new.review_id, new.id, r.venue_id
      from reviews r where r.id = new.review_id;
  elsif new.status = 'dismissed' and old.status = 'removed' then
    -- The "restore" path (R11's own wording). Reopening a removed report as
    -- dismissed means exactly that: the removal is reconsidered, nothing
    -- punitive remains in effect.
    update reviews set recommended = true where id = new.review_id;
    insert into moderation_actions (actor_id, action, review_id, report_id, venue_id)
      select auth.uid(), 'review_restored', new.review_id, new.id, r.venue_id
      from reviews r where r.id = new.review_id;
  else
    raise exception 'unsupported report status transition: % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

revoke execute on function content_reports_apply_moderation() from public, anon, authenticated;

create trigger content_reports_moderate_trg
  before update on content_reports
  for each row execute function content_reports_apply_moderation();

-- ----------------------------------------------------------------- reviews

-- A signed-in account should not be blocked from reporting harm by the same
-- wall that gates writing content -- reporting only needs `authenticated`,
-- not private.is_verified() -- so this needed no change. What did: the
-- privileged-column guard now has a second actor.
create or replace function reviews_guard_privileged_columns() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  moderating boolean := private.holds_platform_role(array['moderator', 'trust_safety']::public.platform_role[]);
begin
  if moderating then
    -- Moderation may only flip `recommended`, and only via
    -- content_reports_apply_moderation (this function does not check RLS,
    -- it checks the role directly, so it re-enforces the same boundary
    -- independent of how the call arrived). Everything else on the row --
    -- text, rating, author -- is off limits through this door, the same
    -- jsonb-diff shape the venue guards use.
    if (to_jsonb(new) - 'recommended') is distinct from (to_jsonb(old) - 'recommended') then
      raise exception 'a moderator may only change the recommendation state here';
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

drop policy if exists reviews_insert_own on reviews;
create policy reviews_insert_own on reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and private.is_verified()
    and not private.holds_business_role(venue_id)
    and not private.venue_contribution_frozen(venue_id)
  );

-- ------------------------------------------------------------------ venues

-- Same function, a second actor branch: a trust_safety account may write
-- exactly two columns (consumer_alert, contribution_frozen) and nothing a
-- business account may touch, or vice-versa. Both branches raise if the
-- actor holds neither role, so "venues are not directly editable" still
-- holds for everyone else. SECURITY DEFINER for the same reason as
-- content_reports_apply_moderation above: its own insert into
-- moderation_actions needs a door the client itself does not have. The
-- outer venues UPDATE this trigger reacts to is unaffected -- that is
-- gated by venues_owner_write / venues_trust_safety_write below, evaluated
-- on the client's own statement before this trigger, or this function's
-- privilege, ever enters the picture.
create or replace function venues_guard_owner_write() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.holds_platform_role(array['trust_safety']::public.platform_role[]) then
    if (to_jsonb(new) - array['consumer_alert', 'contribution_frozen', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['consumer_alert', 'contribution_frozen', 'updated_at']) then
      raise exception 'trust & safety may only write the consumer alert and contribution freeze here';
    end if;
    if new.consumer_alert is distinct from old.consumer_alert then
      insert into public.moderation_actions (actor_id, action, venue_id, note)
      values (
        auth.uid(),
        (case when new.consumer_alert is null then 'consumer_alert_cleared' else 'consumer_alert_applied' end)::public.moderation_action_kind,
        new.id,
        new.consumer_alert
      );
    end if;
    if new.contribution_frozen is distinct from old.contribution_frozen then
      insert into public.moderation_actions (actor_id, action, venue_id)
      values (
        auth.uid(),
        (case when new.contribution_frozen then 'contribution_frozen' else 'contribution_unfrozen' end)::public.moderation_action_kind,
        new.id
      );
    end if;
    new.updated_at := now();
    return new;
  end if;

  if not private.holds_business_role(new.id) then
    raise exception 'venues are not directly editable';
  end if;
  if (to_jsonb(new) - array['schedules', 'happy_hours', 'menus', 'claimed', 'tagline', 'about', 'search_text', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['schedules', 'happy_hours', 'menus', 'claimed', 'tagline', 'about', 'search_text', 'updated_at']) then
    raise exception 'a business account may only write hours, happy hours, menus, claimed, tagline, and about here';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function venues_guard_owner_write() from public, anon, authenticated;

create policy venues_trust_safety_write on venues
  for update to authenticated
  using (private.holds_platform_role(array['trust_safety']::platform_role[]))
  with check (private.holds_platform_role(array['trust_safety']::platform_role[]));

-- ---------------------------------------------------------- moderation_actions

create policy moderation_actions_read on moderation_actions
  for select to authenticated
  using (private.holds_platform_role(array['moderator', 'trust_safety']::platform_role[]));

-- Deliberately no insert, update, or delete policy on this table for any
-- client role. Every row is written by the two SECURITY DEFINER trigger
-- functions above; nothing else can reach it at all.

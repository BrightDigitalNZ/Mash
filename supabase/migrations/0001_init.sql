-- Mash: a dating app where your friends do the matching.
--
-- Vocabulary (locked, Brand, Product and Trust Brief, 12 Oct 2026):
--   Mashmaker  the friend who does the matching. Free forever.
--   Catch      anyone single on Mash. Symmetrical role.
--   Machine    the AI layer. One name externally, several agents internally.
--   Mash       an introduction made by a Mashmaker between two Catches.
--   Batch      a set of Catches delivered at once when a Mashmaker nominates.
--   Vouch      the verb for what a Mashmaker does (the note on a nomination).
--
-- Principles enforced here: circle not network (no public layer, no search), consent at
-- every step (asks are rows with a status, nothing is assigned), no ranking of people
-- (positions order a reveal, nothing scores a person), data minimum (hashes not contacts,
-- results not documents, briefs deleted when the mash closes).
--
-- OPEN decisions are switches in app_settings, never assumptions in code.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('catch', 'mashmaker');
create type public.country_code as enum ('NZ', 'AU');
create type public.gender_kind as enum ('woman', 'man', 'non_binary', 'prefer_not_to_say');
create type public.intent_kind as enum ('relationship', 'see_where_it_goes', 'companionship', 'not_sure');
create type public.link_status as enum ('requested', 'accepted', 'declined', 'ended');
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired');
create type public.batch_status as enum ('building', 'consenting', 'ready', 'done');
create type public.consent_status as enum ('pending', 'yes', 'no');
create type public.entry_decision as enum ('undecided', 'meet', 'maybe', 'pass');
create type public.mash_status as enum ('pending', 'mutual', 'declined', 'met', 'closed', 'expired');
create type public.outcome_kind as enum ('meeting', 'met', 'met_again', 'no_show', 'dating', 'together', 'ended', 'not_for_me');
create type public.share_level as enum ('nothing', 'met', 'details');
create type public.visibility_level as enum ('minimal', 'updates');
create type public.report_status as enum ('open', 'reviewed', 'actioned');
create type public.linked_kind as enum ('instagram', 'linkedin', 'website', 'other');
create type public.notification_kind as enum (
  'batch_ready', 'consent_request', 'mash_mutual', 'outcome', 'nudge', 'vouch_received',
  'comment', 'invite_accepted', 'mashmaker_request', 'mashmaker_accepted', 'system'
);

-- ---------------------------------------------------------------------------
-- Server-side switches for OPEN decisions. Changed without a release.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value text not null,
  note text
);

insert into public.app_settings (key, value, note) values
  ('trial_days', '21', 'Length of the free trial for Catches.'),
  ('trial_gate', 'first_batch', 'When the trial clock starts: first_batch or signup. OPEN.'),
  ('dd_requires_plus', 'true', 'Whether the Machine''s due diligence is a paid feature. OPEN.'),
  ('batch_max', '5', 'Nominations per batch. Brief: three to five.'),
  ('verification_mode', 'liveness', 'liveness or id. OPEN.'),
  ('verification_image_retention_days', '7', 'Identity images deleted after this many days.'),
  ('intro_expiry_days', '7', 'A pending mash times out after this many days. Shows as "did not go ahead". OPEN.'),
  ('renomination_block_months', '12', 'A declined, expired or closed pair cannot be re-nominated for this long. OPEN.'),
  ('mashmaker_cap', '0', 'Most Mashmakers a Catch may have. 0 means no cap. OPEN.'),
  ('pause_requires_plus', 'false', 'Whether pausing is a paid feature. OPEN.'),
  ('vouch_min_length', '20', 'Shortest note a Mashmaker may write. Rule 3: say why.');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user). A person is a Catch or a Mashmaker by primary role,
-- and anyone may be a Mashmaker for others.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role,
  first_name text not null default '',
  last_name text not null default '',
  photo_url text,
  date_of_birth date,
  city text,
  country public.country_code,
  bio text,
  -- declared at onboarding, enforced in matching, never shown to others as a badge or filter
  gender public.gender_kind,
  seeking public.gender_kind[] not null default '{}',
  -- own phone, hashed on device, so friends' contact hashes can find this user
  phone_hash text unique,
  -- Consent at every step: being matchable is its own yes, separate from signup
  open_to_matching boolean not null default false,
  -- entitlement: paid, or inside the trial
  is_plus boolean not null default false,
  plus_until timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  paused boolean not null default false,
  onboarding_complete boolean not null default false,
  -- the Machine's verification agent keeps results, never documents
  verified_identity boolean not null default false,
  photos_current boolean not null default false,
  verified_at timestamptz,
  -- "Let the Machine run checks on me": specific, visible in settings
  dd_consent boolean not null default false,
  -- what my Mashmakers learn after an intro. Default minimal.
  mashmaker_visibility public.visibility_level not null default 'minimal',
  -- the rules shown at onboarding, accepted once per role
  catch_rules_accepted_at timestamptz,
  mashmaker_rules_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_adult check (date_of_birth is null or date_of_birth <= (current_date - interval '18 years'))
);

create index profiles_phone_hash_idx on public.profiles (phone_hash);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta->>'full_name', meta->>'name', '');
  gate text := (select value from public.app_settings where key = 'trial_gate');
  days int := coalesce((select value::int from public.app_settings where key = 'trial_days'), 21);
begin
  insert into public.profiles (id, first_name, last_name, photo_url, trial_started_at, trial_ends_at)
  values (
    new.id,
    coalesce(meta->>'first_name', meta->>'given_name', split_part(full_name, ' ', 1), ''),
    coalesce(meta->>'last_name', meta->>'family_name', nullif(regexp_replace(full_name, '^\S+\s*', ''), ''), ''),
    coalesce(meta->>'avatar_url', meta->>'picture'),
    case when gate = 'signup' then now() else null end,
    case when gate = 'signup' then now() + make_interval(days => days) else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Only the service role may change entitlements, verification results or the phone hash.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    new.is_plus := old.is_plus;
    new.plus_until := old.plus_until;
    new.trial_started_at := old.trial_started_at;
    new.trial_ends_at := old.trial_ends_at;
    new.verified_identity := old.verified_identity;
    new.photos_current := old.photos_current;
    new.verified_at := old.verified_at;
    new.phone_hash := old.phone_hash;
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Paid, or inside the trial.
create or replace function public.is_entitled(who uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = who and (p.is_plus or (p.trial_ends_at is not null and p.trial_ends_at > now()))
  );
$$;

-- ---------------------------------------------------------------------------
-- Criteria: what a Catch wants. Shown to their Mashmakers, never to other Catches.
-- ---------------------------------------------------------------------------
create table public.criteria (
  catch_id uuid primary key references public.profiles (id) on delete cascade,
  age_min int not null default 25 check (age_min >= 18),
  age_max int not null default 60 check (age_max >= age_min),
  radius_km int not null default 30 check (radius_km between 5 and 500),
  dealbreakers text[] not null default '{}',
  intent public.intent_kind not null default 'not_sure',
  open_text text,
  updated_at timestamptz not null default now()
);

create trigger criteria_touch before update on public.criteria
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Contact graph. Only hashes, never names or numbers. Non-users are invisible.
-- ---------------------------------------------------------------------------
create table public.contact_hashes (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  hash text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, hash)
);

create index contact_hashes_hash_idx on public.contact_hashes (hash);

-- Exclusion list: people who must never be surfaced to or by this user. Silent, permanent.
create table public.excluded_hashes (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  hash text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, hash)
);

-- A link between two Mash users whose contacts matched. Normalised so user_a < user_b.
create table public.connections (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'contacts',
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint connections_ordered check (user_a < user_b)
);

create index connections_user_b_idx on public.connections (user_b);

-- ---------------------------------------------------------------------------
-- Invites to people not on Mash. Sent from the Mashmaker's own phone, in their words.
-- Stored only as a hash and a pending invite. No profile until they sign in themselves.
-- ---------------------------------------------------------------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_hash text not null,
  invitee_user_id uuid references public.profiles (id) on delete set null,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  message text,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (inviter_id, invitee_hash)
);

create index invites_invitee_hash_idx on public.invites (invitee_hash);

-- ---------------------------------------------------------------------------
-- Mashmaker links. A Catch asks, the Mashmaker accepts. Neither can be assigned.
-- ---------------------------------------------------------------------------
create table public.mashmaker_links (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.profiles (id) on delete cascade,
  mashmaker_id uuid not null references public.profiles (id) on delete cascade,
  status public.link_status not null default 'requested',
  requested_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (catch_id, mashmaker_id),
  constraint link_not_self check (catch_id <> mashmaker_id)
);

create index mashmaker_links_mashmaker_idx on public.mashmaker_links (mashmaker_id, status);

create or replace function public.is_mashmaker_of(mashmaker uuid, catch uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mashmaker_links l
    where l.mashmaker_id = mashmaker and l.catch_id = catch and l.status = 'accepted'
  );
$$;

-- OPEN: a cap on Mashmakers per Catch. 0 means none. Counts asked and accepted.
create or replace function public.under_mashmaker_cap(catch uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_settings where key = 'mashmaker_cap'), '0')::int = 0
    or (select count(*) from public.mashmaker_links l where l.catch_id = catch and l.status in ('requested', 'accepted'))
       < coalesce((select value from public.app_settings where key = 'mashmaker_cap'), '0')::int;
$$;

-- ---------------------------------------------------------------------------
-- Vouches: the Mashmaker's short note on why. Shown to the other Catch word for word.
-- ---------------------------------------------------------------------------
create table public.vouch_prompts (
  id serial primary key,
  text text not null,
  active boolean not null default true
);

insert into public.vouch_prompts (text) values
  ('What would you say about them to someone at a wedding?'),
  ('What do they do that their friends take for granted?'),
  ('Finish this: the thing I would miss most if they moved away is...'),
  ('What is the kindest thing you have seen them do?'),
  ('What do people get wrong about them at first?'),
  ('What are they better at than they think they are?'),
  ('Describe a Sunday with them.'),
  ('What is the one thing their next partner should know?');

create table public.vouches (
  id uuid primary key default gen_random_uuid(),
  mashmaker_id uuid not null references public.profiles (id) on delete cascade,
  catch_id uuid not null references public.profiles (id) on delete cascade,
  prompt_id int references public.vouch_prompts (id),
  prompt text not null,
  text text not null check (char_length(text) between 10 and 400),
  how_known text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mashmaker_id, catch_id),
  constraint vouches_not_self check (mashmaker_id <> catch_id)
);

create index vouches_catch_idx on public.vouches (catch_id);
create trigger vouches_touch before update on public.vouches
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Batches. A Mashmaker nominates up to batch_max Catches from their own circle. The Machine
-- filters mismatches before the Mashmaker sees them and writes the reason for each. Every
-- nominee is asked before the Catch sees them. One batch open at a time.
-- ---------------------------------------------------------------------------
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  mashmaker_id uuid not null references public.profiles (id) on delete cascade,
  catch_id uuid not null references public.profiles (id) on delete cascade,
  status public.batch_status not null default 'building',
  machine_note text,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  done_at timestamptz
);

create index batches_catch_idx on public.batches (catch_id, created_at desc);
create index batches_mashmaker_idx on public.batches (mashmaker_id, created_at desc);

create table public.batch_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  kept boolean not null default true,
  -- reveal order only. Nothing here scores a person.
  position int,
  reason text,
  dropped_reason text,
  mashmaker_overrode boolean not null default false,
  -- the nominee's yes in principle, before the Catch sees them
  consent public.consent_status not null default 'pending',
  consent_at timestamptz,
  decision public.entry_decision not null default 'undecided',
  decided_at timestamptz,
  revealed_at timestamptz,
  unique (batch_id, candidate_id)
);

create index batch_entries_candidate_idx on public.batch_entries (candidate_id);

create table public.batch_comments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  entry_id uuid references public.batch_entries (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);

create index batch_comments_batch_idx on public.batch_comments (batch_id, created_at);

-- ---------------------------------------------------------------------------
-- Mashes (introductions) and chat. Both Catches always know who introduced them.
-- ---------------------------------------------------------------------------
create table public.mashes (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  mashmaker_ids uuid[] not null default '{}',
  batch_entry_id uuid references public.batch_entries (id) on delete set null,
  catch_decision public.entry_decision not null default 'undecided',
  candidate_decision public.entry_decision not null default 'undecided',
  status public.mash_status not null default 'pending',
  created_at timestamptz not null default now(),
  -- a pending mash times out (intro_expiry_days). Nobody is told why, because there is no why.
  expires_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  unique (catch_id, candidate_id),
  constraint mash_not_self check (catch_id <> candidate_id)
);

create index mashes_candidate_idx on public.mashes (candidate_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  mash_id uuid not null references public.mashes (id) on delete cascade,
  -- null sender = the vouch that opens the chat, or a system line
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  is_vouch boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_mash_idx on public.messages (mash_id, created_at);

-- Light report back. "met, going again" is the company's north metric.
-- share: what the Catch's Mashmakers learn about this outcome. Asked each time.
create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  mash_id uuid not null references public.mashes (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  outcome public.outcome_kind not null,
  share public.share_level not null default 'nothing',
  note text,
  when_at timestamptz,
  created_at timestamptz not null default now()
);

create index outcomes_mash_idx on public.outcomes (mash_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Due diligence. Public sources only. Shown only to the Catch who asked. Never to the
-- Mashmaker, never to the subject. Deleted when the mash closes.
-- ---------------------------------------------------------------------------
create table public.linked_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.linked_kind not null,
  url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, url)
);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  mash_id uuid not null references public.mashes (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  unique (mash_id, requester_id)
);

create or replace function public.purge_briefs_on_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('declined', 'closed') and old.status not in ('declined', 'closed') then
    delete from public.briefs where mash_id = new.id;
  end if;
  return new;
end;
$$;

create trigger mashes_purge_briefs after update of status on public.mashes
  for each row execute function public.purge_briefs_on_close();

-- ---------------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text,
  -- what the reporter's Mashmakers learn. The reporter chooses.
  share public.share_level not null default 'nothing',
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Push and in-app notifications
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null default 'ios',
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  body text not null,
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS
-- ---------------------------------------------------------------------------
create or replace function public.are_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections c
    where (c.user_a = least(a, b) and c.user_b = greatest(a, b))
  );
$$;

create or replace function public.is_blocked_either_way(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Either person has the other on their exclusion list.
create or replace function public.is_excluded_either_way(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.excluded_hashes x
    join public.profiles p on p.phone_hash = x.hash
    where (x.owner_id = a and p.id = b) or (x.owner_id = b and p.id = a)
  );
$$;

-- Who may see a profile. There is no public layer.
--   yourself; your Mashmakers and the Catches you Mashmake for (any link state, so a
--   request can be read); a nominee who has said yes and the Catch of that batch;
--   both sides of a mash and its Mashmakers.
create or replace function public.can_see_profile(viewer uuid, target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    viewer = target
    or (
      not public.is_blocked_either_way(viewer, target)
      and (
        public.are_connected(viewer, target)
        or exists (
          select 1 from public.mashmaker_links l
          where (l.catch_id = viewer and l.mashmaker_id = target)
             or (l.mashmaker_id = viewer and l.catch_id = target)
        )
        -- the Catch sees nominees who said yes; the Mashmaker sees their own nominees
        or exists (
          select 1 from public.batch_entries e
          join public.batches b on b.id = e.batch_id
          where e.candidate_id = target and e.kept
            and ((b.catch_id = viewer and e.consent = 'yes') or b.mashmaker_id = viewer)
        )
        -- a nominee sees the Catch and the Mashmaker of the batch they were asked about
        or exists (
          select 1 from public.batch_entries e
          join public.batches b on b.id = e.batch_id
          where e.candidate_id = viewer and e.kept and (b.catch_id = target or b.mashmaker_id = target)
        )
        or exists (
          select 1 from public.mashes m
          where (m.catch_id = viewer and m.candidate_id = target)
             or (m.candidate_id = viewer and m.catch_id = target)
             or (viewer = any(m.mashmaker_ids) and (m.catch_id = target or m.candidate_id = target))
             or (target = any(m.mashmaker_ids) and (m.catch_id = viewer or m.candidate_id = viewer))
        )
      )
    );
$$;

create or replace function public.is_batch_party(batch uuid, who uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.batches b where b.id = batch and (b.catch_id = who or b.mashmaker_id = who)
  );
$$;

create or replace function public.is_mash_party(mash uuid, who uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mashes m
    where m.id = mash and (m.catch_id = who or m.candidate_id = who or who = any(m.mashmaker_ids))
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.criteria enable row level security;
alter table public.contact_hashes enable row level security;
alter table public.excluded_hashes enable row level security;
alter table public.connections enable row level security;
alter table public.invites enable row level security;
alter table public.mashmaker_links enable row level security;
alter table public.vouch_prompts enable row level security;
alter table public.vouches enable row level security;
alter table public.batches enable row level security;
alter table public.batch_entries enable row level security;
alter table public.batch_comments enable row level security;
alter table public.mashes enable row level security;
alter table public.messages enable row level security;
alter table public.outcomes enable row level security;
alter table public.linked_profiles enable row level security;
alter table public.briefs enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;

create policy "app_settings: read" on public.app_settings
  for select using (auth.role() = 'authenticated');

-- profiles
create policy "profiles: read self or linked" on public.profiles
  for select using (public.can_see_profile(auth.uid(), id));
create policy "profiles: update self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- criteria: the Catch and their accepted Mashmakers
create policy "criteria: read self or mashmaker" on public.criteria
  for select using (auth.uid() = catch_id or public.is_mashmaker_of(auth.uid(), catch_id));
create policy "criteria: upsert self" on public.criteria
  for insert with check (auth.uid() = catch_id);
create policy "criteria: update self" on public.criteria
  for update using (auth.uid() = catch_id) with check (auth.uid() = catch_id);

-- contact hashes and exclusions: own rows only
create policy "contact_hashes: own" on public.contact_hashes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "excluded_hashes: own" on public.excluded_hashes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- connections: read your own edges; written by the service role only
create policy "connections: read own" on public.connections
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- invites
create policy "invites: inviter or invitee reads" on public.invites
  for select using (auth.uid() = inviter_id or auth.uid() = invitee_user_id);
create policy "invites: inviter writes" on public.invites
  for insert with check (auth.uid() = inviter_id);
create policy "invites: inviter updates" on public.invites
  for update using (auth.uid() = inviter_id) with check (auth.uid() = inviter_id);
create policy "invites: inviter deletes" on public.invites
  for delete using (auth.uid() = inviter_id);

-- mashmaker links: either side reads; a Catch asks (or a Mashmaker offers); the other answers
create policy "links: parties read" on public.mashmaker_links
  for select using (auth.uid() = catch_id or auth.uid() = mashmaker_id);
create policy "links: ask or offer" on public.mashmaker_links
  for insert with check (
    auth.uid() = requested_by
    and (auth.uid() = catch_id or auth.uid() = mashmaker_id)
    and public.are_connected(catch_id, mashmaker_id)
    and not public.is_blocked_either_way(catch_id, mashmaker_id)
    and public.under_mashmaker_cap(catch_id)
  );
create policy "links: parties update" on public.mashmaker_links
  for update using (auth.uid() = catch_id or auth.uid() = mashmaker_id)
  with check (auth.uid() = catch_id or auth.uid() = mashmaker_id);

create policy "vouch_prompts: read" on public.vouch_prompts
  for select using (auth.role() = 'authenticated');

-- vouches: the Mashmaker, the Catch, and anyone who may see the Catch (a nominee, the other side of a mash)
create policy "vouches: read" on public.vouches
  for select using (auth.uid() = mashmaker_id or auth.uid() = catch_id or public.can_see_profile(auth.uid(), catch_id));
create policy "vouches: mashmaker writes" on public.vouches
  for insert with check (auth.uid() = mashmaker_id and public.is_mashmaker_of(mashmaker_id, catch_id));
create policy "vouches: mashmaker updates" on public.vouches
  for update using (auth.uid() = mashmaker_id) with check (auth.uid() = mashmaker_id);
create policy "vouches: mashmaker deletes" on public.vouches
  for delete using (auth.uid() = mashmaker_id);

-- batches: created by build-batch (service role)
create policy "batches: parties read" on public.batches
  for select using (public.is_batch_party(id, auth.uid()));

-- entries: the Mashmaker sees all; the Catch sees kept entries whose nominee said yes;
-- a nominee sees their own entry (to answer the consent ask)
create policy "batch_entries: read" on public.batch_entries
  for select using (
    exists (select 1 from public.batches b where b.id = batch_id and b.mashmaker_id = auth.uid())
    or (consent = 'yes' and kept and exists (select 1 from public.batches b where b.id = batch_id and b.catch_id = auth.uid()))
    or candidate_id = auth.uid()
  );
create policy "batch_entries: parties update" on public.batch_entries
  for update using (
    candidate_id = auth.uid()
    or exists (select 1 from public.batches b where b.id = batch_id and (b.catch_id = auth.uid() or b.mashmaker_id = auth.uid()))
  ) with check (
    candidate_id = auth.uid()
    or exists (select 1 from public.batches b where b.id = batch_id and (b.catch_id = auth.uid() or b.mashmaker_id = auth.uid()))
  );

create policy "batch_comments: parties read" on public.batch_comments
  for select using (public.is_batch_party(batch_id, auth.uid()));
create policy "batch_comments: parties write" on public.batch_comments
  for insert with check (auth.uid() = author_id and public.is_batch_party(batch_id, auth.uid()));

-- mashes
create policy "mashes: parties read" on public.mashes
  for select using (public.is_mash_party(id, auth.uid()));
create policy "mashes: catches update" on public.mashes
  for update using (auth.uid() = catch_id or auth.uid() = candidate_id)
  with check (auth.uid() = catch_id or auth.uid() = candidate_id);

-- messages: only the two Catches, only once mutual. Mashmakers never read conversations.
create policy "messages: catches read" on public.messages
  for select using (
    exists (select 1 from public.mashes m where m.id = mash_id and (m.catch_id = auth.uid() or m.candidate_id = auth.uid()))
  );
create policy "messages: catches write when mutual" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and not is_vouch
    and exists (
      select 1 from public.mashes m
      where m.id = mash_id
        and m.status in ('mutual', 'met')
        and (m.catch_id = auth.uid() or m.candidate_id = auth.uid())
        and not public.is_blocked_either_way(m.catch_id, m.candidate_id)
    )
  );

-- outcomes: the reporter always; the other Catch; a Mashmaker only what was shared with them
create policy "outcomes: read" on public.outcomes
  for select using (
    auth.uid() = reported_by
    or exists (select 1 from public.mashes m where m.id = mash_id and (m.catch_id = auth.uid() or m.candidate_id = auth.uid()))
    or (share <> 'nothing' and exists (select 1 from public.mashes m where m.id = mash_id and auth.uid() = any(m.mashmaker_ids)))
  );
create policy "outcomes: catches write" on public.outcomes
  for insert with check (
    auth.uid() = reported_by
    and exists (select 1 from public.mashes m where m.id = mash_id and (m.catch_id = auth.uid() or m.candidate_id = auth.uid()))
  );

-- linked profiles: own only. The Machine reads them with the service role, with consent.
create policy "linked_profiles: own" on public.linked_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- briefs: the requester only. Never the subject, never a Mashmaker.
create policy "briefs: requester reads" on public.briefs
  for select using (auth.uid() = requester_id);

create policy "blocks: own" on public.blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
create policy "reports: own insert" on public.reports
  for insert with check (auth.uid() = reporter_id);
create policy "reports: own read" on public.reports
  for select using (auth.uid() = reporter_id);

create policy "push_tokens: own" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications: own read" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications: own update" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.batches;
alter publication supabase_realtime add table public.batch_entries;
alter publication supabase_realtime add table public.batch_comments;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.mashes;
alter publication supabase_realtime add table public.mashmaker_links;

-- ---------------------------------------------------------------------------
-- Storage: profile photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars: owner writes" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars: owner updates" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars: owner deletes" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ---------------------------------------------------------------------------
-- RPCs the app calls directly
-- ---------------------------------------------------------------------------

create or replace function public.current_vouch_prompt()
returns public.vouch_prompts language sql stable as $$
  select * from public.vouch_prompts where active
  order by id
  offset (extract(week from now())::int % greatest((select count(*) from public.vouch_prompts where active), 1))
  limit 1;
$$;

-- Leaving is one tap. Everything cascades.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- A Catch's home: their Mashmakers (accepted and requested) and what they wrote.
create or replace function public.my_mashmakers()
returns table (
  link_id uuid, mashmaker_id uuid, first_name text, photo_url text, status public.link_status,
  requested_by uuid, prompt text, text text, how_known text, created_at timestamptz
) language sql stable security invoker as $$
  select l.id, l.mashmaker_id, p.first_name, p.photo_url, l.status, l.requested_by,
    v.prompt, v.text, v.how_known, l.created_at
  from public.mashmaker_links l
  join public.profiles p on p.id = l.mashmaker_id
  left join public.vouches v on v.mashmaker_id = l.mashmaker_id and v.catch_id = l.catch_id
  where l.catch_id = auth.uid() and l.status in ('requested', 'accepted')
  order by (l.status = 'accepted') desc, l.created_at desc;
$$;

-- A Mashmaker's home: the Catches they Mashmake for, and requests waiting on them.
create or replace function public.my_catches()
returns table (
  link_id uuid, catch_id uuid, first_name text, photo_url text, city text, status public.link_status,
  requested_by uuid, has_vouch boolean, open_batch boolean, batches int, last_batch_at timestamptz
) language sql stable security invoker as $$
  select l.id, p.id, p.first_name, p.photo_url, p.city, l.status, l.requested_by,
    exists (select 1 from public.vouches v where v.mashmaker_id = auth.uid() and v.catch_id = p.id),
    exists (select 1 from public.batches b where b.catch_id = p.id and b.status in ('building', 'consenting', 'ready')),
    (select count(*)::int from public.batches b where b.catch_id = p.id and b.mashmaker_id = auth.uid()),
    (select max(b.created_at) from public.batches b where b.catch_id = p.id and b.mashmaker_id = auth.uid())
  from public.mashmaker_links l
  join public.profiles p on p.id = l.catch_id
  where l.mashmaker_id = auth.uid() and l.status in ('requested', 'accepted')
  order by (l.status = 'requested') desc, l.created_at desc;
$$;

-- Candidates a Mashmaker may nominate for a Catch: their own connections who are Catches,
-- open to matching, not paused, compatible by gender and intent, not excluded or blocked,
-- not already mashed with this Catch. The Machine's matching assist works from this list.
create or replace function public.nominatable_for(catch uuid)
returns table (candidate_id uuid, first_name text, photo_url text, city text, age int)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.photo_url, p.city, date_part('year', age(p.date_of_birth))::int
  from public.profiles p
  join public.profiles c on c.id = catch
  where p.id <> catch
    and p.id <> auth.uid()
    and p.role = 'catch'
    and p.onboarding_complete
    and p.open_to_matching
    and not p.paused
    and public.is_mashmaker_of(auth.uid(), catch)
    and public.are_connected(auth.uid(), p.id)
    and not public.is_blocked_either_way(catch, p.id)
    and not public.is_excluded_either_way(catch, p.id)
    and (c.gender is null or p.seeking = '{}' or c.gender = any(p.seeking))
    and (p.gender is null or c.seeking = '{}' or p.gender = any(c.seeking))
    -- not already in an open mash together, and not re-nominated inside the block period
    and not exists (
      select 1 from public.mashes m
      where ((m.catch_id = catch and m.candidate_id = p.id) or (m.catch_id = p.id and m.candidate_id = catch))
        and (
          m.status in ('pending', 'mutual', 'met')
          or coalesce(m.closed_at, m.created_at) > now() - make_interval(
            months => coalesce((select value from public.app_settings where key = 'renomination_block_months'), '12')::int)
        )
    )
    -- not already sitting in an open batch for this Catch
    and not exists (
      select 1 from public.batch_entries e join public.batches b on b.id = e.batch_id
      where b.catch_id = catch and b.status <> 'done' and e.candidate_id = p.id and e.kept
    )
  order by p.first_name;
$$;

-- The quiet private record: mashes I made and what came of them, at the level each Catch shared.
create or replace function public.my_record()
returns table (
  mash_id uuid, catch_first_name text, candidate_first_name text, status public.mash_status,
  shared_outcome public.outcome_kind, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select m.id, c.first_name, d.first_name, m.status,
    (select o.outcome from public.outcomes o where o.mash_id = m.id and o.share <> 'nothing' order by o.created_at desc limit 1),
    m.created_at
  from public.mashes m
  join public.profiles c on c.id = m.catch_id
  join public.profiles d on d.id = m.candidate_id
  where auth.uid() = any(m.mashmaker_ids)
  order by m.created_at desc;
$$;

-- Pending mashes past their time. Run on a schedule (the nudge function calls it).
-- "This one timed out." Nothing else, to anyone.
create or replace function public.expire_open_mashes()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with x as (
    update public.mashes set status = 'expired', closed_at = now()
    where status = 'pending' and expires_at is not null and expires_at < now()
    returning id
  ) select count(*) into n from x;
  delete from public.briefs b using public.mashes m where b.mash_id = m.id and m.status in ('expired', 'closed', 'declined');
  return n;
end;
$$;

grant execute on function public.current_vouch_prompt() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.my_mashmakers() to authenticated;
grant execute on function public.my_catches() to authenticated;
grant execute on function public.nominatable_for(uuid) to authenticated;
grant execute on function public.my_record() to authenticated;
grant execute on function public.is_entitled(uuid) to authenticated;
grant execute on function public.is_mashmaker_of(uuid, uuid) to authenticated;

-- Mash: friends-of-friends dating for 30 to 50 year olds.
-- One rule: nobody is shown to anybody without a human link between them.
--
-- Privacy design (NZ Privacy Act 2020, AU Privacy Act 1988):
--   * Contact lists never reach the server as names or numbers. The app hashes
--     each E.164 number on device (SHA-256) and uploads only the hashes.
--   * A nominated person who is not on Mash exists only as a hash and a pending invite.
--     No profile row is created until they sign in themselves.
--   * The due-diligence brief is consent-first: only links the subject added, and the
--     subject sees their own brief before it is sent.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('single', 'voucher');
create type public.country_code as enum ('NZ', 'AU');
create type public.intent_kind as enum ('relationship', 'see_where_it_goes', 'companionship', 'not_sure');
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired');
create type public.lineup_status as enum ('building', 'ready', 'done');
create type public.entry_decision as enum ('undecided', 'meet', 'maybe', 'not_this_time');
create type public.intro_status as enum ('pending', 'mutual', 'declined', 'met', 'closed');
create type public.outcome_kind as enum ('meeting', 'met', 'no_show', 'dating', 'together', 'ended', 'not_for_me');
create type public.report_status as enum ('open', 'reviewed', 'actioned');
create type public.linked_kind as enum ('instagram', 'linkedin', 'website', 'other');
create type public.notification_kind as enum (
  'lineup_ready', 'intro_mutual', 'outcome', 'nudge', 'vouch_received', 'comment', 'invite_accepted', 'system'
);

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
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
  -- own phone, hashed on device, so friends' contact hashes can find this user
  phone_hash text unique,
  is_plus boolean not null default false,
  plus_until timestamptz,
  paused boolean not null default false,
  onboarding_complete boolean not null default false,
  verified_photo boolean not null default false,
  verified_social boolean not null default false,
  brief_consent boolean not null default false,
  reverse_image_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_adult check (date_of_birth is null or date_of_birth <= (current_date - interval '18 years'))
);

create index profiles_phone_hash_idx on public.profiles (phone_hash);

-- Create a profile row the moment a user signs up. Name and photo come from the social login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta->>'full_name', meta->>'name', '');
begin
  insert into public.profiles (id, first_name, last_name, photo_url)
  values (
    new.id,
    coalesce(meta->>'first_name', meta->>'given_name', split_part(full_name, ' ', 1), ''),
    coalesce(meta->>'last_name', meta->>'family_name', nullif(regexp_replace(full_name, '^\S+\s*', ''), ''), ''),
    coalesce(meta->>'avatar_url', meta->>'picture')
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

-- ---------------------------------------------------------------------------
-- Criteria: the five questions a single answers once
-- ---------------------------------------------------------------------------
create table public.criteria (
  single_id uuid primary key references public.profiles (id) on delete cascade,
  age_min int not null default 30 check (age_min >= 18),
  age_max int not null default 50 check (age_max >= age_min),
  radius_km int not null default 30 check (radius_km between 5 and 500),
  dealbreakers text[] not null default '{}',
  intent public.intent_kind not null default 'not_sure',
  open_text text,
  updated_at timestamptz not null default now()
);

create trigger criteria_touch before update on public.criteria
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Contact graph. Only hashes, never names or numbers.
-- ---------------------------------------------------------------------------
create table public.contact_hashes (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  hash text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, hash)
);

create index contact_hashes_hash_idx on public.contact_hashes (hash);

-- A link between two Mash users. Rows are normalised so user_a < user_b.
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
-- Nominations and invites
-- ---------------------------------------------------------------------------
create table public.nominations (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.profiles (id) on delete cascade,
  -- the nominee as the voucher's phone hash of them; resolved to a user once they join
  nominee_hash text not null,
  nominee_user_id uuid references public.profiles (id) on delete set null,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  invite_message text,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (voucher_id, nominee_hash)
);

create index nominations_nominee_hash_idx on public.nominations (nominee_hash);
create index nominations_nominee_user_idx on public.nominations (nominee_user_id);

-- ---------------------------------------------------------------------------
-- Vouches: one rotating prompt, answered in a sentence
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
  voucher_id uuid not null references public.profiles (id) on delete cascade,
  single_id uuid not null references public.profiles (id) on delete cascade,
  prompt_id int references public.vouch_prompts (id),
  prompt text not null,
  text text not null check (char_length(text) between 10 and 400),
  how_known text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voucher_id, single_id),
  constraint vouches_not_self check (voucher_id <> single_id)
);

create index vouches_single_idx on public.vouches (single_id);
create trigger vouches_touch before update on public.vouches
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Lineups: Holly nominates ten, the agent keeps seven
-- ---------------------------------------------------------------------------
create table public.lineups (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.profiles (id) on delete cascade,
  single_id uuid not null references public.profiles (id) on delete cascade,
  status public.lineup_status not null default 'building',
  agent_note_to_voucher text,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  done_at timestamptz
);

create index lineups_single_idx on public.lineups (single_id, created_at desc);
create index lineups_voucher_idx on public.lineups (voucher_id, created_at desc);

create table public.lineup_entries (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  kept boolean not null default true,
  rank int,
  reason text,
  dropped_reason text,
  voucher_overrode boolean not null default false,
  decision public.entry_decision not null default 'undecided',
  decided_at timestamptz,
  revealed_at timestamptz,
  unique (lineup_id, candidate_id)
);

create index lineup_entries_candidate_idx on public.lineup_entries (candidate_id);

create table public.lineup_comments (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups (id) on delete cascade,
  entry_id uuid references public.lineup_entries (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);

create index lineup_comments_lineup_idx on public.lineup_comments (lineup_id, created_at);

-- ---------------------------------------------------------------------------
-- Introductions and chat
-- ---------------------------------------------------------------------------
create table public.introductions (
  id uuid primary key default gen_random_uuid(),
  single_id uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  voucher_ids uuid[] not null default '{}',
  lineup_entry_id uuid references public.lineup_entries (id) on delete set null,
  single_decision public.entry_decision not null default 'undecided',
  candidate_decision public.entry_decision not null default 'undecided',
  status public.intro_status not null default 'pending',
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  unique (single_id, candidate_id),
  constraint intro_not_self check (single_id <> candidate_id)
);

create index introductions_candidate_idx on public.introductions (candidate_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  intro_id uuid not null references public.introductions (id) on delete cascade,
  -- null sender = the vouch that opens the chat, or a system line
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  is_vouch boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_intro_idx on public.messages (intro_id, created_at);

create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  intro_id uuid not null references public.introductions (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  outcome public.outcome_kind not null,
  note text,
  when_at timestamptz,
  created_at timestamptz not null default now()
);

create index outcomes_intro_idx on public.outcomes (intro_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Due diligence (consent-first)
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
  intro_id uuid not null references public.introductions (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  content jsonb not null,
  subject_approved boolean not null default false,
  generated_at timestamptz not null default now(),
  unique (intro_id, subject_id)
);

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

-- Who may see a profile: yourself, people you are connected to, anyone sharing a
-- lineup or introduction with you, and vouchers of singles you share a lineup with.
create or replace function public.can_see_profile(viewer uuid, target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    viewer = target
    or (
      not public.is_blocked_either_way(viewer, target)
      and (
        public.are_connected(viewer, target)
        or exists (
          select 1 from public.lineups l
          where (l.single_id = viewer and l.voucher_id = target)
             or (l.voucher_id = viewer and l.single_id = target)
        )
        or exists (
          select 1 from public.lineup_entries e
          join public.lineups l on l.id = e.lineup_id
          where e.candidate_id = target and e.kept and (l.single_id = viewer or l.voucher_id = viewer)
        )
        or exists (
          select 1 from public.lineup_entries e
          join public.lineups l on l.id = e.lineup_id
          where e.candidate_id = viewer and e.kept and e.decision in ('meet', 'maybe')
            and (l.single_id = target or l.voucher_id = target)
        )
        or exists (
          select 1 from public.introductions i
          where (i.single_id = viewer and i.candidate_id = target)
             or (i.candidate_id = viewer and i.single_id = target)
             or (viewer = any(i.voucher_ids) and (i.single_id = target or i.candidate_id = target))
             or (target = any(i.voucher_ids) and (i.single_id = viewer or i.candidate_id = viewer))
        )
        or exists (
          select 1 from public.vouches v
          where (v.voucher_id = viewer and v.single_id = target)
             or (v.single_id = viewer and v.voucher_id = target)
        )
      )
    );
$$;

create or replace function public.is_lineup_party(lineup uuid, who uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lineups l where l.id = lineup and (l.single_id = who or l.voucher_id = who)
  );
$$;

create or replace function public.is_intro_party(intro uuid, who uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.introductions i
    where i.id = intro and (i.single_id = who or i.candidate_id = who or who = any(i.voucher_ids))
  );
$$;

-- Circle size: how many people vouch for this single. Matches unlock at 10 is a product
-- rule enforced in the app and in build-lineup, not here, so it can be tuned.
create or replace function public.circle_size(single uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.vouches where single_id = single;
$$;

-- Record a vouch chain for a couple. Used by the app when an outcome is "together".
create or replace view public.intro_chains as
  select i.id as intro_id, i.single_id, i.candidate_id, i.voucher_ids, o.outcome, o.created_at
  from public.introductions i
  join lateral (
    select outcome, created_at from public.outcomes where intro_id = i.id order by created_at desc limit 1
  ) o on true;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.criteria enable row level security;
alter table public.contact_hashes enable row level security;
alter table public.connections enable row level security;
alter table public.nominations enable row level security;
alter table public.vouch_prompts enable row level security;
alter table public.vouches enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_entries enable row level security;
alter table public.lineup_comments enable row level security;
alter table public.introductions enable row level security;
alter table public.messages enable row level security;
alter table public.outcomes enable row level security;
alter table public.linked_profiles enable row level security;
alter table public.briefs enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles: read self or linked" on public.profiles
  for select using (public.can_see_profile(auth.uid(), id));
create policy "profiles: update self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- inserts happen via trigger; no client insert policy on purpose

-- criteria: only the single and vouchers who vouch for them
create policy "criteria: read self or voucher" on public.criteria
  for select using (
    auth.uid() = single_id
    or exists (select 1 from public.vouches v where v.single_id = criteria.single_id and v.voucher_id = auth.uid())
  );
create policy "criteria: upsert self" on public.criteria
  for insert with check (auth.uid() = single_id);
create policy "criteria: update self" on public.criteria
  for update using (auth.uid() = single_id) with check (auth.uid() = single_id);

-- contact hashes: write-only from the client; matching happens in an edge function
create policy "contact_hashes: insert own" on public.contact_hashes
  for insert with check (auth.uid() = owner_id);
create policy "contact_hashes: delete own" on public.contact_hashes
  for delete using (auth.uid() = owner_id);
create policy "contact_hashes: read own" on public.contact_hashes
  for select using (auth.uid() = owner_id);

-- connections: read your own edges; written by the service role only
create policy "connections: read own" on public.connections
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- nominations
create policy "nominations: voucher reads own" on public.nominations
  for select using (auth.uid() = voucher_id or auth.uid() = nominee_user_id);
create policy "nominations: voucher inserts" on public.nominations
  for insert with check (auth.uid() = voucher_id);
create policy "nominations: voucher updates own" on public.nominations
  for update using (auth.uid() = voucher_id) with check (auth.uid() = voucher_id);
create policy "nominations: voucher deletes own" on public.nominations
  for delete using (auth.uid() = voucher_id);

-- prompts are public to signed-in users
create policy "vouch_prompts: read" on public.vouch_prompts
  for select using (auth.role() = 'authenticated');

-- vouches: visible to the voucher, the single, and anyone who can see the single via a lineup/intro
create policy "vouches: read" on public.vouches
  for select using (
    auth.uid() = voucher_id
    or auth.uid() = single_id
    or public.can_see_profile(auth.uid(), single_id)
  );
create policy "vouches: voucher writes" on public.vouches
  for insert with check (auth.uid() = voucher_id and public.are_connected(voucher_id, single_id));
create policy "vouches: voucher updates" on public.vouches
  for update using (auth.uid() = voucher_id) with check (auth.uid() = voucher_id);
create policy "vouches: voucher deletes" on public.vouches
  for delete using (auth.uid() = voucher_id);

-- lineups: the single and the voucher. Created by build-lineup (service role).
create policy "lineups: parties read" on public.lineups
  for select using (public.is_lineup_party(id, auth.uid()));

create policy "lineup_entries: parties read" on public.lineup_entries
  for select using (
    public.is_lineup_party(lineup_id, auth.uid())
    or (candidate_id = auth.uid() and decision in ('meet', 'maybe'))
  );
-- the single decides, the voucher may override one drop
create policy "lineup_entries: single decides" on public.lineup_entries
  for update using (
    exists (select 1 from public.lineups l where l.id = lineup_id and (l.single_id = auth.uid() or l.voucher_id = auth.uid()))
  ) with check (
    exists (select 1 from public.lineups l where l.id = lineup_id and (l.single_id = auth.uid() or l.voucher_id = auth.uid()))
  );

create policy "lineup_comments: parties read" on public.lineup_comments
  for select using (public.is_lineup_party(lineup_id, auth.uid()));
create policy "lineup_comments: parties write" on public.lineup_comments
  for insert with check (auth.uid() = author_id and public.is_lineup_party(lineup_id, auth.uid()));

-- introductions
create policy "introductions: parties read" on public.introductions
  for select using (public.is_intro_party(id, auth.uid()));
create policy "introductions: parties update" on public.introductions
  for update using (auth.uid() = single_id or auth.uid() = candidate_id)
  with check (auth.uid() = single_id or auth.uid() = candidate_id);

-- messages: only once the intro is mutual, and only the two people in it
create policy "messages: parties read" on public.messages
  for select using (
    exists (
      select 1 from public.introductions i
      where i.id = intro_id and (i.single_id = auth.uid() or i.candidate_id = auth.uid())
    )
  );
create policy "messages: parties write when mutual" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and not is_vouch
    and exists (
      select 1 from public.introductions i
      where i.id = intro_id
        and i.status in ('mutual', 'met')
        and (i.single_id = auth.uid() or i.candidate_id = auth.uid())
        and not public.is_blocked_either_way(i.single_id, i.candidate_id)
    )
  );

create policy "outcomes: parties read" on public.outcomes
  for select using (public.is_intro_party(intro_id, auth.uid()));
create policy "outcomes: single or candidate write" on public.outcomes
  for insert with check (
    auth.uid() = reported_by
    and exists (select 1 from public.introductions i where i.id = intro_id and (i.single_id = auth.uid() or i.candidate_id = auth.uid()))
  );

-- linked profiles: own, plus visible to the other side of a mutual intro once consent is on
create policy "linked_profiles: own" on public.linked_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "linked_profiles: mutual intro read" on public.linked_profiles
  for select using (
    exists (
      select 1 from public.introductions i
      join public.profiles p on p.id = linked_profiles.user_id
      where i.status in ('mutual', 'met') and p.brief_consent
        and ((i.single_id = auth.uid() and i.candidate_id = linked_profiles.user_id)
          or (i.candidate_id = auth.uid() and i.single_id = linked_profiles.user_id))
    )
  );

-- briefs: the subject always; the other party only after the subject approved
create policy "briefs: subject reads" on public.briefs
  for select using (auth.uid() = subject_id);
create policy "briefs: other party reads approved" on public.briefs
  for select using (
    subject_approved and exists (
      select 1 from public.introductions i
      where i.id = intro_id and (i.single_id = auth.uid() or i.candidate_id = auth.uid())
    )
  );
create policy "briefs: subject approves" on public.briefs
  for update using (auth.uid() = subject_id) with check (auth.uid() = subject_id);

-- blocks and reports
create policy "blocks: own" on public.blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
create policy "reports: own insert" on public.reports
  for insert with check (auth.uid() = reporter_id);
create policy "reports: own read" on public.reports
  for select using (auth.uid() = reporter_id);

-- push tokens and notifications
create policy "push_tokens: own" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications: own read" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications: own update" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime: lineups, entries, comments, messages, notifications
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.lineups;
alter publication supabase_realtime add table public.lineup_entries;
alter publication supabase_realtime add table public.lineup_comments;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.introductions;

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

-- The weekly rotating prompt. Deterministic per ISO week so everyone sees the same one.
create or replace function public.current_vouch_prompt()
returns public.vouch_prompts language sql stable as $$
  select * from public.vouch_prompts where active
  order by id
  offset (extract(week from now())::int % greatest((select count(*) from public.vouch_prompts where active), 1))
  limit 1;
$$;

-- Delete everything about me. Required for App Store review of dating apps.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Home screen for a single: everyone vouching for them and what they wrote.
create or replace function public.my_circle()
returns table (
  voucher_id uuid, first_name text, photo_url text, prompt text, text text, how_known text, created_at timestamptz
) language sql stable security invoker as $$
  select v.voucher_id, p.first_name, p.photo_url, v.prompt, v.text, v.how_known, v.created_at
  from public.vouches v join public.profiles p on p.id = v.voucher_id
  where v.single_id = auth.uid()
  order by v.created_at desc;
$$;

-- Voucher home: the singles I vouch for, with their circle size and lineup count.
create or replace function public.my_singles()
returns table (
  single_id uuid, first_name text, photo_url text, city text, circle_size int, lineups int, last_lineup_at timestamptz
) language sql stable security invoker as $$
  select p.id, p.first_name, p.photo_url, p.city,
    public.circle_size(p.id),
    (select count(*)::int from public.lineups l where l.single_id = p.id and l.voucher_id = auth.uid()),
    (select max(l.created_at) from public.lineups l where l.single_id = p.id and l.voucher_id = auth.uid())
  from public.vouches v join public.profiles p on p.id = v.single_id
  where v.voucher_id = auth.uid()
  order by v.created_at desc;
$$;

-- Candidates a voucher can put on a lineup for a single: the voucher's connections who
-- are singles, not paused, not the single, not blocked, not already introduced.
create or replace function public.nominatable_for(single uuid)
returns table (candidate_id uuid, first_name text, photo_url text, city text, age int)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.photo_url, p.city,
    date_part('year', age(p.date_of_birth))::int
  from public.profiles p
  where p.id <> single
    and p.id <> auth.uid()
    and p.role = 'single'
    and p.onboarding_complete
    and not p.paused
    and public.are_connected(auth.uid(), p.id)
    and not public.is_blocked_either_way(single, p.id)
    and not exists (
      select 1 from public.introductions i
      where (i.single_id = single and i.candidate_id = p.id) or (i.single_id = p.id and i.candidate_id = single)
    )
    and exists (select 1 from public.vouches v where v.voucher_id = auth.uid() and v.single_id = single)
  order by p.first_name;
$$;

-- The quiet private record: introductions I made and what came of them. No numbers.
create or replace function public.my_record()
returns table (
  intro_id uuid, single_first_name text, candidate_first_name text, status public.intro_status,
  latest_outcome public.outcome_kind, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select i.id, s.first_name, c.first_name, i.status,
    (select o.outcome from public.outcomes o where o.intro_id = i.id order by o.created_at desc limit 1),
    i.created_at
  from public.introductions i
  join public.profiles s on s.id = i.single_id
  join public.profiles c on c.id = i.candidate_id
  where auth.uid() = any(i.voucher_ids)
  order by i.created_at desc;
$$;

grant execute on function public.current_vouch_prompt() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.my_circle() to authenticated;
grant execute on function public.my_singles() to authenticated;
grant execute on function public.nominatable_for(uuid) to authenticated;
grant execute on function public.my_record() to authenticated;
grant execute on function public.circle_size(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Protected profile columns. Only the service role (edge functions, billing webhooks)
-- may change entitlements, verification flags or the phone hash. A client update
-- that touches them is silently reverted to the old value.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    new.is_plus := old.is_plus;
    new.plus_until := old.plus_until;
    new.verified_photo := old.verified_photo;
    new.verified_social := old.verified_social;
    new.phone_hash := old.phone_hash;
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

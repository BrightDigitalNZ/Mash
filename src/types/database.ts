// Hand-written to mirror supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript --local > src/types/database.ts`
// once you have the CLI running; the shapes below are the same.

export type UserRole = 'single' | 'voucher';
export type CountryCode = 'NZ' | 'AU';
export type IntentKind = 'relationship' | 'see_where_it_goes' | 'companionship' | 'not_sure';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type LineupStatus = 'building' | 'ready' | 'done';
export type EntryDecision = 'undecided' | 'meet' | 'maybe' | 'not_this_time';
export type IntroStatus = 'pending' | 'mutual' | 'declined' | 'met' | 'closed';
export type OutcomeKind =
  | 'meeting'
  | 'met'
  | 'no_show'
  | 'dating'
  | 'together'
  | 'ended'
  | 'not_for_me';
export type ReportStatus = 'open' | 'reviewed' | 'actioned';
export type LinkedKind = 'instagram' | 'linkedin' | 'website' | 'other';
export type NotificationKind =
  | 'lineup_ready'
  | 'intro_mutual'
  | 'outcome'
  | 'nudge'
  | 'vouch_received'
  | 'comment'
  | 'invite_accepted'
  | 'system';

export type Profile = {
  id: string;
  role: UserRole | null;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  date_of_birth: string | null;
  city: string | null;
  country: CountryCode | null;
  bio: string | null;
  phone_hash: string | null;
  is_plus: boolean;
  plus_until: string | null;
  paused: boolean;
  onboarding_complete: boolean;
  verified_photo: boolean;
  verified_social: boolean;
  brief_consent: boolean;
  reverse_image_consent: boolean;
  created_at: string;
  updated_at: string;
}

export type Criteria = {
  single_id: string;
  age_min: number;
  age_max: number;
  radius_km: number;
  dealbreakers: string[];
  intent: IntentKind;
  open_text: string | null;
  updated_at: string;
}

export type ContactHash = {
  owner_id: string;
  hash: string;
  created_at: string;
}

export type Connection = {
  user_a: string;
  user_b: string;
  source: string;
  created_at: string;
}

export type Nomination = {
  id: string;
  voucher_id: string;
  nominee_hash: string;
  nominee_user_id: string | null;
  invite_code: string;
  invite_message: string | null;
  status: InviteStatus;
  created_at: string;
  accepted_at: string | null;
}

export type VouchPrompt = {
  id: number;
  text: string;
  active: boolean;
}

export type Vouch = {
  id: string;
  voucher_id: string;
  single_id: string;
  prompt_id: number | null;
  prompt: string;
  text: string;
  how_known: string | null;
  created_at: string;
  updated_at: string;
}

export type Lineup = {
  id: string;
  voucher_id: string;
  single_id: string;
  status: LineupStatus;
  agent_note_to_voucher: string | null;
  created_at: string;
  ready_at: string | null;
  done_at: string | null;
}

export type LineupEntry = {
  id: string;
  lineup_id: string;
  candidate_id: string;
  kept: boolean;
  rank: number | null;
  reason: string | null;
  dropped_reason: string | null;
  voucher_overrode: boolean;
  decision: EntryDecision;
  decided_at: string | null;
  revealed_at: string | null;
}

export type LineupComment = {
  id: string;
  lineup_id: string;
  entry_id: string | null;
  author_id: string;
  text: string;
  created_at: string;
}

export type Introduction = {
  id: string;
  single_id: string;
  candidate_id: string;
  voucher_ids: string[];
  lineup_entry_id: string | null;
  single_decision: EntryDecision;
  candidate_decision: EntryDecision;
  status: IntroStatus;
  created_at: string;
  opened_at: string | null;
  closed_at: string | null;
}

export type Message = {
  id: string;
  intro_id: string;
  sender_id: string | null;
  body: string;
  is_vouch: boolean;
  created_at: string;
}

export type Outcome = {
  id: string;
  intro_id: string;
  reported_by: string;
  outcome: OutcomeKind;
  note: string | null;
  when_at: string | null;
  created_at: string;
}

export type LinkedProfile = {
  id: string;
  user_id: string;
  kind: LinkedKind;
  url: string;
  created_at: string;
}

export type BriefContent = {
  summary: string;
  vouched_by: { first_name: string; text: string }[];
  linked: { kind: LinkedKind; url: string; what_it_shows: string }[];
  consistency: { check: string; result: 'consistent' | 'inconsistent' | 'unknown'; note: string }[];
  sources: string[];
}

export type Brief = {
  id: string;
  intro_id: string;
  subject_id: string;
  content: BriefContent;
  subject_approved: boolean;
  generated_at: string;
}

export type Block = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  reviewed_at: string | null;
}

export type PushToken = {
  user_id: string;
  token: string;
  platform: string;
  updated_at: string;
}

export type Notification = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// RPC return rows
export type CircleRow = {
  voucher_id: string;
  first_name: string;
  photo_url: string | null;
  prompt: string;
  text: string;
  how_known: string | null;
  created_at: string;
}

export type MySingleRow = {
  single_id: string;
  first_name: string;
  photo_url: string | null;
  city: string | null;
  circle_size: number;
  lineups: number;
  last_lineup_at: string | null;
}

export type NominatableRow = {
  candidate_id: string;
  first_name: string;
  photo_url: string | null;
  city: string | null;
  age: number | null;
}

export type RecordRow = {
  intro_id: string;
  single_first_name: string;
  candidate_first_name: string;
  status: IntroStatus;
  latest_outcome: OutcomeKind | null;
  created_at: string;
}

// Public card: what one person may see of another. Never includes phone_hash or consents.
export type PublicProfile = Pick<
  Profile,
  'id' | 'first_name' | 'photo_url' | 'city' | 'bio' | 'verified_photo' | 'verified_social'
> & { age: number | null };

type Rel<
  Name extends string,
  Col extends string,
  Ref extends string,
  OneToOne extends boolean = false,
> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: OneToOne;
  referencedRelation: Ref;
  referencedColumns: ['id'];
};

type Row<T, R extends unknown[] = []> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: R };

export type Database = {
  public: {
    Tables: {
      profiles: Row<Profile>;
      criteria: Row<Criteria, [Rel<'criteria_single_id_fkey', 'single_id', 'profiles', true>]>;
      contact_hashes: Row<ContactHash>;
      connections: Row<Connection>;
      nominations: Row<
        Nomination,
        [Rel<'nominations_voucher_id_fkey', 'voucher_id', 'profiles'>, Rel<'nominations_nominee_user_id_fkey', 'nominee_user_id', 'profiles'>]
      >;
      vouch_prompts: Row<VouchPrompt>;
      vouches: Row<
        Vouch,
        [Rel<'vouches_voucher_id_fkey', 'voucher_id', 'profiles'>, Rel<'vouches_single_id_fkey', 'single_id', 'profiles'>]
      >;
      lineups: Row<
        Lineup,
        [Rel<'lineups_voucher_id_fkey', 'voucher_id', 'profiles'>, Rel<'lineups_single_id_fkey', 'single_id', 'profiles'>]
      >;
      lineup_entries: Row<
        LineupEntry,
        [Rel<'lineup_entries_lineup_id_fkey', 'lineup_id', 'lineups'>, Rel<'lineup_entries_candidate_id_fkey', 'candidate_id', 'profiles'>]
      >;
      lineup_comments: Row<
        LineupComment,
        [
          Rel<'lineup_comments_lineup_id_fkey', 'lineup_id', 'lineups'>,
          Rel<'lineup_comments_entry_id_fkey', 'entry_id', 'lineup_entries'>,
          Rel<'lineup_comments_author_id_fkey', 'author_id', 'profiles'>,
        ]
      >;
      introductions: Row<
        Introduction,
        [
          Rel<'introductions_single_id_fkey', 'single_id', 'profiles'>,
          Rel<'introductions_candidate_id_fkey', 'candidate_id', 'profiles'>,
          Rel<'introductions_lineup_entry_id_fkey', 'lineup_entry_id', 'lineup_entries'>,
        ]
      >;
      messages: Row<
        Message,
        [Rel<'messages_intro_id_fkey', 'intro_id', 'introductions'>, Rel<'messages_sender_id_fkey', 'sender_id', 'profiles'>]
      >;
      outcomes: Row<Outcome, [Rel<'outcomes_intro_id_fkey', 'intro_id', 'introductions'>]>;
      linked_profiles: Row<LinkedProfile, [Rel<'linked_profiles_user_id_fkey', 'user_id', 'profiles'>]>;
      briefs: Row<
        Brief,
        [Rel<'briefs_intro_id_fkey', 'intro_id', 'introductions'>, Rel<'briefs_subject_id_fkey', 'subject_id', 'profiles'>]
      >;
      blocks: Row<Block>;
      reports: Row<
        Report,
        [Rel<'reports_reporter_id_fkey', 'reporter_id', 'profiles'>, Rel<'reports_reported_id_fkey', 'reported_id', 'profiles'>]
      >;
      push_tokens: Row<PushToken>;
      notifications: Row<Notification, [Rel<'notifications_user_id_fkey', 'user_id', 'profiles'>]>;
    };
    Views: {
      intro_chains: {
        Row: {
          intro_id: string;
          single_id: string;
          candidate_id: string;
          voucher_ids: string[];
          outcome: OutcomeKind;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_vouch_prompt: { Args: Record<string, never>; Returns: VouchPrompt };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      my_circle: { Args: Record<string, never>; Returns: CircleRow[] };
      my_singles: { Args: Record<string, never>; Returns: MySingleRow[] };
      nominatable_for: { Args: { single: string }; Returns: NominatableRow[] };
      my_record: { Args: Record<string, never>; Returns: RecordRow[] };
      circle_size: { Args: { single: string }; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      country_code: CountryCode;
      intent_kind: IntentKind;
      invite_status: InviteStatus;
      lineup_status: LineupStatus;
      entry_decision: EntryDecision;
      intro_status: IntroStatus;
      outcome_kind: OutcomeKind;
      report_status: ReportStatus;
      linked_kind: LinkedKind;
      notification_kind: NotificationKind;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Mirrors supabase/migrations/0001_init.sql. Regenerate with
// `supabase gen types typescript --local > src/types/database.ts` once the CLI is linked.

export type UserRole = 'catch' | 'mashmaker';
export type CountryCode = 'NZ' | 'AU';
export type GenderKind = 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';
export type IntentKind = 'relationship' | 'see_where_it_goes' | 'companionship' | 'not_sure';
export type LinkStatus = 'requested' | 'accepted' | 'declined' | 'ended';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type BatchStatus = 'building' | 'consenting' | 'ready' | 'done';
export type ConsentStatus = 'pending' | 'yes' | 'no';
export type EntryDecision = 'undecided' | 'meet' | 'maybe' | 'pass';
export type MashStatus = 'pending' | 'mutual' | 'declined' | 'met' | 'closed' | 'expired';
export type OutcomeKind =
  'meeting' | 'met' | 'met_again' | 'no_show' | 'dating' | 'together' | 'ended' | 'not_for_me';
export type ShareLevel = 'nothing' | 'met' | 'details';
export type VisibilityLevel = 'minimal' | 'updates';
export type ReportStatus = 'open' | 'reviewed' | 'actioned';
export type LinkedKind = 'instagram' | 'linkedin' | 'website' | 'other';
export type NotificationKind =
  | 'batch_ready'
  | 'consent_request'
  | 'mash_mutual'
  | 'outcome'
  | 'nudge'
  | 'vouch_received'
  | 'comment'
  | 'invite_accepted'
  | 'mashmaker_request'
  | 'mashmaker_accepted'
  | 'system';

export type AppSetting = { key: string; value: string; note: string | null };

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
  gender: GenderKind | null;
  seeking: GenderKind[];
  phone_hash: string | null;
  open_to_matching: boolean;
  is_plus: boolean;
  plus_until: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  paused: boolean;
  onboarding_complete: boolean;
  verified_identity: boolean;
  photos_current: boolean;
  verified_at: string | null;
  dd_consent: boolean;
  mashmaker_visibility: VisibilityLevel;
  /** the rules shown at onboarding, accepted once per role */
  catch_rules_accepted_at: string | null;
  mashmaker_rules_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Criteria = {
  catch_id: string;
  age_min: number;
  age_max: number;
  radius_km: number;
  dealbreakers: string[];
  intent: IntentKind;
  open_text: string | null;
  updated_at: string;
};

export type ContactHash = { owner_id: string; hash: string; created_at: string };
export type ExcludedHash = { owner_id: string; hash: string; created_at: string };
export type Connection = { user_a: string; user_b: string; source: string; created_at: string };

export type Invite = {
  id: string;
  inviter_id: string;
  invitee_hash: string;
  invitee_user_id: string | null;
  invite_code: string;
  message: string | null;
  status: InviteStatus;
  created_at: string;
  accepted_at: string | null;
};

export type MashmakerLink = {
  id: string;
  catch_id: string;
  mashmaker_id: string;
  status: LinkStatus;
  requested_by: string;
  created_at: string;
  answered_at: string | null;
};

export type VouchPrompt = { id: number; text: string; active: boolean };

export type Vouch = {
  id: string;
  mashmaker_id: string;
  catch_id: string;
  prompt_id: number | null;
  prompt: string;
  text: string;
  how_known: string | null;
  created_at: string;
  updated_at: string;
};

export type Batch = {
  id: string;
  mashmaker_id: string;
  catch_id: string;
  status: BatchStatus;
  machine_note: string | null;
  created_at: string;
  ready_at: string | null;
  done_at: string | null;
};

export type BatchEntry = {
  id: string;
  batch_id: string;
  candidate_id: string;
  kept: boolean;
  position: number | null;
  reason: string | null;
  dropped_reason: string | null;
  mashmaker_overrode: boolean;
  consent: ConsentStatus;
  consent_at: string | null;
  decision: EntryDecision;
  decided_at: string | null;
  revealed_at: string | null;
};

export type BatchComment = {
  id: string;
  batch_id: string;
  entry_id: string | null;
  author_id: string;
  text: string;
  created_at: string;
};

export type Mash = {
  id: string;
  catch_id: string;
  candidate_id: string;
  mashmaker_ids: string[];
  batch_entry_id: string | null;
  catch_decision: EntryDecision;
  candidate_decision: EntryDecision;
  status: MashStatus;
  created_at: string;
  /** a pending mash times out at this time (intro_expiry_days) */
  expires_at: string | null;
  opened_at: string | null;
  closed_at: string | null;
};

export type Message = {
  id: string;
  mash_id: string;
  sender_id: string | null;
  body: string;
  is_vouch: boolean;
  created_at: string;
};

export type Outcome = {
  id: string;
  mash_id: string;
  reported_by: string;
  outcome: OutcomeKind;
  share: ShareLevel;
  note: string | null;
  when_at: string | null;
  created_at: string;
};

export type LinkedProfile = {
  id: string;
  user_id: string;
  kind: LinkedKind;
  url: string;
  created_at: string;
};

export type BriefContent = {
  summary: string;
  linked: { kind: LinkedKind; url: string; what_it_shows: string }[];
  consistency: { check: string; result: 'consistent' | 'inconsistent' | 'unknown'; note: string }[];
  sources: string[];
  /** Printed on every brief. Checks consistency and public signals, cannot say what someone is like. */
  limitation: string;
};

export type Brief = {
  id: string;
  mash_id: string;
  requester_id: string;
  subject_id: string;
  content: BriefContent;
  generated_at: string;
};

export type Block = { blocker_id: string; blocked_id: string; created_at: string };

export type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  share: ShareLevel;
  status: ReportStatus;
  created_at: string;
  reviewed_at: string | null;
};

export type PushToken = { user_id: string; token: string; platform: string; updated_at: string };

export type Notification = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

// RPC rows
export type MyMashmakerRow = {
  link_id: string;
  mashmaker_id: string;
  first_name: string;
  photo_url: string | null;
  status: LinkStatus;
  requested_by: string;
  prompt: string | null;
  text: string | null;
  how_known: string | null;
  created_at: string;
};

export type MyCatchRow = {
  link_id: string;
  catch_id: string;
  first_name: string;
  photo_url: string | null;
  city: string | null;
  status: LinkStatus;
  requested_by: string;
  has_vouch: boolean;
  open_batch: boolean;
  batches: number;
  last_batch_at: string | null;
};

export type NominatableRow = {
  candidate_id: string;
  first_name: string;
  photo_url: string | null;
  city: string | null;
  age: number | null;
};

export type RecordRow = {
  mash_id: string;
  catch_first_name: string;
  candidate_first_name: string;
  status: MashStatus;
  shared_outcome: OutcomeKind | null;
  created_at: string;
};

/** What one person may see of another. Never includes phone_hash, gender, seeking or consents. */
export type PublicProfile = Pick<
  Profile,
  'id' | 'first_name' | 'photo_url' | 'city' | 'bio' | 'verified_identity' | 'photos_current'
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

type Row<T, R extends unknown[] = []> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: R;
};

export type Database = {
  public: {
    Tables: {
      app_settings: Row<AppSetting>;
      profiles: Row<Profile>;
      criteria: Row<Criteria, [Rel<'criteria_catch_id_fkey', 'catch_id', 'profiles', true>]>;
      contact_hashes: Row<ContactHash>;
      excluded_hashes: Row<ExcludedHash>;
      connections: Row<Connection>;
      invites: Row<Invite, [Rel<'invites_inviter_id_fkey', 'inviter_id', 'profiles'>]>;
      mashmaker_links: Row<
        MashmakerLink,
        [
          Rel<'mashmaker_links_catch_id_fkey', 'catch_id', 'profiles'>,
          Rel<'mashmaker_links_mashmaker_id_fkey', 'mashmaker_id', 'profiles'>,
        ]
      >;
      vouch_prompts: Row<VouchPrompt>;
      vouches: Row<
        Vouch,
        [
          Rel<'vouches_mashmaker_id_fkey', 'mashmaker_id', 'profiles'>,
          Rel<'vouches_catch_id_fkey', 'catch_id', 'profiles'>,
        ]
      >;
      batches: Row<
        Batch,
        [
          Rel<'batches_mashmaker_id_fkey', 'mashmaker_id', 'profiles'>,
          Rel<'batches_catch_id_fkey', 'catch_id', 'profiles'>,
        ]
      >;
      batch_entries: Row<
        BatchEntry,
        [
          Rel<'batch_entries_batch_id_fkey', 'batch_id', 'batches'>,
          Rel<'batch_entries_candidate_id_fkey', 'candidate_id', 'profiles'>,
        ]
      >;
      batch_comments: Row<
        BatchComment,
        [
          Rel<'batch_comments_batch_id_fkey', 'batch_id', 'batches'>,
          Rel<'batch_comments_entry_id_fkey', 'entry_id', 'batch_entries'>,
          Rel<'batch_comments_author_id_fkey', 'author_id', 'profiles'>,
        ]
      >;
      mashes: Row<
        Mash,
        [
          Rel<'mashes_catch_id_fkey', 'catch_id', 'profiles'>,
          Rel<'mashes_candidate_id_fkey', 'candidate_id', 'profiles'>,
          Rel<'mashes_batch_entry_id_fkey', 'batch_entry_id', 'batch_entries'>,
        ]
      >;
      messages: Row<
        Message,
        [
          Rel<'messages_mash_id_fkey', 'mash_id', 'mashes'>,
          Rel<'messages_sender_id_fkey', 'sender_id', 'profiles'>,
        ]
      >;
      outcomes: Row<Outcome, [Rel<'outcomes_mash_id_fkey', 'mash_id', 'mashes'>]>;
      linked_profiles: Row<
        LinkedProfile,
        [Rel<'linked_profiles_user_id_fkey', 'user_id', 'profiles'>]
      >;
      briefs: Row<
        Brief,
        [
          Rel<'briefs_mash_id_fkey', 'mash_id', 'mashes'>,
          Rel<'briefs_requester_id_fkey', 'requester_id', 'profiles'>,
        ]
      >;
      blocks: Row<Block>;
      reports: Row<
        Report,
        [
          Rel<'reports_reporter_id_fkey', 'reporter_id', 'profiles'>,
          Rel<'reports_reported_id_fkey', 'reported_id', 'profiles'>,
        ]
      >;
      push_tokens: Row<PushToken>;
      notifications: Row<Notification, [Rel<'notifications_user_id_fkey', 'user_id', 'profiles'>]>;
    };
    Views: Record<string, never>;
    Functions: {
      current_vouch_prompt: { Args: Record<string, never>; Returns: VouchPrompt };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      my_mashmakers: { Args: Record<string, never>; Returns: MyMashmakerRow[] };
      my_catches: { Args: Record<string, never>; Returns: MyCatchRow[] };
      nominatable_for: { Args: { catch: string }; Returns: NominatableRow[] };
      my_record: { Args: Record<string, never>; Returns: RecordRow[] };
      is_entitled: { Args: { who: string }; Returns: boolean };
      is_mashmaker_of: { Args: { mashmaker: string; catch: string }; Returns: boolean };
      under_mashmaker_cap: { Args: { catch: string }; Returns: boolean };
      expire_open_mashes: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      country_code: CountryCode;
      gender_kind: GenderKind;
      intent_kind: IntentKind;
      link_status: LinkStatus;
      invite_status: InviteStatus;
      batch_status: BatchStatus;
      consent_status: ConsentStatus;
      entry_decision: EntryDecision;
      mash_status: MashStatus;
      outcome_kind: OutcomeKind;
      share_level: ShareLevel;
      visibility_level: VisibilityLevel;
      report_status: ReportStatus;
      linked_kind: LinkedKind;
      notification_kind: NotificationKind;
    };
    CompositeTypes: Record<string, never>;
  };
};

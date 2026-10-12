// Read hooks. React Query for fetching and caching, Supabase Realtime for the live
// moments: a Mashmaker watching a batch, a chat, a notification arriving.

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';

import { DEMO, demo, subscribeDemo } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import type {
  AppSetting,
  Batch,
  BatchComment,
  BatchEntry,
  Brief,
  Criteria,
  ExcludedHash,
  LinkedProfile,
  Mash,
  Message,
  MyCatchRow,
  MyMashmakerRow,
  NominatableRow,
  Notification,
  Outcome,
  Profile,
  PublicProfile,
  RecordRow,
  VouchPrompt,
} from '@/types/database';

export const keys = {
  settings: ['settings'] as const,
  mashmakers: ['mashmakers'] as const,
  catches: ['catches'] as const,
  criteria: (id: string) => ['criteria', id] as const,
  batches: ['batches'] as const,
  batch: (id: string) => ['batch', id] as const,
  consents: ['consents'] as const,
  mashes: ['mashes'] as const,
  mash: (id: string) => ['mash', id] as const,
  messages: (id: string) => ['messages', id] as const,
  outcomes: (id: string) => ['outcomes', id] as const,
  brief: (mashId: string) => ['brief', mashId] as const,
  record: ['record'] as const,
  nominatable: (id: string) => ['nominatable', id] as const,
  prompt: ['prompt'] as const,
  linked: (id: string) => ['linked', id] as const,
  exclusions: ['exclusions'] as const,
  notifications: ['notifications'] as const,
  profile: (id: string) => ['profile', id] as const,
  vouchesFor: (id: string) => ['vouchesFor', id] as const,
  connections: ['connections'] as const,
};

function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

/** What one person may see of another. Never gender, seeking, consents or the phone hash. */
export function toPublic(p: Profile): PublicProfile {
  return {
    id: p.id,
    first_name: p.first_name,
    photo_url: p.photo_url,
    city: p.city,
    bio: p.bio,
    verified_identity: p.verified_identity,
    photos_current: p.photos_current,
    age: ageFrom(p.date_of_birth),
  };
}

/** Paid, or inside the trial. */
export function isEntitled(p: Profile | null): boolean {
  if (!p) return false;
  if (p.is_plus) return true;
  return !!p.trial_ends_at && new Date(p.trial_ends_at).getTime() > Date.now();
}

export function trialDaysLeft(p: Profile | null): number | null {
  if (!p?.trial_ends_at) return null;
  return Math.max(0, Math.ceil((new Date(p.trial_ends_at).getTime() - Date.now()) / 86400000));
}

function useRealtime(
  channel: string,
  table: string,
  filter: string | undefined,
  invalidate: readonly (readonly unknown[])[],
) {
  const qc = useQueryClient();
  useEffect(() => {
    if (DEMO) {
      return subscribeDemo(() => {
        for (const key of invalidate) qc.invalidateQueries({ queryKey: [...key] });
      });
    }
    const ch = supabase
      .channel(channel)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => {
          for (const key of invalidate) qc.invalidateQueries({ queryKey: [...key] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, table, filter]);
}

// --- settings ---------------------------------------------------------------

export function useAppSettings(): UseQueryResult<Record<string, string>> {
  return useQuery({
    queryKey: keys.settings,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (DEMO) return demo.settings();
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as AppSetting[]).map((s) => [s.key, s.value]));
    },
  });
}

// --- Catch ------------------------------------------------------------------

export function useMyMashmakers(): UseQueryResult<MyMashmakerRow[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(
    `links-c-${userId}`,
    'mashmaker_links',
    userId ? `catch_id=eq.${userId}` : undefined,
    [keys.mashmakers],
  );
  return useQuery({
    queryKey: keys.mashmakers,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.myMashmakers();
      const { data, error } = await supabase.rpc('my_mashmakers');
      if (error) throw error;
      return (data ?? []) as MyMashmakerRow[];
    },
  });
}

export function useCriteria(catchId: string | undefined) {
  return useQuery({
    queryKey: keys.criteria(catchId ?? ''),
    enabled: !!catchId,
    queryFn: async () => {
      if (DEMO) return demo.criteria(catchId!);
      const { data, error } = await supabase
        .from('criteria')
        .select('*')
        .eq('catch_id', catchId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Criteria | null) ?? null;
    },
  });
}

export interface BatchWithPeople extends Batch {
  mashmaker: PublicProfile;
  catch: PublicProfile;
  entries: (BatchEntry & { candidate: PublicProfile })[];
  comments: BatchComment[];
}

export function useBatches(): UseQueryResult<
  (Batch & { mashmaker: PublicProfile; catch: PublicProfile; kept: number; consented: number })[]
> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`batches-${userId}`, 'batches', undefined, [keys.batches]);
  return useQuery({
    queryKey: keys.batches,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.batches();
      const { data, error } = await supabase
        .from('batches')
        .select(
          '*, mashmaker:mashmaker_id(*), catch:catch_id(*), entries:batch_entries(id, kept, consent)',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => {
        const entries = (row.entries as { kept: boolean; consent: string }[]) ?? [];
        return {
          ...(row as unknown as Batch),
          mashmaker: toPublic(row.mashmaker as Profile),
          catch: toPublic(row.catch as Profile),
          kept: entries.filter((e) => e.kept).length,
          consented: entries.filter((e) => e.kept && e.consent === 'yes').length,
        };
      });
    },
  });
}

export function useBatch(id: string | undefined): UseQueryResult<BatchWithPeople | null> {
  useRealtime(`batch-entries-${id}`, 'batch_entries', id ? `batch_id=eq.${id}` : undefined, [
    keys.batch(id ?? ''),
  ]);
  useRealtime(`batch-comments-${id}`, 'batch_comments', id ? `batch_id=eq.${id}` : undefined, [
    keys.batch(id ?? ''),
  ]);
  return useQuery({
    queryKey: keys.batch(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      if (DEMO) return demo.batch(id!);
      const { data, error } = await supabase
        .from('batches')
        .select(
          '*, mashmaker:mashmaker_id(*), catch:catch_id(*), entries:batch_entries(*, candidate:candidate_id(*)), comments:batch_comments(*)',
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const entries = ((row.entries as (BatchEntry & { candidate: Profile })[]) ?? [])
        .map((e) => ({ ...e, candidate: toPublic(e.candidate) }))
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
      const comments = ((row.comments as BatchComment[]) ?? []).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      return {
        ...(row as unknown as Batch),
        mashmaker: toPublic(row.mashmaker as Profile),
        catch: toPublic(row.catch as Profile),
        entries,
        comments,
      };
    },
  });
}

/** Batches where I have been nominated and not yet answered "okay to be shown?". */
export interface ConsentRequest {
  entry_id: string;
  batch_id: string;
  mashmaker: PublicProfile;
  catch_first_name: string;
  created_at: string;
}

export function useConsentRequests(): UseQueryResult<ConsentRequest[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(
    `consents-${userId}`,
    'batch_entries',
    userId ? `candidate_id=eq.${userId}` : undefined,
    [keys.consents],
  );
  return useQuery({
    queryKey: keys.consents,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.consentRequests();
      const { data, error } = await supabase
        .from('batch_entries')
        .select(
          'id, batch_id, consent, kept, batches:batch_id(created_at, mashmaker:mashmaker_id(*), catch:catch_id(first_name))',
        )
        .eq('candidate_id', userId!)
        .eq('consent', 'pending')
        .eq('kept', true);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => {
        const b = row.batches as {
          created_at: string;
          mashmaker: Profile;
          catch: { first_name: string };
        };
        return {
          entry_id: row.id as string,
          batch_id: row.batch_id as string,
          mashmaker: toPublic(b.mashmaker),
          catch_first_name: b.catch.first_name,
          created_at: b.created_at,
        };
      });
    },
  });
}

export interface MashWithPeople extends Mash {
  catch: PublicProfile;
  candidate: PublicProfile;
  mashmakers: PublicProfile[];
  /** the person who is not me */
  other: PublicProfile;
  lastMessage: Message | null;
}

async function hydrateMashes(
  rows: (Mash & { catch: Profile; candidate: Profile; messages?: Message[] })[],
  userId: string,
): Promise<MashWithPeople[]> {
  const mashmakerIds = Array.from(new Set(rows.flatMap((r) => r.mashmaker_ids)));
  const { data: mms } = mashmakerIds.length
    ? await supabase.from('profiles').select('*').in('id', mashmakerIds)
    : { data: [] as Profile[] };
  const byId = new Map((mms ?? []).map((m) => [m.id, toPublic(m as Profile)]));
  return rows.map((r) => {
    const c = toPublic(r.catch);
    const d = toPublic(r.candidate);
    const msgs = [...(r.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      ...r,
      catch: c,
      candidate: d,
      mashmakers: r.mashmaker_ids.map((id) => byId.get(id)).filter((m): m is PublicProfile => !!m),
      other: r.catch_id === userId ? d : c,
      lastMessage: msgs[msgs.length - 1] ?? null,
    };
  });
}

export function useMashes(): UseQueryResult<MashWithPeople[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`mashes-${userId}`, 'mashes', undefined, [keys.mashes]);
  return useQuery({
    queryKey: keys.mashes,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.mashes();
      const { data, error } = await supabase
        .from('mashes')
        .select('*, catch:catch_id(*), candidate:candidate_id(*), messages(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return hydrateMashes(
        (data ?? []) as (Mash & { catch: Profile; candidate: Profile; messages: Message[] })[],
        userId!,
      );
    },
  });
}

export function useMash(id: string | undefined): UseQueryResult<MashWithPeople | null> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`mash-${id}`, 'mashes', id ? `id=eq.${id}` : undefined, [
    keys.mash(id ?? ''),
    keys.mashes,
  ]);
  return useQuery({
    queryKey: keys.mash(id ?? ''),
    enabled: !!id && !!userId,
    queryFn: async () => {
      if (DEMO) return demo.mash(id!);
      const { data, error } = await supabase
        .from('mashes')
        .select('*, catch:catch_id(*), candidate:candidate_id(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [m] = await hydrateMashes(
        [data as Mash & { catch: Profile; candidate: Profile }],
        userId!,
      );
      return m ?? null;
    },
  });
}

export function useMessages(mashId: string | undefined): UseQueryResult<Message[]> {
  useRealtime(`messages-${mashId}`, 'messages', mashId ? `mash_id=eq.${mashId}` : undefined, [
    keys.messages(mashId ?? ''),
  ]);
  return useQuery({
    queryKey: keys.messages(mashId ?? ''),
    enabled: !!mashId,
    queryFn: async () => {
      if (DEMO) return demo.messages(mashId!);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('mash_id', mashId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });
}

export function useOutcomes(mashId: string | undefined): UseQueryResult<Outcome[]> {
  return useQuery({
    queryKey: keys.outcomes(mashId ?? ''),
    enabled: !!mashId,
    queryFn: async () => {
      if (DEMO) return demo.outcomes(mashId!);
      const { data, error } = await supabase
        .from('outcomes')
        .select('*')
        .eq('mash_id', mashId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Outcome[];
    },
  });
}

/** My brief about the other person in this mash. Only ever mine. */
export function useBrief(mashId: string | undefined) {
  const userId = useSession((s) => s.session?.user.id);
  return useQuery({
    queryKey: keys.brief(mashId ?? ''),
    enabled: !!mashId && !!userId,
    queryFn: async () => {
      if (DEMO) return demo.brief(mashId!);
      const { data, error } = await supabase
        .from('briefs')
        .select('*')
        .eq('mash_id', mashId!)
        .eq('requester_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Brief | null) ?? null;
    },
  });
}

/** Vouches written about a Catch, with the Mashmaker's name. Visible per RLS. */
export function useVouchesFor(catchId: string | undefined) {
  return useQuery({
    queryKey: keys.vouchesFor(catchId ?? ''),
    enabled: !!catchId,
    queryFn: async () => {
      if (DEMO) return demo.vouchesFor(catchId!);
      const { data, error } = await supabase
        .from('vouches')
        .select('*, mashmaker:mashmaker_id(first_name, photo_url)')
        .eq('catch_id', catchId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        mashmaker_id: string;
        prompt: string;
        text: string;
        how_known: string | null;
        created_at: string;
        mashmaker: { first_name: string; photo_url: string | null };
      }[];
    },
  });
}

// --- Mashmaker --------------------------------------------------------------

export function useMyCatches(): UseQueryResult<MyCatchRow[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(
    `links-m-${userId}`,
    'mashmaker_links',
    userId ? `mashmaker_id=eq.${userId}` : undefined,
    [keys.catches],
  );
  return useQuery({
    queryKey: keys.catches,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.myCatches();
      const { data, error } = await supabase.rpc('my_catches');
      if (error) throw error;
      return (data ?? []) as MyCatchRow[];
    },
  });
}

export function useRecord(): UseQueryResult<RecordRow[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`record-${userId}`, 'outcomes', undefined, [keys.record]);
  return useQuery({
    queryKey: keys.record,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.record();
      const { data, error } = await supabase.rpc('my_record');
      if (error) throw error;
      return (data ?? []) as RecordRow[];
    },
  });
}

export function useNominatable(catchId: string | undefined): UseQueryResult<NominatableRow[]> {
  return useQuery({
    queryKey: keys.nominatable(catchId ?? ''),
    enabled: !!catchId,
    queryFn: async () => {
      if (DEMO) return demo.nominatable(catchId!);
      const { data, error } = await supabase.rpc('nominatable_for', { catch: catchId! });
      if (error) throw error;
      return (data ?? []) as NominatableRow[];
    },
  });
}

export function useVouchPrompt(): UseQueryResult<VouchPrompt> {
  return useQuery({
    queryKey: keys.prompt,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      if (DEMO) return demo.prompt();
      const { data, error } = await supabase.rpc('current_vouch_prompt');
      if (error) throw error;
      return data as VouchPrompt;
    },
  });
}

/** People whose contacts matched mine, as public cards with their role. */
export function useConnections(): UseQueryResult<(PublicProfile & { role: Profile['role'] })[]> {
  const userId = useSession((s) => s.session?.user.id);
  return useQuery({
    queryKey: keys.connections,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.connections();
      const { data, error } = await supabase.from('connections').select('user_a, user_b');
      if (error) throw error;
      const ids = (data ?? []).map((c) => (c.user_a === userId ? c.user_b : c.user_a));
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', ids);
      if (pErr) throw pErr;
      return (profiles ?? []).map((p) => ({
        ...toPublic(p as Profile),
        role: (p as Profile).role,
      }));
    },
  });
}

// --- shared -----------------------------------------------------------------

export function useProfile(id: string | undefined): UseQueryResult<PublicProfile | null> {
  return useQuery({
    queryKey: keys.profile(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      if (DEMO) return demo.publicProfile(id!);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data ? toPublic(data as Profile) : null;
    },
  });
}

export function useLinkedProfiles(userId: string | undefined): UseQueryResult<LinkedProfile[]> {
  return useQuery({
    queryKey: keys.linked(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.linked(userId!);
      const { data, error } = await supabase
        .from('linked_profiles')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as LinkedProfile[];
    },
  });
}

export function useExclusions(): UseQueryResult<ExcludedHash[]> {
  const userId = useSession((s) => s.session?.user.id);
  return useQuery({
    queryKey: keys.exclusions,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.exclusions();
      const { data, error } = await supabase
        .from('excluded_hashes')
        .select('*')
        .eq('owner_id', userId!);
      if (error) throw error;
      return (data ?? []) as ExcludedHash[];
    },
  });
}

export function useNotifications(): UseQueryResult<Notification[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(
    `notifications-${userId}`,
    'notifications',
    userId ? `user_id=eq.${userId}` : undefined,
    [keys.notifications],
  );
  return useQuery({
    queryKey: keys.notifications,
    enabled: !!userId,
    queryFn: async () => {
      if (DEMO) return demo.notifications();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

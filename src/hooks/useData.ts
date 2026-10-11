// Read hooks. React Query for fetching and caching, Supabase Realtime for the live
// moments: a voucher watching a lineup, a chat, a notification arriving.

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import type {
  Brief,
  CircleRow,
  Criteria,
  Introduction,
  LinkedProfile,
  Lineup,
  LineupComment,
  LineupEntry,
  Message,
  MySingleRow,
  NominatableRow,
  Notification,
  Profile,
  PublicProfile,
  RecordRow,
  VouchPrompt,
} from '@/types/database';

export const keys = {
  circle: ['circle'] as const,
  criteria: (id: string) => ['criteria', id] as const,
  lineups: ['lineups'] as const,
  lineup: (id: string) => ['lineup', id] as const,
  intros: ['intros'] as const,
  intro: (id: string) => ['intro', id] as const,
  messages: (id: string) => ['messages', id] as const,
  brief: (introId: string, subjectId: string) => ['brief', introId, subjectId] as const,
  mySingles: ['mySingles'] as const,
  record: ['record'] as const,
  nominatable: (id: string) => ['nominatable', id] as const,
  prompt: ['prompt'] as const,
  linked: (id: string) => ['linked', id] as const,
  notifications: ['notifications'] as const,
  profile: (id: string) => ['profile', id] as const,
  vouchesFor: (id: string) => ['vouchesFor', id] as const,
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

export function toPublic(p: Profile): PublicProfile {
  return {
    id: p.id,
    first_name: p.first_name,
    photo_url: p.photo_url,
    city: p.city,
    bio: p.bio,
    verified_photo: p.verified_photo,
    verified_social: p.verified_social,
    age: ageFrom(p.date_of_birth),
  };
}

/** Subscribe to a table filter and invalidate query keys when rows change. */
function useRealtime(
  channel: string,
  table: string,
  filter: string | undefined,
  invalidate: readonly (readonly unknown[])[],
) {
  const qc = useQueryClient();
  useEffect(() => {
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

// --- single -----------------------------------------------------------------

export function useCircle(): UseQueryResult<CircleRow[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`circle-${userId}`, 'vouches', userId ? `single_id=eq.${userId}` : undefined, [keys.circle]);
  return useQuery({
    queryKey: keys.circle,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_circle');
      if (error) throw error;
      return (data ?? []) as CircleRow[];
    },
  });
}

export function useCriteria(singleId: string | undefined) {
  return useQuery({
    queryKey: keys.criteria(singleId ?? ''),
    enabled: !!singleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('criteria')
        .select('*')
        .eq('single_id', singleId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Criteria | null) ?? null;
    },
  });
}

export interface LineupWithPeople extends Lineup {
  voucher: PublicProfile;
  single: PublicProfile;
  entries: (LineupEntry & { candidate: PublicProfile })[];
  comments: LineupComment[];
}

export function useLineups(): UseQueryResult<(Lineup & { voucher: PublicProfile; single: PublicProfile; kept: number })[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`lineups-${userId}`, 'lineups', undefined, [keys.lineups]);
  return useQuery({
    queryKey: keys.lineups,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lineups')
        .select('*, voucher:voucher_id(*), single:single_id(*), entries:lineup_entries(id, kept)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => {
        const entries = (row.entries as { kept: boolean }[]) ?? [];
        return {
          ...(row as unknown as Lineup),
          voucher: toPublic(row.voucher as Profile),
          single: toPublic(row.single as Profile),
          kept: entries.filter((e) => e.kept).length,
        };
      });
    },
  });
}

export function useLineup(id: string | undefined): UseQueryResult<LineupWithPeople | null> {
  useRealtime(`lineup-entries-${id}`, 'lineup_entries', id ? `lineup_id=eq.${id}` : undefined, [keys.lineup(id ?? '')]);
  useRealtime(`lineup-comments-${id}`, 'lineup_comments', id ? `lineup_id=eq.${id}` : undefined, [keys.lineup(id ?? '')]);
  return useQuery({
    queryKey: keys.lineup(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lineups')
        .select(
          '*, voucher:voucher_id(*), single:single_id(*), entries:lineup_entries(*, candidate:candidate_id(*)), comments:lineup_comments(*)',
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const entries = ((row.entries as (LineupEntry & { candidate: Profile })[]) ?? [])
        .map((e) => ({ ...e, candidate: toPublic(e.candidate) }))
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      const comments = ((row.comments as LineupComment[]) ?? []).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      return {
        ...(row as unknown as Lineup),
        voucher: toPublic(row.voucher as Profile),
        single: toPublic(row.single as Profile),
        entries,
        comments,
      };
    },
  });
}

export interface IntroWithPeople extends Introduction {
  single: PublicProfile;
  candidate: PublicProfile;
  vouchers: PublicProfile[];
  /** the person who is not me */
  other: PublicProfile;
  lastMessage: Message | null;
}

export function useIntros(): UseQueryResult<IntroWithPeople[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`intros-${userId}`, 'introductions', undefined, [keys.intros]);
  return useQuery({
    queryKey: keys.intros,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('introductions')
        .select('*, single:single_id(*), candidate:candidate_id(*), messages(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as (Introduction & { single: Profile; candidate: Profile; messages: Message[] })[];
      const voucherIds = Array.from(new Set(rows.flatMap((r) => r.voucher_ids)));
      const { data: vouchers } = voucherIds.length
        ? await supabase.from('profiles').select('*').in('id', voucherIds)
        : { data: [] as Profile[] };
      const byId = new Map((vouchers ?? []).map((v) => [v.id, toPublic(v as Profile)]));
      return rows.map((r) => {
        const single = toPublic(r.single);
        const candidate = toPublic(r.candidate);
        const msgs = [...(r.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
        return {
          ...r,
          single,
          candidate,
          vouchers: r.voucher_ids.map((id) => byId.get(id)).filter((v): v is PublicProfile => !!v),
          other: r.single_id === userId ? candidate : single,
          lastMessage: msgs[msgs.length - 1] ?? null,
        };
      });
    },
  });
}

export function useIntro(id: string | undefined): UseQueryResult<IntroWithPeople | null> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`intro-${id}`, 'introductions', id ? `id=eq.${id}` : undefined, [keys.intro(id ?? ''), keys.intros]);
  return useQuery({
    queryKey: keys.intro(id ?? ''),
    enabled: !!id && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('introductions')
        .select('*, single:single_id(*), candidate:candidate_id(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const r = data as Introduction & { single: Profile; candidate: Profile };
      const { data: vouchers } = r.voucher_ids.length
        ? await supabase.from('profiles').select('*').in('id', r.voucher_ids)
        : { data: [] as Profile[] };
      const single = toPublic(r.single);
      const candidate = toPublic(r.candidate);
      return {
        ...r,
        single,
        candidate,
        vouchers: (vouchers ?? []).map((v) => toPublic(v as Profile)),
        other: r.single_id === userId ? candidate : single,
        lastMessage: null,
      };
    },
  });
}

export function useMessages(introId: string | undefined): UseQueryResult<Message[]> {
  useRealtime(`messages-${introId}`, 'messages', introId ? `intro_id=eq.${introId}` : undefined, [
    keys.messages(introId ?? ''),
  ]);
  return useQuery({
    queryKey: keys.messages(introId ?? ''),
    enabled: !!introId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('intro_id', introId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });
}

export function useBrief(introId: string | undefined, subjectId: string | undefined) {
  return useQuery({
    queryKey: keys.brief(introId ?? '', subjectId ?? ''),
    enabled: !!introId && !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefs')
        .select('*')
        .eq('intro_id', introId!)
        .eq('subject_id', subjectId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Brief | null) ?? null;
    },
  });
}

/** Vouches written about a person, with the voucher's name. Visible per RLS. */
export function useVouchesFor(singleId: string | undefined) {
  return useQuery({
    queryKey: keys.vouchesFor(singleId ?? ''),
    enabled: !!singleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vouches')
        .select('*, voucher:voucher_id(first_name, photo_url)')
        .eq('single_id', singleId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        voucher_id: string;
        prompt: string;
        text: string;
        how_known: string | null;
        created_at: string;
        voucher: { first_name: string; photo_url: string | null };
      }[];
    },
  });
}

// --- voucher ----------------------------------------------------------------

export function useMySingles(): UseQueryResult<MySingleRow[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`mysingles-${userId}`, 'vouches', userId ? `voucher_id=eq.${userId}` : undefined, [keys.mySingles]);
  return useQuery({
    queryKey: keys.mySingles,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_singles');
      if (error) throw error;
      return (data ?? []) as MySingleRow[];
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
      const { data, error } = await supabase.rpc('my_record');
      if (error) throw error;
      return (data ?? []) as RecordRow[];
    },
  });
}

export function useNominatable(singleId: string | undefined): UseQueryResult<NominatableRow[]> {
  return useQuery({
    queryKey: keys.nominatable(singleId ?? ''),
    enabled: !!singleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nominatable_for', { single: singleId! });
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
      const { data, error } = await supabase.rpc('current_vouch_prompt');
      if (error) throw error;
      return data as VouchPrompt;
    },
  });
}

/** People in my circle (connections) as public cards. Used by the voucher to pick singles to vouch for. */
export function useConnections(): UseQueryResult<(PublicProfile & { role: Profile['role'] })[]> {
  const userId = useSession((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['connections', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('connections').select('user_a, user_b');
      if (error) throw error;
      const ids = (data ?? []).map((c) => (c.user_a === userId ? c.user_b : c.user_a));
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').in('id', ids);
      if (pErr) throw pErr;
      return (profiles ?? []).map((p) => ({ ...toPublic(p as Profile), role: (p as Profile).role }));
    },
  });
}

// --- shared -----------------------------------------------------------------

export function useProfile(id: string | undefined): UseQueryResult<PublicProfile | null> {
  return useQuery({
    queryKey: keys.profile(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).maybeSingle();
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

export function useNotifications(): UseQueryResult<Notification[]> {
  const userId = useSession((s) => s.session?.user.id);
  useRealtime(`notifications-${userId}`, 'notifications', userId ? `user_id=eq.${userId}` : undefined, [
    keys.notifications,
  ]);
  return useQuery({
    queryKey: keys.notifications,
    enabled: !!userId,
    queryFn: async () => {
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

/** Invalidate everything after a big write (e.g. finishing onboarding). */
export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

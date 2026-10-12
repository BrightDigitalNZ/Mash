// Expo push. One message, in plain words, because a friend acted.
// Also writes the in-app notification row so the feed and the push always agree.

import { admin } from './supabase.ts';

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

interface ExpoMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
}

export async function notify(
  userId: string,
  kind: NotificationKind,
  body: string,
  data: Record<string, unknown> = {},
  title = 'Mash',
): Promise<void> {
  await admin.from('notifications').insert({ user_id: userId, kind, body, data });

  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  if (!tokens || tokens.length === 0) return;

  const messages: ExpoMessage[] = tokens.map((t: { token: string }) => ({
    to: t.token,
    title,
    body,
    data: { kind, ...data },
    sound: 'default',
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN')
        ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
        : {}),
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error('Expo push failed', res.status, await res.text());
    return;
  }

  // Drop tokens Expo says are dead.
  const result = (await res.json()) as {
    data?: { status: string; details?: { error?: string } }[];
  };
  const dead = (result.data ?? [])
    .map((r, i) =>
      r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? tokens[i]?.token : null,
    )
    .filter((t): t is string => !!t);
  if (dead.length > 0) {
    await admin.from('push_tokens').delete().eq('user_id', userId).in('token', dead);
  }
}

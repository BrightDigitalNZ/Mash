// Scheduled. The Machine's job between batches is working the Mashmakers, gently.
// At most one nudge per Mashmaker per Catch per week. Says "no one in your contacts right
// now" when that is true, and never nags about a batch that is still open.

import { admin, handler, json, HttpError } from '../_shared/supabase.ts';
import { notify } from '../_shared/push.ts';
import { nudgeText } from '../_shared/rules.ts';

Deno.serve(
  handler(async (req) => {
    const secret = Deno.env.get('CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret)
      throw new HttpError(401, 'Bad secret');

    // Pending mashes past their time go first. "This one timed out." Nothing else, to anyone.
    const { data: expired } = await admin.rpc('expire_open_mashes');

    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: links } = await admin
      .from('mashmaker_links')
      .select(
        'mashmaker_id, catch_id, profiles:catch_id(first_name, paused, role, open_to_matching)',
      )
      .eq('status', 'accepted')
      .limit(5000);

    let sent = 0;
    for (const l of links ?? []) {
      const c = l.profiles as unknown as {
        first_name: string;
        paused: boolean;
        role: string;
        open_to_matching: boolean;
      } | null;
      if (!c || c.paused || c.role !== 'catch' || !c.open_to_matching) continue;

      const { data: recent } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', l.mashmaker_id)
        .eq('kind', 'nudge')
        .contains('data', { catch_id: l.catch_id })
        .gte('created_at', weekAgo)
        .limit(1);
      if (recent && recent.length) continue;

      const { data: vouch } = await admin
        .from('vouches')
        .select('id')
        .eq('mashmaker_id', l.mashmaker_id)
        .eq('catch_id', l.catch_id)
        .maybeSingle();
      const { data: open } = await admin
        .from('batches')
        .select('id')
        .eq('catch_id', l.catch_id)
        .in('status', ['building', 'consenting', 'ready'])
        .limit(1);
      const { count: mine } = await admin
        .from('batches')
        .select('id', { count: 'exact', head: true })
        .eq('catch_id', l.catch_id)
        .eq('mashmaker_id', l.mashmaker_id);

      const { data: conns } = await admin
        .from('connections')
        .select('user_a, user_b')
        .or(`user_a.eq.${l.mashmaker_id},user_b.eq.${l.mashmaker_id}`);
      const friendIds = (conns ?? [])
        .map((x: { user_a: string; user_b: string }) =>
          x.user_a === l.mashmaker_id ? x.user_b : x.user_a,
        )
        .filter((id: string) => id !== l.catch_id);
      const { count: nominatable } = friendIds.length
        ? await admin
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .in('id', friendIds)
            .eq('role', 'catch')
            .eq('paused', false)
            .eq('open_to_matching', true)
            .eq('onboarding_complete', true)
        : { count: 0 };

      const text = nudgeText({
        catchFirstName: c.first_name,
        hasVouch: !!vouch,
        openBatch: !!(open && open.length),
        batchesFromThisMashmaker: mine ?? 0,
        nominatable: nominatable ?? 0,
      });
      if (!text) continue;
      await notify(l.mashmaker_id, 'nudge', text, {
        catch_id: l.catch_id,
        route: '/(mashmaker)/catches',
      });
      sent += 1;
    }
    return json({ sent, expired: expired ?? 0 });
  }),
);

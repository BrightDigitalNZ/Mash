// Scheduled. The agent's job between lineups is working the vouchers.
// "Tin's circle is 3. Matches unlock at 10." / "Tin's had one lineup, yours is still to come."
//
// Run daily via Supabase cron (see README). Protected by a shared secret because it uses
// the service role. At most one nudge per voucher per single per week.

import { admin, handler, json, HttpError } from '../_shared/supabase.ts';
import { notify } from '../_shared/push.ts';
import { nudgeText } from '../_shared/rules.ts';

const CIRCLE_UNLOCK = Number(Deno.env.get('CIRCLE_UNLOCK') ?? '10');

Deno.serve(
  handler(async (req) => {
    const secret = Deno.env.get('CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) throw new HttpError(401, 'Bad secret');

    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: vouches } = await admin
      .from('vouches')
      .select('voucher_id, single_id, profiles:single_id(first_name, paused, role)')
      .limit(5000);

    let sent = 0;
    for (const v of vouches ?? []) {
      const single = v.profiles as unknown as { first_name: string; paused: boolean; role: string } | null;
      if (!single || single.paused || single.role !== 'single') continue;

      const { data: recent } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', v.voucher_id)
        .eq('kind', 'nudge')
        .contains('data', { single_id: v.single_id })
        .gte('created_at', weekAgo)
        .limit(1);
      if (recent && recent.length) continue;

      const { data: circle } = await admin.rpc('circle_size', { single: v.single_id });
      const { count: mine } = await admin
        .from('lineups')
        .select('id', { count: 'exact', head: true })
        .eq('single_id', v.single_id)
        .eq('voucher_id', v.voucher_id);
      const { count: others } = await admin
        .from('lineups')
        .select('id', { count: 'exact', head: true })
        .eq('single_id', v.single_id)
        .neq('voucher_id', v.voucher_id);

      // How many of this voucher's connections could be nominated.
      const { data: conns } = await admin
        .from('connections')
        .select('user_a, user_b')
        .or(`user_a.eq.${v.voucher_id},user_b.eq.${v.voucher_id}`);
      const friendIds = (conns ?? [])
        .map((c: { user_a: string; user_b: string }) => (c.user_a === v.voucher_id ? c.user_b : c.user_a))
        .filter((id: string) => id !== v.single_id);
      const { count: nominatable } = friendIds.length
        ? await admin
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .in('id', friendIds)
            .eq('role', 'single')
            .eq('paused', false)
            .eq('onboarding_complete', true)
        : { count: 0 };

      const text = nudgeText({
        singleFirstName: single.first_name,
        circleSize: Number(circle ?? 0),
        unlockAt: CIRCLE_UNLOCK,
        lineupsFromThisVoucher: mine ?? 0,
        lineupsFromOthers: others ?? 0,
        nominatable: nominatable ?? 0,
      });
      if (!text) continue;

      await notify(v.voucher_id, 'nudge', text, { single_id: v.single_id, route: '/(voucher)/friends' });
      sent += 1;
    }

    return json({ sent });
  }),
);

# Mash

A dating app where your friends do the matching. No strangers, no swiping, just people someone you know has vouched for.

Mash brings the friend introduction back. A Catch (anyone single on Mash) picks a Mashmaker, a friend who knows them and knows people. The Mashmaker picks Catches from their own circle and says why. The Machine (the AI layer) checks everyone is real before anyone meets. Launching in New Zealand and Australia together.

This repository is the iOS app (Expo, React Native) and its backend (Supabase Postgres, edge functions, Claude as the Machine). It implements the founders' briefs of 12 October 2026: "Mash: Brand, Product and Trust Brief" and "Mash: Brand Strategy, Rules and Tone of Voice". Decisions those briefs mark OPEN are server-side switches in `app_settings`, never hard-coded.

## Vocabulary (locked)

| Term | Meaning |
|---|---|
| Mashmaker | The friend who does the matching. Free forever. |
| Catch | Anyone single on Mash. Both the person being matched and the person they are matched with. |
| Machine | The AI layer. Verification, due diligence, matching assist, safety. One name outside, several agents inside. |
| Mash (noun) | An introduction made by a Mashmaker between two Catches. |
| mash, mashed (verb) | To introduce. "Kim mashed us." |
| Batch | A set of Catches delivered to a Catch at once. A reveal, not a feed. |
| Vouch | What a Mashmaker does. A verb, not a role. |

Not used anywhere in the product: Voucher, Seeker, Datee, Single (as a role), Flame, Spark, Wingman, Mashine. The voice lives in `src/lib/copy.ts`.

## What is here

```
src/app/                 Expo Router screens
  (auth)/welcome         Sign in with Apple, Google, Facebook (identity only, no friend graph)
  (onboarding)/          about (incl. who you'd like to meet), role, rules (must be accepted),
                         criteria + the separate "Match me" yes, contacts (hashed on device), ask (pick Mashmakers)
  (catch)/               mashmakers (home), mashes, you
  (mashmaker)/           catches (home), record (private), you
  batch/[id]             the reveal (Catch) and the watch (Mashmaker), one file, two modes
  consent/[batchId]      "X would like to show you to Y. Okay?" The nominee's yes before anyone sees them
  mash/[id]              the introduction: both know who mashed them, chat, outcome, the Machine's checks
  vouch/[catchId]        the Mashmaker's note, screened for the things that would embarrass the subject
  nominate/[catchId]     pick three to five people from your own contacts; the Machine filters and asks them
  invite                 invite someone not on Mash, in your own words, from your own phone
  settings/              profile and verification, what you're after, what your Mashmakers see, the
                         Machine's checks (consent + linked public pages), exclusions, Mash Plus, promises
  report/[userId]        goes to the safety team, never to a Mashmaker
src/lib/copy.ts          the voice: lines, the Mashmaker rules, the Catch rules, the public promises
src/lib/api.ts           every write; src/hooks/useData.ts every read (Supabase Realtime where it matters)
src/lib/demo.ts          the browser demo's in-memory story
src/store/session.ts     who is signed in, their profile, where they should land
src/components/ui.tsx    the component kit (deck palette: black, white, one red, Bricolage Grotesque)
src/types/database.ts    the schema, typed
supabase/migrations/     schema, row level security, RPCs, the switches
supabase/functions/      match-contacts, build-batch, decide, brief, nudge-mashmakers
```

## How the pieces fit

1. **Sign in** creates a `profiles` row by trigger. Identity only: minimum scopes, no `user_friends`. Onboarding asks date of birth (18+ enforced by a database check), city, gender and who you would like to meet. Orientation is used to filter nominations and is never shown as a badge or a filter to anyone.
2. **Rules.** The Mashmaker rules and the Catch rules from Brief 2 are shown at onboarding and must be accepted (`*_rules_accepted_at`). They are also in Settings.
3. **Two yeses.** Being on Mash and being matched are separate. `open_to_matching` is its own switch, set on its own screen, never at signup.
4. **Contacts** are read on the device, normalised to E.164 and hashed with SHA-256 (`src/lib/contacts.ts`). Only hashes are uploaded, only when the person taps re-sync. `match-contacts` finds who in your contacts is on Mash and writes `connections`. Non-users exist only as a hash and a pending invite. No shadow profiles, no reverse lookup.
5. **Mashmakers.** A Catch asks, the Mashmaker accepts (`mashmaker_links`). A Mashmaker may offer to a Catch already on Mash; the Catch still accepts. Neither is assigned. Ending the link is one tap and tells nobody why. `mashmaker_cap` is a switch (0 = none).
6. **The note.** A Mashmaker vouches with a short note to a rotating prompt. Minimum length is a switch (`vouch_min_length`); `noteProblems()` in `supabase/functions/_shared/rules.ts` screens for body, money, exes and "trust me". Their words are shown untouched.
7. **Batches.** A Mashmaker picks up to `batch_max` (three to five) people from `nominatable_for()`: their own connections who are Catches, open to matching, compatible, not blocked or excluded, not in an open mash with this Catch, and not re-nominated inside `renomination_block_months`. `build-batch` asks Claude to say why for each and to drop anyone who does not fit what the Catch asked for. Every nominee is asked ("okay to be shown?") before the Catch sees them; `can_see_profile` enforces that. One batch open per Catch at a time. Positions order the reveal and never score a person.
8. **Mashes.** A "meet" creates a pending mash and asks the other Catch. Mutual yes opens the chat with the Mashmaker's words as the first line, so both always know who introduced them. A pass tells nobody why. A pending mash times out after `intro_expiry_days` ("This one timed out."). The Mashmaker sees status only; post-date outcome only at the level the Catch chose each time (`outcomes.share`).
9. **The Machine's checks** (due diligence) run with the subject's specific consent (`dd_consent`) on the public pages they linked, public sources only. The brief is stored against the requester, readable by the requester only (RLS), never by the Mashmaker or the subject, and deleted when the mash closes. Every brief prints its limitation. Whether it is paid is a switch (`dd_requires_plus`).
10. **Money.** Catches: $19.95 a month or $49.95 for three months. Mashmakers free forever. 21-day trial; `trial_gate` decides whether the clock starts at signup or at the first batch (default first batch). Paid buys depth, never more people.
11. **Safety.** Block, report and close on every mash. Reports go to the safety team; the reporter chooses what their Mashmaker learns. Exclusion list is silent and permanent. Leaving is one tap: `delete_my_account()` removes the auth user and cascades everything; Mashmakers get a thank-you, not details.

## The switches

`app_settings` holds every OPEN decision so it can change without a release:

| key | default | what |
|---|---|---|
| trial_days | 21 | length of the Catch trial |
| trial_gate | first_batch | first_batch or signup |
| dd_requires_plus | true | whether the Machine's checks are paid |
| batch_max | 5 | nominations per batch |
| verification_mode | liveness | liveness or id |
| verification_image_retention_days | 7 | identity images deleted after |
| intro_expiry_days | 7 | a pending mash times out after |
| renomination_block_months | 12 | a declined or closed pair cannot be re-nominated for |
| mashmaker_cap | 0 | most Mashmakers per Catch, 0 = none |
| pause_requires_plus | false | whether pausing is paid |
| vouch_min_length | 20 | shortest note |

## Running it

### Prerequisites

- Node 22, npm
- A Supabase project (free tier is fine to start)
- An Anthropic API key
- Apple Developer account for Sign in with Apple and TestFlight; Google and Facebook OAuth apps
- Expo account and EAS CLI for builds (`npx eas-cli@latest`)
- Optional: PostHog project for the metrics

### 1. Install

```bash
npm install
cp .env.example .env   # fill in Supabase URL and anon key, PostHog key
```

### 2. Database

Install the Supabase CLI, then:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                       # applies supabase/migrations/0001_init.sql
```

The migration creates every table, enum, policy, trigger, RPC and switch, plus the `avatars` storage bucket. Row level security is on for every table. The Machine's writes go through the service role only.

To regenerate `src/types/database.ts` from the live schema:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

### 3. Auth providers

In the Supabase dashboard, Authentication > Providers:

- **Apple**: enable, add your Services ID and key. The app uses native Sign in with Apple and exchanges the identity token (`signInWithIdToken`), so add the app's bundle id `nz.co.brightdigital.mash` to the Apple provider's client ids.
- **Google** and **Facebook**: enable with your OAuth client id and secret. Add `mash://auth/callback` to Redirect URLs. Request only `openid email profile` (Google) and `public_profile,email` (Facebook). Never request `user_friends`.

### 4. Edge functions

Set secrets, then deploy:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... \
  CRON_SECRET=$(openssl rand -hex 24) \
  EXPO_ACCESS_TOKEN=<optional, for Expo push security>
supabase functions deploy match-contacts build-batch decide brief nudge-mashmakers
```

`MACHINE_MODEL` defaults to `claude-opus-5-5`. The Machine enables Anthropic's server-side refusal fallback (`fallbacks: "default"`), so a declined request is re-run on the recommended fallback model instead of failing the batch. Remove the `betas` and `fallbacks` lines in `supabase/functions/_shared/machine.ts` if you do not want that.

Schedule the nightly job (nudges quiet Mashmakers, expires timed-out mashes) with pg_cron (Database > Extensions > enable `pg_cron` and `pg_net`, then in the SQL editor):

```sql
select cron.schedule(
  'mash-nightly', '0 20 * * *',
  $$ select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/nudge-mashmakers',
       headers := '{"x-cron-secret": "<CRON_SECRET>"}'::jsonb
     ) $$
);
```

### 5. Run on a device

The app uses native modules (contacts, Apple sign in, notifications), so Expo Go will not do. Build a development client:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure      # writes the real projectId into app.json extra.eas.projectId
npm run build:dev                        # development build for a registered iPhone
npx expo start --dev-client
```

### 6. TestFlight

```bash
npm run build:ios
npm run submit:ios
```

Fill `eas.json` > `submit.production.ios.ascAppId` with the App Store Connect app id first. Dating apps get extra review: have a demo account ready, a written content moderation description, and the block/report flow (it is in `mash/[id]` and `report/[userId]`). The contacts purpose string in `app.json` is specific on purpose; keep it that way.

## Browser demo

`npm run demo:web` exports the app for the web in demo mode and writes `dist-demo/`. Demo mode (`EXPO_PUBLIC_DEMO=1`) swaps Supabase for an in-memory story in `src/lib/demo.ts`: Tin, a Catch with Holly and Kim as her Mashmakers, a ready batch from Holly, a mash with Ben, a consent request from Mark; Holly, a Mashmaker with three Catches, a request from Priya and a private record. Every screen works with no backend, no sign-in and no native modules. Open `dist-demo/index.html` from any static host; `dist-demo/artifact.html` is the same page as a fragment for hosts that wrap it.

## Checks

```bash
npm run typecheck   # tsc --noEmit, app and edge functions
npm run lint        # expo lint
npm test            # jest: rules (batch sanitising, nudges, note screening), routing
```

The edge functions are Deno. `npm run typecheck` also type-checks them with tsc using `tsconfig.functions.json` (a small Deno shim plus the npm packages they import), so no Deno install is needed to catch type errors. The schema has a smoke test that runs against a local Postgres with `auth` and `storage` stubs; it covers consent gating, link acceptance, exclusions, entitlement, brief purge, expiry, the re-nomination block and the Mashmaker cap.

## Mash Plus

The paywall screen (`settings/plus`), the pricing and the `is_plus` / `plus_until` / trial columns exist. The store purchase is not wired: `is_plus` can only be set by the service role (a trigger reverts client writes), so the intended path is RevenueCat or StoreKit 2 with a webhook into a small edge function that sets `is_plus` and `plus_until`. Net on $19.95 after store commission is roughly $14 to $17. Mashmakers never pay.

## Metrics

`src/lib/analytics.ts` names the events. The company north metric is "met and went again": `met_and_went_again` fires on an outcome of met_again, dating or together. Not matches, messages or time in app.

## Privacy choices made in code

- Contacts: hashed on device with SHA-256. Raw names and numbers never leave the phone. The server stores only hashes and user-to-user links. Re-sync is explicit.
- Non-users: exist only as a hash and a pending invite. No profile until they sign in. Mash never contacts them; the invite comes from the Mashmaker's phone and says who sent it.
- Visibility: `can_see_profile()` is the one place that decides who may read a profile: yourself, your Mashmakers, the other side of a mash, and a Catch looking at a nominee who has said yes.
- Due diligence: requester-only rows, purged when the mash closes, public sources only, limitation printed every time.
- Verification: the result and the date are kept, never the document.
- Social login: identity only, minimum scopes.
- Deletion: `delete_my_account()` removes the auth user and cascades everything.

Before public launch, budget an independent security review of auth, storage and contact hashing.

## What is not built

Android, the store purchase flow, the identity or liveness vendor (a stand-in sets the flags), screenshot blocking, the safety agent's conversation monitoring, the launch-event headshot upload, memorialise-or-delete, and the Machine's concierge voice beyond the lines in `copy.ts`. Each OPEN item in the briefs is a switch, not a decision.

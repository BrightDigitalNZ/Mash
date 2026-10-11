# Mash

Dating, but someone's got your back.

Mash is a friends-of-friends dating app for people aged 30 to 50 in New Zealand and Australia. Friends install it, share hashed contacts, and nominate singles they would vouch for. An AI matchmaker turns those nominations into a lineup, with a plain-language reason for each person. Nobody is shown to anybody without a human link between them. No swiping, no strangers, no paywall before the first match.

This repository is the iOS app (Expo, React Native) and its backend (Supabase Postgres, edge functions, Claude as the matchmaker). It implements the product described in the business plan "Mash | High-level business plan" dated 11 October 2026.

## What is here

```
src/app/                 Expo Router screens
  (auth)/welcome         Sign in with Apple, Google, Facebook (identity only, no friend graph)
  (onboarding)/          about, role, criteria (5 questions), contacts (hash on device), nominate
  (single)/              circle (home), intros, you
  (voucher)/             friends (home), record (private), you
  lineup/[id]            the reveal (single) and the couch seat (voucher), one file, two modes
  intro/[id]             introduction, chat, outcome, brief, block/report/unmatch
  vouch/[singleId]       write a vouch to this week's rotating prompt
  nominate/[singleId]    pick up to 10 people, send to the matchmaker
  invite                 invite friends not yet on Mash, in your own words
  settings/              profile, criteria, linked profiles + brief consent, Mash Plus, pause, delete
  report/[userId]        report flow
src/lib/                 supabase client, auth, contacts hashing, push, analytics, api (every write)
src/hooks/useData.ts     every read, with Supabase Realtime where it matters
src/store/session.ts     who is signed in, their profile, where they should land
src/components/ui.tsx    the component kit
src/theme/               colours, spacing, type scale
src/types/database.ts    the schema, typed
supabase/migrations/     schema, row level security, RPCs
supabase/functions/      match-contacts, build-lineup, decide, brief, nudge-vouchers
```

## How the pieces fit

1. **Sign in** creates a `profiles` row by trigger. Name and photo come from the social login. The app asks only for date of birth (18+ is enforced by a database check), city and, for singles, five criteria questions.
2. **Contacts** are read on the device, each number normalised to E.164 and hashed with SHA-256 (`src/lib/contacts.ts`). Only hashes are uploaded. The `match-contacts` function finds who in your contacts is on Mash, in both directions, and writes `connections`. A nominated person who has not joined exists only as a hash and a pending invite.
3. **Vouching** is the growth loop. A voucher answers one rotating weekly prompt in a sentence. The vouch is shown to the match word for word. A single's home screen is their circle: faces and what they wrote. Lineups unlock at 10 vouchers; the app shows progress instead of a gate.
4. **Lineups.** A voucher picks up to 10 of their own connections. `build-lineup` asks Claude to keep up to 7 against the single's criteria and vouches, with a one-sentence reason each, and tells the voucher which it dropped and why. The voucher may bring one back. The single reveals them one at a time, vouch first, photo second, and picks meet, maybe or not this time. The voucher watches live and can comment.
5. **Introductions.** A "meet" creates a pending introduction and shows the other person the reverse: the single, vouched by the same friend. If both say meet, the chat opens with the vouch as its first message and the voucher hears what happened in plain words. Declining tells nobody.
6. **The brief** (Mash Plus) is consent-first. You link the public profiles you want seen, switch on "share a brief about me", build the brief, read it, then release it. The function fetches only what you linked, never searches, and skips Meta properties entirely. The reasons are in the plan's legal section.
7. **Safety.** Block, report and unmatch on every profile. Reports are read by a person within 24 hours. Account deletion is in Settings.

## Running it

### Prerequisites

- Node 22, npm
- A Supabase project (free tier is fine to start)
- An Anthropic API key
- Apple Developer account for Sign in with Apple and TestFlight; Google and Facebook OAuth apps
- Expo account and EAS CLI for builds (`npx eas-cli@latest`)
- Optional: PostHog project for the five metrics

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

The migration creates every table, enum, policy, trigger and RPC, plus the `avatars` storage bucket. Row level security is on for every table. The matchmaker's writes (connections, lineups, introductions, briefs, notifications) go through the service role only.

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
  CIRCLE_UNLOCK=10 \
  CRON_SECRET=$(openssl rand -hex 24) \
  EXPO_ACCESS_TOKEN=<optional, for Expo push security>
supabase functions deploy match-contacts build-lineup decide brief nudge-vouchers
```

`MATCHMAKER_MODEL` defaults to `claude-opus-5-5`. The matchmaker enables Anthropic's server-side refusal fallback (`fallbacks: "default"`), so a declined request is re-run on the recommended fallback model instead of failing the lineup. Remove the `betas` and `fallbacks` lines in `supabase/functions/_shared/matchmaker.ts` if you do not want that.

Schedule the nudges once a day with pg_cron (Database > Extensions > enable `pg_cron` and `pg_net`, then in the SQL editor):

```sql
select cron.schedule(
  'mash-nudge-vouchers', '0 20 * * *',
  $$ select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/nudge-vouchers',
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

Fill `eas.json` > `submit.production.ios.ascAppId` with the App Store Connect app id first. Dating apps get extra review: have a demo account ready, a written content moderation description, and the block/report flow (it is in `intro/[id]` and `report/[userId]`). The contacts purpose string in `app.json` is specific on purpose; keep it that way.

## Browser demo

`npm run demo:web` exports the app for the web in demo mode and writes `dist-demo/`. Demo mode (`EXPO_PUBLIC_DEMO=1`) swaps Supabase for an in-memory story in `src/lib/demo.ts`: Tin the single with a circle of ten, Holly's fresh lineup, Kim's earlier lineup that led to Ben. Every screen works with no backend, no sign-in and no native modules. Open `dist-demo/index.html` from any static host; `dist-demo/artifact.html` is the same page as a fragment for hosts that wrap it. The build script keeps asset URLs relative and pins the address bar so the page can live at any fixed path.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest: contacts hashing, routing
```

The edge functions are Deno. `npm run typecheck` also type-checks them with tsc using `tsconfig.functions.json` (a small Deno shim plus the npm packages they import), so no Deno install is needed to catch type errors. With Deno installed, `deno check supabase/functions/*/index.ts` is the real thing.

## Mash Plus

The paywall screen (`settings/plus`) and the `is_plus` / `plus_until` columns exist. The store purchase is not wired: `is_plus` can only be set by the service role (a trigger reverts client writes), so the intended path is RevenueCat or StoreKit 2 with a webhook into a small edge function that sets `is_plus` and `plus_until`. Apple takes 15 percent under the Small Business Programme. Vouchers never pay.

## Metrics

`src/lib/analytics.ts` names the events. The five that matter, per the plan: voucher weekly actives, nominations per voucher, circle size at first match, 30-day retention, K-factor. Build those as PostHog insights from `vouch_written`, `lineup_requested`, `first_match`, `invite_sent` and `invite_accepted`.

## Privacy choices made in code

- Contacts: hashed on device with a salted SHA-256. Raw names and numbers never leave the phone. The server stores only hashes and user-to-user links.
- Non-users: exist only as a hash and a pending invite. No profile until they sign in.
- Brief: only linked, consented sources. No Meta scraping. The subject sees it first. Every source is cited.
- Social login: identity only, minimum scopes, no `user_friends`.
- Deletion: `delete_my_account()` removes the auth user and cascades everything.

Before public launch the plan budgets an independent security review of auth, storage and contact hashing. Do that.

## What is not built

Android (month 10 to 12 per the plan), video, voice, events, a web app, the store purchase flow, photo verification (a placeholder card exists), and the reverse image check on the user's own photos (consent switch exists, the check does not).

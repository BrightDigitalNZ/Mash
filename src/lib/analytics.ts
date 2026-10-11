// The five metrics that matter, named once so every screen uses the same strings.
// voucher weekly actives, nominations per voucher, circle size at first match, 30-day retention, K-factor.

import PostHog from 'posthog-react-native';

const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export const posthog: PostHog | null = key
  ? new PostHog(key, { host, captureAppLifecycleEvents: true })
  : null;

export const Events = {
  signedIn: 'signed_in',
  rolePicked: 'role_picked',
  criteriaSaved: 'criteria_saved',
  contactsGranted: 'contacts_granted',
  contactsDeclined: 'contacts_declined',
  contactsMatched: 'contacts_matched',
  inviteSent: 'invite_sent',
  inviteAccepted: 'invite_accepted',
  vouchWritten: 'vouch_written',
  lineupRequested: 'lineup_requested',
  lineupReady: 'lineup_ready',
  lineupOpened: 'lineup_opened',
  entryDecided: 'entry_decided',
  introMutual: 'intro_mutual',
  firstMatch: 'first_match',
  outcomeReported: 'outcome_reported',
  commentLeft: 'comment_left',
  plusViewed: 'plus_viewed',
  plusStarted: 'plus_started',
  paused: 'paused',
  reported: 'reported',
  blocked: 'blocked',
  accountDeleted: 'account_deleted',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export function track(event: EventName, props?: Record<string, string | number | boolean | null>) {
  posthog?.capture(event, props);
}

export function identify(userId: string, props?: Record<string, string | number | boolean | null>) {
  posthog?.identify(userId, props);
}

export function resetAnalytics() {
  posthog?.reset();
}

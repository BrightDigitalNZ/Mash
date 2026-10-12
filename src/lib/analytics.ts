// Events named once so every screen uses the same strings.
// Company north metric: "met and went again". Not matches, messages or time in app.

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
  matchingOptedIn: 'matching_opted_in',
  contactsGranted: 'contacts_granted',
  contactsDeclined: 'contacts_declined',
  contactsMatched: 'contacts_matched',
  inviteSent: 'invite_sent',
  inviteAccepted: 'invite_accepted',
  mashmakerAsked: 'mashmaker_asked',
  mashmakerAccepted: 'mashmaker_accepted',
  vouchWritten: 'vouch_written',
  batchRequested: 'batch_requested',
  consentAnswered: 'consent_answered',
  batchOpened: 'batch_opened',
  entryDecided: 'entry_decided',
  mashMutual: 'mash_mutual',
  firstMash: 'first_mash',
  outcomeReported: 'outcome_reported',
  metAndWentAgain: 'met_and_went_again',
  checksRequested: 'checks_requested',
  commentLeft: 'comment_left',
  plusViewed: 'plus_viewed',
  plusStarted: 'plus_started',
  paused: 'paused',
  reported: 'reported',
  blocked: 'blocked',
  excluded: 'excluded',
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

// Demo mode. Set EXPO_PUBLIC_DEMO=1 and the app runs against this in-memory story
// instead of Supabase: no backend, no sign-in, no native modules. Built so the app can
// be walked through in a browser. Every hook and every write in api.ts branches here.
//
// The story: Tin (a Catch, Auckland) asked Holly and Kim to be her Mashmakers and both
// said yes. Kim's batch led to Ben, and they are talking. Holly's batch is ready: three
// people who have each said yes to being shown. Mark wants to show Tin to Owen and is
// waiting on her answer. Priya has asked Holly to be her Mashmaker too.
//
// Vocabulary: Mashmaker, Catch, Machine, batch, mash. A Mashmaker vouches (verb).

import { Asset } from 'expo-asset';

import type { BuildBatchResult, MatchContactsResult } from '@/lib/api';
import type { LocalContact } from '@/lib/contacts';
import type { BatchWithPeople, ConsentRequest, MashWithPeople } from '@/hooks/useData';
import type {
  Batch,
  BatchComment,
  BatchEntry,
  Brief,
  BriefContent,
  Criteria,
  EntryDecision,
  ExcludedHash,
  IntentKind,
  Invite,
  LinkedKind,
  LinkedProfile,
  Mash,
  MashStatus,
  MashmakerLink,
  Message,
  MyCatchRow,
  MyMashmakerRow,
  NominatableRow,
  Notification,
  Outcome,
  OutcomeKind,
  Profile,
  PublicProfile,
  RecordRow,
  Report,
  ShareLevel,
  VouchPrompt,
} from '@/types/database';
import { outcomeLineForMashmaker, statusForOutcome } from '../../supabase/functions/_shared/rules';

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export type Persona = 'tin' | 'holly';

// --- settings (the server-side switches from the Brief) ----------------------

const SETTINGS: Record<string, string> = {
  trial_days: '21',
  trial_gate: 'first_batch',
  dd_requires_plus: 'true',
  batch_max: '5',
  verification_mode: 'liveness',
  verification_image_retention_days: '7',
  intro_expiry_days: '7',
  renomination_block_months: '12',
  mashmaker_cap: '0',
  pause_requires_plus: 'false',
  vouch_min_length: '20',
};

// --- people -----------------------------------------------------------------

// Illustrated avatars bundled with the app (generated offline with DiceBear notionists).
// Browsers and the demo host block images from other origins, so nothing external is loaded.

const AVATARS: Record<string, number> = {
  tin: require('@/demo-assets/tin.svg'),
  holly: require('@/demo-assets/holly.svg'),
  kim: require('@/demo-assets/kim.svg'),
  ben: require('@/demo-assets/ben.svg'),
  sam: require('@/demo-assets/sam.svg'),
  mia: require('@/demo-assets/mia.svg'),
  nico: require('@/demo-assets/nico.svg'),
  ria: require('@/demo-assets/ria.svg'),
  dev: require('@/demo-assets/dev.svg'),
  leo: require('@/demo-assets/leo.svg'),
  jack: require('@/demo-assets/jack.svg'),
  owen: require('@/demo-assets/owen.svg'),
  paul: require('@/demo-assets/paul.svg'),
  priya: require('@/demo-assets/priya.svg'),
  jess: require('@/demo-assets/jess.svg'),
  mark: require('@/demo-assets/mark.svg'),
  anna: require('@/demo-assets/anna.svg'),
  tom: require('@/demo-assets/tom.svg'),
  sophie: require('@/demo-assets/sophie.svg'),
  dan: require('@/demo-assets/dan.svg'),
  lucy: require('@/demo-assets/lucy.svg'),
  matt: require('@/demo-assets/matt.svg'),
};

const photo = (id: string) => Asset.fromModule(AVATARS[id] ?? AVATARS.tin!).uri;
const years = (age: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
};
const ago = (hours: number) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
const now = () => new Date().toISOString();

type Gender = NonNullable<Profile['gender']>;

function person(
  id: string,
  first: string,
  role: Profile['role'],
  gender: Gender,
  age: number,
  city: string,
  bio: string | null = null,
): Profile {
  const catchRole = role === 'catch';
  return {
    id,
    role,
    first_name: first,
    last_name: '',
    photo_url: photo(id),
    date_of_birth: years(age),
    city,
    country: city === 'Sydney' || city === 'Melbourne' || city === 'Perth' ? 'AU' : 'NZ',
    bio,
    gender,
    seeking: catchRole ? (gender === 'woman' ? ['man'] : ['woman']) : [],
    phone_hash: `hash-${id}`,
    open_to_matching: catchRole,
    is_plus: false,
    plus_until: null,
    trial_started_at: null,
    trial_ends_at: null,
    paused: false,
    onboarding_complete: true,
    verified_identity: true,
    photos_current: id !== 'jack',
    verified_at: ago(24 * 20),
    dd_consent: id === 'ben' || id === 'tin' || id === 'sam',
    mashmaker_visibility: 'minimal',
    catch_rules_accepted_at: catchRole ? ago(24 * 40) : null,
    mashmaker_rules_accepted_at: catchRole ? null : ago(24 * 40),
    created_at: ago(24 * 40),
    updated_at: ago(2),
  };
}

const people: Record<string, Profile> = Object.fromEntries(
  [
    person(
      'tin',
      'Tin',
      'catch',
      'woman',
      38,
      'Auckland',
      'Runs a small design studio. Swims at Takapuna most mornings, rain or not.',
    ),
    person('holly', 'Holly', 'mashmaker', 'woman', 36, 'Auckland'),
    person('kim', 'Kim', 'mashmaker', 'woman', 39, 'Auckland'),
    person(
      'ben',
      'Ben',
      'catch',
      'man',
      41,
      'Auckland',
      'Structural engineer. Two kids every second week. Cooks properly, badly at karaoke.',
    ),
    person(
      'sam',
      'Sam',
      'catch',
      'man',
      37,
      'Auckland',
      'Teaches year 9 science. Trail runner. Reads more than he lets on.',
    ),
    person(
      'mia',
      'Mia',
      'catch',
      'woman',
      35,
      'Wellington',
      'Policy analyst, back in Wellington after six years in London.',
    ),
    person(
      'nico',
      'Nico',
      'catch',
      'man',
      40,
      'Auckland',
      'Chef turned sourdough supplier. Early nights, early mornings.',
    ),
    person(
      'ria',
      'Ria',
      'catch',
      'woman',
      42,
      'Auckland',
      'Physio. Has a dog called Barry who comes to everything.',
    ),
    person(
      'dev',
      'Dev',
      'catch',
      'man',
      39,
      'Auckland',
      'Product manager, lapsed drummer, very good at pub quizzes.',
    ),
    person(
      'leo',
      'Leo',
      'catch',
      'man',
      45,
      'Auckland',
      'Builder. Restoring a 1970s bach up north on weekends.',
    ),
    person('jack', 'Jack', 'catch', 'man', 44, 'Perth', 'Mining engineer. Home every third week.'),
    person(
      'owen',
      'Owen',
      'catch',
      'man',
      38,
      'Auckland',
      'Radiographer. Plays bass in a band that only does weddings.',
    ),
    person(
      'paul',
      'Paul',
      'catch',
      'man',
      43,
      'Auckland',
      'Runs a bike shop in Kingsland. Will fix your puncture for a coffee.',
    ),
    person(
      'priya',
      'Priya',
      'catch',
      'woman',
      36,
      'Auckland',
      'Vet nurse. Learning to sail, slowly.',
    ),
    person('jess', 'Jess', 'mashmaker', 'woman', 37, 'Auckland'),
    person('mark', 'Mark', 'mashmaker', 'man', 40, 'Auckland'),
    person('anna', 'Anna', 'mashmaker', 'woman', 38, 'Auckland'),
    person('tom', 'Tom', 'mashmaker', 'man', 41, 'Auckland'),
    person('sophie', 'Sophie', 'mashmaker', 'woman', 36, 'Auckland'),
    person('dan', 'Dan', 'mashmaker', 'man', 39, 'Auckland'),
    person('lucy', 'Lucy', 'mashmaker', 'woman', 35, 'Auckland'),
    person('matt', 'Matt', 'mashmaker', 'man', 42, 'Auckland'),
  ].map((p) => [p.id, p]),
);

// Tin is six days into her trial. The clock started at her first batch (Kim's), per the switch.
people.tin!.trial_started_at = ago(24 * 6);
people.tin!.trial_ends_at = ago(-24 * 15);

function ageOf(p: Profile): number | null {
  if (!p.date_of_birth) return null;
  const d = new Date(p.date_of_birth);
  const n = new Date();
  let age = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) age -= 1;
  return age;
}

function pub(id: string): PublicProfile {
  const p = people[id];
  if (!p) throw new Error(`demo: no person ${id}`);
  return {
    id: p.id,
    first_name: p.first_name,
    photo_url: p.photo_url,
    city: p.city,
    bio: p.bio,
    verified_identity: p.verified_identity,
    photos_current: p.photos_current,
    age: ageOf(p),
  };
}

const first = (id: string) => people[id]?.first_name ?? 'Someone';

// --- state ------------------------------------------------------------------

interface VouchRow {
  id: string;
  mashmaker_id: string;
  catch_id: string;
  prompt_id: number | null;
  prompt: string;
  text: string;
  how_known: string | null;
  created_at: string;
}

const state = {
  me: null as Persona | null,
  criteria: new Map<string, Criteria>(),
  links: [] as MashmakerLink[],
  vouches: [] as VouchRow[],
  connections: new Set<string>(),
  invites: [] as Invite[],
  batches: [] as Batch[],
  entries: [] as BatchEntry[],
  comments: [] as BatchComment[],
  mashes: [] as Mash[],
  messages: [] as Message[],
  outcomes: [] as Outcome[],
  briefs: [] as Brief[],
  linked: [] as LinkedProfile[],
  exclusions: [] as ExcludedHash[],
  blocks: new Set<string>(),
  reports: [] as Report[],
  notifications: [] as Notification[],
};

const PROMPTS = [
  'What would you say about them to someone at a wedding?',
  'What do they do that their friends take for granted?',
  'What is the kindest thing you have seen them do?',
];

function vouch(
  mashmaker: string,
  catchId: string,
  text: string,
  how: string,
  hoursAgo: number,
  promptId = 1,
): VouchRow {
  return {
    id: `v-${mashmaker}-${catchId}`,
    mashmaker_id: mashmaker,
    catch_id: catchId,
    prompt_id: promptId,
    prompt: PROMPTS[promptId - 1] ?? PROMPTS[0]!,
    text,
    how_known: how,
    created_at: ago(hoursAgo),
  };
}

function link(
  catchId: string,
  mashmakerId: string,
  status: MashmakerLink['status'],
  requestedBy: string,
  hoursAgo: number,
): MashmakerLink {
  return {
    id: `L-${catchId}-${mashmakerId}`,
    catch_id: catchId,
    mashmaker_id: mashmakerId,
    status,
    requested_by: requestedBy,
    created_at: ago(hoursAgo),
    answered_at: status === 'requested' ? null : ago(hoursAgo - 2),
  };
}

function connect(a: string, b: string) {
  state.connections.add(a < b ? `${a}|${b}` : `${b}|${a}`);
}
function connected(a: string, b: string) {
  return state.connections.has(a < b ? `${a}|${b}` : `${b}|${a}`);
}
function blocked(a: string, b: string) {
  return state.blocks.has(`${a}|${b}`) || state.blocks.has(`${b}|${a}`);
}
function excluded(owner: string, other: string) {
  const hash = people[other]?.phone_hash;
  return !!hash && state.exclusions.some((e) => e.owner_id === owner && e.hash === hash);
}

function entry(
  id: string,
  batchId: string,
  candidate: string,
  opts: Partial<BatchEntry> & { kept: boolean },
): BatchEntry {
  return {
    id,
    batch_id: batchId,
    candidate_id: candidate,
    position: null,
    reason: null,
    dropped_reason: null,
    mashmaker_overrode: false,
    consent: 'pending',
    consent_at: null,
    decision: 'undecided',
    decided_at: null,
    revealed_at: null,
    ...opts,
  };
}

function seed() {
  state.criteria.set('tin', {
    catch_id: 'tin',
    age_min: 36,
    age_max: 48,
    radius_km: 30,
    dealbreakers: ['Smoker', 'Long distance', 'Not over an ex'],
    intent: 'relationship',
    open_text: 'Someone who has their life together and still laughs at themselves.',
    updated_at: ago(24 * 30),
  });
  state.criteria.set('ria', {
    catch_id: 'ria',
    age_min: 36,
    age_max: 50,
    radius_km: 40,
    dealbreakers: ['Does not like dogs'],
    intent: 'see_where_it_goes',
    open_text: null,
    updated_at: ago(24 * 40),
  });
  state.criteria.set('owen', {
    catch_id: 'owen',
    age_min: 32,
    age_max: 44,
    radius_km: 30,
    dealbreakers: [],
    intent: 'relationship',
    open_text: null,
    updated_at: ago(24 * 12),
  });

  // Who asked whom. A Catch asks, the Mashmaker accepts. Neither can be assigned.
  state.links = [
    link('tin', 'holly', 'accepted', 'tin', 24 * 30),
    link('tin', 'kim', 'accepted', 'tin', 24 * 28),
    link('tin', 'jess', 'requested', 'tin', 20),
    link('priya', 'holly', 'requested', 'priya', 6),
    link('ria', 'holly', 'accepted', 'ria', 24 * 40),
    link('ben', 'kim', 'accepted', 'ben', 24 * 35),
    link('ben', 'mark', 'accepted', 'ben', 24 * 33),
    link('owen', 'mark', 'accepted', 'mark', 24 * 12),
    link('sam', 'holly', 'accepted', 'sam', 24 * 20),
  ];

  state.vouches = [
    vouch(
      'holly',
      'tin',
      'The one everyone calls first when it goes wrong, and the first to laugh when it goes right.',
      'Flatmates in 2012',
      24 * 29,
    ),
    vouch(
      'kim',
      'tin',
      'She turned up to my dad’s funeral with a lasagne and stayed to do the dishes. That is Tin.',
      'Work, ten years ago',
      24 * 27,
      3,
    ),
    vouch(
      'kim',
      'ben',
      'Fixes things before you notice they were broken. Will drive two hours for a good pie.',
      'Our kids are at school together',
      24 * 34,
      2,
    ),
    vouch(
      'mark',
      'ben',
      'Steady. The friend who actually turns up to help you move.',
      'Uni',
      24 * 32,
    ),
    vouch(
      'holly',
      'ria',
      'Laughs with her whole body. Barry the dog is non-negotiable and that is correct.',
      'Netball',
      24 * 39,
    ),
    vouch(
      'holly',
      'sam',
      'Explains things so you feel clever, not stupid. Rare.',
      'My brother’s mate',
      24 * 19,
      2,
    ),
    vouch(
      'mark',
      'owen',
      'Plays bass like nobody is watching, which at weddings nobody is.',
      'Band',
      24 * 11,
    ),
  ];

  // Contact matches (hashes matched on the server, raw contacts never left the phone).
  const circles: Record<string, string[]> = {
    tin: ['holly', 'kim', 'jess', 'mark', 'anna', 'sophie', 'lucy'],
    holly: [
      'tin',
      'sam',
      'nico',
      'paul',
      'jack',
      'dev',
      'ria',
      'priya',
      'mia',
      'ben',
      'anna',
      'tom',
    ],
    kim: ['tin', 'ben', 'leo', 'dan', 'matt'],
    mark: ['owen', 'tin', 'mia', 'ben', 'priya', 'tom'],
    jess: ['tin', 'nico', 'sophie'],
  };
  for (const [a, list] of Object.entries(circles)) for (const b of list) connect(a, b);

  // Kim's batch for Tin, six days ago. Ben said yes, Leo did not. The batch is done.
  state.batches.push({
    id: 'B-kim',
    mashmaker_id: 'kim',
    catch_id: 'tin',
    status: 'done',
    machine_note: 'Two of your three fit. Both said yes to being shown.',
    created_at: ago(24 * 6),
    ready_at: ago(24 * 6 + 2),
    done_at: ago(24 * 3),
  });
  state.entries.push(
    entry('E-kim-ben', 'B-kim', 'ben', {
      kept: true,
      position: 1,
      reason:
        'Kim vouched for Ben. Same side of town, both after something real, both have kids every second week.',
      consent: 'yes',
      consent_at: ago(24 * 6 + 1),
      decision: 'meet',
      decided_at: ago(24 * 4),
      revealed_at: ago(24 * 4),
    }),
    entry('E-kim-leo', 'B-kim', 'leo', {
      kept: true,
      position: 2,
      reason: 'Kim knows Leo from the bach. Handy, outdoorsy, straightforward.',
      consent: 'yes',
      consent_at: ago(24 * 6),
      decision: 'meet',
      decided_at: ago(24 * 4),
      revealed_at: ago(24 * 4),
    }),
    entry('E-kim-dan', 'B-kim', 'dan', {
      kept: false,
      dropped_reason: 'Dan is not a Catch on Mash. He would need to switch matching on first.',
    }),
  );

  // Tin and Ben: mutual, talking. Both know Kim introduced them.
  state.mashes.push({
    id: 'M-tin-ben',
    catch_id: 'tin',
    candidate_id: 'ben',
    mashmaker_ids: ['kim'],
    batch_entry_id: 'E-kim-ben',
    catch_decision: 'meet',
    candidate_decision: 'meet',
    status: 'mutual',
    created_at: ago(24 * 4),
    expires_at: null,
    opened_at: ago(24 * 3 + 20),
    closed_at: null,
  });
  state.messages.push(
    {
      id: 'MSG-1',
      mash_id: 'M-tin-ben',
      sender_id: null,
      body: 'Kim mashed you two. Kim on Ben: Fixes things before you notice they were broken. Will drive two hours for a good pie. Kim on Tin: She turned up to my dad’s funeral with a lasagne and stayed to do the dishes.',
      is_vouch: true,
      created_at: ago(24 * 3 + 20),
    },
    {
      id: 'MSG-2',
      mash_id: 'M-tin-ben',
      sender_id: 'ben',
      body: 'Kim has been threatening to do this for about a year. Hello.',
      is_vouch: false,
      created_at: ago(24 * 3 + 18),
    },
    {
      id: 'MSG-3',
      mash_id: 'M-tin-ben',
      sender_id: 'tin',
      body: 'She has form. Hello back. Is the pie claim true?',
      is_vouch: false,
      created_at: ago(24 * 3 + 15),
    },
    {
      id: 'MSG-4',
      mash_id: 'M-tin-ben',
      sender_id: 'ben',
      body: 'Kaiaua. Worth it. I could prove it on Saturday if you are free.',
      is_vouch: false,
      created_at: ago(24 * 2),
    },
  );

  // Tin and Leo: Tin said yes, Leo passed. Declined, no reason given to anyone.
  state.mashes.push({
    id: 'M-tin-leo',
    catch_id: 'tin',
    candidate_id: 'leo',
    mashmaker_ids: ['kim'],
    batch_entry_id: 'E-kim-leo',
    catch_decision: 'meet',
    candidate_decision: 'pass',
    status: 'declined',
    created_at: ago(24 * 4),
    expires_at: null,
    opened_at: null,
    closed_at: ago(24 * 3),
  });

  // Holly's batch for Tin: ready. Sam and Nico said yes to being shown. Paul has not answered yet.
  state.batches.push({
    id: 'B-holly',
    mashmaker_id: 'holly',
    catch_id: 'tin',
    status: 'ready',
    machine_note:
      'Three of your four fit. Two have said yes so far, Paul has not answered. Jack is in Perth and Tin listed long distance as a dealbreaker.',
    created_at: ago(30),
    ready_at: ago(6),
    done_at: null,
  });
  state.entries.push(
    entry('E-holly-sam', 'B-holly', 'sam', {
      kept: true,
      position: 1,
      reason:
        'Holly vouched for Sam. Teacher, runner, reads. Tin asked for someone who has their life together and still laughs at themselves, and Holly says that is Sam.',
      consent: 'yes',
      consent_at: ago(12),
    }),
    entry('E-holly-nico', 'B-holly', 'nico', {
      kept: true,
      position: 2,
      reason:
        'Early mornings, same as Tin. Nico cooks for a living and Holly says he is the calmest person she knows.',
      consent: 'yes',
      consent_at: ago(6),
    }),
    entry('E-holly-paul', 'B-holly', 'paul', {
      kept: true,
      position: 3,
      reason: 'Paul runs the bike shop Holly goes to. Kind, practical, in the same suburb.',
      consent: 'pending',
    }),
    entry('E-holly-jack', 'B-holly', 'jack', {
      kept: false,
      dropped_reason: 'Jack is in Perth. Tin listed long distance as a dealbreaker.',
    }),
  );
  state.comments.push({
    id: 'C-1',
    batch_id: 'B-holly',
    entry_id: 'E-holly-sam',
    author_id: 'holly',
    text: 'Sam is the one I would pick. Do not tell him I said that.',
    created_at: ago(5),
  });

  // Mark's batch for Owen is still asking people. Tin is one of them and has not answered.
  state.batches.push({
    id: 'B-mark',
    mashmaker_id: 'mark',
    catch_id: 'owen',
    status: 'consenting',
    machine_note: 'Both fit. They have been asked. You will know when the batch is ready.',
    created_at: ago(3),
    ready_at: null,
    done_at: null,
  });
  state.entries.push(
    entry('E-mark-tin', 'B-mark', 'tin', {
      kept: true,
      position: 1,
      reason:
        'Mark knows Tin from the pub quiz. Says she is the sharpest person on the team and the first to buy the round.',
      consent: 'pending',
    }),
    entry('E-mark-mia', 'B-mark', 'mia', {
      kept: true,
      position: 2,
      reason:
        'Mia is a bit of a distance away, but Owen did not list that as a dealbreaker and Mark says they would get on.',
      consent: 'yes',
      consent_at: ago(1),
    }),
  );

  // Holly's record: Ria and Dev met, and Ria chose to tell Holly that much.
  state.batches.push({
    id: 'B-holly-ria',
    mashmaker_id: 'holly',
    catch_id: 'ria',
    status: 'done',
    machine_note: 'One of one. Dev said yes.',
    created_at: ago(24 * 20),
    ready_at: ago(24 * 20 + 1),
    done_at: ago(24 * 17),
  });
  state.entries.push(
    entry('E-holly-ria-dev', 'B-holly-ria', 'dev', {
      kept: true,
      position: 1,
      reason: 'Holly vouched for Dev. Pub quizzes, dogs, Auckland.',
      consent: 'yes',
      consent_at: ago(24 * 20),
      decision: 'meet',
      decided_at: ago(24 * 18),
      revealed_at: ago(24 * 18),
    }),
  );
  state.mashes.push({
    id: 'M-ria-dev',
    catch_id: 'ria',
    candidate_id: 'dev',
    mashmaker_ids: ['holly'],
    batch_entry_id: 'E-holly-ria-dev',
    catch_decision: 'meet',
    candidate_decision: 'meet',
    status: 'met',
    created_at: ago(24 * 18),
    expires_at: null,
    opened_at: ago(24 * 17),
    closed_at: null,
  });
  state.outcomes.push({
    id: 'O-1',
    mash_id: 'M-ria-dev',
    reported_by: 'ria',
    outcome: 'met_again',
    share: 'met',
    note: null,
    when_at: ago(24 * 9),
    created_at: ago(24 * 8),
  });

  // What the Machine may read about Ben, with his consent. Tin has already asked for the brief.
  state.linked = [
    {
      id: 'LP-1',
      user_id: 'ben',
      kind: 'linkedin',
      url: 'https://www.linkedin.com/in/ben-example',
      created_at: ago(24 * 30),
    },
    {
      id: 'LP-2',
      user_id: 'ben',
      kind: 'instagram',
      url: 'https://www.instagram.com/ben.builds',
      created_at: ago(24 * 30),
    },
    {
      id: 'LP-3',
      user_id: 'tin',
      kind: 'website',
      url: 'https://studio-example.co.nz',
      created_at: ago(24 * 30),
    },
  ];
  state.briefs = [
    {
      id: 'BR-1',
      mash_id: 'M-tin-ben',
      requester_id: 'tin',
      subject_id: 'ben',
      content: briefFor('ben'),
      generated_at: ago(24 * 2),
    },
  ];

  state.exclusions = [{ owner_id: 'tin', hash: 'hash-ex-2019', created_at: ago(24 * 29) }];

  state.notifications = [
    {
      id: 'N1',
      user_id: 'tin',
      kind: 'consent_request',
      body: 'Mark would like to show you to Owen. Okay?',
      data: { route: '/consent/B-mark' },
      read: false,
      created_at: ago(3),
    },
    {
      id: 'N2',
      user_id: 'tin',
      kind: 'batch_ready',
      body: 'Holly has a batch for you.',
      data: { route: '/batch/B-holly' },
      read: false,
      created_at: ago(6),
    },
    {
      id: 'N3',
      user_id: 'tin',
      kind: 'mash_mutual',
      body: 'Ben said yes. You can talk now.',
      data: { route: '/mash/M-tin-ben' },
      read: true,
      created_at: ago(24 * 3 + 20),
    },
    {
      id: 'N4',
      user_id: 'holly',
      kind: 'mashmaker_request',
      body: 'Priya asked you to be her Mashmaker.',
      data: { route: '/(mashmaker)/catches' },
      read: false,
      created_at: ago(6),
    },
    {
      id: 'N5',
      user_id: 'holly',
      kind: 'outcome',
      body: 'Ria and Dev met.',
      data: { route: '/(mashmaker)/record' },
      read: true,
      created_at: ago(24 * 8),
    },
    {
      id: 'N6',
      user_id: 'holly',
      kind: 'batch_ready',
      body: 'Your batch for Tin is ready. Sam and Nico said yes.',
      data: { route: '/batch/B-holly' },
      read: true,
      created_at: ago(6),
    },
  ];
}

const BRIEF_LIMITATION =
  'This checks consistency and public signals. It cannot tell you what someone is like.';

function briefFor(subjectId: string): BriefContent {
  const p = people[subjectId]!;
  const linked = state.linked.filter((l) => l.user_id === subjectId);
  if (!p.dd_consent) {
    return {
      summary: `${p.first_name} has not switched on checks, so the Machine only looked at what verification already covers. ${p.first_name} passed identity verification and their photos are checked current.`,
      linked: [],
      consistency: [
        { check: 'Identity verified', result: 'consistent', note: 'Passed liveness at signup.' },
        {
          check: 'Photos current',
          result: p.photos_current ? 'consistent' : 'unknown',
          note: p.photos_current ? 'Checked within the last few weeks.' : 'Not checked recently.',
        },
      ],
      sources: ['Mash verification record'],
      limitation: BRIEF_LIMITATION,
    };
  }
  return {
    summary: `${p.first_name} appears to be who they say they are. Name, city and line of work match across the profiles they linked, and the photos are consistent with the verified ones. Nothing public raised a concern.`,
    linked: linked.map((l) => ({
      kind: l.kind,
      url: l.url,
      what_it_shows:
        l.kind === 'linkedin'
          ? `Work history consistent with "${p.bio?.split('.')[0] ?? 'their profile'}". Based in ${p.city}.`
          : l.kind === 'instagram'
            ? 'Public posts going back several years. Same person as the verified photos.'
            : 'Public page in the same name.',
    })),
    consistency: [
      {
        check: 'Name matches linked profiles',
        result: 'consistent',
        note: 'Same first name and surname on both.',
      },
      { check: 'City matches', result: 'consistent', note: `${p.city} on both profiles.` },
      {
        check: 'Photos consistent with verified photos',
        result: 'consistent',
        note: 'Recent public photos match the verification set.',
      },
      {
        check: 'Public safety signals',
        result: 'consistent',
        note: 'Nothing found in public sources.',
      },
    ],
    sources: linked.map((l) => l.url).concat(['Mash verification record']),
    limitation: BRIEF_LIMITATION,
  };
}

seed();

// --- change bus (stands in for Supabase Realtime) ---------------------------

const listeners = new Set<() => void>();
function changed() {
  for (const l of listeners) l();
}
export function subscribeDemo(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let seq = 100;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

function me(): string {
  if (!state.me) throw new Error('demo: nobody signed in');
  return state.me;
}

function notify(
  userId: string,
  kind: Notification['kind'],
  body: string,
  data: Record<string, unknown> = {},
) {
  state.notifications.unshift({
    id: nextId('N'),
    user_id: userId,
    kind,
    body,
    data,
    read: false,
    created_at: now(),
  });
}

function isMashmakerOf(mashmakerId: string, catchId: string) {
  return state.links.some(
    (l) => l.catch_id === catchId && l.mashmaker_id === mashmakerId && l.status === 'accepted',
  );
}

function entitled(p: Profile) {
  if (p.is_plus) return true;
  return !!p.trial_ends_at && new Date(p.trial_ends_at).getTime() > Date.now();
}

/** The trial clock starts at the Catch's first batch when the switch says so. */
function startTrialIfDue(catchId: string) {
  const p = people[catchId];
  if (!p || p.trial_started_at || SETTINGS.trial_gate !== 'first_batch') return;
  const days = Number(SETTINGS.trial_days ?? '21');
  p.trial_started_at = now();
  p.trial_ends_at = new Date(Date.now() + days * 86400000).toISOString();
}

function hydrateMash(m: Mash): MashWithPeople {
  const msgs = state.messages
    .filter((x) => x.mash_id === m.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const c = pub(m.catch_id);
  const d = pub(m.candidate_id);
  return {
    ...m,
    catch: c,
    candidate: d,
    mashmakers: m.mashmaker_ids.map(pub),
    other: m.catch_id === state.me ? d : c,
    lastMessage: msgs[msgs.length - 1] ?? null,
  };
}

/** Catch sees only people who said yes to being shown. The Mashmaker sees the whole batch. */
function visibleEntries(b: Batch, viewer: string): BatchEntry[] {
  const all = state.entries.filter((e) => e.batch_id === b.id);
  if (viewer === b.mashmaker_id) return all;
  return all.filter((e) => e.kept && e.consent === 'yes');
}

function settleBatch(batchId: string) {
  const b = state.batches.find((x) => x.id === batchId);
  if (!b) return;
  const kept = state.entries.filter((e) => e.batch_id === b.id && e.kept);
  const pending = kept.filter((e) => e.consent === 'pending');
  const yes = kept.filter((e) => e.consent === 'yes');
  if (b.status === 'consenting' && pending.length === 0) {
    if (yes.length === 0) {
      b.status = 'done';
      b.done_at = now();
      notify(
        b.mashmaker_id,
        'system',
        `Nobody in your batch for ${first(b.catch_id)} said yes this time. Not a reflection on you.`,
        { route: `/batch/${b.id}` },
      );
      return;
    }
    b.status = 'ready';
    b.ready_at = now();
    startTrialIfDue(b.catch_id);
    notify(b.catch_id, 'batch_ready', `${first(b.mashmaker_id)} has a batch for you.`, {
      route: `/batch/${b.id}`,
    });
    notify(b.mashmaker_id, 'batch_ready', `Your batch for ${first(b.catch_id)} is ready.`, {
      route: `/batch/${b.id}`,
    });
  }
  if (
    b.status === 'ready' &&
    pending.length === 0 &&
    yes.every((e) => e.decision !== 'undecided')
  ) {
    b.status = 'done';
    b.done_at = now();
  }
}

// --- reads (mirror the hooks) ----------------------------------------------

export const demo = {
  enter(persona: Persona) {
    state.me = persona;
    changed();
  },
  exit() {
    state.me = null;
    changed();
  },
  persona(): Persona | null {
    return state.me;
  },
  profile(): Profile | null {
    return state.me ? people[state.me]! : null;
  },
  patchProfile(patch: Partial<Profile>): Profile {
    const p = people[me()]!;
    const wasMatching = p.open_to_matching;
    Object.assign(p, patch, { updated_at: now() });
    if (patch.open_to_matching && !wasMatching && SETTINGS.trial_gate === 'signup')
      startTrialIfDue(p.id);
    changed();
    return p;
  },
  settings(): Record<string, string> {
    return { ...SETTINGS };
  },

  // Catch
  myMashmakers(): MyMashmakerRow[] {
    const id = me();
    return state.links
      .filter((l) => l.catch_id === id && (l.status === 'accepted' || l.status === 'requested'))
      .map((l) => {
        const v = state.vouches.find((x) => x.mashmaker_id === l.mashmaker_id && x.catch_id === id);
        return {
          link_id: l.id,
          mashmaker_id: l.mashmaker_id,
          first_name: first(l.mashmaker_id),
          photo_url: people[l.mashmaker_id]?.photo_url ?? null,
          status: l.status,
          requested_by: l.requested_by,
          prompt: v?.prompt ?? null,
          text: v?.text ?? null,
          how_known: v?.how_known ?? null,
          created_at: l.created_at,
        };
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  criteria(id: string): Criteria | null {
    return state.criteria.get(id) ?? null;
  },
  batches() {
    const id = me();
    return state.batches
      .filter(
        (b) =>
          b.mashmaker_id === id ||
          (b.catch_id === id && (b.status === 'ready' || b.status === 'done')),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((b) => {
        const kept = state.entries.filter((e) => e.batch_id === b.id && e.kept);
        return {
          ...b,
          mashmaker: pub(b.mashmaker_id),
          catch: pub(b.catch_id),
          kept: kept.length,
          consented: kept.filter((e) => e.consent === 'yes').length,
        };
      });
  },
  batch(id: string): BatchWithPeople | null {
    const b = state.batches.find((x) => x.id === id);
    if (!b) return null;
    const viewer = me();
    if (viewer !== b.mashmaker_id && viewer !== b.catch_id) return null;
    if (viewer === b.catch_id && b.status !== 'ready' && b.status !== 'done') return null;
    return {
      ...b,
      mashmaker: pub(b.mashmaker_id),
      catch: pub(b.catch_id),
      entries: visibleEntries(b, viewer)
        .map((e) => ({ ...e, candidate: pub(e.candidate_id) }))
        .sort((a, b2) => (a.position ?? 99) - (b2.position ?? 99)),
      comments: state.comments
        .filter((c) => c.batch_id === id)
        .sort((a, b2) => a.created_at.localeCompare(b2.created_at)),
    };
  },
  consentRequests(): ConsentRequest[] {
    const id = me();
    return state.entries
      .filter((e) => e.candidate_id === id && e.kept && e.consent === 'pending')
      .map((e) => {
        const b = state.batches.find((x) => x.id === e.batch_id)!;
        return {
          entry_id: e.id,
          batch_id: b.id,
          mashmaker: pub(b.mashmaker_id),
          catch_first_name: first(b.catch_id),
          created_at: b.created_at,
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  mashes(): MashWithPeople[] {
    const id = me();
    return state.mashes
      .filter((m) => m.catch_id === id || m.candidate_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(hydrateMash);
  },
  mash(id: string): MashWithPeople | null {
    const m = state.mashes.find((x) => x.id === id);
    if (!m) return null;
    const viewer = me();
    if (m.catch_id !== viewer && m.candidate_id !== viewer) return null;
    return hydrateMash(m);
  },
  messages(mashId: string): Message[] {
    return state.messages
      .filter((m) => m.mash_id === mashId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  outcomes(mashId: string): Outcome[] {
    return state.outcomes
      .filter((o) => o.mash_id === mashId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  /** Only ever the requester's own brief. Never the subject's, never a Mashmaker's. */
  brief(mashId: string): Brief | null {
    return state.briefs.find((b) => b.mash_id === mashId && b.requester_id === state.me) ?? null;
  },
  vouchesFor(catchId: string) {
    return state.vouches
      .filter((v) => v.catch_id === catchId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((v) => ({
        id: v.id,
        mashmaker_id: v.mashmaker_id,
        prompt: v.prompt,
        text: v.text,
        how_known: v.how_known,
        created_at: v.created_at,
        mashmaker: {
          first_name: first(v.mashmaker_id),
          photo_url: people[v.mashmaker_id]?.photo_url ?? null,
        },
      }));
  },

  // Mashmaker
  myCatches(): MyCatchRow[] {
    const id = me();
    return state.links
      .filter((l) => l.mashmaker_id === id && (l.status === 'accepted' || l.status === 'requested'))
      .map((l) => {
        const p = people[l.catch_id]!;
        const mine = state.batches
          .filter((b) => b.catch_id === p.id && b.mashmaker_id === id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return {
          link_id: l.id,
          catch_id: p.id,
          first_name: p.first_name,
          photo_url: p.photo_url,
          city: p.city,
          status: l.status,
          requested_by: l.requested_by,
          has_vouch: state.vouches.some((v) => v.mashmaker_id === id && v.catch_id === p.id),
          open_batch: state.batches.some((b) => b.catch_id === p.id && b.status !== 'done'),
          batches: mine.length,
          last_batch_at: mine[0]?.created_at ?? null,
        };
      })
      .sort((a, b) =>
        a.status === b.status
          ? a.first_name.localeCompare(b.first_name)
          : a.status === 'requested'
            ? -1
            : 1,
      );
  },
  /** Private record. Status and outcome only at the level the Catch chose. */
  record(): RecordRow[] {
    const id = me();
    return state.mashes
      .filter((m) => m.mashmaker_ids.includes(id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((m) => {
        const shared = state.outcomes
          .filter((o) => o.mash_id === m.id && o.share !== 'nothing')
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        const minimal = people[m.catch_id]?.mashmaker_visibility !== 'updates';
        let status: MashStatus = m.status;
        if (minimal && status === 'met' && !shared) status = 'mutual';
        return {
          mash_id: m.id,
          catch_first_name: first(m.catch_id),
          candidate_first_name: first(m.candidate_id),
          status,
          shared_outcome: shared ? (shared.share === 'details' ? shared.outcome : 'met') : null,
          created_at: m.created_at,
        };
      });
  },
  /** My contacts who are Catches, fit the Catch's declared preferences, and are not already in a mash with them. */
  nominatable(catchId: string): NominatableRow[] {
    const id = me();
    const c = people[catchId];
    if (!c || !isMashmakerOf(id, catchId)) return [];
    return Object.values(people)
      .filter(
        (p) =>
          p.id !== catchId && p.id !== id && p.role === 'catch' && p.open_to_matching && !p.paused,
      )
      .filter((p) => connected(id, p.id))
      .filter(
        (p) => !blocked(catchId, p.id) && !excluded(catchId, p.id) && !excluded(p.id, catchId),
      )
      .filter(
        (p) =>
          (c.seeking.length === 0 || (p.gender && c.seeking.includes(p.gender))) &&
          (p.seeking.length === 0 || (c.gender && p.seeking.includes(c.gender))),
      )
      .filter(
        (p) =>
          !state.mashes.some((m) => {
            const pair =
              (m.catch_id === catchId && m.candidate_id === p.id) ||
              (m.catch_id === p.id && m.candidate_id === catchId);
            if (!pair) return false;
            if (m.status === 'pending' || m.status === 'mutual' || m.status === 'met') return true;
            const months = Number(SETTINGS.renomination_block_months ?? '12');
            return (
              new Date(m.closed_at ?? m.created_at).getTime() > Date.now() - months * 30 * 86400000
            );
          }),
      )
      .filter(
        (p) =>
          !state.entries.some(
            (e) =>
              e.candidate_id === p.id &&
              e.kept &&
              state.batches.some(
                (b) => b.id === e.batch_id && b.catch_id === catchId && b.status !== 'done',
              ),
          ),
      )
      .map((p) => ({
        candidate_id: p.id,
        first_name: p.first_name,
        photo_url: p.photo_url,
        city: p.city,
        age: ageOf(p),
      }))
      .sort((a, b) => a.first_name.localeCompare(b.first_name));
  },
  prompt(): VouchPrompt {
    return { id: 2, text: PROMPTS[1]!, active: true };
  },
  connections(): (PublicProfile & { role: Profile['role'] })[] {
    const id = me();
    return Object.values(people)
      .filter((p) => p.id !== id && connected(id, p.id) && !blocked(id, p.id))
      .map((p) => ({ ...pub(p.id), role: p.role }))
      .sort((a, b) => a.first_name.localeCompare(b.first_name));
  },
  publicProfile(id: string): PublicProfile | null {
    return people[id] ? pub(id) : null;
  },
  linked(userId: string): LinkedProfile[] {
    return state.linked.filter((l) => l.user_id === userId);
  },
  exclusions(): ExcludedHash[] {
    return state.exclusions.filter((e) => e.owner_id === me());
  },
  notifications(): Notification[] {
    const id = me();
    return state.notifications
      .filter((n) => n.user_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  contacts(): LocalContact[] {
    const names = [
      'Alex Cho',
      'Ben Harper',
      'Chloe Reid',
      'Holly Bennett',
      'Jamie Ngata',
      'Jess Moore',
      'Kim Walker',
      'Mark Tane',
      'Mel Thompson',
      'Nico Ferreira',
      'Rangi Hohepa',
      'Sam Patel',
      'Zoe Clarke',
    ];
    return names.map((name, i) => ({
      id: `c${i}`,
      name,
      hashes: [`hash-${name.split(' ')[0]!.toLowerCase()}`],
      image: null,
    }));
  },
};

// --- writes (mirror api.ts) -------------------------------------------------

const REPLIES = [
  'Ha. Yes.',
  'Saturday works. Where?',
  'That is a very good question and I will need a coffee to answer it.',
  'Kim is going to be unbearable about this.',
  'Okay, now I am curious.',
];

export const demoApi = {
  async matchContacts(hashes: string[], _myPhoneHash?: string): Promise<MatchContactsResult> {
    await wait(900);
    const id = me();
    const matched = Object.values(people)
      .filter((p) => p.id !== id && p.phone_hash && hashes.includes(p.phone_hash))
      .map((p) => {
        connect(id, p.id);
        return { ...pub(p.id), role: p.role, hash: p.phone_hash };
      });
    changed();
    return { matched, pendingInvites: [] };
  },

  async buildBatch(catchId: string, candidateIds: string[]): Promise<BuildBatchResult> {
    await wait(1800);
    const mm = me();
    if (!isMashmakerOf(mm, catchId))
      throw new Error(`${first(catchId)} has not accepted you as a Mashmaker yet.`);
    if (state.batches.some((b) => b.catch_id === catchId && b.status !== 'done')) {
      throw new Error(
        `${first(catchId)} already has a batch open. The next one can go once that resolves.`,
      );
    }
    const c = people[catchId]!;
    const crit = state.criteria.get(catchId);
    const max = Number(SETTINGS.batch_max ?? '5');
    const kept: { candidate_id: string; position: number; reason: string }[] = [];
    const dropped: { candidate_id: string; first_name: string; reason: string }[] = [];
    for (const id of candidateIds) {
      const p = people[id];
      if (!p) continue;
      const age = ageOf(p) ?? 0;
      if (p.role !== 'catch' || !p.open_to_matching) {
        dropped.push({
          candidate_id: id,
          first_name: p.first_name,
          reason: `${p.first_name} has not switched matching on.`,
        });
      } else if (p.city !== c.city && crit?.dealbreakers.includes('Long distance')) {
        dropped.push({
          candidate_id: id,
          first_name: p.first_name,
          reason: `${p.first_name} is in ${p.city}. ${c.first_name} listed long distance as a dealbreaker.`,
        });
      } else if (crit && (age < crit.age_min || age > crit.age_max)) {
        dropped.push({
          candidate_id: id,
          first_name: p.first_name,
          reason: `${p.first_name} is outside the range ${c.first_name} asked for.`,
        });
      } else if (kept.length >= max) {
        dropped.push({
          candidate_id: id,
          first_name: p.first_name,
          reason: `${max} is the most for one batch. Keep ${p.first_name} for the next one.`,
        });
      } else {
        const v = state.vouches.find((x) => x.mashmaker_id === mm && x.catch_id === id);
        kept.push({
          candidate_id: id,
          position: kept.length + 1,
          reason: `${first(mm)} picked ${p.first_name}.${v ? ` ${first(mm)} on ${p.first_name}: ${v.text}` : ''} Same city, and both after ${crit?.intent === 'relationship' ? 'something real' : 'seeing where it goes'}.`,
        });
      }
    }
    const batchId = nextId('B');
    const note = kept.length
      ? `${kept.length} of your ${candidateIds.length} fit. They have been asked whether they are happy to be shown. You will know when the batch is ready.`
      : 'None of these fit this time. Not a reflection on you.';
    state.batches.unshift({
      id: batchId,
      mashmaker_id: mm,
      catch_id: catchId,
      status: kept.length ? 'consenting' : 'done',
      machine_note: note,
      created_at: now(),
      ready_at: null,
      done_at: kept.length ? null : now(),
    });
    for (const k of kept) {
      const e = entry(nextId('E'), batchId, k.candidate_id, {
        kept: true,
        position: k.position,
        reason: k.reason,
      });
      state.entries.push(e);
      notify(
        k.candidate_id,
        'consent_request',
        `${first(mm)} would like to show you to ${c.first_name}. Okay?`,
        { route: `/consent/${batchId}` },
      );
    }
    for (const d of dropped)
      state.entries.push(
        entry(nextId('E'), batchId, d.candidate_id, { kept: false, dropped_reason: d.reason }),
      );
    changed();
    // In the demo the nominees answer in a little while, so the story moves.
    setTimeout(() => {
      for (const e of state.entries.filter(
        (x) => x.batch_id === batchId && x.kept && x.consent === 'pending',
      )) {
        e.consent = 'yes';
        e.consent_at = now();
      }
      settleBatch(batchId);
      changed();
    }, 4000);
    return { batchId, kept: kept.length, dropped, note };
  },

  async answerConsent(entryId: string, consent: 'yes' | 'no') {
    await wait(250);
    const e = state.entries.find((x) => x.id === entryId);
    if (!e) throw new Error('Not found');
    if (e.consent === 'pending') {
      e.consent = consent;
      e.consent_at = now();
      settleBatch(e.batch_id);
      const b = state.batches.find((x) => x.id === e.batch_id)!;
      if (consent === 'yes' && b.status === 'ready') {
        notify(b.catch_id, 'batch_ready', `One more in ${first(b.mashmaker_id)}’s batch for you.`, {
          route: `/batch/${b.id}`,
        });
      }
      changed();
    }
    return { ok: true as const, consent: e.consent === 'no' ? ('no' as const) : ('yes' as const) };
  },

  async decideEntry(entryId: string, decision: Exclude<EntryDecision, 'undecided'>) {
    await wait(250);
    const e = state.entries.find((x) => x.id === entryId);
    if (!e) throw new Error('Not found');
    if (!e.kept || e.consent !== 'yes') throw new Error('That person is not in the batch');
    e.decision = decision;
    e.decided_at = now();
    const b = state.batches.find((x) => x.id === e.batch_id)!;
    let mashId: string | undefined;
    let status: MashStatus | undefined;
    if (decision === 'meet') {
      const existing = state.mashes.find(
        (m) => m.catch_id === b.catch_id && m.candidate_id === e.candidate_id,
      );
      if (existing) {
        if (!existing.mashmaker_ids.includes(b.mashmaker_id))
          existing.mashmaker_ids.push(b.mashmaker_id);
        existing.catch_decision = 'meet';
        mashId = existing.id;
        status = existing.status;
      } else {
        mashId = nextId('M');
        status = 'pending';
        state.mashes.unshift({
          id: mashId,
          catch_id: b.catch_id,
          candidate_id: e.candidate_id,
          mashmaker_ids: [b.mashmaker_id],
          batch_entry_id: entryId,
          catch_decision: 'meet',
          candidate_decision: 'undecided',
          status,
          created_at: now(),
          expires_at: new Date(
            Date.now() + Number(SETTINGS.intro_expiry_days ?? '7') * 86400000,
          ).toISOString(),
          opened_at: null,
          closed_at: null,
        });
        notify(
          e.candidate_id,
          'mash_mutual',
          `${first(b.mashmaker_id)} mashed you with ${first(b.catch_id)}. Want to meet?`,
          { route: `/mash/${mashId}` },
        );
        // In the demo the other person answers in a little while, so the story moves.
        const id = mashId;
        setTimeout(() => {
          const m = state.mashes.find((x) => x.id === id);
          if (!m || m.status !== 'pending') return;
          openConversation(m);
          changed();
        }, 2500);
      }
    }
    settleBatch(b.id);
    changed();
    return { ok: true as const, mashId, status };
  },

  async decideMash(mashId: string, decision: 'meet' | 'pass') {
    await wait(250);
    const m = state.mashes.find((x) => x.id === mashId);
    if (!m) throw new Error('Not found');
    if (m.status !== 'pending') return { mashId, status: m.status };
    if (decision === 'pass') {
      m.candidate_decision = 'pass';
      m.status = 'declined';
      m.closed_at = now();
      // The Catch learns it is a no. Nobody learns why.
      notify(m.catch_id, 'system', 'This one didn’t go ahead.', { route: '/(catch)/mashes' });
    } else {
      openConversation(m);
    }
    changed();
    return { mashId, status: m.status };
  },

  async requestBrief(mashId: string) {
    await wait(2200);
    const id = me();
    const m = state.mashes.find((x) => x.id === mashId);
    if (!m || (m.catch_id !== id && m.candidate_id !== id)) throw new Error('Not found');
    if (m.status !== 'mutual' && m.status !== 'met')
      throw new Error('Checks are available once you have both said yes.');
    if (SETTINGS.dd_requires_plus === 'true' && !entitled(people[id]!))
      throw new Error('The Machine’s checks are part of Mash Plus.');
    const subject = m.catch_id === id ? m.candidate_id : m.catch_id;
    const existing = state.briefs.find((b) => b.mash_id === mashId && b.requester_id === id);
    const brief: Brief = existing ?? {
      id: nextId('BR'),
      mash_id: mashId,
      requester_id: id,
      subject_id: subject,
      content: briefFor(subject),
      generated_at: now(),
    };
    if (!existing) state.briefs.push(brief);
    changed();
    return { brief: { id: brief.id, content: brief.content, generated_at: brief.generated_at } };
  },

  async saveCriteria(
    catchId: string,
    c: {
      age_min: number;
      age_max: number;
      radius_km: number;
      dealbreakers: string[];
      intent: IntentKind;
      open_text: string | null;
    },
  ) {
    await wait(200);
    const row: Criteria = { catch_id: catchId, ...c, updated_at: now() };
    state.criteria.set(catchId, row);
    changed();
    return row;
  },

  async uploadAvatar(_userId: string, localUri: string) {
    await wait(300);
    return localUri;
  },

  async askMashmaker(catchId: string, mashmakerId: string) {
    await wait(300);
    upsertLink(catchId, mashmakerId, catchId);
    notify(mashmakerId, 'mashmaker_request', `${first(catchId)} asked you to be their Mashmaker.`, {
      route: '/(mashmaker)/catches',
    });
    changed();
    // In the demo the friend says yes in a little while.
    setTimeout(() => {
      const l = state.links.find((x) => x.catch_id === catchId && x.mashmaker_id === mashmakerId);
      if (!l || l.status !== 'requested') return;
      l.status = 'accepted';
      l.answered_at = now();
      notify(
        catchId,
        'mashmaker_accepted',
        `${first(mashmakerId)} said yes. They are your Mashmaker now.`,
        { route: '/(catch)/mashmakers' },
      );
      changed();
    }, 4000);
  },

  async offerToMashmake(mashmakerId: string, catchId: string) {
    await wait(300);
    upsertLink(catchId, mashmakerId, mashmakerId);
    notify(catchId, 'mashmaker_request', `${first(mashmakerId)} offered to be your Mashmaker.`, {
      route: '/(catch)/mashmakers',
    });
    changed();
    setTimeout(() => {
      const l = state.links.find((x) => x.catch_id === catchId && x.mashmaker_id === mashmakerId);
      if (!l || l.status !== 'requested') return;
      l.status = 'accepted';
      l.answered_at = now();
      notify(
        mashmakerId,
        'mashmaker_accepted',
        `${first(catchId)} said yes. You are their Mashmaker now.`,
        { route: '/(mashmaker)/catches' },
      );
      changed();
    }, 4000);
  },

  async answerMashmakerRequest(linkId: string, accept: boolean) {
    await wait(250);
    const l = state.links.find((x) => x.id === linkId);
    if (!l) throw new Error('Not found');
    l.status = accept ? 'accepted' : 'declined';
    l.answered_at = now();
    const other = l.requested_by === l.catch_id ? l.catch_id : l.mashmaker_id;
    if (accept) {
      const iAmMashmaker = me() === l.mashmaker_id;
      notify(
        other,
        'mashmaker_accepted',
        iAmMashmaker
          ? `${first(l.mashmaker_id)} said yes. They are your Mashmaker now.`
          : `${first(l.catch_id)} said yes. You are their Mashmaker now.`,
        { route: iAmMashmaker ? '/(catch)/mashmakers' : '/(mashmaker)/catches' },
      );
    }
    changed();
  },

  async endMashmakerLink(linkId: string) {
    await wait(250);
    const l = state.links.find((x) => x.id === linkId);
    if (!l) throw new Error('Not found');
    l.status = 'ended';
    l.answered_at = now();
    changed();
  },

  async writeVouch(args: {
    mashmakerId: string;
    catchId: string;
    promptId: number | null;
    prompt: string;
    text: string;
    howKnown?: string | null;
  }) {
    await wait(300);
    const existing = state.vouches.find(
      (v) => v.mashmaker_id === args.mashmakerId && v.catch_id === args.catchId,
    );
    const row: VouchRow = {
      id: existing?.id ?? nextId('V'),
      mashmaker_id: args.mashmakerId,
      catch_id: args.catchId,
      prompt_id: args.promptId,
      prompt: args.prompt,
      text: args.text.trim(),
      how_known: args.howKnown ?? null,
      created_at: existing?.created_at ?? now(),
    };
    if (existing) Object.assign(existing, row);
    else state.vouches.unshift(row);
    if (!existing)
      notify(args.catchId, 'vouch_received', `${first(args.mashmakerId)} wrote a line about you.`, {
        route: '/(catch)/mashmakers',
      });
    changed();
  },

  async removeVouch(mashmakerId: string, catchId: string) {
    await wait(200);
    state.vouches = state.vouches.filter(
      (v) => !(v.mashmaker_id === mashmakerId && v.catch_id === catchId),
    );
    changed();
  },

  async inviteByHash(args: {
    inviterId: string;
    inviterFirstName: string;
    inviteeHash: string;
    inviteeName: string;
    message: string;
  }) {
    await wait(400);
    const code = nextId('inv');
    state.invites.unshift({
      id: nextId('I'),
      inviter_id: args.inviterId,
      invitee_hash: args.inviteeHash,
      invitee_user_id: null,
      invite_code: code,
      message: args.message,
      status: 'pending',
      created_at: now(),
      accepted_at: null,
    });
    changed();
    return code;
  },

  async commentOnBatch(args: {
    batchId: string;
    entryId: string | null;
    authorId: string;
    text: string;
  }) {
    await wait(200);
    state.comments.push({
      id: nextId('C'),
      batch_id: args.batchId,
      entry_id: args.entryId,
      author_id: args.authorId,
      text: args.text.trim(),
      created_at: now(),
    });
    const b = state.batches.find((x) => x.id === args.batchId);
    if (b) {
      const other = args.authorId === b.catch_id ? b.mashmaker_id : b.catch_id;
      notify(other, 'comment', `${first(args.authorId)}: ${args.text.trim()}`, {
        route: `/batch/${b.id}`,
      });
    }
    changed();
  },

  async markRevealed(entryId: string) {
    const e = state.entries.find((x) => x.id === entryId);
    if (e && !e.revealed_at) {
      e.revealed_at = now();
      changed();
    }
  },

  async overrideDrop(entryId: string) {
    await wait(200);
    const e = state.entries.find((x) => x.id === entryId);
    if (!e) throw new Error('Not found');
    const b = state.batches.find((x) => x.id === e.batch_id)!;
    e.kept = true;
    e.mashmaker_overrode = true;
    e.position = 99;
    e.consent = 'pending';
    if (b.status === 'ready') b.status = 'consenting';
    notify(
      e.candidate_id,
      'consent_request',
      `${first(b.mashmaker_id)} would like to show you to ${first(b.catch_id)}. Okay?`,
      { route: `/consent/${b.id}` },
    );
    changed();
    setTimeout(() => {
      const x = state.entries.find((y) => y.id === entryId);
      if (!x || x.consent !== 'pending') return;
      x.consent = 'yes';
      x.consent_at = now();
      settleBatch(b.id);
      changed();
    }, 4000);
  },

  async withdrawNomination(entryId: string) {
    await wait(200);
    const e = state.entries.find((x) => x.id === entryId);
    if (!e) throw new Error('Not found');
    e.kept = false;
    e.dropped_reason = 'Withdrawn by the Mashmaker.';
    for (const m of state.mashes) {
      if (m.batch_entry_id === entryId && m.status === 'pending') {
        m.status = 'closed';
        m.closed_at = now();
      }
    }
    settleBatch(e.batch_id);
    changed();
  },

  async sendMessage(mashId: string, senderId: string, body: string) {
    state.messages.push({
      id: nextId('MSG'),
      mash_id: mashId,
      sender_id: senderId,
      body: body.trim(),
      is_vouch: false,
      created_at: now(),
    });
    changed();
    const m = state.mashes.find((x) => x.id === mashId);
    if (!m) return;
    const other = m.catch_id === senderId ? m.candidate_id : m.catch_id;
    const reply =
      REPLIES[
        state.messages.filter((x) => x.mash_id === mashId && x.sender_id === other).length %
          REPLIES.length
      ]!;
    setTimeout(() => {
      state.messages.push({
        id: nextId('MSG'),
        mash_id: mashId,
        sender_id: other,
        body: reply,
        is_vouch: false,
        created_at: now(),
      });
      changed();
    }, 1800);
  },

  async reportOutcome(args: {
    mashId: string;
    reportedBy: string;
    outcome: OutcomeKind;
    share: ShareLevel;
    note?: string;
    whenAt?: string;
  }) {
    await wait(250);
    state.outcomes.unshift({
      id: nextId('O'),
      mash_id: args.mashId,
      reported_by: args.reportedBy,
      outcome: args.outcome,
      share: args.share,
      note: args.note ?? null,
      when_at: args.whenAt ?? null,
      created_at: now(),
    });
    const m = state.mashes.find((x) => x.id === args.mashId);
    if (m) {
      const status = statusForOutcome(args.outcome);
      if (status) m.status = status;
      if (status === 'closed') {
        m.closed_at = now();
        state.briefs = state.briefs.filter((b) => b.mash_id !== m.id);
      }
      // The Mashmakers learn only what the Catch chose to tell them.
      const line = outcomeLineForMashmaker(
        args.share,
        args.outcome,
        first(m.catch_id),
        first(m.candidate_id),
      );
      if (line)
        for (const mm of m.mashmaker_ids)
          notify(mm, 'outcome', line, { route: '/(mashmaker)/record' });
    }
    changed();
  },

  async closeMash(mashId: string) {
    await wait(200);
    const m = state.mashes.find((x) => x.id === mashId);
    if (!m) throw new Error('Not found');
    m.status = 'closed';
    m.closed_at = now();
    // Due diligence is not kept beyond the open intro.
    state.briefs = state.briefs.filter((b) => b.mash_id !== mashId);
    changed();
  },

  async blockUser(blockerId: string, blockedId: string) {
    await wait(200);
    state.blocks.add(`${blockerId}|${blockedId}`);
    for (const m of state.mashes) {
      if (
        (m.catch_id === blockerId && m.candidate_id === blockedId) ||
        (m.catch_id === blockedId && m.candidate_id === blockerId)
      ) {
        if (m.status !== 'closed' && m.status !== 'declined') {
          m.status = 'closed';
          m.closed_at = now();
        }
        state.briefs = state.briefs.filter((b) => b.mash_id !== m.id);
      }
    }
    changed();
  },

  async reportUser(args: {
    reporterId: string;
    reportedId: string;
    reason: string;
    details?: string;
    share: ShareLevel;
  }) {
    await wait(300);
    state.reports.unshift({
      id: nextId('R'),
      reporter_id: args.reporterId,
      reported_id: args.reportedId,
      reason: args.reason,
      details: args.details ?? null,
      share: args.share,
      status: 'open',
      created_at: now(),
      reviewed_at: null,
    });
    changed();
  },

  async addExclusion(ownerId: string, hash: string) {
    await wait(150);
    if (!state.exclusions.some((e) => e.owner_id === ownerId && e.hash === hash))
      state.exclusions.push({ owner_id: ownerId, hash, created_at: now() });
    changed();
  },

  async removeExclusion(ownerId: string, hash: string) {
    await wait(150);
    state.exclusions = state.exclusions.filter((e) => !(e.owner_id === ownerId && e.hash === hash));
    changed();
  },

  async addLinkedProfile(userId: string, kind: LinkedKind, url: string) {
    await wait(200);
    if (!state.linked.some((l) => l.user_id === userId && l.url === url.trim())) {
      state.linked.push({
        id: nextId('LP'),
        user_id: userId,
        kind,
        url: url.trim(),
        created_at: now(),
      });
    }
    changed();
  },

  async removeLinkedProfile(id: string) {
    await wait(150);
    state.linked = state.linked.filter((l) => l.id !== id);
    changed();
  },

  async markNotificationsRead(ids: string[]) {
    for (const n of state.notifications) if (ids.includes(n.id)) n.read = true;
    changed();
  },
};

function upsertLink(catchId: string, mashmakerId: string, requestedBy: string) {
  const existing = state.links.find(
    (x) => x.catch_id === catchId && x.mashmaker_id === mashmakerId,
  );
  if (existing) {
    if (existing.status === 'accepted') return;
    existing.status = 'requested';
    existing.requested_by = requestedBy;
    existing.created_at = now();
    existing.answered_at = null;
    return;
  }
  state.links.push({
    id: nextId('L'),
    catch_id: catchId,
    mashmaker_id: mashmakerId,
    status: 'requested',
    requested_by: requestedBy,
    created_at: now(),
    answered_at: null,
  });
}

/** Mutual yes. The conversation opens with the Mashmaker's words, so both know who mashed them. */
function openConversation(m: Mash) {
  m.candidate_decision = 'meet';
  m.status = 'mutual';
  m.opened_at = now();
  const mm = m.mashmaker_ids[0]!;
  const aboutCandidate = state.vouches.find(
    (v) => v.mashmaker_id === mm && v.catch_id === m.candidate_id,
  );
  const aboutCatch = state.vouches.find((v) => v.mashmaker_id === mm && v.catch_id === m.catch_id);
  const parts = [`${first(mm)} mashed you two.`];
  if (aboutCandidate)
    parts.push(`${first(mm)} on ${first(m.candidate_id)}: ${aboutCandidate.text}`);
  if (aboutCatch) parts.push(`${first(mm)} on ${first(m.catch_id)}: ${aboutCatch.text}`);
  state.messages.push({
    id: nextId('MSG'),
    mash_id: m.id,
    sender_id: null,
    body: parts.join(' '),
    is_vouch: true,
    created_at: now(),
  });
  notify(m.catch_id, 'mash_mutual', `${first(m.candidate_id)} said yes. You can talk now.`, {
    route: `/mash/${m.id}`,
  });
  notify(m.candidate_id, 'mash_mutual', `${first(m.catch_id)} said yes. You can talk now.`, {
    route: `/mash/${m.id}`,
  });
  for (const id of m.mashmaker_ids) {
    notify(id, 'outcome', `${first(m.catch_id)} and ${first(m.candidate_id)} both said yes.`, {
      route: '/(mashmaker)/record',
    });
  }
}

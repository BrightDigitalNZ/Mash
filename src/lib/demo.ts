// Demo mode. Set EXPO_PUBLIC_DEMO=1 and the app runs against this in-memory story
// instead of Supabase: no backend, no sign-in, no native modules. Built so the app can
// be walked through in a browser. Every hook and every write in api.ts branches here.
//
// The story: Tin (single, Auckland) has a circle of ten. Holly, her friend, has just
// sent the matchmaker a lineup. Kim's earlier lineup led to Ben, and they are talking.

import { Asset } from 'expo-asset';

import type { IntroWithPeople, LineupWithPeople } from '@/hooks/useData';
import type { LocalContact } from '@/lib/contacts';
import type {
  Brief,
  BriefContent,
  CircleRow,
  Criteria,
  EntryDecision,
  IntentKind,
  Introduction,
  IntroStatus,
  LinkedKind,
  LinkedProfile,
  Lineup,
  LineupComment,
  LineupEntry,
  Message,
  MySingleRow,
  NominatableRow,
  Notification,
  OutcomeKind,
  Profile,
  PublicProfile,
  RecordRow,
  VouchPrompt,
} from '@/types/database';

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export type Persona = 'tin' | 'holly';

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

function person(
  id: string,
  first: string,
  role: Profile['role'],
  age: number,
  city: string,
  bio: string | null = null,
): Profile {
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
    phone_hash: `hash-${id}`,
    is_plus: id === 'tin',
    plus_until: id === 'tin' ? ago(-24 * 300) : null,
    paused: false,
    onboarding_complete: true,
    verified_photo: id === 'tin' || id === 'ben',
    verified_social: id === 'ben',
    brief_consent: id === 'ben' || id === 'tin',
    reverse_image_consent: false,
    created_at: ago(24 * 40),
    updated_at: ago(2),
  };
}

const people: Record<string, Profile> = Object.fromEntries(
  [
    person(
      'tin',
      'Tin',
      'single',
      38,
      'Auckland',
      'Runs a small design studio. Swims at Takapuna most mornings, rain or not.',
    ),
    person('holly', 'Holly', 'voucher', 36, 'Auckland'),
    person('kim', 'Kim', 'voucher', 39, 'Auckland'),
    person(
      'ben',
      'Ben',
      'single',
      41,
      'Auckland',
      'Structural engineer. Two kids every second week. Cooks properly, badly at karaoke.',
    ),
    person(
      'sam',
      'Sam',
      'single',
      37,
      'Auckland',
      'Teaches year 9 science. Trail runner. Reads more than he lets on.',
    ),
    person(
      'mia',
      'Mia',
      'single',
      35,
      'Wellington',
      'Policy analyst, back in Wellington after six years in London.',
    ),
    person(
      'nico',
      'Nico',
      'single',
      40,
      'Auckland',
      'Chef turned sourdough supplier. Early nights, early mornings.',
    ),
    person(
      'ria',
      'Ria',
      'single',
      42,
      'Auckland',
      'Physio. Has a dog called Barry who comes to everything.',
    ),
    person(
      'dev',
      'Dev',
      'single',
      39,
      'Auckland',
      'Product manager, lapsed drummer, very good at pub quizzes.',
    ),
    person(
      'leo',
      'Leo',
      'single',
      45,
      'Auckland',
      'Builder. Restoring a 1970s bach up north on weekends.',
    ),
    person('jack', 'Jack', 'single', 44, 'Perth'),
    person('owen', 'Owen', 'single', 38, 'Auckland'),
    person('paul', 'Paul', 'single', 43, 'Auckland'),
    person('priya', 'Priya', 'single', 36, 'Auckland', 'Vet nurse. Learning to sail, slowly.'),
    person('jess', 'Jess', 'voucher', 37, 'Auckland'),
    person('mark', 'Mark', 'voucher', 40, 'Auckland'),
    person('anna', 'Anna', 'voucher', 38, 'Auckland'),
    person('tom', 'Tom', 'voucher', 41, 'Auckland'),
    person('sophie', 'Sophie', 'voucher', 36, 'Auckland'),
    person('dan', 'Dan', 'voucher', 39, 'Auckland'),
    person('lucy', 'Lucy', 'voucher', 35, 'Auckland'),
    person('matt', 'Matt', 'voucher', 42, 'Auckland'),
  ].map((p) => [p.id, p]),
);

function ageOf(p: Profile): number | null {
  if (!p.date_of_birth) return null;
  const d = new Date(p.date_of_birth);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
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
    verified_photo: p.verified_photo,
    verified_social: p.verified_social,
    age: ageOf(p),
  };
}

// --- state ------------------------------------------------------------------

interface VouchRow {
  id: string;
  voucher_id: string;
  single_id: string;
  prompt: string;
  text: string;
  how_known: string | null;
  created_at: string;
}

const state = {
  me: null as Persona | null,
  criteria: new Map<string, Criteria>([
    [
      'tin',
      {
        single_id: 'tin',
        age_min: 36,
        age_max: 48,
        radius_km: 30,
        dealbreakers: ['Smoker', 'Long distance', 'Not over an ex'],
        intent: 'relationship',
        open_text: 'Someone who has their life together and still laughs at themselves.',
        updated_at: ago(24 * 30),
      },
    ],
  ]),
  vouches: [] as VouchRow[],
  connections: new Set<string>(),
  lineups: [] as Lineup[],
  entries: [] as LineupEntry[],
  comments: [] as LineupComment[],
  intros: [] as Introduction[],
  messages: [] as Message[],
  outcomes: new Map<string, OutcomeKind>(),
  briefs: [] as Brief[],
  linked: [] as LinkedProfile[],
  notifications: [] as Notification[],
  blocks: new Set<string>(),
};

const PROMPTS = [
  'What would you say about them to someone at a wedding?',
  'What do they do that their friends take for granted?',
  'What is the kindest thing you have seen them do?',
];

function vouch(
  voucher: string,
  single: string,
  text: string,
  how: string,
  hoursAgo: number,
  prompt = PROMPTS[0]!,
): VouchRow {
  return {
    id: `v-${voucher}-${single}`,
    voucher_id: voucher,
    single_id: single,
    prompt,
    text,
    how_known: how,
    created_at: ago(hoursAgo),
  };
}

function connect(a: string, b: string) {
  state.connections.add(a < b ? `${a}|${b}` : `${b}|${a}`);
}
function connected(a: string, b: string) {
  return state.connections.has(a < b ? `${a}|${b}` : `${b}|${a}`);
}

function seed() {
  state.vouches = [
    vouch(
      'holly',
      'tin',
      'The one everyone calls first when it goes wrong, and the first to laugh when it goes right.',
      'Flatmates in 2012',
      24 * 30,
    ),
    vouch(
      'kim',
      'tin',
      'She turned up to my dad’s funeral with a lasagne and stayed to do the dishes. That is Tin.',
      'Work, ten years ago',
      24 * 28,
      PROMPTS[2],
    ),
    vouch(
      'jess',
      'tin',
      'Reads the room faster than anyone I know, then says the thing everyone was thinking.',
      'My sister’s best friend',
      24 * 25,
      PROMPTS[1],
    ),
    vouch(
      'mark',
      'tin',
      'Beat me at pool six times in a row and still bought the round.',
      'Pub quiz team',
      24 * 22,
    ),
    vouch(
      'anna',
      'tin',
      'She remembers your kids’ names, your dog’s name and what you were worried about last month.',
      'Antenatal group, sort of',
      24 * 20,
      PROMPTS[1],
    ),
    vouch('tom', 'tin', 'Sharp, kind, zero drama. Hard combination.', 'Old colleague', 24 * 18),
    vouch(
      'sophie',
      'tin',
      'Drove three hours to pick me up when my car died and made it feel like a road trip.',
      'University',
      24 * 15,
      PROMPTS[2],
    ),
    vouch(
      'dan',
      'tin',
      'Funniest person at the table without ever needing to be.',
      'Neighbours',
      24 * 12,
    ),
    vouch(
      'lucy',
      'tin',
      'She listens like it matters, because to her it does.',
      'Book club',
      24 * 9,
      PROMPTS[1],
    ),
    vouch(
      'matt',
      'tin',
      'Would trust her with my kids, my dog and my passwords.',
      'Cycling group',
      24 * 5,
    ),
    vouch(
      'holly',
      'priya',
      'Calm in a crisis. Walked a terrified Labrador through surgery like it was nothing.',
      'Our vet',
      24 * 6,
    ),
    vouch(
      'kim',
      'ben',
      'Does the hard thing without making it anyone else’s problem.',
      'Brother-in-law’s mate',
      24 * 40,
    ),
    vouch(
      'holly',
      'ben',
      'Builds the bookshelf, then reads the books. Rare.',
      'Kids at the same school',
      24 * 38,
      PROMPTS[1],
    ),
    vouch('holly', 'sam', 'Patient with everyone except himself.', 'Ran together', 24 * 30),
    vouch('kim', 'leo', 'Straightforward in the best way.', 'Built our deck', 24 * 50),
  ];

  for (const v of state.vouches) connect(v.voucher_id, v.single_id);
  for (const id of [
    'tin',
    'priya',
    'ben',
    'sam',
    'mia',
    'nico',
    'ria',
    'dev',
    'leo',
    'jack',
    'owen',
    'paul',
    'kim',
  ])
    connect('holly', id);
  for (const id of ['tin', 'ben', 'leo', 'holly', 'sam', 'dev']) connect('kim', id);

  // Kim's earlier lineup: done, led to Ben.
  state.lineups.push({
    id: 'L-kim',
    voucher_id: 'kim',
    single_id: 'tin',
    status: 'done',
    agent_note_to_voucher:
      'Good instinct on Ben. Both said no to long distance, both have kids every second week.',
    created_at: ago(24 * 9),
    ready_at: ago(24 * 9),
    done_at: ago(24 * 8),
  });
  state.entries.push(
    {
      id: 'E-kim-ben',
      lineup_id: 'L-kim',
      candidate_id: 'ben',
      kept: true,
      rank: 1,
      reason:
        'Kim vouched for Ben. Same side of the bridge, both said no to long distance, both want something real.',
      dropped_reason: null,
      voucher_overrode: false,
      decision: 'meet',
      decided_at: ago(24 * 8),
      revealed_at: ago(24 * 8),
    },
    {
      id: 'E-kim-leo',
      lineup_id: 'L-kim',
      candidate_id: 'leo',
      kept: true,
      rank: 2,
      reason: 'Kim vouched for Leo. Weekends up north might suit someone who swims at dawn.',
      dropped_reason: null,
      voucher_overrode: false,
      decision: 'meet',
      decided_at: ago(24 * 8),
      revealed_at: ago(24 * 8),
    },
    {
      id: 'E-kim-dev',
      lineup_id: 'L-kim',
      candidate_id: 'dev',
      kept: true,
      rank: 3,
      reason:
        'Kim vouched for Dev. Quiz nights and a studio owner could be a good match of evenings.',
      dropped_reason: null,
      voucher_overrode: false,
      decision: 'not_this_time',
      decided_at: ago(24 * 8),
      revealed_at: ago(24 * 8),
    },
  );

  // Holly's lineup: just arrived, nothing decided. This is the reveal.
  state.lineups.push({
    id: 'L-holly',
    voucher_id: 'holly',
    single_id: 'tin',
    status: 'ready',
    agent_note_to_voucher:
      'Seven of your ten fit. Jack is in Perth and Tin said no to long distance. Owen told us last week he is not ready. Paul wants kids and Tin was clear she is done with that chapter.',
    created_at: ago(1),
    ready_at: ago(1),
    done_at: null,
  });
  const kept: [string, string][] = [
    [
      'sam',
      'Holly vouched for Sam. Early mornings on the trails, early mornings in the pool. Same intent, ten minutes apart.',
    ],
    [
      'nico',
      'Holly vouched for Nico. Early to bed suits a dawn swimmer, and he feeds people for a living.',
    ],
    [
      'ria',
      'Holly vouched for Ria. Same suburb, a dog who comes to everything, and no patience for drama either.',
    ],
    [
      'mia',
      'Holly vouched for Mia. Wellington is inside the radius Tin set if she meant it. Worth a conversation.',
    ],
    [
      'dev',
      'Holly vouched for Dev. Tin passed on Kim’s intro, but Holly knows him differently and says so below.',
    ],
    [
      'owen',
      'Holly vouched for Owen. He said he is not ready, then changed his mind. Shown last on purpose.',
    ],
    [
      'leo',
      'Holly vouched for Leo. Tin met him through Kim already; shown again because two friends picked him.',
    ],
  ];
  kept.forEach(([id, reason], i) =>
    state.entries.push({
      id: `E-holly-${id}`,
      lineup_id: 'L-holly',
      candidate_id: id,
      kept: true,
      rank: i + 1,
      reason,
      dropped_reason: null,
      voucher_overrode: false,
      decision: 'undecided',
      decided_at: null,
      revealed_at: null,
    }),
  );
  state.entries.push(
    {
      id: 'E-holly-jack',
      lineup_id: 'L-holly',
      candidate_id: 'jack',
      kept: false,
      rank: null,
      reason: null,
      dropped_reason: 'Jack is in Perth. Tin listed long distance as a dealbreaker.',
      voucher_overrode: false,
      decision: 'undecided',
      decided_at: null,
      revealed_at: null,
    },
    {
      id: 'E-holly-paul',
      lineup_id: 'L-holly',
      candidate_id: 'paul',
      kept: false,
      rank: null,
      reason: null,
      dropped_reason: 'Paul wants kids. Tin said that chapter is closed.',
      voucher_overrode: false,
      decision: 'undecided',
      decided_at: null,
      revealed_at: null,
    },
    {
      id: 'E-holly-ben',
      lineup_id: 'L-holly',
      candidate_id: 'ben',
      kept: false,
      rank: null,
      reason: null,
      dropped_reason: 'Ben and Tin are already talking, through Kim.',
      voucher_overrode: false,
      decision: 'undecided',
      decided_at: null,
      revealed_at: null,
    },
  );
  state.comments.push(
    {
      id: 'C1',
      lineup_id: 'L-holly',
      entry_id: null,
      author_id: 'holly',
      text: 'Take your time with this one. Sam first, trust me.',
      created_at: ago(0.9),
    },
    {
      id: 'C2',
      lineup_id: 'L-holly',
      entry_id: 'E-holly-dev',
      author_id: 'holly',
      text: 'I know you passed on Kim’s intro. He was mid-divorce then. Different man now.',
      created_at: ago(0.8),
    },
  );

  // Introductions.
  state.intros.push(
    {
      id: 'I-tin-ben',
      single_id: 'tin',
      candidate_id: 'ben',
      voucher_ids: ['kim', 'holly'],
      lineup_entry_id: 'E-kim-ben',
      single_decision: 'meet',
      candidate_decision: 'meet',
      status: 'mutual',
      created_at: ago(24 * 8),
      opened_at: ago(24 * 7),
      closed_at: null,
    },
    {
      id: 'I-tin-leo',
      single_id: 'tin',
      candidate_id: 'leo',
      voucher_ids: ['kim'],
      lineup_entry_id: 'E-kim-leo',
      single_decision: 'meet',
      candidate_decision: 'not_this_time',
      status: 'declined',
      created_at: ago(24 * 8),
      opened_at: null,
      closed_at: ago(24 * 6),
    },
    {
      id: 'I-priya-dev',
      single_id: 'priya',
      candidate_id: 'dev',
      voucher_ids: ['holly'],
      lineup_entry_id: null,
      single_decision: 'meet',
      candidate_decision: 'meet',
      status: 'mutual',
      created_at: ago(24 * 3),
      opened_at: ago(24 * 2),
      closed_at: null,
    },
  );
  state.messages.push(
    {
      id: 'M1',
      intro_id: 'I-tin-ben',
      sender_id: null,
      body: 'Kim on Tin: “She turned up to my dad’s funeral with a lasagne and stayed to do the dishes. That is Tin.”',
      is_vouch: true,
      created_at: ago(24 * 7),
    },
    {
      id: 'M2',
      intro_id: 'I-tin-ben',
      sender_id: null,
      body: 'Kim on Ben: “Does the hard thing without making it anyone else’s problem.”',
      is_vouch: true,
      created_at: ago(24 * 7),
    },
    {
      id: 'M3',
      intro_id: 'I-tin-ben',
      sender_id: 'ben',
      body: 'Kim has been threatening to do this for about a year. Hello.',
      is_vouch: false,
      created_at: ago(24 * 6.9),
    },
    {
      id: 'M4',
      intro_id: 'I-tin-ben',
      sender_id: 'tin',
      body: 'She mentioned a bookshelf. Holly mentioned it too. I need to see this bookshelf.',
      is_vouch: false,
      created_at: ago(24 * 6.5),
    },
    {
      id: 'M5',
      intro_id: 'I-tin-ben',
      sender_id: 'ben',
      body: 'It is a very good bookshelf. Thursday? There is a place on Ponsonby Road that does a decent negroni.',
      is_vouch: false,
      created_at: ago(24 * 2),
    },
    {
      id: 'M6',
      intro_id: 'I-priya-dev',
      sender_id: null,
      body: 'Holly on Priya: “Calm in a crisis. Walked a terrified Labrador through surgery like it was nothing.”',
      is_vouch: true,
      created_at: ago(24 * 2),
    },
    {
      id: 'M7',
      intro_id: 'I-priya-dev',
      sender_id: 'dev',
      body: 'I have a Labrador. He is also terrified of most things.',
      is_vouch: false,
      created_at: ago(24 * 1.5),
    },
  );
  state.outcomes.set('I-tin-ben', 'meeting');

  state.briefs.push({
    id: 'B-ben',
    intro_id: 'I-tin-ben',
    subject_id: 'ben',
    subject_approved: true,
    generated_at: ago(24 * 6),
    content: {
      summary:
        'Ben is a structural engineer at a mid-sized Auckland practice, listed there for nine years. His LinkedIn and his firm’s site agree on name, role and city. Two friends vouched for him independently, and both describe the same person: steady, practical, dry. He shares the care of two children every second week.',
      vouched_by: [
        { first_name: 'Kim', text: 'Does the hard thing without making it anyone else’s problem.' },
        { first_name: 'Holly', text: 'Builds the bookshelf, then reads the books. Rare.' },
      ],
      linked: [
        {
          kind: 'linkedin',
          url: 'https://www.linkedin.com/in/ben-example',
          what_it_shows:
            'Structural engineer, Auckland, nine years at the same practice. Photo matches his profile.',
        },
        {
          kind: 'website',
          url: 'https://example-engineering.co.nz/team',
          what_it_shows: 'Listed on the team page with the same photo and title.',
        },
      ],
      consistency: [
        {
          check: 'Stated age versus linked profiles',
          result: 'consistent',
          note: 'Graduation year on LinkedIn fits 41.',
        },
        {
          check: 'Stated city versus linked profiles',
          result: 'consistent',
          note: 'Both pages say Auckland.',
        },
        {
          check: 'Name and occupation across links',
          result: 'consistent',
          note: 'Same name and title on both.',
        },
        {
          check: 'Vouches describe the same person',
          result: 'consistent',
          note: 'Both vouches mention reliability and building things.',
        },
      ],
      sources: [
        'https://www.linkedin.com/in/ben-example',
        'https://example-engineering.co.nz/team',
      ],
    },
  });

  state.linked = [
    {
      id: 'LP1',
      user_id: 'tin',
      kind: 'linkedin',
      url: 'https://www.linkedin.com/in/tin-example',
      created_at: ago(24 * 20),
    },
    {
      id: 'LP2',
      user_id: 'tin',
      kind: 'website',
      url: 'https://tinstudio.example.nz',
      created_at: ago(24 * 20),
    },
  ];

  state.notifications = [
    {
      id: 'N1',
      user_id: 'tin',
      kind: 'lineup_ready',
      body: 'Holly has a lineup for you.',
      data: { route: '/lineup/L-holly' },
      read: false,
      created_at: ago(1),
    },
    {
      id: 'N2',
      user_id: 'tin',
      kind: 'intro_mutual',
      body: 'Ben said yes. Say hello.',
      data: { route: '/intro/I-tin-ben' },
      read: true,
      created_at: ago(24 * 7),
    },
    {
      id: 'N3',
      user_id: 'tin',
      kind: 'vouch_received',
      body: 'Matt vouched for you.',
      data: {},
      read: true,
      created_at: ago(24 * 5),
    },
    {
      id: 'N4',
      user_id: 'holly',
      kind: 'outcome',
      body: 'Priya and Dev are talking. You did that.',
      data: { route: '/(voucher)/record' },
      read: false,
      created_at: ago(24 * 2),
    },
    {
      id: 'N5',
      user_id: 'holly',
      kind: 'nudge',
      body: 'Priya’s circle is 4. Matches unlock at 10. Know 6 more people who would vouch for her?',
      data: { single_id: 'priya', route: '/(voucher)/friends' },
      read: true,
      created_at: ago(24 * 4),
    },
    {
      id: 'N6',
      user_id: 'holly',
      kind: 'comment',
      body: 'Two of Tin’s friends picked the same person. That is the best sign there is.',
      data: { route: '/lineup/L-holly' },
      read: true,
      created_at: ago(24 * 8),
    },
  ];
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
    Object.assign(p, patch, { updated_at: new Date().toISOString() });
    changed();
    return p;
  },

  circle(): CircleRow[] {
    return state.vouches
      .filter((v) => v.single_id === me())
      .map((v) => ({
        voucher_id: v.voucher_id,
        first_name: people[v.voucher_id]!.first_name,
        photo_url: people[v.voucher_id]!.photo_url,
        prompt: v.prompt,
        text: v.text,
        how_known: v.how_known,
        created_at: v.created_at,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  criteria(id: string): Criteria | null {
    return state.criteria.get(id) ?? null;
  },
  lineups() {
    const id = me();
    return state.lineups
      .filter((l) => l.single_id === id || l.voucher_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((l) => ({
        ...l,
        voucher: pub(l.voucher_id),
        single: pub(l.single_id),
        kept: state.entries.filter((e) => e.lineup_id === l.id && e.kept).length,
      }));
  },
  lineup(id: string): LineupWithPeople | null {
    const l = state.lineups.find((x) => x.id === id);
    if (!l) return null;
    return {
      ...l,
      voucher: pub(l.voucher_id),
      single: pub(l.single_id),
      entries: state.entries
        .filter((e) => e.lineup_id === id)
        .map((e) => ({ ...e, candidate: pub(e.candidate_id) }))
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
      comments: state.comments
        .filter((c) => c.lineup_id === id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    };
  },
  intros(): IntroWithPeople[] {
    const id = me();
    return state.intros
      .filter((i) => i.single_id === id || i.candidate_id === id || i.voucher_ids.includes(id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((i) => this.intro(i.id)!);
  },
  intro(id: string): IntroWithPeople | null {
    const i = state.intros.find((x) => x.id === id);
    if (!i) return null;
    const msgs = state.messages
      .filter((m) => m.intro_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const single = pub(i.single_id);
    const candidate = pub(i.candidate_id);
    return {
      ...i,
      single,
      candidate,
      vouchers: i.voucher_ids.map(pub),
      other: i.single_id === state.me ? candidate : single,
      lastMessage: msgs[msgs.length - 1] ?? null,
    };
  },
  messages(introId: string): Message[] {
    return state.messages
      .filter((m) => m.intro_id === introId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  brief(introId: string, subjectId: string): Brief | null {
    return state.briefs.find((b) => b.intro_id === introId && b.subject_id === subjectId) ?? null;
  },
  vouchesFor(singleId: string) {
    return state.vouches
      .filter((v) => v.single_id === singleId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((v) => ({
        id: v.id,
        voucher_id: v.voucher_id,
        prompt: v.prompt,
        text: v.text,
        how_known: v.how_known,
        created_at: v.created_at,
        voucher: {
          first_name: people[v.voucher_id]!.first_name,
          photo_url: people[v.voucher_id]!.photo_url,
        },
      }));
  },
  myVouch(singleId: string): VouchRow | null {
    return state.vouches.find((v) => v.voucher_id === state.me && v.single_id === singleId) ?? null;
  },
  mySingles(): MySingleRow[] {
    const id = me();
    return state.vouches
      .filter((v) => v.voucher_id === id)
      .map((v) => {
        const p = people[v.single_id]!;
        const mine = state.lineups.filter((l) => l.single_id === p.id && l.voucher_id === id);
        return {
          single_id: p.id,
          first_name: p.first_name,
          photo_url: p.photo_url,
          city: p.city,
          circle_size: state.vouches.filter((x) => x.single_id === p.id).length,
          lineups: mine.length,
          last_lineup_at: mine[0]?.created_at ?? null,
        };
      });
  },
  record(): RecordRow[] {
    const id = me();
    return state.intros
      .filter((i) => i.voucher_ids.includes(id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((i) => ({
        intro_id: i.id,
        single_first_name: people[i.single_id]!.first_name,
        candidate_first_name: people[i.candidate_id]!.first_name,
        status: i.status,
        latest_outcome: state.outcomes.get(i.id) ?? null,
        created_at: i.created_at,
      }));
  },
  nominatable(singleId: string): NominatableRow[] {
    const id = me();
    return Object.values(people)
      .filter(
        (p) =>
          p.id !== singleId &&
          p.id !== id &&
          p.role === 'single' &&
          !p.paused &&
          connected(id, p.id),
      )
      .filter(
        (p) =>
          !state.intros.some(
            (i) =>
              (i.single_id === singleId && i.candidate_id === p.id) ||
              (i.single_id === p.id && i.candidate_id === singleId),
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
      .filter((p) => p.id !== id && connected(id, p.id))
      .map((p) => ({ ...pub(p.id), role: p.role }));
  },
  publicProfile(id: string): PublicProfile | null {
    return people[id] ? pub(id) : null;
  },
  linked(userId: string): LinkedProfile[] {
    return state.linked.filter((l) => l.user_id === userId);
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
      'Kim Walker',
      'Mel Thompson',
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
    created_at: new Date().toISOString(),
  });
}

export const demoApi = {
  async matchContacts(hashes: string[], _myPhoneHash?: string) {
    await wait(900);
    const matched = Object.values(people)
      .filter((p) => p.phone_hash && hashes.includes(p.phone_hash))
      .map((p) => ({ ...pub(p.id), role: p.role, hash: p.phone_hash }));
    return {
      matched,
      pendingInvites: [] as { voucher_first_name: string; invite_message: string | null }[],
    };
  },

  async buildLineup(singleId: string, candidateIds: string[]) {
    await wait(1800);
    const single = people[singleId]!;
    const crit = state.criteria.get(singleId);
    const kept: { candidate_id: string; rank: number; reason: string }[] = [];
    const dropped: { candidate_id: string; first_name: string; reason: string }[] = [];
    for (const id of candidateIds) {
      const c = people[id];
      if (!c) continue;
      const age = ageOf(c) ?? 0;
      if (c.city === 'Perth' && crit?.dealbreakers.includes('Long distance')) {
        dropped.push({
          candidate_id: id,
          first_name: c.first_name,
          reason: `${c.first_name} is in Perth. ${single.first_name} listed long distance as a dealbreaker.`,
        });
      } else if (crit && (age < crit.age_min || age > crit.age_max)) {
        dropped.push({
          candidate_id: id,
          first_name: c.first_name,
          reason: `${c.first_name} is ${age}. ${single.first_name} asked for ${crit.age_min} to ${crit.age_max}.`,
        });
      } else if (kept.length >= 7) {
        dropped.push({
          candidate_id: id,
          first_name: c.first_name,
          reason: 'Seven is enough for one sitting. Keep this one for the next lineup.',
        });
      } else {
        const v = state.vouches.find((x) => x.voucher_id === state.me && x.single_id === id);
        kept.push({
          candidate_id: id,
          rank: kept.length + 1,
          reason: `${people[me()]!.first_name} vouched for ${c.first_name}.${v ? ` “${v.text}”` : ''} Same city, compatible intent.`,
        });
      }
    }
    const lineupId = nextId('L');
    state.lineups.unshift({
      id: lineupId,
      voucher_id: me(),
      single_id: singleId,
      status: kept.length ? 'ready' : 'done',
      agent_note_to_voucher: kept.length
        ? `${kept.length} of your ${candidateIds.length} fit. Good eye.`
        : 'None of these fit this time. Not a reflection on you.',
      created_at: new Date().toISOString(),
      ready_at: new Date().toISOString(),
      done_at: null,
    });
    for (const k of kept)
      state.entries.push({
        id: nextId('E'),
        lineup_id: lineupId,
        candidate_id: k.candidate_id,
        kept: true,
        rank: k.rank,
        reason: k.reason,
        dropped_reason: null,
        voucher_overrode: false,
        decision: 'undecided',
        decided_at: null,
        revealed_at: null,
      });
    for (const d of dropped)
      state.entries.push({
        id: nextId('E'),
        lineup_id: lineupId,
        candidate_id: d.candidate_id,
        kept: false,
        rank: null,
        reason: null,
        dropped_reason: d.reason,
        voucher_overrode: false,
        decision: 'undecided',
        decided_at: null,
        revealed_at: null,
      });
    notify(singleId, 'lineup_ready', `${people[me()]!.first_name} has a lineup for you.`, {
      route: `/lineup/${lineupId}`,
    });
    changed();
    return {
      lineupId,
      kept: kept.length,
      dropped,
      note: state.lineups[0]!.agent_note_to_voucher ?? '',
    };
  },

  async decideEntry(entryId: string, decision: Exclude<EntryDecision, 'undecided'>) {
    await wait(250);
    const e = state.entries.find((x) => x.id === entryId);
    if (!e) throw new Error('Not found');
    e.decision = decision;
    e.decided_at = new Date().toISOString();
    const l = state.lineups.find((x) => x.id === e.lineup_id)!;
    let introId: string | undefined;
    let status: IntroStatus | undefined;
    if (decision === 'meet') {
      const existing = state.intros.find(
        (i) => i.single_id === l.single_id && i.candidate_id === e.candidate_id,
      );
      if (existing) {
        if (!existing.voucher_ids.includes(l.voucher_id)) existing.voucher_ids.push(l.voucher_id);
        existing.single_decision = 'meet';
        introId = existing.id;
        status = existing.status;
      } else {
        introId = nextId('I');
        status = 'pending';
        state.intros.unshift({
          id: introId,
          single_id: l.single_id,
          candidate_id: e.candidate_id,
          voucher_ids: [l.voucher_id],
          lineup_entry_id: entryId,
          single_decision: 'meet',
          candidate_decision: 'undecided',
          status,
          created_at: new Date().toISOString(),
          opened_at: null,
          closed_at: null,
        });
        // In the demo the other person answers in a little while, so the story moves.
        setTimeout(() => {
          const i = state.intros.find((x) => x.id === introId);
          if (!i || i.status !== 'pending') return;
          i.candidate_decision = 'meet';
          i.status = 'mutual';
          i.opened_at = new Date().toISOString();
          const v = state.vouches.find(
            (x) => x.voucher_id === l.voucher_id && x.single_id === i.candidate_id,
          );
          state.messages.push({
            id: nextId('M'),
            intro_id: i.id,
            sender_id: null,
            body: `${people[l.voucher_id]!.first_name} on ${people[i.candidate_id]!.first_name}: “${v?.text ?? 'Good people.'}”`,
            is_vouch: true,
            created_at: new Date().toISOString(),
          });
          notify(
            i.single_id,
            'intro_mutual',
            `${people[i.candidate_id]!.first_name} said yes. Say hello.`,
            { route: `/intro/${i.id}` },
          );
          notify(
            l.voucher_id,
            'outcome',
            `${people[i.single_id]!.first_name} and ${people[i.candidate_id]!.first_name} are talking. You did that.`,
            { route: '/(voucher)/record' },
          );
          changed();
        }, 20_000);
      }
    }
    if (!state.entries.some((x) => x.lineup_id === l.id && x.kept && x.decision === 'undecided')) {
      l.status = 'done';
      l.done_at = new Date().toISOString();
    }
    changed();
    return { introId, status, ok: true };
  },

  async decideIntro(introId: string, decision: Exclude<EntryDecision, 'undecided'>) {
    await wait(250);
    const i = state.intros.find((x) => x.id === introId);
    if (!i) throw new Error('Not found');
    i.candidate_decision = decision;
    if (decision === 'not_this_time') {
      i.status = 'declined';
      i.closed_at = new Date().toISOString();
    } else if (decision === 'meet' && i.single_decision === 'meet') {
      i.status = 'mutual';
      i.opened_at = new Date().toISOString();
    }
    changed();
    return { introId, status: i.status };
  },

  async generateBrief(introId: string) {
    await wait(2200);
    const subject = people[me()]!;
    const content: BriefContent = {
      summary: `${subject.first_name} is ${ageOf(subject)}, in ${subject.city}. ${subject.bio ?? ''} The linked profiles and the vouches describe the same person.`,
      vouched_by: state.vouches
        .filter((v) => v.single_id === subject.id)
        .slice(0, 3)
        .map((v) => ({ first_name: people[v.voucher_id]!.first_name, text: v.text })),
      linked: state.linked
        .filter((l) => l.user_id === subject.id)
        .map((l) => ({
          kind: l.kind,
          url: l.url,
          what_it_shows: 'Name, city and work match what is stated here.',
        })),
      consistency: [
        {
          check: 'Stated age versus linked profiles',
          result: 'consistent',
          note: 'Nothing contradicts it.',
        },
        {
          check: 'Stated city versus linked profiles',
          result: 'consistent',
          note: `Both say ${subject.city}.`,
        },
        { check: 'Name and occupation across links', result: 'consistent', note: 'Same on each.' },
        {
          check: 'Vouches describe the same person',
          result: 'consistent',
          note: 'They agree with each other.',
        },
      ],
      sources: state.linked.filter((l) => l.user_id === subject.id).map((l) => l.url),
    };
    const existing = state.briefs.find(
      (b) => b.intro_id === introId && b.subject_id === subject.id,
    );
    const brief: Brief = existing ?? {
      id: nextId('B'),
      intro_id: introId,
      subject_id: subject.id,
      content,
      subject_approved: false,
      generated_at: new Date().toISOString(),
    };
    brief.content = content;
    brief.subject_approved = false;
    brief.generated_at = new Date().toISOString();
    if (!existing) state.briefs.push(brief);
    changed();
    return {
      brief: { id: brief.id, content: brief.content, subject_approved: brief.subject_approved },
    };
  },

  async approveBrief(introId: string) {
    const b = state.briefs.find((x) => x.intro_id === introId && x.subject_id === state.me);
    if (b) b.subject_approved = true;
    changed();
    return { ok: true as const };
  },

  async saveCriteria(
    singleId: string,
    c: {
      age_min: number;
      age_max: number;
      radius_km: number;
      dealbreakers: string[];
      intent: IntentKind;
      open_text: string | null;
    },
  ) {
    const row: Criteria = { single_id: singleId, ...c, updated_at: new Date().toISOString() };
    state.criteria.set(singleId, row);
    changed();
    return row;
  },

  async uploadAvatar(_userId: string, localUri: string) {
    return localUri;
  },

  async writeVouch(args: {
    voucherId: string;
    singleId: string;
    promptId: number | null;
    prompt: string;
    text: string;
    howKnown?: string | null;
  }) {
    const existing = state.vouches.find(
      (v) => v.voucher_id === args.voucherId && v.single_id === args.singleId,
    );
    if (existing) {
      existing.prompt = args.prompt;
      existing.text = args.text.trim();
      existing.how_known = args.howKnown ?? null;
    } else {
      state.vouches.unshift({
        id: nextId('V'),
        voucher_id: args.voucherId,
        single_id: args.singleId,
        prompt: args.prompt,
        text: args.text.trim(),
        how_known: args.howKnown ?? null,
        created_at: new Date().toISOString(),
      });
      connect(args.voucherId, args.singleId);
      notify(
        args.singleId,
        'vouch_received',
        `${people[args.voucherId]!.first_name} vouched for you.`,
      );
    }
    changed();
  },

  async removeVouch(voucherId: string, singleId: string) {
    state.vouches = state.vouches.filter(
      (v) => !(v.voucher_id === voucherId && v.single_id === singleId),
    );
    changed();
  },

  async inviteByHash(args: {
    voucherId: string;
    voucherFirstName: string;
    nomineeHash: string;
    nomineeName: string;
    message: string;
  }) {
    await wait(300);
    void args;
    return nextId('invite');
  },

  async commentOnLineup(args: {
    lineupId: string;
    entryId: string | null;
    authorId: string;
    text: string;
  }) {
    state.comments.push({
      id: nextId('C'),
      lineup_id: args.lineupId,
      entry_id: args.entryId,
      author_id: args.authorId,
      text: args.text.trim(),
      created_at: new Date().toISOString(),
    });
    changed();
  },

  async markRevealed(entryId: string) {
    const e = state.entries.find((x) => x.id === entryId);
    if (e && !e.revealed_at) e.revealed_at = new Date().toISOString();
  },

  async overrideDrop(entryId: string) {
    const e = state.entries.find((x) => x.id === entryId);
    if (e) {
      e.kept = true;
      e.voucher_overrode = true;
      e.rank = 99;
    }
    changed();
  },

  async sendMessage(introId: string, senderId: string, body: string) {
    state.messages.push({
      id: nextId('M'),
      intro_id: introId,
      sender_id: senderId,
      body: body.trim(),
      is_vouch: false,
      created_at: new Date().toISOString(),
    });
    changed();
    // The other person replies, so the demo chat feels alive.
    const i = state.intros.find((x) => x.id === introId);
    if (i) {
      const other = i.single_id === senderId ? i.candidate_id : i.single_id;
      const replies = [
        'Ha. Yes.',
        'Thursday works. 7?',
        'Holly will be unbearable about this.',
        'Deal.',
      ];
      setTimeout(() => {
        state.messages.push({
          id: nextId('M'),
          intro_id: introId,
          sender_id: other,
          body: replies[Math.floor(Math.random() * replies.length)]!,
          is_vouch: false,
          created_at: new Date().toISOString(),
        });
        changed();
      }, 4000);
    }
  },

  async reportOutcome(args: {
    introId: string;
    reportedBy: string;
    outcome: OutcomeKind;
    note?: string;
    whenAt?: string;
  }) {
    state.outcomes.set(args.introId, args.outcome);
    const i = state.intros.find((x) => x.id === args.introId);
    if (i) {
      if (args.outcome === 'met' || args.outcome === 'dating' || args.outcome === 'together')
        i.status = 'met';
      if (args.outcome === 'ended' || args.outcome === 'not_for_me') i.status = 'closed';
      for (const v of i.voucher_ids)
        notify(
          v,
          'outcome',
          `${people[i.single_id]!.first_name} and ${people[i.candidate_id]!.first_name}: ${args.outcome.replace('_', ' ')}. They said to tell you thanks.`,
          { route: '/(voucher)/record' },
        );
    }
    changed();
  },

  async unmatch(introId: string) {
    const i = state.intros.find((x) => x.id === introId);
    if (i) {
      i.status = 'closed';
      i.closed_at = new Date().toISOString();
    }
    changed();
  },

  async blockUser(blockerId: string, blockedId: string) {
    state.blocks.add(`${blockerId}|${blockedId}`);
    changed();
  },

  async reportUser(_args: {
    reporterId: string;
    reportedId: string;
    reason: string;
    details?: string;
  }) {
    await wait(300);
  },

  async addLinkedProfile(userId: string, kind: LinkedKind, url: string) {
    state.linked.push({
      id: nextId('LP'),
      user_id: userId,
      kind,
      url: url.trim(),
      created_at: new Date().toISOString(),
    });
    changed();
  },

  async removeLinkedProfile(id: string) {
    state.linked = state.linked.filter((l) => l.id !== id);
    changed();
  },

  async markNotificationsRead(ids: string[]) {
    for (const n of state.notifications) if (ids.includes(n.id)) n.read = true;
  },
};

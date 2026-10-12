// The voice, in one place. "The friend who knows someone." Second person, present tense,
// short sentences, plain words. No em dashes, no emoji, no competitor names, no ages.
// Screens read lines from here rather than inventing their own, so the voice stays one voice.
//
// Source: Mash Brief 2, Brand and Rules, 12 October 2026, section 5 (tone of voice),
// sections 3 and 4 (the rules shown at onboarding).

export const copy = {
  app: 'Mash',
  tagline: 'A dating app where your friends do the matching.',
  oneLine: 'No strangers, no swiping, just people someone you know has vouched for.',

  onboarding: {
    pickMashmaker: 'Pick a friend who knows you and knows people. We’ll ask them. They can say no.',
    optIn: 'Being on Mash and being matched are two different yeses. This is the second one.',
    contacts: 'Your contacts are hashed on your phone. We never see your address book.',
  },

  batch: {
    /** "Sam's picked 3 Catches for you. Here's why." */
    arrival: (mashmaker: string, n: number) =>
      `${mashmaker}’s picked ${n} ${n === 1 ? 'Catch' : 'Catches'} for you. Here’s why.`,
    oneMore: (mashmaker: string) => `One more in ${mashmaker}’s batch for you.`,
    waiting: (mashmaker: string) =>
      `${mashmaker} is putting a batch together. You’ll know when it’s ready.`,
    none: 'Nothing yet. When one of your Mashmakers picks someone, it lands here.',
  },

  accept: {
    bothYes: 'You both said yes. Say hello.',
    waiting: (name: string) => `${name} hasn’t answered yet.`,
  },

  decline: {
    didNotGoAhead: 'This one didn’t go ahead.',
    timedOut: 'This one timed out.',
  },

  outcome: {
    prompt: 'How did it go?',
    options: { metAgain: 'Met, going again', notForMe: 'Not for me', skip: 'Skip' },
    shareAsk: (mashmaker: string) => `What should ${mashmaker} know?`,
  },

  leave: (name: string) => `${name} has left Mash. Thanks for being their Mashmaker.`,

  plus: {
    pitch: 'Want the Machine to check them out first? $19.95 a month. Cancel any time.',
    what: 'The Machine checks that the person is who they say they are: consistency, public signals, nothing else.',
    limitation:
      'This checks consistency and public signals. It cannot tell you what someone is like.',
    trial: (days: number) =>
      days === 1 ? '1 day left on your free 21 days.' : `${days} days left on your free 21 days.`,
    trialStartsAtFirstBatch: 'Your free 21 days start with your first batch, not today.',
  },

  safety: {
    money:
      'Someone you’re talking to asked for money. That’s not how this works. Report them here. Your Mashmaker won’t be told unless you want them to be.',
    reportGoesToUs: 'This goes to us, not your Mashmaker. You choose what they learn.',
    blocked: 'Done. They can’t see you and won’t be put forward for you again.',
  },

  errors: {
    didNotSend: 'That didn’t send. Try again.',
    didNotSave: 'That didn’t save. Try again.',
    didNotLoad: 'That didn’t load. Check your connection and try again.',
  },

  empty: {
    contacts: 'No one in your contacts right now. When someone joins, we’ll tell you.',
    nominatable: (name: string) =>
      `No one in your contacts right now for ${name}. When someone joins, we’ll tell you.`,
    mashes: 'No one yet. When you and someone both say yes, you’ll talk here.',
    record: 'Nothing yet. The people you introduce will show up here, and only here.',
    catches:
      'Nobody has asked you yet. When a friend picks you as their Mashmaker, they’ll show up here.',
    mashmakers: 'No Mashmakers yet. Pick a friend who knows you and knows people.',
  },

  consent: {
    ask: (mashmaker: string, catchName: string) =>
      `${mashmaker} would like to show you to ${catchName}. Okay?`,
    explain: 'Say yes and they see your profile and the note. Say no and nobody is told why.',
  },

  marketing: {
    invite: 'Bring the friend who keeps saying “I know someone”.',
  },
} as const;

/** Shown once at onboarding. Must be accepted. Their words, unchanged. */
export const MASHMAKER_RULES = {
  intro: 'You are doing something good here. These rules keep it that way.',
  rules: [
    {
      title: 'Only your own people.',
      body: 'You can only introduce people you actually know. No strangers, no friends of friends you have never met, no one you found rather than know.',
    },
    {
      title: 'Ask before you nominate.',
      body: 'If someone is not on Mash yet, invite them and let them decide. If they are on Mash, they will be asked before anyone sees them. Never put someone forward who has not said yes.',
    },
    {
      title: 'Say why.',
      body: 'Every introduction comes with your note. Make it about the two people, not about you. “You both hate small talk and both ran the half this year” is a note. “Trust me” is not.',
    },
    {
      title: 'Fewer, better.',
      body: 'You get a few nominations per friend at a time. Use them like a real introduction at dinner: carefully, for people you think could work.',
    },
    {
      title: 'Be honest about who they are.',
      body: 'Your friend’s good name is on this. If you would not vouch for someone to their face, do not vouch for them here. If you learn something after the fact, pull the nomination. Nobody will be told why.',
    },
    {
      title: 'What you see stays with you.',
      body: 'You will know who was introduced and whether it went ahead. You will not know how the date went unless your friend tells you. Do not ask the other person, share profiles, screenshot, or put it in the group chat.',
    },
    {
      title: 'Respect the no.',
      body: 'Your friend can decline anyone without a reason. The other person can decline your friend. Neither owes you an explanation, and you do not get to argue it.',
    },
    {
      title: 'You are an introducer, not a guarantor.',
      body: 'Mash checks that people are real and their photos are current. You are vouching that you know them and think they should meet. That is all anyone is asking of you.',
    },
    {
      title: 'Mind your motives.',
      body: 'Do not nominate people to see what happens, to find out if someone is single, or to settle anything. If you are curious rather than helpful, stop.',
    },
    { title: 'Keep it kind.', body: 'You are the friend who knows someone. Be that friend.' },
  ],
  outro: 'Break these and you lose the role. Your friend keeps everything else.',
} as const;

export const CATCH_RULES = {
  intro: 'Someone is about to put their good name on you. These rules are how you look after it.',
  rules: [
    {
      title: 'Be who you say you are.',
      body: 'Current photos, real age, honest about what you want. We check, and so does your friend. If your photos are from another decade, nobody is being set up, they are being misled.',
    },
    {
      title: 'One profile. The real one.',
      body: 'No second accounts, no alternate versions of you for different circles.',
    },
    {
      title: 'Choose your Mashmakers well.',
      body: 'Pick friends who know you and know people. They will be asked, and they can say no. You can have more than one. You can remove one any time, and they will not be told why.',
    },
    {
      title: 'Treat every introduction as a favour.',
      body: 'Someone thought about you and picked a person for you. Look properly. Say yes or no within a few days. Leaving an intro open indefinitely is a no with worse manners.',
    },
    {
      title: 'No means no, and no reason is owed.',
      body: 'You can pass on anyone. Anyone can pass on you. Nobody gets an explanation and nobody gets to ask for one.',
    },
    {
      title: 'Show up like an adult.',
      body: 'If you accept an intro, reply. If you make a plan, keep it or cancel properly. If it is not working, say so kindly and early. Ghosting is the one thing a friend’s introduction was supposed to end.',
    },
    {
      title: 'Keep what you learn.',
      body: 'You will see who introduced you and why, and that someone is real with current photos. Do not share profiles, screenshots, notes or conversations with anyone, inside or outside Mash.',
    },
    {
      title: 'Your Mashmaker is not your messenger.',
      body: 'Do not use them to find out why someone passed, to carry messages, or to get a second chance. Say it to the other person, or let it go.',
    },
    {
      title: 'Money, pressure and moving fast are red flags. Report them.',
      body: 'Nobody you meet on Mash should ask for money, push you off the app in the first conversation, or pressure you for anything. The report goes to us, not your Mashmaker, and you choose what your Mashmaker learns.',
    },
    {
      title: 'Tell us how it went, lightly.',
      body: '“Met, going again” or “not for me” is all we need. It helps your Mashmaker and the Machine pick better. Anything beyond that is yours.',
    },
    {
      title: 'When you find someone, leave.',
      body: 'That is the point. One tap and you are gone from every Mashmaker and every open intro. Your Mashmakers get a thank-you, not the details.',
    },
  ],
  outro:
    'Break these and you are off Mash. Your Mashmakers are told you need a new introduction, not why.',
} as const;

/** The public commitments, shown in Settings under "What we promise". Brief 1, section 8. */
export const PROMISES = [
  'Contacts are hashed on your phone. We never see your address book.',
  'Nobody outside your circle can see you. There is no search.',
  'No one is scored, ranked or rated.',
  'Your Mashmaker sees what you let them see, and the default is almost nothing.',
  'Verification images are deleted within 7 days.',
  'Due diligence checks who someone is, not what they are like, and is only shown to the person who asked.',
  'Deleting your account deletes your data within 30 days. We say what we keep and why.',
  'Humans only read conversations when the safety system flags them or the law requires it, and every access is logged.',
] as const;

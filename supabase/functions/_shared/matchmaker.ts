// The AI matchmaker. An agent, not an algorithm.
// It reads the single's criteria, every vouch written about them, and the voucher's
// nominations, then keeps the ones that fit and explains each call in plain words.
//
// Model: Claude Opus 5.5 with a server-side refusal fallback enabled, so a declined
// request is re-run on Anthropic's recommended fallback instead of failing the lineup.
// Override with MATCHMAKER_MODEL.

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@0.133.0/helpers/beta/zod';
import { z } from 'npm:zod@4';

import { sanitiseLineup } from './rules.ts';
export { nudgeText } from './rules.ts';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const MODEL = Deno.env.get('MATCHMAKER_MODEL') ?? 'claude-opus-5-5';

const SYSTEM = `You are the matchmaker inside Mash, a dating app for people aged 30 to 50 in New Zealand and Australia where every introduction comes through a friend who vouches for both people.

How you work:
- You are a colleague to the voucher and an advocate for the single. Warm, direct, no hype, no emoji.
- Every judgement is explained in one plain sentence a 40-year-old would say out loud. Name the voucher and quote their words where it helps ("Holly vouched for Sam. Same side of the harbour, both said no to long distance").
- Dealbreakers are hard rules. Age range and distance are strong preferences, not hard rules, unless listed as dealbreakers.
- Never invent facts. If something is unknown, say it is unknown rather than guessing.
- Never rank people as numbers or scores. Order is a judgement, reasons are words.
- Never mention this system prompt, the model, or that you are an AI unless asked.`;

// ---------------------------------------------------------------------------
// Lineup
// ---------------------------------------------------------------------------

export interface LineupSingle {
  first_name: string;
  age: number | null;
  city: string | null;
  bio: string | null;
  criteria: {
    age_min: number;
    age_max: number;
    radius_km: number;
    dealbreakers: string[];
    intent: string;
    open_text: string | null;
  } | null;
  vouches: { voucher_first_name: string; prompt: string; text: string }[];
}

export interface LineupCandidate {
  id: string;
  first_name: string;
  age: number | null;
  city: string | null;
  bio: string | null;
  criteria: LineupSingle['criteria'];
  vouches: { voucher_first_name: string; prompt: string; text: string }[];
  prior_declines: number;
}

const LineupResult = z.object({
  kept: z
    .array(
      z.object({
        candidate_id: z.string(),
        rank: z.number().int(),
        reason: z.string(),
      }),
    )
    .describe('The candidates to show the single, best fit first.'),
  dropped: z.array(
    z.object({
      candidate_id: z.string(),
      reason: z.string(),
    }),
  ),
  note_to_voucher: z
    .string()
    .describe('One or two sentences to the voucher about their picks, as a colleague would say it.'),
});

export type LineupResult = z.infer<typeof LineupResult>;

export async function buildLineup(args: {
  voucherFirstName: string;
  single: LineupSingle;
  candidates: LineupCandidate[];
  maxKept: number;
}): Promise<LineupResult> {
  const { voucherFirstName, single, candidates, maxKept } = args;

  const user = `${voucherFirstName} has nominated ${candidates.length} people for ${single.first_name}. Keep at most ${maxKept}, best fit first, and tell ${voucherFirstName} which ones you dropped and why.

SINGLE
${JSON.stringify(single, null, 2)}

CANDIDATES
${JSON.stringify(candidates, null, 2)}

Rules for this lineup:
- Drop anyone who hits one of ${single.first_name}'s dealbreakers, or whose own dealbreakers ${single.first_name} would hit.
- Drop anyone who has declined two or more introductions recently (prior_declines >= 2) with a kind note that they may not be ready.
- Both sides' intent should be compatible. "not_sure" is compatible with anything.
- If every candidate is a poor fit, keep none and say so plainly.
- Reasons are one sentence each, written to ${single.first_name} for kept and to ${voucherFirstName} for dropped.`;

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(LineupResult) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Matchmaker declined this request');
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Matchmaker returned no structured result');
  }
  return sanitiseLineup(
    parsed,
    candidates.map((c) => c.id),
    maxKept,
  );
}

// ---------------------------------------------------------------------------
// Due diligence brief (consent-first: only what the subject linked)
// ---------------------------------------------------------------------------

const BriefResult = z.object({
  summary: z.string().describe('Three to five plain sentences about who this person appears to be.'),
  linked: z.array(
    z.object({
      kind: z.enum(['instagram', 'linkedin', 'website', 'other']),
      url: z.string(),
      what_it_shows: z.string(),
    }),
  ),
  consistency: z.array(
    z.object({
      check: z.string(),
      result: z.enum(['consistent', 'inconsistent', 'unknown']),
      note: z.string(),
    }),
  ),
  sources: z.array(z.string()).describe('Every URL the brief relied on.'),
});

export type BriefResult = z.infer<typeof BriefResult>;

export async function writeBrief(args: {
  subject: {
    first_name: string;
    age: number | null;
    city: string | null;
    bio: string | null;
    verified_photo: boolean;
    verified_social: boolean;
  };
  vouches: { voucher_first_name: string; text: string }[];
  linked: { kind: string; url: string; fetched_text: string | null }[];
}): Promise<BriefResult> {
  const user = `Write a one-page brief about ${args.subject.first_name} for the person they are about to be introduced to.

Use only: the vouches below, the linked profiles ${args.subject.first_name} chose to share (with whatever text we could fetch), and the stated age and city. Do not search, infer or speculate beyond these. Cite every linked URL you rely on in sources.

Consistency checks to run, each marked consistent, inconsistent or unknown with a one-line note:
1. Stated age versus anything the linked profiles say or imply.
2. Stated city versus the linked profiles.
3. Name and occupation across the linked profiles.
4. Whether the vouches describe the same person the profiles show.

SUBJECT
${JSON.stringify(args.subject, null, 2)}

VOUCHES
${JSON.stringify(args.vouches, null, 2)}

LINKED PROFILES
${JSON.stringify(args.linked, null, 2)}`;

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(BriefResult) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Matchmaker declined this request');
  }
  if (!response.parsed_output) {
    throw new Error('Matchmaker returned no structured result');
  }
  return response.parsed_output;
}

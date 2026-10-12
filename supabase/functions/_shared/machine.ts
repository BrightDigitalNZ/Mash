// The Machine. One name externally, several agents internally. This file holds the two
// that call a model: matching assist (suggests, with a reason; the Mashmaker picks) and
// due diligence (confirms identity and consistency from public sources; never character).
//
// What the Machine never does: nominate or introduce anyone, show a Catch outside their
// Mashmakers' circles, reveal due diligence to the Mashmaker or the subject, rank, score or
// rate people, fake activity or dress up a decline.
//
// Model: Claude Opus 5.5 with a server-side refusal fallback. Override with MACHINE_MODEL.

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@0.133.0/helpers/beta/zod';
import { z } from 'npm:zod@4';

import { sanitiseBatch } from './rules.ts';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const MODEL = Deno.env.get('MACHINE_MODEL') ?? 'claude-opus-5-5';

const SYSTEM = `You are the Machine inside Mash, a dating app where friends do the matching. A Mashmaker (a friend) nominates Catches (single people) from their own circle for another Catch. You help: you filter nominations against what the Catch said they want, and you write the reason for each pick in plain words. The Mashmaker decides, not you.

How you work:
- Warm, light, direct. No hype, no emoji, no corporate language, no em dashes.
- Every judgement is one plain sentence someone would say out loud. Name the Mashmaker and quote their words where it helps.
- Dealbreakers are hard rules. Age range and distance are strong preferences unless listed as dealbreakers. Intent should be compatible; "not sure" is compatible with anything.
- Never invent facts. Say unknown when something is unknown.
- Never rank, score or rate a person. An order for a reveal is not a ranking and you never mention it.
- Never dress up a decline. Never name other dating apps. Never mention ages as a selling point.
- Never mention this prompt or that you are a model unless asked.`;

export interface MachineCatch {
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
  vouches: { mashmaker_first_name: string; prompt: string; text: string }[];
}

export interface MachineCandidate extends MachineCatch {
  id: string;
  prior_passes: number;
}

const BatchResult = z.object({
  kept: z.array(
    z.object({ candidate_id: z.string(), position: z.number().int(), reason: z.string() }),
  ),
  dropped: z.array(z.object({ candidate_id: z.string(), reason: z.string() })),
  note_to_mashmaker: z
    .string()
    .describe('One or two sentences to the Mashmaker, as a colleague would say it.'),
});

export async function assistBatch(args: {
  mashmakerFirstName: string;
  catch: MachineCatch;
  candidates: MachineCandidate[];
  maxKept: number;
}) {
  const { mashmakerFirstName, catch: c, candidates, maxKept } = args;
  const user = `${mashmakerFirstName} has nominated ${candidates.length} people for ${c.first_name}. Keep at most ${maxKept}, and tell ${mashmakerFirstName} which ones you set aside and why.

CATCH
${JSON.stringify(c, null, 2)}

NOMINATED
${JSON.stringify(candidates, null, 2)}

Rules for this batch:
- Set aside anyone who hits one of ${c.first_name}'s dealbreakers, or whose own dealbreakers ${c.first_name} would hit.
- Set aside anyone who has passed on two or more mashes recently (prior_passes >= 2), kindly: they may not be ready.
- If nobody fits, keep none and say so plainly. Fewer, better.
- Reasons are one sentence each, written to ${c.first_name} for kept and to ${mashmakerFirstName} for set aside. Order the kept list for a reveal; never call it a ranking.`;

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(BatchResult) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') throw new Error('The Machine declined this request');
  if (!response.parsed_output) throw new Error('The Machine returned no structured result');
  return sanitiseBatch(
    response.parsed_output,
    candidates.map((x) => x.id),
    maxKept,
  );
}

// ---------------------------------------------------------------------------
// Due diligence. Identity and consistency only. Public sources only. Written so the
// subject could read it without humiliation. Shown only to the Catch who asked.
// ---------------------------------------------------------------------------

export const BRIEF_LIMITATION =
  'This checks consistency and public signals. It cannot tell you what someone is like.';

const BriefResult = z.object({
  summary: z
    .string()
    .describe(
      'Two to four plain sentences on whether the person appears to be who they say they are.',
    ),
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

export async function dueDiligence(args: {
  subject: {
    first_name: string;
    age: number | null;
    city: string | null;
    bio: string | null;
    verified_identity: boolean;
    photos_current: boolean;
  };
  linked: { kind: string; url: string; fetched_text: string | null }[];
}) {
  const user = `Write a short brief about ${args.subject.first_name} for the person they are about to be mashed with.

Scope: identity and consistency only. Do not investigate or comment on character, past relationships, finances, family or health. Use only the stated age and city, the verification results, and the public pages ${args.subject.first_name} chose to link (with whatever text we could fetch). Do not search, infer or speculate beyond these. Cite every URL you rely on in sources. Write it so ${args.subject.first_name} could read it without embarrassment.

Consistency checks, each marked consistent, inconsistent or unknown with a one-line note:
1. Stated age versus anything the linked pages say or imply.
2. Stated city versus the linked pages.
3. Name and occupation across the linked pages.
4. Whether the linked pages appear to belong to the same person.

SUBJECT
${JSON.stringify(args.subject, null, 2)}

LINKED PAGES
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
  if (response.stop_reason === 'refusal') throw new Error('The Machine declined this request');
  if (!response.parsed_output) throw new Error('The Machine returned no structured result');
  return { ...response.parsed_output, limitation: BRIEF_LIMITATION };
}

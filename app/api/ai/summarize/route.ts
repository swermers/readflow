export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { consumeCreditsAtomic, ensureCreditsAvailable } from '@/utils/aiEntitlements';

type SummaryResult = {
  summary: string;
  takeaways: string[];
};

const MAX_INPUT_CHARS = 12000;


function parseJsonFromText(text: string) {
  const direct = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(direct);
  } catch {
    const firstBrace = direct.indexOf('{');
    const lastBrace = direct.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const slice = direct.slice(firstBrace, lastBrace + 1);
      return JSON.parse(slice);
    }
    throw new Error('Could not parse JSON payload');
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSummaryPayload(payload: unknown): SummaryResult | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const takeawaysRaw = Array.isArray(obj.takeaways) ? obj.takeaways : [];
  const takeaways = takeawaysRaw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!summary || takeaways.length === 0) return null;
  return { summary, takeaways };
}

async function summarizeWithAnthropic(input: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic key is not configured');

  const prompt = `You are helping summarize a newsletter article for a reader app.\nDetect the primary language used in the article and write both summary and takeaways in that same language.\nRespond ONLY as strict JSON with keys: summary (string), takeaways (array of 3 concise strings).\n\nArticle:\n${input}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 500,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Anthropic request failed: ${res.status} ${details}`);
  }

  const data = await res.json();
  const textBlock = Array.isArray(data?.content)
    ? data.content.find((block: any) => block?.type === 'text' && typeof block?.text === 'string')
    : null;
  const text = textBlock?.text;
  if (typeof text !== 'string') throw new Error('Anthropic response missing text');

  const parsed = normalizeSummaryPayload(parseJsonFromText(text));
  if (!parsed) throw new Error('Anthropic summary parsing failed');
  return parsed;
}

async function summarizeWithGrok(input: string) {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) throw new Error('Grok key is not configured');

  const prompt = `Detect the primary language of the article and keep the response in that same language. Return strict JSON only with keys summary (string) and takeaways (array of 3 short strings).\n\nArticle:\n${input}`;

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || 'grok-beta',
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Grok request failed: ${res.status} ${details}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('Grok response missing text');

  const parsed = normalizeSummaryPayload(parseJsonFromText(text));
  if (!parsed) throw new Error('Grok summary parsing failed');
  return parsed;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const issueId = body?.issueId as string | undefined;
  const provider = body?.provider === 'grok' ? 'grok' : 'anthropic';

  const creditGate = await ensureCreditsAvailable(supabase, user.id, 1);
  if (!creditGate.allowed) {
    return NextResponse.json(
      {
        error: creditGate.reason || 'Monthly AI credit limit reached',
        planTier: creditGate.tier,
        creditsRemaining: creditGate.remaining,
        creditsLimit: creditGate.limit,
        resetsAt: creditGate.resetAt,
        unlimitedAiAccess: creditGate.unlimitedAiAccess || false,
      },
      { status: 402 }
    );
  }

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  const { data: issue, error } = await supabase
    .from('issues')
    .select('id, subject, body_text, body_html')
    .eq('id', issueId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error || !issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const rawText = (issue.body_text?.trim() || stripHtml(issue.body_html || '')).trim();
  if (!rawText) {
    return NextResponse.json({ error: 'No article text available to summarize' }, { status: 400 });
  }

  const input = `${issue.subject || 'Newsletter article'}\n\n${rawText.slice(0, MAX_INPUT_CHARS)}`;

  const serializeError = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Unknown provider error';
  };

  try {
    const result = provider === 'grok'
      ? await summarizeWithGrok(input)
      : await summarizeWithAnthropic(input);

    const consumeResult = await consumeCreditsAtomic(supabase, user.id, 1);
    return NextResponse.json({
      provider,
      ...result,
      creditsRemaining: consumeResult.remaining,
      creditsLimit: consumeResult.limit,
      planTier: consumeResult.tier,
      unlimitedAiAccess: consumeResult.unlimitedAiAccess || false,
    });
  } catch (primaryError) {
    const fallbackProvider = provider === 'anthropic' ? 'grok' : 'anthropic';

    try {
      const fallback = fallbackProvider === 'grok'
        ? await summarizeWithGrok(input)
        : await summarizeWithAnthropic(input);
      const consumeResult = await consumeCreditsAtomic(supabase, user.id, 1);
      return NextResponse.json({
        provider: fallbackProvider,
        ...fallback,
        creditsRemaining: consumeResult.remaining,
        creditsLimit: consumeResult.limit,
        planTier: consumeResult.tier,
        unlimitedAiAccess: consumeResult.unlimitedAiAccess || false,
      });
    } catch (fallbackError) {
      const primaryMessage = serializeError(primaryError);
      const fallbackMessage = serializeError(fallbackError);

      console.error('AI summarize failed:', primaryMessage, fallbackMessage);
      return NextResponse.json(
        {
          error: 'Failed to generate TLDR with configured providers',
          hints: [
            'Confirm ANTHROPIC_API_KEY and XAI_API_KEY (or GROK_API_KEY) are set for the same Vercel environment',
            'Verify provider model names are valid for your account',
            'After updating env vars, trigger a fresh redeploy of that environment',
          ],
          providerErrors: {
            [provider]: primaryMessage,
            [fallbackProvider]: fallbackMessage,
          },
        },
        { status: 500 }
      );
    }
  }
}

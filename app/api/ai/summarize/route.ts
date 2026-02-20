export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkEntitlement, consumeTokensAtomic, format402Payload } from '@/utils/aiEntitlements';
import { ANTHROPIC_MODEL_CANDIDATES, XAI_MODEL_CANDIDATES, isModelNotFoundError } from '@/utils/aiModels';

type SummaryResult = {
  summary: string;
  takeaways: string[];
};

const MAX_INPUT_CHARS = 12000;

const LANGUAGE_STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'that', 'with', 'for', 'you', 'this', 'from', 'have', 'are'],
  es: ['el', 'la', 'los', 'las', 'de', 'que', 'en', 'con', 'por', 'para'],
  fr: ['le', 'la', 'les', 'de', 'des', 'et', 'que', 'dans', 'pour', 'avec'],
  de: ['der', 'die', 'das', 'und', 'mit', 'für', 'ist', 'den', 'von', 'auf'],
  pt: ['o', 'a', 'os', 'as', 'de', 'que', 'e', 'com', 'para', 'em'],
  it: ['il', 'lo', 'la', 'gli', 'le', 'di', 'che', 'con', 'per', 'una'],
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
};

function detectLikelyLanguage(input: string) {
  const tokens = (input.toLowerCase().match(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g) || []).slice(0, 4000);
  if (tokens.length === 0) return { code: 'en', confidence: 0 };

  let bestCode = 'en';
  let bestScore = 0;
  let secondScore = 0;

  for (const [code, words] of Object.entries(LANGUAGE_STOPWORDS)) {
    let score = 0;
    for (const word of words) {
      const hits = tokens.filter((token) => token === word).length;
      score += hits;
    }

    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestCode = code;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  const confidence = bestScore === 0 ? 0 : (bestScore - secondScore) / Math.max(bestScore, 1);
  return { code: bestCode, confidence };
}

function assertSummaryLanguage(summary: SummaryResult, expectedCode: string, minConfidence = 0.2) {
  const combined = `${summary.summary}\n${summary.takeaways.join('\n')}`;
  const detected = detectLikelyLanguage(combined);
  if (detected.confidence >= minConfidence && detected.code !== expectedCode) {
    throw new Error(`Summary language mismatch: expected ${expectedCode}, got ${detected.code}`);
  }
}


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

async function summarizeWithAnthropic(input: string, expectedLanguageCode: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic key is not configured');

  const prompt = `You are helping summarize a newsletter article for a reader app.\nThe article language is ${LANGUAGE_LABELS[expectedLanguageCode] || 'English'} (${expectedLanguageCode}).\nWrite summary and takeaways ONLY in ${LANGUAGE_LABELS[expectedLanguageCode] || 'English'}. Never translate to another language.\nRespond ONLY as strict JSON with keys: summary (string), takeaways (array of 3 concise strings).\n\nArticle:\n${input}`;

  let lastError: Error | null = null;

  for (const model of ANTHROPIC_MODEL_CANDIDATES) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      lastError = new Error(`Anthropic request failed: ${res.status} ${details}`);
      if (isModelNotFoundError(details)) {
        continue;
      }
      throw lastError;
    }

    const data = await res.json();
    const textBlock = Array.isArray(data?.content)
      ? data.content.find((block: any) => block?.type === 'text' && typeof block?.text === 'string')
      : null;
    const text = textBlock?.text;
    if (typeof text !== 'string') throw new Error('Anthropic response missing text');

    const parsed = normalizeSummaryPayload(parseJsonFromText(text));
    if (!parsed) throw new Error('Anthropic summary parsing failed');
    assertSummaryLanguage(parsed, expectedLanguageCode);
    return parsed;
  }

  throw lastError || new Error('Anthropic request failed for all configured models');
}

async function summarizeWithGrok(input: string, expectedLanguageCode: string) {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) throw new Error('Grok key is not configured');

  const prompt = `The article language is ${LANGUAGE_LABELS[expectedLanguageCode] || 'English'} (${expectedLanguageCode}). Return strict JSON only with keys summary (string) and takeaways (array of 3 short strings).\nWrite ONLY in ${LANGUAGE_LABELS[expectedLanguageCode] || 'English'}. Never translate to another language.\n\nArticle:\n${input}`;

  let lastError: Error | null = null;

  for (const model of XAI_MODEL_CANDIDATES) {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      lastError = new Error(`Grok request failed: ${res.status} ${details}`);
      if (isModelNotFoundError(details)) {
        continue;
      }
      throw lastError;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('Grok response missing text');

    const parsed = normalizeSummaryPayload(parseJsonFromText(text));
    if (!parsed) throw new Error('Grok summary parsing failed');
    assertSummaryLanguage(parsed, expectedLanguageCode);
    return parsed;
  }

  throw lastError || new Error('Grok request failed for all configured models');
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

  const entitlement = await checkEntitlement(supabase, user.id, "tldr");
  if (!entitlement.allowed) {
    return NextResponse.json(format402Payload(entitlement), { status: 402 });
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
  const expectedLanguageCode = detectLikelyLanguage(input).code;

  const serializeError = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Unknown provider error';
  };

  try {
    const result = provider === 'grok'
      ? await summarizeWithGrok(input, expectedLanguageCode)
      : await summarizeWithAnthropic(input, expectedLanguageCode);

    const consumeResult = await consumeTokensAtomic(supabase, user.id, entitlement.required);
    return NextResponse.json({
      provider,
      ...result,
      tokensRemaining: consumeResult.available,
      tokensLimit: consumeResult.limit,
      planTier: consumeResult.tier,
      unlimitedAiAccess: consumeResult.unlimitedAiAccess || false,
    });
  } catch (primaryError) {
    const fallbackProvider = provider === 'anthropic' ? 'grok' : 'anthropic';

    try {
      const fallback = fallbackProvider === 'grok'
        ? await summarizeWithGrok(input, expectedLanguageCode)
        : await summarizeWithAnthropic(input, expectedLanguageCode);
      const consumeResult = await consumeTokensAtomic(supabase, user.id, entitlement.required);
      return NextResponse.json({
        provider: fallbackProvider,
        ...fallback,
        tokensRemaining: consumeResult.available,
        tokensLimit: consumeResult.limit,
        planTier: consumeResult.tier,
        unlimitedAiAccess: consumeResult.unlimitedAiAccess || false,
      });
    } catch (fallbackError) {
      const primaryMessage = serializeError(primaryError);
      const fallbackMessage = serializeError(fallbackError);

      console.error('AI summarize failed:', primaryMessage, fallbackMessage);
      return NextResponse.json(
        {
          error: 'Failed to generate TL;DR with configured providers',
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

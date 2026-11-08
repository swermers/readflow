export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkEntitlement, consumeTokensAtomic, format402Payload } from '@/utils/aiEntitlements';
import { chatCompletion, OpenRouterError, parseJsonFromText } from '@/utils/openrouter';
import { checkRateLimit, rateLimitResponse } from '@/utils/rateLimit';

import type { SignalTier } from '@/utils/signalSortHeuristics';

type SummaryResult = {
  summary: string;
  takeaways: string[];
  signal_tier?: SignalTier;
  signal_reason?: string;
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


function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VALID_SIGNAL_TIERS: SignalTier[] = ['high_signal', 'news', 'reference', 'unclassified'];

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

  const rawTier = typeof obj.signal_tier === 'string' ? obj.signal_tier.trim().toLowerCase() : '';
  const signal_tier = VALID_SIGNAL_TIERS.includes(rawTier as SignalTier)
    ? (rawTier as SignalTier)
    : undefined;
  const signal_reason = signal_tier && typeof obj.signal_reason === 'string'
    ? obj.signal_reason.trim().slice(0, 120)
    : undefined;

  return { summary, takeaways, signal_tier, signal_reason };
}

async function summarizeWithOpenRouter(input: string, expectedLanguageCode: string) {
  const languageLabel = LANGUAGE_LABELS[expectedLanguageCode] || 'English';
  const prompt = `You are helping summarize a newsletter article for a reader app.\nThe article language is ${languageLabel} (${expectedLanguageCode}).\nWrite summary and takeaways ONLY in ${languageLabel}. Never translate to another language.\nRespond ONLY as strict JSON with keys: summary (string), takeaways (array of 3 concise strings), signal_tier (string), signal_reason (string).\n\nFor signal_tier, classify this newsletter into exactly one of:\n- high_signal: Actionable strategies, deep analysis, original research, frameworks\n- news: Daily/weekly recaps, headlines, roundups, timely updates\n- reference: Guides, tutorials, evergreen resources, documentation\n- unclassified: Promotions, thin content, or unclear fit\n\nFor signal_reason, write a short phrase (under 12 words) explaining why.\n\nArticle:\n${input}`;

  const { text, model } = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 600,
    temperature: 0.2,
    json: true,
  });

  const parsed = normalizeSummaryPayload(parseJsonFromText(text));
  if (!parsed) throw new Error('Summary parsing failed');
  assertSummaryLanguage(parsed, expectedLanguageCode);
  return { result: parsed, model };
}

/**
 * GET /api/ai/summarize?issueId=...
 * Check for a cached summary without generating or consuming tokens.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const issueId = request.nextUrl.searchParams.get('issueId');
  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  const { data: cached } = await supabase
    .from('issue_summaries')
    .select('summary, takeaways, provider')
    .eq('issue_id', issueId)
    .maybeSingle();

  if (cached?.summary && Array.isArray(cached.takeaways)) {
    return NextResponse.json({
      provider: cached.provider || 'cached',
      summary: cached.summary,
      takeaways: cached.takeaways,
      cached: true,
    });
  }

  return NextResponse.json({ cached: false });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 10 AI summary requests per minute per user
  const rl = checkRateLimit(`summarize:${user.id}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  const body = await request.json();
  const issueId = body?.issueId as string | undefined;

  const entitlement = await checkEntitlement(supabase, user.id, "tldr");
  if (!entitlement.allowed) {
    return NextResponse.json(format402Payload(entitlement), { status: 402 });
  }

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  // Check for cached summary first (returns without consuming credits)
  const { data: cached } = await supabase
    .from('issue_summaries')
    .select('summary, takeaways, provider')
    .eq('issue_id', issueId)
    .maybeSingle();

  if (cached?.summary && Array.isArray(cached.takeaways)) {
    return NextResponse.json({
      provider: cached.provider || 'cached',
      summary: cached.summary,
      takeaways: cached.takeaways,
      cached: true,
      tokensRemaining: entitlement.available,
      tokensLimit: entitlement.limit,
      planTier: entitlement.tier,
    });
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

  // Two attempts: OpenRouter already fails over between models, so a retry
  // mainly covers malformed JSON or a summary in the wrong language.
  const errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { result, model } = await summarizeWithOpenRouter(input, expectedLanguageCode);
      const provider = `openrouter:${model}`;

      // Cache the summary for future requests (fire-and-forget)
      supabase
        .from('issue_summaries')
        .upsert({
          issue_id: issueId,
          user_id: user.id,
          summary: result.summary,
          takeaways: result.takeaways,
          provider,
        }, { onConflict: 'issue_id' })
        .then(() => {});

      // Upgrade signal classification with AI result (fire-and-forget)
      if (result.signal_tier) {
        supabase
          .from('issues')
          .update({
            signal_tier: result.signal_tier,
            signal_reason: result.signal_reason || null,
          })
          .eq('id', issueId)
          .eq('user_id', user.id)
          .then(() => {});
      }

      const consumeResult = await consumeTokensAtomic(supabase, user.id, entitlement.required, 'TL;DR summary');
      return NextResponse.json({
        provider,
        ...result,
        tokensRemaining: consumeResult.available,
        tokenBalance: consumeResult.available,
        planTier: consumeResult.tier,
        unlimitedAiAccess: consumeResult.unlimitedAiAccess || false,
      });
    } catch (err) {
      errors.push(serializeError(err));
      if (err instanceof OpenRouterError && (err.status === 401 || err.status === 402 || err.status === 0)) break;
    }
  }

  console.error('AI summarize failed:', errors.join(' | '));
  return NextResponse.json(
    { error: 'Failed to generate summary. Please try again later.' },
    { status: 500 }
  );
}

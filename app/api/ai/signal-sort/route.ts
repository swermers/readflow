export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { consumeTokensAtomic, ensureTokensAvailable, format402Payload } from '@/utils/aiEntitlements';
import { NextResponse } from 'next/server';
import { chatCompletion, hasOpenRouterKey, parseJsonFromText } from '@/utils/openrouter';

const MAX_ISSUES = 15;
const MAX_BODY_CHARS = 600;
const SORT_COST = 1;

type SignalTier = 'high_signal' | 'news' | 'reference' | 'unclassified';

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function normalizeTier(value: string): SignalTier {
  if (value === 'high_signal' || value === 'news' || value === 'reference') return value;
  return 'unclassified';
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gate = await ensureTokensAvailable(supabase, user.id, SORT_COST);
  if (!gate.allowed) {
    return NextResponse.json(format402Payload(gate), { status: 402 });
  }

  const { data: issues, error } = await supabase
    .from('issues')
    .select('id, subject, snippet, body_text, body_html')
    .eq('user_id', user.id)
    .eq('status', 'unread')
    .is('deleted_at', null)
    .order('received_at', { ascending: false })
    .limit(MAX_ISSUES);

  if (error) {
    return NextResponse.json({ error: 'Failed to load issues for signal sort' }, { status: 500 });
  }

  if (!issues || issues.length === 0) {
    return NextResponse.json({ sorted: 0, updates: [] });
  }

  const payload = issues
    .map((issue) => {
      const body = ((issue.body_text || '').trim() || stripHtml(issue.body_html || '')).slice(0, MAX_BODY_CHARS);
      return {
        id: issue.id,
        subject: issue.subject || 'Untitled',
        snippet: issue.snippet || '',
        body,
      };
    });

  if (!hasOpenRouterKey()) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 });
  }

  const prompt = `Classify each newsletter item into one tier: high_signal, news, or reference.\n- high_signal: likely actionable, strategic, or deeply relevant\n- news: timely updates worth scanning\n- reference: evergreen, optional, archive-worthy\nReturn STRICT JSON array with objects: { id, tier, reason } where reason is <= 12 words.\n\nItems:\n${JSON.stringify(payload)}`;

  let text: string;
  try {
    ({ text } = await chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
      temperature: 0.1,
    }));
  } catch (error) {
    console.error('Signal sort failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Signal sort failed' }, { status: 500 });
  }

  let parsedClassifications: unknown;
  try {
    parsedClassifications = parseJsonFromText(text);
  } catch {
    return NextResponse.json({ error: 'Signal sort returned unreadable output' }, { status: 500 });
  }
  const classifications = (Array.isArray(parsedClassifications) ? parsedClassifications : []) as Array<{ id?: string; tier?: string; reason?: string }>;

  const updates = classifications
    .filter((c) => typeof c.id === 'string' && c.id)
    .map((c) => ({
      id: c.id as string,
      signal_tier: normalizeTier(String(c.tier || 'unclassified')),
      signal_reason: typeof c.reason === 'string' ? c.reason.slice(0, 180) : null,
    }));

  for (const row of updates) {
    await supabase
      .from('issues')
      .update({ signal_tier: row.signal_tier, signal_reason: row.signal_reason })
      .eq('id', row.id)
      .eq('user_id', user.id);
  }

  const consume = await consumeTokensAtomic(supabase, user.id, SORT_COST, 'Signal sort');

  return NextResponse.json({
    sorted: updates.length,
    updates,
    tokensRemaining: consume.remaining,
    tokensLimit: consume.limit,
    planTier: consume.tier,
    unlimitedAiAccess: consume.unlimitedAiAccess || false,
  });
}

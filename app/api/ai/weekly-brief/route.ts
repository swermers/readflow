export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { consumeCreditsAtomic, ensureCreditsAvailable } from '@/utils/aiEntitlements';
import { NextRequest, NextResponse } from 'next/server';

type WeeklyBrief = {
  overview: string;
  themes: Array<{
    title: string;
    consensus: string;
    sourceCount: number;
  }>;
};

const MAX_ISSUES = 20;
const MAX_BODY_CHARS = 1200;
const WEEKLY_BRIEF_COST = 5;

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonFromText(text: string) {
  const direct = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(direct);
  } catch {
    const firstBrace = direct.indexOf('{');
    const lastBrace = direct.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(direct.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Could not parse JSON payload');
  }
}

function normalize(payload: unknown): WeeklyBrief | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const overview = typeof obj.overview === 'string' ? obj.overview.trim() : '';

  const themesRaw = Array.isArray(obj.themes) ? obj.themes : [];
  const themes = themesRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const t = item as Record<string, unknown>;
      const title = typeof t.title === 'string' ? t.title.trim() : '';
      const consensus = typeof t.consensus === 'string' ? t.consensus.trim() : '';
      const sourceCount = typeof t.sourceCount === 'number' ? t.sourceCount : 0;
      if (!title || !consensus) return null;
      return { title, consensus, sourceCount: Math.max(1, Math.floor(sourceCount || 1)) };
    })
    .filter(Boolean) as WeeklyBrief['themes'];

  if (!overview || themes.length === 0) return null;
  return { overview, themes: themes.slice(0, 5) };
}

async function summarizeWithAnthropic(input: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic key is not configured');

  const prompt = `You are building a weekly cross-newsletter brief for a busy knowledge worker.\nReturn STRICT JSON with:\n- overview: string (2-4 concise sentences)\n- themes: array of 3-5 objects, each { title: string, consensus: string, sourceCount: number }\n\nFocus on synthesis across sources, not summary per newsletter.\n\nNewsletters:\n${input}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 800,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic weekly brief failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const textBlock = Array.isArray(data?.content)
    ? data.content.find((block: any) => block?.type === 'text' && typeof block?.text === 'string')
    : null;

  const text = textBlock?.text;
  if (typeof text !== 'string') throw new Error('Anthropic response missing text');

  const normalized = normalize(parseJsonFromText(text));
  if (!normalized) throw new Error('Invalid weekly brief payload');
  return normalized;
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gate = await ensureCreditsAvailable(supabase, user.id, WEEKLY_BRIEF_COST);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.reason || 'Monthly AI credit limit reached',
        creditsRemaining: gate.remaining,
        creditsLimit: gate.limit,
        planTier: gate.tier,
        resetsAt: gate.resetAt,
      },
      { status: 402 }
    );
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: issues, error } = await supabase
    .from('issues')
    .select('id, subject, body_text, body_html, senders(name)')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .gte('received_at', sevenDaysAgo)
    .order('received_at', { ascending: false })
    .limit(MAX_ISSUES);

  if (error) {
    return NextResponse.json({ error: 'Could not load issues for weekly brief' }, { status: 500 });
  }

  if (!issues || issues.length < 2) {
    return NextResponse.json(
      { error: 'Need at least 2 recent issues to generate a weekly brief.' },
      { status: 400 }
    );
  }

  const digestInput = issues
    .map((issue) => {
      const senderName = (issue as any)?.senders?.name || 'Unknown sender';
      const text = ((issue.body_text || '').trim() || stripHtml(issue.body_html || '')).slice(0, MAX_BODY_CHARS);
      return `Sender: ${senderName}\nSubject: ${issue.subject || 'Untitled'}\nBody: ${text}`;
    })
    .join('\n\n---\n\n');

  try {
    const brief = await summarizeWithAnthropic(digestInput);
    const consume = await consumeCreditsAtomic(supabase, user.id, WEEKLY_BRIEF_COST);
    if (!consume.allowed) {
      return NextResponse.json(
        {
          error: consume.reason || 'Monthly AI credit limit reached',
          creditsRemaining: consume.remaining,
          creditsLimit: consume.limit,
          planTier: consume.tier,
          resetsAt: consume.resetAt,
          unlimitedAiAccess: consume.unlimitedAiAccess || false,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      ...brief,
      creditsRemaining: consume.remaining,
      creditsLimit: consume.limit,
      planTier: consume.tier,
      unlimitedAiAccess: consume.unlimitedAiAccess || false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate weekly brief';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

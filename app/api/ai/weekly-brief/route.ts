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

type BriefRow = {
  overview: string;
  themes: unknown;
  created_at: string;
  week_start: string;
  week_end: string;
  auto_generated: boolean;
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

function startOfWeekUTC(input = new Date()) {
  const date = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getLastCompletedWeekRange() {
  const currentWeekStart = startOfWeekUTC();
  const weekEnd = currentWeekStart;
  const weekStart = new Date(currentWeekStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  return {
    weekStartDate: toISODate(weekStart),
    weekEndDate: toISODate(weekEnd),
    nextEligibleAt: currentWeekStart.toISOString(),
  };
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

async function getExistingForWeek(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, weekStartDate: string) {
  const { data } = await supabase
    .from('weekly_briefs')
    .select('overview, themes, created_at, week_start, week_end, auto_generated')
    .eq('user_id', userId)
    .eq('week_start', weekStartDate)
    .maybeSingle();

  return (data || null) as BriefRow | null;
}

async function generateWeeklyBriefForWindow(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  autoGenerated: boolean;
}) {
  const { supabase, userId, weekStartDate, weekEndDate, autoGenerated } = params;

  const existing = await getExistingForWeek(supabase, userId, weekStartDate);
  if (existing) {
    const brief = normalize({ overview: existing.overview, themes: existing.themes });
    return {
      brief,
      createdAt: existing.created_at,
      credits: null,
      autoGenerated: existing.auto_generated,
      generatedNow: false,
    };
  }

  const gate = await ensureCreditsAvailable(supabase, userId, WEEKLY_BRIEF_COST);
  if (!gate.allowed) {
    return {
      brief: null,
      createdAt: null,
      generatedNow: false,
      autoGenerated,
      credits: {
        blocked: true,
        reason: gate.reason || 'Monthly AI credit limit reached',
        remaining: gate.remaining,
        limit: gate.limit,
        tier: gate.tier,
        unlimitedAiAccess: gate.unlimitedAiAccess || false,
      },
    };
  }

  const { data: issues, error } = await supabase
    .from('issues')
    .select('id, subject, body_text, body_html, senders(name)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('received_at', `${weekStartDate}T00:00:00.000Z`)
    .lt('received_at', `${weekEndDate}T00:00:00.000Z`)
    .order('received_at', { ascending: false })
    .limit(MAX_ISSUES);

  if (error) {
    throw new Error('Could not load issues for weekly brief');
  }

  if (!issues || issues.length < 2) {
    return {
      brief: null,
      createdAt: null,
      generatedNow: false,
      autoGenerated,
      credits: null,
      tooFewIssues: true,
    };
  }

  const digestInput = issues
    .map((issue) => {
      const senderName = (issue as any)?.senders?.name || 'Unknown sender';
      const text = ((issue.body_text || '').trim() || stripHtml(issue.body_html || '')).slice(0, MAX_BODY_CHARS);
      return `Sender: ${senderName}\nSubject: ${issue.subject || 'Untitled'}\nBody: ${text}`;
    })
    .join('\n\n---\n\n');

  const brief = await summarizeWithAnthropic(digestInput);
  const consume = await consumeCreditsAtomic(supabase, userId, WEEKLY_BRIEF_COST);
  if (!consume.allowed) {
    return {
      brief: null,
      createdAt: null,
      generatedNow: false,
      autoGenerated,
      credits: {
        blocked: true,
        reason: consume.reason || 'Monthly AI credit limit reached',
        remaining: consume.remaining,
        limit: consume.limit,
        tier: consume.tier,
        unlimitedAiAccess: consume.unlimitedAiAccess || false,
      },
    };
  }

  const { error: insertError } = await supabase.from('weekly_briefs').insert({
    user_id: userId,
    overview: brief.overview,
    themes: brief.themes,
    source_issue_count: issues.length,
    week_start: weekStartDate,
    week_end: weekEndDate,
    auto_generated: autoGenerated,
  });

  if (insertError) {
    const fallback = await getExistingForWeek(supabase, userId, weekStartDate);
    if (fallback) {
      return {
        brief: normalize({ overview: fallback.overview, themes: fallback.themes }),
        createdAt: fallback.created_at,
        generatedNow: false,
        autoGenerated: fallback.auto_generated,
        credits: {
          blocked: false,
          remaining: consume.remaining,
          limit: consume.limit,
          tier: consume.tier,
          unlimitedAiAccess: consume.unlimitedAiAccess || false,
        },
      };
    }
  }

  return {
    brief,
    createdAt: new Date().toISOString(),
    generatedNow: true,
    autoGenerated,
    credits: {
      blocked: false,
      remaining: consume.remaining,
      limit: consume.limit,
      tier: consume.tier,
      unlimitedAiAccess: consume.unlimitedAiAccess || false,
    },
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { weekStartDate, weekEndDate, nextEligibleAt } = getLastCompletedWeekRange();

  try {
    const result = await generateWeeklyBriefForWindow({
      supabase,
      userId: user.id,
      weekStartDate,
      weekEndDate,
      autoGenerated: true,
    });

    return NextResponse.json({
      brief: result.brief
        ? {
            ...result.brief,
            createdAt: result.createdAt,
          }
        : null,
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      autoGenerated: result.autoGenerated,
      generatedNow: result.generatedNow,
      canGenerateNew: false,
      nextEligibleAt,
      tooFewIssues: (result as any).tooFewIssues || false,
      creditsRemaining: result.credits?.remaining,
      creditsLimit: result.credits?.limit,
      planTier: result.credits?.tier,
      unlimitedAiAccess: result.credits?.unlimitedAiAccess || false,
      creditBlockedReason: result.credits?.blocked ? result.credits.reason : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not load weekly brief';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { weekStartDate, weekEndDate, nextEligibleAt } = getLastCompletedWeekRange();

  try {
    const existing = await getExistingForWeek(supabase, user.id, weekStartDate);
    if (existing) {
      return NextResponse.json(
        {
          error: 'This weekly insight is already generated. A new one unlocks next Monday.',
          nextEligibleAt,
          weekStart: weekStartDate,
          weekEnd: weekEndDate,
        },
        { status: 409 }
      );
    }

    const result = await generateWeeklyBriefForWindow({
      supabase,
      userId: user.id,
      weekStartDate,
      weekEndDate,
      autoGenerated: false,
    });

    if (result.credits?.blocked) {
      return NextResponse.json(
        {
          error: result.credits.reason,
          creditsRemaining: result.credits.remaining,
          creditsLimit: result.credits.limit,
          planTier: result.credits.tier,
          unlimitedAiAccess: result.credits.unlimitedAiAccess,
          nextEligibleAt,
        },
        { status: 402 }
      );
    }

    if ((result as any).tooFewIssues) {
      return NextResponse.json(
        { error: 'Need at least 2 issues in last week to generate this insight.', nextEligibleAt },
        { status: 400 }
      );
    }

    if (!result.brief) {
      return NextResponse.json({ error: 'Failed to generate weekly brief' }, { status: 500 });
    }

    return NextResponse.json({
      ...result.brief,
      createdAt: result.createdAt,
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      nextEligibleAt,
      creditsRemaining: result.credits?.remaining,
      creditsLimit: result.credits?.limit,
      planTier: result.credits?.tier,
      unlimitedAiAccess: result.credits?.unlimitedAiAccess || false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate weekly brief';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

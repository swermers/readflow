export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const issueId = params.id;
  const body = await request.json().catch(() => ({}));
  const feedbackType = body?.feedbackType === 'not_relevant' ? 'not_relevant' : null;

  if (!issueId || !feedbackType) {
    return NextResponse.json({ error: 'feedbackType=not_relevant is required' }, { status: 400 });
  }

  const { data: issue, error: issueError } = await supabase
    .from('issues')
    .select('id, from_email')
    .eq('id', issueId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (issueError || !issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const { data: highlights } = await supabase
    .from('highlights')
    .select('auto_tags')
    .eq('user_id', user.id)
    .eq('issue_id', issueId)
    .limit(30);

  const tags = Array.from(
    new Set(
      (highlights || [])
        .flatMap((row: any) => (Array.isArray(row.auto_tags) ? row.auto_tags : []))
        .filter((tag: unknown): tag is string => typeof tag === 'string' && tag.length > 0),
    ),
  ).slice(0, 20);

  const { error } = await supabase.from('user_article_feedback').insert({
    user_id: user.id,
    issue_id: issueId,
    sender_email: issue.from_email || null,
    feedback_type: feedbackType,
    auto_tags: tags,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

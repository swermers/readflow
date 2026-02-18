import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const ALLOWED_EVENTS = new Set([
  'issue_opened',
  'tldr_generated',
  'listen_started',
  'listen_completed',
  'highlight_created',
  'note_created',
  'issue_archived',
  'issue_deleted',
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    issueId?: string;
    senderEmail?: string;
    eventType?: string;
    metadata?: Record<string, unknown>;
  } | null;

  if (!body?.eventType || !ALLOWED_EVENTS.has(body.eventType)) {
    return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
  }

  const { error } = await supabase.from('user_issue_events').insert({
    user_id: user.id,
    issue_id: body.issueId || null,
    sender_email: body.senderEmail || null,
    event_type: body.eventType,
    metadata: body.metadata || null,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

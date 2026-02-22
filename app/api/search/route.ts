import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/utils/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`search:${user.id}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [], total: 0 });
  }

  // Sanitize: strip characters that could break tsquery parsing
  const sanitized = query.replace(/[<>\\;'"]/g, '').slice(0, 200);

  try {
    // Use the RPC function for full-text search with ranking
    const { data, error } = await supabase.rpc('search_issues', {
      p_user_id: user.id,
      p_query: sanitized,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      // Fallback to ilike search if RPC not yet available (migration not applied)
      console.warn('search_issues RPC failed, falling back to ilike:', error.message);
      return fallbackSearch(supabase, user.id, sanitized, limit, offset);
    }

    return NextResponse.json({
      results: data || [],
      total: (data || []).length,
      query: sanitized,
    });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}

async function fallbackSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  query: string,
  limit: number,
  offset: number,
) {
  // Simple ilike fallback for environments without the RPC function
  const safeTerm = query.replace(/[,%().*\\]/g, '');
  if (!safeTerm) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const { data, error } = await supabase
    .from('issues')
    .select('id, subject, snippet, from_email, received_at, status, senders(name)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or(`subject.ilike.%${safeTerm}%,snippet.ilike.%${safeTerm}%`)
    .order('received_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }

  const results = (data || []).map((item: any) => ({
    id: item.id,
    subject: item.subject,
    snippet: item.snippet,
    from_email: item.from_email,
    received_at: item.received_at,
    status: item.status,
    sender_name: item.senders?.name || null,
    rank: 0,
  }));

  return NextResponse.json({ results, total: results.length, query: safeTerm });
}

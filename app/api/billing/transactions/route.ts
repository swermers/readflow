export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = Math.min(50, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10));
  const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') || '0', 10));

  const { data: transactions, error } = await supabase
    .from('token_transactions')
    .select('id, amount, type, description, balance_after, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  // Also fetch current balance
  const { data: profile } = await supabase
    .from('profile_billing')
    .select('token_balance, unlimited_ai_access')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    balance: profile?.token_balance ?? 0,
    unlimited: Boolean(profile?.unlimited_ai_access),
    transactions: transactions || [],
  });
}

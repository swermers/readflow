export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { checkEntitlement, format402Payload } from '@/utils/aiEntitlements';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.NOTION_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !appUrl) {
    return NextResponse.json({ error: 'Missing Notion OAuth configuration' }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entitlement = await checkEntitlement(supabase, user.id, 'notion_sync');
  if (!entitlement.allowed) {
    return NextResponse.json(format402Payload(entitlement), { status: 402 });
  }

  const state = crypto.randomBytes(24).toString('hex');
  const redirectUri = `${appUrl}/api/notion/oauth/callback`;

  const authorizeUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('owner', 'user');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set('notion_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}

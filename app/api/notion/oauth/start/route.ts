export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomBytes } from 'crypto';
import { checkEntitlement } from '@/utils/aiEntitlements';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const STATE_COOKIE = 'notion_oauth_state';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entitlement = await checkEntitlement(supabase, user.id, 'notion_sync');
  if (!entitlement.allowed) {
    return NextResponse.json({ error: 'Notion sync requires elite plan' }, { status: 402 });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !appUrl) {
    return NextResponse.json({ error: 'Missing Notion OAuth configuration' }, { status: 500 });
  }

  const state = randomBytes(24).toString('hex');
  const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/notion/oauth/callback`;
  const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('owner', 'user');
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('state', state);

  cookies().set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(authUrl);
}

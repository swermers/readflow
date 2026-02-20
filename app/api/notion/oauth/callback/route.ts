export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkEntitlement } from '@/utils/aiEntitlements';
import { enqueueJob } from '@/utils/jobs';
import { encryptNotionToken } from '@/utils/notionCrypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const STATE_COOKIE = 'notion_oauth_state';

function appRedirect(path: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const base = appUrl?.replace(/\/$/, '') || 'http://localhost:3000';
  return `${base}${path}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = cookies().get(STATE_COOKIE)?.value;

  cookies().delete(STATE_COOKIE);

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(appRedirect('/settings?notion=state_error'));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(appRedirect('/login?next=/settings&notion=auth_required'));
  }

  const entitlement = await checkEntitlement(supabase, user.id, 'notion_sync');
  if (!entitlement.allowed) {
    return NextResponse.redirect(appRedirect('/settings?notion=upgrade_required'));
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    return NextResponse.redirect(appRedirect('/settings?notion=config_error'));
  }

  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/notion/oauth/callback`;
  const encodedAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodedAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(appRedirect('/settings?notion=oauth_exchange_failed'));
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    workspace_id?: string;
    workspace_name?: string;
  };

  if (!tokenData.access_token) {
    return NextResponse.redirect(appRedirect('/settings?notion=token_missing'));
  }

  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({
      notion_access_token_enc: encryptNotionToken(tokenData.access_token),
      notion_workspace_id: tokenData.workspace_id || null,
      notion_workspace_name: tokenData.workspace_name || null,
      notion_connected_at: new Date().toISOString(),
      notion_sync_status: 'queued',
      notion_last_error: null,
    })
    .eq('id', user.id);

  await enqueueJob(admin, 'notion.sync', { userId: user.id }, `notion-sync:${user.id}`, { maxAttempts: 5 });

  return NextResponse.redirect(appRedirect('/settings?notion=connected'));
}

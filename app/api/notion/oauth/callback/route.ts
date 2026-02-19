export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { enqueueJob } from '@/utils/jobs';
import { encryptNotionToken } from '@/utils/notionCrypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type NotionOauthResponse = {
  access_token?: string;
  workspace_id?: string;
  workspace_name?: string;
  error?: string;
  message?: string;
};

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;

  if (!appUrl || !clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl || ''}/settings?notion=error&notion_error=oauth_config_missing`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const stateCookie = request.cookies.get('notion_oauth_state')?.value;

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const invalidStateResponse = NextResponse.redirect(`${appUrl}/settings?notion=error&notion_error=invalid_state`);
    invalidStateResponse.cookies.delete('notion_oauth_state');
    return invalidStateResponse;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const unauthorizedResponse = NextResponse.redirect(`${appUrl}/settings?notion=error&notion_error=unauthorized`);
    unauthorizedResponse.cookies.delete('notion_oauth_state');
    return unauthorizedResponse;
  }

  const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appUrl}/api/notion/oauth/callback`,
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => null)) as NotionOauthResponse | null;

  if (!tokenRes.ok || !tokenJson?.access_token) {
    const message = tokenJson?.message || tokenJson?.error || 'oauth_exchange_failed';
    const failureResponse = NextResponse.redirect(`${appUrl}/settings?notion=error&notion_error=${encodeURIComponent(message)}`);
    failureResponse.cookies.delete('notion_oauth_state');
    return failureResponse;
  }

  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({
      notion_connected: true,
      notion_workspace_id: tokenJson.workspace_id || null,
      notion_workspace_name: tokenJson.workspace_name || null,
      notion_access_token_encrypted: encryptNotionToken(tokenJson.access_token),
      notion_sync_status: 'queued',
      notion_last_sync_error: null,
    })
    .eq('id', user.id);

  await enqueueJob(admin, 'notion.sync', { userId: user.id, reason: 'oauth_connected' }, `notion-sync:${user.id}`);

  const successResponse = NextResponse.redirect(`${appUrl}/settings?notion=connected`);
  successResponse.cookies.delete('notion_oauth_state');
  return successResponse;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkEntitlement } from '@/utils/aiEntitlements';
import { enqueueJob } from '@/utils/jobs';
import { encryptNotionToken } from '@/utils/notionCrypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type OAuthStatePayload = {
  nonce: string;
  userId: string;
};

type NotionOauthResponse = {
  access_token?: string;
  workspace_id?: string;
  workspace_name?: string;
  workspace_icon?: string;
  bot_id?: string;
  error?: string;
  message?: string;
};

function decodeState(value: string): OAuthStatePayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (!decoded?.nonce || !decoded?.userId) return null;
    return decoded;
  } catch {
    return null;
  }
}

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

  const decodedState = state ? decodeState(state) : null;
  const decodedCookie = stateCookie ? decodeState(stateCookie) : null;

  if (
    !code ||
    !state ||
    !stateCookie ||
    state !== stateCookie ||
    !decodedState ||
    !decodedCookie ||
    decodedState.nonce !== decodedCookie.nonce
  ) {
    const invalidStateResponse = NextResponse.redirect(`${appUrl}/settings?notion=error&notion_error=invalid_state`);
    invalidStateResponse.cookies.delete('notion_oauth_state');
    return invalidStateResponse;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || decodedState.userId !== user.id) {
    const unauthorizedResponse = NextResponse.redirect(`${appUrl}/settings?notion=error&notion_error=unauthorized`);
    unauthorizedResponse.cookies.delete('notion_oauth_state');
    return unauthorizedResponse;
  }

  const entitlement = await checkEntitlement(supabase, user.id, 'notion_sync');
  if (!entitlement.allowed) {
    const blockedResponse = NextResponse.redirect(`${appUrl}/settings?notion=error&notion_error=elite_required`);
    blockedResponse.cookies.delete('notion_oauth_state');
    return blockedResponse;
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
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      notion_connected: true,
      notion_workspace_id: tokenJson.workspace_id || null,
      notion_workspace_name: tokenJson.workspace_name || null,
      notion_workspace_icon: tokenJson.workspace_icon || null,
      notion_bot_id: tokenJson.bot_id || null,
      notion_access_token_encrypted: encryptNotionToken(tokenJson.access_token),
      notion_sync_status: 'queued',
      notion_last_sync_error: null,
    })
    .eq('id', user.id);

  if (updateError) {
    const dbFailureResponse = NextResponse.redirect(`${appUrl}/settings?notion=error&notion_error=profile_update_failed`);
    dbFailureResponse.cookies.delete('notion_oauth_state');
    return dbFailureResponse;
  }

  await enqueueJob(admin, 'notion.sync', { userId: user.id, reason: 'oauth_connected' }, `notion-sync:${user.id}`);

  const successResponse = NextResponse.redirect(`${appUrl}/settings?notion=connected`);
  successResponse.cookies.delete('notion_oauth_state');
  return successResponse;
}

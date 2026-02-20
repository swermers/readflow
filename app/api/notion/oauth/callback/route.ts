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

function redirectWithError(appUrl: string, code: string) {
  return NextResponse.redirect(`${appUrl}/settings?notion=error&notion_error=${encodeURIComponent(code)}`);
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;

  if (!appUrl || !clientId || !clientSecret) {
    console.error('[notion-oauth/callback] missing oauth env config');
    return redirectWithError(appUrl || '', 'oauth_config_missing');
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
    console.warn('[notion-oauth/callback] invalid oauth state validation');
    const invalidStateResponse = redirectWithError(appUrl, 'invalid_state');
    invalidStateResponse.cookies.delete('notion_oauth_state');
    return invalidStateResponse;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || decodedState.userId !== user.id) {
    console.warn('[notion-oauth/callback] user mismatch on callback');
    const unauthorizedResponse = redirectWithError(appUrl, 'unauthorized');
    unauthorizedResponse.cookies.delete('notion_oauth_state');
    return unauthorizedResponse;
  }

  const entitlement = await checkEntitlement(supabase, user.id, 'notion_sync');
  if (!entitlement.allowed) {
    console.warn('[notion-oauth/callback] entitlement denied', { userId: user.id });
    const blockedResponse = redirectWithError(appUrl, 'elite_required');
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
    console.error('[notion-oauth/callback] token exchange failed', {
      status: tokenRes.status,
      message,
    });
    const failureResponse = redirectWithError(appUrl, message);
    failureResponse.cookies.delete('notion_oauth_state');
    return failureResponse;
  }

  try {
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        notion_access_token_encrypted: encryptNotionToken(tokenJson.access_token),
        notion_workspace_id: tokenJson.workspace_id || null,
        notion_workspace_name: tokenJson.workspace_name || null,
        notion_connected_at: new Date().toISOString(),
        notion_sync_status: 'queued',
        notion_last_error: null,
        notion_last_sync_at: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[notion-oauth/callback] profile update failed', updateError);
      const dbFailureResponse = redirectWithError(appUrl, 'profile_update_failed');
      dbFailureResponse.cookies.delete('notion_oauth_state');
      return dbFailureResponse;
    }

    await enqueueJob(admin, 'notion.sync', { userId: user.id, reason: 'oauth_connected' }, `notion-sync:${user.id}`);

    const successResponse = NextResponse.redirect(`${appUrl}/settings?notion=connected`);
    successResponse.cookies.delete('notion_oauth_state');
    return successResponse;
  } catch (error) {
    console.error('[notion-oauth/callback] unexpected callback error', error);
    const unexpectedFailureResponse = redirectWithError(appUrl, 'unexpected_error');
    unexpectedFailureResponse.cookies.delete('notion_oauth_state');
    return unexpectedFailureResponse;
  }
}

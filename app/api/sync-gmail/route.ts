import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { refreshAccessToken, listMessageIdsByLabel, getMessage } from '@/utils/gmailClient';
import { parseGmailMessage } from '@/utils/emailParser';
import { classifyIssueSignal } from '@/utils/signalSortHeuristics';
import { encryptToken, decryptToken, isEncryptedPayload } from '@/utils/tokenCrypto';
import { checkRateLimit, rateLimitResponse } from '@/utils/rateLimit';

export async function POST() {
  const supabase = await createClient();

  // Authenticate the user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!authError && user) {
    // Rate limit: 3 sync requests per minute per user
    const rl = checkRateLimit(`sync:${user.id}`, 3, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetMs);
  }
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the user's Gmail tokens and label preferences
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('gmail_access_token, gmail_refresh_token, gmail_token_expires_at, gmail_connected, gmail_sync_labels')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.gmail_refresh_token) {
    return NextResponse.json(
      { error: 'Gmail not connected. Please connect your Gmail account in Settings.' },
      { status: 400 }
    );
  }

  const syncLabels: string[] = profile.gmail_sync_labels || [];
  if (syncLabels.length === 0) {
    return NextResponse.json(
      { error: 'No labels selected. Go to Settings and choose which Gmail labels to sync.' },
      { status: 400 }
    );
  }

  try {
    // Decrypt refresh token (supports both encrypted and legacy plaintext tokens)
    const rawRefreshToken = profile.gmail_refresh_token;
    const refreshToken = isEncryptedPayload(rawRefreshToken)
      ? decryptToken(rawRefreshToken)
      : rawRefreshToken;

    // Refresh the access token (always refresh to ensure it's valid)
    const { accessToken, expiresAt } = await refreshAccessToken(refreshToken);

    // Store tokens encrypted at rest
    await supabase
      .from('profiles')
      .update({
        gmail_access_token: encryptToken(accessToken),
        gmail_refresh_token: isEncryptedPayload(rawRefreshToken) ? rawRefreshToken : encryptToken(refreshToken),
        gmail_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id);

    // List messages from all selected labels (up to 50 per label)
    const allMessageIds: string[] = [];
    for (const labelId of syncLabels) {
      const ids = await listMessageIdsByLabel(accessToken, labelId, 50);
      allMessageIds.push(...ids);
    }
    // Deduplicate (a message can have multiple labels)
    const messageIds = Array.from(new Set(allMessageIds));

    if (messageIds.length === 0) {
      // Update last sync time even if nothing found
      await supabase
        .from('profiles')
        .update({ gmail_last_sync_at: new Date().toISOString() })
        .eq('id', user.id);

      return NextResponse.json({ imported: 0, message: 'No new newsletters found' });
    }

    // Check which messages we've already imported
    const { data: existingIssues } = await supabase
      .from('issues')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);

    // Also exclude messages the user explicitly deleted
    const { data: deletedIssueRows } = await supabase
      .from('deleted_issues')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);

    const existingIds = new Set((existingIssues || []).map((i) => i.message_id));
    const deletedIds = new Set((deletedIssueRows || []).map((i) => i.message_id));
    const newMessageIds = messageIds.filter((id) => !existingIds.has(id) && !deletedIds.has(id));

    if (newMessageIds.length === 0) {
      await supabase
        .from('profiles')
        .update({ gmail_last_sync_at: new Date().toISOString() })
        .eq('id', user.id);

      return NextResponse.json({ imported: 0, message: 'All newsletters already imported' });
    }

    let imported = 0;
    let sourceLimitReached = false;

    // Fetch Gmail messages in parallel batches of 10 to avoid timeouts
    const BATCH_SIZE = 10;
    for (let i = 0; i < newMessageIds.length; i += BATCH_SIZE) {
      const batch = newMessageIds.slice(i, i + BATCH_SIZE);
      const fetchedMessages = await Promise.allSettled(
        batch.map((msgId) => getMessage(accessToken, msgId).then((msg) => ({ msgId, msg })))
      );

      for (const result of fetchedMessages) {
        if (result.status !== 'fulfilled') continue;
        const { msg: gmailMessage } = result.value;

        try {
          const parsed = parseGmailMessage(gmailMessage);

          // Find or create sender
          let { data: sender } = await supabase
            .from('senders')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('email', parsed.from_email)
            .single();

          if (!sender) {
            const { data: newSender, error: senderInsertError } = await supabase
              .from('senders')
              .insert({
                user_id: user.id,
                email: parsed.from_email,
                name: parsed.from_name,
                status: 'approved',
              })
              .select('id, status')
              .single();

            if (senderInsertError) {
              if (senderInsertError.message?.includes('Free plan supports up to 5 active sources.')) {
                sourceLimitReached = true;
                continue;
              }
              throw senderInsertError;
            }

            sender = newSender;
          }

          if (!sender) continue;

          const signal = classifyIssueSignal({
            subject: parsed.subject,
            snippet: parsed.snippet,
            bodyText: parsed.body_text,
          });

          // Insert the issue
          const { error: insertError } = await supabase.from('issues').insert({
            user_id: user.id,
            sender_id: sender.id,
            subject: parsed.subject,
            snippet: parsed.snippet,
            body_html: parsed.body_html,
            body_text: parsed.body_text,
            from_email: parsed.from_email,
            message_id: parsed.message_id,
            received_at: parsed.received_at,
            status: 'unread',
            signal_tier: signal.tier,
            signal_reason: signal.reason,
          });

          if (!insertError) {
            imported++;
          }
        } catch (msgError) {
          console.error(`Failed to import message:`, msgError);
        }
      }
    }

    // Update last sync time
    await supabase
      .from('profiles')
      .update({ gmail_last_sync_at: new Date().toISOString() })
      .eq('id', user.id);

    const responsePayload: Record<string, unknown> = {
      imported,
      message: imported > 0
        ? `Imported ${imported} new newsletter${imported === 1 ? '' : 's'}`
        : 'No new newsletters to import',
    };

    if (sourceLimitReached) {
      responsePayload.warning = 'Some sources were skipped due to plan limits.';
      responsePayload.code = 'SOURCE_LIMIT_REACHED';
    }

    return NextResponse.json(responsePayload);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Gmail sync error:', message);

    // If token refresh failed, mark Gmail as disconnected
    if (message.includes('Token refresh failed')) {
      await supabase
        .from('profiles')
        .update({
          gmail_connected: false,
          gmail_access_token: null,
          gmail_refresh_token: null,
        })
        .eq('id', user.id);

      return NextResponse.json(
        { error: 'Gmail token expired. Please reconnect your Gmail account.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Sync failed. Please try again or reconnect your Gmail account.' },
      { status: 500 }
    );
  }
}

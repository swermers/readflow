import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';
import { refreshAccessToken, listMessageIdsByLabel, getMessage } from '@/utils/gmailClient';
import { parseGmailMessage } from '@/utils/emailParser';
import { classifyIssueSignal } from '@/utils/signalSortHeuristics';
import { checkRateLimit, rateLimitResponse } from '@/utils/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Accept GET as well — some domain/CDN redirects (301) convert POST to GET.
export async function GET() {
  return handleSync();
}

export async function POST() {
  return handleSync();
}

async function handleSync() {
  const syncStart = Date.now();

  let supabase;
  try {
    supabase = await createClient();
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : String(initErr);
    console.error('[Sync] createClient() threw:', msg);
    return NextResponse.json(
      { error: 'Server initialization failed', debug: { phase: 'createClient', message: msg } },
      { status: 500 }
    );
  }

  // Authenticate the user
  let user;
  try {
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data?.user) {
      console.warn('[Sync] Auth failed:', authError?.message || 'no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    user = data.user;
  } catch (authErr) {
    const msg = authErr instanceof Error ? authErr.message : String(authErr);
    console.error('[Sync] auth.getUser() threw:', msg);
    return NextResponse.json(
      { error: 'Authentication error', debug: { phase: 'auth', message: msg } },
      { status: 500 }
    );
  }

  // Rate limit: 3 sync requests per minute per user
  const rl = checkRateLimit(`sync:${user.id}`, 3, 60_000);
  if (!rl.allowed) {
    console.warn(`[Sync] Rate limited user=${user.id} resetMs=${rl.resetMs}`);
    return rateLimitResponse(rl.resetMs);
  }

  console.log(`[Sync] Starting sync for user=${user.id}`);

  // Use admin client for DB writes to bypass RLS issues
  let db: ReturnType<typeof createAdminClient>;
  let usingAdmin = false;
  try {
    db = createAdminClient();
    usingAdmin = true;
  } catch {
    console.warn('[Sync] Admin client unavailable, falling back to server client');
    db = supabase as any;
  }

  // Get the user's Gmail tokens and label preferences
  let profile;
  try {
    const { data, error: profileError } = await db
      .from('profiles')
      .select('gmail_access_token, gmail_refresh_token, gmail_token_expires_at, gmail_connected, gmail_sync_labels')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error(`[Sync] Profile read error user=${user.id}:`, profileError.message);
      return NextResponse.json(
        { error: 'Could not read profile. Please try again.', debug: { phase: 'profile', message: profileError.message } },
        { status: 500 }
      );
    }
    profile = data;
  } catch (profileErr) {
    const msg = profileErr instanceof Error ? profileErr.message : String(profileErr);
    console.error('[Sync] Profile query threw:', msg);
    return NextResponse.json(
      { error: 'Database error', debug: { phase: 'profileQuery', message: msg } },
      { status: 500 }
    );
  }

  if (!profile?.gmail_refresh_token) {
    console.warn(`[Sync] No refresh token user=${user.id} gmail_connected=${profile?.gmail_connected}`);
    return NextResponse.json(
      { error: 'Gmail not connected. Please connect your Gmail account in Settings.' },
      { status: 400 }
    );
  }

  const syncLabels: string[] = profile.gmail_sync_labels || [];
  if (syncLabels.length === 0) {
    console.warn(`[Sync] No labels selected user=${user.id}`);
    return NextResponse.json(
      { error: 'No labels selected. Go to Settings and choose which Gmail labels to sync.' },
      { status: 400 }
    );
  }

  console.log(`[Sync] user=${user.id} labels=${JSON.stringify(syncLabels)} adminClient=${usingAdmin}`);

  try {
    const refreshToken = profile.gmail_refresh_token;

    // Refresh the access token (always refresh to ensure it's valid)
    const { accessToken, expiresAt } = await refreshAccessToken(refreshToken);
    console.log(`[Sync] Token refreshed user=${user.id} expiresAt=${expiresAt.toISOString()}`);

    // Store the refreshed access token
    const { error: tokenUpdateErr } = await db
      .from('profiles')
      .update({
        gmail_access_token: accessToken,
        gmail_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id);

    if (tokenUpdateErr) {
      console.error(`[Sync] Token update failed user=${user.id}:`, tokenUpdateErr.message);
    }

    // List messages from all selected labels (up to 50 per label)
    const allMessageIds: string[] = [];
    const failedLabels: string[] = [];
    const labelCounts: Record<string, number> = {};

    for (const labelId of syncLabels) {
      try {
        const ids = await listMessageIdsByLabel(accessToken, labelId, 50);
        labelCounts[labelId] = ids.length;
        allMessageIds.push(...ids);
      } catch (labelError) {
        const errMsg = labelError instanceof Error ? labelError.message : String(labelError);
        console.error(`[Sync] Label list failed user=${user.id} label=${labelId}: ${errMsg}`);
        failedLabels.push(labelId);
        labelCounts[labelId] = -1;
      }
    }

    console.log(`[Sync] Label results user=${user.id}: ${JSON.stringify(labelCounts)} totalRaw=${allMessageIds.length} failed=${failedLabels.length}`);

    // Deduplicate (a message can have multiple labels)
    const messageIds = Array.from(new Set(allMessageIds));
    console.log(`[Sync] After dedup user=${user.id}: ${messageIds.length} unique messages`);

    if (messageIds.length === 0) {
      // Update last sync time even if nothing found
      await db
        .from('profiles')
        .update({ gmail_last_sync_at: new Date().toISOString() })
        .eq('id', user.id);

      if (failedLabels.length === syncLabels.length) {
        console.error(`[Sync] ALL labels failed user=${user.id} labels=${JSON.stringify(syncLabels)}`);
        return NextResponse.json(
          {
            error: 'Selected Gmail labels are unavailable. Please refresh labels in Settings and save again.',
            code: 'INVALID_SYNC_LABELS',
            debug: { labels: syncLabels, failedLabels, labelCounts },
          },
          { status: 400 }
        );
      }

      console.log(`[Sync] No messages found user=${user.id} elapsed=${Date.now() - syncStart}ms`);
      return NextResponse.json({
        imported: 0,
        message: 'No new newsletters found',
        debug: { labels: syncLabels, labelCounts, failedLabels },
        warning: failedLabels.length ? 'Some labels could not be synced. Refresh labels in Settings.' : undefined,
      });
    }

    // Check which messages we've already imported
    const { data: existingIssues, error: existingErr } = await db
      .from('issues')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);

    if (existingErr) {
      console.error(`[Sync] Existing issues query failed user=${user.id}:`, existingErr.message);
    }

    // Also exclude messages the user explicitly deleted
    const { data: deletedIssueRows, error: deletedErr } = await db
      .from('deleted_issues')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);

    if (deletedErr) {
      console.error(`[Sync] Deleted issues query failed user=${user.id}:`, deletedErr.message);
    }

    const existingIds = new Set((existingIssues || []).map((i) => i.message_id));
    const deletedIds = new Set((deletedIssueRows || []).map((i) => i.message_id));
    const newMessageIds = messageIds.filter((id) => !existingIds.has(id) && !deletedIds.has(id));

    console.log(`[Sync] Dedup check user=${user.id}: total=${messageIds.length} existing=${existingIds.size} deleted=${deletedIds.size} new=${newMessageIds.length}`);

    if (newMessageIds.length === 0) {
      await db
        .from('profiles')
        .update({ gmail_last_sync_at: new Date().toISOString() })
        .eq('id', user.id);

      return NextResponse.json({
        imported: 0,
        message: 'All newsletters already imported',
        debug: {
          labels: syncLabels,
          labelCounts,
          gmailMessages: messageIds.length,
          alreadyImported: existingIds.size,
          previouslyDeleted: deletedIds.size,
        },
      });
    }

    let imported = 0;
    let skippedErrors = 0;
    let sourceLimitReached = false;

    // Fetch Gmail messages in parallel batches of 10 to avoid timeouts
    const BATCH_SIZE = 10;
    for (let i = 0; i < newMessageIds.length; i += BATCH_SIZE) {
      const batch = newMessageIds.slice(i, i + BATCH_SIZE);
      const fetchedMessages = await Promise.allSettled(
        batch.map((msgId) => getMessage(accessToken, msgId).then((msg) => ({ msgId, msg })))
      );

      for (const result of fetchedMessages) {
        if (result.status !== 'fulfilled') {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.error(`[Sync] getMessage rejected user=${user.id}: ${reason}`);
          skippedErrors++;
          continue;
        }
        const { msgId, msg: gmailMessage } = result.value;

        try {
          const parsed = parseGmailMessage(gmailMessage);

          // Find or create sender
          let { data: sender, error: senderQueryErr } = await db
            .from('senders')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('email', parsed.from_email)
            .single();

          if (senderQueryErr && senderQueryErr.code !== 'PGRST116') {
            // PGRST116 = "no rows returned" which is expected for new senders
            console.error(`[Sync] Sender query error user=${user.id} email=${parsed.from_email}:`, senderQueryErr.message);
          }

          if (!sender) {
            const { data: newSender, error: senderInsertError } = await db
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
              console.error(`[Sync] Sender insert error user=${user.id} email=${parsed.from_email}:`, senderInsertError.message);
              throw senderInsertError;
            }

            sender = newSender;
          }

          if (!sender) {
            console.error(`[Sync] Sender null after insert user=${user.id} email=${parsed.from_email}`);
            skippedErrors++;
            continue;
          }

          const signal = classifyIssueSignal({
            subject: parsed.subject,
            snippet: parsed.snippet,
            bodyText: parsed.body_text,
          });

          // Insert the issue
          const { error: insertError } = await db.from('issues').insert({
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

          if (insertError) {
            console.error(`[Sync] Issue insert error user=${user.id} msgId=${msgId}: ${insertError.message}`);
            skippedErrors++;
          } else {
            imported++;
          }
        } catch (msgError) {
          const errMsg = msgError instanceof Error ? msgError.message : String(msgError);
          console.error(`[Sync] Failed to import message user=${user.id} msgId=${msgId}: ${errMsg}`);
          skippedErrors++;
        }
      }
    }

    // Update last sync time
    await db
      .from('profiles')
      .update({ gmail_last_sync_at: new Date().toISOString() })
      .eq('id', user.id);

    const elapsed = Date.now() - syncStart;
    console.log(`[Sync] Complete user=${user.id}: imported=${imported} errors=${skippedErrors} elapsed=${elapsed}ms`);

    const responsePayload: Record<string, unknown> = {
      imported,
      message: imported > 0
        ? `Imported ${imported} new newsletter${imported === 1 ? '' : 's'}`
        : 'No new newsletters to import',
      debug: {
        labels: syncLabels,
        labelCounts,
        gmailMessages: messageIds.length,
        alreadyImported: existingIds.size,
        previouslyDeleted: deletedIds.size,
        newFound: newMessageIds.length,
        imported,
        skippedErrors,
        elapsed,
      },
    };

    const warnings: string[] = [];

    if (sourceLimitReached) {
      warnings.push('Some sources were skipped due to plan limits.');
      responsePayload.code = 'SOURCE_LIMIT_REACHED';
    }

    if (failedLabels.length) {
      warnings.push('Some labels could not be synced. Refresh labels in Settings.');
    }

    if (skippedErrors > 0) {
      warnings.push(`${skippedErrors} message${skippedErrors === 1 ? '' : 's'} could not be imported.`);
    }

    if (warnings.length) {
      responsePayload.warning = warnings.join(' ');
    }

    return NextResponse.json(responsePayload);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const elapsed = Date.now() - syncStart;
    console.error(`[Sync] Fatal error user=${user.id} elapsed=${elapsed}ms:`, message);

    // Only clear tokens when Google permanently revoked them
    if (message.includes('invalid_grant') || message.includes('Token has been expired or revoked')) {
      await db
        .from('profiles')
        .update({
          gmail_connected: false,
          gmail_access_token: null,
          gmail_refresh_token: null,
        })
        .eq('id', user.id);

      return NextResponse.json(
        { error: 'Gmail access was revoked. Please reconnect Gmail in Settings.', code: 'TOKEN_REVOKED' },
        { status: 401 }
      );
    }

    // Transient token refresh failure — don't nuke tokens
    if (message.includes('Token refresh failed')) {
      return NextResponse.json(
        { error: 'Could not reach Gmail. Please try again in a moment.', code: 'REFRESH_FAILED' },
        { status: 502 }
      );
    }

    if (message.includes('GOOGLE_CLIENT_ID')) {
      return NextResponse.json(
        { error: 'Gmail integration is not configured. Please contact support.' },
        { status: 500 }
      );
    }

    if (message.includes('Gmail list') || message.includes('Gmail get message')) {
      return NextResponse.json(
        { error: 'Could not read from Gmail. Please try again in a moment.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Sync encountered an error. Please try again or reconnect Gmail in Settings.' },
      { status: 500 }
    );
  }
}

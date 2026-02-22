import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken, listMessageIds, getMessage } from '@/utils/gmailClient';
import { parseGmailMessage } from '@/utils/emailParser';
import { classifyIssueSignal } from '@/utils/signalSortHeuristics';
import { decryptToken, isEncryptedPayload } from '@/utils/tokenCrypto';
import { checkRateLimit, rateLimitResponse } from '@/utils/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Import newsletters from specific sender emails.
 * Used by the auto-detect onboarding flow to import from selected senders
 * without requiring Gmail labels.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`import:${user.id}`, 3, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  const body = await request.json();
  const senderEmails = body?.senders as string[] | undefined;

  if (!Array.isArray(senderEmails) || senderEmails.length === 0) {
    return NextResponse.json({ error: 'senders array is required' }, { status: 400 });
  }

  // Limit to 20 senders per import to avoid timeouts
  const selectedSenders = senderEmails.slice(0, 20);

  const { data: profile } = await supabase
    .from('profiles')
    .select('gmail_refresh_token, gmail_connected')
    .eq('id', user.id)
    .single();

  if (!profile?.gmail_refresh_token || !profile.gmail_connected) {
    return NextResponse.json({ error: 'Gmail not connected.' }, { status: 400 });
  }

  try {
    const rawRefreshToken = profile.gmail_refresh_token;
    const refreshToken = isEncryptedPayload(rawRefreshToken)
      ? decryptToken(rawRefreshToken)
      : rawRefreshToken;

    const { accessToken } = await refreshAccessToken(refreshToken);

    let totalImported = 0;
    const importResults: Array<{ email: string; imported: number }> = [];

    for (const senderEmail of selectedSenders) {
      // Search for recent messages from this sender
      const query = `from:${senderEmail} newer_than:14d`;
      const messageIds = await listMessageIds(accessToken, query, 10);

      if (messageIds.length === 0) {
        importResults.push({ email: senderEmail, imported: 0 });
        continue;
      }

      // Check which messages already exist
      const { data: existingIssues } = await supabase
        .from('issues')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', messageIds);

      const existingIds = new Set((existingIssues || []).map((i) => i.message_id));
      const newMessageIds = messageIds.filter((id) => !existingIds.has(id));

      let senderImported = 0;

      // Fetch in parallel batches of 5
      const BATCH_SIZE = 5;
      for (let i = 0; i < newMessageIds.length; i += BATCH_SIZE) {
        const batch = newMessageIds.slice(i, i + BATCH_SIZE);
        const fetched = await Promise.allSettled(
          batch.map((msgId) => getMessage(accessToken, msgId))
        );

        for (const result of fetched) {
          if (result.status !== 'fulfilled') continue;

          try {
            const parsed = parseGmailMessage(result.value);

            // Find or create sender
            let { data: sender } = await supabase
              .from('senders')
              .select('id')
              .eq('user_id', user.id)
              .eq('email', parsed.from_email)
              .single();

            if (!sender) {
              const { data: newSender, error: senderErr } = await supabase
                .from('senders')
                .insert({
                  user_id: user.id,
                  email: parsed.from_email,
                  name: parsed.from_name,
                  status: 'approved',
                })
                .select('id')
                .single();

              if (senderErr) continue;
              sender = newSender;
            }

            if (!sender) continue;

            const signal = classifyIssueSignal({
              subject: parsed.subject,
              snippet: parsed.snippet,
              bodyText: parsed.body_text,
            });

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

            if (!insertError) senderImported++;
          } catch {
            // Continue with other messages
          }
        }
      }

      importResults.push({ email: senderEmail, imported: senderImported });
      totalImported += senderImported;
    }

    // Update last sync time
    await supabase
      .from('profiles')
      .update({ gmail_last_sync_at: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({
      imported: totalImported,
      results: importResults,
      message: totalImported > 0
        ? `Imported ${totalImported} newsletter${totalImported === 1 ? '' : 's'} from ${importResults.filter((r) => r.imported > 0).length} source${importResults.filter((r) => r.imported > 0).length === 1 ? '' : 's'}`
        : 'No new newsletters to import',
    });
  } catch (err) {
    console.error('Newsletter import error:', err);
    return NextResponse.json(
      { error: 'Import failed. Please try again.' },
      { status: 500 }
    );
  }
}

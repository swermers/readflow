import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { refreshAccessToken, listMessageIdsByLabel, getMessage } from '@/utils/gmailClient';
import { parseGmailMessage } from '@/utils/emailParser';

export async function POST() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context — safe to ignore
          }
        },
      },
    }
  );

  // Authenticate the user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
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
    // Refresh the access token (always refresh to ensure it's valid)
    const { accessToken, expiresAt } = await refreshAccessToken(profile.gmail_refresh_token);

    // Update the stored access token
    await supabase
      .from('profiles')
      .update({
        gmail_access_token: accessToken,
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

    const existingIds = new Set((existingIssues || []).map((i) => i.message_id));
    const newMessageIds = messageIds.filter((id) => !existingIds.has(id));

    if (newMessageIds.length === 0) {
      await supabase
        .from('profiles')
        .update({ gmail_last_sync_at: new Date().toISOString() })
        .eq('id', user.id);

      return NextResponse.json({ imported: 0, message: 'All newsletters already imported' });
    }

    let imported = 0;

    // Fetch and import each new message
    for (const msgId of newMessageIds) {
      try {
        const gmailMessage = await getMessage(accessToken, msgId);
        const parsed = parseGmailMessage(gmailMessage);

        // Find or create sender
        let { data: sender } = await supabase
          .from('senders')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('email', parsed.from_email)
          .single();

        if (!sender) {
          const { data: newSender } = await supabase
            .from('senders')
            .insert({
              user_id: user.id,
              email: parsed.from_email,
              name: parsed.from_name,
              status: 'approved',
            })
            .select('id, status')
            .single();
          sender = newSender;
        }

        if (!sender) continue;

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
        });

        if (!insertError) {
          imported++;
        }
      } catch (msgError) {
        console.error(`Failed to import message ${msgId}:`, msgError);
        // Continue with other messages
      }
    }

    // Update last sync time
    await supabase
      .from('profiles')
      .update({ gmail_last_sync_at: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({
      imported,
      message: imported > 0
        ? `Imported ${imported} new newsletter${imported === 1 ? '' : 's'}`
        : 'No new newsletters to import',
    });

  } catch (err: any) {
    console.error('Gmail sync error:', err);

    // If token refresh failed, mark Gmail as disconnected
    if (err.message?.includes('Token refresh failed')) {
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
      { error: err.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

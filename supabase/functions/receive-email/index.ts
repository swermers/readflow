// supabase/functions/receive-email/index.ts
// 
// This Edge Function is the webhook endpoint that email services
// (Postmark, SendGrid, Cloudflare) will POST to when an email arrives.
//
// Deploy with: supabase functions deploy receive-email
// URL will be: https://<your-project>.supabase.co/functions/v1/receive-email

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Use service role to bypass RLS (this is server-to-server)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify webhook secret if configured
  if (WEBHOOK_SECRET) {
    const providedSecret = req.headers.get('x-webhook-secret');
    if (providedSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const payload = await req.json();

    // ─── PARSE THE INBOUND EMAIL ───
    // This handles multiple provider formats. Adjust based on your choice.
    const parsed = parseEmailPayload(payload);

    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Could not parse email payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { toAddress, fromEmail, fromName, subject, bodyHtml, bodyText, messageId } = parsed;

    // ─── 1. FIND THE USER BY FORWARDING ALIAS ───
    // The "to" address is like "abc123@ingest.readflow.app"
    // We extract "abc123" and look it up in profiles
    const alias = toAddress.split('@')[0]?.toLowerCase();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('forwarding_alias', alias)
      .single();

    if (profileError || !profile) {
      console.error('No user found for alias:', alias);
      return new Response(JSON.stringify({ error: 'Unknown recipient' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = profile.id;

    // ─── 2. FIND OR CREATE THE SENDER ───
    let { data: sender } = await supabase
      .from('senders')
      .select('id, status')
      .eq('user_id', userId)
      .eq('email', fromEmail)
      .single();

    if (!sender) {
      // New sender! Create them as "pending" (triggers Gatekeeper review)
      const { data: newSender, error: senderError } = await supabase
        .from('senders')
        .insert({
          user_id: userId,
          email: fromEmail,
          name: fromName || fromEmail.split('@')[0],
          status: 'pending',
        })
        .select()
        .single();

      if (senderError) {
        console.error('Error creating sender:', senderError);
        return new Response(JSON.stringify({ error: 'Failed to create sender' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      sender = newSender;
    }

    // ─── 3. DEDUPLICATION CHECK ───
    if (messageId) {
      const { data: existing } = await supabase
        .from('issues')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ message: 'Duplicate, skipped' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ─── 4. GENERATE SNIPPET ───
    const snippet = generateSnippet(bodyText || bodyHtml, 200);

    // ─── 5. SANITIZE HTML ───
    const cleanHtml = sanitizeHtml(bodyHtml || '');

    // ─── 6. INSERT THE ISSUE ───
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .insert({
        user_id: userId,
        sender_id: sender.id,
        subject: subject || '(No Subject)',
        snippet,
        body_html: cleanHtml,
        body_text: bodyText || '',
        from_email: fromEmail,
        message_id: messageId,
        received_at: new Date().toISOString(),
        status: 'unread',
      })
      .select()
      .single();

    if (issueError) {
      console.error('Error inserting issue:', issueError);
      return new Response(JSON.stringify({ error: 'Failed to store email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Stored issue "${subject}" from ${fromEmail} for user ${userId}`);

    return new Response(JSON.stringify({ success: true, issue_id: issue.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});


// ─── HELPER: Parse different email provider formats ───

interface ParsedEmail {
  toAddress: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  messageId: string;
}

function parseEmailPayload(payload: any): ParsedEmail | null {
  // Postmark format
  if (payload.FromFull || payload.From) {
    return {
      toAddress: payload.ToFull?.Email || payload.To || '',
      fromEmail: payload.FromFull?.Email || payload.From || '',
      fromName: payload.FromFull?.Name || payload.FromName || '',
      subject: payload.Subject || '',
      bodyHtml: payload.HtmlBody || '',
      bodyText: payload.TextBody || '',
      messageId: payload.MessageID || payload.Headers?.find((h: any) => h.Name === 'Message-ID')?.Value || '',
    };
  }

  // SendGrid Inbound Parse format
  if (payload.from || payload.sender_ip) {
    const fromMatch = (payload.from || '').match(/(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?/);
    return {
      toAddress: payload.to || payload.envelope?.to?.[0] || '',
      fromEmail: fromMatch?.[2] || payload.from || '',
      fromName: fromMatch?.[1] || '',
      subject: payload.subject || '',
      bodyHtml: payload.html || '',
      bodyText: payload.text || '',
      messageId: payload.headers?.match(/Message-ID:\s*<?([^>\s]+)>?/i)?.[1] || '',
    };
  }

  // Generic / manual format (our seed script uses this)
  if (payload.to && payload.from_email) {
    return {
      toAddress: payload.to,
      fromEmail: payload.from_email,
      fromName: payload.from_name || '',
      subject: payload.subject || '',
      bodyHtml: payload.body_html || '',
      bodyText: payload.body_text || '',
      messageId: payload.message_id || '',
    };
  }

  return null;
}


// ─── HELPER: Generate a plain text snippet ───

function generateSnippet(content: string, maxLength: number): string {
  if (!content) return '';
  // Strip HTML tags
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}


// ─── HELPER: Basic HTML sanitization ───
// Strips tracking pixels, scripts, and cleans up for reader view

function sanitizeHtml(html: string): string {
  let clean = html;

  // Remove script tags
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove tracking pixels (1x1 images)
  clean = clean.replace(/<img[^>]*(?:width|height)\s*=\s*["']?1["']?[^>]*>/gi, '');

  // Remove style tags (we apply our own via Tailwind prose)
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove common tracking parameters from links
  clean = clean.replace(/(\?|&)(utm_[a-z]+|mc_[a-z]+|ref)=[^&"']*/gi, '');

  // Remove onclick and other event handlers
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  return clean;
}
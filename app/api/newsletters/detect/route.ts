import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { refreshAccessToken, listMessageIds } from '@/utils/gmailClient';
import { decryptToken, isEncryptedPayload } from '@/utils/tokenCrypto';
import { checkRateLimit, rateLimitResponse } from '@/utils/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Known newsletter platform domains. Messages from these domains are
 * almost certainly newsletters, not personal email.
 */
const NEWSLETTER_DOMAINS = [
  'substack.com',
  'beehiiv.com',
  'convertkit.com',
  'mailchimp.com',
  'sendinblue.com',
  'brevo.com',
  'ghost.io',
  'buttondown.email',
  'revue.email',
  'getrevue.co',
  'campaignmonitor.com',
  'hubspot.com',
  'mailerlite.com',
  'constantcontact.com',
  'every.to',
  'letterdrop.com',
  'sparkloop.app',
  'keepsend.com',
  'emailoctopus.com',
];

/**
 * Build a Gmail search query to find recent newsletters from known platforms.
 */
function buildNewsletterQuery(): string {
  const fromClauses = NEWSLETTER_DOMAINS.map((d) => `from:${d}`);
  // Also look for the List-Unsubscribe header which is present in almost all newsletters
  return `(${fromClauses.join(' OR ')} OR list:*.* OR header:list-unsubscribe) newer_than:30d`;
}

type DetectedSender = {
  email: string;
  name: string;
  domain: string;
  messageCount: number;
  latestSubject: string;
  latestDate: string;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`detect:${user.id}`, 3, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetMs);

  const { data: profile } = await supabase
    .from('profiles')
    .select('gmail_access_token, gmail_refresh_token, gmail_connected')
    .eq('id', user.id)
    .single();

  if (!profile?.gmail_refresh_token || !profile.gmail_connected) {
    return NextResponse.json(
      { error: 'Gmail not connected. Connect Gmail first in Settings.' },
      { status: 400 }
    );
  }

  try {
    const rawRefreshToken = profile.gmail_refresh_token;
    const refreshToken = isEncryptedPayload(rawRefreshToken)
      ? decryptToken(rawRefreshToken)
      : rawRefreshToken;

    const { accessToken } = await refreshAccessToken(refreshToken);

    // Search for newsletter-like messages
    const query = buildNewsletterQuery();
    const messageIds = await listMessageIds(accessToken, query, 100);

    if (messageIds.length === 0) {
      return NextResponse.json({ senders: [], message: 'No newsletters detected in the last 30 days.' });
    }

    // Fetch headers only (metadata format) for speed — we just need From + Subject + Date
    const BATCH_SIZE = 20;
    const senderMap = new Map<string, DetectedSender>();

    for (let i = 0; i < Math.min(messageIds.length, 60); i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (msgId) => {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!res.ok) return null;
          return res.json();
        })
      );

      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        const msg = result.value;
        const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];

        const fromHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === 'from')?.value || '';
        const subjectHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === 'subject')?.value || '';
        const dateHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === 'date')?.value || '';

        // Parse From header
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        const email = (emailMatch ? emailMatch[1] : fromHeader.split(/\s/).pop() || '').trim().toLowerCase();
        if (!email || !email.includes('@')) continue;

        const nameMatch = fromHeader.match(/^"?([^"<]*)"?\s*</);
        const name = (nameMatch ? nameMatch[1] : email.split('@')[0]).trim();
        const domain = email.split('@')[1] || '';

        const key = email;
        const existing = senderMap.get(key);
        if (existing) {
          existing.messageCount += 1;
        } else {
          senderMap.set(key, {
            email,
            name,
            domain,
            messageCount: 1,
            latestSubject: subjectHeader,
            latestDate: dateHeader,
          });
        }
      }
    }

    // Filter to senders with 2+ messages (more likely to be newsletters vs one-off marketing)
    const senders = Array.from(senderMap.values())
      .filter((s) => s.messageCount >= 2 || NEWSLETTER_DOMAINS.some((d) => s.domain.endsWith(d)))
      .sort((a, b) => b.messageCount - a.messageCount);

    // Check which senders already exist in the user's sources
    const { data: existingSenders } = await supabase
      .from('senders')
      .select('email')
      .eq('user_id', user.id);

    const existingEmails = new Set((existingSenders || []).map((s) => s.email.toLowerCase()));

    const enrichedSenders = senders.map((s) => ({
      ...s,
      alreadyAdded: existingEmails.has(s.email),
    }));

    return NextResponse.json({
      senders: enrichedSenders,
      total: enrichedSenders.length,
      newCount: enrichedSenders.filter((s) => !s.alreadyAdded).length,
    });
  } catch (err) {
    console.error('Newsletter detection error:', err);
    return NextResponse.json(
      { error: 'Failed to scan for newsletters. Please try again.' },
      { status: 500 }
    );
  }
}

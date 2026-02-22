import type { SupabaseClient } from '@supabase/supabase-js';

type DigestIssue = {
  id: string;
  subject: string;
  snippet: string;
  received_at: string;
  from_email: string;
  senders: { name: string } | null;
};

type DigestData = {
  userName: string;
  issues: DigestIssue[];
  weekStart: string;
  weekEnd: string;
  appUrl: string;
};

/**
 * Build the HTML email for the Monday digest.
 * Intentionally simple and inline-styled for email client compatibility.
 */
export function buildDigestHtml(data: DigestData): string {
  const { userName, issues, appUrl } = data;
  const firstName = userName.split(' ')[0] || 'there';

  const issueRows = issues
    .slice(0, 15)
    .map(
      (issue) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
        <a href="${appUrl}/newsletters/${issue.id}" style="color: #1a1a1a; text-decoration: none; font-weight: 600; font-size: 14px; line-height: 1.4;">
          ${escapeHtml(issue.subject || 'Untitled')}
        </a>
        <div style="margin-top: 4px; font-size: 12px; color: #888;">
          ${escapeHtml(issue.senders?.name || issue.from_email)} &middot; ${formatDate(issue.received_at)}
        </div>
        <div style="margin-top: 4px; font-size: 13px; color: #555; line-height: 1.4;">
          ${escapeHtml((issue.snippet || '').slice(0, 140))}${(issue.snippet || '').length > 140 ? '...' : ''}
        </div>
      </td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8;">
          <!-- Header -->
          <tr>
            <td style="background: #1a1a1a; padding: 24px 32px;">
              <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.04em; text-transform: uppercase;">Readflow</span>
              <span style="float: right; font-size: 12px; color: #999; line-height: 24px; text-transform: uppercase; letter-spacing: 0.06em;">Weekly Digest</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; color: #1a1a1a;">Hey ${escapeHtml(firstName)},</h1>
              <p style="margin: 0 0 24px; font-size: 14px; color: #666; line-height: 1.5;">
                Here's what landed in your Rack this week — ${issues.length} issue${issues.length === 1 ? '' : 's'} from your subscriptions.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${issueRows}
              </table>

              ${issues.length > 15 ? `<p style="margin-top: 16px; font-size: 13px; color: #888;">+ ${issues.length - 15} more issue${issues.length - 15 === 1 ? '' : 's'} in your Rack.</p>` : ''}

              <div style="margin-top: 28px; text-align: center;">
                <a href="${appUrl}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.06em;">
                  Open Readflow
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #999; text-align: center;">
              You're receiving this because you have email digests enabled on <a href="${appUrl}/settings" style="color: #999;">Readflow</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Gather issues from the last 7 days and return digest data for a user.
 */
export async function gatherDigestData(
  supabase: SupabaseClient,
  userId: string,
): Promise<DigestData | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  if (!profile?.email) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: issues } = await supabase
    .from('issues')
    .select('id, subject, snippet, received_at, from_email, senders(name)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('received_at', sevenDaysAgo)
    .order('received_at', { ascending: false })
    .limit(30);

  if (!issues || issues.length === 0) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://readflow.app';

  // Supabase returns senders as array from join; normalize to single object
  const mapped: DigestIssue[] = issues.map((issue: any) => ({
    id: issue.id,
    subject: issue.subject,
    snippet: issue.snippet,
    received_at: issue.received_at,
    from_email: issue.from_email,
    senders: Array.isArray(issue.senders) ? issue.senders[0] || null : issue.senders || null,
  }));

  return {
    userName: profile.full_name || profile.email.split('@')[0],
    issues: mapped,
    weekStart: sevenDaysAgo.slice(0, 10),
    weekEnd: now.slice(0, 10),
    appUrl,
  };
}

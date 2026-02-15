// Gmail API client using plain fetch (no SDK dependency)
// Works in both Node.js (Next.js API routes) and Edge environments

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export interface GmailMessagePart {
  mimeType: string;
  body: { data?: string; size: number };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType: string;
    body: { data?: string; size: number };
    parts?: GmailMessagePart[];
  };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Refresh a Gmail access token using the refresh token.
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const data: TokenResponse = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return { accessToken: data.access_token, expiresAt };
}

/**
 * List Gmail message IDs matching a query (e.g., "label:Readflow").
 * Returns up to maxResults message IDs.
 */
export async function listMessageIds(
  accessToken: string,
  query: string,
  maxResults = 50
): Promise<string[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });

  const res = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail list failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return (data.messages || []).map((m: { id: string }) => m.id);
}

/**
 * Fetch a single Gmail message by ID with full content.
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail get message failed (${res.status}): ${body}`);
  }

  return res.json();
}

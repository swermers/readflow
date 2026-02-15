// Parse Gmail API message format into our Issue/Sender format

import type { GmailMessage, GmailMessagePart } from './gmailClient';

export interface ParsedEmail {
  from_email: string;
  from_name: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  snippet: string;
  message_id: string;
  received_at: string;
}

/**
 * Decode base64url-encoded content from Gmail API.
 */
function decodeBase64Url(data: string): string {
  // Gmail API uses URL-safe base64 (replace -/_ with +//)
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Recursively find a MIME part matching a given mimeType.
 */
function findPart(parts: GmailMessagePart[] | undefined, mimeType: string): GmailMessagePart | null {
  if (!parts) return null;

  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) {
      return part;
    }
    if (part.parts) {
      const found = findPart(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extract a header value from Gmail message headers.
 */
function getHeader(message: GmailMessage, name: string): string {
  const header = message.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || '';
}

/**
 * Parse "From" header into name and email.
 * Handles formats like:
 *   "John Doe <john@example.com>"
 *   "<john@example.com>"
 *   "john@example.com"
 */
function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return {
      name: (match[1] || '').trim(),
      email: (match[2] || '').trim().toLowerCase(),
    };
  }
  return { name: '', email: from.trim().toLowerCase() };
}

/**
 * Strip HTML tags and collapse whitespace for snippet generation.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Basic HTML sanitization for reader view.
 */
function sanitizeHtml(html: string): string {
  let clean = html;
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/<img[^>]*(?:width|height)\s*=\s*["']?1["']?[^>]*>/gi, '');
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');
  clean = clean.replace(/(\?|&)(utm_[a-z]+|mc_[a-z]+|ref)=[^&"']*/gi, '');
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  return clean;
}

/**
 * Parse a Gmail API message into our app's email format.
 */
export function parseGmailMessage(message: GmailMessage): ParsedEmail {
  const fromRaw = getHeader(message, 'From');
  const { name, email } = parseFrom(fromRaw);
  const subject = getHeader(message, 'Subject') || '(No Subject)';

  // Extract body — check for multipart, then fallback to payload body
  let bodyHtml: string | null = null;
  let bodyText: string | null = null;

  const htmlPart = findPart(message.payload.parts, 'text/html');
  const textPart = findPart(message.payload.parts, 'text/plain');

  if (htmlPart?.body?.data) {
    bodyHtml = sanitizeHtml(decodeBase64Url(htmlPart.body.data));
  }
  if (textPart?.body?.data) {
    bodyText = decodeBase64Url(textPart.body.data);
  }

  // If not multipart, check the top-level payload body
  if (!bodyHtml && !bodyText && message.payload.body?.data) {
    const decoded = decodeBase64Url(message.payload.body.data);
    if (message.payload.mimeType === 'text/html') {
      bodyHtml = sanitizeHtml(decoded);
    } else {
      bodyText = decoded;
    }
  }

  // Generate snippet from Gmail's snippet or from body
  const snippet = message.snippet || (bodyText ? bodyText.slice(0, 200) : (bodyHtml ? stripHtml(bodyHtml).slice(0, 200) : ''));

  // Parse internalDate (milliseconds since epoch)
  const receivedAt = new Date(parseInt(message.internalDate, 10)).toISOString();

  return {
    from_email: email,
    from_name: name || email.split('@')[0],
    subject,
    body_html: bodyHtml,
    body_text: bodyText,
    snippet,
    message_id: message.id,
    received_at: receivedAt,
  };
}

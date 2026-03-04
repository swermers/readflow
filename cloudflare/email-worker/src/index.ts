/**
 * Cloudflare Email Worker for Readflow
 *
 * Receives inbound emails via Cloudflare Email Routing, parses the raw MIME
 * message, and forwards the parsed content to the Supabase Edge Function
 * (`receive-email`) for storage.
 *
 * Setup:
 *   1. Deploy: `wrangler deploy`
 *   2. Set secrets: `wrangler secret put WEBHOOK_URL` and `wrangler secret put WEBHOOK_SECRET`
 *   3. In Cloudflare dashboard → Email Routing → configure catch-all route
 *      for *@readflowlibrary.xyz to this Worker
 */

import PostalMime from 'postal-mime';

interface Env {
  WEBHOOK_URL: string;
  WEBHOOK_SECRET: string;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const toAddress = message.to;
    const fromAddress = message.from;

    // Read the raw email stream
    const rawEmail = await streamToArrayBuffer(message.raw);
    const parser = new PostalMime();
    const parsed = await parser.parse(rawEmail);

    let subject = parsed.subject || '(No Subject)';
    let html = parsed.html || '';
    let text = parsed.text || '';
    let messageId = parsed.messageId || message.headers.get('message-id') || '';

    // Prefer the MIME From header over the envelope sender.
    // Gmail auto-forwards (label/filter) rewrite the envelope sender to
    // user+caf_=dest@gmail.com but preserve the original From header.
    let senderEmail = parsed.from?.address || extractEmail(fromAddress);
    let senderName = parsed.from?.name || extractName(fromAddress);

    // ─── HANDLE GMAIL AUTO-FORWARDS (label/filter) ───
    // Gmail rewrites the envelope sender to user+caf_=dest@gmail.com.
    // If the MIME From also got rewritten (DMARC), try Reply-To or
    // X-Original-Sender as fallback sources for the real sender.
    if (/\+caf_=/i.test(fromAddress)) {
      const replyTo = parsed.headers?.find(
        (h: any) => h.key === 'reply-to',
      )?.value;
      const xOrigSender = parsed.headers?.find(
        (h: any) => h.key === 'x-original-sender',
      )?.value;

      // If the parsed From still looks like the user's own address, override
      if (senderEmail === extractEmail(fromAddress) || /\+caf_=/i.test(senderEmail)) {
        if (xOrigSender) {
          senderEmail = extractEmail(xOrigSender);
          senderName = extractName(xOrigSender) || senderName;
        } else if (replyTo) {
          senderEmail = extractEmail(replyTo);
          senderName = extractName(replyTo) || senderName;
        }
      }
    }

    // ─── HANDLE FORWARDED EMAILS ───
    // Check for message/rfc822 attachment (email forwarded as attachment).
    // Inline forwards (Fwd: prefix) are handled downstream by the Supabase
    // edge function which detects the prefix, extracts the original sender,
    // and strips forwarding headers from the body.
    const rfc822Attachment = parsed.attachments?.find(
      (a: any) => a.contentType === 'message/rfc822',
    );

    if (rfc822Attachment) {
      // The original email is attached — parse it for the real content & sender
      const innerParser = new PostalMime();
      const inner = await innerParser.parse(rfc822Attachment.content);

      html = inner.html || html;
      text = inner.text || text;
      subject = inner.subject || subject;
      messageId = inner.messageId || messageId;

      if (inner.from) {
        senderEmail = inner.from.address || senderEmail;
        senderName = inner.from.name || senderName;
      }
    }

    // ─── EXTRACT EBOOK ATTACHMENTS (PDF / EPUB) ───
    const EBOOK_TYPES: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/epub+zip': 'epub',
      'application/x-epub+zip': 'epub',
    };
    const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20 MB

    const ebookAttachments: Array<{
      filename: string;
      file_type: string;
      content_base64: string;
      size: number;
    }> = [];

    if (parsed.attachments) {
      for (const att of parsed.attachments) {
        const fileType = EBOOK_TYPES[att.mimeType?.toLowerCase()];
        if (!fileType) continue;
        if (!att.content || att.content.byteLength > MAX_ATTACHMENT_SIZE) continue;

        const bytes = new Uint8Array(att.content);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }

        ebookAttachments.push({
          filename: att.filename || `ebook.${fileType}`,
          file_type: fileType,
          content_base64: btoa(binary),
          size: bytes.length,
        });
      }
    }

    const payload: Record<string, unknown> = {
      to: toAddress,
      from_email: senderEmail,
      from_name: senderName,
      subject,
      body_html: html,
      body_text: text,
      message_id: messageId,
    };

    if (ebookAttachments.length > 0) {
      payload.ebook_attachments = ebookAttachments;
    }

    const response = await fetch(env.WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': env.WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Webhook failed (${response.status}): ${body}`);
      // Reject the message so Cloudflare can retry or bounce
      message.setReject(`Failed to process email: ${response.status}`);
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * Read a ReadableStream into an ArrayBuffer.
 */
async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result.buffer;
}

/**
 * Extract the email address from a "Name <email>" string.
 */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

/**
 * Extract the display name from a "Name <email>" string.
 */
function extractName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : '';
}


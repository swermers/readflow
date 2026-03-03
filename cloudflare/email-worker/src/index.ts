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
    let senderEmail = extractEmail(fromAddress);
    let senderName = extractName(fromAddress);
    let messageId = parsed.messageId || message.headers.get('message-id') || '';

    // ─── HANDLE FORWARDED EMAILS ───
    // When a user forwards a newsletter, the "from" is the user, not the
    // original sender.  We detect forwards and extract the real sender/content.
    const isForwarded = /^(Fwd|Fw):\s*/i.test(subject);

    // Check for message/rfc822 attachment (email forwarded as attachment)
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
    } else if (isForwarded) {
      // Inline forward — the body already contains the original content,
      // but "from" is the forwarder.  Extract the original sender from the body.
      const originalSender = extractForwardedSender(text || html);
      if (originalSender) {
        senderEmail = originalSender.email || senderEmail;
        senderName = originalSender.name || senderName;
      }
    }

    // Strip "Fwd:" / "Fw:" prefix from subject
    if (isForwarded) {
      subject = subject.replace(/^(Fwd|Fw):\s*/i, '');
    }

    const payload = {
      to: toAddress,
      from_email: senderEmail,
      from_name: senderName,
      subject,
      body_html: html,
      body_text: text,
      message_id: messageId,
    };

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

/**
 * Extract the original sender from an inline-forwarded email body.
 *
 * Looks for the "From:" line after common forwarding markers:
 *   Gmail:   "---------- Forwarded message ---------"
 *   Apple:   "Begin forwarded message:"
 *   Outlook: "-----Original Message-----"
 */
function extractForwardedSender(
  body: string,
): { email: string; name: string } | null {
  if (!body) return null;

  // Strip HTML tags so we can parse the text
  const text = body.replace(/<[^>]*>/g, ' ');

  const fromMatch = text.match(
    /(?:Forwarded message|Begin forwarded message|Original Message)[\s\S]{0,300}?From:\s*(?:"?([^"<\n]*)"?\s*)?<?([^\s<>\n]+@[^\s<>\n]+)>?/i,
  );

  if (fromMatch) {
    return {
      name: (fromMatch[1] || '').trim(),
      email: fromMatch[2],
    };
  }

  return null;
}

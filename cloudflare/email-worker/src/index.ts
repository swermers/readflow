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
 *      for *@ingest.readflow.app to this Worker
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

    const payload = {
      to: toAddress,
      from_email: extractEmail(fromAddress),
      from_name: extractName(fromAddress),
      subject: parsed.subject || '(No Subject)',
      body_html: parsed.html || '',
      body_text: parsed.text || '',
      message_id: parsed.messageId || message.headers.get('message-id') || '',
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

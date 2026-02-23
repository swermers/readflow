import { ANTHROPIC_MODEL_CANDIDATES, isModelNotFoundError } from '@/utils/aiModels';
import { sanitizeForSpeech } from '@/utils/audioScriptEngine';

/**
 * Generate a structured audio digest of a newsletter article using Anthropic Claude.
 * Targets 350-500 words (~2000-3000 chars) for a 2-3 minute listen.
 *
 * Falls back to OpenAI gpt-4o-mini if Anthropic is unavailable,
 * and to a local extractive summary as a last resort.
 */

const DIGEST_SYSTEM_PROMPT = `You are a podcast host creating an audio digest of a newsletter article. Your job is to create a narration script that a text-to-speech engine will read aloud.

Rules:
- Write in a conversational, clear, engaging tone — like a smart friend briefing you
- Cover ALL major sections, themes, and key points from the article
- Include specific data points, numbers, quotes, and evidence when present
- Structure the digest as a flowing narrative, not bullet points
- Use transition phrases between sections ("Moving on to...", "Another key point...", "What's interesting here...")
- Do NOT use markdown, bullets, headers, or any formatting — plain spoken text only
- Do NOT mention "this article" or "the author writes" — speak as if you're explaining the topic directly
- Target 350-500 words (approximately 2-3 minutes when read aloud)
- Start with a compelling one-sentence hook about the main topic
- End with 1-2 key takeaways the listener should remember
- Shorter articles may yield shorter digests — that's fine, don't pad`;

function buildDigestPrompt(subject: string, articleText: string): string {
  const snippet = articleText.slice(0, 20000);
  return `Create an audio digest script for this newsletter article.

Title: ${subject}

Article:
${snippet}`;
}

async function generateWithAnthropic(subject: string, articleText: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = buildDigestPrompt(subject, articleText);

  for (const model of ANTHROPIC_MODEL_CANDIDATES) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          temperature: 0.3,
          system: DIGEST_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const details = await res.text();
        if (isModelNotFoundError(details)) continue;
        return null;
      }

      const data = await res.json();
      const textBlock = Array.isArray(data?.content)
        ? data.content.find((block: { type?: string; text?: string }) => block?.type === 'text' && typeof block?.text === 'string')
        : null;

      const text = textBlock?.text?.trim();
      if (text && text.length > 100) return text;
    } catch {
      continue;
    }
  }

  return null;
}

async function generateWithOpenAI(subject: string, articleText: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_ABBREVIATION_MODEL || 'gpt-4o-mini';
  const endpoint = process.env.OPENAI_CHAT_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
  const snippet = articleText.slice(0, 16000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: DIGEST_SYSTEM_PROMPT },
          { role: 'user', content: buildDigestPrompt(subject, snippet) },
        ],
        max_tokens: 800,
      }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (text && text.length > 100) return text;
  } catch {
    // fall through
  }

  return null;
}

/**
 * Generate an audio digest script for a newsletter article.
 * Tries Anthropic first, then OpenAI, returns null if both fail.
 */
export async function generateAudioDigest(
  subject: string,
  articleText: string,
): Promise<string | null> {
  // Try Anthropic (cheaper, preferred)
  const anthropicResult = await generateWithAnthropic(subject, articleText);
  if (anthropicResult) return sanitizeForSpeech(anthropicResult);

  // Fallback to OpenAI
  const openaiResult = await generateWithOpenAI(subject, articleText);
  if (openaiResult) return sanitizeForSpeech(openaiResult);

  return null;
}

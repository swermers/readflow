import { chatCompletion } from '@/utils/openrouter';
import { sanitizeForSpeech } from '@/utils/audioScriptEngine';

/**
 * Generate a structured audio digest of a newsletter article.
 * Targets 350-500 words (~2000-3000 chars) for a 2-3 minute listen.
 * Callers fall back to a local extractive excerpt if this returns null.
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

/**
 * Generate an audio digest script for a newsletter article via OpenRouter.
 * Returns null if generation fails so callers can fall back to an excerpt.
 */
export async function generateAudioDigest(
  subject: string,
  articleText: string,
): Promise<string | null> {
  try {
    const { text } = await chatCompletion({
      messages: [
        { role: 'system', content: DIGEST_SYSTEM_PROMPT },
        { role: 'user', content: buildDigestPrompt(subject, articleText) },
      ],
      maxTokens: 800,
      temperature: 0.3,
    });
    if (text.length > 100) return sanitizeForSpeech(text);
  } catch {
    // fall through to null
  }
  return null;
}

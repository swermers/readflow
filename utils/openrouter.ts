/**
 * Single gateway for every AI call ReadFlow makes: text (summaries, briefs,
 * audio scripts, signal sort) and text-to-speech. Needs one env var:
 * OPENROUTER_API_KEY.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Cheapest reliable text models, tried in order. OpenRouter fails over to the
 * next one automatically. Override with AI_TEXT_MODELS (comma-separated).
 * Prices per 1M tokens (input/output) when added: Gemini 2.5 Flash-Lite
 * $0.10/$0.40, DeepSeek V4 Flash $0.09/$0.18, GPT-5 nano $0.05/$0.40.
 */
const DEFAULT_TEXT_MODELS = [
  'google/gemini-2.5-flash-lite',
  'deepseek/deepseek-v4-flash',
  'openai/gpt-5-nano',
];

const TEXT_TIMEOUT_MS = 45_000;
const SPEECH_TIMEOUT_MS = 60_000;

export class OpenRouterError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
  }
}

export function getOpenRouterKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new OpenRouterError('OPENROUTER_API_KEY missing', 0);
  return key;
}

export function hasOpenRouterKey() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getTextModels() {
  const fromEnv = (process.env.AI_TEXT_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_TEXT_MODELS;
}

function headers(apiKey: string) {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
    'X-Title': 'ReadFlow',
    ...(process.env.NEXT_PUBLIC_APP_URL ? { 'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL } : {}),
  };
}

async function readError(res: Response) {
  const body = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message;
    if (typeof message === 'string' && message) return message.slice(0, 400);
  } catch {}
  return body.slice(0, 400);
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatOptions = {
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  /** Ask the model for a JSON object response. */
  json?: boolean;
};

export type ChatResult = { text: string; model: string };

export async function chatCompletion({ messages, maxTokens, temperature = 0.2, json = false }: ChatOptions): Promise<ChatResult> {
  const apiKey = getOpenRouterKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEXT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        models: getTextModels(),
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new OpenRouterError(error instanceof Error ? error.message : 'OpenRouter request failed', 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new OpenRouterError(`OpenRouter chat failed: ${res.status} ${await readError(res)}`, res.status);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new OpenRouterError('OpenRouter chat response missing text', 502);
  }
  return { text: text.trim(), model: typeof data?.model === 'string' ? data.model : getTextModels()[0] };
}

export type SpeechResult =
  | { ok: true; audioBuffer: ArrayBuffer }
  | { ok: false; status: number; reason: string };

function looksLikeMp3(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(3, buffer.byteLength));
  if (bytes.length < 2) return false;
  // "ID3" tag, or an MPEG audio frame sync (11 set bits).
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

/**
 * Generate MP3 speech for one chunk of text. The audio pipeline stitches MP3
 * chunks together, so any non-MP3 response is treated as a failure and the
 * caller moves on to the next voice.
 */
export async function synthesizeSpeech(model: string, voice: string, input: string): Promise<SpeechResult> {
  let apiKey: string;
  try {
    apiKey = getOpenRouterKey();
  } catch (error) {
    return { ok: false, status: 0, reason: (error as Error).message };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPEECH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({ model, voice, input, response_format: 'mp3' }),
      signal: controller.signal,
    });
  } catch (error) {
    return { ok: false, status: 0, reason: error instanceof Error ? error.message : 'fetch failed' };
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    return { ok: false, status: res.status, reason: await readError(res) };
  }

  const audioBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || '';
  if (!/mpeg|mp3/i.test(contentType) && !looksLikeMp3(audioBuffer)) {
    return { ok: false, status: 415, reason: `Expected MP3 from ${model}, got ${contentType || 'unknown format'}` };
  }
  return { ok: true, audioBuffer };
}

/** Pull a JSON object or array out of model text that may be wrapped in a code fence. */
export function parseJsonFromText(text: string) {
  const direct = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(direct);
  } catch {
    const starts = [direct.indexOf('{'), direct.indexOf('[')].filter((i) => i !== -1);
    if (!starts.length) throw new Error('Could not parse JSON payload');
    const start = Math.min(...starts);
    const end = Math.max(direct.lastIndexOf('}'), direct.lastIndexOf(']'));
    if (end > start) return JSON.parse(direct.slice(start, end + 1));
    throw new Error('Could not parse JSON payload');
  }
}

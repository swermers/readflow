export type AudioTone = 'professional' | 'witty' | 'academic';

type BuildAudioScriptInput = {
  title: string;
  rawText: string;
  sections?: string[];
  forceTone?: AudioTone;
};

const CTA_PATTERNS = [
  /\bclick here\b/gi,
  /\btap here\b/gi,
  /\blearn more\b/gi,
  /\bread more\b/gi,
  /\bsubscribe now\b/gi,
  /\bwatch now\b/gi,
  /\bview in browser\b/gi,
];

const FOOTER_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bmanage preferences\b/i,
  /\bprivacy policy\b/i,
  /\bforward to a friend\b/i,
  /\bview in browser\b/i,
  /\bfollow us on\b/i,
  /\bfacebook\b/i,
  /\binstagram\b/i,
  /\blinkedin\b/i,
  /\bx\.com\b/i,
  /\btwitter\b/i,
];

const TONE_OPENERS: Record<AudioTone, string> = {
  professional: 'Clear update: ',
  witty: 'Quick pulse check: ',
  academic: 'Brief analysis: ',
};

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function stripHtmlForSpeech(input: string) {
  const withAltText = input.replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, ' Image note: $1. ');

  return normalizeWhitespace(
    withAltText
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function rewriteLinksAndEmails(text: string) {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, '$1')
    .replace(/\bhttps?:\/\/[^\s]+/gi, ' referenced link ')
    .replace(/\bwww\.[^\s]+/gi, ' referenced website ')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' contact email ');
}

function rewriteCallsToAction(text: string) {
  let next = text;
  for (const pattern of CTA_PATTERNS) {
    next = next.replace(pattern, 'review the source details');
  }
  return next;
}

function removeFooterArtifacts(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return text;

  const kept = lines.filter((line) => !FOOTER_PATTERNS.some((pattern) => pattern.test(line)));
  return kept.join('\n');
}

export function classifyTone(text: string): AudioTone {
  const sample = text.toLowerCase();
  const academicSignals = ['methodology', 'evidence', 'hypothesis', 'research', 'dataset', 'statistical'];
  const wittySignals = ['funny', 'meme', 'joke', 'wild', 'plot twist', 'spicy'];

  const academicMatches = academicSignals.filter((token) => sample.includes(token)).length;
  const wittyMatches = wittySignals.filter((token) => sample.includes(token)).length;

  if (academicMatches >= 2) return 'academic';
  if (wittyMatches >= 2) return 'witty';
  return 'professional';
}

function createHook(title: string, cleanedText: string, tone: AudioTone) {
  const firstSentence = cleanedText.split(/(?<=[.!?])\s+/).find(Boolean) || cleanedText;
  const opener = TONE_OPENERS[tone];
  return normalizeWhitespace(`${opener}${title}. ${firstSentence}`);
}

export function sanitizeForSpeech(rawText: string) {
  const noFooter = removeFooterArtifacts(rawText);
  const noLinks = rewriteLinksAndEmails(noFooter);
  const ctaRewritten = rewriteCallsToAction(noLinks);
  return normalizeWhitespace(ctaRewritten);
}

export function buildAudioScript(input: BuildAudioScriptInput) {
  const tone = input.forceTone || classifyTone(input.rawText);
  const sanitizedBody = sanitizeForSpeech(input.rawText);

  const sectionText = (input.sections || [])
    .map((section) => sanitizeForSpeech(section))
    .filter(Boolean)
    .join(' [PAUSE] ');

  const hook = createHook(input.title, sanitizedBody, tone)
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(' ');

  const script = normalizeWhitespace(
    `${hook} [PAUSE] ${sectionText || sanitizedBody}`.replace(/[#*_`>-]/g, ' '),
  );

  return {
    tone,
    hook,
    script,
  };
}

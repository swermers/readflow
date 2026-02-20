export type AudioTone = 'professional' | 'witty' | 'academic';

type BuildAudioScriptInput = {
  title: string;
  rawText: string;
  sections?: string[];
  forceTone?: AudioTone;
  mode?: 'full' | 'abbreviated';
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
  /\badvertisement\b/i,
  /\bsponsored\b/i,
  /\bterms of service\b/i,
  /\bcookie policy\b/i,
  /\bcontact us\b/i,
];

const TONE_OPENERS: Record<AudioTone, string> = {
  professional: 'Clear update: ',
  witty: 'Quick pulse check: ',
  academic: 'Brief analysis: ',
};

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function removeLeadingHookSentences(body: string, hookSentences: string[]) {
  let next = normalizeWhitespace(body);
  for (const sentence of hookSentences) {
    if (!sentence) continue;
    const escaped = sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`^${escaped}\\s*`, 'i'), '').trim();
  }
  return normalizeWhitespace(next);
}


function removeBoilerplateBlocks(html: string) {
  return html
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ')
    .replace(/<button[\s\S]*?<\/button>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(div|section|table)[^>]*(subscribe|footer|social|sharing|promo|advert|sponsor|cookie)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
}

export function stripHtmlForSpeech(input: string) {
  const withoutBoilerplate = removeBoilerplateBlocks(input || '');
  const withAltText = withoutBoilerplate.replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, ' Image note: $1. ');

  return normalizeWhitespace(
    withAltText
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

export function extractReadableTextFromHtml(input: string) {
  const withoutBoilerplate = removeBoilerplateBlocks(input || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, '\n');

  const stripped = stripHtmlForSpeech(withoutBoilerplate);
  const lines = stripped
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .filter((line) => line.length >= 20)
    .filter((line) => !FOOTER_PATTERNS.some((pattern) => pattern.test(line)));

  if (!lines.length) return stripped;

  const scored = lines.map((line) => {
    let score = 0;
    if (/[.!?]/.test(line)) score += 2;
    if (line.length > 60) score += 2;
    if (/\b(analysis|market|product|team|research|customer|revenue|strategy|trend)\b/i.test(line)) score += 1;
    if (/\b(unsubscribe|privacy|cookie|follow us|view in browser)\b/i.test(line)) score -= 4;
    return { line, score };
  });

  const best = scored.filter((entry) => entry.score > 0).map((entry) => entry.line);
  return normalizeWhitespace((best.length ? best : lines).join(' '));
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


function buildCliffNotesBody(sanitizedBody: string, maxSentences = 8) {
  const sentences = splitSentences(sanitizedBody);
  if (sentences.length <= maxSentences) return sentences.join(' ');

  const minGap = 1;
  const bucketCount = Math.min(4, Math.max(2, Math.floor(maxSentences / 2)));
  const bucketSize = Math.ceil(sentences.length / bucketCount);

  const scored = sentences.map((sentence, index) => {
    let score = 0;
    if (/\b(key|important|core|main|critical|focus|result|outcome|takeaway|trend|risk|opportunity|because|however|therefore|but)\b/i.test(sentence)) score += 3;
    if (/\d|%/.test(sentence)) score += 1;
    if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(sentence)) score += 1;
    if (sentence.length >= 60 && sentence.length <= 220) score += 2;
    if (sentence.length < 35) score -= 2;
    if (sentence.length > 280) score -= 1;
    if (/\b(unsubscribe|privacy|cookie|follow us|view in browser|sponsored|advertisement)\b/i.test(sentence)) score -= 5;
    return { sentence, index, score, bucket: Math.min(bucketCount - 1, Math.floor(index / bucketSize)) };
  });

  const chosen: typeof scored = [];

  const canPick = (candidate: (typeof scored)[number]) =>
    !chosen.some((item) => Math.abs(item.index - candidate.index) <= minGap);

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const topInBucket = scored
      .filter((item) => item.bucket === bucket)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .find((item) => item.score > 0 && canPick(item));

    if (topInBucket) chosen.push(topInBucket);
  }

  const remaining = scored
    .slice()
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((item) => item.score > 0)
    .filter((item) => !chosen.some((pick) => pick.index === item.index));

  for (const candidate of remaining) {
    if (chosen.length >= maxSentences) break;
    if (!canPick(candidate)) continue;
    chosen.push(candidate);
  }

  const fallback = scored
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter((item) => !chosen.some((pick) => pick.index === item.index));

  for (const candidate of fallback) {
    if (chosen.length >= maxSentences) break;
    if (!canPick(candidate)) continue;
    chosen.push(candidate);
  }

  return chosen
    .sort((a, b) => a.index - b.index)
    .slice(0, maxSentences)
    .map((item) => item.sentence)
    .join(' ');
}

export function buildAudioScript(input: BuildAudioScriptInput) {
  const tone = input.forceTone || classifyTone(input.rawText);
  const mode = input.mode || 'full';
  const sanitizedBody = sanitizeForSpeech(input.rawText);
  const bodySentences = splitSentences(sanitizedBody);
  const hookSentences = bodySentences.slice(0, 2);

  const sectionText = (input.sections || [])
    .map((section) => sanitizeForSpeech(section))
    .filter(Boolean)
    .join(' [PAUSE] ');

  const hook = createHook(input.title, hookSentences.join(' ') || sanitizedBody, tone)
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(' ');

  const bodyWithoutHookLead = bodySentences.slice(hookSentences.length).join(' ');
  const candidateBody = normalizeWhitespace(sectionText || bodyWithoutHookLead || sanitizedBody);
  const preferredBody = removeLeadingHookSentences(candidateBody, hookSentences);

  const cliffNotesBody = buildCliffNotesBody(preferredBody, 8)
    .split(/(?<=[.!?])\s+/)
    .join(' [PAUSE] ');

  const disclaimer = "Here is your abbreviated audio briefing for this article.";
  const bodyForMode = mode === 'abbreviated' ? `${disclaimer} [PAUSE] ${cliffNotesBody}` : preferredBody;

  const script = normalizeWhitespace(
    `${hook} [PAUSE] ${bodyForMode}`.replace(/[#*_`>-]/g, ' '),
  );

  return {
    tone,
    hook,
    script,
  };
}

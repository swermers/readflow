/**
 * Curated text-to-speech voices available through OpenRouter.
 *
 * Each voice is addressed by a stable key ("<family>:<voice>") that we store
 * in profile_preferences.tts_voice. Prices come from OpenRouter's models API
 * (GET /api/v1/models?output_modalities=speech) and are USD per 1M input
 * characters. Re-check them there when updating this list.
 */

export type VoiceTier = 'budget' | 'standard' | 'premium';

export type VoiceOption = {
  key: string;
  label: string;
  description: string;
  model: string;
  voice: string;
  tier: VoiceTier;
  pricePerMillionChars: number;
};

type VoiceFamily = {
  family: string;
  model: string;
  tier: VoiceTier;
  pricePerMillionChars: number;
  voices: Array<{ voice: string; label: string; description: string }>;
};

const FAMILIES: VoiceFamily[] = [
  {
    family: 'kokoro',
    model: 'hexgrad/kokoro-82m',
    tier: 'budget',
    pricePerMillionChars: 0.62,
    voices: [
      { voice: 'af_heart', label: 'Heart', description: 'Warm American female' },
      { voice: 'af_bella', label: 'Bella', description: 'Bright American female' },
      { voice: 'af_nicole', label: 'Nicole', description: 'Soft American female' },
      { voice: 'am_michael', label: 'Michael', description: 'Steady American male' },
      { voice: 'am_adam', label: 'Adam', description: 'Relaxed American male' },
      { voice: 'am_onyx', label: 'Onyx', description: 'Deep American male' },
      { voice: 'bf_emma', label: 'Emma', description: 'British female' },
      { voice: 'bm_george', label: 'George', description: 'British male' },
    ],
  },
  {
    family: 'voxtral',
    model: 'mistralai/voxtral-mini-tts-3-0',
    tier: 'standard',
    pricePerMillionChars: 13,
    voices: [
      { voice: 'en_paul_neutral', label: 'Paul', description: 'American male, calm narrator' },
      { voice: 'gb_oliver_neutral', label: 'Oliver', description: 'British male, calm narrator' },
      { voice: 'gb_jane_neutral', label: 'Jane', description: 'British female, calm narrator' },
    ],
  },
  {
    family: 'grok',
    model: 'x-ai/grok-voice-tts-1.0',
    tier: 'standard',
    pricePerMillionChars: 15,
    voices: [
      { voice: 'eve', label: 'Eve', description: 'Expressive female' },
      { voice: 'ara', label: 'Ara', description: 'Warm female' },
      { voice: 'rex', label: 'Rex', description: 'Confident male' },
      { voice: 'leo', label: 'Leo', description: 'Friendly male' },
    ],
  },
  {
    family: 'mai',
    model: 'microsoft/mai-voice-2.1-flash',
    tier: 'standard',
    pricePerMillionChars: 15,
    voices: [
      { voice: 'en-US-Harper:MAI-Voice-2.1-Flash', label: 'Harper', description: 'American female' },
      { voice: 'en-US-Ethan:MAI-Voice-2.1-Flash', label: 'Ethan', description: 'American male' },
      { voice: 'en-GB-Emily:MAI-Voice-2.1-Flash', label: 'Emily', description: 'British female' },
    ],
  },
  {
    family: 'eleven',
    model: 'elevenlabs/eleven-v4-turbo',
    tier: 'premium',
    pricePerMillionChars: 40,
    voices: [
      { voice: 'george', label: 'George', description: 'ElevenLabs, British male storyteller' },
      { voice: 'sarah', label: 'Sarah', description: 'ElevenLabs, American female' },
      { voice: 'brian', label: 'Brian', description: 'ElevenLabs, American male' },
    ],
  },
];

export const VOICE_OPTIONS: VoiceOption[] = FAMILIES.flatMap((family) =>
  family.voices.map((v) => ({
    key: `${family.family}:${v.voice}`,
    label: v.label,
    description: v.description,
    model: family.model,
    voice: v.voice,
    tier: family.tier,
    pricePerMillionChars: family.pricePerMillionChars,
  })),
);

export const DEFAULT_VOICE_KEY = 'kokoro:af_heart';

/**
 * Voice used when the chosen voice fails. Voxtral is documented as returning
 * MP3, so it is a safe last resort for the MP3 pipeline.
 */
export const FALLBACK_VOICE_KEY = 'voxtral:en_paul_neutral';

const VOICE_BY_KEY = new Map(VOICE_OPTIONS.map((option) => [option.key, option]));

export function isValidVoiceKey(key: unknown): key is string {
  return typeof key === 'string' && VOICE_BY_KEY.has(key);
}

/**
 * Resolve a stored voice key to a voice. Falls back to the TTS_DEFAULT_VOICE
 * env var, then to DEFAULT_VOICE_KEY.
 */
export function resolveVoice(key?: string | null): VoiceOption {
  if (key && VOICE_BY_KEY.has(key)) return VOICE_BY_KEY.get(key)!;
  const envKey = process.env.TTS_DEFAULT_VOICE;
  if (envKey && VOICE_BY_KEY.has(envKey)) return VOICE_BY_KEY.get(envKey)!;
  return VOICE_BY_KEY.get(DEFAULT_VOICE_KEY)!;
}

/** Ordered list of voices to try: the chosen one, then the default, then the fallback. */
export function voiceAttemptChain(key?: string | null): VoiceOption[] {
  const chain = [resolveVoice(key), VOICE_BY_KEY.get(DEFAULT_VOICE_KEY)!, VOICE_BY_KEY.get(FALLBACK_VOICE_KEY)!];
  const seen = new Set<string>();
  return chain.filter((voice) => {
    if (seen.has(voice.key)) return false;
    seen.add(voice.key);
    return true;
  });
}

/** Rough cost in USD to voice one ~3,000-character article digest. */
export function estimateDigestCostUsd(option: VoiceOption, chars = 3000) {
  return (option.pricePerMillionChars * chars) / 1_000_000;
}

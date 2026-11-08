# AI setup (OpenRouter)

Every AI feature in ReadFlow goes through [OpenRouter](https://openrouter.ai) with a single key:
TL;DR summaries, signal sort, the weekly brief, audio digest scripts, and all text-to-speech.

## Environment variables (Vercel)

| Variable | Required | What it does |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | The only AI key the app needs. |
| `AI_TEXT_MODELS` | no | Comma-separated text models, tried in order. Default: `google/gemini-2.5-flash-lite,deepseek/deepseek-v4-flash,openai/gpt-5-nano`. |
| `TTS_DEFAULT_VOICE` | no | Voice key used when a user hasn't picked one (see `utils/voices.ts`). Default: `kokoro:af_heart`. |
| `AUDIO_PREGENERATE_TTS` | no | `true` voices every incoming newsletter in advance so playback is instant. Off by default: only the digest script is pre-written and audio is made when someone presses Listen. |

No longer used, so you can delete them: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `XAI_API_KEY`, `GROK_API_KEY`,
`XAI_MODEL`, `GROK_MODEL`, `OPENAI_API_KEY`, `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`, `OPENAI_AUDIO_ENDPOINT`,
`OPENAI_CHAT_ENDPOINT`, `OPENAI_ABBREVIATION_MODEL`.

Run migration `supabase/migrations/044_add_tts_voice_preference.sql` so voice choices can be saved.

## Voices

Users pick a voice in **Settings → Listening Voice** and can play a short sample first. The list lives in
`utils/voices.ts`. If the chosen voice fails, audio falls back to the default voice, then to
Voxtral Paul (`voxtral:en_paul_neutral`), which is documented as always returning MP3.

## Cost per action

OpenRouter list prices, November 2026. OpenRouter also adds a 5.5% fee when you buy credit.

| Action | Roughly |
|---|---|
| TL;DR summary | $0.0004 |
| Audio digest script | $0.0008 |
| Signal sort (15 items) | $0.0004 |
| Weekly brief | $0.001 |
| Voicing one digest (~3,000 chars): Kokoro | $0.002 |
| Voicing one digest: Voxtral / Grok / MAI | $0.04 – $0.045 |
| Voicing one digest: ElevenLabs v4 Turbo | $0.12 |

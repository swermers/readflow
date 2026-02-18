'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

type Props = {
  issueId: string;
};

type SummaryResponse = {
  provider: string;
  summary: string;
  takeaways: string[];
};

type ErrorResponse = {
  error?: string;
  hints?: string[];
  providerErrors?: Record<string, string>;
};

export default function AISummaryCard({ issueId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const generate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        const providerErrorText = body?.providerErrors
          ? Object.entries(body.providerErrors)
              .map(([name, message]) => `${name}: ${message}`)
              .join(' | ')
          : null;

        setError(providerErrorText || body?.error || 'Could not generate TLDR right now.');
        return;
      }

      const payload = await res.json();
      setData(payload);
    } catch {
      setError('Could not generate TLDR right now.');
    } finally {
      setLoading(false);
    }
  };

  const generateListenAudio = async () => {
    setAudioLoading(true);
    setAudioError(null);

    try {
      const res = await fetch('/api/ai/listen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        setAudioError(body?.error || 'Could not generate audio right now.');
        return;
      }

      const audioBlob = await res.blob();
      const nextUrl = URL.createObjectURL(audioBlob);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch {
      setAudioError('Could not generate audio right now.');
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-line bg-surface-raised p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-accent">
            <Sparkles className="h-3.5 w-3.5" /> AI Reader
          </p>
          <h2 className="mt-1 text-base font-semibold text-ink">On-demand TLDR and takeaways</h2>
          <p className="mt-1 text-xs text-ink-faint">Generate only when you want it to keep quality high and costs low.</p>
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
        >
          {loading ? 'Generating...' : data ? 'Regenerate' : 'Generate TLDR'}
        </button>
      </div>

      {error && <p className="mt-4 text-xs text-red-500">{error}</p>}

      {data && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <p className="text-xs uppercase tracking-[0.08em] text-ink-faint">Provider: {data.provider}</p>
          <p className="text-sm leading-relaxed text-ink">{data.summary}</p>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.08em] text-ink-faint">Key takeaways</p>
            <ul className="list-disc space-y-1 pl-4 text-sm text-ink-muted">
              {data.takeaways.map((takeaway, index) => (
                <li key={`${takeaway}-${index}`}>{takeaway}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-ink-faint">Listen mode</p>
            <p className="mt-1 text-xs text-ink-faint">Generate audio narration of this article using xAI.</p>
          </div>
          <button
            type="button"
            onClick={generateListenAudio}
            disabled={audioLoading}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
          >
            {audioLoading ? 'Generating...' : audioUrl ? 'Regenerate audio' : 'Generate audio'}
          </button>
        </div>

        {audioError && <p className="text-xs text-red-500">{audioError}</p>}

        {audioUrl && (
          <audio controls className="w-full">
            <source src={audioUrl} type="audio/mpeg" />
            Your browser does not support audio playback.
          </audio>
        )}
      </div>
    </section>
  );
}

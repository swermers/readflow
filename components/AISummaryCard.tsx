'use client';

import { useEffect, useState } from 'react';
import { Headphones, List } from 'lucide-react';

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
  const [audioHints, setAudioHints] = useState<string[]>([]);
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
    setAudioHints([]);

    try {
      const res = await fetch('/api/ai/listen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        setAudioError(body?.error || 'Could not generate audio right now.');
        setAudioHints(body?.hints || []);
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
    <section className="mb-8 rounded-2xl border border-line bg-surface-raised p-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
        >
          <List className="h-3.5 w-3.5" />
          {loading ? 'Generating...' : 'TLDR'}
        </button>
        <button
          type="button"
          onClick={generateListenAudio}
          disabled={audioLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
        >
          <Headphones className="h-3.5 w-3.5" />
          {audioLoading ? 'Generating...' : audioUrl ? 'Regenerate audio' : 'Listen'}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {audioError && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-red-500">{audioError}</p>
          {audioHints.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-ink-faint">
              {audioHints.map((hint, index) => (
                <li key={`${hint}-${index}`}>{hint}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-xs uppercase tracking-[0.08em] text-ink-faint">Provider: {data.provider}</p>
          <p className="text-sm leading-relaxed text-ink">{data.summary}</p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-ink-muted">
            {data.takeaways.map((takeaway, index) => (
              <li key={`${takeaway}-${index}`}>{takeaway}</li>
            ))}
          </ul>
        </div>
      )}

      {audioUrl && (
        <audio controls className="mt-4 w-full border-t border-line pt-4">
          <source src={audioUrl} type="audio/mpeg" />
          Your browser does not support audio playback.
        </audio>
      )}
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Headphones, List, X } from 'lucide-react';

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
  creditsRemaining?: number;
  creditsLimit?: number;
  planTier?: string;
  unlimitedAiAccess?: boolean;
};

type AudioStatus = 'missing' | 'queued' | 'processing' | 'failed' | 'ready' | 'canceled';

const POLL_INTERVAL_MS = 4000;

export default function AISummaryCard({ issueId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('missing');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioHints, setAudioHints] = useState<string[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);

  const [creditsMeta, setCreditsMeta] = useState<{ remaining: number; limit: number; tier: string; unlimited?: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAudioStatus = async () => {
      try {
        const res = await fetch(`/api/ai/listen?issueId=${encodeURIComponent(issueId)}`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;

        const payload = (await res.json()) as {
          status?: AudioStatus;
          audioAvailable?: boolean;
          audioUrl?: string | null;
        };

        if (cancelled) return;

        setAudioStatus(payload.status || 'missing');
        if (payload.audioAvailable && payload.audioUrl) {
          setAudioUrl(payload.audioUrl);
        }
      } catch {
        // best effort only
      }
    };

    void checkAudioStatus();
    const interval = setInterval(() => {
      if (audioStatus === 'queued' || audioStatus === 'processing') {
        void checkAudioStatus();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [audioStatus, issueId]);

  const generate = async () => {
    if (data) return;

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
        if (typeof body?.creditsRemaining === 'number' && typeof body?.creditsLimit === 'number') {
          setCreditsMeta({
            remaining: body.creditsRemaining,
            limit: body.creditsLimit,
            tier: body.planTier || 'free',
            unlimited: body.unlimitedAiAccess || false,
          });
        }
        return;
      }

      const payload = await res.json();
      setData(payload);
      setSummaryCollapsed(false);
      if (typeof payload.creditsRemaining === 'number' && typeof payload.creditsLimit === 'number') {
        setCreditsMeta({
          remaining: payload.creditsRemaining,
          limit: payload.creditsLimit,
          tier: payload.planTier || 'free',
          unlimited: payload.unlimitedAiAccess || false,
        });
      }
    } catch {
      setError('Could not generate TLDR right now.');
    } finally {
      setLoading(false);
    }
  };

  const generateListenAudio = async () => {
    if (audioStatus === 'queued' || audioStatus === 'processing' || audioStatus === 'ready') return;

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
        if (typeof body?.creditsRemaining === 'number' && typeof body?.creditsLimit === 'number') {
          setCreditsMeta({
            remaining: body.creditsRemaining,
            limit: body.creditsLimit,
            tier: body.planTier || 'free',
            unlimited: body.unlimitedAiAccess || false,
          });
        }
        setAudioStatus('failed');
        return;
      }

      const body = (await res.json().catch(() => null)) as {
        audioUrl?: string | null;
        status?: AudioStatus;
        creditsRemaining?: number;
        creditsLimit?: number;
        planTier?: string;
        unlimitedAiAccess?: boolean;
      } | null;

      if (body?.audioUrl) setAudioUrl(body.audioUrl);
      setAudioStatus(body?.status || 'queued');
      if (typeof body?.creditsRemaining === 'number' && typeof body?.creditsLimit === 'number') {
        setCreditsMeta({
          remaining: body.creditsRemaining,
          limit: body.creditsLimit,
          tier: body.planTier || 'free',
          unlimited: body.unlimitedAiAccess || false,
        });
      }
    } catch {
      setAudioError('Could not generate audio right now.');
      setAudioStatus('failed');
    } finally {
      setAudioLoading(false);
    }
  };

  const cancelListenAudio = async () => {
    setAudioLoading(true);

    try {
      const res = await fetch(`/api/ai/listen?issueId=${encodeURIComponent(issueId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setAudioError('Could not cancel generation right now.');
        return;
      }

      const body = (await res.json().catch(() => null)) as { status?: AudioStatus } | null;
      setAudioStatus(body?.status || 'canceled');
    } catch {
      setAudioError('Could not cancel generation right now.');
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-line bg-surface-raised p-4">
      <div className="grid grid-cols-2 gap-2">
        {!data ? (
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
          >
            <List className="h-3.5 w-3.5" />
            {loading ? 'Generating...' : 'TLDR'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSummaryCollapsed((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong"
          >
            {summaryCollapsed ? 'Show TLDR' : 'Hide TLDR'}
          </button>
        )}

        {(audioStatus === 'missing' || audioStatus === 'failed' || audioStatus === 'canceled') ? (
          <button
            type="button"
            onClick={generateListenAudio}
            disabled={audioLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
          >
            <Headphones className="h-3.5 w-3.5" />
            {audioLoading ? 'Working...' : 'Listen'}
          </button>
        ) : (
          <div className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Listen Ready
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {(audioStatus === 'queued' || audioStatus === 'processing') && !audioError && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
          <p className="text-xs text-ink-faint">Preparing narration… we&apos;ll auto-refresh until it&apos;s ready.</p>
          <button
            type="button"
            onClick={cancelListenAudio}
            className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </div>
      )}

      {audioStatus === 'ready' && !audioError && (
        <p className="mt-3 text-xs text-emerald-600">Ready to play.</p>
      )}

      {audioStatus === 'canceled' && !audioError && (
        <p className="mt-3 text-xs text-ink-faint">Narration canceled. You can start it again anytime.</p>
      )}

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

      {creditsMeta && (
        <p className="mt-3 text-xs text-ink-faint">
          AI credits: {creditsMeta.unlimited ? 'Unlimited' : `${creditsMeta.remaining}/${creditsMeta.limit} remaining`} on {creditsMeta.tier.toUpperCase()}.
        </p>
      )}

      {data && !summaryCollapsed && (
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

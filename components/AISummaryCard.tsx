'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, List, Play, X } from 'lucide-react';
import { useGlobalAudioPlayer } from '@/components/GlobalAudioPlayer';
import { triggerToast } from '@/components/Toast';

type Props = {
  issueId: string;
  articleText?: string;
  articleSubject?: string;
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

type AudioChapter = {
  label: string;
  startRatio: number;
};

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function estimateAudioWaitSeconds(articleText?: string) {
  const words = (articleText || '').trim().split(/\s+/).filter(Boolean).length;
  const narrationSeconds = words > 0 ? Math.round((words / 165) * 60) : 45;
  const generationOverhead = 20;
  return Math.max(25, Math.min(360, Math.round(narrationSeconds * 0.35) + generationOverhead));
}

function buildAudioChapters(articleText?: string, articleSubject?: string): AudioChapter[] {
  if (!articleText?.trim()) {
    return [{ label: articleSubject || 'Start', startRatio: 0 }];
  }

  const lines = articleText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headingRegex = /^(#{1,6}\s+|\d+\.\s+|[-*]\s+)?([A-Z][^.!?]{3,90})$/;
  const headingCandidates = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => {
      const normalized = line.replace(/^#{1,6}\s+/, '').trim();
      const isMarkdownHeader = /^#{1,6}\s+/.test(line);
      const looksLikeSection = /:\s*$/.test(normalized) || headingRegex.test(normalized);
      return normalized.length >= 4 && normalized.length <= 90 && (isMarkdownHeader || looksLikeSection);
    });

  if (headingCandidates.length > 1) {
    const maxIndex = Math.max(lines.length - 1, 1);
    return headingCandidates.slice(0, 8).map(({ line, index }, idx) => ({
      label: line.replace(/^#{1,6}\s+/, '').replace(/:\s*$/, '').trim(),
      startRatio: idx === 0 ? 0 : Math.min(0.98, index / maxIndex),
    }));
  }

  const paragraphs = articleText
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 40);

  if (paragraphs.length === 0) return [{ label: articleSubject || 'Start', startRatio: 0 }];

  const sectionCount = Math.min(6, Math.max(3, Math.ceil(paragraphs.length / 3)));
  const chunkSize = Math.ceil(paragraphs.length / sectionCount);

  const chapters: AudioChapter[] = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const start = index * chunkSize;
    const first = paragraphs[start];
    if (!first) continue;

    const label = first.split(/\s+/).slice(0, 4).join(' ').replace(/[,:;.!?]$/, '');
    chapters.push({
      label: index === 0 ? 'Intro' : index === sectionCount - 1 ? 'Wrap-up' : label || `Part ${index + 1}`,
      startRatio: Math.min(1, start / paragraphs.length),
    });
  }

  if (!chapters.some((chapter) => chapter.startRatio === 0)) {
    chapters.unshift({ label: 'Intro', startRatio: 0 });
  }

  return chapters;
}

export default function AISummaryCard({ issueId, articleText, articleSubject }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('missing');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioHints, setAudioHints] = useState<string[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioQueuedAt, setAudioQueuedAt] = useState<number | null>(null);
  const [audioUpdatedAt, setAudioUpdatedAt] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const [creditsMeta, setCreditsMeta] = useState<{ remaining: number; limit: number; tier: string; unlimited?: boolean } | null>(null);
  const { playAudio, isCurrentUrl } = useGlobalAudioPlayer();

  const audioChapters = useMemo(() => buildAudioChapters(articleText, articleSubject), [articleText, articleSubject]);
  const estimatedWaitSeconds = useMemo(() => estimateAudioWaitSeconds(articleText), [articleText]);
  const readyToastShownRef = useRef(false);

  const setGlobalAudioPendingIssue = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('readflow_active_listen_issue', issueId);
  };

  const clearGlobalAudioPendingIssue = () => {
    if (typeof window === 'undefined') return;
    const current = window.localStorage.getItem('readflow_active_listen_issue');
    if (current === issueId) window.localStorage.removeItem('readflow_active_listen_issue');
  };


  useEffect(() => {
    readyToastShownRef.current = false;
  }, [issueId]);

  const trackEvent = async (eventType: string, metadata?: Record<string, unknown>) => {
    try {
      await fetch('/api/events/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, eventType, metadata }),
        keepalive: true,
      });
    } catch {
      // best effort only
    }
  };

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
          previewAudioUrl?: string | null;
          updatedAt?: string | null;
        };

        if (cancelled) return;

        const nextStatus = payload.status || 'missing';
        setAudioStatus(nextStatus);
        setAudioUpdatedAt(payload.updatedAt || null);

        if ((nextStatus === 'queued' || nextStatus === 'processing') && payload.updatedAt) {
          setAudioQueuedAt(new Date(payload.updatedAt).getTime());
          setGlobalAudioPendingIssue();
        }

        if (payload.previewAudioUrl) setPreviewAudioUrl(payload.previewAudioUrl);

        if (payload.audioAvailable && payload.audioUrl) {
          setAudioUrl(payload.audioUrl);
          setPreviewAudioUrl(null);
      readyToastShownRef.current = false;
          if (nextStatus === 'ready') {
            setAudioQueuedAt(null);
            clearGlobalAudioPendingIssue();
            void trackEvent('listen_completed');
            if (!readyToastShownRef.current) {
              triggerToast('Narration is ready — tap play to listen.');
              readyToastShownRef.current = true;
            }
          }
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

  useEffect(() => {
    if (audioStatus !== 'queued' && audioStatus !== 'processing') return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [audioStatus]);

  useEffect(() => {
    if (audioStatus !== 'queued' && audioStatus !== 'processing') return;

    const source = new EventSource(`/api/ai/listen/stream?issueId=${encodeURIComponent(issueId)}`);
    source.addEventListener('status', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data || '{}') as {
          status?: AudioStatus;
          audioUrl?: string | null;
          previewAudioUrl?: string | null;
          updatedAt?: string | null;
        };

        if (payload.status) {
          setAudioStatus(payload.status);
          if (payload.status === 'queued' || payload.status === 'processing') setGlobalAudioPendingIssue();
          if (payload.status === 'ready' || payload.status === 'failed' || payload.status === 'canceled') clearGlobalAudioPendingIssue();
        }
        if (payload.updatedAt) setAudioUpdatedAt(payload.updatedAt);
        if (payload.previewAudioUrl) setPreviewAudioUrl(payload.previewAudioUrl);
        if (payload.audioUrl) {
          setAudioUrl(payload.audioUrl);
          setPreviewAudioUrl(null);
      readyToastShownRef.current = false;
          if (!readyToastShownRef.current) {
            triggerToast('Narration is ready — tap play to listen.');
            readyToastShownRef.current = true;
          }
        }
      } catch {
        // no-op
      }
    });

    return () => {
      source.close();
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

        setError(providerErrorText || body?.error || 'Could not generate TL;DR right now.');
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
      void trackEvent('tldr_generated');
      if (typeof payload.creditsRemaining === 'number' && typeof payload.creditsLimit === 'number') {
        setCreditsMeta({
          remaining: payload.creditsRemaining,
          limit: payload.creditsLimit,
          tier: payload.planTier || 'free',
          unlimited: payload.unlimitedAiAccess || false,
        });
      }
    } catch {
      setError('Could not generate TL;DR right now.');
    } finally {
      setLoading(false);
    }
  };

  const generateListenAudio = async () => {
    if (audioStatus === 'queued' || audioStatus === 'processing' || audioStatus === 'ready') return;

    setAudioLoading(true);
    setAudioError(null);
    setAudioQueuedAt(Date.now());
    setAudioHints([]);
    readyToastShownRef.current = false;
    setGlobalAudioPendingIssue();

    try {
      void trackEvent('listen_started');

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
        readyToastShownRef.current = false;
        clearGlobalAudioPendingIssue();
        return;
      }

      const body = (await res.json().catch(() => null)) as {
        audioUrl?: string | null;
        previewAudioUrl?: string | null;
        status?: AudioStatus;
        creditsRemaining?: number;
        creditsLimit?: number;
        planTier?: string;
        unlimitedAiAccess?: boolean;
        updatedAt?: string | null;
      } | null;

      if (body?.previewAudioUrl) setPreviewAudioUrl(body.previewAudioUrl);
      if (body?.audioUrl) {
        setAudioUrl(body.audioUrl);
        setPreviewAudioUrl(null);
      readyToastShownRef.current = false;
      }
      const nextStatus = body?.status || 'queued';
      setAudioStatus(nextStatus);
      if (nextStatus === 'queued' || nextStatus === 'processing') setGlobalAudioPendingIssue();
      if (nextStatus === 'ready' || nextStatus === 'failed' || nextStatus === 'canceled') clearGlobalAudioPendingIssue();
      if (nextStatus !== 'ready') readyToastShownRef.current = false;
      if (body?.updatedAt) setAudioUpdatedAt(body.updatedAt);
      if (nextStatus === 'queued' || nextStatus === 'processing') {
        setAudioQueuedAt((prev) => prev || Date.now());
      }
      if (nextStatus === 'ready') setAudioQueuedAt(null);
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
      setAudioQueuedAt(null);
      setPreviewAudioUrl(null);
      readyToastShownRef.current = false;
    } catch {
      setAudioError('Could not cancel generation right now.');
    } finally {
      setAudioLoading(false);
    }
  };

  const queueStartMs = audioUpdatedAt ? new Date(audioUpdatedAt).getTime() : audioQueuedAt;
  const elapsedSeconds = queueStartMs ? Math.max(0, Math.floor((nowTick - queueStartMs) / 1000)) : 0;
  const remainingSeconds = Math.max(0, estimatedWaitSeconds - elapsedSeconds);
  const loadingProgress = Math.min(95, Math.max(6, Math.round((elapsedSeconds / Math.max(estimatedWaitSeconds, 1)) * 100)));

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
            {loading ? 'Generating...' : 'TL;DR'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSummaryCollapsed((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong"
          >
            {summaryCollapsed ? 'Show TL;DR' : 'Hide TL;DR'}
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
        <div className="mt-3 rounded-lg border border-line bg-surface px-3 py-2">
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${loadingProgress}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-faint">
              Preparing narration… {elapsedSeconds > 0 ? `elapsed ${formatDuration(elapsedSeconds)}` : 'starting now'}
              {` · est. ${formatDuration(estimatedWaitSeconds)}`}
              {remainingSeconds > 0 ? ` · about ${formatDuration(remainingSeconds)} left` : ' · almost ready'}
            </p>
            <div className="flex items-center gap-2">
              {previewAudioUrl && (
                <button
                  type="button"
                  onClick={() => void playAudio(previewAudioUrl, {
                    title: articleSubject ? `${articleSubject} narration (preview)` : 'Newsletter narration (preview)',
                    chapters: audioChapters,
                  })}
                  className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
                >
                  <Play className="h-3 w-3" />
                  Listen now
                </button>
              )}
              <button
                type="button"
                onClick={cancelListenAudio}
                className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {(audioStatus === 'ready' || ((audioStatus === 'queued' || audioStatus === 'processing') && Boolean(previewAudioUrl))) && !audioError && (
        <div className="mt-3 rounded-lg border border-line bg-surface px-3 py-2">
          <button
            type="button"
            onClick={() => (audioUrl || previewAudioUrl) && void playAudio((audioUrl || previewAudioUrl) as string, {
              title: data?.summary ? 'TL;DR narration' : (articleSubject ? `${articleSubject} narration` : 'Newsletter narration'),
              chapters: audioChapters,
            })}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:text-accent"
          >
            <Play className="h-3.5 w-3.5" />
            {isCurrentUrl(audioUrl || previewAudioUrl) ? 'Playing in mini player' : (audioUrl ? 'Play in mini player' : 'Play preview now')}
          </button>
        </div>
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
    </section>
  );
}

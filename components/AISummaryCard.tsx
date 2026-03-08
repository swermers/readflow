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

// Module-level in-memory cache so summaries persist across navigation
const summaryCache = new Map<string, SummaryResponse>();

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
  tokensRemaining?: number;
  tokenBalance?: number;
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
  const [data, setData] = useState<SummaryResponse | null>(() => summaryCache.get(issueId) || null);
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
  const { playAudio, swapAudioSource, isCurrentUrl } = useGlobalAudioPlayer();

  const audioChapters = useMemo(() => buildAudioChapters(articleText, articleSubject), [articleText, articleSubject]);
  const estimatedWaitSeconds = useMemo(() => estimateAudioWaitSeconds(articleText), [articleText]);
  const readyToastShownRef = useRef(false);
  const userInitiatedRef = useRef(false);
  const previewAutoPlayedRef = useRef(false);

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
    userInitiatedRef.current = false;
    previewAutoPlayedRef.current = false;

    // Restore from client cache or prefetch from DB cache on mount / issue change
    const cached = summaryCache.get(issueId);
    if (cached) {
      setData(cached);
      return;
    }

    let cancelled = false;
    fetch(`/api/ai/summarize?issueId=${encodeURIComponent(issueId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.cached) return;
        const summary: SummaryResponse = {
          provider: payload.provider,
          summary: payload.summary,
          takeaways: payload.takeaways,
        };
        summaryCache.set(issueId, summary);
        setData(summary);
      })
      .catch(() => {});

    return () => { cancelled = true; };
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
          if (nextStatus === 'ready') {
            setAudioQueuedAt(null);
            clearGlobalAudioPendingIssue();
            void trackEvent('listen_completed');
            if (!readyToastShownRef.current) {
              triggerToast('Audio digest is ready — tap play to listen.');
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
        // Safety: if we've been polling for over 6 minutes without resolution,
        // show a failure state instead of spinning forever.
        if (audioQueuedAt && Date.now() - audioQueuedAt > 6 * 60 * 1000) {
          setAudioStatus('failed');
          setAudioError('Audio generation timed out. Please try again.');
          setAudioQueuedAt(null);
          clearGlobalAudioPendingIssue();
          return;
        }
        void checkAudioStatus();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [audioStatus, issueId, audioQueuedAt]);

  useEffect(() => {
    if (audioStatus !== 'queued' && audioStatus !== 'processing') return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [audioStatus]);

  // Auto-play preview chunk as soon as it becomes available
  useEffect(() => {
    if (!previewAudioUrl) return;
    if (previewAutoPlayedRef.current) return;
    if (!userInitiatedRef.current) return;
    if (audioStatus !== 'queued' && audioStatus !== 'processing') return;

    previewAutoPlayedRef.current = true;
    void playAudio(previewAudioUrl, {
      title: articleSubject ? `${articleSubject} digest` : 'Newsletter digest',
      chapters: audioChapters,
    });
  }, [previewAudioUrl, audioStatus]);

  // Seamlessly swap to full audio when ready (preserving playback position)
  useEffect(() => {
    if (audioStatus !== 'ready' || !audioUrl) return;
    if (!userInitiatedRef.current) return;

    // If preview is currently playing, swap to full audio seamlessly
    if (previewAutoPlayedRef.current && isCurrentUrl(previewAudioUrl)) {
      swapAudioSource(audioUrl);
    }
  }, [audioStatus, audioUrl]);

  // SSE stream for real-time status updates. Opens once when audio is first
  // queued and stays open until the job reaches a terminal state or the stream
  // times out. If the stream errors or closes while the job is still in
  // progress, the regular polling interval (above) will keep checking.
  const sseOpenedRef = useRef(false);

  useEffect(() => {
    if (audioStatus !== 'queued' && audioStatus !== 'processing') {
      sseOpenedRef.current = false;
      return;
    }

    // Only open one SSE connection per generation attempt
    if (sseOpenedRef.current) return;
    sseOpenedRef.current = true;

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
          if (!readyToastShownRef.current) {
            triggerToast('Audio digest is ready — tap play to listen.');
            readyToastShownRef.current = true;
          }
        }
      } catch {
        // no-op
      }
    });

    // If the SSE stream errors out, allow re-opening on next status change
    source.onerror = () => {
      source.close();
      sseOpenedRef.current = false;
    };

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

        setError(body?.error || 'Could not generate TL;DR right now.');
        const bal = body?.tokensRemaining ?? body?.tokenBalance ?? body?.creditsRemaining;
        if (typeof bal === 'number') {
          setCreditsMeta({ remaining: bal, limit: bal, tier: body?.planTier || 'free', unlimited: body?.unlimitedAiAccess || false });
        }
        return;
      }

      const payload = await res.json();
      const summary: SummaryResponse = {
        provider: payload.provider,
        summary: payload.summary,
        takeaways: payload.takeaways,
      };
      summaryCache.set(issueId, summary);
      setData(summary);
      setSummaryCollapsed(false);
      void trackEvent('tldr_generated');
      const bal = payload.tokensRemaining ?? payload.tokenBalance ?? payload.creditsRemaining;
      if (typeof bal === 'number') {
        setCreditsMeta({ remaining: bal, limit: bal, tier: payload.planTier || 'free', unlimited: payload.unlimitedAiAccess || false });
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
    previewAutoPlayedRef.current = false;
    userInitiatedRef.current = true;
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
        const errBal = body?.tokensRemaining ?? body?.tokenBalance ?? body?.creditsRemaining;
        if (typeof errBal === 'number') {
          setCreditsMeta({ remaining: errBal, limit: errBal, tier: body?.planTier || 'free', unlimited: body?.unlimitedAiAccess || false });
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
        tokensRemaining?: number;
        tokenBalance?: number;
        creditsRemaining?: number;
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
      const audioBal = body?.tokensRemaining ?? body?.tokenBalance ?? body?.creditsRemaining;
      if (typeof audioBal === 'number') {
        setCreditsMeta({ remaining: audioBal, limit: audioBal, tier: body?.planTier || 'free', unlimited: body?.unlimitedAiAccess || false });
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
            {audioLoading ? 'Working...' : 'Audio Digest'}
          </button>
        ) : (
          <div className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Digest Ready
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
                    title: articleSubject ? `${articleSubject} digest (preview)` : 'Newsletter digest (preview)',
                    chapters: audioChapters,
                  })}
                  className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
                >
                  <Play className="h-3 w-3" />
                  Play digest
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
        <div className="mt-3">
          <p className="text-xs text-ink-faint">
            {creditsMeta.unlimited ? 'Unlimited tokens' : `${creditsMeta.remaining} tokens remaining`}
          </p>
          {!creditsMeta.unlimited && creditsMeta.remaining <= 0 && (
            <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
              <p className="text-xs font-medium text-ink">
                Out of tokens.{' '}
                <a href="/settings" className="text-accent underline hover:opacity-80">
                  Buy more tokens
                </a>{' '}
                to continue using AI features.
              </p>
            </div>
          )}
          {!creditsMeta.unlimited && creditsMeta.remaining > 0 && creditsMeta.remaining <= 15 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Running low on tokens.{' '}
              <a href="/settings" className="underline hover:opacity-80">Buy more</a>
            </p>
          )}
        </div>
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

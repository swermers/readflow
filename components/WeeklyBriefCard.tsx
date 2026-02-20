'use client';

import { useCallback, useEffect, useState } from 'react';

type Theme = {
  title: string;
  consensus: string;
  sourceCount: number;
};

type BriefResponse = {
  overview: string;
  themes: Theme[];
  createdAt?: string;
  weekStart?: string;
  weekEnd?: string;
  nextEligibleAt?: string;
  creditsRemaining?: number;
  creditsLimit?: number;
  planTier?: string;
  unlimitedAiAccess?: boolean;
};

type ErrorResponse = {
  error?: string;
  nextEligibleAt?: string;
  creditsRemaining?: number;
  creditsLimit?: number;
  planTier?: string;
  unlimitedAiAccess?: boolean;
};

type WeeklyGetResponse = {
  brief?: BriefResponse | null;
  weekStart?: string;
  weekEnd?: string;
  generatedNow?: boolean;
  nextEligibleAt?: string;
  tooFewIssues?: boolean;
  creditBlockedReason?: string | null;
  creditsRemaining?: number;
  creditsLimit?: number;
  planTier?: string;
  unlimitedAiAccess?: boolean;
};

type PodcastPayload = {
  status?: string;
  mimeType?: string | null;
  audioBase64?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastError?: string | null;
  deliveryKey?: string | null;
  weekStart?: string | null;
  weekEnd?: string | null;
};

type PodcastResponse = {
  podcast?: PodcastPayload | null;
};

function formatWeekRange(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00.000Z`);
  const e = new Date(`${end}T00:00:00.000Z`);
  const endExclusive = new Date(e);
  endExclusive.setUTCDate(endExclusive.getUTCDate() - 1);
  return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${endExclusive.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

export default function WeeklyBriefCard() {
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<string | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [weekEnd, setWeekEnd] = useState<string | null>(null);
  const [nextEligibleAt, setNextEligibleAt] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [creditsMeta, setCreditsMeta] = useState<{ remaining: number; limit: number; tier: string; unlimited?: boolean } | null>(null);
  const [podcastStatus, setPodcastStatus] = useState<string | null>(null);
  const [podcastSrc, setPodcastSrc] = useState<string | null>(null);
  const [podcastError, setPodcastError] = useState<string | null>(null);
  const [podcastUpdatedAt, setPodcastUpdatedAt] = useState<string | null>(null);
  const [retryingPodcast, setRetryingPodcast] = useState(false);

  const loadPodcast = useCallback(async (start: string, end: string) => {
    const params = new URLSearchParams({ weekStart: start, weekEnd: end });
    const res = await fetch(`/api/ai/weekly-podcast?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const body = (await res.json().catch(() => null)) as PodcastResponse | null;
    const podcast = body?.podcast;

    if (!podcast) {
      setPodcastStatus('missing');
      setPodcastSrc(null);
      setPodcastError(null);
      setPodcastUpdatedAt(null);
      return;
    }

    setPodcastStatus(podcast.status || null);
    setPodcastUpdatedAt(podcast.updatedAt || null);
    setPodcastError(podcast.lastError || null);

    if (podcast.status === 'ready' && podcast.audioBase64) {
      setPodcastSrc(`data:${podcast.mimeType || 'audio/mpeg'};base64,${podcast.audioBase64}`);
      return;
    }

    setPodcastSrc(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLatestBrief = async () => {
      try {
        const res = await fetch('/api/ai/weekly-brief', { method: 'GET', cache: 'no-store' });
        if (!res.ok) return;

        const body = (await res.json().catch(() => null)) as WeeklyGetResponse | null;
        if (cancelled || !body) return;

        setWeekStart(body.weekStart || null);
        setWeekEnd(body.weekEnd || null);
        setNextEligibleAt(body.nextEligibleAt || null);
        if (typeof body?.creditsRemaining === 'number' && typeof body?.creditsLimit === 'number') {
          setCreditsMeta({ remaining: body.creditsRemaining, limit: body.creditsLimit, tier: body.planTier || 'free', unlimited: body.unlimitedAiAccess || false });
        }

        if (body.brief) {
          setOverview(body.brief.overview);
          setThemes(body.brief.themes || []);
          setCreatedAt(body.brief.createdAt || null);
          return;
        }

        if (body.creditBlockedReason) {
          setError(body.creditBlockedReason);
        } else if (body.tooFewIssues) {
          setError('Not enough issues in your current schedule window yet. We will auto-generate when there is enough content.');
        }
      } catch {
        // best effort
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    void loadLatestBrief();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!weekStart || !weekEnd) return;
    let cancelled = false;

    const sync = async () => {
      await loadPodcast(weekStart, weekEnd);
    };

    void sync();

    const interval = setInterval(() => {
      if (cancelled) return;
      if (podcastStatus === 'queued' || podcastStatus === 'processing' || podcastStatus === 'missing') {
        void loadPodcast(weekStart, weekEnd);
      }
    }, 12000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [weekStart, weekEnd, podcastStatus, loadPodcast]);

  const generateBrief = async () => {
    if (overview) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/weekly-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        setError(body?.error || 'Could not generate your weekly brief right now.');
        if (body?.nextEligibleAt) setNextEligibleAt(body.nextEligibleAt);
        if (typeof body?.creditsRemaining === 'number' && typeof body?.creditsLimit === 'number') {
          setCreditsMeta({ remaining: body.creditsRemaining, limit: body.creditsLimit, tier: body.planTier || 'free', unlimited: body.unlimitedAiAccess || false });
        }
        return;
      }

      const body = (await res.json()) as BriefResponse;
      setOverview(body.overview);
      setThemes(body.themes || []);
      setCreatedAt(body.createdAt || new Date().toISOString());
      setWeekStart(body.weekStart || null);
      setWeekEnd(body.weekEnd || null);
      setNextEligibleAt(body.nextEligibleAt || null);
      setCollapsed(false);
      if (typeof body?.creditsRemaining === 'number' && typeof body?.creditsLimit === 'number') {
        setCreditsMeta({ remaining: body.creditsRemaining, limit: body.creditsLimit, tier: body.planTier || 'free', unlimited: body.unlimitedAiAccess || false });
      }
    } catch {
      setError('Could not generate your weekly brief right now.');
    } finally {
      setLoading(false);
    }
  };

  const retryPodcast = async () => {
    if (!weekStart || !weekEnd) return;
    setRetryingPodcast(true);
    try {
      const res = await fetch('/api/ai/weekly-podcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd }),
      });
      if (res.ok) {
        setPodcastStatus('queued');
        setPodcastError(null);
        await loadPodcast(weekStart, weekEnd);
      }
    } finally {
      setRetryingPodcast(false);
    }
  };

  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  const weekLabel = formatWeekRange(weekStart, weekEnd);
  const nextLabel = nextEligibleAt
    ? new Date(nextEligibleAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    : null;
  const podcastUpdatedLabel = podcastUpdatedAt
    ? new Date(podcastUpdatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <section className="mb-8 rounded-2xl border border-line bg-surface-raised p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] text-accent">Signal Engine</p>
          <h2 className="text-lg font-semibold text-ink">Weekly Brief</h2>
          <p className="text-xs text-ink-faint">Generated from your scheduled delivery windows.</p>
          {weekLabel && <p className="mt-1 text-[11px] text-ink-faint">Coverage: {weekLabel}</p>}
          {createdLabel && <p className="mt-1 text-[11px] text-ink-faint">Latest brief: {createdLabel}</p>}
        </div>

        {!overview ? (
          <button
            type="button"
            onClick={generateBrief}
            disabled={loading || initializing}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
          >
            {loading ? 'Briefing...' : 'Generate Now'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong"
          >
            {collapsed ? 'Show Brief' : 'Hide Brief'}
          </button>
        )}
      </div>

      {nextLabel && (
        <p className="mt-3 text-xs text-ink-faint">Next scheduled insight window: {nextLabel}</p>
      )}

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {creditsMeta && (
        <p className="mt-3 text-xs text-ink-faint">
          AI credits: {creditsMeta.unlimited ? 'Unlimited' : `${creditsMeta.remaining}/${creditsMeta.limit} remaining`} on {creditsMeta.tier.toUpperCase()}.
        </p>
      )}

      {overview && !collapsed && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm leading-relaxed text-ink">{overview}</p>
          <ul className="mt-3 space-y-2">
            {themes.map((theme) => (
              <li key={`${theme.title}-${theme.sourceCount}`} className="rounded-lg border border-line bg-surface px-3 py-2">
                <p className="text-xs uppercase tracking-[0.08em] text-accent">{theme.title} · {theme.sourceCount} sources</p>
                <p className="mt-1 text-sm text-ink-muted">{theme.consensus}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg border border-line bg-surface px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.08em] text-accent">Weekly Podcast</p>
              {(podcastStatus === 'failed' || podcastStatus === 'missing') && (
                <button
                  type="button"
                  onClick={retryPodcast}
                  disabled={retryingPodcast}
                  className="rounded-md border border-line px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink disabled:opacity-60"
                >
                  {retryingPodcast ? 'Queueing…' : 'Retry'}
                </button>
              )}
            </div>

            <p className="mt-1 text-xs text-ink-faint">
              Status: {podcastStatus || 'missing'}
              {podcastUpdatedLabel ? ` · Updated ${podcastUpdatedLabel}` : ''}
            </p>

            {podcastSrc ? (
              <audio controls className="mt-2 w-full" src={podcastSrc} />
            ) : (
              <p className="mt-1 text-xs text-ink-faint">
                {podcastStatus === 'processing'
                  ? 'Podcast is being generated in the background.'
                  : podcastStatus === 'queued'
                    ? 'Podcast has been queued and should appear shortly.'
                    : podcastStatus === 'failed'
                      ? podcastError || 'Podcast generation failed. Retry to requeue this window.'
                      : 'Podcast will appear here once ready.'}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

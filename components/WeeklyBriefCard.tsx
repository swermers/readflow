'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

type Theme = {
  title: string;
  consensus: string;
  sourceCount: number;
};

type BriefResponse = {
  overview: string;
  themes: Theme[];
  creditsRemaining?: number;
  creditsLimit?: number;
  planTier?: string;
};

type ErrorResponse = {
  error?: string;
  creditsRemaining?: number;
  creditsLimit?: number;
  planTier?: string;
};

export default function WeeklyBriefCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<string | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [creditsMeta, setCreditsMeta] = useState<{ remaining: number; limit: number; tier: string } | null>(null);

  const generateBrief = async () => {
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
        if (typeof body?.creditsRemaining === 'number' && typeof body?.creditsLimit === 'number') {
          setCreditsMeta({ remaining: body.creditsRemaining, limit: body.creditsLimit, tier: body.planTier || 'free' });
        }
        return;
      }

      const body = (await res.json()) as BriefResponse;
      setOverview(body.overview);
      setThemes(body.themes || []);
      if (typeof body?.creditsRemaining === 'number' && typeof body?.creditsLimit === 'number') {
        setCreditsMeta({ remaining: body.creditsRemaining, limit: body.creditsLimit, tier: body.planTier || 'free' });
      }
    } catch {
      setError('Could not generate your weekly brief right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-line bg-surface-raised p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] text-accent">Signal Engine</p>
          <h2 className="text-lg font-semibold text-ink">Weekly Brief</h2>
          <p className="text-xs text-ink-faint">Cross-newsletter synthesis from the last 7 days.</p>
        </div>
        <button
          type="button"
          onClick={generateBrief}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? 'Briefing...' : 'Generate Brief'}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {creditsMeta && (
        <p className="mt-3 text-xs text-ink-faint">
          AI credits: {creditsMeta.remaining}/{creditsMeta.limit} remaining on {creditsMeta.tier.toUpperCase()}.
        </p>
      )}

      {overview && (
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
        </div>
      )}
    </section>
  );
}

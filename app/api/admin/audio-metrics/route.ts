export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { createAdminClient } from '@/utils/supabase/admin';

type MetricRow = {
  content_type: 'article' | 'weekly_podcast';
  metric_name: string;
  metric_value: number;
  reason: string | null;
};

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.ADMIN_QUEUE_SECRET || process.env.WORKER_SECRET;
  return Boolean(expected) && auth === `Bearer ${expected}`;
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(rows: MetricRow[]) {
  const grouped: Record<string, MetricRow[]> = {
    article: rows.filter((row) => row.content_type === 'article'),
    weekly_podcast: rows.filter((row) => row.content_type === 'weekly_podcast'),
  };

  const out: Record<string, unknown> = {};
  for (const [contentType, subset] of Object.entries(grouped)) {
    const countByName = subset.reduce<Record<string, number>>((acc, row) => {
      acc[row.metric_name] = (acc[row.metric_name] || 0) + Number(row.metric_value || 0);
      return acc;
    }, {});

    const success = countByName.audio_generation_succeeded || 0;
    const failures = countByName.audio_generation_failed || 0;
    const hits = countByName.audio_cache_hit || 0;
    const misses = countByName.audio_cache_miss || 0;
    const cacheDenominator = hits + misses;

    const firstChunkValues = subset
      .filter((row) => row.metric_name === 'audio_first_chunk_latency_ms')
      .map((row) => Number(row.metric_value || 0))
      .filter((n) => Number.isFinite(n) && n >= 0);

    const totalValues = subset
      .filter((row) => row.metric_name === 'audio_total_generation_latency_ms')
      .map((row) => Number(row.metric_value || 0))
      .filter((n) => Number.isFinite(n) && n >= 0);

    const failReasons = subset
      .filter((row) => row.metric_name === 'audio_generation_failed' && row.reason)
      .reduce<Record<string, number>>((acc, row) => {
        const reason = String(row.reason || 'unknown');
        acc[reason] = (acc[reason] || 0) + Number(row.metric_value || 0);
        return acc;
      }, {});

    out[contentType] = {
      totals: {
        successes: success,
        failures,
        cacheHits: hits,
        cacheMisses: misses,
      },
      rates: {
        cacheHitRate: cacheDenominator ? hits / cacheDenominator : null,
        failureRate: success + failures ? failures / (success + failures) : null,
      },
      firstChunkLatencyMs: {
        p50: percentile(firstChunkValues, 50),
        p95: percentile(firstChunkValues, 95),
        avg: firstChunkValues.length
          ? Math.round(firstChunkValues.reduce((sum, n) => sum + n, 0) / firstChunkValues.length)
          : null,
      },
      totalGenerationLatencyMs: {
        p50: percentile(totalValues, 50),
        p95: percentile(totalValues, 95),
        avg: totalValues.length
          ? Math.round(totalValues.reduce((sum, n) => sum + n, 0) / totalValues.length)
          : null,
      },
      failureReasons: failReasons,
    };
  }

  return out;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const windowHours = Math.min(Math.max(Number(url.searchParams.get('windowHours') || 24), 1), 24 * 30);
  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('audio_generation_metrics')
    .select('content_type, metric_name, metric_value, reason')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as MetricRow[];

  return NextResponse.json({
    ok: true,
    windowHours,
    since: sinceIso,
    sampledRows: rows.length,
    summary: summarize(rows),
  });
}

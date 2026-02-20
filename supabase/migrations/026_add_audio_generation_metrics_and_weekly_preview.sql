create table if not exists public.audio_generation_metrics (
  id bigserial primary key,
  content_type text not null check (content_type in ('article', 'weekly_podcast')),
  metric_name text not null,
  metric_value integer not null default 1,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audio_generation_metrics_content_metric_created_idx
  on public.audio_generation_metrics(content_type, metric_name, created_at desc);

alter table public.audio_generation_metrics enable row level security;

alter table public.weekly_podcast_cache
  add column if not exists first_chunk_base64 text,
  add column if not exists first_chunk_ready_at timestamptz;

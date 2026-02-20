create table if not exists public.audio_global_cache (
  audio_hash text primary key,
  content_type text not null check (content_type in ('article', 'weekly_podcast')),
  mime_type text not null default 'audio/mpeg',
  audio_base64 text not null,
  script_text text,
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audio_global_cache_type_created_idx
  on public.audio_global_cache(content_type, created_at desc);

alter table public.audio_global_cache enable row level security;

alter table public.issue_audio_cache
  add column if not exists audio_hash text,
  add column if not exists first_chunk_base64 text,
  add column if not exists first_chunk_ready_at timestamptz,
  add column if not exists generation_started_at timestamptz,
  add column if not exists generation_completed_at timestamptz;

alter table public.weekly_podcast_cache
  add column if not exists audio_hash text,
  add column if not exists generation_started_at timestamptz,
  add column if not exists generation_completed_at timestamptz;

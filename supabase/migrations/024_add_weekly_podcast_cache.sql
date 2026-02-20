create table if not exists public.weekly_podcast_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_key text,
  week_start date,
  week_end date,
  status text not null default 'queued',
  script_text text,
  mime_type text,
  audio_base64 text,
  provider text,
  model text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weekly_podcast_user_delivery_key_idx
  on public.weekly_podcast_cache(user_id, delivery_key)
  where delivery_key is not null;

create index if not exists weekly_podcast_user_created_idx
  on public.weekly_podcast_cache(user_id, created_at desc);

alter table public.weekly_podcast_cache enable row level security;

create policy "Users can view their own weekly podcast cache"
  on public.weekly_podcast_cache
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own weekly podcast cache"
  on public.weekly_podcast_cache
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own weekly podcast cache"
  on public.weekly_podcast_cache
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.issue_audio_cache (
  issue_id uuid not null references public.issues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ready',
  mime_type text,
  audio_base64 text,
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

alter table public.issue_audio_cache enable row level security;

create policy "Users can read own cached issue audio"
  on public.issue_audio_cache for select
  using (auth.uid() = user_id);

create policy "Users can upsert own cached issue audio"
  on public.issue_audio_cache for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cached issue audio"
  on public.issue_audio_cache for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

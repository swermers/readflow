create table if not exists public.weekly_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  overview text not null,
  themes jsonb not null,
  source_issue_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists weekly_briefs_user_created_idx
  on public.weekly_briefs(user_id, created_at desc);

alter table public.weekly_briefs enable row level security;

create policy "Users can view their own weekly briefs"
  on public.weekly_briefs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own weekly briefs"
  on public.weekly_briefs
  for insert
  with check (auth.uid() = user_id);

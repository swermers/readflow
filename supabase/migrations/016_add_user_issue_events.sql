create table if not exists public.user_issue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete set null,
  sender_email text,
  event_type text not null check (event_type in (
    'issue_opened',
    'tldr_generated',
    'listen_started',
    'listen_completed',
    'highlight_created',
    'note_created',
    'issue_archived',
    'issue_deleted'
  )),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_issue_events_user_created_idx
  on public.user_issue_events(user_id, created_at desc);

create index if not exists user_issue_events_user_sender_idx
  on public.user_issue_events(user_id, sender_email);

alter table public.user_issue_events enable row level security;

create policy "Users can insert their own issue events"
  on public.user_issue_events
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own issue events"
  on public.user_issue_events
  for select
  using (auth.uid() = user_id);

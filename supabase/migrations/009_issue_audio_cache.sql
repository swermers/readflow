create table if not exists public.issue_audio_cache (
  issue_id uuid not null,
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

do $$
begin
  if to_regclass('public.issues') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'issue_audio_cache_issue_id_fkey'
    ) then
      alter table public.issue_audio_cache
        add constraint issue_audio_cache_issue_id_fkey
        foreign key (issue_id)
        references public.issues(id)
        on delete cascade;
    end if;
  end if;
end
$$;

alter table public.issue_audio_cache enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'issue_audio_cache'
      and policyname = 'Users can read own cached issue audio'
  ) then
    create policy "Users can read own cached issue audio"
      on public.issue_audio_cache for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'issue_audio_cache'
      and policyname = 'Users can upsert own cached issue audio'
  ) then
    create policy "Users can upsert own cached issue audio"
      on public.issue_audio_cache for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'issue_audio_cache'
      and policyname = 'Users can update own cached issue audio'
  ) then
    create policy "Users can update own cached issue audio"
      on public.issue_audio_cache for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

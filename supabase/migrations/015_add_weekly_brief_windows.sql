alter table public.weekly_briefs
  add column if not exists week_start date,
  add column if not exists week_end date,
  add column if not exists auto_generated boolean not null default false;

update public.weekly_briefs
set
  week_start = coalesce(week_start, date_trunc('week', created_at)::date),
  week_end = coalesce(week_end, (date_trunc('week', created_at)::date + interval '7 day')::date)
where week_start is null or week_end is null;

alter table public.weekly_briefs
  alter column week_start set not null,
  alter column week_end set not null;

create unique index if not exists weekly_briefs_user_week_idx
  on public.weekly_briefs(user_id, week_start);

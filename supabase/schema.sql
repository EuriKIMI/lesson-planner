create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  objectives text not null,
  activities text not null,
  assessment text not null,
  scheduled_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned', 'draft', 'completed')),
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_user_scheduled_idx on public.lessons(user_id, scheduled_at);

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
before update on public.lessons
for each row
execute function public.set_updated_at();

alter table public.lessons enable row level security;

drop policy if exists "Users can view their lessons" on public.lessons;
create policy "Users can view their lessons"
on public.lessons
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their lessons" on public.lessons;
create policy "Users can insert their lessons"
on public.lessons
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their lessons" on public.lessons;
create policy "Users can update their lessons"
on public.lessons
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their lessons" on public.lessons;
create policy "Users can delete their lessons"
on public.lessons
for delete
using (auth.uid() = user_id);

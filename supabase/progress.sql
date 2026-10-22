-- Run once in Supabase: SQL Editor > New query > paste > Run
create table public.lesson_progress (
  user_id uuid not null references auth.users on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.lesson_progress enable row level security;
create policy "read own progress" on public.lesson_progress for select using (auth.uid() = user_id);
create policy "add own progress" on public.lesson_progress for insert with check (auth.uid() = user_id);
create policy "update own progress" on public.lesson_progress for update using (auth.uid() = user_id);

-- Run once in Supabase: SQL Editor > New query > paste > Run
create table public.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null default 'Untitled session',
  bpm integer not null default 92,
  beat_on boolean not null default true,
  pattern jsonb not null default '[]',
  tracks jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sessions enable row level security;
create policy "read own sessions" on public.sessions for select using (auth.uid() = user_id);
create policy "add own sessions" on public.sessions for insert with check (
  auth.uid() = user_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_paid));
create policy "update own sessions" on public.sessions for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_paid));
create policy "delete own sessions" on public.sessions for delete using (auth.uid() = user_id);

-- Private storage bucket for recordings, 20 MB per file, one folder per user
insert into storage.buckets (id, name, public, file_size_limit)
values ('recordings', 'recordings', false, 20971520)
on conflict (id) do nothing;
create policy "read own recordings" on storage.objects for select
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "add own recordings" on storage.objects for insert
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_paid));
create policy "update own recordings" on storage.objects for update
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own recordings" on storage.objects for delete
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

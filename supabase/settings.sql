-- Run once in Supabase: SQL Editor > New query > paste > Run
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists main_instrument text not null default 'Guitar',
  add column if not exists default_bpm integer not null default 92,
  add column if not exists weekly_goal integer not null default 5,
  add column if not exists notify_reminders boolean not null default false,
  add column if not exists notify_news boolean not null default false;

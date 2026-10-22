-- Run once in Supabase: SQL Editor > New query > paste > Run
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  is_paid boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Users may only READ their own row. Only the server (service role) can change is_paid.
create policy "read own profile" on public.profiles for select using (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

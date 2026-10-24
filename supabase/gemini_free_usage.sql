-- Run once in Supabase SQL Editor to enable fail-closed Gemini request limits.
create table public.gemini_coach_usage (
  user_id uuid not null references auth.users on delete cascade,
  month_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, month_start)
);

create table public.gemini_coach_global_usage (
  month_start date primary key,
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.gemini_coach_usage enable row level security;
alter table public.gemini_coach_global_usage enable row level security;

revoke all on public.gemini_coach_usage from anon, authenticated;
revoke all on public.gemini_coach_global_usage from anon, authenticated;

create or replace function public.reserve_gemini_coach_request(
  p_user_id uuid,
  p_user_limit integer,
  p_global_limit integer
)
returns table(allowed boolean, user_used integer, global_used integer)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_month date := date_trunc('month', now() at time zone 'utc')::date;
  user_count integer;
  global_count integer;
begin
  if p_user_id is null or p_user_limit < 1 or p_global_limit < 1 then
    raise exception 'invalid_gemini_usage_limit';
  end if;

  insert into public.gemini_coach_global_usage (month_start, request_count)
  values (current_month, 0)
  on conflict (month_start) do nothing;

  insert into public.gemini_coach_usage (user_id, month_start, request_count)
  values (p_user_id, current_month, 0)
  on conflict (user_id, month_start) do nothing;

  select request_count into global_count
  from public.gemini_coach_global_usage
  where month_start = current_month
  for update;

  select request_count into user_count
  from public.gemini_coach_usage
  where user_id = p_user_id and month_start = current_month
  for update;

  if user_count >= p_user_limit or global_count >= p_global_limit then
    return query select false, user_count, global_count;
    return;
  end if;

  update public.gemini_coach_usage
  set request_count = request_count + 1
  where user_id = p_user_id and month_start = current_month
  returning request_count into user_count;

  update public.gemini_coach_global_usage
  set request_count = request_count + 1
  where month_start = current_month
  returning request_count into global_count;

  return query select true, user_count, global_count;
end;
$$;

revoke all on function public.reserve_gemini_coach_request(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_gemini_coach_request(uuid, integer, integer) to service_role;

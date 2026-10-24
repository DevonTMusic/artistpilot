-- Apply after gemini_free_usage.sql. Existing monthly usage carries forward.
alter table public.gemini_coach_usage
  add column if not exists free_request_count integer not null default 0;

update public.gemini_coach_usage
set free_request_count = least(request_count, 50)
where free_request_count = 0 and request_count > 0;

create table if not exists public.gemini_coach_credits (
  user_id uuid primary key references auth.users on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.gemini_coach_credit_purchases (
  checkout_session_id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  credits integer not null check (credits in (100, 250)),
  created_at timestamptz not null default now()
);

create table if not exists public.gemini_coach_reservations (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  month_start date not null,
  charged_credit boolean not null,
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'refunded')),
  created_at timestamptz not null default now()
);

alter table public.gemini_coach_credits enable row level security;
alter table public.gemini_coach_credit_purchases enable row level security;
alter table public.gemini_coach_reservations enable row level security;

revoke all on public.gemini_coach_credits from anon, authenticated;
revoke all on public.gemini_coach_credit_purchases from anon, authenticated;
revoke all on public.gemini_coach_reservations from anon, authenticated;

drop function if exists public.reserve_gemini_coach_request(uuid, integer, integer);

create or replace function public.reserve_gemini_coach_request(
  p_user_id uuid,
  p_user_limit integer,
  p_global_limit integer,
  p_request_id uuid
)
returns table(
  allowed boolean,
  user_used integer,
  global_used integer,
  credits_remaining integer,
  charged_credit boolean,
  reservation_id uuid
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_free_count integer;
  v_request_count integer;
  v_global_count integer;
  v_credits integer;
  v_charged_credit boolean := false;
begin
  if p_user_id is null or p_request_id is null or p_user_limit < 1 or p_global_limit < 1 then
    raise exception 'invalid_gemini_usage_limit';
  end if;

  insert into public.gemini_coach_global_usage (month_start, request_count)
  values (current_month, 0)
  on conflict (month_start) do nothing;
  insert into public.gemini_coach_usage (user_id, month_start, request_count, free_request_count)
  values (p_user_id, current_month, 0, 0)
  on conflict (user_id, month_start) do nothing;
  insert into public.gemini_coach_credits (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select request_count into v_global_count
  from public.gemini_coach_global_usage
  where month_start = current_month
  for update;

  select request_count, free_request_count into v_request_count, v_free_count
  from public.gemini_coach_usage
  where user_id = p_user_id and month_start = current_month
  for update;

  select balance into v_credits
  from public.gemini_coach_credits
  where user_id = p_user_id
  for update;

  if v_global_count >= p_global_limit then
    return query select false, v_free_count, v_global_count, v_credits, false, null::uuid;
    return;
  end if;

  if v_free_count < p_user_limit then
    update public.gemini_coach_usage
    set request_count = request_count + 1,
        free_request_count = free_request_count + 1
    where user_id = p_user_id and month_start = current_month
    returning request_count, free_request_count into v_request_count, v_free_count;
  elsif v_credits > 0 then
    update public.gemini_coach_credits
    set balance = balance - 1, updated_at = now()
    where user_id = p_user_id
    returning balance into v_credits;
    update public.gemini_coach_usage
    set request_count = request_count + 1
    where user_id = p_user_id and month_start = current_month
    returning request_count into v_request_count;
    v_charged_credit := true;
  else
    return query select false, v_free_count, v_global_count, v_credits, false, null::uuid;
    return;
  end if;

  update public.gemini_coach_global_usage
  set request_count = request_count + 1
  where month_start = current_month
  returning request_count into v_global_count;

  insert into public.gemini_coach_reservations (id, user_id, month_start, charged_credit)
  values (p_request_id, p_user_id, current_month, v_charged_credit);

  return query select true, v_free_count, v_global_count, v_credits, v_charged_credit, p_request_id;
end;
$$;

create or replace function public.complete_gemini_coach_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.gemini_coach_reservations
  set status = 'completed'
  where id = p_request_id and status = 'reserved';
  return found;
end;
$$;

create or replace function public.refund_gemini_coach_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_reservation public.gemini_coach_reservations%rowtype;
begin
  select * into v_reservation
  from public.gemini_coach_reservations
  where id = p_request_id
  for update;

  if not found or v_reservation.status <> 'reserved' then
    return false;
  end if;

  update public.gemini_coach_usage
  set request_count = greatest(request_count - 1, 0),
      free_request_count = case
        when v_reservation.charged_credit then free_request_count
        else greatest(free_request_count - 1, 0)
      end
  where user_id = v_reservation.user_id and month_start = v_reservation.month_start;

  update public.gemini_coach_global_usage
  set request_count = greatest(request_count - 1, 0)
  where month_start = v_reservation.month_start;

  if v_reservation.charged_credit then
    update public.gemini_coach_credits
    set balance = balance + 1, updated_at = now()
    where user_id = v_reservation.user_id;
  end if;

  update public.gemini_coach_reservations
  set status = 'refunded'
  where id = p_request_id;

  return true;
end;
$$;

create or replace function public.grant_gemini_coach_credits(
  p_checkout_session_id text,
  p_user_id uuid,
  p_credits integer
)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_checkout_session_id is null or p_user_id is null or p_credits is null or p_credits not in (100, 250) then
    raise exception 'invalid_gemini_credit_purchase';
  end if;

  insert into public.gemini_coach_credit_purchases (checkout_session_id, user_id, credits)
  values (p_checkout_session_id, p_user_id, p_credits)
  on conflict (checkout_session_id) do nothing;

  if not found then
    return false;
  end if;

  insert into public.gemini_coach_credits (user_id, balance)
  values (p_user_id, p_credits)
  on conflict (user_id) do update
  set balance = public.gemini_coach_credits.balance + excluded.balance,
      updated_at = now();

  return true;
end;
$$;

revoke all on function public.reserve_gemini_coach_request(uuid, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.complete_gemini_coach_request(uuid) from public, anon, authenticated;
revoke all on function public.refund_gemini_coach_request(uuid) from public, anon, authenticated;
revoke all on function public.grant_gemini_coach_credits(text, uuid, integer) from public, anon, authenticated;

grant execute on function public.reserve_gemini_coach_request(uuid, integer, integer, uuid) to service_role;
grant execute on function public.complete_gemini_coach_request(uuid) to service_role;
grant execute on function public.refund_gemini_coach_request(uuid) to service_role;
grant execute on function public.grant_gemini_coach_credits(text, uuid, integer) to service_role;

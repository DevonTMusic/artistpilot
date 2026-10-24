-- Apply this once to the Neon database after creating a project.
-- Better Auth tables are generated with `npx auth@latest migrate --config ./lib/auth/server.ts`.

create table if not exists profiles (
  id text primary key references "user"(id) on delete cascade,
  is_paid boolean not null default false,
  stripe_customer_id text,
  display_name text,
  main_instrument text not null default 'Guitar',
  default_bpm integer not null default 92 check (default_bpm between 50 and 200),
  weekly_goal integer not null default 5 check (weekly_goal between 1 and 40),
  notify_reminders boolean not null default false,
  notify_news boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists lesson_progress (
  user_id text not null references "user"(id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists gemini_coach_usage (
  user_id text not null references "user"(id) on delete cascade,
  month_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  free_request_count integer not null default 0 check (free_request_count >= 0),
  primary key (user_id, month_start)
);

create table if not exists gemini_coach_global_usage (
  month_start date primary key,
  request_count integer not null default 0 check (request_count >= 0)
);

create table if not exists gemini_coach_credits (
  user_id text primary key references "user"(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists gemini_coach_credit_purchases (
  checkout_session_id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  credits integer not null check (credits in (100, 250)),
  created_at timestamptz not null default now()
);

create table if not exists gemini_coach_reservations (
  id uuid primary key,
  user_id text not null references "user"(id) on delete cascade,
  month_start date not null,
  charged_credit boolean not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'refunded')),
  created_at timestamptz not null default now()
);

create or replace function reserve_gemini_coach_request(
  p_user_id text,
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

  insert into gemini_coach_global_usage (month_start, request_count)
  values (current_month, 0) on conflict (month_start) do nothing;
  insert into gemini_coach_usage (user_id, month_start, request_count, free_request_count)
  values (p_user_id, current_month, 0, 0) on conflict (user_id, month_start) do nothing;
  insert into gemini_coach_credits (user_id, balance)
  values (p_user_id, 0) on conflict (user_id) do nothing;

  select request_count into v_global_count from gemini_coach_global_usage
  where month_start = current_month for update;
  select request_count, free_request_count into v_request_count, v_free_count
  from gemini_coach_usage where user_id = p_user_id and month_start = current_month for update;
  select balance into v_credits from gemini_coach_credits where user_id = p_user_id for update;

  if v_global_count >= p_global_limit then
    return query select false, v_free_count, v_global_count, v_credits, false, null::uuid;
    return;
  end if;

  if v_free_count < p_user_limit then
    update gemini_coach_usage set request_count = request_count + 1,
      free_request_count = free_request_count + 1
    where user_id = p_user_id and month_start = current_month
    returning request_count, free_request_count into v_request_count, v_free_count;
  elsif v_credits > 0 then
    update gemini_coach_credits set balance = balance - 1, updated_at = now()
    where user_id = p_user_id returning balance into v_credits;
    update gemini_coach_usage set request_count = request_count + 1
    where user_id = p_user_id and month_start = current_month
    returning request_count into v_request_count;
    v_charged_credit := true;
  else
    return query select false, v_free_count, v_global_count, v_credits, false, null::uuid;
    return;
  end if;

  update gemini_coach_global_usage set request_count = request_count + 1
  where month_start = current_month returning request_count into v_global_count;
  insert into gemini_coach_reservations (id, user_id, month_start, charged_credit)
  values (p_request_id, p_user_id, current_month, v_charged_credit);
  return query select true, v_free_count, v_global_count, v_credits, v_charged_credit, p_request_id;
end;
$$;

create or replace function complete_gemini_coach_request(p_request_id uuid)
returns boolean language plpgsql as $$
begin
  update gemini_coach_reservations set status = 'completed'
  where id = p_request_id and status = 'reserved';
  return found;
end;
$$;

create or replace function refund_gemini_coach_request(p_request_id uuid)
returns boolean language plpgsql as $$
declare
  reservation gemini_coach_reservations%rowtype;
begin
  select * into reservation from gemini_coach_reservations
  where id = p_request_id for update;
  if not found or reservation.status <> 'reserved' then return false; end if;

  update gemini_coach_usage set request_count = greatest(request_count - 1, 0),
    free_request_count = case when reservation.charged_credit then free_request_count
                              else greatest(free_request_count - 1, 0) end
  where user_id = reservation.user_id and month_start = reservation.month_start;
  update gemini_coach_global_usage set request_count = greatest(request_count - 1, 0)
  where month_start = reservation.month_start;
  if reservation.charged_credit then
    update gemini_coach_credits set balance = balance + 1, updated_at = now()
    where user_id = reservation.user_id;
  end if;
  update gemini_coach_reservations set status = 'refunded' where id = p_request_id;
  return true;
end;
$$;

create or replace function grant_gemini_coach_credits(
  p_checkout_session_id text,
  p_user_id text,
  p_credits integer
)
returns boolean language plpgsql as $$
begin
  if p_checkout_session_id is null or p_user_id is null or p_credits not in (100, 250) then
    raise exception 'invalid_gemini_credit_purchase';
  end if;
  insert into gemini_coach_credit_purchases (checkout_session_id, user_id, credits)
  values (p_checkout_session_id, p_user_id, p_credits) on conflict (checkout_session_id) do nothing;
  if not found then return false; end if;
  insert into gemini_coach_credits (user_id, balance) values (p_user_id, p_credits)
  on conflict (user_id) do update set
    balance = gemini_coach_credits.balance + excluded.balance,
    updated_at = now();
  return true;
end;
$$;

create table if not exists studio_projects (
  id uuid primary key,
  owner_id text not null references "user"(id) on delete cascade,
  name text not null default 'Untitled Studio Project',
  file_path text not null,
  revision integer not null default 1 check (revision > 0),
  lock_user_id text references "user"(id) on delete set null,
  lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists studio_project_members (
  project_id uuid not null references studio_projects on delete cascade,
  user_id text not null references "user"(id) on delete cascade,
  role text not null default 'editor' check (role = 'editor'),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists studio_project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references studio_projects on delete cascade,
  token_hash text not null unique,
  created_by text not null references "user"(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists studio_project_members_user_idx on studio_project_members(user_id);
create index if not exists studio_projects_owner_idx on studio_projects(owner_id);
create index if not exists studio_projects_updated_idx on studio_projects(updated_at desc);

create or replace function claim_studio_project_edit(p_project_id uuid, p_user_id text)
returns jsonb language plpgsql as $$
declare current_editor text; current_expiry timestamptz;
begin
  if not exists (
    select 1 from studio_projects p where p.id = p_project_id
      and (p.owner_id = p_user_id or exists (
        select 1 from studio_project_members m where m.project_id = p.id and m.user_id = p_user_id
      ))
  ) then raise exception 'not_a_project_member'; end if;
  update studio_projects set lock_user_id = p_user_id, lock_expires_at = now() + interval '5 minutes'
  where id = p_project_id and (lock_user_id is null or lock_expires_at <= now() or lock_user_id = p_user_id)
  returning lock_user_id, lock_expires_at into current_editor, current_expiry;
  if not found then
    select lock_user_id, lock_expires_at into current_editor, current_expiry
    from studio_projects where id = p_project_id;
    return jsonb_build_object('acquired', false, 'editorId', current_editor, 'expiresAt', current_expiry);
  end if;
  return jsonb_build_object('acquired', true, 'editorId', current_editor, 'expiresAt', current_expiry);
end;
$$;

create or replace function release_studio_project_edit(p_project_id uuid, p_user_id text)
returns boolean language plpgsql as $$
begin
  update studio_projects set lock_user_id = null, lock_expires_at = null
  where id = p_project_id and lock_user_id = p_user_id;
  return found;
end;
$$;

create or replace function save_studio_project_revision(
  p_project_id uuid, p_file_path text, p_expected_revision integer, p_name text, p_user_id text
)
returns integer language plpgsql as $$
declare next_revision integer;
begin
  update studio_projects p set file_path = p_file_path, name = left(p_name, 120),
    revision = p.revision + 1, updated_at = now(), lock_expires_at = now() + interval '5 minutes'
  where p.id = p_project_id and p.revision = p_expected_revision
    and p.lock_user_id = p_user_id and p.lock_expires_at > now()
    and (p.owner_id = p_user_id or exists (
      select 1 from studio_project_members m where m.project_id = p.id and m.user_id = p_user_id
    ))
  returning p.revision into next_revision;
  if not found then raise exception 'edit_lease_or_revision_conflict'; end if;
  return next_revision;
end;
$$;

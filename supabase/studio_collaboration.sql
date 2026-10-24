-- Run once in Supabase: SQL Editor > New query > paste > Run
create table public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  name text not null default 'Untitled Studio Project',
  file_path text not null,
  revision integer not null default 1 check (revision > 0),
  lock_user_id uuid references auth.users on delete set null,
  lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studio_project_members (
  project_id uuid not null references public.studio_projects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'editor' check (role = 'editor'),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.studio_project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.studio_projects enable row level security;
alter table public.studio_project_members enable row level security;
alter table public.studio_project_invites enable row level security;

create or replace function public.studio_project_is_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.studio_projects p
    where p.id = p_project_id and p.owner_id = auth.uid()
  );
$$;

create or replace function public.studio_project_has_access(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.studio_project_is_owner(p_project_id)
    or exists (
      select 1 from public.studio_project_members m
      where m.project_id = p_project_id and m.user_id = auth.uid()
    );
$$;

create or replace function public.studio_project_is_owner_path(p_project_path text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.studio_projects p
    where p.id::text = p_project_path and p.owner_id = auth.uid()
  );
$$;

create or replace function public.studio_project_has_access_path(p_project_path text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.studio_projects p
    where p.id::text = p_project_path
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1 from public.studio_project_members m
          where m.project_id = p.id and m.user_id = auth.uid()
        )
      )
  );
$$;

create policy "read studio projects as member"
  on public.studio_projects for select
  using (public.studio_project_has_access(id));

create policy "read own studio memberships"
  on public.studio_project_members for select
  using (
    user_id = auth.uid()
    or public.studio_project_is_owner(project_id)
  );

create policy "read and revoke own studio invites"
  on public.studio_project_invites for select
  using (public.studio_project_is_owner(project_id));

grant execute on function public.studio_project_is_owner(uuid) to authenticated;
grant execute on function public.studio_project_has_access(uuid) to authenticated;
grant execute on function public.studio_project_is_owner_path(text) to authenticated;
grant execute on function public.studio_project_has_access_path(text) to authenticated;
revoke all on function public.studio_project_is_owner(uuid) from public;
revoke all on function public.studio_project_has_access(uuid) from public;
revoke all on function public.studio_project_is_owner_path(text) from public;
revoke all on function public.studio_project_has_access_path(text) from public;

create or replace function public.claim_studio_project_edit(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_editor uuid;
  current_expiry timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.studio_projects p
    where p.id = p_project_id
      and (p.owner_id = auth.uid() or exists (
        select 1 from public.studio_project_members m
        where m.project_id = p.id and m.user_id = auth.uid()
      ))
  ) then
    raise exception 'not_a_project_member';
  end if;

  update public.studio_projects
  set lock_user_id = auth.uid(),
      lock_expires_at = now() + interval '5 minutes'
  where id = p_project_id
    and (lock_user_id is null or lock_expires_at <= now() or lock_user_id = auth.uid())
  returning lock_user_id, lock_expires_at into current_editor, current_expiry;

  if not found then
    select lock_user_id, lock_expires_at
    into current_editor, current_expiry
    from public.studio_projects
    where id = p_project_id;
    return jsonb_build_object(
      'acquired', false,
      'editorId', current_editor,
      'expiresAt', current_expiry
    );
  end if;

  return jsonb_build_object(
    'acquired', true,
    'editorId', current_editor,
    'expiresAt', current_expiry
  );
end;
$$;

create or replace function public.release_studio_project_edit(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.studio_projects
  set lock_user_id = null, lock_expires_at = null
  where id = p_project_id and lock_user_id = auth.uid();
  return found;
end;
$$;

create or replace function public.save_studio_project_revision(
  p_project_id uuid,
  p_file_path text,
  p_expected_revision integer,
  p_name text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_revision integer;
begin
  update public.studio_projects p
  set file_path = p_file_path,
      name = left(p_name, 120),
      revision = p.revision + 1,
      updated_at = now(),
      lock_expires_at = now() + interval '5 minutes'
  where p.id = p_project_id
    and p.revision = p_expected_revision
    and p.lock_user_id = auth.uid()
    and p.lock_expires_at > now()
    and (p.owner_id = auth.uid() or exists (
      select 1 from public.studio_project_members m
      where m.project_id = p.id and m.user_id = auth.uid()
    ))
  returning p.revision into next_revision;

  if not found then
    raise exception 'edit_lease_or_revision_conflict';
  end if;
  return next_revision;
end;
$$;

grant execute on function public.claim_studio_project_edit(uuid) to authenticated;
grant execute on function public.release_studio_project_edit(uuid) to authenticated;
grant execute on function public.save_studio_project_revision(uuid, text, integer, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('studio-shared', 'studio-shared', false, 104857600)
on conflict (id) do nothing;

create policy "read shared studio project files"
  on storage.objects for select
  using (
    bucket_id = 'studio-shared'
    and public.studio_project_has_access_path((storage.foldername(name))[1])
  );

create policy "delete shared studio project files as owner"
  on storage.objects for delete
  using (
    bucket_id = 'studio-shared'
    and public.studio_project_is_owner_path((storage.foldername(name))[1])
  );

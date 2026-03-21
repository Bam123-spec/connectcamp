alter table if exists public.club_tasks
  add column if not exists club_id uuid references public.clubs(id) on delete set null,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists status text default 'not_started',
  add column if not exists priority text default 'medium',
  add column if not exists collaborating_club_ids uuid[] default '{}'::uuid[],
  add column if not exists completed_at timestamptz;

update public.club_tasks
set status = case when is_completed then 'completed' else 'not_started' end;

update public.club_tasks
set priority = 'medium'
where priority is null;

update public.club_tasks
set collaborating_club_ids = '{}'::uuid[]
where collaborating_club_ids is null;

update public.club_tasks
set completed_at = case
  when is_completed then coalesce(completed_at, updated_at, created_at, now())
  else null
end;

alter table if exists public.club_tasks
  alter column status set default 'not_started',
  alter column status set not null,
  alter column priority set default 'medium',
  alter column priority set not null,
  alter column collaborating_club_ids set default '{}'::uuid[],
  alter column collaborating_club_ids set not null;

alter table if exists public.club_tasks
  drop constraint if exists club_tasks_status_check,
  drop constraint if exists club_tasks_priority_check;

alter table if exists public.club_tasks
  add constraint club_tasks_status_check
  check (status in ('not_started', 'in_progress', 'waiting_on_club', 'waiting_on_admin', 'blocked', 'completed'));

alter table if exists public.club_tasks
  add constraint club_tasks_priority_check
  check (priority in ('low', 'medium', 'high', 'urgent'));

create index if not exists club_tasks_club_id_idx on public.club_tasks(club_id);
create index if not exists club_tasks_assigned_to_idx on public.club_tasks(assigned_to);
create index if not exists club_tasks_status_idx on public.club_tasks(status);
create index if not exists club_tasks_due_date_idx on public.club_tasks(due_date);
create index if not exists club_tasks_priority_idx on public.club_tasks(priority);
create index if not exists club_tasks_collaborating_club_ids_idx on public.club_tasks using gin(collaborating_club_ids);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.club_tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint task_comments_body_check check (length(trim(body)) > 0)
);

create index if not exists task_comments_task_id_created_at_idx on public.task_comments(task_id, created_at desc);

alter table public.task_comments enable row level security;

create or replace function private.user_manages_club(target_club_id uuid)
returns boolean
language sql
security definer
set search_path to ''
as $$
  select auth.uid() is not null
    and target_club_id is not null
    and (
      private.is_admin_user()
      or exists (
        select 1
        from public.officers o
        where o.user_id = auth.uid()
          and o.club_id = target_club_id
      )
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.club_id = target_club_id
          and ur.role = 'officer'
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.club_id = target_club_id
          and p.role = 'officer'
      )
    );
$$;

create or replace function private.can_assign_task_clubs(target_club_id uuid, collaborator_club_ids uuid[])
returns boolean
language sql
security definer
set search_path to ''
as $$
  select auth.uid() is not null
    and (
      private.is_admin_user()
      or (
        (
          target_club_id is null
          or private.user_manages_club(target_club_id)
        )
        and not exists (
          select 1
          from unnest(coalesce(collaborator_club_ids, '{}'::uuid[])) as collaborator_club_id
          where not private.user_manages_club(collaborator_club_id)
        )
      )
    );
$$;

create or replace function private.can_access_task(
  target_club_id uuid,
  target_assigned_to uuid,
  target_collaborating_club_ids uuid[],
  target_created_by uuid
)
returns boolean
language sql
security definer
set search_path to ''
as $$
  select auth.uid() is not null
    and (
      private.is_admin_user()
      or target_created_by = auth.uid()
      or target_assigned_to = auth.uid()
      or private.user_manages_club(target_club_id)
      or exists (
        select 1
        from unnest(coalesce(target_collaborating_club_ids, '{}'::uuid[])) as collaborator_club_id
        where private.user_manages_club(collaborator_club_id)
      )
    );
$$;

grant execute on function private.user_manages_club(uuid) to authenticated;
grant execute on function private.can_assign_task_clubs(uuid, uuid[]) to authenticated;
grant execute on function private.can_access_task(uuid, uuid, uuid[], uuid) to authenticated;

create or replace function public.sync_task_completion_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' then
    new.is_completed := true;
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  else
    new.is_completed := false;
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_task_completion_fields on public.club_tasks;

create trigger sync_task_completion_fields
before insert or update on public.club_tasks
for each row
execute function public.sync_task_completion_fields();

drop policy if exists "Admins can do everything on club_tasks" on public.club_tasks;
drop policy if exists club_tasks_select_accessible on public.club_tasks;
drop policy if exists club_tasks_insert_creators on public.club_tasks;
drop policy if exists club_tasks_update_accessible on public.club_tasks;
drop policy if exists club_tasks_delete_owners on public.club_tasks;

create policy club_tasks_select_accessible
on public.club_tasks
for select
to authenticated
using (
  private.can_access_task(club_id, assigned_to, collaborating_club_ids, created_by)
);

create policy club_tasks_insert_creators
on public.club_tasks
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and private.can_assign_task_clubs(club_id, collaborating_club_ids)
);

create policy club_tasks_update_accessible
on public.club_tasks
for update
to authenticated
using (
  private.can_access_task(club_id, assigned_to, collaborating_club_ids, created_by)
)
with check (
  auth.uid() is not null
  and (
    private.is_admin_user()
    or created_by = auth.uid()
    or private.can_assign_task_clubs(club_id, collaborating_club_ids)
  )
);

create policy club_tasks_delete_owners
on public.club_tasks
for delete
to authenticated
using (
  private.is_admin_user()
  or created_by = auth.uid()
);

drop policy if exists task_comments_select_accessible on public.task_comments;
drop policy if exists task_comments_insert_accessible on public.task_comments;
drop policy if exists task_comments_delete_owners on public.task_comments;

create policy task_comments_select_accessible
on public.task_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.club_tasks t
    where t.id = task_comments.task_id
      and private.can_access_task(t.club_id, t.assigned_to, t.collaborating_club_ids, t.created_by)
  )
);

create policy task_comments_insert_accessible
on public.task_comments
for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.club_tasks t
    where t.id = task_comments.task_id
      and private.can_access_task(t.club_id, t.assigned_to, t.collaborating_club_ids, t.created_by)
  )
);

create policy task_comments_delete_owners
on public.task_comments
for delete
to authenticated
using (
  author_id = auth.uid()
  or private.is_admin_user()
);

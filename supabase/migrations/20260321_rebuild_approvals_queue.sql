create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  entity_type text not null check (entity_type in ('club', 'event', 'budget')),
  entity_id uuid not null,
  queue text not null check (queue in ('clubs', 'events', 'budgets')),
  title text not null,
  summary text null,
  status text not null default 'pending_review' check (status in ('pending_review', 'in_review', 'changes_requested', 'approved', 'rejected')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  submitted_by uuid null references public.profiles(id) on delete set null,
  assigned_to uuid null references public.profiles(id) on delete set null,
  decided_by uuid null references public.profiles(id) on delete set null,
  decision_note text null,
  source_created_at timestamptz null,
  submitted_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  decided_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index if not exists approval_requests_org_queue_idx
  on public.approval_requests (org_id, queue, status, last_action_at desc);

create index if not exists approval_requests_assigned_idx
  on public.approval_requests (assigned_to, status, priority);

create table if not exists public.approval_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests(id) on delete cascade,
  org_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  kind text not null default 'note' check (kind in ('note', 'decision')),
  created_at timestamptz not null default now()
);

create index if not exists approval_comments_request_idx
  on public.approval_comments (request_id, created_at desc);

create table if not exists public.approval_activity (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests(id) on delete cascade,
  org_id uuid not null,
  actor_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  from_status text null,
  to_status text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists approval_activity_request_idx
  on public.approval_activity (request_id, created_at desc);

create or replace function public.set_approval_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists approval_requests_set_updated_at on public.approval_requests;
create trigger approval_requests_set_updated_at
before update on public.approval_requests
for each row execute function public.set_approval_request_updated_at();

alter table public.approval_requests enable row level security;
alter table public.approval_comments enable row level security;
alter table public.approval_activity enable row level security;

drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select
on public.approval_requests
for select
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists approval_requests_insert on public.approval_requests;
create policy approval_requests_insert
on public.approval_requests
for insert
to authenticated
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists approval_requests_update on public.approval_requests;
create policy approval_requests_update
on public.approval_requests
for update
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
)
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists approval_comments_select on public.approval_comments;
create policy approval_comments_select
on public.approval_comments
for select
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists approval_comments_insert on public.approval_comments;
create policy approval_comments_insert
on public.approval_comments
for insert
to authenticated
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
  and author_id = auth.uid()
);

drop policy if exists approval_activity_select on public.approval_activity;
create policy approval_activity_select
on public.approval_activity
for select
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

create or replace function public.sync_approval_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid := public.current_profile_org_id();
  inserted_clubs integer := 0;
  inserted_events integer := 0;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only Student Life admins can sync approvals.';
  end if;

  if resolved_org_id is null then
    raise exception 'Admin profile is missing an organization.';
  end if;

  with club_upsert as (
    insert into public.approval_requests (
      org_id,
      entity_type,
      entity_id,
      queue,
      title,
      summary,
      status,
      priority,
      submitted_by,
      source_created_at,
      submitted_at,
      metadata
    )
    select
      c.org_id,
      'club',
      c.id,
      'clubs',
      c.name,
      c.description,
      case when coalesce(c.approved, false) then 'approved' else 'pending_review' end,
      case when coalesce(c.approved, false) then 'medium' else 'high' end,
      c.primary_user_id,
      coalesce(c.created_at at time zone 'utc', now()),
      coalesce(c.created_at at time zone 'utc', now()),
      jsonb_build_object(
        'location', c.location,
        'meeting_day', c.day,
        'meeting_time', c.time,
        'email', c.email,
        'approved', c.approved
      )
    from public.clubs c
    where c.org_id = resolved_org_id
    on conflict (entity_type, entity_id) do update
    set
      org_id = excluded.org_id,
      queue = excluded.queue,
      title = excluded.title,
      summary = excluded.summary,
      submitted_by = coalesce(public.approval_requests.submitted_by, excluded.submitted_by),
      source_created_at = excluded.source_created_at,
      submitted_at = coalesce(public.approval_requests.submitted_at, excluded.submitted_at),
      metadata = excluded.metadata,
      status = case
        when excluded.status = 'approved' then 'approved'
        when public.approval_requests.status = 'approved' and excluded.status <> 'approved' then 'pending_review'
        else public.approval_requests.status
      end,
      priority = case
        when public.approval_requests.status = 'approved' then public.approval_requests.priority
        else excluded.priority
      end,
      last_action_at = case
        when public.approval_requests.status = 'approved' and excluded.status <> 'approved' then now()
        when public.approval_requests.title is distinct from excluded.title then now()
        when public.approval_requests.summary is distinct from excluded.summary then now()
        else public.approval_requests.last_action_at
      end,
      updated_at = now()
    returning xmax = 0 as inserted
  )
  select count(*) filter (where inserted) into inserted_clubs from club_upsert;

  with event_upsert as (
    insert into public.approval_requests (
      org_id,
      entity_type,
      entity_id,
      queue,
      title,
      summary,
      status,
      priority,
      submitted_by,
      source_created_at,
      submitted_at,
      metadata
    )
    select
      resolved_org_id,
      'event',
      e.id,
      'events',
      coalesce(e.name, 'Untitled event'),
      e.description,
      case when coalesce(e.approved, false) then 'approved' else 'pending_review' end,
      case
        when e.date is null or e.time is null or e.location is null then 'high'
        when coalesce(e.approved, false) then 'medium'
        else 'high'
      end,
      null,
      coalesce(e.created_at at time zone 'utc', now()),
      coalesce(e.created_at at time zone 'utc', now()),
      jsonb_build_object(
        'date', e.date,
        'time', e.time,
        'location', e.location,
        'club_id', e.club_id,
        'club_name', c.name,
        'approved', e.approved
      )
    from public.events e
    left join public.clubs c on c.id = e.club_id
    where c.org_id = resolved_org_id or e.club_id is null
    on conflict (entity_type, entity_id) do update
    set
      org_id = excluded.org_id,
      queue = excluded.queue,
      title = excluded.title,
      summary = excluded.summary,
      source_created_at = excluded.source_created_at,
      submitted_at = coalesce(public.approval_requests.submitted_at, excluded.submitted_at),
      metadata = excluded.metadata,
      status = case
        when excluded.status = 'approved' then 'approved'
        when public.approval_requests.status = 'approved' and excluded.status <> 'approved' then 'pending_review'
        else public.approval_requests.status
      end,
      priority = case
        when public.approval_requests.status = 'approved' then public.approval_requests.priority
        else excluded.priority
      end,
      last_action_at = case
        when public.approval_requests.status = 'approved' and excluded.status <> 'approved' then now()
        when public.approval_requests.title is distinct from excluded.title then now()
        when public.approval_requests.summary is distinct from excluded.summary then now()
        else public.approval_requests.last_action_at
      end,
      updated_at = now()
    returning xmax = 0 as inserted
  )
  select count(*) filter (where inserted) into inserted_events from event_upsert;

  return jsonb_build_object(
    'inserted_clubs', inserted_clubs,
    'inserted_events', inserted_events
  );
end;
$$;

grant execute on function public.sync_approval_requests() to authenticated;

create or replace function public.assign_approval_request(target_request_id uuid, target_assignee_id uuid, note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid;
  previous_assignee uuid;
  next_assignee_name text;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only Student Life admins can assign approval requests.';
  end if;

  select org_id, assigned_to
    into resolved_org_id, previous_assignee
  from public.approval_requests
  where id = target_request_id;

  if resolved_org_id is null or not public.org_matches(resolved_org_id) then
    raise exception 'Approval request not found in this workspace.';
  end if;

  if target_assignee_id is not null then
    select coalesce(full_name, email, 'Admin')
      into next_assignee_name
    from public.profiles
    where id = target_assignee_id
      and org_id = resolved_org_id
      and coalesce(role, '') in ('admin', 'student_life_admin', 'super_admin');

    if next_assignee_name is null then
      raise exception 'Assignee must be an admin in this workspace.';
    end if;
  end if;

  update public.approval_requests
  set
    assigned_to = target_assignee_id,
    last_action_at = now(),
    updated_at = now()
  where id = target_request_id;

  insert into public.approval_activity (request_id, org_id, actor_id, action, payload)
  values (
    target_request_id,
    resolved_org_id,
    auth.uid(),
    'assigned',
    jsonb_build_object('assigned_to', target_assignee_id)
  );

  if note is not null and length(trim(note)) > 0 then
    insert into public.approval_comments (request_id, org_id, author_id, body, kind)
    values (target_request_id, resolved_org_id, auth.uid(), trim(note), 'note');
  end if;

  return true;
end;
$$;

grant execute on function public.assign_approval_request(uuid, uuid, text) to authenticated;

create or replace function public.update_approval_priority(target_request_id uuid, next_priority text, note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid;
  previous_priority text;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only Student Life admins can change approval priority.';
  end if;

  if next_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid priority value.';
  end if;

  select org_id, priority
    into resolved_org_id, previous_priority
  from public.approval_requests
  where id = target_request_id;

  if resolved_org_id is null or not public.org_matches(resolved_org_id) then
    raise exception 'Approval request not found in this workspace.';
  end if;

  update public.approval_requests
  set
    priority = next_priority,
    last_action_at = now(),
    updated_at = now()
  where id = target_request_id;

  insert into public.approval_activity (request_id, org_id, actor_id, action, payload)
  values (
    target_request_id,
    resolved_org_id,
    auth.uid(),
    'priority_changed',
    jsonb_build_object('from_priority', previous_priority, 'to_priority', next_priority)
  );

  if note is not null and length(trim(note)) > 0 then
    insert into public.approval_comments (request_id, org_id, author_id, body, kind)
    values (target_request_id, resolved_org_id, auth.uid(), trim(note), 'note');
  end if;

  return true;
end;
$$;

grant execute on function public.update_approval_priority(uuid, text, text) to authenticated;

create or replace function public.add_approval_comment(target_request_id uuid, body text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only Student Life admins can comment on approvals.';
  end if;

  if body is null or length(trim(body)) = 0 then
    raise exception 'Comment body is required.';
  end if;

  select org_id
    into resolved_org_id
  from public.approval_requests
  where id = target_request_id;

  if resolved_org_id is null or not public.org_matches(resolved_org_id) then
    raise exception 'Approval request not found in this workspace.';
  end if;

  insert into public.approval_comments (request_id, org_id, author_id, body, kind)
  values (target_request_id, resolved_org_id, auth.uid(), trim(body), 'note');

  insert into public.approval_activity (request_id, org_id, actor_id, action, payload)
  values (
    target_request_id,
    resolved_org_id,
    auth.uid(),
    'commented',
    jsonb_build_object('preview', left(trim(body), 120))
  );

  update public.approval_requests
  set last_action_at = now(), updated_at = now()
  where id = target_request_id;

  return true;
end;
$$;

grant execute on function public.add_approval_comment(uuid, text) to authenticated;

create or replace function public.set_approval_status(target_request_id uuid, next_status text, note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.approval_requests%rowtype;
  resolved_note text := nullif(trim(coalesce(note, '')), '');
  bool_value boolean;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only Student Life admins can update approval status.';
  end if;

  if next_status not in ('pending_review', 'in_review', 'changes_requested', 'approved', 'rejected') then
    raise exception 'Invalid status value.';
  end if;

  select *
    into request_record
  from public.approval_requests
  where id = target_request_id;

  if request_record.id is null or not public.org_matches(request_record.org_id) then
    raise exception 'Approval request not found in this workspace.';
  end if;

  update public.approval_requests
  set
    status = next_status,
    decision_note = case when resolved_note is not null then resolved_note else decision_note end,
    decided_by = case when next_status in ('approved', 'rejected', 'changes_requested') then auth.uid() else null end,
    decided_at = case when next_status in ('approved', 'rejected', 'changes_requested') then now() else null end,
    last_action_at = now(),
    updated_at = now()
  where id = target_request_id;

  insert into public.approval_activity (request_id, org_id, actor_id, action, from_status, to_status, payload)
  values (
    target_request_id,
    request_record.org_id,
    auth.uid(),
    'status_changed',
    request_record.status,
    next_status,
    jsonb_build_object('note_present', resolved_note is not null)
  );

  if resolved_note is not null then
    insert into public.approval_comments (request_id, org_id, author_id, body, kind)
    values (
      target_request_id,
      request_record.org_id,
      auth.uid(),
      resolved_note,
      case when next_status in ('approved', 'rejected', 'changes_requested') then 'decision' else 'note' end
    );
  end if;

  bool_value := case when next_status = 'approved' then true else false end;

  if request_record.entity_type = 'club' then
    update public.clubs
    set approved = bool_value
    where id = request_record.entity_id;
  elsif request_record.entity_type = 'event' then
    update public.events
    set approved = bool_value
    where id = request_record.entity_id;
  end if;

  return true;
end;
$$;

grant execute on function public.set_approval_status(uuid, text, text) to authenticated;

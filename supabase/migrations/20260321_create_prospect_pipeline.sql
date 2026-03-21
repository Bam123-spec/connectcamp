create extension if not exists pgcrypto;

create table if not exists public.prospect_clubs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  description text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'needs_documents', 'meeting_scheduled', 'approved', 'rejected', 'converted')),
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  linked_club_id uuid references public.clubs(id) on delete set null,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes_summary text,
  cover_image_url text,
  meeting_scheduled_for timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  converted_at timestamptz,
  origin text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospect_clubs_org_status_idx
  on public.prospect_clubs (org_id, status, updated_at desc);
create index if not exists prospect_clubs_org_assigned_idx
  on public.prospect_clubs (org_id, assigned_to);
create unique index if not exists prospect_clubs_linked_club_uidx
  on public.prospect_clubs (linked_club_id)
  where linked_club_id is not null;

create table if not exists public.prospect_requirements (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_clubs(id) on delete cascade,
  org_id uuid not null,
  label text not null,
  requirement_type text not null default 'document' check (requirement_type in ('document', 'form', 'meeting', 'roster', 'advisor', 'other')),
  is_required boolean not null default true,
  is_complete boolean not null default false,
  linked_form_id uuid references public.forms(id) on delete set null,
  document_url text,
  notes text,
  display_order integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospect_requirements_prospect_idx
  on public.prospect_requirements (prospect_id, display_order asc, created_at asc);
create index if not exists prospect_requirements_org_idx
  on public.prospect_requirements (org_id);

create table if not exists public.prospect_notes (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_clubs(id) on delete cascade,
  org_id uuid not null,
  author_id uuid not null references public.profiles(id),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists prospect_notes_prospect_idx
  on public.prospect_notes (prospect_id, created_at desc);

create table if not exists public.prospect_activity (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_clubs(id) on delete cascade,
  org_id uuid not null,
  actor_id uuid references public.profiles(id),
  action text not null,
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists prospect_activity_prospect_idx
  on public.prospect_activity (prospect_id, created_at desc);

create or replace function public.set_prospect_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prospect_clubs_updated_at on public.prospect_clubs;
create trigger trg_prospect_clubs_updated_at
before update on public.prospect_clubs
for each row execute function public.set_prospect_updated_at();

drop trigger if exists trg_prospect_requirements_updated_at on public.prospect_requirements;
create trigger trg_prospect_requirements_updated_at
before update on public.prospect_requirements
for each row execute function public.set_prospect_updated_at();

create or replace function public.bootstrap_prospect_requirements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.prospect_requirements (
    prospect_id,
    org_id,
    label,
    requirement_type,
    display_order,
    notes
  )
  values
    (new.id, new.org_id, 'Founding officer roster submitted', 'roster', 10, 'List at least two student leaders with contact information.'),
    (new.id, new.org_id, 'Advisor identified', 'advisor', 20, 'Confirm a faculty or staff advisor before approval.'),
    (new.id, new.org_id, 'Constitution or charter draft', 'document', 30, 'Upload or link the proposed constitution or charter.'),
    (new.id, new.org_id, 'Student Life intake meeting', 'meeting', 40, 'Schedule and complete an onboarding meeting with Student Life.')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_bootstrap_prospect_requirements on public.prospect_clubs;
create trigger trg_bootstrap_prospect_requirements
after insert on public.prospect_clubs
for each row execute function public.bootstrap_prospect_requirements();

create or replace function public.log_prospect_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.prospect_activity (
    prospect_id,
    org_id,
    actor_id,
    action,
    from_status,
    to_status,
    payload
  )
  values (
    new.id,
    new.org_id,
    auth.uid(),
    'created',
    null,
    new.status,
    jsonb_build_object(
      'name', new.name,
      'assigned_to', new.assigned_to,
      'contact_email', new.contact_email,
      'origin', new.origin
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_log_prospect_insert on public.prospect_clubs;
create trigger trg_log_prospect_insert
after insert on public.prospect_clubs
for each row execute function public.log_prospect_insert();

create or replace function public.log_prospect_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.prospect_activity (
      prospect_id,
      org_id,
      actor_id,
      action,
      from_status,
      to_status,
      payload
    )
    values (
      new.id,
      new.org_id,
      auth.uid(),
      'status_changed',
      old.status,
      new.status,
      jsonb_build_object('meeting_scheduled_for', new.meeting_scheduled_for)
    );
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.prospect_activity (
      prospect_id,
      org_id,
      actor_id,
      action,
      from_status,
      to_status,
      payload
    )
    values (
      new.id,
      new.org_id,
      auth.uid(),
      'assignment_changed',
      new.status,
      new.status,
      jsonb_build_object('from_assigned_to', old.assigned_to, 'to_assigned_to', new.assigned_to)
    );
  end if;

  if old.meeting_scheduled_for is distinct from new.meeting_scheduled_for and new.meeting_scheduled_for is not null then
    insert into public.prospect_activity (
      prospect_id,
      org_id,
      actor_id,
      action,
      from_status,
      to_status,
      payload
    )
    values (
      new.id,
      new.org_id,
      auth.uid(),
      'meeting_updated',
      new.status,
      new.status,
      jsonb_build_object('meeting_scheduled_for', new.meeting_scheduled_for)
    );
  end if;

  if old.linked_club_id is distinct from new.linked_club_id and new.linked_club_id is not null then
    insert into public.prospect_activity (
      prospect_id,
      org_id,
      actor_id,
      action,
      from_status,
      to_status,
      payload
    )
    values (
      new.id,
      new.org_id,
      auth.uid(),
      'converted_to_club',
      old.status,
      new.status,
      jsonb_build_object('linked_club_id', new.linked_club_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_prospect_update on public.prospect_clubs;
create trigger trg_log_prospect_update
after update on public.prospect_clubs
for each row execute function public.log_prospect_update();

create or replace function public.log_prospect_requirement_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_complete is distinct from new.is_complete then
    insert into public.prospect_activity (
      prospect_id,
      org_id,
      actor_id,
      action,
      from_status,
      to_status,
      payload
    )
    values (
      new.prospect_id,
      new.org_id,
      auth.uid(),
      case when new.is_complete then 'requirement_completed' else 'requirement_reopened' end,
      null,
      null,
      jsonb_build_object(
        'requirement_id', new.id,
        'label', new.label,
        'requirement_type', new.requirement_type
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_prospect_requirement_update on public.prospect_requirements;
create trigger trg_log_prospect_requirement_update
after update on public.prospect_requirements
for each row execute function public.log_prospect_requirement_update();

alter table public.admin_conversations
  add column if not exists prospect_id uuid references public.prospect_clubs(id) on delete set null;

alter table public.admin_conversations
  drop constraint if exists admin_conversations_type_check;

alter table public.admin_conversations
  add constraint admin_conversations_type_check
  check (type in ('club', 'admin', 'prospect'));

create or replace function public.ensure_prospect_conversation(target_prospect_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid := public.current_profile_org_id();
  prospect_record record;
  conversation_id uuid;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can create prospect conversations.';
  end if;

  if resolved_org_id is null then
    raise exception 'Admin profile is missing an organization.';
  end if;

  select p.id, p.org_id, p.name, p.assigned_to
    into prospect_record
  from public.prospect_clubs p
  where p.id = target_prospect_id;

  if prospect_record.id is null or prospect_record.org_id <> resolved_org_id then
    raise exception 'Prospect not found in this workspace.';
  end if;

  select ac.id
    into conversation_id
  from public.admin_conversations ac
  where ac.org_id = resolved_org_id
    and ac.type = 'prospect'
    and ac.prospect_id = target_prospect_id
  order by ac.created_at asc
  limit 1;

  if conversation_id is null then
    insert into public.admin_conversations (org_id, type, created_by, subject, prospect_id)
    values (resolved_org_id, 'prospect', auth.uid(), prospect_record.name, target_prospect_id)
    returning id into conversation_id;
  end if;

  insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
  select conversation_id, resolved_org_id, p.id, 'admin', null
  from public.profiles p
  where p.org_id = resolved_org_id
    and coalesce(p.role, '') in ('admin', 'student_life_admin', 'super_admin')
  on conflict (conversation_id, user_id) do nothing;

  insert into public.admin_message_reads (conversation_id, org_id, user_id, last_read_at)
  select conversation_id, resolved_org_id, p.id, to_timestamp(0)
  from public.profiles p
  where p.org_id = resolved_org_id
    and coalesce(p.role, '') in ('admin', 'student_life_admin', 'super_admin')
  on conflict (conversation_id, user_id) do nothing;

  return conversation_id;
end;
$$;

grant execute on function public.ensure_prospect_conversation(uuid) to authenticated;

create or replace function public.add_prospect_note(target_prospect_id uuid, note_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid := public.current_profile_org_id();
  new_note_id uuid;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can add prospect notes.';
  end if;

  if resolved_org_id is null then
    raise exception 'Admin profile is missing an organization.';
  end if;

  if not exists (
    select 1
    from public.prospect_clubs p
    where p.id = target_prospect_id
      and p.org_id = resolved_org_id
  ) then
    raise exception 'Prospect not found in this workspace.';
  end if;

  insert into public.prospect_notes (prospect_id, org_id, author_id, body)
  values (target_prospect_id, resolved_org_id, auth.uid(), trim(note_body))
  returning id into new_note_id;

  insert into public.prospect_activity (prospect_id, org_id, actor_id, action, payload)
  values (
    target_prospect_id,
    resolved_org_id,
    auth.uid(),
    'note_added',
    jsonb_build_object('note_id', new_note_id)
  );

  return new_note_id;
end;
$$;

grant execute on function public.add_prospect_note(uuid, text) to authenticated;

create or replace function public.set_prospect_status(target_prospect_id uuid, next_status text, status_note text default null, scheduled_for timestamptz default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid := public.current_profile_org_id();
  current_record public.prospect_clubs%rowtype;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can update prospect status.';
  end if;

  if next_status not in ('new', 'reviewing', 'needs_documents', 'meeting_scheduled', 'approved', 'rejected', 'converted') then
    raise exception 'Invalid prospect status.';
  end if;

  select *
    into current_record
  from public.prospect_clubs
  where id = target_prospect_id;

  if current_record.id is null or current_record.org_id <> resolved_org_id then
    raise exception 'Prospect not found in this workspace.';
  end if;

  update public.prospect_clubs
  set status = next_status,
      meeting_scheduled_for = case when next_status = 'meeting_scheduled' then coalesce(scheduled_for, meeting_scheduled_for) else meeting_scheduled_for end,
      approved_at = case when next_status = 'approved' then now() else approved_at end,
      rejected_at = case when next_status = 'rejected' then now() else rejected_at end,
      converted_at = case when next_status = 'converted' then now() else converted_at end
  where id = target_prospect_id;

  if coalesce(trim(status_note), '') <> '' then
    perform public.add_prospect_note(target_prospect_id, trim(status_note));
  end if;

  return true;
end;
$$;

grant execute on function public.set_prospect_status(uuid, text, text, timestamptz) to authenticated;

create or replace function public.convert_prospect_to_club(target_prospect_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid := public.current_profile_org_id();
  prospect_record public.prospect_clubs%rowtype;
  next_club_id uuid;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can convert prospects.';
  end if;

  select *
    into prospect_record
  from public.prospect_clubs
  where id = target_prospect_id;

  if prospect_record.id is null or prospect_record.org_id <> resolved_org_id then
    raise exception 'Prospect not found in this workspace.';
  end if;

  if prospect_record.linked_club_id is not null then
    return prospect_record.linked_club_id;
  end if;

  insert into public.clubs (
    name,
    description,
    approved,
    location,
    day,
    time,
    cover_image_url,
    member_count,
    email,
    org_id,
    primary_user_id
  )
  values (
    prospect_record.name,
    prospect_record.description,
    true,
    null,
    null,
    null,
    prospect_record.cover_image_url,
    0,
    prospect_record.contact_email,
    prospect_record.org_id,
    null
  )
  returning id into next_club_id;

  update public.prospect_clubs
  set linked_club_id = next_club_id,
      status = 'converted',
      converted_at = now(),
      approved_at = coalesce(approved_at, now())
  where id = target_prospect_id;

  update public.admin_conversations
  set type = 'club',
      club_id = next_club_id,
      prospect_id = null,
      subject = prospect_record.name,
      updated_at = now()
  where prospect_id = target_prospect_id;

  perform public.sync_approval_requests();

  return next_club_id;
end;
$$;

grant execute on function public.convert_prospect_to_club(uuid) to authenticated;

alter table public.prospect_clubs enable row level security;
alter table public.prospect_requirements enable row level security;
alter table public.prospect_notes enable row level security;
alter table public.prospect_activity enable row level security;

drop policy if exists prospect_clubs_select on public.prospect_clubs;
create policy prospect_clubs_select
on public.prospect_clubs
for select
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists prospect_clubs_insert on public.prospect_clubs;
create policy prospect_clubs_insert
on public.prospect_clubs
for insert
to authenticated
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
  and created_by = auth.uid()
);

drop policy if exists prospect_clubs_update on public.prospect_clubs;
create policy prospect_clubs_update
on public.prospect_clubs
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

drop policy if exists prospect_clubs_delete on public.prospect_clubs;
create policy prospect_clubs_delete
on public.prospect_clubs
for delete
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists prospect_requirements_select on public.prospect_requirements;
create policy prospect_requirements_select
on public.prospect_requirements
for select
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists prospect_requirements_insert on public.prospect_requirements;
create policy prospect_requirements_insert
on public.prospect_requirements
for insert
to authenticated
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists prospect_requirements_update on public.prospect_requirements;
create policy prospect_requirements_update
on public.prospect_requirements
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

drop policy if exists prospect_requirements_delete on public.prospect_requirements;
create policy prospect_requirements_delete
on public.prospect_requirements
for delete
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists prospect_notes_select on public.prospect_notes;
create policy prospect_notes_select
on public.prospect_notes
for select
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists prospect_notes_insert on public.prospect_notes;
create policy prospect_notes_insert
on public.prospect_notes
for insert
to authenticated
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
  and author_id = auth.uid()
);

drop policy if exists prospect_notes_delete on public.prospect_notes;
create policy prospect_notes_delete
on public.prospect_notes
for delete
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists prospect_activity_select on public.prospect_activity;
create policy prospect_activity_select
on public.prospect_activity
for select
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

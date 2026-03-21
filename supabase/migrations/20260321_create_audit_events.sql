create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_id uuid null,
  category text not null,
  action text not null,
  entity_type text null,
  entity_id uuid null,
  title text not null,
  summary text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx
  on public.audit_events (org_id, created_at desc);

create index if not exists audit_events_org_category_created_idx
  on public.audit_events (org_id, category, created_at desc);

alter table public.audit_events enable row level security;

create or replace function public.log_audit_event(
  target_org_id uuid,
  target_category text,
  target_action text,
  target_entity_type text default null,
  target_entity_id uuid default null,
  target_title text default null,
  target_summary text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  inserted_id uuid;
begin
  actor := auth.uid();

  if actor is null then
    raise exception 'Authentication required';
  end if;

  if target_org_id is null then
    raise exception 'Organization is required';
  end if;

  if not public.is_student_life_admin() then
    raise exception 'Admin access required';
  end if;

  if not public.org_matches(target_org_id) then
    raise exception 'Organization mismatch';
  end if;

  insert into public.audit_events (
    org_id,
    actor_id,
    category,
    action,
    entity_type,
    entity_id,
    title,
    summary,
    metadata
  )
  values (
    target_org_id,
    actor,
    nullif(trim(target_category), ''),
    nullif(trim(target_action), ''),
    nullif(trim(target_entity_type), ''),
    target_entity_id,
    coalesce(nullif(trim(target_title), ''), initcap(replace(target_action, '_', ' '))),
    nullif(trim(target_summary), ''),
    coalesce(target_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function public.log_audit_event(uuid, text, text, text, uuid, text, text, jsonb) to authenticated;

revoke all on public.audit_events from anon;
revoke all on public.audit_events from authenticated;

create policy audit_events_select_same_org_admin
  on public.audit_events
  for select
  to authenticated
  using (public.is_student_life_admin() and public.org_matches(org_id));

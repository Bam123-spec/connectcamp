create table if not exists public.workspace_settings (
  org_id uuid primary key,
  organization_name text not null default 'Connect Camp',
  reply_to_email text,
  support_email text,
  webhook_url text,
  timezone text not null default 'UTC',
  school_email_domain text not null default 'montgomerycollege.com',
  compact_sidebar_default boolean not null default false,
  alert_officer_requests boolean not null default true,
  alert_budget_approvals boolean not null default true,
  alert_event_escalations boolean not null default true,
  alert_daily_digest boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.workspace_settings (org_id)
select distinct p.org_id
from public.profiles p
where p.org_id is not null
on conflict (org_id) do nothing;

create or replace function public.set_workspace_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workspace_settings_updated_at on public.workspace_settings;
create trigger trg_workspace_settings_updated_at
before update on public.workspace_settings
for each row execute function public.set_workspace_settings_updated_at();

alter table public.workspace_settings enable row level security;

drop policy if exists workspace_settings_select on public.workspace_settings;
create policy workspace_settings_select
on public.workspace_settings
for select
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists workspace_settings_insert on public.workspace_settings;
create policy workspace_settings_insert
on public.workspace_settings
for insert
to authenticated
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
  and updated_by = auth.uid()
);

drop policy if exists workspace_settings_update on public.workspace_settings;
create policy workspace_settings_update
on public.workspace_settings
for update
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
)
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
  and updated_by = auth.uid()
);

drop policy if exists workspace_settings_delete on public.workspace_settings;
create policy workspace_settings_delete
on public.workspace_settings
for delete
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

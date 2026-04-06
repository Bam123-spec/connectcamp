create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  campus text not null check (campus in ('Rockville', 'TPSS', 'Germantown', 'All')),
  issue_type text not null check (issue_type in (
    'App not loading',
    'Events not syncing',
    'Member access issue',
    'Role/permissions issue',
    'Messaging issue',
    'Other'
  )),
  description text not null,
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  assigned_to uuid references auth.users(id),
  contact_email text,
  screenshot_url text,
  created_by uuid references auth.users(id)
);

create index if not exists support_tickets_created_at_idx on public.support_tickets (created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_priority_idx on public.support_tickets (priority);

alter table public.support_tickets enable row level security;

drop policy if exists support_tickets_admin_select on public.support_tickets;
create policy support_tickets_admin_select
on public.support_tickets
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists support_tickets_admin_insert on public.support_tickets;
create policy support_tickets_admin_insert
on public.support_tickets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists support_tickets_admin_update on public.support_tickets;
create policy support_tickets_admin_update
on public.support_tickets
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists support_attachments_admin_upload on storage.objects;
create policy support_attachments_admin_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'support-attachments'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists support_attachments_admin_read on storage.objects;
create policy support_attachments_admin_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'support-attachments'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

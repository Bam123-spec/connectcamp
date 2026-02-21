create extension if not exists pgcrypto;

-- Ensure profile/org compatibility for multi-tenant checks.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    alter table public.profiles add column if not exists org_id uuid;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'clubs'
  ) then
    alter table public.clubs add column if not exists org_id uuid;
    alter table public.clubs add column if not exists primary_user_id uuid references auth.users(id);
  end if;
end
$$;

-- Backfill legacy rows so org-scoped RLS works even on older single-tenant data.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    update public.profiles
    set org_id = '00000000-0000-0000-0000-000000000001'
    where org_id is null;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'clubs'
  ) then
    update public.clubs
    set org_id = '00000000-0000-0000-0000-000000000001'
    where org_id is null;
  end if;
end
$$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  category text not null check (category in ('clubs', 'officers', 'admins', 'others')),
  target_type text not null check (target_type in ('club', 'officer', 'admin', 'other')),
  target_id uuid not null,
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists conversations_org_category_last_message_idx
  on public.conversations (org_id, category, last_message_at desc);
create index if not exists conversations_updated_at_idx
  on public.conversations (updated_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  org_id uuid not null,
  user_id uuid not null references auth.users(id),
  member_type text not null check (member_type in ('admin', 'club', 'officer', 'other')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);
create index if not exists conversation_members_org_idx
  on public.conversation_members (org_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  org_id uuid not null,
  sender_id uuid not null references auth.users(id),
  sender_type text not null check (sender_type in ('admin', 'club', 'officer', 'other')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists messages_org_created_idx
  on public.messages (org_id, created_at desc);

create table if not exists public.message_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  org_id uuid not null,
  user_id uuid not null references auth.users(id),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists message_reads_user_idx
  on public.message_reads (user_id);

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_profile_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_messaging_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('admin', 'student_life_admin', 'super_admin'), false);
$$;

create or replace function public.org_matches(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_org_id() = target_org_id, false);
$$;

create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.touch_conversation_from_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now(),
      last_message_at = new.created_at
  where id = new.conversation_id;

  insert into public.message_reads (conversation_id, org_id, user_id, last_read_at)
  values (new.conversation_id, new.org_id, new.sender_id, new.created_at)
  on conflict (conversation_id, user_id)
  do update set last_read_at = greatest(message_reads.last_read_at, excluded.last_read_at);

  return new;
end;
$$;

drop trigger if exists trg_messages_touch_conversation on public.messages;
create trigger trg_messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_from_message();

create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row execute function public.touch_conversation_updated_at();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

drop policy if exists conversations_member_select on public.conversations;
create policy conversations_member_select
on public.conversations
for select
to authenticated
using (
  public.is_conversation_member(id)
  and public.org_matches(org_id)
);

drop policy if exists conversations_admin_insert on public.conversations;
create policy conversations_admin_insert
on public.conversations
for insert
to authenticated
with check (
  public.is_messaging_admin()
  and public.org_matches(org_id)
);

drop policy if exists conversations_admin_update on public.conversations;
create policy conversations_admin_update
on public.conversations
for update
to authenticated
using (
  public.is_messaging_admin()
  and public.org_matches(org_id)
)
with check (
  public.is_messaging_admin()
  and public.org_matches(org_id)
);

drop policy if exists conversation_members_member_select on public.conversation_members;
create policy conversation_members_member_select
on public.conversation_members
for select
to authenticated
using (
  public.org_matches(org_id)
  and public.is_conversation_member(conversation_id)
);

drop policy if exists conversation_members_admin_insert on public.conversation_members;
create policy conversation_members_admin_insert
on public.conversation_members
for insert
to authenticated
with check (
  public.is_messaging_admin()
  and public.org_matches(org_id)
);

drop policy if exists conversation_members_admin_delete on public.conversation_members;
create policy conversation_members_admin_delete
on public.conversation_members
for delete
to authenticated
using (
  public.is_messaging_admin()
  and public.org_matches(org_id)
);

drop policy if exists messages_member_select on public.messages;
create policy messages_member_select
on public.messages
for select
to authenticated
using (
  public.org_matches(org_id)
  and public.is_conversation_member(conversation_id)
);

drop policy if exists messages_member_insert on public.messages;
create policy messages_member_insert
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.org_matches(org_id)
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists message_reads_self_select on public.message_reads;
create policy message_reads_self_select
on public.message_reads
for select
to authenticated
using (
  user_id = auth.uid()
  and public.org_matches(org_id)
);

drop policy if exists message_reads_self_insert on public.message_reads;
create policy message_reads_self_insert
on public.message_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.org_matches(org_id)
);

drop policy if exists message_reads_self_update on public.message_reads;
create policy message_reads_self_update
on public.message_reads
for update
to authenticated
using (
  user_id = auth.uid()
  and public.org_matches(org_id)
)
with check (
  user_id = auth.uid()
  and public.org_matches(org_id)
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then
    null;
  end;
end
$$;

create extension if not exists pgcrypto;

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  name text not null,
  avatar_url text,
  primary_user_id uuid references auth.users(id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'clubs'
  ) then
    alter table public.clubs add column if not exists org_id uuid;
    alter table public.clubs add column if not exists primary_user_id uuid references auth.users(id);
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  ) then
    alter table public.profiles add column if not exists org_id uuid;
  end if;
end
$$;

create table if not exists public.admin_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  campus_id uuid,
  type text not null default 'dm',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  subject text
);

create index if not exists admin_conversations_org_last_message_idx
  on public.admin_conversations (org_id, last_message_at desc);
create index if not exists admin_conversations_updated_at_idx
  on public.admin_conversations (updated_at desc);

create table if not exists public.admin_conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.admin_conversations(id) on delete cascade,
  org_id uuid not null,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('admin', 'club')),
  club_id uuid references public.clubs(id),
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index if not exists admin_conversation_members_user_idx
  on public.admin_conversation_members (user_id);
create index if not exists admin_conversation_members_club_idx
  on public.admin_conversation_members (club_id);
create index if not exists admin_conversation_members_conversation_idx
  on public.admin_conversation_members (conversation_id);

create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.admin_conversations(id) on delete cascade,
  org_id uuid not null,
  sender_id uuid not null references auth.users(id),
  sender_role text not null check (sender_role in ('admin', 'club')),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists admin_messages_conversation_created_idx
  on public.admin_messages (conversation_id, created_at desc);
create index if not exists admin_messages_org_created_idx
  on public.admin_messages (org_id, created_at desc);

create table if not exists public.admin_message_reads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.admin_conversations(id) on delete cascade,
  org_id uuid not null,
  user_id uuid not null references auth.users(id),
  last_read_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index if not exists admin_message_reads_user_idx
  on public.admin_message_reads (user_id);
create index if not exists admin_message_reads_conversation_idx
  on public.admin_message_reads (conversation_id);

create or replace function public.set_admin_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_conversations_updated_at on public.admin_conversations;
create trigger trg_admin_conversations_updated_at
before update on public.admin_conversations
for each row execute function public.set_admin_conversation_updated_at();

create or replace function public.on_admin_message_insert()
returns trigger
language plpgsql
as $$
begin
  update public.admin_conversations
  set last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id;

  insert into public.admin_message_reads (conversation_id, org_id, user_id, last_read_at)
  select m.conversation_id,
         m.org_id,
         m.user_id,
         case when m.user_id = new.sender_id then new.created_at else to_timestamp(0) end
  from public.admin_conversation_members m
  where m.conversation_id = new.conversation_id
  on conflict (conversation_id, user_id) do nothing;

  update public.admin_message_reads
  set last_read_at = greatest(last_read_at, new.created_at)
  where conversation_id = new.conversation_id
    and user_id = new.sender_id;

  return new;
end;
$$;

drop trigger if exists trg_admin_messages_after_insert on public.admin_messages;
create trigger trg_admin_messages_after_insert
after insert on public.admin_messages
for each row execute function public.on_admin_message_insert();

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

create or replace function public.is_student_life_admin()
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
  select coalesce(public.current_profile_org_id() is null or public.current_profile_org_id() = target_org_id, false);
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
    from public.admin_conversation_members m
    where m.conversation_id = target_conversation_id
      and m.user_id = auth.uid()
  );
$$;

alter table public.admin_conversations enable row level security;
alter table public.admin_conversation_members enable row level security;
alter table public.admin_messages enable row level security;
alter table public.admin_message_reads enable row level security;

drop policy if exists admin_conversations_select on public.admin_conversations;
create policy admin_conversations_select
on public.admin_conversations
for select
to authenticated
using (
  public.is_conversation_member(id)
  and public.org_matches(org_id)
);

drop policy if exists admin_conversations_insert on public.admin_conversations;
create policy admin_conversations_insert
on public.admin_conversations
for insert
to authenticated
with check (
  public.is_student_life_admin()
  and created_by = auth.uid()
  and public.org_matches(org_id)
);

drop policy if exists admin_conversations_update on public.admin_conversations;
create policy admin_conversations_update
on public.admin_conversations
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

drop policy if exists admin_conversations_delete on public.admin_conversations;
create policy admin_conversations_delete
on public.admin_conversations
for delete
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists admin_conversation_members_select on public.admin_conversation_members;
create policy admin_conversation_members_select
on public.admin_conversation_members
for select
to authenticated
using (
  public.org_matches(org_id)
  and (
    public.is_conversation_member(conversation_id)
    or public.is_student_life_admin()
  )
);

drop policy if exists admin_conversation_members_insert on public.admin_conversation_members;
create policy admin_conversation_members_insert
on public.admin_conversation_members
for insert
to authenticated
with check (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists admin_conversation_members_delete on public.admin_conversation_members;
create policy admin_conversation_members_delete
on public.admin_conversation_members
for delete
to authenticated
using (
  public.is_student_life_admin()
  and public.org_matches(org_id)
);

drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select
on public.admin_messages
for select
to authenticated
using (
  public.is_conversation_member(conversation_id)
  and public.org_matches(org_id)
);

drop policy if exists admin_messages_insert on public.admin_messages;
create policy admin_messages_insert
on public.admin_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.org_matches(org_id)
  and exists (
    select 1
    from public.admin_conversation_members m
    where m.conversation_id = admin_messages.conversation_id
      and m.user_id = auth.uid()
      and m.role = admin_messages.sender_role
  )
);

drop policy if exists admin_messages_update on public.admin_messages;
create policy admin_messages_update
on public.admin_messages
for update
to authenticated
using (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
)
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

drop policy if exists admin_message_reads_select on public.admin_message_reads;
create policy admin_message_reads_select
on public.admin_message_reads
for select
to authenticated
using (
  user_id = auth.uid()
  and public.org_matches(org_id)
);

drop policy if exists admin_message_reads_insert on public.admin_message_reads;
create policy admin_message_reads_insert
on public.admin_message_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.org_matches(org_id)
);

drop policy if exists admin_message_reads_update on public.admin_message_reads;
create policy admin_message_reads_update
on public.admin_message_reads
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
    alter publication supabase_realtime add table public.admin_conversations;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.admin_messages;
  exception when duplicate_object then
    null;
  end;
end
$$;

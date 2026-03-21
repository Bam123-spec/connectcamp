create extension if not exists pgcrypto;

alter table if exists public.clubs
  add column if not exists org_id uuid,
  add column if not exists primary_user_id uuid references auth.users(id);

alter table if exists public.profiles
  add column if not exists org_id uuid;

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

create or replace function public.is_admin_conversation_member(target_conversation_id uuid)
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
  public.is_admin_conversation_member(id)
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
    public.is_admin_conversation_member(conversation_id)
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
  public.is_admin_conversation_member(conversation_id)
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
  and public.is_admin_conversation_member(conversation_id)
)
with check (
  sender_id = auth.uid()
  and public.is_admin_conversation_member(conversation_id)
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

create or replace function public.ensure_admin_club_conversation(target_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid;
  target_room_id uuid;
  fallback_user_id uuid;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can provision club conversations.';
  end if;

  select coalesce(c.org_id, public.current_profile_org_id(), '00000000-0000-0000-0000-000000000001'::uuid)
    into resolved_org_id
  from public.clubs c
  where c.id = target_club_id;

  if resolved_org_id is null then
    raise exception 'Club not found.';
  end if;

  select ac.id
    into target_room_id
  from public.admin_conversations ac
  join public.admin_conversation_members acm
    on acm.conversation_id = ac.id
   and acm.club_id = target_club_id
   and acm.role = 'club'
  where ac.org_id = resolved_org_id
  order by ac.created_at asc
  limit 1;

  if target_room_id is null then
    insert into public.admin_conversations (org_id, type, created_by, subject)
    select resolved_org_id, 'club', auth.uid(), c.name
    from public.clubs c
    where c.id = target_club_id
    returning id into target_room_id;
  end if;

  insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
  values (target_room_id, resolved_org_id, auth.uid(), 'admin', null)
  on conflict (conversation_id, user_id) do nothing;

  insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
  select target_room_id, resolved_org_id, o.user_id, 'club', target_club_id
  from public.officers o
  where o.club_id = target_club_id
    and o.user_id is not null
  on conflict (conversation_id, user_id) do nothing;

  select coalesce(c.primary_user_id, p.id)
    into fallback_user_id
  from public.clubs c
  left join public.profiles p on p.club_id = c.id
  where c.id = target_club_id
  order by p.created_at asc nulls last
  limit 1;

  if fallback_user_id is not null then
    insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
    values (target_room_id, resolved_org_id, fallback_user_id, 'club', target_club_id)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  insert into public.admin_message_reads (conversation_id, org_id, user_id, last_read_at)
  select target_room_id, resolved_org_id, m.user_id, now()
  from public.admin_conversation_members m
  where m.conversation_id = target_room_id
    and m.user_id = auth.uid()
  on conflict (conversation_id, user_id) do update
    set last_read_at = greatest(public.admin_message_reads.last_read_at, excluded.last_read_at);

  return target_room_id;
end;
$$;

grant execute on function public.ensure_admin_club_conversation(uuid) to authenticated;

create or replace function public.ensure_admin_dm_conversation(target_admin_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid := coalesce(public.current_profile_org_id(), '00000000-0000-0000-0000-000000000001'::uuid);
  target_room_id uuid;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can create admin conversations.';
  end if;

  if target_admin_user_id = auth.uid() then
    raise exception 'Cannot create a conversation with yourself.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = target_admin_user_id
      and coalesce(p.role, '') in ('admin', 'student_life_admin', 'super_admin')
  ) then
    raise exception 'Target user is not an admin.';
  end if;

  select ac.id
    into target_room_id
  from public.admin_conversations ac
  where ac.org_id = resolved_org_id
    and not exists (
      select 1
      from public.admin_conversation_members m
      where m.conversation_id = ac.id
        and m.role = 'club'
    )
    and exists (
      select 1
      from public.admin_conversation_members m
      where m.conversation_id = ac.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
    and exists (
      select 1
      from public.admin_conversation_members m
      where m.conversation_id = ac.id
        and m.user_id = target_admin_user_id
        and m.role = 'admin'
    )
  order by ac.created_at asc
  limit 1;

  if target_room_id is null then
    insert into public.admin_conversations (org_id, type, created_by, subject)
    values (resolved_org_id, 'admin', auth.uid(), null)
    returning id into target_room_id;

    insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
    values
      (target_room_id, resolved_org_id, auth.uid(), 'admin', null),
      (target_room_id, resolved_org_id, target_admin_user_id, 'admin', null)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  return target_room_id;
end;
$$;

grant execute on function public.ensure_admin_dm_conversation(uuid) to authenticated;

create or replace function public.sync_admin_club_conversations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  club_record record;
  conversation_id uuid;
  created_count integer := 0;
  connected_count integer := 0;
  club_count integer := 0;
  before_exists boolean;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can sync club conversations.';
  end if;

  for club_record in
    select c.id
    from public.clubs c
    order by c.created_at asc, c.name asc
  loop
    club_count := club_count + 1;

    select exists (
      select 1
      from public.admin_conversation_members m
      where m.club_id = club_record.id
        and m.role = 'club'
    ) into before_exists;

    conversation_id := public.ensure_admin_club_conversation(club_record.id);

    if not before_exists then
      created_count := created_count + 1;
    end if;

    if exists (
      select 1
      from public.admin_conversation_members m
      where m.conversation_id = conversation_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    ) then
      connected_count := connected_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'club_count', club_count,
    'created_count', created_count,
    'connected_count', connected_count
  );
end;
$$;

grant execute on function public.sync_admin_club_conversations() to authenticated;

create or replace function public.add_admin_conversation_member(target_conversation_id uuid, target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid;
  resolved_club_id uuid;
  resolved_role text;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can add conversation members.';
  end if;

  select ac.org_id
    into resolved_org_id
  from public.admin_conversations ac
  where ac.id = target_conversation_id;

  if resolved_org_id is null then
    raise exception 'Conversation not found.';
  end if;

  select m.club_id
    into resolved_club_id
  from public.admin_conversation_members m
  where m.conversation_id = target_conversation_id
    and m.role = 'club'
    and m.club_id is not null
  order by m.joined_at asc
  limit 1;

  select case
      when coalesce(p.role, '') in ('admin', 'student_life_admin', 'super_admin') then 'admin'
      else 'club'
    end,
    coalesce(p.club_id, resolved_club_id)
    into resolved_role, resolved_club_id
  from public.profiles p
  where p.id = target_user_id;

  if resolved_role is null then
    raise exception 'User not found.';
  end if;

  insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
  values (target_conversation_id, resolved_org_id, target_user_id, resolved_role, case when resolved_role = 'club' then resolved_club_id else null end)
  on conflict (conversation_id, user_id) do nothing;

  insert into public.admin_message_reads (conversation_id, org_id, user_id, last_read_at)
  values (target_conversation_id, resolved_org_id, target_user_id, to_timestamp(0))
  on conflict (conversation_id, user_id) do nothing;

  return true;
end;
$$;

grant execute on function public.add_admin_conversation_member(uuid, uuid) to authenticated;

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

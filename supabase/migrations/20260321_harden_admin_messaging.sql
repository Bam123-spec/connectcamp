alter table public.admin_conversations
  drop constraint if exists admin_conversations_type_check;

alter table public.admin_conversations
  add constraint admin_conversations_type_check
  check (type in ('club', 'admin'));

create or replace function public.org_matches(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_org_id() = target_org_id, false);
$$;

create or replace function public.ensure_admin_dm_conversation(target_admin_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid := public.current_profile_org_id();
  target_room_id uuid;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can create admin conversations.';
  end if;

  if resolved_org_id is null then
    raise exception 'Admin profile is missing an organization.';
  end if;

  if target_admin_user_id = auth.uid() then
    raise exception 'Cannot create a conversation with yourself.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = target_admin_user_id
      and p.org_id = resolved_org_id
      and coalesce(p.role, '') in ('admin', 'student_life_admin', 'super_admin')
  ) then
    raise exception 'Target user is not an admin in this workspace.';
  end if;

  select ac.id
    into target_room_id
  from public.admin_conversations ac
  where ac.org_id = resolved_org_id
    and ac.type = 'admin'
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
  resolved_org_id uuid := public.current_profile_org_id();
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can sync club conversations.';
  end if;

  if resolved_org_id is null then
    raise exception 'Admin profile is missing an organization.';
  end if;

  for club_record in
    select c.id
    from public.clubs c
    where c.org_id = resolved_org_id
    order by c.created_at asc, c.name asc
  loop
    club_count := club_count + 1;

    select exists (
      select 1
      from public.admin_conversations ac
      where ac.club_id = club_record.id
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

  insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
  select ac.id, ac.org_id, o.user_id, 'club', ac.club_id
  from public.admin_conversations ac
  join public.officers o on o.club_id = ac.club_id and o.user_id is not null
  left join public.admin_conversation_members existing
    on existing.conversation_id = ac.id
   and existing.user_id = o.user_id
  where ac.org_id = resolved_org_id
    and ac.type = 'club'
    and existing.id is null
  on conflict (conversation_id, user_id) do nothing;

  insert into public.admin_message_reads (conversation_id, org_id, user_id, last_read_at)
  select ac.id, ac.org_id, o.user_id, to_timestamp(0)
  from public.admin_conversations ac
  join public.officers o on o.club_id = ac.club_id and o.user_id is not null
  left join public.admin_message_reads reads
    on reads.conversation_id = ac.id
   and reads.user_id = o.user_id
  where ac.org_id = resolved_org_id
    and ac.type = 'club'
    and reads.id is null
  on conflict (conversation_id, user_id) do nothing;

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

  select ac.org_id, ac.club_id
    into resolved_org_id, resolved_club_id
  from public.admin_conversations ac
  where ac.id = target_conversation_id;

  if resolved_org_id is null then
    raise exception 'Conversation not found.';
  end if;

  select case
      when coalesce(p.role, '') in ('admin', 'student_life_admin', 'super_admin') then 'admin'
      else 'club'
    end,
    coalesce(p.club_id, resolved_club_id)
    into resolved_role, resolved_club_id
  from public.profiles p
  where p.id = target_user_id
    and p.org_id = resolved_org_id;

  if resolved_role is null then
    raise exception 'User not found in this workspace.';
  end if;

  insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
  values (
    target_conversation_id,
    resolved_org_id,
    target_user_id,
    resolved_role,
    case when resolved_role = 'club' then resolved_club_id else null end
  )
  on conflict (conversation_id, user_id) do nothing;

  insert into public.admin_message_reads (conversation_id, org_id, user_id, last_read_at)
  values (target_conversation_id, resolved_org_id, target_user_id, to_timestamp(0))
  on conflict (conversation_id, user_id) do nothing;

  return true;
end;
$$;

grant execute on function public.add_admin_conversation_member(uuid, uuid) to authenticated;

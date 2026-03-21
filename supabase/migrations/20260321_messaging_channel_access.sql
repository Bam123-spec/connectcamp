create or replace function private.is_admin_profile()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'student_life_admin', 'super_admin')
  );
$$;

create or replace function public.ensure_club_chat_room(target_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room_id uuid;
begin
  if auth.uid() is null or not private.is_admin_profile() then
    raise exception 'Only admins can provision club chat rooms.';
  end if;

  if not exists (
    select 1 from public.clubs c where c.id = target_club_id
  ) then
    raise exception 'Club not found.';
  end if;

  select r.id
  into target_room_id
  from public.chat_rooms r
  where r.type = 'group'
    and r.club_id = target_club_id
  order by r.created_at asc
  limit 1;

  if target_room_id is null then
    insert into public.chat_rooms (type, user1, user2, club_id)
    values ('group', null, null, target_club_id)
    returning id into target_room_id;
  end if;

  insert into public.chat_members (room_id, user_id)
  select target_room_id, auth.uid()
  where not exists (
    select 1
    from public.chat_members cm
    where cm.room_id = target_room_id
      and cm.user_id = auth.uid()
  );

  insert into public.chat_message_reads (message_id, user_id)
  select m.id, auth.uid()
  from public.chat_messages m
  where m.room_id = target_room_id
    and not exists (
      select 1
      from public.chat_message_reads r
      where r.message_id = m.id
        and r.user_id = auth.uid()
    );

  return target_room_id;
end;
$$;

grant execute on function public.ensure_club_chat_room(uuid) to authenticated;

create or replace function public.sync_admin_club_chat_paths()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  club_record record;
  target_room_id uuid;
  created_count integer := 0;
  connected_count integer := 0;
  club_count integer := 0;
begin
  if auth.uid() is null or not private.is_admin_profile() then
    raise exception 'Only admins can sync club chat rooms.';
  end if;

  for club_record in
    select c.id
    from public.clubs c
    order by c.created_at asc, c.name asc
  loop
    club_count := club_count + 1;

    select r.id
    into target_room_id
    from public.chat_rooms r
    where r.type = 'group'
      and r.club_id = club_record.id
    order by r.created_at asc
    limit 1;

    if target_room_id is null then
      insert into public.chat_rooms (type, user1, user2, club_id)
      values ('group', null, null, club_record.id)
      returning id into target_room_id;

      created_count := created_count + 1;
    end if;

    insert into public.chat_members (room_id, user_id)
    select target_room_id, auth.uid()
    where not exists (
      select 1
      from public.chat_members cm
      where cm.room_id = target_room_id
        and cm.user_id = auth.uid()
    );

    if found then
      connected_count := connected_count + 1;
    end if;

    insert into public.chat_message_reads (message_id, user_id)
    select m.id, auth.uid()
    from public.chat_messages m
    where m.room_id = target_room_id
      and not exists (
        select 1
        from public.chat_message_reads r
        where r.message_id = m.id
          and r.user_id = auth.uid()
      );
  end loop;

  return jsonb_build_object(
    'club_count', club_count,
    'created_count', created_count,
    'connected_count', connected_count
  );
end;
$$;

grant execute on function public.sync_admin_club_chat_paths() to authenticated;

create or replace function public.add_chat_room_member(target_room_id uuid, target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin_profile() then
    raise exception 'Only admins can add chat members.';
  end if;

  if not exists (
    select 1
    from public.chat_rooms r
    where r.id = target_room_id
  ) then
    raise exception 'Chat room not found.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
  ) then
    raise exception 'User not found.';
  end if;

  insert into public.chat_members (room_id, user_id)
  select target_room_id, target_user_id
  where not exists (
    select 1
    from public.chat_members cm
    where cm.room_id = target_room_id
      and cm.user_id = target_user_id
  );

  insert into public.chat_message_reads (message_id, user_id)
  select m.id, target_user_id
  from public.chat_messages m
  where m.room_id = target_room_id
    and not exists (
      select 1
      from public.chat_message_reads r
      where r.message_id = m.id
        and r.user_id = target_user_id
    );

  return true;
end;
$$;

grant execute on function public.add_chat_room_member(uuid, uuid) to authenticated;

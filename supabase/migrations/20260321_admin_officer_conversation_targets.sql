alter table if exists public.admin_conversations
  add column if not exists club_id uuid references public.clubs(id);

create index if not exists admin_conversations_club_idx
  on public.admin_conversations (club_id);

update public.admin_conversations ac
set club_id = source.club_id
from (
  select conversation_id, max(club_id) as club_id
  from public.admin_conversation_members
  where club_id is not null
  group by conversation_id
) as source
where ac.id = source.conversation_id
  and ac.club_id is null;

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
  where ac.org_id = resolved_org_id
    and ac.club_id = target_club_id
  order by ac.created_at asc
  limit 1;

  if target_room_id is null then
    insert into public.admin_conversations (org_id, club_id, type, created_by, subject)
    select resolved_org_id, c.id, 'club', auth.uid(), c.name
    from public.clubs c
    where c.id = target_club_id
    returning id into target_room_id;
  end if;

  update public.admin_conversations
  set club_id = target_club_id,
      subject = coalesce(subject, (select c.name from public.clubs c where c.id = target_club_id))
  where id = target_room_id;

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
  select target_room_id, resolved_org_id, auth.uid(), now()
  on conflict (conversation_id, user_id) do update
    set last_read_at = greatest(public.admin_message_reads.last_read_at, excluded.last_read_at);

  return target_room_id;
end;
$$;

grant execute on function public.ensure_admin_club_conversation(uuid) to authenticated;

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

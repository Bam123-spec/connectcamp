create or replace function public.ensure_admin_club_conversation(target_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid := public.current_profile_org_id();
  club_record record;
  target_room_id uuid;
  fallback_user_id uuid;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can provision club conversations.';
  end if;

  if resolved_org_id is null then
    raise exception 'Admin profile is missing an organization.';
  end if;

  select c.id, c.name, c.primary_user_id, c.org_id
    into club_record
  from public.clubs c
  where c.id = target_club_id
    and c.org_id = resolved_org_id;

  if club_record.id is null then
    raise exception 'Club not found in this workspace.';
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
    values (resolved_org_id, target_club_id, 'club', auth.uid(), club_record.name)
    returning id into target_room_id;
  else
    update public.admin_conversations
    set club_id = target_club_id,
        subject = coalesce(subject, club_record.name)
    where id = target_room_id;
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

  select coalesce(club_record.primary_user_id, p.id)
    into fallback_user_id
  from public.profiles p
  where p.org_id = resolved_org_id
    and p.club_id = target_club_id
  order by p.created_at asc nulls last
  limit 1;

  if fallback_user_id is not null then
    insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
    values (target_room_id, resolved_org_id, fallback_user_id, 'club', target_club_id)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  insert into public.admin_message_reads (conversation_id, org_id, user_id, last_read_at)
  values (target_room_id, resolved_org_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update
    set last_read_at = greatest(public.admin_message_reads.last_read_at, excluded.last_read_at);

  return target_room_id;
end;
$$;

grant execute on function public.ensure_admin_club_conversation(uuid) to authenticated;

create or replace function public.get_admin_conversation_access_state(target_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid;
  resolved_club_id uuid;
  resolved_last_message_at timestamptz;
  latest_body text;
  direct_members jsonb := '[]'::jsonb;
  suggested_members jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select ac.org_id, ac.club_id, ac.last_message_at
    into resolved_org_id, resolved_club_id, resolved_last_message_at
  from public.admin_conversations ac
  where ac.id = target_conversation_id
    and (
      public.is_admin_conversation_member(ac.id)
      or (
        public.is_student_life_admin()
        and public.org_matches(ac.org_id)
      )
    );

  if resolved_org_id is null then
    raise exception 'Conversation not found.';
  end if;

  select am.body
    into latest_body
  from public.admin_messages am
  where am.conversation_id = target_conversation_id
  order by am.created_at desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.user_id,
        'fullName', p.full_name,
        'email', p.email,
        'avatarUrl', p.avatar_url,
        'memberType', m.role,
        'clubId', m.club_id,
        'isCurrentUser', m.user_id = auth.uid(),
        'isSuggested', false,
        'lastReadAt', r.last_read_at,
        'readState',
          case
            when resolved_last_message_at is null then 'no_messages'
            when r.last_read_at is null then 'unread'
            when r.last_read_at >= resolved_last_message_at then 'seen_latest'
            else 'read_earlier'
          end,
        'tags',
          to_jsonb(
            array_remove(
              array[
                case when m.role = 'admin' then 'Admin' else 'Club access' end,
                case when m.club_id is not null then 'Club-linked' else null end,
                case when m.user_id = auth.uid() then 'You' else null end
              ],
              null
            )
          )
      )
      order by case when m.role = 'admin' then 0 else 1 end, coalesce(p.full_name, p.email, m.user_id::text)
    ),
    '[]'::jsonb
  )
    into direct_members
  from public.admin_conversation_members m
  left join public.profiles p
    on p.id = m.user_id
  left join public.admin_message_reads r
    on r.conversation_id = m.conversation_id
   and r.user_id = m.user_id
  where m.conversation_id = target_conversation_id;

  if resolved_club_id is not null then
    with suggested_candidates as (
      select o.user_id, 'Officer'::text as tag
      from public.officers o
      where o.club_id = resolved_club_id
        and o.user_id is not null

      union all

      select p.id as user_id, 'Club account'::text as tag
      from public.profiles p
      where p.club_id = resolved_club_id
    ),
    suggested_tags as (
      select sc.user_id, array_agg(distinct sc.tag order by sc.tag) as tags
      from suggested_candidates sc
      where not exists (
        select 1
        from public.admin_conversation_members existing
        where existing.conversation_id = target_conversation_id
          and existing.user_id = sc.user_id
      )
      group by sc.user_id
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', st.user_id,
          'fullName', p.full_name,
          'email', p.email,
          'avatarUrl', p.avatar_url,
          'memberType', case when coalesce(p.role, '') in ('admin', 'student_life_admin', 'super_admin') then 'admin' else 'club' end,
          'clubId', p.club_id,
          'isCurrentUser', st.user_id = auth.uid(),
          'isSuggested', true,
          'lastReadAt', null,
          'readState', 'not_added',
          'tags', to_jsonb(st.tags)
        )
        order by coalesce(p.full_name, p.email, st.user_id::text)
      ),
      '[]'::jsonb
    )
      into suggested_members
    from suggested_tags st
    left join public.profiles p
      on p.id = st.user_id;
  end if;

  return jsonb_build_object(
    'directMembers', direct_members,
    'suggestedMembers', suggested_members,
    'latestMessageAt', resolved_last_message_at,
    'latestMessagePreview', coalesce(latest_body, ''),
    'readSummary', jsonb_build_object(
      'totalMembers',
        coalesce((
          select count(*)
          from public.admin_conversation_members m
          where m.conversation_id = target_conversation_id
        ), 0),
      'adminMembers',
        coalesce((
          select count(*)
          from public.admin_conversation_members m
          where m.conversation_id = target_conversation_id
            and m.role = 'admin'
        ), 0),
      'clubMembers',
        coalesce((
          select count(*)
          from public.admin_conversation_members m
          where m.conversation_id = target_conversation_id
            and m.role = 'club'
        ), 0),
      'seenLatestCount',
        coalesce((
          select count(*)
          from public.admin_conversation_members m
          left join public.admin_message_reads r
            on r.conversation_id = m.conversation_id
           and r.user_id = m.user_id
          where m.conversation_id = target_conversation_id
            and resolved_last_message_at is not null
            and r.last_read_at >= resolved_last_message_at
        ), 0)
    )
  );
end;
$$;

grant execute on function public.get_admin_conversation_access_state(uuid) to authenticated;

create or replace function public.remove_admin_conversation_member(target_conversation_id uuid, target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_org_id uuid;
  target_role text;
  admin_count integer;
begin
  if auth.uid() is null or not public.is_student_life_admin() then
    raise exception 'Only admins can remove conversation members.';
  end if;

  select ac.org_id
    into resolved_org_id
  from public.admin_conversations ac
  where ac.id = target_conversation_id;

  if resolved_org_id is null then
    raise exception 'Conversation not found.';
  end if;

  if not public.org_matches(resolved_org_id) then
    raise exception 'Conversation is outside your workspace.';
  end if;

  select m.role
    into target_role
  from public.admin_conversation_members m
  where m.conversation_id = target_conversation_id
    and m.user_id = target_user_id;

  if target_role is null then
    raise exception 'Conversation member not found.';
  end if;

  if target_role = 'admin' then
    select count(*)
      into admin_count
    from public.admin_conversation_members m
    where m.conversation_id = target_conversation_id
      and m.role = 'admin';

    if admin_count <= 1 then
      raise exception 'Cannot remove the last admin from this conversation.';
    end if;
  end if;

  delete from public.admin_message_reads
  where conversation_id = target_conversation_id
    and user_id = target_user_id;

  delete from public.admin_conversation_members
  where conversation_id = target_conversation_id
    and user_id = target_user_id;

  return true;
end;
$$;

grant execute on function public.remove_admin_conversation_member(uuid, uuid) to authenticated;

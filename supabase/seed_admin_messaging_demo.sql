do $$
declare
  demo_org_id uuid := '00000000-0000-0000-0000-000000000001';
  admin_user_id uuid;
  club_user_ids uuid[];
  club_names text[] := array['Demo Robotics Club', 'Demo Debate Club', 'Demo Arts Collective'];
  created_club_ids uuid[] := array[]::uuid[];
  idx integer;
  candidate_club_id uuid;
  existing_conversation_id uuid;
begin
  select coalesce((
    select p.org_id
    from public.profiles p
    where p.role in ('admin', 'student_life_admin', 'super_admin')
      and p.org_id is not null
    limit 1
  ), demo_org_id)
  into demo_org_id;

  select p.id
  into admin_user_id
  from public.profiles p
  where p.role in ('admin', 'student_life_admin', 'super_admin')
  limit 1;

  if admin_user_id is null then
    raise notice 'No admin profile found. Seed skipped.';
    return;
  end if;

  select array(
    select p.id
    from public.profiles p
    where p.id <> admin_user_id
    order by p.created_at asc nulls last
    limit 3
  )
  into club_user_ids;

  if coalesce(array_length(club_user_ids, 1), 0) = 0 then
    raise notice 'No non-admin profiles available for demo clubs. Seed skipped.';
    return;
  end if;

  for idx in 1..3 loop
    if idx > coalesce(array_length(club_user_ids, 1), 0) then
      exit;
    end if;

    select c.id
    into candidate_club_id
    from public.clubs c
    where c.name = club_names[idx]
      and (c.org_id = demo_org_id or c.org_id is null)
    limit 1;

    if candidate_club_id is null then
      insert into public.clubs (id, org_id, name, primary_user_id)
      values (gen_random_uuid(), demo_org_id, club_names[idx], club_user_ids[idx])
      returning id into candidate_club_id;
    else
      update public.clubs
      set org_id = coalesce(org_id, demo_org_id),
          primary_user_id = coalesce(primary_user_id, club_user_ids[idx])
      where id = candidate_club_id;
    end if;

    created_club_ids := created_club_ids || candidate_club_id;

    update public.profiles
    set org_id = coalesce(org_id, demo_org_id)
    where id in (admin_user_id, club_user_ids[idx]);
  end loop;

  if coalesce(array_length(created_club_ids, 1), 0) = 0 then
    raise notice 'No demo clubs created. Seed skipped.';
    return;
  end if;

  select ac.id
  into existing_conversation_id
  from public.admin_conversations ac
  join public.admin_conversation_members m_admin
    on m_admin.conversation_id = ac.id
   and m_admin.user_id = admin_user_id
   and m_admin.role = 'admin'
  join public.admin_conversation_members m_club
    on m_club.conversation_id = ac.id
   and m_club.club_id = created_club_ids[1]
   and m_club.role = 'club'
  where ac.org_id = demo_org_id
  limit 1;

  if existing_conversation_id is null then
    insert into public.admin_conversations (id, org_id, type, created_by, subject)
    values (gen_random_uuid(), demo_org_id, 'dm', admin_user_id, 'Welcome thread')
    returning id into existing_conversation_id;

    insert into public.admin_conversation_members (conversation_id, org_id, user_id, role, club_id)
    values
      (existing_conversation_id, demo_org_id, admin_user_id, 'admin', null),
      (existing_conversation_id, demo_org_id, club_user_ids[1], 'club', created_club_ids[1])
    on conflict (conversation_id, user_id) do nothing;

    insert into public.admin_messages (conversation_id, org_id, sender_id, sender_role, body)
    values
      (existing_conversation_id, demo_org_id, admin_user_id, 'admin', 'Welcome to Connect Camp messaging. This is a seeded demo conversation.'),
      (existing_conversation_id, demo_org_id, club_user_ids[1], 'club', 'Thanks! We can see messages in real time now.');
  end if;

  raise notice 'Admin messaging demo seed complete. Conversation id: %', existing_conversation_id;
end
$$;

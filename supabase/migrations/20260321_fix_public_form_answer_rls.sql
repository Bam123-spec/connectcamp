create or replace function private.can_insert_form_response_answer(target_response_id uuid, target_field_id uuid)
returns boolean
language sql
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.form_responses fr
    join public.form_fields ff
      on ff.id = target_field_id
     and ff.form_id = fr.form_id
    join public.forms f
      on f.id = fr.form_id
    where fr.id = target_response_id
      and f.is_active = true
      and (
        fr.user_id is null
        or fr.user_id = auth.uid()
      )
  );
$$;

grant execute on function private.can_insert_form_response_answer(uuid, uuid) to anon, authenticated;

drop policy if exists form_response_answers_insert_authenticated_own on public.form_response_answers;
drop policy if exists form_response_answers_insert_public_active on public.form_response_answers;

create policy form_response_answers_insert_public_active
on public.form_response_answers
for insert
to public
with check (private.can_insert_form_response_answer(response_id, field_id));

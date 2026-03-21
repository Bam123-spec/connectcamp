alter table if exists public.forms
  add column if not exists access_type text default 'public',
  add column if not exists max_responses integer,
  add column if not exists limit_one_response boolean default false,
  add column if not exists success_message text,
  add column if not exists redirect_url text;

update public.forms
set access_type = 'public'
where access_type is null;

update public.forms
set limit_one_response = false
where limit_one_response is null;

alter table if exists public.forms
  alter column access_type set default 'public',
  alter column access_type set not null,
  alter column limit_one_response set default false,
  alter column limit_one_response set not null;

alter table if exists public.forms
  drop constraint if exists forms_access_type_check,
  drop constraint if exists forms_max_responses_check;

alter table if exists public.forms
  add constraint forms_access_type_check
  check (access_type in ('public', 'internal'));

alter table if exists public.forms
  add constraint forms_max_responses_check
  check (max_responses is null or max_responses > 0);

create or replace function private.can_submit_form(
  target_form_id uuid,
  target_user_id uuid,
  target_respondent_email text
)
returns boolean
language sql
security definer
set search_path to ''
as $$
  with target_form as (
    select
      f.id,
      f.is_active,
      coalesce(f.access_type, 'public') as access_type,
      f.max_responses,
      coalesce(f.limit_one_response, false) as limit_one_response
    from public.forms f
    where f.id = target_form_id
  ),
  response_count as (
    select
      (select count(*) from public.form_responses fr where fr.form_id = target_form_id) +
      (select count(*) from public.form_submissions fs where fs.form_id = target_form_id) as total
  )
  select exists (
    select 1
    from target_form tf
    cross join response_count rc
    where tf.is_active = true
      and (tf.access_type = 'public' or auth.uid() is not null)
      and (target_user_id is null or target_user_id = auth.uid())
      and (tf.max_responses is null or rc.total < tf.max_responses)
      and (
        tf.limit_one_response = false
        or nullif(trim(coalesce(target_respondent_email, '')), '') is null
        or not exists (
          select 1
          from public.form_responses fr
          where fr.form_id = target_form_id
            and lower(coalesce(fr.respondent_email, '')) = lower(trim(target_respondent_email))
          union all
          select 1
          from public.form_submissions fs
          where fs.form_id = target_form_id
            and lower(coalesce(fs.respondent_email, '')) = lower(trim(target_respondent_email))
        )
      )
  );
$$;

grant execute on function private.can_submit_form(uuid, uuid, text) to anon, authenticated;

create or replace function public.get_form_submission_state(
  target_form_id uuid,
  target_respondent_email text default null
)
returns table (
  form_exists boolean,
  is_active boolean,
  access_type text,
  is_accepting boolean,
  reason text,
  max_responses integer,
  responses_count bigint,
  limit_one_response boolean,
  success_message text,
  redirect_url text
)
language sql
security definer
set search_path to ''
as $$
  with target_form as (
    select
      f.id,
      f.is_active,
      coalesce(f.access_type, 'public') as access_type,
      f.max_responses,
      coalesce(f.limit_one_response, false) as limit_one_response,
      f.success_message,
      f.redirect_url
    from public.forms f
    where f.id = target_form_id
  ),
  response_count as (
    select
      (select count(*) from public.form_responses fr where fr.form_id = target_form_id) +
      (select count(*) from public.form_submissions fs where fs.form_id = target_form_id) as total
  ),
  duplicate_response as (
    select exists (
      select 1
      from public.form_responses fr
      where fr.form_id = target_form_id
        and lower(coalesce(fr.respondent_email, '')) = lower(trim(coalesce(target_respondent_email, '')))
      union all
      select 1
      from public.form_submissions fs
      where fs.form_id = target_form_id
        and lower(coalesce(fs.respondent_email, '')) = lower(trim(coalesce(target_respondent_email, '')))
    ) as matched
  )
  select
    tf.id is not null as form_exists,
    coalesce(tf.is_active, false) as is_active,
    coalesce(tf.access_type, 'public') as access_type,
    case
      when tf.id is null then false
      when tf.is_active = false then false
      when tf.access_type = 'internal' and auth.uid() is null then false
      when tf.max_responses is not null and rc.total >= tf.max_responses then false
      when tf.limit_one_response and nullif(trim(coalesce(target_respondent_email, '')), '') is not null and dr.matched then false
      else true
    end as is_accepting,
    case
      when tf.id is null then 'not_found'
      when tf.is_active = false then 'inactive'
      when tf.access_type = 'internal' and auth.uid() is null then 'auth_required'
      when tf.max_responses is not null and rc.total >= tf.max_responses then 'max_responses_reached'
      when tf.limit_one_response and nullif(trim(coalesce(target_respondent_email, '')), '') is not null and dr.matched then 'already_submitted'
      else 'open'
    end as reason,
    tf.max_responses,
    coalesce(rc.total, 0) as responses_count,
    coalesce(tf.limit_one_response, false) as limit_one_response,
    tf.success_message,
    tf.redirect_url
  from target_form tf
  cross join response_count rc
  cross join duplicate_response dr

  union all

  select
    false as form_exists,
    false as is_active,
    'public' as access_type,
    false as is_accepting,
    'not_found' as reason,
    null as max_responses,
    0 as responses_count,
    false as limit_one_response,
    null as success_message,
    null as redirect_url
  where not exists (select 1 from target_form);
$$;

grant execute on function public.get_form_submission_state(uuid, text) to anon, authenticated;

drop policy if exists form_responses_insert_authenticated_own on public.form_responses;
drop policy if exists form_responses_insert_public_active on public.form_responses;

create policy form_responses_insert_public_active
on public.form_responses
for insert
to public
with check (
  private.can_submit_form(form_id, user_id, respondent_email)
);

drop policy if exists form_submissions_insert_authenticated_own on public.form_submissions;
drop policy if exists form_submissions_insert_public_active on public.form_submissions;

create policy form_submissions_insert_public_active
on public.form_submissions
for insert
to public
with check (
  private.can_submit_form(form_id, submitted_by, respondent_email)
);

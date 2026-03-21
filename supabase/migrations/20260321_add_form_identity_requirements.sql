alter table if exists public.forms
  add column if not exists email_policy text default 'school_only';

update public.forms
set email_policy = 'school_only'
where email_policy is null;

alter table if exists public.forms
  alter column email_policy set default 'school_only';

alter table if exists public.forms
  alter column email_policy set not null;

alter table if exists public.forms
  drop constraint if exists forms_email_policy_check;

alter table if exists public.forms
  add constraint forms_email_policy_check
  check (email_policy in ('any', 'school_only'));

alter table if exists public.form_responses
  add column if not exists respondent_name text,
  add column if not exists respondent_email text;

alter table if exists public.form_submissions
  add column if not exists respondent_name text,
  add column if not exists respondent_email text;

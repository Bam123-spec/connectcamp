-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create forms table
create table if not exists forms (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true,
  qr_code_url text
);

-- Create form_fields table
create table if not exists form_fields (
  id uuid primary key default uuid_generate_v4(),
  form_id uuid references forms(id) on delete cascade not null,
  type text not null check (type in ('short_text', 'long_text', 'number', 'dropdown', 'checkboxes', 'radio', 'file', 'date', 'time', 'section')),
  label text not null,
  description text,
  options jsonb, -- Array of strings for dropdown/radio/checkboxes
  "order" integer not null default 0
);

-- Create form_responses table
create table if not exists form_responses (
  id uuid primary key default uuid_generate_v4(),
  form_id uuid references forms(id) on delete cascade not null,
  user_id uuid references auth.users(id), -- Optional, if student is logged in
  created_at timestamptz default now()
);

-- Create form_response_answers table
create table if not exists form_response_answers (
  id uuid primary key default uuid_generate_v4(),
  response_id uuid references form_responses(id) on delete cascade not null,
  field_id uuid references form_fields(id) on delete cascade not null,
  answer jsonb -- Stores the actual answer value (string, number, array, etc.)
);

-- Enable Row Level Security (RLS)
alter table forms enable row level security;
alter table form_fields enable row level security;
alter table form_responses enable row level security;
alter table form_response_answers enable row level security;

-- RLS Policies

-- Forms: Admins can do everything, Public can read active forms
create policy "Admins can do everything on forms"
  on forms for all
  using ( auth.role() = 'authenticated' ) -- Assuming all authenticated users are admins/officers for now, or refine with profile role check
  with check ( auth.role() = 'authenticated' );

create policy "Public can view active forms"
  on forms for select
  using ( is_active = true );

-- Form Fields: Admins can do everything, Public can read fields of active forms
create policy "Admins can do everything on form_fields"
  on form_fields for all
  using ( auth.role() = 'authenticated' )
  with check ( auth.role() = 'authenticated' );

create policy "Public can view fields of active forms"
  on form_fields for select
  using ( exists (select 1 from forms where forms.id = form_fields.form_id and forms.is_active = true) );

-- Form Responses: Admins can view all, Public can insert
create policy "Admins can view all responses"
  on form_responses for select
  using ( auth.role() = 'authenticated' );

create policy "Public can insert responses"
  on form_responses for insert
  with check ( true );

-- Form Response Answers: Admins can view all, Public can insert
create policy "Admins can view all answers"
  on form_response_answers for select
  using ( auth.role() = 'authenticated' );

create policy "Public can insert answers"
  on form_response_answers for insert
  with check ( true );

-- Storage Bucket for QR Codes
-- Note: You'll need to create a public bucket named 'form_qr_codes' in the Supabase Dashboard manually if it doesn't exist,
-- or run this via the Storage API. SQL support for storage buckets is limited.
-- insert into storage.buckets (id, name, public) values ('form_qr_codes', 'form_qr_codes', true);

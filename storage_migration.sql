-- Create 'form_qr_codes' bucket (Public)
insert into storage.buckets (id, name, public)
values ('form_qr_codes', 'form_qr_codes', true)
on conflict (id) do nothing;

-- Create 'form_uploads' bucket (Public)
insert into storage.buckets (id, name, public)
values ('form_uploads', 'form_uploads', true)
on conflict (id) do nothing;

-- RLS Policies for 'form_qr_codes'
-- 1. Public can view QR codes
create policy "Public can view QR codes"
  on storage.objects for select
  using ( bucket_id = 'form_qr_codes' );

-- 2. Admins (authenticated) can upload QR codes
create policy "Admins can upload QR codes"
  on storage.objects for insert
  with check ( bucket_id = 'form_qr_codes' and auth.role() = 'authenticated' );

-- 3. Admins can update/delete QR codes
create policy "Admins can update QR codes"
  on storage.objects for update
  using ( bucket_id = 'form_qr_codes' and auth.role() = 'authenticated' );

create policy "Admins can delete QR codes"
  on storage.objects for delete
  using ( bucket_id = 'form_qr_codes' and auth.role() = 'authenticated' );


-- RLS Policies for 'form_uploads'
-- 1. Public can view uploads (needed for admins to see them via public URL, or you can restrict this)
create policy "Public can view form uploads"
  on storage.objects for select
  using ( bucket_id = 'form_uploads' );

-- 2. Public can upload files (for the form file input)
create policy "Public can upload files"
  on storage.objects for insert
  with check ( bucket_id = 'form_uploads' );

-- 3. Admins can delete uploads
create policy "Admins can delete form uploads"
  on storage.objects for delete
  using ( bucket_id = 'form_uploads' and auth.role() = 'authenticated' );

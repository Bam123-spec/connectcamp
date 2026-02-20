-- Create the 'events' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public Access (Read)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'events' );

-- Policy: Authenticated Uploads (Insert)
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;
CREATE POLICY "Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'events' );

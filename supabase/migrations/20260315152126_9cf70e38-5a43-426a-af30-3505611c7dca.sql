-- Allow anon users to insert into local-db bucket (since auth is email-only, not Supabase auth)
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
CREATE POLICY "Anyone can upload to local-db"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'local-db');

-- Allow anon users to update in local-db bucket
DROP POLICY IF EXISTS "Authenticated update" ON storage.objects;
CREATE POLICY "Anyone can update local-db"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'local-db');
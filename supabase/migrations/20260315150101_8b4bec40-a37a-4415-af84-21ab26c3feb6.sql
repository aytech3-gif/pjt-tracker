
-- Create storage bucket for shared local DB
INSERT INTO storage.buckets (id, name, public)
VALUES ('local-db', 'local-db', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from the bucket
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'local-db');

-- Only authenticated users can upload (admin check done in app)
CREATE POLICY "Authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'local-db');

-- Allow authenticated users to update (overwrite)
CREATE POLICY "Authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'local-db');

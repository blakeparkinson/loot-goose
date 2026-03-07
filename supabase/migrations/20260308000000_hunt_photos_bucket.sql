-- Create a public storage bucket for hunt photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('hunt-photos', 'hunt-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone with the anon key to upload photos
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'hunt-photos');

-- Allow public reads (bucket is public, but policy is still required)
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'hunt-photos');

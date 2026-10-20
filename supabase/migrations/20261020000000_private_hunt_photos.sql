-- Hunt photos now stay on the device. Close the bucket: no public URLs and no
-- anonymous uploads or reads. The hunt-photo-url edge function uses the service
-- role (which bypasses these policies) to hand out short-lived signed URLs so
-- older app installs can copy their existing photos onto the device.
UPDATE storage.buckets SET public = false WHERE id = 'hunt-photos';

DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

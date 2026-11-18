
CREATE POLICY "Verified members upload own listing media" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp','mp4')
  AND public.is_verified(auth.uid())
);
CREATE POLICY "Members read own listing media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Members delete own listing media" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);

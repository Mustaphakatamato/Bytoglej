-- ============================================================
-- Opret chat-images storage bucket + policies
-- Kør dette i Supabase → SQL Editor
-- ============================================================

-- 1. Opret bucket (public så getPublicUrl virker)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  true,
  10485760,  -- 10 MB maks per fil
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Tillad autentificerede brugere at uploade
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

-- 3. Tillad alle at læse (public bucket)
CREATE POLICY "Public read access for chat images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-images');

-- 4. Tillad brugere at slette egne filer
CREATE POLICY "Authenticated users can delete chat images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images');

-- Bekræftelse
SELECT id, name, public FROM storage.buckets WHERE id = 'chat-images';

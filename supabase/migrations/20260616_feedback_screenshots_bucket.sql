-- Opret feedback-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-screenshots', 'feedback-screenshots', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Authenticated brugere kan uploade
CREATE POLICY "feedback_screenshots_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'feedback-screenshots' AND auth.uid() IS NOT NULL
  );

-- Offentlig læseadgang (admin skal kunne se billederne)
CREATE POLICY "feedback_screenshots_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'feedback-screenshots');

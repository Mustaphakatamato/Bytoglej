-- Storage opsætning til produktbilleder
-- OBS: Opret først bucket manuelt i Supabase:
--   Storage → New bucket → Navn: "listing-images" → Public: ON → Create
--
-- Kør derefter disse politikker i SQL Editor:

create policy "Public read listing images"
  on storage.objects for select
  using ( bucket_id = 'listing-images' );

create policy "Auth upload listing images"
  on storage.objects for insert
  with check ( bucket_id = 'listing-images' );

create policy "Auth delete listing images"
  on storage.objects for delete
  using ( bucket_id = 'listing-images' );

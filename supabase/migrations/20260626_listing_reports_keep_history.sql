-- Bevar rapport-historik selv efter opslaget slettes:
-- FK ON DELETE CASCADE -> SET NULL, så rapportrækken overlever sletning af opslaget.
ALTER TABLE public.listing_reports DROP CONSTRAINT IF EXISTS listing_reports_listing_id_fkey;
ALTER TABLE public.listing_reports
  ADD CONSTRAINT listing_reports_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

-- Snapshot af opslaget, så historik kan vises efter opslaget er slettet.
ALTER TABLE public.listing_reports ADD COLUMN IF NOT EXISTS listing_title text;
ALTER TABLE public.listing_reports ADD COLUMN IF NOT EXISTS listing_institution_name text;

-- Hvilken handling admin tog: 'deactivated' | 'removed' | null.
ALTER TABLE public.listing_reports ADD COLUMN IF NOT EXISTS resolution text;

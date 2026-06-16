-- AI-scan logs: fanger alle AI-forslag til brug for fine-tuning af modellerne
-- Én række pr. scan. Udfyldes med brugerens endelige valg når opslaget submittes.

CREATE TABLE IF NOT EXISTS public.ai_scan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Kontekst
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  institution_name TEXT,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,

  -- Scan-type og model (vigtigt for at attribuere præcision til specifik modelversion)
  scan_type TEXT NOT NULL CHECK (scan_type IN ('scan-toy', 'fill-soges', 'improve-listing')),
  model_used TEXT,

  -- Input
  input_query TEXT,             -- fri tekst (fill-soges)

  -- Fuldt AI-svar — KRITISK for fine-tuning
  ai_raw_response JSONB,

  -- AI-forslag (udtrukket for nem forespørgsel)
  ai_title TEXT,
  ai_description TEXT,
  ai_category TEXT,
  ai_condition TEXT,
  ai_age_group TEXT,

  -- Prisforslag (scan-toy)
  ai_price_min INTEGER,
  ai_price_max INTEGER,
  ai_price_suggested INTEGER,
  ai_price_basis TEXT,           -- 'median' | 'ai'
  ai_price_comparable_count INTEGER,

  -- Brugerens endelige valg (udfyldes ved submit)
  final_title TEXT,
  final_description TEXT,
  final_category TEXT,
  final_condition TEXT,
  final_age_group TEXT,
  final_price INTEGER,

  -- Beregnede metrics (udfyldes ved submit)
  used_title BOOLEAN,
  used_description BOOLEAN,
  used_price BOOLEAN,
  price_delta INTEGER,           -- final_price - ai_price_suggested
  price_delta_pct NUMERIC(6,2), -- procentvis afvigelse

  -- Udfald
  submitted BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ
);

ALTER TABLE public.ai_scan_logs ENABLE ROW LEVEL SECURITY;

-- Kun admins kan læse
CREATE POLICY "Admins kan læse ai_scan_logs" ON public.ai_scan_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- API-routes bruger service role key og bypass RLS automatisk
-- Tilføjer INSERT-politik for direkte klientadgang hvis det bliver nødvendigt
CREATE POLICY "Brugere kan indsætte egne ai_scan_logs" ON public.ai_scan_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

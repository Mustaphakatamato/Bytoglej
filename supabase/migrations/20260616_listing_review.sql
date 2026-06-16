-- Manuel gennemgang af opslag afvist af AI-billedscanning

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS review_status TEXT CHECK (review_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS listings_review_status_idx
  ON public.listings(review_status)
  WHERE review_status IS NOT NULL;

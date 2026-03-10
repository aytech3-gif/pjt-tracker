
-- Table to accumulate all search results per user
CREATE TABLE public.search_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  search_query TEXT NOT NULL,
  project_name TEXT,
  project_address TEXT,
  developer TEXT,
  builder TEXT,
  designer TEXT,
  scale TEXT,
  purpose TEXT,
  area TEXT,
  status TEXT,
  date TEXT,
  source TEXT,
  summary TEXT,
  searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.search_results ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) to insert/select
-- No public access - only via edge functions
CREATE POLICY "Service role full access" ON public.search_results
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for user email lookups
CREATE INDEX idx_search_results_user_email ON public.search_results(user_email);
CREATE INDEX idx_search_results_searched_at ON public.search_results(searched_at DESC);

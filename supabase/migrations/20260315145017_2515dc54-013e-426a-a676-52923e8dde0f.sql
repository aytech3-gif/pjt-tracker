DROP POLICY "Allow insert for all" ON public.search_results;
CREATE POLICY "Service role insert only" ON public.search_results FOR INSERT TO service_role WITH CHECK (true);
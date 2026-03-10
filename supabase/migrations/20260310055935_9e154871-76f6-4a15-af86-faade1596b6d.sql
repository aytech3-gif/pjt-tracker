
-- Drop the overly permissive policy
DROP POLICY "Service role full access" ON public.search_results;

-- No public policies needed - edge functions use service_role which bypasses RLS
-- RLS stays enabled to block all direct client access

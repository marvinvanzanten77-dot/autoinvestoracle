-- =============================================================================
-- SECURITY FIXES: Phase 1
-- Closes 2 RLS policy gaps (global learning architecture)
-- =============================================================================

-- =============================================================================
-- FIX 1: execution_outcomes - Lock down INSERT to user-bound
-- =============================================================================

-- Drop the dangerous open policy
DROP POLICY IF EXISTS "System can insert outcomes" ON public.execution_outcomes;

-- Create secure policy: users can only insert their own outcomes
CREATE POLICY "Users can insert their own outcomes"
ON public.execution_outcomes
FOR INSERT
TO public
WITH CHECK ((auth.uid())::text = user_id);

-- Add UPDATE policy: users can only update their own outcomes
CREATE POLICY "Users can update their own outcomes"
ON public.execution_outcomes
FOR UPDATE
TO public
USING ((auth.uid())::text = user_id)
WITH CHECK ((auth.uid())::text = user_id);

-- =============================================================================
-- FIX 2: pattern_learning - Restrict writes to service-role only
-- =============================================================================

-- Drop the dangerous open policies
DROP POLICY IF EXISTS "System can insert patterns" ON public.pattern_learning;
DROP POLICY IF EXISTS "System can update patterns" ON public.pattern_learning;

-- Keep SELECT open (all users can read global patterns)
-- Pattern writes now happen ONLY via backend with service_role key
-- which bypasses RLS entirely (intended architecture)

-- Comment explaining the architecture
COMMENT ON TABLE public.pattern_learning IS 
'Global learning patterns table. 
READ: Public (all users see same patterns)
WRITE: Service role only (backend updates patterns)
This ensures clean, consistent learning without user-level modifications.';

-- =============================================================================
-- VERIFICATION QUERIES (run these to confirm policies are locked down)
-- =============================================================================

-- Check execution_outcomes policies
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'execution_outcomes'
-- order by policyname;

-- Check pattern_learning policies  
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'pattern_learning'
-- order by policyname;

-- Expected results:

-- execution_outcomes should have:
-- Users can view their own outcomes (SELECT, qual = ((auth.uid())::text = user_id))
-- Users can insert their own outcomes (INSERT, with_check = ((auth.uid())::text = user_id))
-- Users can update their own outcomes (UPDATE, using = ((auth.uid())::text = user_id))

-- pattern_learning should have ONLY:
-- Anyone can view patterns (SELECT, qual = true)
-- [NO INSERT/UPDATE policies - writes via service role only]

-- =============================================================================
-- ARCHITECTURE NOTES
-- =============================================================================

-- execution_outcomes (NOW SECURE):
-- - User agents can only write their own execution outcomes
-- - User can update only their own closed trades
-- - Prevents one user from corrupting another's trading history
-- - Server logs can still write via service role if needed

-- pattern_learning (NOW SECURE):  
-- - All users share one global pattern library (single source of truth)
-- - Clients cannot modify patterns (prevents sabotage/spam)
-- - Backend writes patterns atomically (via service_role key in api/index.ts)
-- - This enables "AI Oracle learns shared insights"
-- - No user_id needed - patterns are system-wide intelligence

-- =============================================================================

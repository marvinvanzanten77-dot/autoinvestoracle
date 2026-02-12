/**
 * TRADING OBSERVABILITY & INVARIANTS
 * 
 * Adds event logging and metrics for production verification
 * - execution_events: every state transition logged
 * - execution_stats_24h: cached metrics for promotion
 * - Invariant queries for hourly verification
 * 
 * Date: 2026-02-08
 * Status: Production monitoring
 */

-- ============================================================================
-- EXECUTION EVENTS TABLE (Observability)
-- ============================================================================
-- Every state transition logged with metadata for invariant verification
-- Used to: trace execution path, calculate recovery rates, prove no doubles

CREATE TABLE IF NOT EXISTS execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES trade_executions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  decision_path TEXT,  -- PLACE_ORDER | WAIT_OR_RECONCILE | RECONCILE_FIRST | RETURN_EXISTING | RECONCILE_ESCALATED
  client_order_id TEXT,
  bitvavo_order_id TEXT,
  error_class TEXT,  -- NULL | 'SOFT' (timeout/network) | 'HARD' (auth/schema/invalid)
  error_message TEXT,
  bitvavo_latency_ms INTEGER,
  reconcile_attempt_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_events_user_created
  ON execution_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_events_execution
  ON execution_events(execution_id);

CREATE INDEX IF NOT EXISTS idx_execution_events_decision_path
  ON execution_events(decision_path) WHERE decision_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_execution_events_error_class
  ON execution_events(error_class) WHERE error_class IS NOT NULL;

-- ============================================================================
-- EXECUTION STATS TABLE (For promotion criteria)
-- ============================================================================
-- Cached stats updated every 24h for auto-promotion logic
-- Single source of truth for "ready to promote?" decision

CREATE TABLE IF NOT EXISTS execution_stats_24h (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  success_rate NUMERIC(3, 2),  -- 0.00 to 1.00
  hard_failures INTEGER DEFAULT 0,
  soft_failures INTEGER DEFAULT 0,
  reconcile_attempts INTEGER DEFAULT 0,
  reconcile_found INTEGER DEFAULT 0,  -- How many reconciles found order on exchange
  unknown_outcome_recovery_rate NUMERIC(3, 2),  -- reconcile_found / reconcile_attempts (should be <5%)
  double_order_detections INTEGER DEFAULT 0,  -- Should be 0 (invariant check)
  stale_submitting_escalations INTEGER DEFAULT 0,  -- reconciles that hit max attempts
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_stats_updated
  ON execution_stats_24h(updated_at DESC);

-- ============================================================================
-- RPC FUNCTION: LOG EXECUTION EVENT
-- ============================================================================
-- Called after every state transition for observability
-- Critical for: proving no double orders, calculating recovery rates, audit trail

CREATE OR REPLACE FUNCTION log_execution_event(
  p_execution_id UUID,
  p_user_id UUID,
  p_from_status TEXT,
  p_to_status TEXT,
  p_decision_path TEXT,
  p_client_order_id TEXT,
  p_bitvavo_order_id TEXT,
  p_error_class TEXT,
  p_error_message TEXT,
  p_bitvavo_latency_ms INTEGER DEFAULT NULL,
  p_reconcile_attempt_number INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO execution_events (
    execution_id,
    user_id,
    from_status,
    to_status,
    decision_path,
    client_order_id,
    bitvavo_order_id,
    error_class,
    error_message,
    bitvavo_latency_ms,
    reconcile_attempt_number
  )
  VALUES (
    p_execution_id,
    p_user_id,
    p_from_status,
    p_to_status,
    p_decision_path,
    p_client_order_id,
    p_bitvavo_order_id,
    p_error_class,
    p_error_message,
    p_bitvavo_latency_ms,
    p_reconcile_attempt_number
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- ============================================================================
-- RPC FUNCTION: UPDATE EXECUTION STATS
-- ============================================================================
-- Called daily to refresh cached metrics for promotion decisions

CREATE OR REPLACE FUNCTION refresh_execution_stats_24h(p_user_id UUID)
RETURNS TABLE(
  total BIGINT,
  successful BIGINT,
  success_rate NUMERIC,
  hard_fails BIGINT,
  soft_fails BIGINT,
  reconcile_found BIGINT,
  recovery_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
  v_successful BIGINT;
  v_success_rate NUMERIC;
  v_hard_fails BIGINT;
  v_soft_fails BIGINT;
  v_recon_attempts BIGINT;
  v_recon_found BIGINT;
  v_recovery_rate NUMERIC;
BEGIN
  -- Count total executions (SUBMITTED + FILLED)
  SELECT COUNT(*)
  INTO v_total
  FROM trade_executions
  WHERE user_id = p_user_id
    AND status IN ('SUBMITTED', 'FILLED')
    AND created_at >= (NOW() - INTERVAL '24 hours');

  -- Count successful (FILLED or SUBMITTED with order_id)
  SELECT COUNT(*)
  INTO v_successful
  FROM trade_executions
  WHERE user_id = p_user_id
    AND status IN ('SUBMITTED', 'FILLED')
    AND bitvavo_order_id IS NOT NULL
    AND created_at >= (NOW() - INTERVAL '24 hours');

  -- Calculate success rate
  v_success_rate := CASE 
    WHEN v_total = 0 THEN 1.0
    ELSE v_successful::NUMERIC / v_total
  END;

  -- Count hard failures (FAILED with error_class='HARD')
  SELECT COUNT(*)
  INTO v_hard_fails
  FROM execution_events
  WHERE user_id = p_user_id
    AND error_class = 'HARD'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  -- Count soft failures (FAILED with error_class='SOFT')
  SELECT COUNT(*)
  INTO v_soft_fails
  FROM execution_events
  WHERE user_id = p_user_id
    AND error_class = 'SOFT'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  -- Count reconcile attempts and found
  SELECT COUNT(*)
  INTO v_recon_attempts
  FROM execution_events
  WHERE user_id = p_user_id
    AND decision_path IN ('RECONCILE_FIRST', 'RECONCILE_FOUND', 'RECONCILE_NOT_FOUND')
    AND created_at >= (NOW() - INTERVAL '24 hours');

  SELECT COUNT(*)
  INTO v_recon_found
  FROM execution_events
  WHERE user_id = p_user_id
    AND decision_path = 'RECONCILE_FOUND'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  -- Calculate recovery rate
  v_recovery_rate := CASE 
    WHEN v_recon_attempts = 0 THEN 0.0
    ELSE v_recon_found::NUMERIC / v_recon_attempts
  END;

  -- Update stats
  UPDATE execution_stats_24h
  SET
    total_executions = v_total::INTEGER,
    successful_executions = v_successful::INTEGER,
    success_rate = v_success_rate,
    hard_failures = v_hard_fails::INTEGER,
    soft_failures = v_soft_fails::INTEGER,
    reconcile_attempts = v_recon_attempts::INTEGER,
    reconcile_found = v_recon_found::INTEGER,
    unknown_outcome_recovery_rate = v_recovery_rate,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Insert if not exists
  IF NOT FOUND THEN
    INSERT INTO execution_stats_24h (
      user_id,
      total_executions,
      successful_executions,
      success_rate,
      hard_failures,
      soft_failures,
      reconcile_attempts,
      reconcile_found,
      unknown_outcome_recovery_rate
    )
    VALUES (
      p_user_id,
      v_total::INTEGER,
      v_successful::INTEGER,
      v_success_rate,
      v_hard_fails::INTEGER,
      v_soft_fails::INTEGER,
      v_recon_attempts::INTEGER,
      v_recon_found::INTEGER,
      v_recovery_rate
    );
  END IF;

  RETURN QUERY SELECT v_total, v_successful, v_success_rate, v_hard_fails, v_soft_fails, v_recon_found, v_recovery_rate;
END;
$$;

-- ============================================================================
-- INVARIANT QUERIES (Run hourly via cron to verify safety guarantees)
-- ============================================================================

/**
 * INVARIANT 1: No duplicate orders
 * 
 * Query: For each (user_id, bitvavo_order_id) with status in SUBMITTED/FILLED,
 *        count must be exactly 1 (never 0, never >1)
 * 
 * Run: SELECT * FROM invariant_check_no_duplicates();
 */
CREATE OR REPLACE FUNCTION invariant_check_no_duplicates()
RETURNS TABLE(
  check_name TEXT,
  violations_found BIGINT,
  violated BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH duplicates AS (
    SELECT user_id, bitvavo_order_id, COUNT(*) as cnt
    FROM trade_executions
    WHERE status IN ('SUBMITTED', 'FILLED')
      AND bitvavo_order_id IS NOT NULL
    GROUP BY user_id, bitvavo_order_id
    HAVING COUNT(*) > 1
  )
  SELECT
    'INVARIANT-1: No duplicate orders'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) > 0
  FROM duplicates;
END;
$$;

/**
 * INVARIANT 2: No stale SUBMITTING
 * 
 * Query: Executions in SUBMITTING state older than 10 minutes
 *        (TTL 30s + 9m30s margin = 600s + 570s)
 * 
 * Run: SELECT * FROM invariant_check_no_stale_submitting();
 */
CREATE OR REPLACE FUNCTION invariant_check_no_stale_submitting()
RETURNS TABLE(
  check_name TEXT,
  violations_found BIGINT,
  violated BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'INVARIANT-2: No stale SUBMITTING (>10 min)'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) > 0
  FROM trade_executions
  WHERE status = 'SUBMITTING'
    AND (NOW() - submitting_at) > INTERVAL '10 minutes';
END;
$$;

/**
 * INVARIANT 3: No SUBMITTED/FILLED without order_id
 * 
 * Query: If status is SUBMITTED or FILLED, bitvavo_order_id must be non-null
 * 
 * Run: SELECT * FROM invariant_check_no_missing_order_id();
 */
CREATE OR REPLACE FUNCTION invariant_check_no_missing_order_id()
RETURNS TABLE(
  check_name TEXT,
  violations_found BIGINT,
  violated BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'INVARIANT-3: No SUBMITTED/FILLED without order_id'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) > 0
  FROM trade_executions
  WHERE status IN ('SUBMITTED', 'FILLED')
    AND bitvavo_order_id IS NULL;
END;
$$;

/**
 * INVARIANT 4: client_order_id never null once SUBMITTING
 * 
 * Query: If status is SUBMITTING/SUBMITTED/FILLED, client_order_id must exist
 * 
 * Run: SELECT * FROM invariant_check_client_order_id_set();
 */
CREATE OR REPLACE FUNCTION invariant_check_client_order_id_set()
RETURNS TABLE(
  check_name TEXT,
  violations_found BIGINT,
  violated BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'INVARIANT-4: client_order_id set for SUBMITTING+'::TEXT,
    COUNT(*)::BIGINT,
    COUNT(*) > 0
  FROM trade_executions
  WHERE status IN ('SUBMITTING', 'SUBMITTED', 'FILLED')
    AND client_order_id IS NULL;
END;
$$;

/**
 * RUN ALL INVARIANTS AT ONCE
 * 
 * SELECT * FROM check_all_invariants();
 */
CREATE OR REPLACE FUNCTION check_all_invariants()
RETURNS TABLE(
  check_name TEXT,
  violations_found BIGINT,
  violated BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM invariant_check_no_duplicates();
  RETURN QUERY SELECT * FROM invariant_check_no_stale_submitting();
  RETURN QUERY SELECT * FROM invariant_check_no_missing_order_id();
  RETURN QUERY SELECT * FROM invariant_check_client_order_id_set();
END;
$$;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE execution_events IS
'Event log for every execution state transition. Used for:
- Proving no double-orders (audit trail)
- Calculating unknown-outcome recovery rates
- Debugging execution paths
- Monitoring error patterns (soft vs hard)';

COMMENT ON TABLE execution_stats_24h IS
'Cached metrics refreshed daily for promotion decisions:
- success_rate: must be >98% to promote
- unknown_outcome_recovery_rate: must be <5% (no flakiness)
- reconcile_found: how many timeout recoveries worked';

COMMENT ON FUNCTION log_execution_event IS
'Log a state transition. Called after every executeHardened step.
Captures: who, what status change, why (decision_path), errors, latency.';

COMMENT ON FUNCTION refresh_execution_stats_24h IS
'Refresh cached metrics for one user. Run daily via cron.
Used by promo logic: if stats pass criteria, promote to higher limit.';

/**
 * TRADING PHASE 2 HARDENING MIGRATION
 * 
 * Adds enterprise-grade production safety:
 * - Idempotent execution (one order per proposal maximum)
 * - Scheduler job locking (no double-scanning)
 * - Budget fact-based logging (correct caps under concurrency)
 * - Comprehensive audit trail (preflight, request, response)
 * 
 * Date: 2026-02-07
 * Status: Production-ready hardening
 */

-- ============================================================================
-- 1. TRADE EXECUTIONS TABLE (Idempotency guarantee)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trade_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  proposal_id UUID NOT NULL REFERENCES trade_proposals(id) ON DELETE CASCADE,
  action_id UUID REFERENCES trade_actions(id) ON DELETE SET NULL,
  
  -- Idempotency: ensures ONE proposal causes at most ONE execution
  idempotency_key TEXT NOT NULL UNIQUE,
  
  -- Status: CLAIMED → SUBMITTING (vóór Bitvavo) → SUBMITTED → CONFIRMED or FAILED
  -- SUBMITTING is crucial: prevents double-submit on timeout
  status TEXT NOT NULL DEFAULT 'CLAIMED'
    CHECK (status IN ('CLAIMED', 'SUBMITTING', 'SUBMITTED', 'CONFIRMED', 'FAILED')),
  
  -- Idempotency key voor Bitvavo (deterministic, prevents double-order on retry)
  client_order_id TEXT UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  submitting_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Error tracking
  error_code TEXT,
  error_message TEXT,
  last_error TEXT,
  
  -- Policy snapshot at execution time (for audit)
  policy_hash TEXT,
  policy_snapshot JSONB,
  
  -- Pre-flight validation results (all checks performed before trade)
  preflight JSONB NOT NULL DEFAULT '{}',
  preflight_passed BOOLEAN DEFAULT FALSE,
  preflight_reasons TEXT[],
  
  -- Bitvavo request/response (no sensitive data)
  bitvavo_request JSONB,
  bitvavo_response JSONB,
  bitvavo_order_id TEXT,
  bitvavo_error TEXT,
  
  -- For audit: what asset, side, value
  asset TEXT,
  side TEXT CHECK (side IN ('buy', 'sell')),
  order_value_eur NUMERIC(10, 2),
  
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_execution_per_proposal UNIQUE (user_id, proposal_id)
);

-- Index for executor to find pending confirmations
CREATE INDEX IF NOT EXISTS idx_trade_executions_user_created
  ON trade_executions(user_id, created_at DESC);

-- Index for finding claimed-but-not-confirmed
CREATE INDEX IF NOT EXISTS idx_trade_executions_status
  ON trade_executions(user_id, status);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_trade_executions_proposal
  ON trade_executions(proposal_id);

-- Index for reconcile by clientOrderId (idempotency recovery)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_executions_client_order_id
  ON trade_executions(client_order_id)
  WHERE client_order_id IS NOT NULL;

-- Index for finding SUBMITTING executions (timeout detection)
CREATE INDEX IF NOT EXISTS idx_trade_executions_submitting
  ON trade_executions(user_id, submitting_at)
  WHERE status = 'SUBMITTING';

-- RLS: Users can only access their own executions
ALTER TABLE trade_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trade_executions_user_isolation ON trade_executions;
CREATE POLICY trade_executions_user_isolation ON trade_executions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 2. SCHEDULER JOB LOCKING (Prevent double-scanning)
-- ============================================================================

ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;

-- Index for scheduler to claim due jobs
CREATE INDEX IF NOT EXISTS idx_scan_jobs_next_run
  ON scan_jobs(next_run_at, status)
  WHERE status = 'active';

-- ============================================================================
-- 3. GPT USAGE LOG (Fact-based budget enforcement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gpt_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_id UUID REFERENCES market_snapshots(id) ON DELETE SET NULL,
  
  -- When this GPT call was made
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata
  tokens_estimate INT,
  reason TEXT, -- e.g., "market_pulse_analysis", "signal_generation"
  success BOOLEAN DEFAULT TRUE,
  error TEXT,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for hourly/daily budget checks
CREATE INDEX IF NOT EXISTS idx_gpt_usage_log_user_time
  ON gpt_usage_log(user_id, created_at DESC);

-- Index for finding by snapshot (audit)
CREATE INDEX IF NOT EXISTS idx_gpt_usage_log_snapshot
  ON gpt_usage_log(snapshot_id);

-- RLS
ALTER TABLE gpt_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gpt_usage_log_user_isolation ON gpt_usage_log;
CREATE POLICY gpt_usage_log_user_isolation ON gpt_usage_log
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 4. TRADE HISTORY TABLE (For cooldown/anti-flip enforcement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity NUMERIC(16, 8),
  price_eur NUMERIC(12, 2),
  order_value_eur NUMERIC(10, 2),
  
  -- Status: pending, confirmed, failed
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed')),
  
  -- Bitvavo order details
  bitvavo_order_id TEXT,
  
  -- When trade was executed
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for cooldown checks (recent trades by asset)
CREATE INDEX IF NOT EXISTS idx_trade_history_user_asset_time
  ON trade_history(user_id, asset, executed_at DESC);

-- Index for hourly trade count
CREATE INDEX IF NOT EXISTS idx_trade_history_user_time
  ON trade_history(user_id, executed_at DESC);

-- RLS
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trade_history_user_isolation ON trade_history;
CREATE POLICY trade_history_user_isolation ON trade_history
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5. COOLDOWN TRACKING (Enhanced proposal table)
-- ============================================================================

ALTER TABLE trade_proposals ADD COLUMN IF NOT EXISTS override_cooldown BOOLEAN DEFAULT FALSE;
ALTER TABLE trade_proposals ADD COLUMN IF NOT EXISTS override_anti_flip BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 6. POLICY HASH (Audit trail)
-- ============================================================================

ALTER TABLE trade_proposals ADD COLUMN IF NOT EXISTS policy_hash TEXT;
ALTER TABLE trade_proposals ADD COLUMN IF NOT EXISTS policy_snapshot JSONB;

-- ============================================================================
-- 7. AUTO-UPDATE TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_executions_update_timestamp ON trade_executions;
CREATE TRIGGER trade_executions_update_timestamp
BEFORE UPDATE ON trade_executions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 8. PROPOSAL EXPIRY CLEANUP (Cascade APPROVED → EXPIRED if not executed)
-- ============================================================================

-- This function marks proposals as EXPIRED if they passed 60 min without execution
CREATE OR REPLACE FUNCTION expire_old_proposals()
RETURNS TABLE(expired_count INT) AS $$
DECLARE
  count INT;
BEGIN
  UPDATE trade_proposals
  SET status = 'EXPIRED'
  WHERE status IN ('PROPOSED', 'APPROVED')
    AND expires_at < NOW();
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. SCHEDULER LOCK RELEASE (Cleanup stale locks)
-- ============================================================================

CREATE OR REPLACE FUNCTION release_expired_locks()
RETURNS TABLE(released_count INT) AS $$
DECLARE
  count INT;
BEGIN
  UPDATE scan_jobs
  SET locked_at = NULL,
      locked_by = NULL,
      lock_expires_at = NULL
  WHERE lock_expires_at IS NOT NULL
    AND lock_expires_at < NOW();
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. BUDGET VALIDATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_gpt_daily_budget(
  p_user_id UUID,
  p_max_calls INT
)
RETURNS TABLE(
  calls_today INT,
  remaining INT,
  within_budget BOOLEAN
) AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  -- Get start of today (UTC)
  v_today_start := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  
  SELECT COUNT(*)::INT INTO v_count
  FROM gpt_usage_log
  WHERE user_id = p_user_id
    AND created_at >= v_today_start
    AND success = TRUE;
  
  RETURN QUERY SELECT
    v_count,
    GREATEST(0, p_max_calls - v_count),
    v_count < p_max_calls;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION check_gpt_hourly_budget(
  p_user_id UUID,
  p_max_calls INT
)
RETURNS TABLE(
  calls_this_hour INT,
  remaining INT,
  within_budget BOOLEAN
) AS $$
DECLARE
  v_hour_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  -- Get start of this hour (UTC)
  v_hour_start := DATE_TRUNC('hour', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  
  SELECT COUNT(*)::INT INTO v_count
  FROM gpt_usage_log
  WHERE user_id = p_user_id
    AND created_at >= v_hour_start
    AND success = TRUE;
  
  RETURN QUERY SELECT
    v_count,
    GREATEST(0, p_max_calls - v_count),
    v_count < p_max_calls;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 11. COOLDOWN & ANTI-FLIP VALIDATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_cooldown(
  p_user_id UUID,
  p_asset TEXT,
  p_cooldown_minutes INT DEFAULT 30
)
RETURNS TABLE(
  last_trade_at TIMESTAMPTZ,
  minutes_since_last_trade INT,
  cooldown_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    th.executed_at,
    EXTRACT(EPOCH FROM (NOW() - th.executed_at))::INT / 60 AS minutes_since,
    EXTRACT(EPOCH FROM (NOW() - th.executed_at))::INT / 60 < p_cooldown_minutes AS in_cooldown
  FROM trade_history th
  WHERE th.user_id = p_user_id
    AND th.asset = p_asset
    AND th.status IN ('confirmed', 'pending')
  ORDER BY th.executed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION check_anti_flip(
  p_user_id UUID,
  p_asset TEXT,
  p_proposed_side TEXT,
  p_anti_flip_minutes INT DEFAULT 120
)
RETURNS TABLE(
  last_trade_side TEXT,
  last_trade_at TIMESTAMPTZ,
  minutes_since_last_trade INT,
  flip_blocked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    th.side,
    th.executed_at,
    EXTRACT(EPOCH FROM (NOW() - th.executed_at))::INT / 60,
    th.side != p_proposed_side
      AND EXTRACT(EPOCH FROM (NOW() - th.executed_at))::INT / 60 < p_anti_flip_minutes
  FROM trade_history th
  WHERE th.user_id = p_user_id
    AND th.asset = p_asset
    AND th.status IN ('confirmed', 'pending')
  ORDER BY th.executed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 12. AUDIT LOGGING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_execution_audit(
  p_execution_id UUID,
  p_proposal_id UUID,
  p_preflight_passed BOOLEAN,
  p_preflight_reasons TEXT[]
)
RETURNS VOID AS $$
BEGIN
  UPDATE trade_executions
  SET
    preflight_passed = p_preflight_passed,
    preflight_reasons = p_preflight_reasons,
    updated_at = NOW()
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Frequently-used lookups
CREATE INDEX IF NOT EXISTS idx_proposals_user_status_created
  ON trade_proposals(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposals_expiry
  ON trade_proposals(expires_at)
  WHERE status IN ('PROPOSED', 'APPROVED');

CREATE INDEX IF NOT EXISTS idx_trade_actions_proposal
  ON trade_actions(proposal_id, created_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE trade_executions IS
'Idempotent execution records. Ensures ONE proposal → AT MOST ONE Bitvavo order.
Columns:
- idempotency_key: UNIQUE, typically proposal_id (belt & suspenders)
- status: CLAIMED (claimed by executor) → SUBMITTED → CONFIRMED → FAILED
- preflight: JSON result of all pre-execution checks (allowlist, caps, volatility)
- bitvavo_request/response: Full metadata (no secrets) for audit trail
- policy_hash: Hash of policy at execution time (detect changes)
RLS: user_id isolation. UNIQUE(user_id, proposal_id) prevents double execution.';

COMMENT ON TABLE gpt_usage_log IS
'Fact-based tracking of GPT API calls for budget enforcement.
Replaces reliance on counters in scan_jobs. Allows correct hourly/daily caps
even under concurrent scheduler ticks or multiple workers.
One row per successful/failed GPT call, indexed by user+time for efficient budget checks.';

COMMENT ON TABLE trade_history IS
'Record of executed trades for cooldown & anti-flip enforcement.
cooldown_minutes: time before same asset can be traded again (default 30).
anti_flip_minutes: time before opposite side can be traded (default 120).';

COMMENT ON COLUMN trade_executions.idempotency_key IS
'Unique key for this execution attempt. Typically proposal_id.
If execution is retried (network fail, timeout), same idempotency_key
ensures INSERT ON CONFLICT returns existing row, preventing double-trade.';

COMMENT ON COLUMN trade_executions.preflight IS
'JSON object with results of all pre-flight checks:
{
  "allowlist_check": {"passed": true, "reason": "asset in allowlist"},
  "order_size_check": {"passed": true, "min": 25, "max": 50, "requested": 100},
  "confidence_check": {"passed": true, "allowed": [75, 100], "requested": 75},
  "cooldown_check": {"passed": true, "minutes_since_last": 120},
  "anti_flip_check": {"passed": true, "reason": "same side"},
  "daily_trade_cap": {"passed": true, "count": 1, "max": 3},
  "hourly_trade_cap": {"passed": true, "count": 0, "max": 2}
}';

-- ============================================================================
-- RPC FUNCTION: LOCK AND DECIDE EXECUTION
-- ============================================================================
-- Atomically locks execution row and decides: submit new, return existing, reconcile, wait?
-- Implements the "before placeOrder" decision tree with transaction safety.

CREATE OR REPLACE FUNCTION lock_and_decide_execution(
  p_execution_id UUID,
  p_submitting_ttl_ms INTEGER DEFAULT 30000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exec RECORD;
  v_age_ms INTEGER;
  v_decision JSONB;
BEGIN
  -- Lock row (SELECT ... FOR UPDATE)
  SELECT id, status, bitvavo_order_id, client_order_id, submitting_at, proposal_id
  INTO v_exec
  FROM trade_executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF v_exec IS NULL THEN
    RETURN jsonb_build_object('error', 'Execution not found');
  END IF;

  -- Rule 1: If order_id exists, execution is complete
  IF v_exec.bitvavo_order_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'action', 'RETURN_EXISTING',
      'execution', row_to_json(v_exec)
    );
  END IF;

  -- Rule 2: If SUBMITTING and recent (TTL not expired), don't resubmit
  IF v_exec.status = 'SUBMITTING' AND v_exec.submitting_at IS NOT NULL THEN
    v_age_ms := EXTRACT(EPOCH FROM (NOW() - v_exec.submitting_at)) * 1000;
    IF v_age_ms < p_submitting_ttl_ms THEN
      RETURN jsonb_build_object(
        'action', 'WAIT_OR_RECONCILE',
        'execution', row_to_json(v_exec)
      );
    END IF;
    -- TTL expired: reconcile first
    RETURN jsonb_build_object(
      'action', 'RECONCILE_FIRST',
      'execution', row_to_json(v_exec),
      'reason', 'SUBMITTING TTL expired'
    );
  END IF;

  -- Rule 3: If SUBMITTED/FILLED but no order_id, reconcile
  IF v_exec.status IN ('SUBMITTED', 'FILLED') THEN
    RETURN jsonb_build_object(
      'action', 'RECONCILE_FIRST',
      'execution', row_to_json(v_exec),
      'reason', 'Status implies order, but order_id missing'
    );
  END IF;

  -- Rule 4: If FAILED, could retry, but decision is caller's
  -- For now: treat as can-retry (if caller wants)

  -- Rule 5: Claim submit-rights by setting SUBMITTING
  UPDATE trade_executions
  SET 
    status = 'SUBMITTING',
    submitting_at = NOW(),
    last_error = NULL,
    updated_at = NOW()
  WHERE id = p_execution_id
  RETURNING id, status, client_order_id, submitting_at
  INTO v_exec;

  RETURN jsonb_build_object(
    'action', 'PLACE_ORDER',
    'execution', row_to_json(v_exec)
  );
END;
$$;

-- ============================================================================
-- GRANTS (if needed)
-- ============================================================================

-- No special grants needed; all RLS'd to user.

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT
  'MIGRATION COMPLETE' as status,
  CURRENT_TIMESTAMP as executed_at,
  array[
    'trade_executions (idempotent execution)',
    'gpt_usage_log (fact-based budget)',
    'trade_history (cooldown/anti-flip)',
    'scan_jobs.locked_* (job locking)',
    'trade_proposals.override_* (user overrides)',
    'trade_proposals.policy_* (audit)'
  ] as new_tables_and_columns;

-- ============================================================================
-- TRADING UPGRADE: SCAN → PROPOSE → APPROVE → EXECUTE
-- Date: 2026-02-07
-- 
-- Adds:
-- - agent_policies (user trading policy configurations)
-- - scan_jobs (scheduler state per user)
-- - market_snapshots (market pulse data)
-- - trade_proposals (AI-generated trade ideas)
-- - trade_actions (user approvals/modifications)
-- - user_trading_settings (global kill switch)
-- 
-- Security Model:
-- - All proposals and actions are user-scoped via RLS
-- - Proposer only reads market data (no trading key)
-- - Executor requires APPROVED status + trading_enabled=true
-- ============================================================================

-- ============================================================================
-- TABLE 1: USER_TRADING_SETTINGS
-- ============================================================================
-- Global kill switch and trading enablement per user

CREATE TABLE IF NOT EXISTS user_trading_settings (
  user_id UUID PRIMARY KEY,
  trading_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_trading_settings_user_id
  ON user_trading_settings(user_id);

-- ============================================================================
-- TABLE 2: AGENT_POLICIES
-- ============================================================================
-- User's trading policy configuration (scans, budget, risk, assets, etc)

CREATE TABLE IF NOT EXISTS agent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  
  -- Policy configuration as JSONB
  -- Fields: scans, budget, gptGate, risk, signal, assets, reporting
  policy_json JSONB NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT policy_has_required_fields CHECK (
    policy_json ? 'scans' AND
    policy_json ? 'budget' AND
    policy_json ? 'gptGate' AND
    policy_json ? 'risk' AND
    policy_json ? 'signal'
  )
);

-- At most one active policy per user (enforce via trigger)
CREATE OR REPLACE FUNCTION enforce_single_active_policy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE agent_policies
      SET is_active = FALSE
      WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_active_policy
  AFTER UPDATE OF is_active ON agent_policies
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION enforce_single_active_policy();

CREATE INDEX IF NOT EXISTS idx_agent_policies_user_id
  ON agent_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_policies_active
  ON agent_policies(user_id, is_active);

-- ============================================================================
-- TABLE 3: SCAN_JOBS
-- ============================================================================
-- Scheduler state: next run, interval, daily counters

CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  
  interval_minutes INT NOT NULL CHECK (interval_minutes > 0),
  reason TEXT DEFAULT 'manual',
  
  runs_today INT DEFAULT 0,
  gpt_calls_today INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_policy FOREIGN KEY (policy_id)
    REFERENCES agent_policies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_user_id
  ON scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_next_run_at
  ON scan_jobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status
  ON scan_jobs(status, next_run_at);

-- ============================================================================
-- TABLE 4: MARKET_SNAPSHOTS
-- ============================================================================
-- Market pulse data: volatility, price moves, volume, portfolio summary

CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  interval_minutes INT NOT NULL,
  
  -- Market data structure:
  -- {
  --   "timestamp": ISO8601,
  --   "volatility": { "score": 0-100, "level": "low|medium|high" },
  --   "prices": {
  --     "BTC-EUR": { "current": 95000, "move1h_pct": 2.5, "move4h_pct": -1.2 },
  --     ...
  --   },
  --   "volume": {
  --     "BTC-EUR": { "current": 1000000, "avg24h": 900000, "z_score": 0.5 }
  --   },
  --   "portfolio": {
  --     "totalValue": 10000,
  --     "balances": { "EUR": 5000, "BTC": 0.05 },
  --     "exposure": 0.50
  --   }
  -- }
  data JSONB NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_user_id
  ON market_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_created_at
  ON market_snapshots(user_id, created_at DESC);

-- ============================================================================
-- TABLE 5: TRADE_PROPOSALS
-- ============================================================================
-- AI-generated trade proposals awaiting user decision

CREATE TABLE IF NOT EXISTS trade_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED', 'EXPIRED', 'DECLINED', 'APPROVED', 'EXECUTED', 'FAILED')),
  
  -- Proposal structure:
  -- {
  --   "asset": "BTC-EUR",
  --   "side": "buy" | "sell",
  --   "orderType": "market" | "limit",
  --   "orderValueEur": 1000,
  --   "limitPrice": 95000.00,
  --   "tif": "IOC" | "GTC" | "GTD"
  -- }
  proposal JSONB NOT NULL,
  
  confidence INT NOT NULL
    CHECK (confidence IN (0, 25, 50, 75, 100)),
  
  -- Rationale structure:
  -- {
  --   "why": "...",
  --   "whyNot": "...",
  --   "invalidations": [...],
  --   "nextTrigger": "...",
  --   "riskNotes": "..."
  -- }
  rationale JSONB NOT NULL,
  
  policy_hash TEXT NOT NULL,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_snapshot FOREIGN KEY (snapshot_id)
    REFERENCES market_snapshots(id) ON DELETE CASCADE,
  CONSTRAINT fk_policy FOREIGN KEY (policy_id)
    REFERENCES agent_policies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_proposals_user_id
  ON trade_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_status
  ON trade_proposals(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_expires_at
  ON trade_proposals(expires_at);

-- ============================================================================
-- TABLE 6: TRADE_ACTIONS
-- ============================================================================
-- User decisions: Accept, Modify, Decline

CREATE TABLE IF NOT EXISTS trade_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  proposal_id UUID NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  action TEXT NOT NULL
    CHECK (action IN ('ACCEPT', 'MODIFY', 'DECLINE')),
  
  -- For MODIFY: diff of changed fields
  -- {
  --   "orderValueEur": { "from": 1000, "to": 1500 },
  --   "limitPrice": { "from": 95000, "to": 94500 }
  -- }
  modified_fields JSONB,
  
  user_notes TEXT,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_proposal FOREIGN KEY (proposal_id)
    REFERENCES trade_proposals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_actions_user_id
  ON trade_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_actions_proposal_id
  ON trade_actions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_trade_actions_created_at
  ON trade_actions(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_trading_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_actions ENABLE ROW LEVEL SECURITY;

-- user_trading_settings: users see only their own
CREATE POLICY user_trading_settings_isolation
  ON user_trading_settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- agent_policies: users see only their own
CREATE POLICY agent_policies_isolation
  ON agent_policies
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- scan_jobs: users see only their own
CREATE POLICY scan_jobs_isolation
  ON scan_jobs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- market_snapshots: users see only their own
CREATE POLICY market_snapshots_isolation
  ON market_snapshots
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- trade_proposals: users see only their own
CREATE POLICY trade_proposals_isolation
  ON trade_proposals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- trade_actions: users see only their own
CREATE POLICY trade_actions_isolation
  ON trade_actions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_policies_timestamp
  BEFORE UPDATE ON agent_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_scan_jobs_timestamp
  BEFORE UPDATE ON scan_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Reset daily counters when date changes
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_reset_date < CURRENT_DATE THEN
    NEW.runs_today := 0;
    NEW.gpt_calls_today := 0;
    NEW.last_reset_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scan_jobs_reset_counters
  BEFORE UPDATE ON scan_jobs
  FOR EACH ROW
  EXECUTE FUNCTION reset_daily_counters();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE agent_policies IS
  'User trading policies with config for scans, budget, risk, assets';

COMMENT ON TABLE scan_jobs IS
  'Scheduler state: controls when market scans run for each user';

COMMENT ON TABLE market_snapshots IS
  'Market pulse data: volatility, price moves, volume, portfolio';

COMMENT ON TABLE trade_proposals IS
  'AI-generated trade proposals awaiting user approval/modification';

COMMENT ON TABLE trade_actions IS
  'User decisions on proposals: Accept/Modify/Decline';

COMMENT ON TABLE user_trading_settings IS
  'Global kill switch: trading_enabled true/false';

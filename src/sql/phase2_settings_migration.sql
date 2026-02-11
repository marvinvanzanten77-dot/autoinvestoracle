-- =============================================================================
-- MIGRATION: Add Settings Columns for Unified Context System
-- Phase 2: Settings Management (Risk Level, Scan Interval, Strategy, Limits)
-- =============================================================================

-- Table: USER_PROFILES - Add trading strategy and limit columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS risk_profile TEXT DEFAULT 'gebalanceerd'; -- 'voorzichtig', 'gebalanceerd', 'actief'
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS strategy TEXT DEFAULT 'Buy & Hold'; -- 'DCA', 'Grid Trading', 'Momentum', 'Buy & Hold'
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS max_position_size NUMERIC(5, 2) DEFAULT 10; -- 1-100 percentage
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_loss_limit NUMERIC(5, 2) DEFAULT 5; -- 0.5-10 percentage

CREATE INDEX IF NOT EXISTS idx_user_profiles_risk ON user_profiles(risk_profile);
CREATE INDEX IF NOT EXISTS idx_user_profiles_strategy ON user_profiles(strategy);

-- =============================================================================

-- Table: NOTIFICATION_PREFERENCES - Add market scan interval column
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS market_scan_interval TEXT DEFAULT 'manual'; -- '1h', '6h', '24h', 'manual'

CREATE INDEX IF NOT EXISTS idx_notification_prefs_scan ON notification_preferences(market_scan_interval);

-- =============================================================================

-- Table: MARKET_SCANS - Track automatic and manual market scans
CREATE TABLE IF NOT EXISTS market_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  exchange TEXT NOT NULL,
  scan_type TEXT DEFAULT 'automatic', -- 'automatic', 'manual'
  findings JSONB, -- volatility, sentiment, topOpportunities, warnings, observations
  data_quality NUMERIC(5, 2) DEFAULT 100, -- 0-100 score
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_next TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_scans_user_id ON market_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON market_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_type ON market_scans(scan_type);

ALTER TABLE market_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scans" ON market_scans
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "System can insert scans" ON market_scans
  FOR INSERT WITH CHECK (true);

-- =============================================================================

-- Table: CONTEXT_CACHE - Cache unified context for performance
CREATE TABLE IF NOT EXISTS context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  context_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_cache_user_id ON context_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_expires ON context_cache(expires_at);

ALTER TABLE context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own cache" ON context_cache
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "System can update cache" ON context_cache
  FOR UPDATE USING (true);

CREATE POLICY "System can insert cache" ON context_cache
  FOR INSERT WITH CHECK (true);

-- =============================================================================

-- Data: Initialize default user profiles if they don't exist
-- This ensures every user has a profile with defaults
-- Note: This is a template - actual user profiles created during registration

-- Example: INSERT INTO user_profiles (user_id, email, display_name, risk_profile, strategy)
-- VALUES ('user-123', 'user@example.com', 'John Doe', 'gebalanceerd', 'DCA')
-- ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================

-- Documentation: Column Descriptions

-- user_profiles.risk_profile
-- - voorzichtig (cautious): 5% max per position, conservative assets, low volatility tolerance
-- - gebalanceerd (balanced): 10% max per position, mixed asset allocation, moderate risk
-- - actief (active): 25% max per position, aggressive assets, high volatility tolerance

-- user_profiles.strategy
-- - DCA (Dollar Cost Averaging): Fixed amount intervals, removes timing risk
-- - Grid Trading: Buy/sell at specific price levels, automates position sizing
-- - Momentum: Follow trend direction, capture upswings, exit on reversal
-- - Buy & Hold: Long-term holdings, minimum trading

-- user_profiles.max_position_size
-- - Percentage of portfolio for any single position (1-100)
-- - Automatically enforced by order sizing logic
-- - Limits portfolio risk concentration

-- user_profiles.daily_loss_limit
-- - Maximum daily loss percentage before stopping trading (0.5-10)
-- - Prevents catastrophic drawdowns
-- - Useful for volatile market conditions

-- notification_preferences.market_scan_interval
-- - manual: Only scan when user requests
-- - 1h: Run market scan every hour
-- - 6h: Run market scan every 6 hours
-- - 24h: Run market scan daily

-- market_scans.findings structure:
-- {
--   "volatility": { "score": 0-100, "trend": "increasing|stable|decreasing" },
--   "sentiment": { "score": 0-100, "label": "bearish|neutral|bullish" },
--   "topOpportunities": [
--     { "symbol": "BTC", "signal": "buy|sell|hold", "confidence": 0-100 },
--     ...
--   ],
--   "warnings": ["High volatility", "Low liquidity", ...],
--   "observations": ["Bitcoin dominance rising", "Alt season starting", ...]
-- }

-- =============================================================================

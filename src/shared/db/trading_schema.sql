-- ============================================================================
-- TRADING SYSTEM SCHEMA (for AI agent)
-- 
-- Tables:
-- 1. trading_signals — AI-generated trade signals
-- 2. trading_executions — Actual trade executions with results
-- 3. trading_positions — Open positions tracking
-- 4. trading_settings — User trading preferences & risk limits
-- ============================================================================

-- ============================================================================
-- TABLE 1: TRADING SIGNALS
-- ============================================================================
-- Stores all AI-generated signals for audit & learning

CREATE TABLE IF NOT EXISTS trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  action TEXT NOT NULL, -- 'buy', 'sell', 'hold', 'close_position', 'wait'
  confidence INTEGER NOT NULL, -- 0, 25, 50, 75, 100
  quantity DECIMAL(16, 8),
  price DECIMAL(16, 2),
  rationale TEXT,
  risk_level TEXT NOT NULL, -- 'low', 'medium', 'high'
  max_loss DECIMAL(16, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trading_signals_user_id 
  ON trading_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_signals_created 
  ON trading_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trading_signals_asset 
  ON trading_signals(asset);

-- ============================================================================
-- TABLE 2: TRADING EXECUTIONS
-- ============================================================================
-- Actual trades executed with full result tracking

CREATE TABLE IF NOT EXISTS trading_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  audit_id TEXT UNIQUE NOT NULL, -- For internal audit trail
  asset TEXT NOT NULL,
  action TEXT NOT NULL, -- 'buy', 'sell', 'hold', 'close_position', 'wait'
  
  success BOOLEAN NOT NULL,
  quantity DECIMAL(16, 8),
  price DECIMAL(16, 2),
  fee DECIMAL(16, 2),
  total_value DECIMAL(16, 2),
  order_id TEXT, -- Exchange order ID if successful
  
  message TEXT,
  error_code TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trading_executions_user_id 
  ON trading_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_executions_created 
  ON trading_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trading_executions_audit_id 
  ON trading_executions(audit_id);
CREATE INDEX IF NOT EXISTS idx_trading_executions_asset 
  ON trading_executions(asset);

-- ============================================================================
-- TABLE 3: TRADING POSITIONS (Open Positions)
-- ============================================================================
-- Track active open positions

CREATE TABLE IF NOT EXISTS trading_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  exchange TEXT NOT NULL, -- 'bitvavo', 'kraken', etc.
  asset TEXT NOT NULL,
  
  quantity DECIMAL(16, 8) NOT NULL,
  entry_price DECIMAL(16, 2) NOT NULL,
  current_price DECIMAL(16, 2),
  
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  opened_by TEXT, -- 'ai_agent', 'manual', etc.
  
  unrealized_pnl DECIMAL(16, 2),
  unrealized_pnl_pct DECIMAL(5, 2),
  
  is_active BOOLEAN DEFAULT TRUE,
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_price DECIMAL(16, 2),
  realized_pnl DECIMAL(16, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trading_positions_user_id 
  ON trading_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_positions_active 
  ON trading_positions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_trading_positions_asset 
  ON trading_positions(asset);

-- ============================================================================
-- TABLE 4: TRADING SETTINGS
-- ============================================================================
-- User's risk profile & trading preferences

CREATE TABLE IF NOT EXISTS trading_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  
  risk_profile TEXT NOT NULL, -- 'voorzichtig', 'gebalanceerd', 'actief'
  
  max_position_size DECIMAL(3, 2) NOT NULL, -- 0.10 = 10%
  max_total_exposure DECIMAL(3, 2) NOT NULL, -- 0.60 = 60%
  max_drawdown DECIMAL(3, 2) NOT NULL, -- 0.10 = 10%
  
  allowed_assets TEXT[] NOT NULL, -- ['BTC', 'ETH', 'ADA']
  blocked_assets TEXT[] DEFAULT '{}',
  
  enable_auto_trading BOOLEAN DEFAULT FALSE,
  enable_ai_signals BOOLEAN DEFAULT TRUE,
  
  -- Risk controls
  max_daily_loss DECIMAL(16, 2),
  max_monthly_loss DECIMAL(16, 2),
  min_signal_confidence INTEGER DEFAULT 50, -- 0-100
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trading_settings_user_id 
  ON trading_settings(user_id);

-- ============================================================================
-- TABLE 5: TRADING AUDIT LOG
-- ============================================================================
-- Fine-grained audit trail for compliance

CREATE TABLE IF NOT EXISTS trading_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'signal_created', 'trade_executed', 'error', 'override'
  
  related_signal_id UUID REFERENCES trading_signals(id) ON DELETE SET NULL,
  related_execution_id UUID REFERENCES trading_executions(id) ON DELETE SET NULL,
  
  details JSONB,
  metadata JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trading_audit_log_user_id 
  ON trading_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_audit_log_event_type 
  ON trading_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_trading_audit_log_created 
  ON trading_audit_log(created_at DESC);

-- ============================================================================
-- TRIGGERS (for automatic timestamp updates)
-- ============================================================================

-- Update trading_signals.updated_at
CREATE OR REPLACE FUNCTION update_trading_signals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_trading_signals_update
  BEFORE UPDATE ON trading_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_trading_signals_timestamp();

-- Update trading_positions.updated_at
CREATE OR REPLACE FUNCTION update_trading_positions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_trading_positions_update
  BEFORE UPDATE ON trading_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_trading_positions_timestamp();

-- Update trading_settings.updated_at
CREATE OR REPLACE FUNCTION update_trading_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_trading_settings_update
  BEFORE UPDATE ON trading_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_trading_settings_timestamp();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE trading_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own data
CREATE POLICY trading_signals_user_isolation 
  ON trading_signals 
  FOR ALL 
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY trading_executions_user_isolation 
  ON trading_executions 
  FOR ALL 
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY trading_positions_user_isolation 
  ON trading_positions 
  FOR ALL 
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY trading_settings_user_isolation 
  ON trading_settings 
  FOR ALL 
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY trading_audit_log_user_isolation 
  ON trading_audit_log 
  FOR ALL 
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Example trading settings for new users (optional)
-- This would typically be created via an onboarding flow
/*
INSERT INTO trading_settings (
  user_id,
  risk_profile,
  max_position_size,
  max_total_exposure,
  max_drawdown,
  allowed_assets,
  enable_auto_trading,
  enable_ai_signals
) VALUES (
  'user_123',
  'gebalanceerd',
  0.20,
  0.60,
  0.10,
  ARRAY['BTC', 'ETH', 'ADA'],
  FALSE,
  TRUE
);
*/

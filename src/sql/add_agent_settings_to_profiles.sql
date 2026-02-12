-- Add agent settings columns to profiles table
-- Safe migration - uses IF NOT EXISTS

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_monitoring_interval INTEGER DEFAULT 60;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_alert_on_volatility BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_volatility_threshold FLOAT DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_analysis_depth TEXT DEFAULT 'basic';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_auto_trade BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_risk_per_trade FLOAT DEFAULT 2;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_max_daily_loss FLOAT DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_confidence_threshold INTEGER DEFAULT 70;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_order_limit INTEGER DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_trading_strategy TEXT DEFAULT 'balanced';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_enable_stop_loss BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_stop_loss_percent FLOAT DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_last_scan_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_settings_updated_at TIMESTAMP DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_agent_monitoring_interval ON profiles(agent_monitoring_interval);
CREATE INDEX IF NOT EXISTS idx_profiles_agent_last_scan_at ON profiles(agent_last_scan_at);

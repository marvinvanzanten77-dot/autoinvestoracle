-- =============================================================================
-- CRITICAL SUPABASE SCHEMA MIGRATIONS
-- Phase 1: Email Persistence + Notification Preferences
-- =============================================================================

-- Table 1: USER PROFILES (for email and personal data)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  location TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- =============================================================================

-- Table 2: NOTIFICATION PREFERENCES (user opt-in/opt-out settings)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  email_on_execution BOOLEAN DEFAULT true,
  email_on_alert BOOLEAN DEFAULT true,
  email_on_daily_summary BOOLEAN DEFAULT false,
  sms_on_execution BOOLEAN DEFAULT false,
  push_on_execution BOOLEAN DEFAULT false,
  digest_frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'never'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences" ON notification_preferences
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- =============================================================================

-- Table 3: AGENT ACTIVITIES LOG (persistent activity tracking)
CREATE TABLE IF NOT EXISTS agent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  exchange TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'analysis', 'alert', 'monitoring', 'execution'
  status TEXT NOT NULL, -- 'success', 'pending', 'error'
  title TEXT,
  description TEXT,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER,
  archived BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON agent_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON agent_activities(timestamp);
CREATE INDEX IF NOT EXISTS idx_activities_user_timestamp ON agent_activities(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activities_archived ON agent_activities(archived);

ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities" ON agent_activities
  FOR SELECT USING (auth.uid()::text = user_id);

-- =============================================================================

-- Table 4: EXECUTION OUTCOMES LOG (track trade outcomes)
CREATE TABLE IF NOT EXISTS execution_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  symbol TEXT,
  entry_price DECIMAL(20, 8),
  exit_price DECIMAL(20, 8),
  quantity DECIMAL(20, 8),
  profit_loss DECIMAL(20, 8),
  profit_loss_percent DECIMAL(10, 2),
  status TEXT DEFAULT 'open', -- 'open', 'closed', 'pending'
  confidence NUMERIC(5,2),
  confidence_score NUMERIC(5,2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_outcomes_user_id ON execution_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_execution_id ON execution_outcomes(execution_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_status ON execution_outcomes(status);
CREATE INDEX IF NOT EXISTS idx_outcomes_user_recorded ON execution_outcomes(user_id, recorded_at DESC);

ALTER TABLE execution_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outcomes" ON execution_outcomes
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "System can insert outcomes" ON execution_outcomes
  FOR INSERT WITH CHECK (true);

-- =============================================================================

-- Table 5: PATTERN LEARNING (discovered trading patterns)
CREATE TABLE IF NOT EXISTS pattern_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'asset', 'time_of_day', 'confidence_band', 'market_condition'
  condition TEXT NOT NULL, -- e.g., 'BTC', '08:00-14:00', 'High (70-90)', 'bull_market'
  win_rate DECIMAL(5, 4), -- 0.0 to 1.0
  avg_profit DECIMAL(20, 8), -- average profit per trade
  sample_size INTEGER DEFAULT 0, -- number of trades in this pattern
  period_days INTEGER DEFAULT 30, -- lookback period for this pattern
  confidence_score DECIMAL(5, 4) DEFAULT 0.5, -- how confident we are in this pattern
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category, condition)
);

CREATE INDEX IF NOT EXISTS idx_pattern_category ON pattern_learning(category);
CREATE INDEX IF NOT EXISTS idx_pattern_category_condition ON pattern_learning(category, condition);
CREATE INDEX IF NOT EXISTS idx_pattern_updated ON pattern_learning(last_updated DESC);

ALTER TABLE pattern_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view patterns" ON pattern_learning
  FOR SELECT USING (true);

CREATE POLICY "System can update patterns" ON pattern_learning
  FOR UPDATE USING (true);

CREATE POLICY "System can insert patterns" ON pattern_learning
  FOR INSERT WITH CHECK (true);

-- =============================================================================

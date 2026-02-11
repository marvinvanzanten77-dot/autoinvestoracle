-- Agent Reports Schema - Safe migration
-- Handles cases where profiles table might not exist yet

-- First, ensure profiles table exists (or create it if missing)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  full_name TEXT,
  portfolio_data JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add agent status fields if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_status TEXT DEFAULT 'running' CHECK (agent_status IN ('running', 'paused', 'offline'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_status_changed_at TIMESTAMP DEFAULT NOW();

-- Agent Reports Table
CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  reported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Period info
  period_from TIMESTAMP NOT NULL,
  period_to TIMESTAMP NOT NULL,
  period_duration_minutes INTEGER NOT NULL,
  
  -- Summary
  observations_count INTEGER NOT NULL DEFAULT 0,
  suggestions_count INTEGER NOT NULL DEFAULT 0,
  executions_count INTEGER NOT NULL DEFAULT 0,
  main_theme TEXT,
  
  -- Details (JSON arrays)
  observations JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  
  -- Agent state
  agent_mood TEXT NOT NULL CHECK (agent_mood IN ('bullish', 'bearish', 'cautious')),
  recommended_action TEXT,
  overall_confidence INTEGER CHECK (overall_confidence >= 0 AND overall_confidence <= 100),
  
  -- Notification
  should_notify BOOLEAN DEFAULT FALSE,
  notification_sent TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_hourly_report UNIQUE (user_id, reported_at)
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Content
  type TEXT NOT NULL CHECK (type IN ('agent-report', 'action-executed', 'alert', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

-- Agent Activity Log Table
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Status transition
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL CHECK (new_status IN ('running', 'paused', 'offline')),
  reason TEXT,
  
  -- Metadata
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  changed_by TEXT DEFAULT 'user',
  
  CONSTRAINT status_transition_log UNIQUE (user_id, changed_at)
);

-- Market Observations Table (if not exists)
CREATE TABLE IF NOT EXISTS market_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  range TEXT CHECK (range IN ('1h', '24h', '7d')),
  asset_category TEXT,
  exchanges TEXT[] DEFAULT '{}',
  
  market_context TEXT,
  volatility_level TEXT,
  observed_behavior TEXT,
  relative_momentum JSONB DEFAULT '{}',
  exchange_anomalies JSONB DEFAULT '[]',
  
  data_sources JSONB DEFAULT '{}',
  source TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_reports_user_id ON agent_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_reports_reported_at ON agent_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reports_mood ON agent_reports(agent_mood);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_agent_status ON profiles(agent_status);
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_user_id ON agent_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_changed_at ON agent_activity_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_observations_user_id ON market_observations(user_id);
CREATE INDEX IF NOT EXISTS idx_market_observations_timestamp ON market_observations(timestamp DESC);

-- Enable RLS
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can see own reports" ON agent_reports;
DROP POLICY IF EXISTS "Users can see own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can see own activity log" ON agent_activity_log;
DROP POLICY IF EXISTS "Users can see own observations" ON market_observations;

-- RLS Policies
CREATE POLICY "Users can see own reports" ON agent_reports
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can see own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can see own activity log" ON agent_activity_log
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can see own observations" ON market_observations
  FOR SELECT USING (auth.uid()::text = user_id::text);

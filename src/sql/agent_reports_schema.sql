-- Agent Reports Table
-- Stores hourly agent reports with observations and action suggestions

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
-- For sending alerts to users about agent recommendations

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

-- Indexes for performance
CREATE INDEX idx_agent_reports_user_id ON agent_reports(user_id);
CREATE INDEX idx_agent_reports_reported_at ON agent_reports(reported_at DESC);
CREATE INDEX idx_agent_reports_mood ON agent_reports(agent_mood);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can see own reports" ON agent_reports
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can see own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Add agent_status field to profiles table
-- Allows pausing/resuming agent activity and going offline

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_status TEXT DEFAULT 'running' CHECK (agent_status IN ('running', 'paused', 'offline'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_status_changed_at TIMESTAMP DEFAULT NOW();

-- Create index for agent status queries
CREATE INDEX IF NOT EXISTS idx_profiles_agent_status ON profiles(agent_status);

-- Create agent_activity_log table for tracking agent status changes
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Status transition
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL CHECK (new_status IN ('running', 'paused', 'offline')),
  reason TEXT,
  
  -- Metadata
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  changed_by TEXT DEFAULT 'user', -- 'user', 'system', 'auto'
  
  CONSTRAINT status_transition_log UNIQUE (user_id, changed_at)
);

-- Index for activity log queries
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_user_id ON agent_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_changed_at ON agent_activity_log(changed_at DESC);

-- Enable RLS
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can see own activity log" ON agent_activity_log
  FOR SELECT USING (auth.uid()::text = user_id::text);

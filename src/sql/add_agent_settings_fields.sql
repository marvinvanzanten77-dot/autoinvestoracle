-- Add missing agent settings fields to profiles table
-- This fixes the 22 type errors in api/index.ts
-- Execute this in Supabase SQL editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_monitoring_interval INTEGER DEFAULT 60;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_alert_on_volatility BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_volatility_threshold INTEGER DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_analysis_depth TEXT DEFAULT 'basic' CHECK (agent_analysis_depth IN ('basic', 'advanced', 'expert'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_auto_trade BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_risk_per_trade NUMERIC DEFAULT 2.0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_max_daily_loss NUMERIC DEFAULT 5.0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_confidence_threshold INTEGER DEFAULT 70 CHECK (agent_confidence_threshold >= 0 AND agent_confidence_threshold <= 100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_order_limit INTEGER DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_trading_strategy TEXT DEFAULT 'balanced' CHECK (agent_trading_strategy IN ('conservative', 'balanced', 'aggressive'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_enable_stop_loss BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_stop_loss_percent NUMERIC DEFAULT 5.0;

-- Add execution_outcomes table for outcome recording
CREATE TABLE IF NOT EXISTS execution_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  observation_id UUID REFERENCES market_observations(id) ON DELETE CASCADE,
  
  -- What was predicted
  predicted_action TEXT NOT NULL,
  predicted_asset TEXT NOT NULL,
  predicted_confidence INTEGER NOT NULL,
  predicted_at TIMESTAMP NOT NULL,
  
  -- What actually happened
  actual_outcome TEXT NOT NULL,
  actual_result TEXT,
  duration_hours NUMERIC,
  profit_loss_percent NUMERIC,
  
  -- Learning
  was_significant BOOLEAN DEFAULT FALSE,
  pattern_identified TEXT,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMP,
  
  CONSTRAINT unique_observation_outcome UNIQUE (observation_id)
);

-- Add patterns table for pattern learning
CREATE TABLE IF NOT EXISTS learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Pattern identification
  pattern_type TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Performance metrics
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  average_return_percent NUMERIC DEFAULT 0,
  
  -- Conditions
  trigger_condition JSONB NOT NULL,
  market_context JSONB,
  
  -- Active/Inactive
  active BOOLEAN DEFAULT TRUE,
  confidence_score NUMERIC DEFAULT 0,
  
  -- Metadata
  first_observed TIMESTAMP NOT NULL DEFAULT NOW(),
  last_observed TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_pattern UNIQUE (user_id, pattern_type, description)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_execution_outcomes_user_id ON execution_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_outcomes_created_at ON execution_outcomes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_outcomes_pattern ON execution_outcomes(pattern_identified);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_user_id ON learned_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_active ON learned_patterns(active);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_type ON learned_patterns(pattern_type);

-- Enable RLS if needed
ALTER TABLE execution_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can see own outcomes" ON execution_outcomes;
DROP POLICY IF EXISTS "Users can see own patterns" ON learned_patterns;

CREATE POLICY "Users can see own outcomes" ON execution_outcomes
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can see own patterns" ON learned_patterns
  FOR SELECT USING (auth.uid()::text = user_id::text);

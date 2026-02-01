-- Academy module progress tracking
CREATE TABLE IF NOT EXISTS academy_module_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- User badges earned
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  level TEXT NOT NULL, -- 'beginner', 'intermediate', 'expert'
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_academy_progress_user_id ON academy_module_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_level ON user_badges(level);

-- Row Level Security
ALTER TABLE academy_module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can see their own progress" ON academy_module_progress
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own progress" ON academy_module_progress
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own progress" ON academy_module_progress
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can see their own badges" ON user_badges
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view public badge stats" ON user_badges
  FOR SELECT USING (true);

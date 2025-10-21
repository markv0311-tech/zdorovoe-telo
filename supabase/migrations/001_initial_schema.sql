-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_user_id BIGINT UNIQUE NOT NULL,
  name TEXT,
  dob DATE,
  problem TEXT,
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create programs table
CREATE TABLE IF NOT EXISTS programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  details_md TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create program_days table
CREATE TABLE IF NOT EXISTS program_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, day_index)
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_day_id UUID REFERENCES program_days(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  video_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_day_id, order_index)
);

-- Create pages table for editable content
CREATE TABLE IF NOT EXISTS pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  hero_image_url TEXT,
  headline TEXT,
  greeting TEXT,
  cta_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create reports_settings table
CREATE TABLE IF NOT EXISTS reports_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  calendar_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_progress table for tracking daily progress
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_user_id BIGINT NOT NULL,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tg_user_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_tg_user_id ON users(tg_user_id);
CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug);
CREATE INDEX IF NOT EXISTS idx_programs_published ON programs(is_published);
CREATE INDEX IF NOT EXISTS idx_program_days_program_id ON program_days(program_id);
CREATE INDEX IF NOT EXISTS idx_exercises_program_day_id ON exercises(program_day_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_tg_user_id ON user_progress(tg_user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_date ON user_progress(date);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only access their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (tg_user_id = current_setting('request.jwt.claims', true)::json->>'tg_user_id'::bigint);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (tg_user_id = current_setting('request.jwt.claims', true)::json->>'tg_user_id'::bigint);

-- Public read access for published programs
CREATE POLICY "Anyone can view published programs" ON programs FOR SELECT USING (is_published = true);
CREATE POLICY "Editors can manage programs" ON programs FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'isEditor' = 'true');

-- Public read access for program days and exercises of published programs
CREATE POLICY "Anyone can view program days of published programs" ON program_days FOR SELECT USING (
  EXISTS (SELECT 1 FROM programs WHERE programs.id = program_days.program_id AND programs.is_published = true)
);
CREATE POLICY "Editors can manage program days" ON program_days FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'isEditor' = 'true');

CREATE POLICY "Anyone can view exercises of published programs" ON exercises FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM program_days 
    JOIN programs ON programs.id = program_days.program_id 
    WHERE program_days.id = exercises.program_day_id 
    AND programs.is_published = true
  )
);
CREATE POLICY "Editors can manage exercises" ON exercises FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'isEditor' = 'true');

-- Public read access for pages
CREATE POLICY "Anyone can view pages" ON pages FOR SELECT USING (true);
CREATE POLICY "Editors can manage pages" ON pages FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'isEditor' = 'true');

-- Public read access for reports settings
CREATE POLICY "Anyone can view reports settings" ON reports_settings FOR SELECT USING (true);
CREATE POLICY "Editors can manage reports settings" ON reports_settings FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'isEditor' = 'true');

-- Users can only access their own progress
CREATE POLICY "Users can view own progress" ON user_progress FOR SELECT USING (tg_user_id = current_setting('request.jwt.claims', true)::json->>'tg_user_id'::bigint);
CREATE POLICY "Users can update own progress" ON user_progress FOR ALL USING (tg_user_id = current_setting('request.jwt.claims', true)::json->>'tg_user_id'::bigint);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_settings_updated_at BEFORE UPDATE ON reports_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

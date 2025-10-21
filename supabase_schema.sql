-- Supabase Schema for Здоровое тело WebApp
-- Run this SQL in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create programs table
CREATE TABLE IF NOT EXISTS programs (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    details_md TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create program_days table
CREATE TABLE IF NOT EXISTS program_days (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    day_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(program_id, day_index)
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    program_day_id INTEGER REFERENCES program_days(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    video_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(program_day_id, order_index)
);

-- Create editors table for Telegram user verification
CREATE TABLE IF NOT EXISTS editors (
    id SERIAL PRIMARY KEY,
    telegram_user_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug);
CREATE INDEX IF NOT EXISTS idx_programs_published ON programs(is_published);
CREATE INDEX IF NOT EXISTS idx_program_days_program_id ON program_days(program_id);
CREATE INDEX IF NOT EXISTS idx_program_days_day_index ON program_days(day_index);
CREATE INDEX IF NOT EXISTS idx_exercises_program_day_id ON exercises(program_day_id);
CREATE INDEX IF NOT EXISTS idx_exercises_order_index ON exercises(order_index);
CREATE INDEX IF NOT EXISTS idx_editors_telegram_user_id ON editors(telegram_user_id);

-- Enable Row Level Security on all tables
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE editors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for programs table
-- Public can read published programs
CREATE POLICY "Public can read published programs" ON programs
    FOR SELECT USING (is_published = true);

-- Authenticated users can read all programs (for developer mode)
CREATE POLICY "Authenticated users can read all programs" ON programs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can insert programs
CREATE POLICY "Authenticated users can insert programs" ON programs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update programs
CREATE POLICY "Authenticated users can update programs" ON programs
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Authenticated users can delete programs
CREATE POLICY "Authenticated users can delete programs" ON programs
    FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for program_days table
-- Public can read days of published programs
CREATE POLICY "Public can read days of published programs" ON program_days
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM programs 
            WHERE programs.id = program_days.program_id 
            AND programs.is_published = true
        )
    );

-- Authenticated users can read all days
CREATE POLICY "Authenticated users can read all days" ON program_days
    FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can insert days
CREATE POLICY "Authenticated users can insert days" ON program_days
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update days
CREATE POLICY "Authenticated users can update days" ON program_days
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Authenticated users can delete days
CREATE POLICY "Authenticated users can delete days" ON program_days
    FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for exercises table
-- Public can read exercises of published programs
CREATE POLICY "Public can read exercises of published programs" ON exercises
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM program_days 
            JOIN programs ON programs.id = program_days.program_id
            WHERE program_days.id = exercises.program_day_id 
            AND programs.is_published = true
        )
    );

-- Authenticated users can read all exercises
CREATE POLICY "Authenticated users can read all exercises" ON exercises
    FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can insert exercises
CREATE POLICY "Authenticated users can insert exercises" ON exercises
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update exercises
CREATE POLICY "Authenticated users can update exercises" ON exercises
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Authenticated users can delete exercises
CREATE POLICY "Authenticated users can delete exercises" ON exercises
    FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for editors table
-- Public can read editors (needed for verification)
CREATE POLICY "Public can read editors" ON editors
    FOR SELECT USING (true);

-- Authenticated users can insert editors (for admin setup)
CREATE POLICY "Authenticated users can insert editors" ON editors
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update editors
CREATE POLICY "Authenticated users can update editors" ON editors
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Authenticated users can delete editors
CREATE POLICY "Authenticated users can delete editors" ON editors
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_days_updated_at BEFORE UPDATE ON program_days
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional - you can remove this section if you don't want sample data)
INSERT INTO programs (slug, title, description, image_url, details_md, is_published) VALUES
('shoulders', 'Плечевой пояс', 'Укрепление и развитие мышц плечевого пояса', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 'Программа для укрепления плечевого пояса включает комплекс упражнений для развития силы и выносливости.', true),
('back', 'Спина', 'Укрепление мышц спины и улучшение осанки', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 'Комплекс упражнений для укрепления мышц спины и улучшения осанки.', true),
('core', 'Пресс', 'Развитие мышц пресса и кора', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 'Программа для развития мышц пресса и укрепления кора.', true),
('legs', 'Ноги', 'Укрепление мышц ног и ягодиц', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 'Комплекс упражнений для укрепления мышц ног и ягодиц.', true),
('cardio', 'Кардио', 'Кардиотренировки для выносливости', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 'Кардиотренировки для развития выносливости и сжигания калорий.', true),
('flexibility', 'Гибкость', 'Упражнения на растяжку и гибкость', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 'Программа упражнений на растяжку и развитие гибкости.', true),
('strength', 'Сила', 'Силовые тренировки для набора мышечной массы', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 'Силовые тренировки для набора мышечной массы и развития силы.', true),
('recovery', 'Восстановление', 'Упражнения для восстановления и релаксации', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', 'Упражнения для восстановления и релаксации после тренировок.', true);

-- Insert sample days and exercises for the first program (shoulders)
-- This is just an example - you can add more or modify as needed
INSERT INTO program_days (program_id, day_index) 
SELECT id, generate_series(1, 10) FROM programs WHERE slug = 'shoulders';

-- Insert sample exercises for the first day of shoulders program
INSERT INTO exercises (program_day_id, order_index, title, video_url, description)
SELECT 
    pd.id,
    s.order_num,
    CASE s.order_num
        WHEN 1 THEN 'Жим гантелей'
        WHEN 2 THEN 'Разведение гантелей'
        WHEN 3 THEN 'Подъемы в стороны'
        WHEN 4 THEN 'Отжимания'
        WHEN 5 THEN 'Планка'
        ELSE 'Берпи'
    END,
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'Подробное описание упражнения для плечевого пояса. Выполняйте медленно и контролируемо, следите за дыханием.'
FROM program_days pd
JOIN programs p ON p.id = pd.program_id
CROSS JOIN generate_series(1, 6) AS s(order_num)
WHERE p.slug = 'shoulders' AND pd.day_index = 1;

-- Insert sample editor (replace with your actual Telegram user ID)
-- You can find your Telegram user ID by messaging @userinfobot
INSERT INTO editors (telegram_user_id, username, first_name, last_name) VALUES
(886689538, 'vladimir_antt', 'Владимир', 'Антощук')
ON CONFLICT (telegram_user_id) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

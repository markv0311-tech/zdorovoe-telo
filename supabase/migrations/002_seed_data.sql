-- Insert default home page content
INSERT INTO pages (key, hero_image_url, headline, greeting, cta_text) VALUES (
  'home',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  'Здоровое тело',
  'Добро пожаловать в ваше путешествие к здоровому образу жизни!',
  'Перейти к упражнениям'
) ON CONFLICT (key) DO NOTHING;

-- Insert default reports settings
INSERT INTO reports_settings (id, calendar_enabled) VALUES (1, true) ON CONFLICT (id) DO NOTHING;

-- Insert sample programs
INSERT INTO programs (slug, title, description, image_url, details_md, is_published) VALUES 
(
  'plechevoy-poyas',
  'Плечевой пояс',
  'Укрепление и развитие мышц плечевого пояса',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  '## Программа для плечевого пояса

Эта программа поможет укрепить мышцы плечевого пояса и улучшить осанку. Рекомендуется выполнять упражнения ежедневно в течение 10 дней.

### Что вы получите:
- Укрепление дельтовидных мышц
- Улучшение осанки
- Повышение выносливости
- Уменьшение напряжения в плечах',
  true
),
(
  'spina',
  'Спина',
  'Укрепление мышц спины и улучшение осанки',
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  '## Программа для спины

Комплекс упражнений для укрепления мышц спины и улучшения осанки. Поможет избавиться от болей в спине и укрепить мышечный корсет.

### Что вы получите:
- Укрепление мышц спины
- Улучшение осанки
- Уменьшение болей в спине
- Повышение гибкости позвоночника',
  true
),
(
  'press',
  'Пресс',
  'Развитие мышц пресса и кора',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  '## Программа для пресса

Интенсивная программа для развития мышц пресса и кора. Поможет создать красивый рельеф и укрепить внутренние мышцы.

### Что вы получите:
- Укрепление мышц пресса
- Развитие кора
- Улучшение стабильности
- Создание рельефа',
  true
),
(
  'nogi',
  'Ноги',
  'Укрепление мышц ног и ягодиц',
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  '## Программа для ног

Комплекс упражнений для укрепления мышц ног и ягодиц. Поможет создать красивые формы и повысить выносливость.

### Что вы получите:
- Укрепление мышц ног
- Развитие ягодичных мышц
- Повышение выносливости
- Улучшение координации',
  true
);

-- Get program IDs for creating days and exercises
DO $$
DECLARE
    program_plechevoy_id UUID;
    program_spina_id UUID;
    program_press_id UUID;
    program_nogi_id UUID;
    day_id UUID;
    exercise_titles TEXT[];
    exercise_descriptions TEXT[];
    i INTEGER;
    j INTEGER;
BEGIN
    -- Get program IDs
    SELECT id INTO program_plechevoy_id FROM programs WHERE slug = 'plechevoy-poyas';
    SELECT id INTO program_spina_id FROM programs WHERE slug = 'spina';
    SELECT id INTO program_press_id FROM programs WHERE slug = 'press';
    SELECT id INTO program_nogi_id FROM programs WHERE slug = 'nogi';

    -- Exercise data for each program
    -- Плечевой пояс
    exercise_titles := ARRAY['Жим гантелей', 'Разведение гантелей', 'Подъемы в стороны', 'Отжимания', 'Планка', 'Берпи'];
    exercise_descriptions := ARRAY[
        'Выполняйте жим гантелей сидя или стоя. Контролируйте движение и дышите равномерно.',
        'Разводите гантели в стороны до уровня плеч. Следите за техникой выполнения.',
        'Поднимайте руки в стороны до горизонтального положения. Не раскачивайтесь.',
        'Классические отжимания от пола. Следите за прямой линией тела.',
        'Удерживайте планку 30-60 секунд. Напрягите все мышцы тела.',
        'Выполняйте берпи в быстром темпе. Контролируйте дыхание.'
    ];

    -- Create days and exercises for плечевой пояс
    FOR i IN 1..10 LOOP
        INSERT INTO program_days (program_id, day_index) VALUES (program_plechevoy_id, i) RETURNING id INTO day_id;
        
        FOR j IN 1..6 LOOP
            INSERT INTO exercises (program_day_id, order_index, title, video_url, description) VALUES (
                day_id,
                j,
                exercise_titles[((i-1)*6 + j - 1) % 6 + 1],
                'https://www.youtube.com/embed/dQw4w9WgXcQ',
                exercise_descriptions[((i-1)*6 + j - 1) % 6 + 1]
            );
        END LOOP;
    END LOOP;

    -- Спина
    exercise_titles := ARRAY['Подтягивания', 'Тяга гантелей', 'Гиперэкстензия', 'Планка', 'Супермен', 'Лодочка'];
    exercise_descriptions := ARRAY[
        'Подтягивания на перекладине. Если не можете подтянуться, используйте резинку.',
        'Тяга гантелей в наклоне. Сводите лопатки вместе.',
        'Гиперэкстензия на полу или специальном тренажере.',
        'Удерживайте планку, напрягая мышцы спины.',
        'Лягте на живот, поднимайте руки и ноги одновременно.',
        'Сядьте, поднимите ноги и балансируйте на ягодицах.'
    ];

    -- Create days and exercises for спина
    FOR i IN 1..10 LOOP
        INSERT INTO program_days (program_id, day_index) VALUES (program_spina_id, i) RETURNING id INTO day_id;
        
        FOR j IN 1..6 LOOP
            INSERT INTO exercises (program_day_id, order_index, title, video_url, description) VALUES (
                day_id,
                j,
                exercise_titles[((i-1)*6 + j - 1) % 6 + 1],
                'https://www.youtube.com/embed/dQw4w9WgXcQ',
                exercise_descriptions[((i-1)*6 + j - 1) % 6 + 1]
            );
        END LOOP;
    END LOOP;

    -- Пресс
    exercise_titles := ARRAY['Скручивания', 'Планка', 'Велосипед', 'Подъемы ног', 'Русские скручивания', 'Горный альпинист'];
    exercise_descriptions := ARRAY[
        'Классические скручивания. Не отрывайте поясницу от пола.',
        'Удерживайте планку, напрягая мышцы пресса.',
        'Велосипед лежа. Приводите колено к противоположному локтю.',
        'Поднимайте прямые ноги до угла 90 градусов.',
        'Русские скручивания сидя. Поворачивайте корпус в стороны.',
        'Горный альпинист в планке. Быстро меняйте ноги.'
    ];

    -- Create days and exercises for пресс
    FOR i IN 1..10 LOOP
        INSERT INTO program_days (program_id, day_index) VALUES (program_press_id, i) RETURNING id INTO day_id;
        
        FOR j IN 1..6 LOOP
            INSERT INTO exercises (program_day_id, order_index, title, video_url, description) VALUES (
                day_id,
                j,
                exercise_titles[((i-1)*6 + j - 1) % 6 + 1],
                'https://www.youtube.com/embed/dQw4w9WgXcQ',
                exercise_descriptions[((i-1)*6 + j - 1) % 6 + 1]
            );
        END LOOP;
    END LOOP;

    -- Ноги
    exercise_titles := ARRAY['Приседания', 'Выпады', 'Прыжки', 'Планка', 'Ягодичный мостик', 'Подъемы на носки'];
    exercise_descriptions := ARRAY[
        'Классические приседания. Следите за техникой и глубиной.',
        'Выпады вперед и назад. Чередуйте ноги.',
        'Прыжки на месте или через препятствия.',
        'Удерживайте планку, напрягая мышцы ног.',
        'Ягодичный мостик лежа. Поднимайте таз максимально высоко.',
        'Подъемы на носки стоя. Можно с дополнительным весом.'
    ];

    -- Create days and exercises for ноги
    FOR i IN 1..10 LOOP
        INSERT INTO program_days (program_id, day_index) VALUES (program_nogi_id, i) RETURNING id INTO day_id;
        
        FOR j IN 1..6 LOOP
            INSERT INTO exercises (program_day_id, order_index, title, video_url, description) VALUES (
                day_id,
                j,
                exercise_titles[((i-1)*6 + j - 1) % 6 + 1],
                'https://www.youtube.com/embed/dQw4w9WgXcQ',
                exercise_descriptions[((i-1)*6 + j - 1) % 6 + 1]
            );
        END LOOP;
    END LOOP;

END $$;

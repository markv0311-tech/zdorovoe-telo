-- ============================================
-- ФУНКЦИЯ: get_user_profile
-- Возвращает профиль пользователя по tg_user_id
-- Включает новые поля: has_access и subscription_valid_until
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_profile(p_tg_user_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Ищем пользователя в таблице users
  SELECT 
    tg_user_id,
    username,
    first_name,
    last_name,
    age,
    gender,
    problem,
    has_access,
    subscription_valid_until,
    created_at,
    updated_at
  INTO user_record
  FROM public.users
  WHERE tg_user_id = p_tg_user_id;

  -- Если пользователь не найден, возвращаем пустой объект
  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Возвращаем профиль в формате JSONB
  RETURN jsonb_build_object(
    'tg_user_id', user_record.tg_user_id,
    'username', user_record.username,
    'first_name', user_record.first_name,
    'last_name', user_record.last_name,
    'age', user_record.age,
    'gender', user_record.gender,
    'problem', user_record.problem,
    'has_access', COALESCE(user_record.has_access, false),  -- По умолчанию false если NULL
    'subscription_valid_until', user_record.subscription_valid_until,
    'created_at', user_record.created_at,
    'updated_at', user_record.updated_at
  );
END;
$$;

-- ============================================
-- ФУНКЦИЯ: save_user_profile
-- Сохраняет профиль пользователя
-- ВАЖНО: НЕ трогает поля has_access и subscription_valid_until
-- (они обновляются только через webhook от GetCourse)
-- ============================================

CREATE OR REPLACE FUNCTION public.save_user_profile(
  p_tg_user_id BIGINT,
  p_username TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_age INTEGER,
  p_gender TEXT,
  p_problem TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_user RECORD;
BEGIN
  -- Обновляем или создаём запись пользователя
  -- ВАЖНО: has_access и subscription_valid_until НЕ обновляем здесь!
  INSERT INTO public.users (
    tg_user_id,
    username,
    first_name,
    last_name,
    age,
    gender,
    problem,
    updated_at
  )
  VALUES (
    p_tg_user_id,
    p_username,
    p_first_name,
    p_last_name,
    p_age,
    p_gender,
    p_problem,
    NOW()
  )
  ON CONFLICT (tg_user_id) 
  DO UPDATE SET
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    age = EXCLUDED.age,
    gender = EXCLUDED.gender,
    problem = EXCLUDED.problem,
    updated_at = NOW();

  -- Получаем обновлённый профиль
  SELECT * INTO updated_user
  FROM public.users
  WHERE tg_user_id = p_tg_user_id;

  -- Возвращаем результат
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Профиль успешно сохранён',
    'profile', jsonb_build_object(
      'tg_user_id', updated_user.tg_user_id,
      'username', updated_user.username,
      'first_name', updated_user.first_name,
      'last_name', updated_user.last_name,
      'age', updated_user.age,
      'gender', updated_user.gender,
      'problem', updated_user.problem,
      'has_access', COALESCE(updated_user.has_access, false),
      'subscription_valid_until', updated_user.subscription_valid_until
    )
  );
END;
$$;

-- ============================================
-- ФУНКЦИЯ: update_user_access (для webhook от GetCourse)
-- Обновляет доступ пользователя после оплаты
-- Эта функция будет вызываться через webhook
-- ============================================

CREATE OR REPLACE FUNCTION public.update_user_access(
  p_tg_user_id BIGINT,
  p_has_access BOOLEAN DEFAULT true,
  p_subscription_valid_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_user RECORD;
BEGIN
  -- Обновляем доступ пользователя
  UPDATE public.users
  SET 
    has_access = p_has_access,
    subscription_valid_until = COALESCE(p_subscription_valid_until, subscription_valid_until),
    updated_at = NOW()
  WHERE tg_user_id = p_tg_user_id;

  -- Проверяем, был ли обновлён пользователь
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Пользователь не найден'
    );
  END IF;

  -- Получаем обновлённого пользователя
  SELECT * INTO updated_user
  FROM public.users
  WHERE tg_user_id = p_tg_user_id;

  -- Возвращаем результат
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Доступ успешно обновлён',
    'profile', jsonb_build_object(
      'tg_user_id', updated_user.tg_user_id,
      'has_access', COALESCE(updated_user.has_access, false),
      'subscription_valid_until', updated_user.subscription_valid_until
    )
  );
END;
$$;

-- ============================================
-- ГРАНТЫ (разрешения) для функций
-- Даём доступ анонимным пользователям (для RPC вызовов)
-- ============================================

GRANT EXECUTE ON FUNCTION public.get_user_profile(BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_profile(BIGINT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_access(BIGINT, BOOLEAN, TIMESTAMPTZ) TO anon, authenticated;

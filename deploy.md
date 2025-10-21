# Руководство по развертыванию

## Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка переменных окружения
Скопируйте `env.example` в `.env` и заполните необходимые значения:

```bash
cp env.example .env
```

### 3. Настройка Supabase

#### Создание проекта
1. Зайдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Скопируйте URL и ключи API

#### Выполнение миграций
1. Зайдите в SQL Editor в панели Supabase
2. Выполните файл `supabase/migrations/001_initial_schema.sql`
3. Выполните файл `supabase/migrations/002_seed_data.sql`

#### Настройка RLS
Миграции автоматически настроят Row Level Security. Убедитесь, что политики активны.

### 4. Настройка Telegram Bot

#### Создание бота
1. Найдите @BotFather в Telegram
2. Создайте нового бота командой `/newbot`
3. Скопируйте токен бота

#### Настройка Web App
1. Используйте команду `/newapp` в @BotFather
2. Укажите URL вашего приложения
3. Настройте кнопку "Open App"

### 5. Запуск приложения

#### Локальная разработка
```bash
npm run dev
```

#### Продакшн
```bash
npm start
```

## Развертывание на платформах

### Heroku

#### 1. Создание приложения
```bash
heroku create your-app-name
```

#### 2. Настройка переменных окружения
```bash
heroku config:set ALLOWED_EDITOR_IDS=123456789,987654321
heroku config:set SUPABASE_URL=your_supabase_url
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_service_key
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set TELEGRAM_BOT_TOKEN=your_bot_token
```

#### 3. Деплой
```bash
git push heroku main
```

### Vercel

#### 1. Подключение репозитория
1. Зайдите на [vercel.com](https://vercel.com)
2. Подключите GitHub репозиторий
3. Настройте переменные окружения в панели Vercel

#### 2. Настройка build команды
```json
{
  "buildCommand": "npm start",
  "outputDirectory": "."
}
```

### Railway

#### 1. Создание проекта
```bash
railway login
railway init
```

#### 2. Настройка переменных
```bash
railway variables set ALLOWED_EDITOR_IDS=123456789,987654321
railway variables set SUPABASE_URL=your_supabase_url
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_key
railway variables set JWT_SECRET=your_jwt_secret
railway variables set TELEGRAM_BOT_TOKEN=your_bot_token
```

#### 3. Деплой
```bash
railway up
```

## Проверка работоспособности

### 1. Тест основного приложения
1. Откройте приложение в браузере
2. Проверьте загрузку программ упражнений
3. Протестируйте календарь и профиль

### 2. Тест редактора
1. Войдите в профиль
2. Нажмите "Доступ разработчика"
3. Введите PIN код (1234)
4. Проверьте функциональность редактора

### 3. Тест API
```bash
# Проверка публичных программ
curl https://your-domain.com/api/programs

# Проверка авторизации (замените на реальные данные)
curl -X POST https://your-domain.com/api/auth \
  -H "Content-Type: application/json" \
  -d '{"initData": "your_telegram_init_data"}'
```

## Мониторинг и логи

### Логи приложения
```bash
# Heroku
heroku logs --tail

# Railway
railway logs

# Vercel
vercel logs
```

### Мониторинг Supabase
1. Зайдите в панель Supabase
2. Проверьте раздел "Logs" для отслеживания запросов
3. Используйте "Database" для проверки данных

## Безопасность

### Рекомендации
1. **Регулярно обновляйте** переменные окружения
2. **Используйте сильные пароли** для JWT_SECRET
3. **Ограничьте доступ** к Supabase Service Role Key
4. **Мониторьте логи** на предмет подозрительной активности
5. **Регулярно ротируйте** токены и ключи

### Проверка безопасности
```bash
# Проверка переменных окружения
echo $JWT_SECRET | wc -c  # Должно быть > 32 символов

# Проверка HTTPS
curl -I https://your-domain.com  # Должен возвращать 200
```

## Устранение неполадок

### Частые проблемы

#### 1. Ошибка подключения к Supabase
- Проверьте правильность URL и ключей
- Убедитесь, что проект активен
- Проверьте настройки RLS

#### 2. Проблемы с Telegram авторизацией
- Проверьте токен бота
- Убедитесь, что Web App URL настроен правильно
- Проверьте initData в логах

#### 3. Ошибки JWT
- Проверьте JWT_SECRET
- Убедитесь, что токены не истекли
- Проверьте формат токенов

#### 4. Проблемы с CORS
- Настройте правильные CORS политики
- Проверьте домены в настройках

### Логи для отладки
```javascript
// В коде добавьте логирование
console.log('User data:', user);
console.log('Auth token:', authToken);
console.log('API response:', response);
```

## Обновление

### Обновление кода
```bash
git pull origin main
npm install
npm start
```

### Обновление базы данных
1. Создайте новые миграции
2. Выполните их в Supabase SQL Editor
3. Проверьте совместимость данных

### Обновление зависимостей
```bash
npm update
npm audit fix
```

## Резервное копирование

### База данных
1. Используйте функцию экспорта в Supabase
2. Регулярно создавайте дампы
3. Храните резервные копии в безопасном месте

### Контент
1. Используйте функцию экспорта в редакторе
2. Регулярно сохраняйте JSON файлы
3. Версионируйте изменения контента
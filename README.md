# Здоровое тело - Telegram Mini App

Фитнес-приложение для Telegram с отслеживанием прогресса и управлением подписками.

## Функциональность

### 🏠 Главная страница
- Полноэкранное изображение
- Приветственный текст и заголовок
- Кнопка перехода к упражнениям

### 📊 Отчеты
- Календарь для отметки выполненных дней
- Статистика прогресса
- Визуальное отслеживание серий

### 💪 Упражнения
- 8 различных программ упражнений
- Детальный просмотр каждой программы
- 10-дневные курсы по 6 упражнений в день
- Видео-инструкции для каждого упражнения

### 👤 Профиль
- Управление личной информацией
- Отслеживание подписки
- Настройки пользователя

## Технические особенности

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js + Express
- **API**: Telegram WebApp API
- **Хранение**: LocalStorage + Backend API
- **Дизайн**: Mobile-first, responsive

## Установка и запуск

### Предварительные требования
- Node.js 14.0.0 или выше
- npm или yarn

### Локальная разработка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd zdorovoe-telo-telegram-app
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите сервер:
```bash
npm start
```

4. Откройте браузер и перейдите по адресу:
```
http://localhost:3000
```

### Для разработки с автоперезагрузкой:
```bash
npm run dev
```

## Структура проекта

```
├── index.html          # Главная HTML страница
├── styles.css          # Стили приложения
├── app.js             # Основная логика приложения
├── server.js          # Backend сервер
├── package.json       # Зависимости проекта
└── README.md          # Документация
```

## API Endpoints

### Пользователи
- `GET /api/user/:userId/profile` - Получить профиль пользователя
- `POST /api/user/:userId/profile` - Обновить профиль пользователя

### Подписки
- `GET /api/user/:userId/subscription` - Получить статус подписки
- `POST /api/user/:userId/subscription` - Создать/обновить подписку

### Прогресс
- `GET /api/user/:userId/progress` - Получить прогресс пользователя
- `POST /api/user/:userId/progress` - Сохранить прогресс

## Интеграция с Telegram

Приложение использует Telegram WebApp API для:
- Получения данных пользователя
- Аутентификации
- Интеграции с Telegram Bot

### Настройка Telegram Bot

1. Создайте бота через @BotFather
2. Настройте Web App URL: `https://yourdomain.com`
3. Добавьте кнопку "Open App" в меню бота

## Особенности реализации

### Система подписок
- Автоматическая проверка срока действия подписки
- Блокировка доступа при истечении подписки
- Возможность продления через API

### Отслеживание прогресса
- Календарь с отметками выполненных дней
- Подсчет серий и общей статистики
- Локальное сохранение + синхронизация с сервером

### Адаптивный дизайн
- Mobile-first подход
- Поддержка темной темы Telegram
- Оптимизация для различных размеров экранов

## Развертывание

### Heroku
1. Создайте приложение на Heroku
2. Подключите GitHub репозиторий
3. Настройте переменные окружения
4. Деплой автоматически при push

### Vercel
1. Подключите репозиторий к Vercel
2. Настройте build команду: `npm start`
3. Деплой автоматически

### Другие платформы
Приложение совместимо с любыми Node.js хостингами.

## Лицензия

MIT License - см. файл LICENSE для деталей.

## Режим редактора (Editor Mode)

Приложение включает в себя полнофункциональный редактор контента для администраторов.

### Доступ к редактору

1. **Через Telegram**: Пользователи, чьи ID указаны в `ALLOWED_EDITOR_IDS`, получают автоматический доступ
2. **Через PIN**: Остальные пользователи могут войти, введя PIN код (по умолчанию: `1234`)

### Функциональность редактора

#### 🏠 Главная страница
- Редактирование изображения героя
- Изменение заголовка и приветственного текста
- Настройка текста кнопки призыва к действию
- Предварительный просмотр изменений

#### 💪 Управление программами
- **CRUD операции** для программ упражнений
- Создание и редактирование дней программы
- Управление упражнениями с видео и описаниями
- Переключение статуса публикации
- Drag-and-drop для изменения порядка упражнений

#### 📊 Настройки отчетов
- Включение/отключение календаря
- Другие настройки отчетности

#### 🔧 Инструменты
- **Экспорт данных** в JSON формате
- **Импорт данных** из JSON файла
- Резервное копирование контента

### Режимы работы

#### Mode A: Локальный режим (Quick MVP)
- Активируется флагом `VITE_LOCAL_EDITOR=true`
- Данные хранятся в localStorage
- Подходит для быстрого прототипирования
- Не требует подключения к базе данных

#### Mode B: Продакшн режим (по умолчанию)
- Использует Supabase для хранения данных
- Полная аутентификация через Telegram
- Row Level Security (RLS)
- Серверная валидация

### API для редактора

#### Аутентификация
- `POST /api/auth` - Авторизация через Telegram initData
- `GET /api/me` - Получение данных текущего пользователя

#### Управление контентом
- `GET /api/admin/content` - Получение всего контента
- `PUT /api/admin/pages/home` - Обновление главной страницы
- `POST /api/admin/programs` - Создание программы
- `PUT /api/admin/programs/:id` - Обновление программы
- `DELETE /api/admin/programs/:id` - Удаление программы
- `POST /api/admin/programs/:id/days` - Добавление дня
- `POST /api/admin/days/:day_id/exercises` - Добавление упражнения
- `PUT /api/admin/exercises/:id` - Обновление упражнения
- `DELETE /api/admin/exercises/:id` - Удаление упражнения
- `PUT /api/admin/reports-settings` - Настройки отчетов

#### Публичные API
- `GET /api/programs` - Получение опубликованных программ
- `GET /api/programs/:slug` - Получение программы по slug

### Безопасность

- **JWT токены** с коротким временем жизни (24 часа)
- **Telegram initData** верификация на сервере
- **Row Level Security** в Supabase
- **Middleware** для проверки прав редактора
- **PIN код** для доступа в режиме разработки

### Структура базы данных

```sql
-- Основные таблицы
users (id, tg_user_id, name, dob, problem, subscription_expires_at)
programs (id, slug, title, description, image_url, details_md, is_published)
program_days (id, program_id, day_index)
exercises (id, program_day_id, order_index, title, video_url, description)
pages (id, key, hero_image_url, headline, greeting, cta_text)
reports_settings (id, calendar_enabled)
user_progress (id, tg_user_id, date, completed)
```

### Настройка окружения

```bash
# Frontend
VITE_LOCAL_EDITOR=false
VITE_DEV_PIN=1234
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend
ALLOWED_EDITOR_IDS=123456789,987654321
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

## Поддержка

Для вопросов и поддержки создайте issue в репозитории.

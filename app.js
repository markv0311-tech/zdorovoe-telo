// Logger system - умное логирование (отключается на продакшене)
const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.search.includes('debug=true');
const Logger = {
    log: DEBUG ? (...args) => console.log('%c[DEBUG]', 'color: #007bff; font-weight: bold;', ...args) : () => {},
    warn: (...args) => console.warn('%c[WARN]', 'color: #ffc107; font-weight: bold;', ...args),
    error: (...args) => console.error('%c[ERROR]', 'color: #dc3545; font-weight: bold;', ...args),
    info: (...args) => console.info('%c[INFO]', 'color: #17a2b8; font-weight: bold;', ...args)
};

// Cache system
const CACHE_KEYS = {
    PROGRAMS: 'zdorovoe_telo_programs',
    PROGRAM_DAYS: 'zdorovoe_telo_program_days',
    EXERCISES: 'zdorovoe_telo_exercises',
    LAST_SYNC: 'zdorovoe_telo_last_sync'
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Safe localStorage wrapper
const SafeStorage = {
    getItem: function(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            Logger.error(`[Storage] Error reading ${key}:`, error);
            return null;
        }
    },
    setItem: function(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            Logger.error(`[Storage] Error storing ${key}:`, error);
            if (error.name === 'QuotaExceededError') {
                Logger.warn('[Storage] Quota exceeded, attempting cleanup');
                this.clearOldData();
                // Retry once
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (retryError) {
                    Logger.error(`[Storage] Failed after cleanup:`, retryError);
                    return false;
                }
            }
            return false;
        }
    },
    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            Logger.error(`[Storage] Error removing ${key}:`, error);
        }
    },
    clearOldData: function() {
        try {
            // Удаляем только устаревший кеш
            const now = Date.now();
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('zdorovoe_telo_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data.timestamp && (now - data.timestamp) > CACHE_DURATION * 2) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            }
        } catch (error) {
            Logger.error('[Storage] Error clearing old data:', error);
        }
    },
    isAvailable: function() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
};

// ============================================
// БЕЗОПАСНАЯ РАБОТА С DOM - ЗАЩИТА ОТ XSS
// ============================================

/**
 * Безопасная утилита для работы с DOM элементами
 * Заменяет опасный innerHTML на безопасные методы
 */
const SafeDOM = {
    /**
     * Безопасно устанавливает текстовое содержимое элемента
     * @param {HTMLElement|string} element - Элемент или его ID
     * @param {string} text - Текст для вставки (автоматически экранируется)
     */
    setText: function(element, text) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) {
            Logger.warn('[SafeDOM] Element not found:', element);
            return false;
        }
        el.textContent = String(text || '');
        return true;
    },

    /**
     * Безопасно создает элемент из HTML строки
     * Использует DOMParser для безопасного парсинга
     * @param {string} html - HTML строка
     * @param {string} tag - Тег контейнера (по умолчанию 'div')
     * @returns {HTMLElement|null} - Созданный элемент или null
     */
    createFromHTML: function(html, tag = 'div') {
        if (!html || typeof html !== 'string') {
            Logger.warn('[SafeDOM] Invalid HTML string');
            return null;
        }
        
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(`<${tag}>${html}</${tag}>`, 'text/html');
            const element = doc.body.firstElementChild;
            
            // Проверка на ошибки парсинга (XSS попытки)
            if (doc.body.querySelector('parsererror')) {
                Logger.error('[SafeDOM] HTML parsing error - possible XSS attempt');
                return null;
            }
            
            return element;
        } catch (error) {
            Logger.error('[SafeDOM] Error creating element:', error);
            return null;
        }
    },

    /**
     * Безопасно вставляет HTML в элемент
     * Использует DOMParser и очищает от потенциально опасных элементов
     * @param {HTMLElement|string} element - Элемент или его ID
     * @param {string} html - HTML строка
     * @param {boolean} append - Добавить к существующему содержимому (false = заменить)
     */
    setHTML: function(element, html, append = false) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) {
            Logger.warn('[SafeDOM] Element not found:', element);
            return false;
        }
        
        if (!html || typeof html !== 'string') {
            Logger.warn('[SafeDOM] Invalid HTML string');
            return false;
        }
        
        try {
            // Используем DOMParser для безопасного парсинга
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Проверка на ошибки парсинга
            if (doc.body.querySelector('parsererror')) {
                Logger.error('[SafeDOM] HTML parsing error - possible XSS attempt');
                // Fallback: используем textContent для безопасности
                if (!append) el.textContent = '';
                el.textContent += html.replace(/<[^>]*>/g, ''); // Удаляем все теги
                return false;
            }
            
            // Очищаем от опасных элементов и атрибутов
            const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input'];
            const dangerousAttrs = ['onclick', 'onerror', 'onload', 'onmouseover', 'href', 'src'];
            
            doc.body.querySelectorAll('*').forEach(node => {
                // Удаляем опасные теги
                if (dangerousTags.includes(node.tagName.toLowerCase())) {
                    node.remove();
                    return;
                }
                
                // Удаляем опасные атрибуты
                dangerousAttrs.forEach(attr => {
                    if (node.hasAttribute(attr)) {
                        const value = node.getAttribute(attr);
                        // Разрешаем только безопасные значения (без javascript:)
                        if (value && value.toLowerCase().startsWith('javascript:')) {
                            node.removeAttribute(attr);
                        }
                    }
                });
            });
            
            // Вставляем очищенный контент
            if (!append) el.innerHTML = '';
            doc.body.childNodes.forEach(node => {
                el.appendChild(node.cloneNode(true));
            });
            
            return true;
        } catch (error) {
            Logger.error('[SafeDOM] Error setting HTML:', error);
            // Fallback: используем textContent
            if (!append) el.textContent = '';
            el.textContent += html.replace(/<[^>]*>/g, '');
            return false;
        }
    },

    /**
     * Безопасно создает и вставляет элемент
     * @param {HTMLElement|string} parent - Родительский элемент или его ID
     * @param {string} tag - Тег создаваемого элемента
     * @param {Object} attributes - Атрибуты элемента
     * @param {string} textContent - Текстовое содержимое
     * @returns {HTMLElement|null} - Созданный элемент
     */
    createElement: function(parent, tag, attributes = {}, textContent = '') {
        const parentEl = typeof parent === 'string' ? document.getElementById(parent) : parent;
        if (!parentEl) {
            Logger.warn('[SafeDOM] Parent element not found:', parent);
            return null;
        }
        
        try {
            const element = document.createElement(tag);
            
            // Безопасно устанавливаем атрибуты
            Object.entries(attributes).forEach(([key, value]) => {
                if (key.startsWith('on')) {
                    Logger.warn(`[SafeDOM] Blocked dangerous attribute: ${key}`);
                    return; // Блокируем event handlers
                }
                if (key === 'href' || key === 'src') {
                    // Проверяем на javascript: протокол
                    if (String(value).toLowerCase().startsWith('javascript:')) {
                        Logger.warn(`[SafeDOM] Blocked dangerous ${key} value`);
                        return;
                    }
                }
                element.setAttribute(key, String(value));
            });
            
            if (textContent) {
                element.textContent = String(textContent);
            }
            
            parentEl.appendChild(element);
            return element;
        } catch (error) {
            Logger.error('[SafeDOM] Error creating element:', error);
            return null;
        }
    },

    /**
     * Экранирует HTML специальные символы
     * @param {string} text - Текст для экранирования
     * @returns {string} - Экранированный текст
     */
    escapeHTML: function(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    },

    /**
     * Безопасно очищает элемент
     * @param {HTMLElement|string} element - Элемент или его ID
     */
    clear: function(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) {
            el.textContent = '';
            // Также очищаем innerHTML для полной очистки
            while (el.firstChild) {
                el.removeChild(el.firstChild);
            }
        }
    }
};

// Динамическое масштабирование для главного экрана
function updateAdaptiveScale() {
    const root = document.documentElement;
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);
    
    // Диапазон масштабирования: iPhone SE (320px) до iPad Pro Max (1366px)
    const minWidth = 320; // iPhone SE
    const maxWidth = 1366; // iPad Pro Max
    const baseWidth = 430; // Базовая ширина для расчетов
    
    // Ограничиваем текущую ширину в пределах диапазона
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, currentWidth));
    
    // Вычисляем масштаб на основе ширины экрана
    let scaleFactor;
    if (clampedWidth <= 320) {
        // iPhone SE и меньше - минимальный масштаб
        scaleFactor = 0.6;
    } else if (clampedWidth <= 375) {
        // Маленькие телефоны - небольшой масштаб
        scaleFactor = 0.7;
    } else if (clampedWidth <= 414) {
        // Обычные телефоны - базовый масштаб
        scaleFactor = 0.8;
    } else if (clampedWidth <= 768) {
        // Планшеты - средний масштаб
        scaleFactor = 1.0;
    } else if (clampedWidth <= 1024) {
        // Большие планшеты - увеличенный масштаб
        scaleFactor = 1.2;
    } else {
        // iPad Pro и больше - максимальный масштаб
        scaleFactor = 1.4;
    }
    
    // Обновляем CSS переменные
    root.style.setProperty('--current-screen-width', `${currentWidth}px`);
    root.style.setProperty('--scale-factor', scaleFactor);
    root.style.setProperty('--adaptive-scale', scaleFactor);
    
    const navBarHeight = clampValue(72 * scaleFactor, 60, 110);
    const navBottomGap = clampValue(18 * scaleFactor, 12, 36);
    const topHeaderHeight = clampValue(170 * scaleFactor, 140, 240);
    const homeHorizontalPadding = clampValue(16 * scaleFactor, 10, 36);
    const topExtraGap = clampValue(14 * scaleFactor, 8, 28);
    const levelGap = clampValue(48 * scaleFactor, 28, 80);
    const heroScale = clampValue(0.75 + (scaleFactor * 0.2), 0.82, 1.05);
    
    root.style.setProperty('--nav-bar-height', `${navBarHeight}px`);
    root.style.setProperty('--nav-bottom-gap', `${navBottomGap}px`);
    root.style.setProperty('--top-header-height', `${topHeaderHeight}px`);
    root.style.setProperty('--home-horizontal-padding', `${homeHorizontalPadding}px`);
    root.style.setProperty('--top-extra-gap', `${topExtraGap}px`);
    root.style.setProperty('--level-gap', `${levelGap}px`);
    root.style.setProperty('--hero-scale', heroScale.toString());
    
    // Применяем масштабирование к основным элементам главного экрана
    const elements = {
        '.top-header-container': {
            position: 'fixed',
            top: 'var(--top-header-offset)',
            left: '0',
            width: '100%',
            height: 'var(--top-header-height)',
            zIndex: '1000',
            pointerEvents: 'none',
            padding: 'var(--top-extra-gap) var(--home-horizontal-padding)',
            boxSizing: 'border-box'
        },
        '.welcome-title': {
            fontSize: `${28 * scaleFactor}px`,
            lineHeight: 1.2
        },
        '.welcome-subtitle': {
            fontSize: `${16 * scaleFactor}px`,
            lineHeight: 1.3
        },
        '.tab-button-vertical': {
            width: `${60 * scaleFactor}px`,
            height: `${60 * scaleFactor}px`,
            padding: `${8 * scaleFactor}px ${10 * scaleFactor}px`,
            borderRadius: `${15 * scaleFactor}px`
        },
        '.progress-tab.tab-button-vertical': {
            width: `${60 * scaleFactor}px`,
            height: `${60 * scaleFactor}px`,
            padding: `${8 * scaleFactor}px ${10 * scaleFactor}px`,
            borderRadius: `${15 * scaleFactor}px`
        },
        '.leaderboard-tab.tab-button-vertical': {
            width: `${60 * scaleFactor}px`,
            height: `${60 * scaleFactor}px`,
            padding: `${8 * scaleFactor}px ${10 * scaleFactor}px`,
            borderRadius: `${15 * scaleFactor}px`
        },
        '.tab-icon-vertical': {
            fontSize: `${16 * scaleFactor}px`,
            marginBottom: `${4 * scaleFactor}px`
        },
        '.tab-text-vertical': {
            fontSize: `${8 * scaleFactor}px`,
            letterSpacing: `${0.3 * scaleFactor}px`
        },
        '.progress-tab .tab-icon-vertical': {
            fontSize: `${16 * scaleFactor}px`,
            marginBottom: `${4 * scaleFactor}px`
        },
        '.progress-tab .tab-text-vertical': {
            fontSize: `${8 * scaleFactor}px`,
            letterSpacing: `${0.3 * scaleFactor}px`
        },
        '.leaderboard-tab .tab-icon-vertical': {
            fontSize: `${16 * scaleFactor}px`,
            marginBottom: `${4 * scaleFactor}px`
        },
        '.leaderboard-tab .tab-text-vertical': {
            fontSize: `${8 * scaleFactor}px`,
            letterSpacing: `${0.3 * scaleFactor}px`
        },
        '#switch.theme-toggle-top': {
            width: `${60 * scaleFactor}px`,
            height: `${60 * scaleFactor}px`,
            borderRadius: `${15 * scaleFactor}px`
        },
        '.theme-slider': {
            width: `${50 * scaleFactor}px`,
            height: `${25 * scaleFactor}px`
        },
        '.theme-slider-thumb': {
            width: `${21 * scaleFactor}px`,
            height: `${21 * scaleFactor}px`
        },
        '.theme-icon-slider': {
            fontSize: `${12 * scaleFactor}px`
        },
        '.level-text': {
            fontSize: `${24 * scaleFactor}px`
        },
        '.level-display-bottom': {
            position: 'fixed',
            bottom: 'calc(var(--level-bottom-offset) + var(--level-gap))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'auto',
            minWidth: `${200 * scaleFactor}px`,
            display: 'flex',
            justifyContent: 'center',
            padding: `${12 * scaleFactor}px ${20 * scaleFactor}px`,
            zIndex: '1000'
        },
        // Управляется только через CSS контейнера - не устанавливаем инлайновые стили
        '.navbar': {
            position: 'fixed',
            bottom: 'var(--nav-bottom-gap)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: `${Math.min(100, 80 * scaleFactor)}%`,
            background: 'rgba(135, 206, 250, 0.15)', // Голубой цвет для жидкого стекла
            backdropFilter: 'blur(20px)',
            borderRadius: 'calc(var(--nav-bar-height) / 3)',
            border: '1px solid rgba(135, 206, 250, 0.3)',
            display: 'flex',
            justifyContent: 'space-around',
            padding: `calc(var(--nav-bar-height) * 0.18) var(--home-horizontal-padding)`,
            zIndex: '1000',
            boxShadow: '0 8px 32px rgba(135, 206, 250, 0.2)',
            minHeight: 'var(--nav-bar-height)'
        },
        '.nav-item': {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: `${8 * scaleFactor}px ${12 * scaleFactor}px`,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            borderRadius: `${12 * scaleFactor}px`,
            minWidth: `${50 * scaleFactor}px`,
            color: 'rgba(135, 206, 250, 0.8) !important', // Голубой цвет текста
            position: 'relative',
            overflow: 'hidden',
            background: 'transparent !important'
        },
        '.nav-item.active': {
            background: 'rgba(0, 123, 255, 0.2) !important', // Синий фон для выбранного
            color: 'rgba(0, 123, 255, 1) !important', // Синий цвет для выбранного
            boxShadow: '0 4px 16px rgba(0, 123, 255, 0.3) !important',
            fontSize: `${10 * scaleFactor}px !important`, // Размер шрифта
            fontWeight: '600 !important' // Жирность шрифта
        },
        '.nav-item:hover': {
            background: 'rgba(135, 206, 250, 0.1)', // Светло-голубой при наведении
            color: 'rgba(135, 206, 250, 1)',
            transform: 'translateY(-2px)'
        },
        '.nav-icon': {
            fontSize: `${16 * scaleFactor}px`, // Уменьшили размер иконок
            marginBottom: `${4 * scaleFactor}px`,
            transition: 'all 0.3s ease',
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
        },
        '.nav-text': {
            fontSize: `${10 * scaleFactor}px`, // Увеличили размер текста
            fontWeight: '600',
            letterSpacing: `${0.3 * scaleFactor}px`,
            textTransform: 'uppercase',
            transition: 'all 0.3s ease'
        },
        // Управляется через CSS переменную --hero-scale - не устанавливаем инлайновые стили
    };
    
    // Применяем стили к элементам
    Object.entries(elements).forEach(([selector, styles]) => {
        const element = document.querySelector(selector);
        if (element) {
            Object.entries(styles).forEach(([property, value]) => {
                element.style[property] = value;
            });
        }
    });
    
    Logger.log(`[Dynamic Scale] Screen: ${currentWidth}x${currentHeight}, Scale: ${scaleFactor.toFixed(2)}`);
}

// Функция для тестирования масштабирования (только для разработки)
function testScaling() {
    const testSizes = [
        { name: 'iPhone SE', width: 320 },
        { name: 'iPhone 12', width: 375 },
        { name: 'iPhone 14 Pro', width: 414 },
        { name: 'iPad Mini', width: 768 },
        { name: 'iPad Air', width: 1024 },
        { name: 'iPad Pro Max', width: 1366 }
    ];
    
    console.log('=== ТЕСТ МАСШТАБИРОВАНИЯ ===');
    testSizes.forEach(size => {
        const scaleFactor = getScaleFactorForWidth(size.width);
        console.log(`${size.name} (${size.width}px): Scale = ${scaleFactor.toFixed(2)}`);
    });
    console.log('=============================');
}

function getScaleFactorForWidth(width) {
    if (width <= 320) return 0.6;
    else if (width <= 375) return 0.7;
    else if (width <= 414) return 0.8;
    else if (width <= 768) return 1.0;
    else if (width <= 1024) return 1.2;
    else return 1.4;
}

// Активируем динамическое масштабирование для главного экрана
updateAdaptiveScale();
window.addEventListener('resize', updateAdaptiveScale);
window.addEventListener('orientationchange', () => {
    setTimeout(updateAdaptiveScale, 100); // Small delay for orientation change
});

// Telegram WebApp initialization
let tg = window.Telegram?.WebApp;
let user = null;
let userProgress = null;
let userProfile = null;
let currentMonth = new Date();
let programs = [];

// Safe initialization of localStorage data
function safeGetStorage(key, defaultValue) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
        Logger.error(`[Storage] Error reading ${key}:`, error);
        return defaultValue;
    }
}

// Safe element access - returns element or null with logging
function safeGetElement(id, context = '') {
    const element = document.getElementById(id);
    if (!element) {
        Logger.warn(`[Element] Element not found: ${id}${context ? ` in ${context}` : ''}`);
    }
    return element;
}

// userProfile is already declared above
let isDeveloperMode = false;
let isEditor = false;

// Supabase client - используем глобальную переменную, созданную UMD скриптом
// Не объявляем let supabase, чтобы избежать конфликта с глобальной переменной от Supabase UMD
let supabaseClient = null;

// Переопределяем console.* безопасно, используя оригинальные методы,
// чтобы избежать рекурсии между Logger и перехватами console
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
    if (DEBUG) {
        originalLog('%c[DEBUG]', 'color: #007bff; font-weight: bold;', ...args);
    }
};

console.error = function(...args) {
    originalError('%c[ERROR]', 'color: #dc3545; font-weight: bold;', ...args);
};

console.warn = function(...args) {
    originalWarn('%c[WARN]', 'color: #ffc107; font-weight: bold;', ...args);
};

// Cache functions
function getCacheData(key) {
    try {
        const cached = SafeStorage.getItem(key);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        const now = Date.now();
        
        if (data.timestamp && (now - data.timestamp) < CACHE_DURATION) {
            Logger.log(`[Cache] Hit for ${key}`);
            return data.value;
        } else {
            Logger.log(`[Cache] Expired for ${key}`);
            SafeStorage.removeItem(key);
            return null;
        }
    } catch (error) {
        Logger.error(`[Cache] Error reading ${key}:`, error);
        return null;
    }
}

function setCacheData(key, value) {
    const data = {
        value: value,
        timestamp: Date.now()
    };
    
    const success = SafeStorage.setItem(key, JSON.stringify(data));
    if (success) {
        Logger.log(`[Cache] Stored ${key}`);
    }
}

function clearCache() {
    Object.values(CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    // Clear all program-specific cache keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(CACHE_KEYS.PROGRAM_DAYS + '_') || key.startsWith(CACHE_KEYS.EXERCISES + '_'))) {
            localStorage.removeItem(key);
        }
    }
    console.log('[Cache] Cleared all cache');
}

// ============================================
// БЕЗОПАСНЫЕ ФУНКЦИИ ДЛЯ СОЗДАНИЯ ФОРМ
// ============================================

/**
 * Безопасно экранирует значение для использования в HTML
 */
function escapeHTML(str) {
    if (str == null) return '';
    return SafeDOM.escapeHTML(String(str));
}

// ============================================
// ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
// ============================================

/**
 * Утилита для валидации входных данных
 */
const Validator = {
    /**
     * Валидация имени пользователя
     */
    validateName: function(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: 'Имя обязательно для заполнения' };
        }
        const trimmed = name.trim();
        if (trimmed.length < 2) {
            return { valid: false, error: 'Имя должно содержать минимум 2 символа' };
        }
        if (trimmed.length > 100) {
            return { valid: false, error: 'Имя слишком длинное (максимум 100 символов)' };
        }
        // Проверка на опасные символы
        if (/[<>\"'&]/.test(trimmed)) {
            return { valid: false, error: 'Имя содержит недопустимые символы' };
        }
        return { valid: true, value: trimmed };
    },

    /**
     * Валидация возраста
     */
    validateAge: function(age) {
        if (age === null || age === undefined || age === '') {
            return { valid: false, error: 'Возраст обязателен для заполнения' };
        }
        const ageNum = typeof age === 'string' ? parseInt(age, 10) : age;
        if (isNaN(ageNum)) {
            return { valid: false, error: 'Возраст должен быть числом' };
        }
        if (ageNum < 1 || ageNum > 120) {
            return { valid: false, error: 'Возраст должен быть от 1 до 120 лет' };
        }
        return { valid: true, value: ageNum };
    },

    /**
     * Валидация пола
     */
    validateGender: function(gender) {
        const validGenders = ['male', 'female', 'other'];
        if (!gender || !validGenders.includes(gender)) {
            return { valid: false, error: 'Пожалуйста, выберите пол' };
        }
        return { valid: true, value: gender };
    },

    /**
     * Валидация URL
     */
    validateURL: function(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL обязателен для заполнения' };
        }
        const trimmed = url.trim();
        if (trimmed.length === 0) {
            return { valid: true, value: '' }; // Пустой URL допустим
        }
        try {
            const urlObj = new URL(trimmed);
            // Проверка на безопасные протоколы
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return { valid: false, error: 'URL должен использовать протокол HTTP или HTTPS' };
            }
            return { valid: true, value: trimmed };
        } catch (e) {
            return { valid: false, error: 'Некорректный формат URL' };
        }
    },

    /**
     * Валидация текстового поля (описание, проблема и т.д.)
     */
    validateText: function(text, options = {}) {
        const { required = false, maxLength = 1000, minLength = 0 } = options;
        
        if (!text && required) {
            return { valid: false, error: 'Поле обязательно для заполнения' };
        }
        
        if (!text) {
            return { valid: true, value: '' };
        }
        
        const trimmed = String(text).trim();
        
        if (required && trimmed.length < minLength) {
            return { valid: false, error: `Текст должен содержать минимум ${minLength} символов` };
        }
        
        if (trimmed.length > maxLength) {
            return { valid: false, error: `Текст слишком длинный (максимум ${maxLength} символов)` };
        }
        
        // Проверка на опасные паттерны
        if (/<script|javascript:|on\w+\s*=/i.test(trimmed)) {
            return { valid: false, error: 'Текст содержит потенциально опасный код' };
        }
        
        return { valid: true, value: trimmed };
    },

    /**
     * Валидация ID (число)
     */
    validateID: function(id) {
        if (id === null || id === undefined || id === '') {
            return { valid: false, error: 'ID обязателен' };
        }
        const idNum = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(idNum) || idNum < 1) {
            return { valid: false, error: 'Некорректный ID' };
        }
        return { valid: true, value: idNum };
    }
};

/**
 * Безопасно создает форму редактирования программы
 */
function createProgramEditForm(program) {
    const title = escapeHTML(program.title || '');
    const description = escapeHTML(program.description || '');
    const imageUrl = escapeHTML(program.image_url || '');
    const programId = escapeHTML(program.id);
    const checked = program.is_published ? 'checked' : '';
    
    return `
        <div class="program-edit-form">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">Редактировать программу</h2>
            <form id="edit-program-form">
                <div class="form-group">
                    <label>Название программы</label>
                    <input type="text" id="edit-title" value="${title}" required>
                </div>
                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="edit-description" rows="3">${description}</textarea>
                </div>
                <div class="form-group">
                    <label>URL изображения</label>
                    <input type="url" id="edit-image-url" value="${imageUrl}">
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="edit-published" ${checked}>
                        <span class="checkmark"></span>
                        Опубликовано
                    </label>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="button" class="btn btn-primary" onclick="saveProgramEditViaAdmin('${programId}')">Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="loadDeveloperPrograms()">Отмена</button>
                </div>
            </form>
        </div>
    `;
}

/**
 * Безопасно создает список дней программы
 */
function createDaysListHTML(program, days) {
    const programTitle = escapeHTML(program.title || '');
    const programId = escapeHTML(program.id);
    
    const daysHTML = days.map(day => {
        const dayIndex = escapeHTML(String(day.day_index || ''));
        const dayId = escapeHTML(String(day.id || ''));
        
        return `
            <div class="day-item" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 5px 0; color: #2c3e50;">День ${dayIndex}</h4>
                        <p style="margin: 0; color: #999; font-size: 12px;">ID: ${dayId}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button data-action="day-exercises" data-id="${dayId}" style="padding: 6px 10px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Упражнения</button>
                        <button data-action="day-edit" data-id="${dayId}" style="padding: 6px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Редактировать</button>
                        <button data-action="day-delete" data-id="${dayId}" style="padding: 6px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Удалить</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="program-days-management">
            <h2 style="color: #2c3e50; margin-bottom: 20px; font-size: 20px;">Управление днями: ${programTitle}</h2>
            <div style="margin-bottom: 20px;">
                <button data-action="day-add" data-id="${programId}" class="btn btn-primary" style="margin-bottom: 15px;">
                    ➕ Добавить день
                </button>
            </div>
            <div id="days-list" style="max-height: 400px; overflow-y: auto;">
                ${daysHTML}
            </div>
            <div style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="loadDeveloperPrograms()">
                    ← Назад к программам
                </button>
            </div>
        </div>
    `;
}

/**
 * Безопасно создает список упражнений
 */
function createExercisesListHTML(day, exercises) {
    const programTitle = escapeHTML(day.programs?.title || '');
    const dayIndex = escapeHTML(String(day.day_index || ''));
    const dayId = escapeHTML(String(day.id || ''));
    
    const exercisesHTML = exercises.map(exercise => {
        const exerciseTitle = escapeHTML(exercise.title || '');
        const exerciseDescription = escapeHTML(exercise.description || '');
        const exerciseVideoUrl = escapeHTML(exercise.video_url || '');
        const exerciseId = escapeHTML(String(exercise.id || ''));
        const exerciseOrder = escapeHTML(String(exercise.order_index || ''));
        
        const videoHTML = exerciseVideoUrl 
            ? `<p style="margin: 0; color: #007bff; font-size: 12px;">📹 ${exerciseVideoUrl}</p>`
            : '';
        
        return `
            <div class="exercise-item" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${exerciseOrder}. ${exerciseTitle}</h4>
                        <p style="margin: 0 0 5px 0; color: #6c757d; font-size: 14px;">${exerciseDescription || 'Без описания'}</p>
                        ${videoHTML}
                        <p style="margin: 0; color: #999; font-size: 12px;">ID: ${exerciseId}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button data-action="exercise-edit" data-id="${exerciseId}" style="padding: 6px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Редактировать</button>
                        <button data-action="exercise-delete" data-id="${exerciseId}" style="padding: 6px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Удалить</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    const programId = escapeHTML(String(day.program_id || ''));
    
    return `
        <div class="exercises-management">
            <h2 style="color: #2c3e50; margin-bottom: 20px; font-size: 20px;">Упражнения: ${programTitle} - День ${dayIndex}</h2>
            <div style="margin-bottom: 20px;">
                <button data-action="exercise-add" data-id="${dayId}" class="btn btn-primary" style="margin-bottom: 15px;">
                    ➕ Добавить упражнение
                </button>
            </div>
            <div id="exercises-list" style="max-height: 400px; overflow-y: auto;">
                ${exercisesHTML}
            </div>
            <div style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="handleProgramDays('${programId}')">
                    ← Назад к дням
                </button>
            </div>
        </div>
    `;
}

// Clear cache when data is modified
function invalidateCache(type, id = null) {
    if (type === 'program') {
        localStorage.removeItem(CACHE_KEYS.PROGRAMS);
        // Clear all program-specific caches
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(CACHE_KEYS.PROGRAM_DAYS + '_') || key.startsWith(CACHE_KEYS.EXERCISES + '_'))) {
                localStorage.removeItem(key);
            }
        }
    } else if (type === 'day' && id) {
        localStorage.removeItem(`${CACHE_KEYS.PROGRAM_DAYS}_${id}`);
        localStorage.removeItem(`${CACHE_KEYS.EXERCISES}_${id}`);
    } else if (type === 'exercise' && id) {
        localStorage.removeItem(`${CACHE_KEYS.EXERCISES}_${id}`);
    }
    console.log(`[Cache] Invalidated ${type} cache for ${id || 'all'}`);
}

// Admin function helper
const ADMIN_BASE = `${window.SUPABASE_URL}/functions/v1/admin`;

async function adminCall(path, method, payload) {
    const initDataRaw = window.Telegram?.WebApp?.initData || '';
    
    console.log(`[Admin] ${method} ${path}`, payload);
    
    // Always use direct Supabase calls for now (until Edge Function is deployed)
    if (isEditor) {
        console.log('[Admin] Using direct Supabase calls (dev mode)');
        return await adminCallDirect(path, method, payload);
    }
    
    const res = await fetch(`${ADMIN_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataRaw, payload })
    });
    
    const json = await res.json().catch(() => ({}));
    
    if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
    }
    
    console.log(`[Admin] Success:`, json.data);
    return json.data;
}

// Direct Supabase calls for dev mode
async function adminCallDirect(path, method, payload) {
    if (method === 'POST' && path === '/programs') {
        const { data, error } = await supabaseClient
            .from('programs')
            .insert([payload])
            .select()
            .single();
        if (error) throw error;
        return data;
    }
    
    if (method === 'PUT' && path.startsWith('/programs/')) {
        const programId = path.split('/')[2];
        const { data, error } = await supabaseClient
            .from('programs')
            .update(payload)
            .eq('id', programId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
    
    if (method === 'DELETE' && path.startsWith('/programs/')) {
        const programId = path.split('/')[2];
        const { error } = await supabaseClient
            .from('programs')
            .delete()
            .eq('id', programId);
        if (error) throw error;
        return { deleted: true, id: programId };
    }
    
    throw new Error(`Unsupported dev mode operation: ${method} ${path}`);
}

// Default programs for migration
const DEFAULT_PROGRAMS = [
    {
        id: 'shoulders',
        slug: 'shoulders',
        title: 'Плечевой пояс',
        description: 'Укрепление и развитие мышц плечевого пояса',
        image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        details_md: 'Программа для укрепления плечевого пояса включает комплекс упражнений для развития силы и выносливости.',
        is_published: true,
        days: generateExerciseProgram('Плечевой пояс')
    },
    {
        id: 'back',
        slug: 'back',
        title: 'Спина',
        description: 'Укрепление мышц спины и улучшение осанки',
        image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        details_md: 'Комплекс упражнений для укрепления мышц спины и улучшения осанки.',
        is_published: true,
        days: generateExerciseProgram('Спина')
    },
    {
        id: 'core',
        slug: 'core',
        title: 'Пресс',
        description: 'Развитие мышц пресса и кора',
        image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        details_md: 'Программа для развития мышц пресса и укрепления кора.',
        is_published: true,
        days: generateExerciseProgram('Пресс')
    },
    {
        id: 'legs',
        slug: 'legs',
        title: 'Ноги',
        description: 'Укрепление мышц ног и ягодиц',
        image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        details_md: 'Комплекс упражнений для укрепления мышц ног и ягодиц.',
        is_published: true,
        days: generateExerciseProgram('Ноги')
    },
    {
        id: 'cardio',
        slug: 'cardio',
        title: 'Кардио',
        description: 'Кардиотренировки для выносливости',
        image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        details_md: 'Кардиотренировки для развития выносливости и сжигания калорий.',
        is_published: true,
        days: generateExerciseProgram('Кардио')
    },
    {
        id: 'flexibility',
        slug: 'flexibility',
        title: 'Гибкость',
        description: 'Упражнения на растяжку и гибкость',
        image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        details_md: 'Программа упражнений на растяжку и развитие гибкости.',
        is_published: true,
        days: generateExerciseProgram('Гибкость')
    },
    {
        id: 'strength',
        slug: 'strength',
        title: 'Сила',
        description: 'Силовые тренировки для набора мышечной массы',
        image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        details_md: 'Силовые тренировки для набора мышечной массы и развития силы.',
        is_published: true,
        days: generateExerciseProgram('Сила')
    },
    {
        id: 'recovery',
        slug: 'recovery',
        title: 'Восстановление',
        description: 'Упражнения для восстановления и релаксации',
        image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        details_md: 'Упражнения для восстановления и релаксации после тренировок.',
        is_published: true,
        days: generateExerciseProgram('Восстановление')
    }
];

// Safe modal initialization
(function initModalsAndClicks() {
    document.querySelectorAll('.modal, .overlay').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    document.body.style.overflow = '';
    console.log('✅ All modals/overlays initialized as hidden');
})();

// Event delegation for editor actions
function setupEditorEventDelegation() {
    // Attach to stable parent containers
    const containers = [
        document.getElementById('dev-programs-list'),
        document.getElementById('dev-days-list'),
        document.getElementById('dev-exercises-list')
    ].filter(Boolean);

    containers.forEach(container => {
        container.addEventListener('click', async (e) => {
            const actionButton = e.target.closest('[data-action]');
            if (!actionButton) return;

            e.preventDefault();
            e.stopPropagation();

            const action = actionButton.dataset.action;
            const id = actionButton.dataset.id;

            console.log(`[EventDelegation] Action: ${action}, ID: ${id}`);

            try {
                switch (action) {
                    case 'program-edit':
                        await handleEditProgram(id);
                        break;
                    case 'program-toggle':
                        await handleToggleProgram(id);
                        break;
                    case 'program-delete':
                        await handleDeleteProgram(id);
                        break;
                    case 'program-add':
                        await handleAddProgram();
                        break;
                    case 'program-days':
                        await handleProgramDays(id);
                        break;
                    case 'day-add':
                        await handleAddDay(id);
                        break;
                    case 'exercise-add':
                        await handleAddExercise(id);
                        break;
                    case 'exercise-edit':
                        await handleEditExercise(id);
                        break;
                    case 'exercise-delete':
                        await handleDeleteExercise(id);
                        break;
                    case 'day-exercises':
                        await handleDayExercises(id);
                        break;
                    case 'day-edit':
                        await handleEditDay(id);
                        break;
                    case 'day-delete':
                        await handleDeleteDay(id);
                        break;
                    default:
                        console.warn(`Unknown action: ${action}`);
                }
            } catch (error) {
                console.error(`Error handling action ${action}:`, error);
                showToast(`Ошибка: ${error.message}`, 'error');
            }
        });
    });

    // Also attach directly to the add program button
    const addProgramBtn = document.querySelector('[data-action="program-add"]');
    if (addProgramBtn) {
        addProgramBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Direct] Add program button clicked');
            try {
                await handleAddProgram();
            } catch (error) {
                console.error('Error in add program:', error);
                showToast(`Ошибка: ${error.message}`, 'error');
            }
        });
        console.log('✅ Direct add program button handler attached');
    }

    // Add global event delegation for dynamically created buttons
    document.addEventListener('click', async (e) => {
        const actionButton = e.target.closest('[data-action]');
        if (!actionButton) return;

        // Skip if already handled by container delegation
        if (containers.some(container => container.contains(actionButton))) return;

        e.preventDefault();
        e.stopPropagation();

        const action = actionButton.dataset.action;
        const id = actionButton.dataset.id;

        console.log(`[Global] Action: ${action}, ID: ${id}`);

        try {
            switch (action) {
                case 'program-edit':
                    await handleEditProgram(id);
                    break;
                case 'program-toggle':
                    await handleToggleProgram(id);
                    break;
                case 'program-delete':
                    await handleDeleteProgram(id);
                    break;
                case 'program-add':
                    await handleAddProgram();
                    break;
                case 'program-days':
                    await handleProgramDays(id);
                    break;
                case 'day-add':
                    await handleAddDay(id);
                    break;
                case 'day-exercises':
                    await handleDayExercises(id);
                    break;
                case 'day-edit':
                    await handleEditDay(id);
                    break;
                case 'day-delete':
                    await handleDeleteDay(id);
                    break;
                case 'exercise-add':
                    await handleAddExercise(id);
                    break;
                case 'exercise-edit':
                    await handleEditExercise(id);
                    break;
                case 'exercise-delete':
                    await handleDeleteExercise(id);
                    break;
                default:
                    console.warn(`Unknown global action: ${action}`);
            }
        } catch (error) {
            console.error(`Error handling global action ${action}:`, error);
            showToast(`Ошибка: ${error.message}`, 'error');
        }
    });

    console.log('✅ Event delegation setup complete');
}

// Handler functions for event delegation
async function handleEditProgram(programId) {
    console.log('handleEditProgram called with ID:', programId);
    showToast('Начинаем редактирование...', 'info');
    
    try {
        console.log('Fetching program data from Supabase...');
        // Get current program data
        const { data: program, error } = await supabaseClient
            .from('programs')
            .select('*')
            .eq('id', programId)
            .single();
        
        console.log('Program data result:', { program, error });
        
        if (error) throw error;
        
        console.log('Program data loaded successfully:', program);
        
        // Open edit modal
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        console.log('Modal elements:', { modal, modalBody });
        
        if (modal && modalBody) {
            console.log('Creating edit form...');
            // Безопасная вставка HTML с экранированием пользовательских данных
            SafeDOM.setHTML(modalBody, createProgramEditForm(program), false);
            
            // Ensure modal is attached to body and visible above all content
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.zIndex = '9999';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.background = 'rgba(0,0,0,0.5)';
            document.body.style.overflow = 'hidden';
        }
    } catch (error) {
        console.error('Failed to load program for editing:', error);
        showToast('Ошибка загрузки программы: ' + error.message, 'error');
    }
}

async function handleToggleProgram(programId) {
    console.log('handleToggleProgram called with ID:', programId);
    showToast('Изменяем статус...', 'info');
    
    try {
        // Get current program
        const { data: program, error: fetchError } = await supabaseClient
            .from('programs')
            .select('id, title, is_published')
            .eq('id', programId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // Toggle via admin function
        await adminCall(`/programs/${programId}`, 'PUT', {
            is_published: !program.is_published
        });
        
        showToast(`Программа "${program.title}" ${!program.is_published ? 'опубликована' : 'скрыта'}`, 'success');
        
        // Refresh views
        await loadDeveloperPrograms();
        await loadPrograms();
        
    } catch (error) {
        console.error('Failed to toggle program published:', error);
        showToast('Ошибка изменения статуса: ' + error.message, 'error');
    }
}

async function handleDeleteProgram(programId) {
    console.log('handleDeleteProgram called with ID:', programId);
    
    if (!confirm('Удалить программу? Это действие нельзя отменить.')) {
        return;
    }
    
    showToast('Удаляем программу...', 'info');
    
    try {
        await adminCall(`/programs/${programId}`, 'DELETE', {});
        
        showToast('Программа удалена', 'success');
        
        // Invalidate cache
        invalidateCache('program');
        
        // Remove program from UI immediately (optimistic update)
        const programElement = document.querySelector(`[data-id="${programId}"]`)?.closest('.program-item');
        if (programElement) {
            programElement.remove();
        }
        
        // Refresh views after a short delay to ensure DB is updated
        setTimeout(async () => {
            await loadDeveloperPrograms();
            await loadPrograms();
        }, 500);
        
    } catch (error) {
        console.error('Failed to delete program:', error);
        showToast('Ошибка удаления: ' + error.message, 'error');
        
        // If delete failed, refresh to show current state
        await loadDeveloperPrograms();
        await loadPrograms();
    }
}

async function handleAddProgram() {
    console.log('handleAddProgram called');
    showToast('Открываем форму создания...', 'info');
    
    const modal = document.getElementById('program-modal');
    const modalBody = document.getElementById('program-modal-body');
    
    if (modal && modalBody) {
        modalBody.innerHTML = `
            <div class="program-edit-form">
                <h2 style="color: #2c3e50; margin-bottom: 20px;">Добавить новую программу</h2>
                <form id="add-program-form">
                    <div class="form-group">
                        <label>Название программы</label>
                        <input type="text" id="add-title" required>
                    </div>
                    <div class="form-group">
                        <label>Описание</label>
                        <textarea id="add-description" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>URL изображения</label>
                        <input type="url" id="add-image-url">
                    </div>
                    <div class="form-group">
                        <label>Slug (уникальный идентификатор)</label>
                        <input type="text" id="add-slug" required>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="add-published" checked>
                            <span class="checkmark"></span>
                            Опубликовано
                        </label>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" class="btn btn-primary" onclick="saveNewProgramViaAdmin()">Создать</button>
                        <button type="button" class="btn btn-secondary" onclick="loadDeveloperPrograms()">Отмена</button>
                    </div>
                </form>
            </div>
        `;
        
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.zIndex = '9999';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.background = 'rgba(0,0,0,0.5)';
        document.body.style.overflow = 'hidden';
    }
}

async function handleProgramDays(programId) {
    console.log('handleProgramDays called with ID:', programId);
    showToast('Загружаем дни программы...', 'info');
    
    try {
        // Оптимизация: загружаем программу и дни параллельно
        const [programResult, daysResult] = await Promise.all([
            supabaseClient
                .from('programs')
                .select('*')
                .eq('id', programId)
                .single(),
            supabaseClient
                .from('program_days')
                .select('*')
                .eq('program_id', programId)
                .order('day_index')
        ]);
        
        const { data: program, error: programError } = programResult;
        const { data: days, error: daysError } = daysResult;
        
        if (programError) throw programError;
        if (daysError) throw daysError;
        
        // Open days management modal
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        if (modal && modalBody) {
            // Безопасная вставка HTML с экранированием пользовательских данных
            SafeDOM.setHTML(modalBody, createDaysListHTML(program, days), false);
            
            // Ensure modal is attached to body and visible
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.zIndex = '9999';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.background = 'rgba(0,0,0,0.5)';
            document.body.style.overflow = 'hidden';
        }
        
    } catch (error) {
        console.error('Failed to load program days:', error);
        showToast('Ошибка загрузки дней: ' + error.message, 'error');
    }
}

async function handleAddDay(programId) {
    console.log('handleAddDay called with program ID:', programId);
    showToast('Добавляем новый день...', 'info');
    
    try {
        // Get next day_index
        const { data: maxDay } = await supabaseClient
            .from('program_days')
            .select('day_index')
            .eq('program_id', programId)
            .order('day_index', { ascending: false })
            .limit(1)
            .single();
        
        const nextDayIndex = (maxDay?.day_index || 0) + 1;
        
        const { data, error } = await supabaseClient
            .from('program_days')
            .insert([{
                program_id: programId,
                day_index: nextDayIndex
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        showToast('День добавлен', 'success');
        
        // Refresh the days list
        await handleProgramDays(programId);
        
    } catch (error) {
        console.error('Failed to add day:', error);
        showToast('Ошибка добавления дня: ' + error.message, 'error');
    }
}

async function handleEditDay(dayId) {
    console.log('handleEditDay called with ID:', dayId);
    showToast('Загружаем день для редактирования...', 'info');
    
    try {
        // Get day data
        const { data: day, error } = await supabaseClient
            .from('program_days')
            .select('*')
            .eq('id', dayId)
            .single();
        
        if (error) throw error;
        
        // Open edit modal
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        if (modal && modalBody) {
            modalBody.innerHTML = `
                <div class="day-edit-form">
                    <h2 style="color: #2c3e50; margin-bottom: 20px;">Редактировать день</h2>
                    <form id="edit-day-form">
                        <div class="form-group">
                            <label>Номер дня</label>
                            <input type="number" id="edit-day-index" value="${day.day_index}" min="1">
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="button" class="btn btn-primary" onclick="saveDayEditViaAdmin('${dayId}')">Сохранить</button>
                            <button type="button" class="btn btn-secondary" onclick="handleProgramDays('${day.program_id}')">Отмена</button>
                        </div>
                    </form>
                </div>
            `;
            
            // Ensure modal is attached to body and visible
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.zIndex = '9999';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.background = 'rgba(0,0,0,0.5)';
            document.body.style.overflow = 'hidden';
        }
        
    } catch (error) {
        console.error('Failed to load day for editing:', error);
        showToast('Ошибка загрузки дня: ' + error.message, 'error');
    }
}

async function handleDeleteDay(dayId) {
    console.log('handleDeleteDay called with ID:', dayId);
    
    if (!confirm('Удалить день? Это также удалит все упражнения в этом дне. Действие нельзя отменить.')) {
        return;
    }
    
    showToast('Удаляем день...', 'info');
    
    try {
        // Get program_id before deleting
        const { data: day } = await supabaseClient
            .from('program_days')
            .select('program_id')
            .eq('id', dayId)
            .single();
        
        const { error } = await supabaseClient
            .from('program_days')
            .delete()
            .eq('id', dayId);
        
        if (error) throw error;
        
        showToast('День удален', 'success');
        
        // Refresh the days list
        await handleProgramDays(day.program_id);
        
    } catch (error) {
        console.error('Failed to delete day:', error);
        showToast('Ошибка удаления: ' + error.message, 'error');
    }
}

async function saveDayEditViaAdmin(dayId) {
    try {
        const dayIndex = parseInt(document.getElementById('edit-day-index').value);
        
        if (!dayIndex || dayIndex < 1) {
            showToast('Номер дня должен быть больше 0', 'error');
            return;
        }
        
        showToast('Сохраняем день...', 'info');
        
        const { data, error } = await supabaseClient
            .from('program_days')
            .update({
                day_index: dayIndex
            })
            .eq('id', dayId)
            .select()
            .single();
        
        if (error) throw error;
        
        showToast('День обновлен', 'success');
        
        // Get the program_id to refresh the days list
        const { data: day } = await supabaseClient
            .from('program_days')
            .select('program_id')
            .eq('id', dayId)
            .single();
        
        // Close modal and refresh
        const modal = document.getElementById('program-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        
        // Refresh the days list
        await handleProgramDays(day.program_id);
        
    } catch (error) {
        console.error('Failed to save day:', error);
        showToast('Ошибка сохранения: ' + error.message, 'error');
    }
}

async function handleDayExercises(dayId) {
    console.log('handleDayExercises called with day ID:', dayId);
    showToast('Загружаем упражнения дня...', 'info');
    
    try {
        // Get day info
        const { data: day, error: dayError } = await supabaseClient
            .from('program_days')
            .select('*, programs(title)')
            .eq('id', dayId)
            .single();
        
        if (dayError) throw dayError;
        
        // Get exercises for this day
        const { data: exercises, error: exercisesError } = await supabaseClient
            .from('exercises')
            .select('*')
            .eq('program_day_id', dayId)
            .order('order_index');
        
        if (exercisesError) throw exercisesError;
        
        // Open exercises management modal
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        if (modal && modalBody) {
            // Безопасная вставка HTML с экранированием пользовательских данных
            SafeDOM.setHTML(modalBody, createExercisesListHTML(day, exercises), false);
            
            // Ensure modal is attached to body and visible
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.zIndex = '9999';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.background = 'rgba(0,0,0,0.5)';
            document.body.style.overflow = 'hidden';
        }
        
    } catch (error) {
        console.error('Failed to load day exercises:', error);
        showToast('Ошибка загрузки упражнений: ' + error.message, 'error');
    }
}

// Admin-based save functions
async function saveProgramEditViaAdmin(programId) {
    try {
        const title = document.getElementById('edit-title').value;
        const description = document.getElementById('edit-description').value;
        const imageUrl = document.getElementById('edit-image-url').value;
        const isPublished = document.getElementById('edit-published').checked;
        
        if (!title.trim()) {
            showToast('Название программы обязательно', 'error');
            return;
        }
        
        showToast('Сохраняем изменения...', 'info');
        
        await adminCall(`/programs/${programId}`, 'PUT', {
            title: title.trim(),
            description: description.trim(),
            image_url: imageUrl.trim(),
            is_published: isPublished
        });
        
        showToast('Программа обновлена', 'success');
        
        // Refresh views
        await loadDeveloperPrograms();
        await loadPrograms();
        
        // Close modal
        const modal = document.getElementById('program-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    } catch (error) {
        console.error('Failed to save program:', error);
        showToast('Ошибка сохранения: ' + error.message, 'error');
    }
}

async function saveNewProgramViaAdmin() {
    try {
        const title = document.getElementById('add-title').value;
        const description = document.getElementById('add-description').value;
        const imageUrl = document.getElementById('add-image-url').value;
        const slug = document.getElementById('add-slug').value;
        const isPublished = document.getElementById('add-published').checked;
        
        if (!title.trim()) {
            showToast('Название программы обязательно', 'error');
            return;
        }
        
        if (!slug.trim()) {
            showToast('Slug обязателен', 'error');
            return;
        }
        
        showToast('Создаем программу...', 'info');
        
        await adminCall('/programs', 'POST', {
            title: title.trim(),
            description: description.trim(),
            image_url: imageUrl.trim(),
            slug: slug.trim(),
            is_published: isPublished
        });
        
        showToast('Программа создана', 'success');
        
        // Refresh views
        await loadDeveloperPrograms();
        await loadPrograms();
        
        // Close modal
        const modal = document.getElementById('program-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    } catch (error) {
        console.error('Failed to create program:', error);
        showToast('Ошибка создания: ' + error.message, 'error');
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing app...');
    
    // Initialize Supabase
    initializeSupabase();
    
    // Initialize Telegram and check editor status
    initializeTelegram();
    
    // Initialize app components
    initializeApp();
    
    // Setup event delegation for editor actions
    setupEditorEventDelegation();
    loadPrograms();
    setupEventListeners();
    
    // Удалены все принудительные стили - это задача CSS, а не JavaScript
    loadUserData();
    
    // Load user progress from localStorage first, then from database
    const cachedProgress = localStorage.getItem('userProgress');
    if (cachedProgress) {
        try {
            userProgress = normalizeUserProgress(JSON.parse(cachedProgress));
            console.log('User progress loaded from cache:', userProgress);
            // Update UI immediately with cached data
            updateProgressUI();
            updateCalendarHighlighting();
        } catch (e) {
            console.warn('Failed to parse cached progress:', e);
            userProgress = null;
        }
    }
    
    // Load profile from cache first (for immediate UI update)
    loadProfileFromCache();
    
    // Load fresh data from database (this will override cache if user is logged in)
    // Оптимизация: загружаем параллельно для ускорения
    if (user?.id) {
        Promise.all([
            loadUserProgress(),
            loadUserProfile()
        ]).catch(error => {
            console.error('Error loading user data:', error);
        });
    }
    
    // Ensure only one HTML5 video plays at a time
    setupExclusiveVideoPlayback();
    
    // Lock orientation to portrait on main screen only
    setupOrientationLock();

    // Auto-generate video posters for HTML5 exercise videos
    setupVideoPosterGenerator();
    
    // Setup image error handling for external resources
    setupImageErrorHandling();

    // Initial access UI sync (in case profile/progress loaded from cache)
    try { updateAccessUI(); } catch (_) {}
    
    console.log('App initialization complete');
});

// Initialize Supabase
function initializeSupabase() {
    try {
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase) {
            supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            // Также устанавливаем в глобальную переменную для обратной совместимости
            window.supabaseClient = supabaseClient;
            console.log('Supabase client initialized');
        } else {
            console.warn('Supabase configuration not found, using fallback data');
        }
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
    }
}

// Определение режима отображения Telegram WebApp
function detectTelegramDisplayMode() {
    if (!tg) {
        document.documentElement.classList.remove('tg-compact-mode');
        document.documentElement.classList.add('tg-fullscreen-mode');
        return;
    }
    
    // isExpanded - true когда открыто в полноэкранном режиме
    // viewportHeight vs viewportStableHeight - разница показывает, есть ли шапка
    const isExpanded = tg.isExpanded || false;
    const viewportHeight = tg.viewportHeight || window.innerHeight;
    const viewportStableHeight = tg.viewportStableHeight || window.innerHeight;
    const hasHeader = viewportHeight < viewportStableHeight || !isExpanded;
    
    const root = document.documentElement;
    
    if (hasHeader || !isExpanded) {
        // Компактный режим (с шапкой Telegram)
        root.classList.remove('tg-fullscreen-mode');
        root.classList.add('tg-compact-mode');
        root.style.setProperty('--tg-header-height', `${viewportStableHeight - viewportHeight}px`);
        Logger.log('[TG] Compact mode detected - header height:', viewportStableHeight - viewportHeight);
    } else {
        // Полноэкранный режим
        root.classList.remove('tg-compact-mode');
        root.classList.add('tg-fullscreen-mode');
        root.style.setProperty('--tg-header-height', '0px');
        Logger.log('[TG] Fullscreen mode detected');
    }
    
    // Обновляем переменные для адаптации
    root.style.setProperty('--tg-viewport-height', `${viewportHeight}px`);
    root.style.setProperty('--tg-viewport-stable-height', `${viewportStableHeight}px`);
}

// Initialize Telegram WebApp
function initializeTelegram() {
    if (tg) {
    tg.ready();
    tg.expand();
    
        // Определяем режим отображения
        detectTelegramDisplayMode();
        
        // Подписываемся на изменения viewport
        tg.onEvent('viewportChanged', () => {
            detectTelegramDisplayMode();
            // Пересчитываем адаптивные стили после изменения режима
            setTimeout(updateAdaptiveScale, 100);
        });
    
        // Diagnostics and initData
        const initDataRaw = window.Telegram?.WebApp?.initData || '';
        console.log('[TG] initData present:', !!initDataRaw);
        console.log('[TG] initDataUnsafe.user:', window.Telegram?.WebApp?.initDataUnsafe?.user || null);
    // Get user data from Telegram
    user = tg.initDataUnsafe?.user;
    
    // Load user profile after user is initialized
    if (user?.id) {
        loadUserProfile();
    }
    
    // Set up theme - по умолчанию светлая тема
    if (tg.colorScheme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        // Убеждаемся, что светлая тема активна по умолчанию
        document.body.classList.remove('dark-theme');
    }
    
    // Load theme preference to set correct icon
    loadThemePreference();
        
        // Hide dev button by default until verified
        hideDeveloperButton();
        
        // Check if user is editor
        checkEditorStatus();
        
    } else {
        // Local dev fallback
        detectTelegramDisplayMode(); // Все равно определяем режим (для полноэкранного в браузере)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('dev') === '1') {
            console.log('Local dev mode - showing developer button');
            isEditor = true;
            showDeveloperButton();
        } else {
            showBrowserDevMode();
        }
    }
    
    // Повторная проверка режима после небольшой задержки (на случай, если Telegram API еще не готов)
    setTimeout(() => {
        if (tg) {
            detectTelegramDisplayMode();
        }
    }, 200);
}

// Show browser dev mode button
function showBrowserDevMode() {
    console.log('Attempting to show browser dev mode button.');
    // Create a temporary button for browser testing
    const devButton = document.createElement('div');
    devButton.id = 'browser-dev-mode';
    devButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #007bff;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        z-index: 9999;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    devButton.innerHTML = '🔧 Режим разработчика';
    devButton.onclick = () => {
        isEditor = true;
        showDeveloperButton();
        devButton.remove();
        showToast('Режим разработчика включен', 'success');
    };
    
    document.body.appendChild(devButton);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (devButton.parentNode) {
            devButton.remove();
        }
    }, 10000);
}

// Check editor status via Telegram initData
async function checkEditorStatus() {
    const initDataRaw = window.Telegram?.WebApp?.initData || '';
    const urlParams = new URLSearchParams(window.location.search);
    
    if (!initDataRaw) {
        console.log('No Telegram initData available');
        showToast('Откройте приложение из Telegram-бота.', 'error');
        if (urlParams.get('dev') === '1') {
            console.log('[DEV] Shortcut: treating as editor');
            isEditor = true;
            showDeveloperButton();
        }
        return;
    }
    
    try {
        console.log('Checking editor status...');
        const functionUrl = `${window.SUPABASE_URL}/functions/v1/verify-editor`;
        console.log('Function URL:', functionUrl);
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                initDataRaw
            })
        });
        
        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('[EditorCheck] response:', result);
        
        if (result && result.is_editor === true) {
            isEditor = true;
            showDeveloperButton();
        } else {
            hideDeveloperButton();
        }
    } catch (error) {
        console.error('Failed to verify editor status:', error);
        hideDeveloperButton();
    }
}

// Show/hide developer button
function showDeveloperButton() {
    const devSection = document.querySelector('.developer-access-section');
    if (devSection) {
        devSection.style.display = 'block';
    }
}

function hideDeveloperButton() {
    const devSection = document.querySelector('.developer-access-section');
    if (devSection) {
        devSection.style.display = 'none';
    }
}

// Initialize app data
function initializeApp() {
    // Set up navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            console.log('Navigation clicked:', section, 'Text:', this.querySelector('.nav-text').textContent);
            navigateToSection(section);
        });
    });
    
    // Load theme preference
    loadThemePreference();
    
    // Initialize with home section active
    navigateToSection('home');
    
    // Initialize dynamic scaling for main screen
    updateAdaptiveScale();
    
    // Test scaling (only in development)
    testScaling();
    
    // Load user profile if available
    if (user) {
        const userNameEl = safeGetElement('user-name', 'load user profile');
        if (userNameEl) {
            userNameEl.value = user.first_name || '';
            if (user.last_name) {
                userNameEl.value += ' ' + user.last_name;
            }
        }
    }
    
    // Load initial content for the active section
    const activeSection = document.querySelector('.section.active');
    if (activeSection) {
        const sectionName = activeSection.id;
        if (sectionName === 'exercises') {
            loadPrograms();
        } else if (sectionName === 'home') {
            initializeHomepage();
        }
    }
    
    // Load saved profile data
    if (userProfile && userProfile.name) {
        const userNameEl = safeGetElement('user-name', 'load saved profile');
        if (userNameEl) userNameEl.value = userProfile.name;
    }
    if (userProfile && userProfile.birthdate) {
        const userBirthdateEl = safeGetElement('user-birthdate', 'load saved profile');
        if (userBirthdateEl) userBirthdateEl.value = userProfile.birthdate;
    }
    if (userProfile && userProfile.problem) {
        const userProblemEl = safeGetElement('user-problem', 'load saved profile');
        if (userProblemEl) userProblemEl.value = userProfile.problem;
    }
    
    // Initialize calendar
    updateCalendar();
    updateProgressStats();
}

// Allow only one <video> playing at a time
function setupExclusiveVideoPlayback() {
    try {
        const bind = (video) => {
            if (!video || video.__exclusiveBound) return;
            video.addEventListener('play', () => {
                document.querySelectorAll('video').forEach(other => {
                    if (other !== video && !other.paused && !other.ended) {
                        try { other.pause(); } catch (e) { /* ignore */ }
                    }
                });
            });
            video.__exclusiveBound = true;
        };
        
        // Bind existing
        document.querySelectorAll('video').forEach(bind);
        
        // Bind future via MutationObserver we already use
        const observer = new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'VIDEO') bind(node);
                        node.querySelectorAll && node.querySelectorAll('video').forEach(bind);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    } catch (err) {
        console.warn('setupExclusiveVideoPlayback failed', err);
    }
}

// IntersectionObserver-based lazy loader for iframes/videos
function setupLazyMediaLoading() {
    try {
        const iframes = Array.from(document.querySelectorAll('iframe.exercise-video[data-src]'));
        if (!('IntersectionObserver' in window)) {
            iframes.forEach(f => { f.src = f.dataset.src; });
            return;
        }
        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    if (el.dataset && el.dataset.src) {
                        el.src = el.dataset.src;
                        delete el.dataset.src;
                        io.unobserve(el);
                    }
                }
            });
        }, { rootMargin: '200px 0px', threshold: 0.01 });
        iframes.forEach(el => io.observe(el));
    } catch (e) {
        console.warn('setupLazyMediaLoading failed', e);
    }
}

const VIDEO_POSTER_CACHE_KEY = 'exerciseVideoPosterCache.v1';
let videoPosterCacheMemory = null;
let videoPosterObserver = null;
let posterGeneratorInitialized = false;

function getVideoPosterCache() {
    if (!videoPosterCacheMemory) {
        try {
            const raw = localStorage.getItem(VIDEO_POSTER_CACHE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    videoPosterCacheMemory = parsed;
                } else {
                    videoPosterCacheMemory = {};
                }
            } else {
                videoPosterCacheMemory = {};
            }
        } catch (err) {
            console.warn('Failed to parse video poster cache', err);
            videoPosterCacheMemory = {};
        }
    }
    return videoPosterCacheMemory;
}

function saveVideoPosterCache() {
    if (!videoPosterCacheMemory) return;
    try {
        const entries = Object.entries(videoPosterCacheMemory)
            .filter(([_, value]) => value && typeof value === 'object' && value.dataUrl)
            .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
        const MAX_CACHE_ITEMS = 40;
        if (entries.length > MAX_CACHE_ITEMS) {
            const trimmed = entries.slice(0, MAX_CACHE_ITEMS);
            videoPosterCacheMemory = Object.fromEntries(trimmed);
        }
        localStorage.setItem(VIDEO_POSTER_CACHE_KEY, JSON.stringify(videoPosterCacheMemory));
    } catch (err) {
        console.warn('Failed to save video poster cache', err);
    }
}

function getCachedPoster(src) {
    if (!src) return null;
    const cache = getVideoPosterCache();
    const entry = cache[src];
    if (entry && entry.dataUrl) {
        return entry.dataUrl;
    }
    return null;
}

function rememberPoster(src, dataUrl) {
    if (!src || !dataUrl) return;
    const cache = getVideoPosterCache();
    cache[src] = { dataUrl, updatedAt: Date.now() };
    saveVideoPosterCache();
}

function collectPosterCandidates(root) {
    if (!root) return [];
    if (root.tagName === 'VIDEO') {
        return root.dataset && root.dataset.autoPoster === 'true' ? [root] : [];
    }
    if (root.querySelectorAll) {
        return Array.from(root.querySelectorAll('video.exercise-video[data-auto-poster="true"]'));
    }
    return [];
}

function setupVideoPosterGenerator() {
    if (posterGeneratorInitialized) return;
    posterGeneratorInitialized = true;
    try {
        initializeAutoVideoPosters(document.body || document);
        if ('IntersectionObserver' in window) {
            videoPosterObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    const video = entry.target;
                    if (entry.isIntersecting) {
                        videoPosterObserver.unobserve(video);
                        queueVideoPosterGeneration(video);
                    }
                });
            }, { rootMargin: '200px 0px', threshold: 0.05 });
        }
        const observer = new MutationObserver(mutations => {
            try {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;
                        initializeAutoVideoPosters(node);
                    });
                });
            } catch (err) {
                console.warn('Video poster mutation observer error', err);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    } catch (err) {
        console.warn('setupVideoPosterGenerator failed', err);
    }
}

// Setup image error handling for external resources
function setupImageErrorHandling() {
    try {
        // Placeholder image for failed loads (you can replace with your own)
        const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U5ZWNlZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7QndC10YIg0L7RgtC60LDQtyDQv9GA0L7QsdC10LvQtdC90LjQtTwvdGV4dD48L3N2Zz4=';
        
        const handleImageError = function(event) {
            const img = event.target;
            // Prevent infinite loop if placeholder also fails
            if (img.dataset.errorHandled === 'true') {
                return;
            }
            
            // Only handle errors for external resources (getcourse.ru)
            if (img.src && (img.src.includes('getcourse.ru') || img.src.includes('gcfs04.getcourse.ru'))) {
                img.dataset.errorHandled = 'true';
                // Set placeholder or hide image
                img.style.opacity = '0.5';
                img.alt = img.alt || 'Изображение не загружено';
                // Optionally set placeholder: img.src = placeholderImage;
            }
        };
        
        // Add error handlers to existing images
        const existingImages = document.querySelectorAll('img');
        existingImages.forEach(img => {
            if (!img.onerror) {
                img.addEventListener('error', handleImageError, { once: true });
            }
        });
        
        // Watch for new images added dynamically
        const imageObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'IMG') {
                            node.addEventListener('error', handleImageError, { once: true });
                        }
                        // Also check for images inside added nodes
                        const images = node.querySelectorAll && node.querySelectorAll('img');
                        if (images) {
                            images.forEach(img => {
                                if (!img.onerror) {
                                    img.addEventListener('error', handleImageError, { once: true });
                                }
                            });
                        }
                    }
                });
            });
        });
        
        imageObserver.observe(document.body, { childList: true, subtree: true });
    } catch (err) {
        console.warn('setupImageErrorHandling failed', err);
    }
}

function initializeAutoVideoPosters(root) {
    try {
        const videos = collectPosterCandidates(root);
        if (!videos.length) return;
        videos.forEach(video => {
            if (!video || video.dataset.posterReady === 'true' || video.dataset.posterBlocked === 'true') return;
            if (video.poster) {
                video.dataset.posterReady = 'true';
                return;
            }
            if (videoPosterObserver) {
                videoPosterObserver.observe(video);
            } else {
                queueVideoPosterGeneration(video);
            }
        });
    } catch (err) {
        console.warn('initializeAutoVideoPosters failed', err);
    }
}

function queueVideoPosterGeneration(video) {
    if (!video || video.dataset.posterPending === 'true') return;
    const src = getVideoSource(video);
    if (!src) {
        video.dataset.posterBlocked = 'true';
        return;
    }
    const cached = getCachedPoster(src);
    if (cached) {
        video.poster = cached;
        video.dataset.posterReady = 'true';
        return;
    }
    video.dataset.posterPending = 'true';
    const schedule = window.requestIdleCallback || function(cb) { return setTimeout(cb, 100); };
    schedule(() => {
        generatePosterFromVideoSource(src).then(dataUrl => {
            if (dataUrl) {
                rememberPoster(src, dataUrl);
                if (!video.poster) {
                    video.poster = dataUrl;
                }
            } else {
                video.dataset.posterBlocked = 'true';
            }
        }).catch(err => {
            console.warn('Poster generation failed for', src, err);
            video.dataset.posterBlocked = 'true';
        }).finally(() => {
            delete video.dataset.posterPending;
            video.dataset.posterReady = 'true';
        });
    });
}

function getVideoSource(video) {
    if (!video) return null;
    if (video.dataset && video.dataset.videoSrc) {
        return video.dataset.videoSrc;
    }
    if (video.currentSrc) return video.currentSrc;
    const sourceEl = video.querySelector('source');
    return sourceEl ? sourceEl.src : null;
}

function generatePosterFromVideoSource(src) {
    return new Promise(resolve => {
        try {
            const tempVideo = document.createElement('video');
            let timeoutId;
            let resolved = false;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                tempVideo.pause && tempVideo.pause();
                tempVideo.removeAttribute('src');
                tempVideo.load();
            };

            const finalize = (dataUrl) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(dataUrl || null);
            };

            const captureFrame = () => {
                try {
                    if (!tempVideo.videoWidth || !tempVideo.videoHeight) {
                        finalize(null);
                        return;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = tempVideo.videoWidth;
                    canvas.height = tempVideo.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        finalize(null);
                        return;
                    }
                    ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
                    finalize(dataUrl);
                } catch (err) {
                    console.warn('Unable to capture video frame', err);
                    finalize(null);
                }
            };

            const handleLoadedData = () => {
                try {
                    if (Number.isFinite(tempVideo.duration) && tempVideo.duration > 0) {
                        const targetTime = Math.min(Math.max(tempVideo.duration * 0.02, 0.05), Math.max(tempVideo.duration - 0.05, 0.05));
                        if (Math.abs(tempVideo.currentTime - targetTime) > 0.01) {
                            tempVideo.currentTime = targetTime;
                            return;
                        }
                    }
                } catch (err) {
                    console.warn('Error seeking temp video', err);
                }
                captureFrame();
            };

            const handleSeeked = () => {
                captureFrame();
            };

            const handleError = (event) => {
                console.warn('Temp video error', event?.message || event);
                finalize(null);
            };

            tempVideo.crossOrigin = 'anonymous';
            tempVideo.muted = true;
            tempVideo.playsInline = true;
            tempVideo.preload = 'auto';
            tempVideo.addEventListener('loadeddata', handleLoadedData, { once: true });
            tempVideo.addEventListener('seeked', handleSeeked, { once: true });
            tempVideo.addEventListener('error', handleError, { once: true });

            timeoutId = setTimeout(() => finalize(null), 8000);

            const cacheBuster = src.includes('?') ? '&' : '?';
            tempVideo.src = `${src}${cacheBuster}preview=${Date.now()}`;
            tempVideo.load();
        } catch (err) {
            console.warn('generatePosterFromVideoSource failed', err);
            resolve(null);
        }
    });
}

// Lock orientation to portrait on main screen only
function setupOrientationLock() {
    try {
        // Check if we're on main screen
        const isMainScreen = () => {
            const homeSection = document.getElementById('home');
            const exerciseModal = document.getElementById('exercise-modal');
            const programModal = document.getElementById('program-modal');
            
            return homeSection && homeSection.classList.contains('active') && 
                   (!exerciseModal || exerciseModal.classList.contains('hidden')) &&
                   (!programModal || programModal.classList.contains('hidden'));
        };
        
        // Track if orientation lock is currently being attempted
        let orientationLockInProgress = false;
        let lastOrientationAction = null;
        let orientationDebounceTimer = null;
        
        // Debounced orientation handler
        const debouncedOrientationHandler = () => {
            if (orientationDebounceTimer) {
                clearTimeout(orientationDebounceTimer);
            }
            orientationDebounceTimer = setTimeout(() => {
                if (isMainScreen()) {
                    lockOrientation();
                } else {
                    unlockOrientation();
                }
            }, 300); // 300ms debounce
        };
        
        // Lock orientation to portrait when on main screen
        const lockOrientation = async () => {
            // Check if API is supported
            if (!('screen' in window) || !('orientation' in screen) || !screen.orientation || !screen.orientation.lock) {
                return; // Silently return if not supported
            }
            
            // Prevent multiple simultaneous calls
            if (orientationLockInProgress) {
                return;
            }
            
            if (isMainScreen()) {
                orientationLockInProgress = true;
                try {
                    await screen.orientation.lock('portrait');
                    console.log('Orientation locked to portrait on main screen');
                    lastOrientationAction = 'lock';
                } catch (err) {
                    // Only log if it's not a known expected error
                    if (err.name !== 'NotSupportedError' && err.name !== 'AbortError') {
                        console.warn('Could not lock orientation:', err);
                    }
                } finally {
                    orientationLockInProgress = false;
                }
            }
        };
        
        // Unlock orientation when leaving main screen
        const unlockOrientation = async () => {
            // Check if API is supported
            if (!('screen' in window) || !('orientation' in screen) || !screen.orientation || !screen.orientation.unlock) {
                return; // Silently return if not supported
            }
            
            // Prevent multiple simultaneous calls
            if (orientationLockInProgress) {
                return;
            }
            
            if (!isMainScreen() && lastOrientationAction === 'lock') {
                orientationLockInProgress = true;
                try {
                    await screen.orientation.unlock();
                    console.log('Orientation unlocked');
                    lastOrientationAction = 'unlock';
                } catch (err) {
                    // Only log if it's not a known expected error
                    if (err.name !== 'NotSupportedError' && err.name !== 'AbortError') {
                        console.warn('Could not unlock orientation:', err);
                    }
                } finally {
                    orientationLockInProgress = false;
                }
            }
        };
        
        // Lock on page load if on main screen
        lockOrientation();
        
        // Listen for orientation changes
        window.addEventListener('orientationchange', debouncedOrientationHandler);
        
        // Listen for section changes
        const sectionObserver = new MutationObserver(debouncedOrientationHandler);
        
        // Observe changes to section classes
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => {
            sectionObserver.observe(section, { attributes: true, attributeFilter: ['class'] });
        });
        
        // Listen for modal changes
        const modalObserver = new MutationObserver(debouncedOrientationHandler);
        
        modalObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
        
    } catch (error) {
        console.warn('Orientation lock setup failed:', error);
    }
}

// ===== PROGRESS TRACKING FUNCTIONS =====

// Normalize various possible shapes of progress data into a consistent structure
function normalizeUserProgress(raw) {
    const safe = raw && typeof raw === 'object' ? raw : {};

    // Extract completed days from possible shapes
    let completedDaysArray = [];
    if (Array.isArray(safe.completed_days)) {
        completedDaysArray = safe.completed_days;
    } else if (Array.isArray(safe.completedDays)) {
        completedDaysArray = safe.completedDays;
    } else if (Array.isArray(safe.days)) {
        completedDaysArray = safe.days;
    }

    // Normalize items to objects with completed_at
    completedDaysArray = completedDaysArray.map(d => {
        if (!d || typeof d !== 'object') {
            const fallbackDate = typeof d === 'string' ? d : (d?.date || d?.completedAt);
            const iso = fallbackDate || new Date().toISOString();
            return {
                program_id: d?.program_id || null,
                day_index: d?.day_index || null,
                completed_at: iso,
                completed_date_utc: toUtcDateString(iso)
            };
        }

        const completedAt = d.completed_at || d.completedAt || d.date || d.completed_date || new Date().toISOString();
        const completedDateUtc = d.completed_date_utc || toUtcDateString(d.completed_date || completedAt);

        return {
            ...d,
            completed_at: completedAt,
            completed_date_utc: completedDateUtc
        };
    });

    // Ensure level_info exists and consistent
    let levelInfo = safe.level_info;
    if (!levelInfo || typeof levelInfo !== 'object') {
        levelInfo = {
            current_level: safe.current_level ?? 1,
            total_days: safe.total_days ?? completedDaysArray.length,
            current_streak: safe.current_streak ?? 0,
            longest_streak: safe.longest_streak ?? 0,
            last_activity: safe.last_activity ?? null
        };
    }

    const normalized = {
        ...safe,
        level_info: levelInfo,
        completed_days: completedDaysArray
    };

    // Derived helpers
    normalized.completedDays = Array.isArray(normalized.completed_days) ? normalized.completed_days.length : 0;
    normalized.currentStreak = normalized.level_info?.current_streak || 0;
    normalized.totalDays = normalized.level_info?.total_days || 0;
    normalized.longestStreak = normalized.level_info?.longest_streak || 0;

    return normalized;
}

// Load user progress from database
async function loadUserProgress() {
    try {
        if (!user?.id) {
            console.warn('No user ID available for progress tracking');
            // Try to load from cache if no user ID
            loadProgressFromCache();
            return;
        }

        console.log('Loading user progress for user ID:', user.id);
        const { data, error } = await supabaseClient
            .rpc('get_user_progress', { p_tg_user_id: user.id });

        console.log('Supabase response - data:', data);
        console.log('Supabase response - error:', error);

        if (error) {
            console.error('Error loading user progress:', error);
            // Preserve cached progress on error
            return;
        }

        // Load cached progress for potential merge
        let cached = null;
        try {
            const cachedRaw = localStorage.getItem('userProgress');
            cached = cachedRaw ? JSON.parse(cachedRaw) : null;
        } catch (_) {}

        if (data) {
            // Prefer server data; if server has empty completed_days but cache has items, preserve cache items
            const raw = Array.isArray(data) ? (data[0] || {}) : (data || {});
            const server = raw;
            
            // Normalize: some RPCs may return level fields at the root; ensure level_info object exists
            if (!server.level_info) {
                const inferredLevelInfo = {
                    current_level: server.current_level ?? 1,
                    total_days: server.total_days ?? (Array.isArray(server.completed_days) ? server.completed_days.length : 0),
                    current_streak: server.current_streak ?? 0,
                    longest_streak: server.longest_streak ?? 0,
                    last_activity: server.last_activity ?? null
                };
                server.level_info = inferredLevelInfo;
            }
            
            const serverCompleted = Array.isArray(server.completed_days) ? server.completed_days : [];
            const cachedCompleted = Array.isArray(cached?.completed_days) ? cached.completed_days : [];
            let merged = server;
            if (serverCompleted.length === 0 && cachedCompleted.length > 0) {
                merged.completed_days = cachedCompleted;
            }
            userProgress = normalizeUserProgress(merged);
            console.log('User progress loaded from database:', userProgress);
            
            // Store in localStorage for persistence
            localStorage.setItem('userProgress', JSON.stringify(userProgress));
        } else {
            console.log('No progress data found from server; preserving cached progress');
            // Do NOT overwrite cache with empty structure; fall back to cache or minimal default
            if (cached) {
                userProgress = normalizeUserProgress(cached);
            } else {
                userProgress = {
                    level_info: {
                        current_level: 1,
                        total_days: 0,
                        current_streak: 0,
                        longest_streak: 0,
                        last_activity: null
                    },
                    completed_days: []
                };
            }
            // Derived helpers
            userProgress = normalizeUserProgress(userProgress);
            localStorage.setItem('userProgress', JSON.stringify(userProgress));
        }
        
        // Update UI with progress data
        updateProgressUI();
        
        // Update calendar highlighting
        updateCalendarHighlighting();
        
    } catch (error) {
        console.error('Failed to load user progress:', error);
    }
}

function toUtcDateString(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function getTodayUtcDateString() {
    return toUtcDateString(new Date());
}

function getCompletedDayUtc(day) {
    if (!day) return null;
    if (day.completed_date_utc) return day.completed_date_utc;
    return toUtcDateString(day.completed_at);
}

// Mark a day as completed
async function markDayCompleted(programId, dayIndex) {
    try {
        if (!user?.id) {
            showNotification('Ошибка: пользователь не авторизован', 'error');
            return;
        }

        // Disable button immediately to prevent double-clicks
        const button = document.querySelector(`button[onclick="markDayCompleted(${programId}, ${dayIndex})"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '⏳ Сохранение...';
            button.style.opacity = '0.6';
        }

        const { data, error } = await supabaseClient
            .rpc('mark_day_completed', {
                p_tg_user_id: user.id,
                p_program_id: programId,
                p_day_index: dayIndex
            });

        if (error) {
            console.error('Error marking day as completed:', error);
            showNotification('Ошибка при сохранении прогресса', 'error');
            
            // Re-enable button on error
            if (button) {
                button.disabled = false;
                button.innerHTML = '✅ Отметить выполненным';
                button.style.opacity = '1';
            }
            return;
        }

        if (data.success) {
            showNotification(data.message, 'success');
            
            // Update button to show completed state
            if (button) {
                button.innerHTML = '✅ Выполнено';
                button.style.background = 'rgba(40, 167, 69, 0.6)';
                button.style.cursor = 'default';
                button.onclick = null; // Remove click handler
            }
            
            // Update local progress data immediately
            if (userProgress) {
                userProgress.level_info = data.level_info;
                // Add the completed day to the list
                const programIdNum = parseInt(programId);
                const nowIso = new Date().toISOString();
                const completedDay = {
                    program_id: programIdNum,
                    day_index: dayIndex,
                    completed_at: nowIso,
                    completed_date_utc: getTodayUtcDateString()
                };
                if (!userProgress.completed_days) {
                    userProgress.completed_days = [];
                }
                userProgress.completed_days.unshift(completedDay);
                    // Recompute derived helpers
                    userProgress.completedDays = userProgress.completed_days.length;
                    userProgress.currentStreak = userProgress.level_info?.current_streak || 0;
                    userProgress.totalDays = userProgress.level_info?.total_days || 0;
                    userProgress.longestStreak = userProgress.level_info?.longest_streak || 0;
            }
            
            // Store updated progress in localStorage
            localStorage.setItem('userProgress', JSON.stringify(userProgress));
            
            // Update UI immediately
            updateProgressUI();
            updateCalendarHighlighting();
            
            // Reload progress from database to get fresh data
            setTimeout(async () => {
                await loadUserProgress();
            }, 1000);
            
            // Show level up notification if applicable
            if (data.level_info.current_level > 1) {
                showLevelUpNotification(data.level_info.current_level);
            }
        } else {
            showNotification(data.message, 'warning');
            
            // Re-enable button if already completed
            if (button) {
                button.innerHTML = '✅ Выполнено';
                button.style.background = 'rgba(40, 167, 69, 0.6)';
                button.style.cursor = 'default';
                button.onclick = null;
            }
        }
        
    } catch (error) {
        console.error('Failed to mark day as completed:', error);
        showNotification('Ошибка при сохранении прогресса', 'error');
        
        // Re-enable button on error
        const button = document.querySelector(`button[onclick="markDayCompleted(${programId}, ${dayIndex})"]`);
        if (button) {
            button.disabled = false;
            button.innerHTML = '✅ Отметить выполненным';
            button.style.opacity = '1';
        }
    }
}

// Update progress UI elements
function updateProgressUI() {
    if (!userProgress) {
        console.log('No user progress data available');
        return;
    }

    console.log('Updating progress UI with data:', userProgress);

    // Update progress tab if it exists
    const progressTab = document.getElementById('progress-content');
    if (progressTab) {
        console.log('Updating progress tab');
        updateProgressTab();
    } else {
        console.log('Progress tab not found');
    }

    // Update calendar if it exists
    updateCalendar();
}

// Update progress tab content
function updateProgressTab() {
    const progressTab = document.getElementById('progress-content');
    if (!progressTab) return;

    // If no progress data, show empty state
    if (!userProgress || !userProgress.level_info) {
        progressTab.innerHTML = `
            <div class="progress-stats">
                <div class="stat-card">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-content">
                        <div class="stat-value">1</div>
                        <div class="stat-label">Текущий уровень</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">📅</div>
                    <div class="stat-content">
                        <div class="stat-value">0</div>
                        <div class="stat-label">Всего дней</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">🔥</div>
                    <div class="stat-content">
                        <div class="stat-value">0</div>
                        <div class="stat-label">Текущая серия</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-content">
                        <div class="stat-value">0</div>
                        <div class="stat-label">Лучшая серия</div>
                    </div>
                </div>
            </div>
            
            <div class="progress-calendar">
                <h3>Календарь активности</h3>
                <div id="progress-calendar-grid" class="calendar-grid">
                    <!-- Calendar will be generated here -->
                </div>
            </div>
        `;
        generateProgressCalendar();
        return;
    }

    const levelInfo = userProgress.level_info;
    
    progressTab.innerHTML = `
        <div class="progress-stats">
            <div class="stat-card">
                <div class="stat-icon">🏆</div>
                <div class="stat-content">
                    <div class="stat-value">${levelInfo.current_level}</div>
                    <div class="stat-label">Текущий уровень</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-content">
                    <div class="stat-value">${levelInfo.total_days}</div>
                    <div class="stat-label">Всего дней</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">🔥</div>
                <div class="stat-content">
                    <div class="stat-value">${levelInfo.current_streak}</div>
                    <div class="stat-label">Текущая серия</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <div class="stat-content">
                    <div class="stat-value">${levelInfo.longest_streak}</div>
                    <div class="stat-label">Лучшая серия</div>
                </div>
            </div>
        </div>
        
        <div class="progress-calendar">
            <h3>Календарь активности</h3>
            <div id="progress-calendar-grid" class="calendar-grid">
                <!-- Calendar will be generated here -->
            </div>
        </div>
    `;
    
    // Generate calendar
    generateProgressCalendar();
}

// Generate progress calendar
function generateProgressCalendar() {
    const calendarGrid = document.getElementById('progress-calendar-grid');
    if (!calendarGrid || !userProgress) return;

    const today = new Date();
    const currentMonth = today.getUTCMonth();
    const currentYear = today.getUTCFullYear();

    // Get first day of month and number of days (UTC-based)
    const firstDay = new Date(Date.UTC(currentYear, currentMonth, 1));
    const lastDay = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
    const daysInMonth = lastDay.getUTCDate();
    const startDayOfWeek = firstDay.getUTCDay();

    // Create completed days set for quick lookup (UTC-based)
    const completedDays = new Set();
    if (userProgress.completed_days) {
        userProgress.completed_days.forEach(day => {
            const completedUtc = getCompletedDayUtc(day);
            if (!completedUtc) return;
            const [yearStr, monthStr, dayStr] = completedUtc.split('-');
            const yearNum = parseInt(yearStr, 10);
            const monthNum = parseInt(monthStr, 10) - 1;
            const dayNum = parseInt(dayStr, 10);
            if (yearNum === currentYear && monthNum === currentMonth) {
                completedDays.add(dayNum);
            }
        });
    }
    
    // Generate calendar HTML
    let calendarHTML = '';
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
    }
    
    // Add days of month
    const todayUtcDay = today.getUTCDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const isCompleted = completedDays.has(day);
        const isToday = day === todayUtcDay;
        const dayClass = `calendar-day ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}`;
        
        calendarHTML += `<div class="${dayClass}">${day}</div>`;
    }
    
    calendarGrid.innerHTML = calendarHTML;
}

// Update main calendar
function updateCalendar() {
    // This will be called when calendar is implemented
    console.log('Calendar update requested');
}

// Update calendar highlighting for completed days
function updateCalendarHighlighting() {
    if (!userProgress || !userProgress.completed_days) return;
    
    const todayUtc = getTodayUtcDateString();
    const completedTodayKeys = new Set();
    const completedEverKeys = new Set();

    userProgress.completed_days.forEach(day => {
        if (day?.program_id == null || day?.day_index == null) return;
        const key = `${day.program_id}:${day.day_index}`;
        completedEverKeys.add(key);

        const dayUtc = getCompletedDayUtc(day);
        if (dayUtc === todayUtc) {
            completedTodayKeys.add(key);
        }
    });

    // Find all day buttons in the calendar
    const dayButtons = document.querySelectorAll('.day-button');
    
    dayButtons.forEach(button => {
        const onclick = button.getAttribute('onclick');
        if (onclick) {
            // Extract programId and dayIndex from onclick
            const match = onclick.match(/openExerciseModule\('(\d+)',\s*(\d+)\)/);
            if (match) {
                const programId = parseInt(match[1]);
                const dayIndex = parseInt(match[2]);
                const key = `${programId}:${dayIndex}`;
                const isCompletedEver = completedEverKeys.has(key);

                if (isCompletedEver) {
                    button.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                    button.style.color = 'white';
                    button.style.borderColor = '#28a745';
                    button.innerHTML = `День ${dayIndex} ✅`;
                } else {
                    button.style.background = 'white';
                    button.style.color = '#007bff';
                    button.style.borderColor = '#007bff';
                    button.innerHTML = `День ${dayIndex}`;
                }
            }
        }
    });
}

// Show level up notification
function showLevelUpNotification(newLevel) {
    const notification = document.createElement('div');
    notification.className = 'level-up-notification';
    notification.innerHTML = `
        <div class="level-up-content">
            <div class="level-up-icon">🎉</div>
            <div class="level-up-text">
                <h3>Поздравляем!</h3>
                <p>Вы достигли ${newLevel} уровня!</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Check if any day is already completed today
function isDayCompletedToday(programId, dayIndex) {
    if (!userProgress || !userProgress.completed_days) return false;
    
    const todayUtc = getTodayUtcDateString();

    // Check if ANY day was completed today (not just this specific day)
    return userProgress.completed_days.some(day => 
        getCompletedDayUtc(day) === todayUtc
    );
}

// Show notification function
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
            </div>
            <div class="notification-message">${message}</div>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : type === 'warning' ? '#856404' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : '#bee5eb'};
        border-radius: 10px;
        padding: 15px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 4000);
}

// Setup event listeners
function setupEventListeners() {
    // Calendar day clicks
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('calendar-day')) {
            toggleDayCompletion(e.target);
        }
    });
    
    // ESC key support for closing modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // Click-outside-to-close handler for modals
    ['program-modal', 'exercise-modal'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', (e) => {
            if (e.target === el) {
                if (id === 'exercise-modal') closeExerciseModal();
                if (id === 'program-modal') closeProgramModal();
            }
        });
    });

    // Live preview avatar change when gender changes in Profile
    const genderField = document.getElementById('user-gender');
    if (genderField) {
        genderField.addEventListener('change', () => {
            userProfile = userProfile || {};
            userProfile.gender = genderField.value || '';
            try { updateProgressDisplay(); } catch (_) {}
        });
    }
}

// Navigation functions
function navigateToSection(sectionName) {
    console.log('Navigating to section:', sectionName);
    console.log('Available sections:', ['home', 'diagnosis', 'exercises', 'profile']);
    
    // Stop all videos when navigating between sections
    stopAllVideos();
    
    // Log current active sections before change
    const currentActiveSections = document.querySelectorAll('.section.active');
    console.log('Current active sections before change:', Array.from(currentActiveSections).map(s => s.id));
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
        console.log('Section activated:', sectionName);
        
        // If navigating to progress section, update it
        if (sectionName === 'progress') {
            console.log('Updating progress section');
            updateProgressUI();
        }
        
        // If navigating to profile section, update it
        if (sectionName === 'profile') {
            console.log('Updating profile section');
            // Load profile if not already loaded
            if (!userProfile && user?.id) {
                loadUserProfile();
            } else {
                populateProfileForm();
            }
        }

        // Always refresh access UI when switching sections (paywall overlay)
        try { updateAccessUI(); } catch (_) {}
    } else {
        console.error('Section not found:', sectionName);
    }
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const navItem = document.querySelector(`[data-section="${sectionName}"]`);
    if (navItem) {
        navItem.classList.add('active');
        console.log('Nav item activated:', sectionName);
    } else {
        console.error('Nav item not found for section:', sectionName);
    }
    
    // Log final state
    const finalActiveSections = document.querySelectorAll('.section.active');
    console.log('Final active sections:', Array.from(finalActiveSections).map(s => s.id));
    
    // Apply dynamic scaling when navigating to home section
    if (sectionName === 'home') {
        updateAdaptiveScale();
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
    
    // Load section-specific content
    if (sectionName === 'home') {
        initializeHomepage();
    } else if (sectionName === 'exercises') {
        loadPrograms();
        // Картинки в сетке имеют loading="lazy" и рендерятся при скрытом блоке — браузер их не грузит.
        // После показа раздела принудительно запускаем загрузку обложек.
        setTimeout(function() {
            const grid = document.getElementById('programs-grid');
            if (grid) {
                grid.querySelectorAll('img.program-image[src]').forEach(function(img) {
                    var src = img.src;
                    if (src && !img.complete) {
                        img.src = '';
                        img.src = src;
                    }
                });
            }
        }, 300);
    } else if (sectionName === 'reports') {
        updateCalendar();
        updateProgressStats();
    }
}

// Calendar functions
function updateCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Update month display
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    const currentMonthElement = document.getElementById('current-month');
    if (currentMonthElement) {
        currentMonthElement.textContent = `${monthNames[month]} ${year}`;
    }
    
    // Generate calendar grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        dayHeader.style.fontWeight = 'bold';
        dayHeader.style.color = '#6c757d';
        calendarGrid.appendChild(dayHeader);
    });
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDay - 1; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        dayElement.dataset.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Check if this day is completed (based on completed_days)
        const dayDate = new Date(year, month, day);
        if (isDayCompleted(dayDate)) {
            dayElement.classList.add('completed');
        }
        
        // Check if this is today
        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            dayElement.classList.add('today');
        }
        
        calendarGrid.appendChild(dayElement);
    }
}

function changeMonth(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    updateCalendar();
}

function toggleDayCompletion(dayElement) {
    // Disable legacy local toggling to avoid corrupting structured userProgress
    // Visual toggle only
    const isCompleted = dayElement.classList.contains('completed');
    if (isCompleted) {
        dayElement.classList.remove('completed');
    } else {
        dayElement.classList.add('completed');
    }
    updateProgressStats();
}

function updateProgressStats() {
    const completedDays = Array.isArray(userProgress?.completed_days) ? userProgress.completed_days.length : (userProgress?.completedDays || 0);
    const completedDaysEl = document.getElementById('completed-days');
    if (completedDaysEl) {
        completedDaysEl.textContent = completedDays;
    }
    
    // Calculate current streak
    const today = new Date();
    let streak = 0;
    let checkDate = new Date(today);
    const completedSet = new Set(
        Array.isArray(userProgress?.completed_days)
            ? userProgress.completed_days.map(d => new Date(d.completed_at).toDateString())
            : []
    );
    while (completedSet.has(checkDate.toDateString())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    const currentStreakEl = document.getElementById('current-streak');
    if (currentStreakEl) {
        currentStreakEl.textContent = streak;
    }
}

// Programs data
async function loadPrograms() {
    console.log('[Load] Loading programs...');
    
    // Try cache first
    const cachedPrograms = getCacheData(CACHE_KEYS.PROGRAMS);
    if (cachedPrograms) {
        console.log('[Load] Using cached programs:', cachedPrograms.length);
        programs = cachedPrograms;
        renderPrograms();
        return;
    }
    
    // Load from Supabase if no cache
    console.log('[Load] Loading from Supabase...');
    if (supabaseClient) {
        try {
            await loadProgramsFromSupabase();
        } catch (error) {
            console.error('Failed to load programs from Supabase:', error);
            showToast('Ошибка загрузки программ. Используются локальные данные.', 'error');
    loadDefaultPrograms();
        }
    } else {
        console.log('[Load] Supabase not available, loading default programs');
        loadDefaultPrograms();
    }
    console.log('[Load] Programs loaded:', programs.length);
    renderPrograms();
}

// Load programs from Supabase
async function loadProgramsFromSupabase() {
    if (!supabaseClient) return;
    
    console.log('Loading programs from Supabase...');
    
    // Load published programs only (lazy loading - no days/exercises yet)
    const { data: programsData, error: programsError } = await supabaseClient
        .from('programs')
        .select('*')
        .eq('is_published', true)
        .order('id');
    
    if (programsError) {
        throw new Error(`Failed to load programs: ${programsError.message}`);
    }
    
    // Store programs in cache
    setCacheData(CACHE_KEYS.PROGRAMS, programsData);
    programs = programsData;
    console.log('Programs loaded from Supabase:', programs.length);
}

// Lazy load days for a specific program
async function loadProgramDays(programId) {
    const cacheKey = `${CACHE_KEYS.PROGRAM_DAYS}_${programId}`;
    
    // Try cache first
    const cachedDays = getCacheData(cacheKey);
    if (cachedDays) {
        console.log(`[Load] Using cached days for program ${programId}`);
        return cachedDays;
    }
    
    // Load from Supabase
    if (!supabaseClient) return [];
    
    try {
        console.log(`Loading days for program ${programId}...`);
        const { data: daysData, error: daysError } = await supabaseClient
            .from('program_days')
            .select('*')
            .eq('program_id', programId)
            .order('day_index');
        
        if (daysError) {
            throw new Error(`Failed to load days: ${daysError.message}`);
        }
        
        // Store in cache
        setCacheData(cacheKey, daysData);
        console.log(`Loaded ${daysData.length} days for program ${programId}`);
        return daysData;
    } catch (error) {
        console.error(`Failed to load days for program ${programId}:`, error);
        return [];
    }
}

// Lazy load exercises for a specific day
async function loadDayExercises(dayId) {
    const cacheKey = `${CACHE_KEYS.EXERCISES}_${dayId}`;
    
    // Try cache first
    const cachedExercises = getCacheData(cacheKey);
    if (cachedExercises) {
        console.log(`[Load] Using cached exercises for day ${dayId}`);
        return cachedExercises;
    }
    
    // Load from Supabase
    if (!supabaseClient) return [];
    
    try {
        console.log(`Loading exercises for day ${dayId}...`);
        const { data: exercisesData, error: exercisesError } = await supabaseClient
            .from('exercises')
            .select('*')
            .eq('program_day_id', dayId)
            .order('order_index');
        
        if (exercisesError) {
            throw new Error(`Failed to load exercises: ${exercisesError.message}`);
        }
        
        // Store in cache
        setCacheData(cacheKey, exercisesData);
        console.log(`Loaded ${exercisesData.length} exercises for day ${dayId}`);
        return exercisesData;
    } catch (error) {
        console.error(`Failed to load exercises for day ${dayId}:`, error);
        return [];
    }
}

function loadDefaultPrograms() {
    programs = DEFAULT_PROGRAMS;
}

function generateExerciseProgram(programType) {
    const days = [];
    const exerciseTypes = {
        'Плечевой пояс': ['Жим гантелей', 'Разведение гантелей', 'Подъемы в стороны', 'Отжимания', 'Планка', 'Берпи'],
        'Спина': ['Подтягивания', 'Тяга гантелей', 'Гиперэкстензия', 'Планка', 'Супермен', 'Лодочка'],
        'Пресс': ['Скручивания', 'Планка', 'Велосипед', 'Подъемы ног', 'Русские скручивания', 'Горный альпинист'],
        'Ноги': ['Приседания', 'Выпады', 'Прыжки', 'Планка', 'Ягодичный мостик', 'Подъемы на носки'],
        'Кардио': ['Берпи', 'Прыжки', 'Бег на месте', 'Планка', 'Горный альпинист', 'Высокие колени'],
        'Гибкость': ['Растяжка плеч', 'Наклоны', 'Повороты', 'Планка', 'Кошка-корова', 'Детская поза'],
        'Сила': ['Приседания', 'Отжимания', 'Планка', 'Выпады', 'Подтягивания', 'Жим гантелей'],
        'Восстановление': ['Растяжка', 'Дыхательные упражнения', 'Медитация', 'Планка', 'Йога', 'Релаксация']
    };
    
    const programExercises = exerciseTypes[programType] || exerciseTypes['Пресс'];
    
    for (let dayIndex = 1; dayIndex <= 10; dayIndex++) {
        const exercises = [];
        for (let orderIndex = 0; orderIndex < 6; orderIndex++) {
            const exerciseIndex = (dayIndex - 1) * 6 + orderIndex;
            const exerciseName = programExercises[exerciseIndex % programExercises.length];
            
            exercises.push({
                order_index: orderIndex + 1,
                title: exerciseName,
                video_url: `https://www.youtube.com/embed/dQw4w9WgXcQ`,
                description: `Подробное описание упражнения "${exerciseName}" для ${programType.toLowerCase()}. Выполняйте медленно и контролируемо, следите за дыханием.`
            });
        }
        days.push({
            day_index: dayIndex,
            exercises: exercises
        });
    }
    
    return days;
}

function renderPrograms() {
    console.log('[Render] Rendering programs...');
    const programsGrid = document.getElementById('programs-grid');
    if (!programsGrid) {
        console.error('[Render] programs-grid element not found!');
        return;
    }
    
    programsGrid.innerHTML = '';
    
    // Only show published programs in public view
    const publishedPrograms = programs.filter(program => program.is_published);
    console.log('[Render] Published programs:', publishedPrograms.length);
    
    publishedPrograms.forEach(program => {
        const programCard = document.createElement('div');
        programCard.className = 'program-card';
        const imageUrl = escapeHTML(program.image_url || '');
        const title = escapeHTML(program.title || '');
        const description = escapeHTML(program.description || '');
        
        programCard.innerHTML = `
            <img src="${imageUrl}" alt="${title}" class="program-image" loading="lazy" decoding="async">
            <div class="program-content">
                <h3 class="program-title">${title}</h3>
                <p class="program-description">${description}</p>
            </div>
        `;
        
        programCard.addEventListener('click', () => openProgramModal(program));
        programsGrid.appendChild(programCard);
    });
}

// Modal functions
function openProgramModal(program) {
    console.log('Opening program modal for:', program.title);
    const modal = document.getElementById('program-modal');
    const modalBody = document.getElementById('program-modal-body');
    
    if (modal && modalBody) {
        // Don't show days count since we're using lazy loading
        const imageUrl = escapeHTML(program.image_url || '');
        const title = escapeHTML(program.title || '');
        const description = escapeHTML(program.description || '');
        const programId = escapeHTML(program.id);
        
        modalBody.innerHTML = `
            <div class="program-detail">
                <img src="${imageUrl}" alt="${title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px; margin-bottom: 20px;" loading="lazy" decoding="async">
                <h2 style="color: #2c3e50; margin-bottom: 15px; font-size: 20px;">${title}</h2>
                <p style="color: #6c757d; margin-bottom: 25px; line-height: 1.6;">${description}</p>
                <p style="color: #007bff; font-weight: 600; margin-bottom: 25px;">Нажмите "Выбрать программу" для просмотра дней</p>
                <button class="cta-button" onclick="openDaySelection('${program.id}')" style="width: 100%;">
                    Выбрать программу
                </button>
            </div>
        `;
        
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.zIndex = '9999';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.background = 'rgba(0,0,0,0.5)';
        document.body.style.overflow = 'hidden';
    } else {
        console.error('Modal elements not found');
    }
}

function closeProgramModal() {
    console.log('Closing program modal');
    stopAllVideos(); // Stop all videos when closing modal
    const modal = document.getElementById('program-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Day selection function
async function openDaySelection(programId) {
    console.log('Opening day selection for program:', programId);
    
    try {
        let program;
        
        if (supabaseClient) {
            // Convert programId to number for comparison
            const programIdNum = parseInt(programId);
            console.log('Looking for program ID:', programIdNum, 'in programs:', programs.map(p => p.id));
            
            // Find program in cached data
            program = programs.find(p => p.id === programIdNum);
    if (!program) {
                // Try to reload programs if not found in cache
                console.log('Program not found in cache, reloading...');
                await loadProgramsFromSupabase();
                program = programs.find(p => p.id === programIdNum);
                if (!program) throw new Error(`Program with ID ${programIdNum} not found`);
            }
            
            // Lazy load days
            const daysData = await loadProgramDays(programIdNum);
            program.days = daysData;
        } else {
            // Fallback to local data
            const programIdNum = parseInt(programId);
            program = programs.find(p => p.id === programIdNum);
            if (!program) throw new Error('Program not found');
        }
        
        closeProgramModal();
        
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        // Show loading indicator
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 18px; color: #6c757d; margin-bottom: 20px;">Загружаем дни программы...</div>
                <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        modal.style.display = 'flex !important';
        document.body.style.overflow = 'hidden';
        
        if (modal && modalBody) {
            let daysHTML = `
                <div class="day-selection">
                    <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center; font-size: 20px;">${program.title}</h2>
                    <p style="color: #6c757d; margin-bottom: 30px; text-align: center;">Выберите день тренировки</p>
                    <div class="days-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 15px; margin-bottom: 20px;">
            `;
            
            for (let i = 1; i <= program.days.length; i++) {
                daysHTML += `
                    <button class="day-button" onclick="openExerciseModule('${programId}', ${i})" 
                            style="padding: 15px; border: 2px solid #007bff; background: white; color: #007bff; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                        День ${i}
                    </button>
                `;
            }
            
            daysHTML += `
                    </div>
                    <button class="btn btn-secondary" onclick="openProgramModal(${JSON.stringify(program).replace(/"/g, '&quot;')})" style="width: 100%;">
                        ← Назад к программе
                    </button>
                </div>
            `;
            
            modalBody.innerHTML = daysHTML;
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            
            // Update calendar highlighting after modal is shown
            setTimeout(() => {
                updateCalendarHighlighting();
            }, 100);
        } else {
            console.error('Modal elements not found');
        }
    } catch (error) {
        console.error('Failed to open day selection:', error);
        showToast('Ошибка загрузки дней: ' + error.message, 'error');
    }
}

async function openExerciseModule(programId, dayIndex = 1) {
    console.log('Opening exercise module for program:', programId, 'day:', dayIndex);
    
    try {
        let program, day, exercises;
        
        if (supabaseClient) {
            // Convert programId to number for comparison
            const programIdNum = parseInt(programId);
            
            // Find program in cached data
            program = programs.find(p => p.id === programIdNum);
            if (!program) throw new Error('Program not found');
            
            // Lazy load days if not already loaded
            if (!program.days) {
                program.days = await loadProgramDays(programIdNum);
            }
            
            // Find the specific day
            day = program.days.find(d => d.day_index === dayIndex);
            if (!day) throw new Error(`Day ${dayIndex} not found`);
            
            // Lazy load exercises for this day
            exercises = await loadDayExercises(day.id);
        } else {
            // Fallback to local data
            const programIdNum = parseInt(programId);
            program = programs.find(p => p.id === programIdNum);
            if (!program) throw new Error('Program not found');
            day = program.days.find(d => d.day_index === dayIndex);
            if (!day) throw new Error('Day not found');
            exercises = day.exercises;
    }
    
    closeProgramModal();
    
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    
    if (modal && modalBody) {
        let exercisesHTML = `
            <div class="exercise-module">
                <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center; font-size: 20px;">${program.title}</h2>
                    <p style="color: #6c757d; margin-bottom: 30px; text-align: center;">День ${dayIndex} - ${exercises.length} упражнений</p>
            `;
            
            exercises.forEach((exercise, index) => {
                // Check video URL and convert to appropriate format
                let videoHTML = '';
                if (exercise.video_url) {
                    if (exercise.video_url.includes('youtube.com/watch') || exercise.video_url.includes('youtu.be/')) {
                        // YouTube URL - convert to embed
                        let videoId = '';
                        if (exercise.video_url.includes('youtube.com/watch')) {
                            videoId = exercise.video_url.split('v=')[1]?.split('&')[0];
                        } else if (exercise.video_url.includes('youtu.be/')) {
                            videoId = exercise.video_url.split('youtu.be/')[1]?.split('?')[0];
                        }
                        if (videoId) {
                            videoHTML = `<iframe class="exercise-video" data-src="https://www.youtube.com/embed/${videoId}" loading="lazy" frameborder="0" allowfullscreen></iframe>`;
                        } else {
                            videoHTML = `<a href="${exercise.video_url}" target="_blank" class="video-link" style="display: block; padding: 20px; background: #f8f9fa; border-radius: 10px; text-align: center; color: #007bff; text-decoration: none; font-weight: 600;">📹 Открыть видео</a>`;
                        }
                    } else if (exercise.video_url.includes('youtube.com/embed')) {
                        // Already embed format
                        videoHTML = `<iframe class="exercise-video" data-src="${exercise.video_url}" loading="lazy" frameborder="0" allowfullscreen></iframe>`;
                    } else if (exercise.video_url.includes('getcourse.ru') || exercise.video_url.includes('fs.getcourse.ru')) {
                        // GetCourse video - try multiple embedding methods
                        let embedUrl = '';
                        
                        // Method 1: Try to convert download URL to embed URL
                        if (exercise.video_url.includes('/download/')) {
                            embedUrl = exercise.video_url.replace('/download/', '/embed/');
                        } else {
                            embedUrl = exercise.video_url;
                        }
                        
                        // Method 2: Try direct video file embedding
                        const isVideoFile = exercise.video_url.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i);
                        
                        if (isVideoFile) {
                            // Direct video file - native controls, no custom overlay
                            videoHTML = `
                                <div class="getcourse-video-container" style="margin: 10px 0; position: relative;">
                                    <video class="exercise-video"
                                           controls
                                           preload="metadata"
                                           style="width: 100%; max-width: 100%; height: 200px; border-radius: 10px;"
                                           playsinline
                                           webkit-playsinline
                                           allowfullscreen
                                           webkitallowfullscreen
                                           mozallowfullscreen
                                           msallowfullscreen
                                           muted
                                           crossorigin="anonymous"
                                           data-auto-poster="true"
                                           data-video-src="${exercise.video_url}"
                                           onloadedmetadata="this.requestFullscreen = this.requestFullscreen || this.webkitRequestFullscreen || this.mozRequestFullScreen || this.msRequestFullscreen;"
                                           ondoubleclick="if(this.requestFullscreen) this.requestFullscreen();">
                                        <source src="${exercise.video_url}" type="video/mp4">
                                        <source src="${exercise.video_url}" type="video/webm">
                                        <source src="${exercise.video_url}" type="video/ogg">
                                        Ваш браузер не поддерживает видео.
                                    </video>
                                </div>
                            `;
                        } else {
                            // Try iframe embedding
                            videoHTML = `
                                <div class="getcourse-video-container" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; border-radius: 10px; overflow: hidden;">
                                    <iframe class="exercise-video" 
                                            data-src="${embedUrl}" loading="lazy"
                                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; background: transparent;" 
                                            frameborder="0" 
                                            allowfullscreen
                                            webkitallowfullscreen
                                            mozallowfullscreen
                                            msallowfullscreen
                                            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                    </iframe>
                                    <div style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #f8f9fa; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                                        <p style="margin: 0 0 10px 0; color: #6c757d;">Видео недоступно для встраивания</p>
                                        <a href="${exercise.video_url}" target="_blank" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Открыть видео</a>
                                    </div>
                                </div>
                            `;
                        }
                    } else if (exercise.video_url.includes('vimeo.com')) {
                        // Vimeo URL - convert to embed
                        const videoId = exercise.video_url.split('vimeo.com/')[1]?.split('?')[0];
                        if (videoId) {
                            videoHTML = `<iframe class="exercise-video" data-src="https://player.vimeo.com/video/${videoId}" loading="lazy" frameborder="0" allowfullscreen></iframe>`;
                        } else {
                            videoHTML = `<a href="${exercise.video_url}" target="_blank" class="video-link" style="display: block; padding: 20px; background: #f8f9fa; border-radius: 10px; text-align: center; color: #007bff; text-decoration: none; font-weight: 600;">📹 Открыть видео</a>`;
                        }
                    } else {
                        // Other video platforms - show as link
                        videoHTML = `<a href="${exercise.video_url}" target="_blank" class="video-link" style="display: block; padding: 20px; background: #f8f9fa; border-radius: 10px; text-align: center; color: #007bff; text-decoration: none; font-weight: 600;">📹 Открыть видео</a>`;
                    }
                }
                
                exercisesHTML += `
                    <div class="exercise-item">
                        <div class="exercise-title">${exercise.order_index}. ${exercise.title}</div>
                        ${videoHTML}
                        <div class="exercise-description">${exercise.description}</div>
                    </div>
                `;
        });
        
        exercisesHTML += `</div>`;
        
        // Add completion button
        const isCompleted = isDayCompletedToday(programId, dayIndex);
        const completionButton = isCompleted 
            ? `<div class="completion-status" style="text-align: center; margin: 30px 0 20px 0; padding: 15px; background: #d4edda; color: #155724; border-radius: 25px; border: 1px solid #c3e6cb;">
                <div style="font-size: 24px; margin-bottom: 10px;">✅</div>
                <div style="font-weight: 600;">День выполнен!</div>
                <div style="font-size: 14px; margin-top: 5px;">Вы уже отметили день как выполненный сегодня</div>
               </div>`
            : `<div class="completion-actions" style="text-align: center; margin: 30px 0 20px 0;">
                <button class="btn btn-success glass-button" onclick="markDayCompleted(${programId}, ${dayIndex})" 
                        style="padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 25px; background: rgba(40, 167, 69, 0.8); color: white; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(40, 167, 69, 0.3);">
                    ✅ Отметить выполненным
                </button>
               </div>`;
        
        exercisesHTML += completionButton;
        
        modalBody.innerHTML = exercisesHTML;
        initializeAutoVideoPosters(modalBody);
            modal.classList.remove('hidden');
        modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        
        // Lazy-load iframes: move data-src -> src when visible
        setupLazyMediaLoading();
    } else {
        console.error('Exercise modal elements not found');
        }
    } catch (error) {
        console.error('Failed to open exercise module:', error);
        showToast('Ошибка загрузки упражнений: ' + error.message, 'error');
    }
}

function closeExerciseModal() {
    console.log('Closing exercise modal');
    stopAllVideos(); // Stop all videos when closing modal
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Stop all videos function
function stopAllVideos() {
    console.log('Stopping all videos...');
    
    // Stop all HTML5 video elements
    document.querySelectorAll('video').forEach(video => {
        try {
            if (!video.paused) {
                video.pause();
                video.currentTime = 0; // Reset to beginning
                console.log('Stopped HTML5 video');
            }
        } catch (e) {
            console.log('Error stopping HTML5 video:', e.message);
        }
    });
    
    // Stop all iframe videos (YouTube, Vimeo, etc.)
    document.querySelectorAll('iframe').forEach(iframe => {
        try {
            // For YouTube videos
            if (iframe.src.includes('youtube.com') || iframe.src.includes('youtu.be')) {
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                console.log('Sent pause command to YouTube video');
            }
            // For Vimeo videos
            if (iframe.src.includes('vimeo.com')) {
                iframe.contentWindow.postMessage('{"method":"pause"}', '*');
                console.log('Sent pause command to Vimeo video');
            }
            // For Kinoscope videos
            if (iframe.src.includes('kinescope.io')) {
                iframe.contentWindow.postMessage('{"method":"pause"}', '*');
                console.log('Sent pause command to Kinoscope video');
            }
        } catch (e) {
            // Ignore cross-origin errors
            console.log('Cannot control iframe video:', e.message);
        }
    });
    
    // Additional method: remove iframe src to force stop
    document.querySelectorAll('iframe.exercise-video').forEach(iframe => {
        try {
            const currentSrc = iframe.src;
            if (currentSrc) {
                iframe.src = 'about:blank';
                console.log('Removed iframe src to stop video');
                // Restore src after a short delay to allow proper cleanup
                setTimeout(() => {
                    iframe.src = currentSrc;
                }, 100);
            }
        } catch (e) {
            console.log('Error removing iframe src:', e.message);
        }
    });
    
    // Nuclear option: completely remove and recreate iframe elements
    document.querySelectorAll('iframe.exercise-video').forEach(iframe => {
        try {
            const parent = iframe.parentElement;
            if (parent) {
                const newIframe = iframe.cloneNode(true);
                newIframe.src = 'about:blank';
                parent.replaceChild(newIframe, iframe);
                console.log('Replaced iframe to force stop');
            }
        } catch (e) {
            console.log('Error replacing iframe:', e.message);
        }
    });
}

// Close all modals function
function closeAllModals() {
    console.log('Closing all modals...');
    stopAllVideos(); // Stop all videos when closing modals
    closeProgramModal();
    closeExerciseModal();
    // Hide subscription overlay if visible
    const subOverlay = document.getElementById('subscription-overlay');
    if (subOverlay && !subOverlay.classList.contains('hidden')) {
        subOverlay.classList.add('hidden');
        subOverlay.style.display = 'none';
    }
    document.body.style.overflow = '';
}

// Kill all modals - emergency reset function for dev testing
function killAllModals() {
    document.querySelectorAll('.modal, .overlay').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    document.body.style.overflow = '';
    console.log('✅ All modals/overlays hidden.');
}

// Profile functions
function saveProfile() {
    console.log('Saving profile...');
    const name = document.getElementById('user-name').value;
    const birthdate = document.getElementById('user-birthdate').value;
    const problem = document.getElementById('user-problem').value;
    
    if (!name.trim()) {
        alert('Пожалуйста, введите ваше имя');
        return;
    }
    
    userProfile = {
        name: name.trim(),
        birthdate: birthdate,
        problem: problem
    };
    
    // Save locally only
    SafeStorage.setItem('userProfile', JSON.stringify(userProfile));
    Logger.log('Profile saved to localStorage:', userProfile);
    
    // Show success message
    const button = document.querySelector('.save-button');
    if (button) {
        const originalText = button.textContent;
        button.textContent = 'Сохранено!';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    }

    // Update access UI in case local-only profile is used
    try { updateAccessUI(); } catch (_) {}
}

// Load user data
function loadUserData() {
    // Load saved profile data
    if (userProfile && userProfile.name) {
        document.getElementById('user-name').value = userProfile.name;
    }
    if (userProfile && userProfile.birthdate) {
        document.getElementById('user-birthdate').value = userProfile.birthdate;
    }
    if (userProfile && userProfile.problem) {
        document.getElementById('user-problem').value = userProfile.problem;
    }
    
    // Set default subscription
    checkSubscription();

    // Dev-only debug line in Profile
    const urlParams = new URLSearchParams(window.location.search);
    const debugEl = document.getElementById('dev-debug-line');
    if (debugEl) {
        if (urlParams.get('dev') === '1') {
            const initDataUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
            debugEl.style.display = 'block';
            debugEl.textContent = `Debug: tg_user_id=${initDataUserId || 'n/a'}, is_editor=${isEditor}`;
        } else {
            debugEl.style.display = 'none';
        }
    }
}

// Subscription management
function checkSubscription() {
    // Set default subscription for 30 days
    const subscriptionDate = new Date();
    subscriptionDate.setDate(subscriptionDate.getDate() + 30);
    
    const subscriptionDateEl = document.getElementById('subscription-date');
    if (subscriptionDateEl) {
        subscriptionDateEl.textContent = subscriptionDate.toLocaleDateString('ru-RU');
    }
}

function showSubscriptionOverlay() {
    document.getElementById('subscription-overlay').classList.remove('hidden');
}

function renewSubscription() {
    // In real app, this would redirect to payment or show payment form
    alert('Функция продления подписки будет доступна в полной версии приложения');
    document.getElementById('subscription-overlay').classList.add('hidden');
}

// Developer Access functionality
function openDeveloperAccess() {
    console.log('Opening developer access...');
    if (isEditor) {
        showDeveloperPanel();
    } else {
        console.log('User is not an editor');
        showToast('Нет доступа к режиму разработчика', 'error');
    }
}

// Developer panel functions
function showDeveloperPanel() {
    console.log('Showing developer panel...');
    const panel = document.getElementById('developer-panel');
    if (!panel) return;
  
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  
    // Show panel and make it active section
    panel.classList.remove('hidden');
    panel.classList.add('active');
    
    // Reset header to normal state
    const header = panel.querySelector('.developer-header');
    if (header) {
        header.innerHTML = `
            <h2>Редактор контента</h2>
            <button class="close-dev-panel" onclick="closeDeveloperPanel()">&times;</button>
        `;
    }
    
    // Show tabs and content
    const tabs = panel.querySelector('.developer-tabs');
    if (tabs) tabs.style.display = 'flex';
    
    // Setup tab click handlers
    setupDeveloperTabs();
    
    // Load initial content
    loadDeveloperContent();
  
    window.scrollTo(0, 0);
}

function closeDeveloperPanel() {
    const panel = document.getElementById('developer-panel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.classList.remove('active');
    // Return to home
    document.getElementById('home')?.classList.add('active');
}

// Setup developer tab handlers
function setupDeveloperTabs() {
    const tabs = document.querySelectorAll('.dev-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab contents
            document.querySelectorAll('.dev-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show selected tab content
            const targetContent = document.getElementById(tabId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            console.log('Switched to tab:', tabId);
        });
    });
}

function loadDeveloperContent() {
    // Load home content
    const homeContent = {
        hero_image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        headline: 'Здоровое тело',
        greeting: 'Добро пожаловать в ваше путешествие к здоровому образу жизни!',
        cta_text: 'Перейти к упражнениям'
    };
    
    const heroImageEl = document.getElementById('dev-hero-image');
    const headlineEl = document.getElementById('dev-headline');
    const greetingEl = document.getElementById('dev-greeting');
    const ctaEl = document.getElementById('dev-cta');
    
    if (heroImageEl) heroImageEl.value = homeContent.hero_image_url;
    if (headlineEl) headlineEl.value = homeContent.headline;
    if (greetingEl) greetingEl.value = homeContent.greeting;
    if (ctaEl) ctaEl.value = homeContent.cta_text;
    
    // Load programs
    loadDeveloperPrograms();
    
    // Load diagnosis modules
    loadDiagnosisModulesForEditor();
    
    // Load settings
    const settings = { calendar_enabled: true };
    const calendarEl = document.getElementById('dev-calendar-enabled');
    if (calendarEl) calendarEl.checked = settings.calendar_enabled;
}

async function loadDeveloperPrograms() {
    const programsList = document.getElementById('dev-programs-list');
    programsList.innerHTML = '<p>Загрузка программ...</p>';
    
    if (!isEditor) {
        programsList.innerHTML = '<p>Нет доступа. Войдите как редактор.</p>';
        return;
    }
    
    try {
        // Load ALL programs (not just published) for developer view
        const { data: programsData, error: programsError } = await supabaseClient
            .from('programs')
            .select('*')
            .order('id');
        
        if (programsError) {
            throw new Error(`Failed to load programs: ${programsError.message}`);
        }
        
        programsList.innerHTML = '';
        
        programsData.forEach((program, index) => {
        const programDiv = document.createElement('div');
            programDiv.className = 'dev-program-item program-item';
            programDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px;';
            
        programDiv.innerHTML = `
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${program.title} ${program.is_published ? '✅' : '❌'}</h4>
                    <p style="margin: 0 0 5px 0; color: #6c757d; font-size: 14px;">${program.description || 'Без описания'}</p>
                    <small style="color: #999;">ID: ${program.id} | Slug: ${program.slug}</small>
            </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button data-action="program-edit" data-id="${program.id}" style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Редактировать</button>
                    <button data-action="program-days" data-id="${program.id}" style="padding: 8px 12px; background: #6f42c1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Дни</button>
                    <button data-action="program-toggle" data-id="${program.id}" style="padding: 8px 12px; background: ${program.is_published ? '#dc3545' : '#28a745'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">${program.is_published ? 'Скрыть' : 'Опубликовать'}</button>
                    <button data-action="program-delete" data-id="${program.id}" style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить</button>
            </div>
        `;
        programsList.appendChild(programDiv);
    });
        
        console.log('Developer programs loaded:', programsData.length);
    } catch (error) {
        console.error('Failed to load developer programs:', error);
        programsList.innerHTML = '<p>Ошибка загрузки программ: ' + error.message + '</p>';
    }
}

// Publish to Supabase function
async function publishToSupabase() {
    if (!isEditor) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    if (!confirm('Опубликовать все программы в Supabase? Это заменит существующие данные.')) {
        return;
    }
    
    const statusDiv = document.getElementById('publish-status') || createPublishStatus();
    statusDiv.innerHTML = '<p>Начинаем публикацию...</p>';
    
    try {
        console.log('Publishing programs to Supabase...');
        
        for (const program of DEFAULT_PROGRAMS) {
            statusDiv.innerHTML = `<p>Публикуем: ${program.title}...</p>`;
            
            // Upsert program
            const { data: programData, error: programError } = await supabaseClient
                .from('programs')
                .upsert({
                    slug: program.slug,
                    title: program.title,
                    description: program.description,
                    image_url: program.image_url,
                    details_md: program.details_md,
                    is_published: program.is_published
                }, { onConflict: 'slug' })
                .select()
                .single();
            
            if (programError) {
                throw new Error(`Failed to upsert program ${program.title}: ${programError.message}`);
            }
            
            console.log('Program upserted:', programData);
            
            // Upsert days
            for (const day of program.days) {
                const { data: dayData, error: dayError } = await supabaseClient
                    .from('program_days')
                    .upsert({
                        program_id: programData.id,
                        day_index: day.day_index
                    }, { onConflict: 'program_id,day_index' })
                    .select()
                    .single();
                
                if (dayError) {
                    throw new Error(`Failed to upsert day ${day.day_index}: ${dayError.message}`);
                }
                
                // Upsert exercises
                for (const exercise of day.exercises) {
                    const { error: exerciseError } = await supabaseClient
                        .from('exercises')
                        .upsert({
                            program_day_id: dayData.id,
                            order_index: exercise.order_index,
                            title: exercise.title,
                            video_url: exercise.video_url,
                            description: exercise.description
                        }, { onConflict: 'program_day_id,order_index' });
                    
                    if (exerciseError) {
                        throw new Error(`Failed to upsert exercise ${exercise.title}: ${exerciseError.message}`);
                    }
                }
            }
        }
        
        statusDiv.innerHTML = '<p style="color: green;">✅ Все программы успешно опубликованы в Supabase!</p>';
        showToast('Программы опубликованы в Supabase', 'success');
        
        // Refresh data
        loadPrograms();
        loadDeveloperPrograms();
        
    } catch (error) {
        console.error('Failed to publish to Supabase:', error);
        statusDiv.innerHTML = `<p style="color: red;">❌ Ошибка: ${error.message}</p>`;
        showToast('Ошибка публикации: ' + error.message, 'error');
    }
}

function createPublishStatus() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'publish-status';
    statusDiv.style.cssText = 'margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;';
    
    const settingsContent = document.getElementById('settings-content');
    settingsContent.appendChild(statusDiv);
    
    return statusDiv;
}

// Show toast notification
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Developer CRUD functions
async function editProgram(programId) {
    console.log('editProgram called with ID:', programId);
    
    try {
        // Get program data
        const { data: program, error } = await supabaseClient
            .from('programs')
            .select('*')
            .eq('id', programId)
            .single();
        
        if (error) throw error;
        
        // Show edit form
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        if (modal && modalBody) {
            modalBody.innerHTML = `
                <div class="program-edit-form">
                    <h2 style="color: #2c3e50; margin-bottom: 20px;">Редактировать программу</h2>
                    <form id="edit-program-form">
        <div class="form-group">
                            <label>Название программы</label>
                            <input type="text" id="edit-title" value="${program.title}" required>
        </div>
        <div class="form-group">
                            <label>Описание</label>
                            <textarea id="edit-description" rows="3">${program.description || ''}</textarea>
        </div>
        <div class="form-group">
                            <label>URL изображения</label>
                            <input type="url" id="edit-image-url" value="${program.image_url || ''}">
        </div>
        <div class="form-group">
                            <label>Статус публикации</label>
            <label class="checkbox-label">
                <input type="checkbox" id="edit-published" ${program.is_published ? 'checked' : ''}>
                <span class="checkmark"></span>
                                Опубликована
            </label>
        </div>
                        <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="button" class="btn btn-primary" onclick="saveProgramEdit(${programId})">Сохранить</button>
                            <button type="button" class="btn btn-secondary" onclick="loadDeveloperPrograms()">Отмена</button>
        </div>
                    </form>
        </div>
    `;
    
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    } catch (error) {
        console.error('Failed to load program for editing:', error);
        showToast('Ошибка загрузки программы: ' + error.message, 'error');
    }
}

async function saveProgramEdit(programId) {
    try {
        const title = document.getElementById('edit-title').value;
        const description = document.getElementById('edit-description').value;
        const imageUrl = document.getElementById('edit-image-url').value;
        const isPublished = document.getElementById('edit-published').checked;
        
        if (!title.trim()) {
            showToast('Введите название программы', 'error');
            return;
        }
        
        const { error } = await supabaseClient
            .from('programs')
            .update({
                title: title.trim(),
                description: description.trim(),
                image_url: imageUrl.trim(),
                is_published: isPublished
            })
            .eq('id', programId);
        
        if (error) throw error;
        
        showToast('Программа обновлена', 'success');
        loadDeveloperPrograms();
        loadPrograms(); // Refresh public view
        
        // Close modal
        const modal = document.getElementById('program-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    } catch (error) {
        console.error('Failed to save program:', error);
        showToast('Ошибка сохранения: ' + error.message, 'error');
    }
}

async function deleteProgram(programId) {
    console.log('deleteProgram called with ID:', programId);
    if (!confirm('Удалить программу? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        console.log('Current user:', user);
        
        if (authError) {
            console.error('Auth error:', authError);
        }
        
        // First check if program exists
        const { data: program, error: fetchError } = await supabaseClient
            .from('programs')
            .select('id, title')
            .eq('id', programId)
            .single();
        
        if (fetchError) {
            console.error('Program fetch error:', fetchError);
            throw new Error(`Программа не найдена: ${fetchError.message}`);
        }
        
        console.log('Deleting program:', program);
        
        // Delete program (cascade will handle days and exercises)
        const { data: deleteData, error: deleteError } = await supabaseClient
            .from('programs')
            .delete()
            .eq('id', programId)
            .select();
        
        if (deleteError) {
            console.error('Delete error:', deleteError);
            throw new Error(`Ошибка удаления: ${deleteError.message}`);
        }
        
        console.log('Delete result:', deleteData);
        
        console.log('Program deleted successfully');
        showToast(`Программа "${program.title}" удалена`, 'success');
        
        // Refresh both views
        await loadDeveloperPrograms();
        await loadPrograms();
        
    } catch (error) {
        console.error('Failed to delete program:', error);
        showToast('Ошибка удаления: ' + error.message, 'error');
    }
}

async function toggleProgramPublished(programId) {
    console.log('toggleProgramPublished called with ID:', programId);
    try {
        // Get current program
        const { data: program, error: fetchError } = await supabaseClient
            .from('programs')
            .select('id, title, is_published')
            .eq('id', programId)
            .single();
        
        if (fetchError) {
            console.error('Program fetch error:', fetchError);
            throw new Error(`Программа не найдена: ${fetchError.message}`);
        }
        
        console.log('Toggling program:', program);
        
        // Toggle published status
        const { error: updateError } = await supabaseClient
            .from('programs')
            .update({ is_published: !program.is_published })
            .eq('id', programId);
        
        if (updateError) {
            console.error('Update error:', updateError);
            throw new Error(`Ошибка обновления: ${updateError.message}`);
        }
        
        console.log('Program status toggled successfully');
        showToast(`Программа "${program.title}" ${!program.is_published ? 'опубликована' : 'скрыта'}`, 'success');
        
        // Refresh both views
        await loadDeveloperPrograms();
        await loadPrograms();
        
    } catch (error) {
        console.error('Failed to toggle program published:', error);
        showToast('Ошибка изменения статуса: ' + error.message, 'error');
    }
}

function addNewProgram() {
    console.log('Adding new program');
    
    const modal = document.getElementById('program-modal');
    const modalBody = document.getElementById('program-modal-body');
    
    if (modal && modalBody) {
        modalBody.innerHTML = `
            <div class="program-edit-form">
                <h2 style="color: #2c3e50; margin-bottom: 20px;">Добавить новую программу</h2>
                <form id="add-program-form">
            <div class="form-group">
                        <label>Название программы *</label>
                        <input type="text" id="add-title" placeholder="Введите название" required>
            </div>
            <div class="form-group">
                        <label>Описание</label>
                        <textarea id="add-description" rows="3" placeholder="Описание программы"></textarea>
            </div>
            <div class="form-group">
                        <label>URL изображения</label>
                        <input type="url" id="add-image-url" placeholder="https://example.com/image.jpg">
            </div>
            <div class="form-group">
                        <label>Slug (уникальный идентификатор) *</label>
                        <input type="text" id="add-slug" placeholder="program-slug" required>
                        <small style="color: #6c757d;">Только латинские буквы, цифры и дефисы</small>
            </div>
                    <div class="form-group">
                        <label>Статус публикации</label>
                        <label class="checkbox-label">
                            <input type="checkbox" id="add-published" checked>
                            <span class="checkmark"></span>
                            Опубликована
                        </label>
        </div>
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" class="btn btn-primary" onclick="saveNewProgram()">Создать программу</button>
                        <button type="button" class="btn btn-secondary" onclick="loadDeveloperPrograms()">Отмена</button>
                    </div>
                </form>
            </div>
        `;
        
        modal.classList.remove('hidden');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

async function saveNewProgram() {
    try {
        const title = document.getElementById('add-title').value;
        const description = document.getElementById('add-description').value;
        const imageUrl = document.getElementById('add-image-url').value;
        const slug = document.getElementById('add-slug').value;
        const isPublished = document.getElementById('add-published').checked;
        
        if (!title.trim()) {
            showToast('Введите название программы', 'error');
            return;
        }
        
        if (!slug.trim()) {
            showToast('Введите slug программы', 'error');
            return;
        }
        
        // Validate slug format
        if (!/^[a-z0-9-]+$/.test(slug)) {
            showToast('Slug может содержать только латинские буквы, цифры и дефисы', 'error');
            return;
        }
        
        console.log('Creating new program:', { title, slug, isPublished });
        
        const { data: newProgram, error } = await supabaseClient
            .from('programs')
            .insert({
                title: title.trim(),
                description: description.trim(),
                image_url: imageUrl.trim(),
                slug: slug.trim(),
                is_published: isPublished
            })
            .select()
            .single();
        
        if (error) {
            console.error('Create program error:', error);
            if (error.code === '23505') {
                throw new Error('Программа с таким slug уже существует');
            }
            throw new Error(`Ошибка создания: ${error.message}`);
        }
        
        console.log('Program created successfully:', newProgram);
        showToast(`Программа "${newProgram.title}" создана`, 'success');
        
        // Close modal
        const modal = document.getElementById('program-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        
        // Refresh both views
        await loadDeveloperPrograms();
        await loadPrograms();
        
    } catch (error) {
        console.error('Failed to create program:', error);
        showToast('Ошибка создания программы: ' + error.message, 'error');
    }
}

function saveHomeContent() {
    console.log('Saving home content');
    showToast('Функция сохранения главной страницы в разработке', 'info');
}

function saveSettings() {
    console.log('Saving settings');
    showToast('Настройки сохранены', 'success');
}

function exportContent() {
    console.log('Exporting content');
    showToast('Функция экспорта в разработке', 'info');
}

function importContent() {
    console.log('Importing content');
    showToast('Функция импорта в разработке', 'info');
}

async function handleAddExercise(dayId) {
    console.log('handleAddExercise called with day ID:', dayId);
    showToast('Добавляем новое упражнение...', 'info');
    
    try {
        // Get next order_index
        const { data: maxExercise } = await supabaseClient
            .from('exercises')
            .select('order_index')
            .eq('program_day_id', dayId)
            .order('order_index', { ascending: false })
            .limit(1)
            .single();
        
        const nextOrderIndex = (maxExercise?.order_index || 0) + 1;
        
        const { data, error } = await supabaseClient
            .from('exercises')
            .insert([{
                program_day_id: dayId,
                order_index: nextOrderIndex,
                title: `Упражнение ${nextOrderIndex}`,
                description: '',
                video_url: ''
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        showToast('Упражнение добавлено', 'success');
        
        // Refresh the exercises list
        await handleDayExercises(dayId);
        
    } catch (error) {
        console.error('Failed to add exercise:', error);
        showToast('Ошибка добавления упражнения: ' + error.message, 'error');
    }
}

async function handleEditExercise(exerciseId) {
    console.log('handleEditExercise called with ID:', exerciseId);
    showToast('Загружаем упражнение для редактирования...', 'info');
    
    try {
        // Get exercise data
        const { data: exercise, error } = await supabaseClient
            .from('exercises')
            .select('*')
            .eq('id', exerciseId)
            .single();
        
        if (error) throw error;
        
        // Open edit modal
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        if (modal && modalBody) {
            modalBody.innerHTML = `
                <div class="exercise-edit-form">
                    <h2 style="color: #2c3e50; margin-bottom: 20px;">Редактировать упражнение</h2>
                    <form id="edit-exercise-form">
                        <div class="form-group">
                            <label>Название упражнения</label>
                            <input type="text" id="edit-exercise-title" value="${exercise.title}" required>
                        </div>
                        <div class="form-group">
                            <label>Описание</label>
                            <textarea id="edit-exercise-description" rows="3">${exercise.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>URL видео (YouTube, GetCourse и др.)</label>
                            <input type="url" id="edit-exercise-video" value="${exercise.video_url || ''}" placeholder="https://youtube.com/watch?v=...">
                        </div>
                        <div class="form-group">
                            <label>Порядок</label>
                            <input type="number" id="edit-exercise-order" value="${exercise.order_index}" min="1">
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="button" class="btn btn-primary" onclick="saveExerciseEditViaAdmin('${exerciseId}')">Сохранить</button>
                            <button type="button" class="btn btn-secondary" onclick="handleDayExercises('${exercise.program_day_id}')">Отмена</button>
                        </div>
                    </form>
                </div>
            `;
            
            // Ensure modal is attached to body and visible
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.zIndex = '9999';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.background = 'rgba(0,0,0,0.5)';
            document.body.style.overflow = 'hidden';
        }
        
    } catch (error) {
        console.error('Failed to load exercise for editing:', error);
        showToast('Ошибка загрузки упражнения: ' + error.message, 'error');
    }
}

async function saveExerciseEditViaAdmin(exerciseId) {
    try {
        const title = document.getElementById('edit-exercise-title').value;
        const description = document.getElementById('edit-exercise-description').value;
        const videoUrl = document.getElementById('edit-exercise-video').value;
        const orderIndex = parseInt(document.getElementById('edit-exercise-order').value);
        
        if (!title.trim()) {
            showToast('Название упражнения обязательно', 'error');
            return;
        }
        
        showToast('Сохраняем упражнение...', 'info');
        
        const { data, error } = await supabaseClient
            .from('exercises')
            .update({
                title: title.trim(),
                description: description.trim(),
                video_url: videoUrl.trim(),
                order_index: orderIndex
            })
            .eq('id', exerciseId)
            .select()
            .single();
        
        if (error) throw error;
        
        showToast('Упражнение обновлено', 'success');
        
        // Get the day_id to refresh the exercises list
        const { data: exercise } = await supabaseClient
            .from('exercises')
            .select('program_day_id')
            .eq('id', exerciseId)
            .single();
        
        // Close modal and refresh
        const modal = document.getElementById('program-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        
        // Refresh the exercises list
        await handleDayExercises(exercise.program_day_id);
        
    } catch (error) {
        console.error('Failed to save exercise:', error);
        showToast('Ошибка сохранения: ' + error.message, 'error');
    }
}

async function handleDeleteExercise(exerciseId) {
    console.log('handleDeleteExercise called with ID:', exerciseId);
    
    if (!confirm('Удалить упражнение? Это действие нельзя отменить.')) {
        return;
    }
    
    showToast('Удаляем упражнение...', 'info');
    
    try {
        // Get day_id before deleting
        const { data: exercise } = await supabaseClient
            .from('exercises')
            .select('program_day_id')
            .eq('id', exerciseId)
            .single();
        
        const { error } = await supabaseClient
            .from('exercises')
            .delete()
            .eq('id', exerciseId);
        
        if (error) throw error;
        
        showToast('Упражнение удалено', 'success');
        
        // Refresh the exercises list
        await handleDayExercises(exercise.program_day_id);
        
    } catch (error) {
        console.error('Failed to delete exercise:', error);
        showToast('Ошибка удаления: ' + error.message, 'error');
    }
}

// ===== USER PROFILE FUNCTIONS =====

// Load user profile from database
async function loadUserProfile() {
    try {
        if (!user?.id) {
            console.warn('No user ID available for profile loading');
            // Try to load from cache if no user ID
            loadProfileFromCache();
            return;
        }

        const { data, error } = await supabaseClient
            .rpc('get_user_profile', { p_tg_user_id: user.id });

        if (error) {
            console.error('Error loading user profile:', error);
            return;
        }

        if (data && Object.keys(data).length > 0) {
            userProfile = data;
            // Ensure new access fields exist with safe defaults
            if (typeof userProfile.has_access === 'undefined' || userProfile.has_access === null) {
                userProfile.has_access = false;
            }
            if (typeof userProfile.subscription_valid_until === 'undefined') {
                userProfile.subscription_valid_until = null;
            }
            console.log('User profile loaded:', userProfile);
            
            // Populate form fields
            populateProfileForm();
            
            // Store in localStorage for persistence
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
        } else {
            console.log('No profile data found, initializing empty profile');
            userProfile = {
                tg_user_id: user.id,
                username: user.username || '',
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                age: null,
                gender: '',
                problem: '',
                has_access: false,
                subscription_valid_until: null
            };
        }
        
    } catch (error) {
        console.error('Failed to load user profile:', error);
    }
}

// Populate profile form with user data
function populateProfileForm() {
    console.log('Populating profile form, userProfile:', userProfile);
    if (!userProfile) {
        console.log('No userProfile data to populate');
        return;
    }
    
    const nameField = document.getElementById('user-name');
    const ageField = document.getElementById('user-age');
    const genderField = document.getElementById('user-gender');
    const problemField = document.getElementById('user-problem');
    
    if (nameField) nameField.value = userProfile.first_name || '';
    if (ageField) ageField.value = userProfile.age || '';
    if (genderField) genderField.value = userProfile.gender || '';
    if (problemField) problemField.value = userProfile.problem || '';
}

// Save user profile
async function saveProfile() {
    try {
        if (!user?.id) {
            showNotification('Ошибка: пользователь не авторизован', 'error');
            return;
        }

        // Get form data
        const nameField = document.getElementById('user-name');
        const ageField = document.getElementById('user-age');
        const genderField = document.getElementById('user-gender');
        const problemField = document.getElementById('user-problem');
        
        const firstName = nameField?.value?.trim() || '';
        const age = ageField?.value ? parseInt(ageField.value) : null;
        const gender = genderField?.value || '';
        const problem = problemField?.value || '';
        
        // Валидация полей с использованием Validator
        const nameValidation = Validator.validateName(firstName);
        if (!nameValidation.valid) {
            showNotification(nameValidation.error, 'warning');
            return;
        }
        
        const ageValidation = Validator.validateAge(age);
        if (!ageValidation.valid) {
            showNotification(ageValidation.error, 'warning');
            return;
        }
        
        const genderValidation = Validator.validateGender(gender);
        if (!genderValidation.valid) {
            showNotification(genderValidation.error, 'warning');
            return;
        }
        
        const problemValidation = Validator.validateText(problem, { required: true, maxLength: 50 });
        if (!problemValidation.valid) {
            showNotification(problemValidation.error, 'warning');
            return;
        }
        
        // Используем валидированные значения
        const validatedFirstName = nameValidation.value;
        const validatedAge = ageValidation.value;
        const validatedGender = genderValidation.value;
        const validatedProblem = problemValidation.value;

        // Show loading state
        const saveButton = document.querySelector('.save-button');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Сохранение...';
        }

        const { data, error } = await supabaseClient
            .rpc('save_user_profile', {
                p_tg_user_id: user.id,
                p_username: user.username || '',
                p_first_name: validatedFirstName,
                p_last_name: user.last_name || '',
                p_age: validatedAge,
                p_gender: validatedGender,
                p_problem: validatedProblem
            });

        if (error) {
            console.error('Error saving user profile:', error);
            showNotification('Ошибка при сохранении профиля', 'error');
            return;
        }

        if (data.success) {
            showNotification(data.message, 'success');
            
            // Update local profile data
            userProfile = data.profile;
            
            // Store in localStorage
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
            
            console.log('Profile saved successfully:', userProfile);
            // Refresh avatar (gender-based) right away
            try { updateProgressDisplay(); } catch (_) {}
        } else {
            showNotification('Ошибка при сохранении профиля', 'error');
        }
        
    } catch (error) {
        console.error('Failed to save profile:', error);
        showNotification('Ошибка при сохранении профиля', 'error');
    } finally {
        // Restore button state
        const saveButton = document.querySelector('.save-button');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Сохранить изменения';
        }
    }
}

// Load profile from localStorage on initialization
function loadProfileFromCache() {
    const cachedProfile = localStorage.getItem('userProfile');
    console.log('Loading profile from cache:', !!cachedProfile);
    if (cachedProfile) {
        try {
            userProfile = JSON.parse(cachedProfile);
            // Backward compatibility: ensure new fields exist
            if (typeof userProfile.has_access === 'undefined' || userProfile.has_access === null) {
                userProfile.has_access = false;
            }
            if (typeof userProfile.subscription_valid_until === 'undefined') {
                userProfile.subscription_valid_until = null;
            }
            console.log('User profile loaded from cache:', userProfile);
            populateProfileForm();
            // Update avatar and access UI if progress is already loaded
            try { updateProgressDisplay(); } catch (_) {}
            try { updateAccessUI(); } catch (_) {}
        } catch (e) {
            console.warn('Failed to parse cached profile:', e);
            userProfile = null;
        }
    } else {
        console.log('No cached profile found');
    }
}

// Load progress from localStorage on initialization
function loadProgressFromCache() {
    const cachedProgress = localStorage.getItem('userProgress');
    console.log('Loading progress from cache:', !!cachedProgress);
    if (cachedProgress) {
        try {
            userProgress = normalizeUserProgress(JSON.parse(cachedProgress));
            console.log('User progress loaded from cache:', userProgress);
            updateProgressUI();
            updateCalendarHighlighting();
            try { updateAccessUI(); } catch (_) {}
        } catch (e) {
            console.warn('Failed to parse cached progress:', e);
            userProgress = null;
        }
    } else {
        console.log('No cached progress found');
    }
}

// Export all functions for global access
window.navigateToSection = navigateToSection;
window.changeMonth = changeMonth;
window.openProgramModal = openProgramModal;
window.closeProgramModal = closeProgramModal;
window.saveProfile = saveProfile;
window.openDaySelection = openDaySelection;
window.openExerciseModule = openExerciseModule;
window.closeExerciseModal = closeExerciseModal;
window.closeAllModals = closeAllModals;
window.killAllModals = killAllModals;
window.stopAllVideos = stopAllVideos;
window.saveProfile = saveProfile;
window.renewSubscription = renewSubscription;
window.openDeveloperAccess = openDeveloperAccess;
window.closeDeveloperPanel = closeDeveloperPanel;
window.publishToSupabase = publishToSupabase;
window.editProgram = editProgram;
window.saveProgramEdit = saveProgramEdit;
window.deleteProgram = deleteProgram;
window.toggleProgramPublished = toggleProgramPublished;
window.addNewProgram = addNewProgram;
window.saveNewProgram = saveNewProgram;
window.saveProgramEditViaAdmin = saveProgramEditViaAdmin;
window.saveNewProgramViaAdmin = saveNewProgramViaAdmin;
window.handleProgramDays = handleProgramDays;
window.handleAddDay = handleAddDay;
window.handleDayExercises = handleDayExercises;
window.openAccessBot = openAccessBot;
window.handleAddExercise = handleAddExercise;
window.handleEditExercise = handleEditExercise;
window.saveExerciseEditViaAdmin = saveExerciseEditViaAdmin;
window.handleDeleteExercise = handleDeleteExercise;
window.handleEditDay = handleEditDay;
window.handleDeleteDay = handleDeleteDay;
window.saveDayEditViaAdmin = saveDayEditViaAdmin;
window.saveHomeContent = saveHomeContent;
window.saveSettings = saveSettings;
window.exportContent = exportContent;
window.importContent = importContent;

// Self-Diagnosis Functions

// Diagnosis modules data structure
let diagnosisModules = {
    'neck': {
        name: 'Шея',
        videos: [
            { id: 1, title: 'Диагностика причин боли в шее', url: 'https://kinescope.io/embed/aCxDPyeGfjeJe2A6ig3dZ3', order: 1 }
        ]
    },
    'shoulder': {
        name: 'Плечо',
        videos: [
            { id: 4, title: 'Причины формирования боли в плече', url: 'https://kinescope.io/embed/n4UynK2rDAktaQTRp9NauS', order: 1 },
            { id: 5, title: 'Тесты на воспаления плечевого пояса', url: 'https://kinescope.io/embed/oPi1ygi7uCtZMEzRHdyBsC', order: 2 },
            { id: 6, title: 'Тест подвижности плеча и лопатки', url: 'https://kinescope.io/embed/taSAgMQYtxc6CL2UPwd6Jr', order: 3 }
        ]
    },
    'lower-back': {
        name: 'Поясница',
        videos: [
            { id: 7, title: 'Причины формирования боли в пояснице', url: 'https://kinescope.io/embed/aLuoeSZQvQamqwPunDjh1d', order: 1 },
            { id: 8, title: 'Тест флексии', url: 'https://kinescope.io/embed/it6kqgKz8LJjzd4nspzi32', order: 2 },
            { id: 9, title: 'Тестирование мобильности и наличия зажимов', url: 'https://kinescope.io/embed/7evM23kmSBXJHAmrfjBTgr', order: 3 }
        ]
    },
    'hip': {
        name: 'Таз',
        videos: [
            { id: 10, title: 'Тестирование мобильности ТБС', url: 'https://kinescope.io/embed/jvv9XhNpXLqfJXGwicPGG4', order: 1 },
            { id: 11, title: 'Тест внутренней ротации ТБС', url: 'https://kinescope.io/embed/ifHokeHydGFFa82oLB4uUv', order: 2 }
        ]
    },
    'knee': {
        name: 'Колено',
        videos: [
            { id: 12, title: 'Здоровье коленного сустава', url: 'https://kinescope.io/embed/x7D2hBEbGAMSaqFEn2Tf6m', order: 1 },
            { id: 13, title: 'Тест на мобильность голеностопного сустава', url: 'https://kinescope.io/embed/gSWF4KXpgg1KrAiqbjmduD', order: 2 }
        ]
    },
    'foot': {
        name: 'Стопа',
        videos: [
            { id: 14, title: 'Тест на формирование вальгусной деформации + тест Джека', url: 'https://kinescope.io/embed/8LB499BGcPk1hB3Y6oYLXr', order: 1 },
            { id: 15, title: 'Ходьба на носках', url: 'https://kinescope.io/embed/suP3abRPm8Fe2RvSbB1HRN', order: 2 }
        ]
    }
};

function startDiagnostic(module) {
    console.log('Starting diagnostic for:', module);
    
    stopAllVideos();
    
    const moduleData = diagnosisModules[module];
    if (!moduleData || !Array.isArray(moduleData.videos) || moduleData.videos.length === 0) {
        showToast('Видео для диагностики не найдены', 'error');
        return;
    }
    
    showDiagnosticModule(module, moduleData);
}

function buildDiagnosticVideoEmbed(videoUrl) {
    if (!videoUrl) {
        return '<p style="color: #dc3545;">Видео недоступно</p>';
    }
    
    const isKinescopeDirect = videoUrl.includes('kinescope.io/') && !videoUrl.includes('/embed/');
    let embedUrl = videoUrl;
    
    if (isKinescopeDirect) {
        const videoId = videoUrl.split('/').pop();
        embedUrl = `https://kinescope.io/embed/${videoId}`;
    }
    
    const iframeAttributes = `class="exercise-video" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;" frameborder="0" allowfullscreen`;
    
    return `
        <div class="video-container-universal">
            <div style="position: relative; padding-top: 56.25%; width: 100%; border-radius: 10px; overflow: hidden;">
                <iframe ${iframeAttributes}
                        src="${embedUrl}"
                        style="position: absolute; width: 100%; height: 100%; top: 0; left: 0;"></iframe>
            </div>
        </div>
    `;
}

function showDiagnosticModule(module, moduleDataOverride) {
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    if (!modal || !modalBody) return;
    
    const moduleData = moduleDataOverride || diagnosisModules[module];
    if (!moduleData || !Array.isArray(moduleData.videos) || moduleData.videos.length === 0) {
        showToast('Видео для диагностики не найдены', 'error');
        return;
    }

    const moduleName = getModuleName(module);
    const videoBlocks = moduleData.videos.map((video, index) => {
        const videoHtml = buildDiagnosticVideoEmbed(video.url);
        const divider = index < moduleData.videos.length - 1
            ? '<hr style="margin: 28px 0; border: none; border-top: 1px solid rgba(15,23,42,0.08);">'
            : '';
        return `
            <div class="diagnostic-video-block" style="margin-bottom: 12px;">
                <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">${video.title}</h3>
                ${videoHtml}
            </div>
            ${divider}
        `;
    }).join('');
    
    modalBody.innerHTML = `
        <div class="diagnostic-module-player" style="max-width: 820px; width: 100%;">
            <h2 style="color: #0f172a; margin-bottom: 10px; font-size: 22px;">Диагностика ${moduleName}</h2>
            <p style="color: #475467; margin-bottom: 28px; font-size: 15px;">Следуйте инструкциям из видео</p>
            ${videoBlocks}
            <div style="display: flex; gap: 12px; margin-top: 32px;">
                <button class="btn btn-secondary" onclick="goToDiagnostics()" style="flex: 1;">Назад</button>
                <button class="btn btn-primary" onclick="goToExercises()" style="flex: 1;">К упражнениям</button>
            </div>
        </div>
    `;
    
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '9999';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.background = 'rgba(0,0,0,0.5)';
    document.body.style.overflow = 'hidden';
}

// Show diagnostic video selection modal
function showDiagnosticVideoModal(module, moduleName) {
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    
    if (modal && modalBody) {
        modalBody.innerHTML = `
            <div class="diagnostic-video-selection">
                <h2 style="color: #2c3e50; margin-bottom: 20px;">🔍 Диагностика: ${moduleName}</h2>
                <p style="color: #6c757d; margin-bottom: 25px;">Выберите формат видео для диагностики</p>
                
                <div class="video-format-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                    <button class="video-format-btn" onclick="selectDiagnosticVideoFormat('${module}', 'youtube')" style="padding: 15px; border: 2px solid #e9ecef; border-radius: 10px; background: white; cursor: pointer; transition: all 0.3s;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📺</div>
                        <div style="font-weight: 600; color: #2c3e50;">YouTube</div>
                        <div style="font-size: 12px; color: #6c757d;">Встроенное видео</div>
                    </button>
                    
                    <button class="video-format-btn" onclick="selectDiagnosticVideoFormat('${module}', 'kinoscope')" style="padding: 15px; border: 2px solid #e9ecef; border-radius: 10px; background: white; cursor: pointer; transition: all 0.3s;">
                        <div style="font-size: 24px; margin-bottom: 8px;">🎬</div>
                        <div style="font-weight: 600; color: #2c3e50;">Kinoscope</div>
                        <div style="font-size: 12px; color: #6c757d;">Прямая ссылка</div>
                    </button>
                    
                    <button class="video-format-btn" onclick="selectDiagnosticVideoFormat('${module}', 'getcourse')" style="padding: 15px; border: 2px solid #e9ecef; border-radius: 10px; background: white; cursor: pointer; transition: all 0.3s;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📚</div>
                        <div style="font-weight: 600; color: #2c3e50;">GetCourse</div>
                        <div style="font-size: 12px; color: #6c757d;">Курсовая платформа</div>
                    </button>
                    
                    <button class="video-format-btn" onclick="selectDiagnosticVideoFormat('${module}', 'custom')" style="padding: 15px; border: 2px solid #e9ecef; border-radius: 10px; background: white; cursor: pointer; transition: all 0.3s;">
                        <div style="font-size: 24px; margin-bottom: 8px;">🔗</div>
                        <div style="font-weight: 600; color: #2c3e50;">Другое</div>
                        <div style="font-size: 12px; color: #6c757d;">Своя ссылка</div>
                    </button>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="closeDiagnosticModal()" style="flex: 1;">Отмена</button>
                </div>
            </div>
        `;
        
        // Show modal
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.zIndex = '9999';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.background = 'rgba(0,0,0,0.5)';
        document.body.style.overflow = 'hidden';
    }
}

// Handle video format selection for diagnostic
function selectDiagnosticVideoFormat(module, format) {
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    
    if (modal && modalBody) {
        let placeholder = '';
        
        switch(format) {
            case 'youtube':
                placeholder = 'https://youtube.com/watch?v=...';
                break;
            case 'kinoscope':
                placeholder = 'https://kinoscope.ru/video/...';
                break;
            case 'getcourse':
                placeholder = 'https://getcourse.ru/...';
                break;
            case 'custom':
                placeholder = 'https://example.com/video.mp4';
                break;
        }
        
        modalBody.innerHTML = `
            <div class="diagnostic-video-input">
                <h2 style="color: #2c3e50; margin-bottom: 20px;">🔍 Диагностика: ${getModuleName(module)}</h2>
                <p style="color: #6c757d; margin-bottom: 25px;">Вставьте ссылку на видео</p>
                
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2c3e50;">URL видео</label>
                    <input type="url" id="diagnostic-video-url" placeholder="${placeholder}" style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 14px;">
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 25px;">
                    <button class="btn btn-primary" onclick="startDiagnosticWithVideo('${module}')" style="flex: 1;">Начать диагностику</button>
                    <button class="btn btn-secondary" onclick="showDiagnosticVideoModal('${module}', '${getModuleName(module)}')" style="flex: 1;">Назад</button>
                </div>
            </div>
        `;
    }
}

// Start diagnostic with video
function startDiagnosticWithVideo(module) {
    // Stop all videos before starting new diagnostic
    stopAllVideos();
    
    const videoUrl = document.getElementById('diagnostic-video-url').value;
    
    if (!videoUrl) {
        showToast('Введите ссылку на видео', 'error');
        return;
    }
    
    // Close modal
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Show diagnostic with video
    showDiagnosticVideo(module, videoUrl);
}

// Show diagnostic video player
function showDiagnosticVideo(module, videoUrl) {
    stopAllVideos();
    
    const moduleData = diagnosisModules[module];
    const moduleName = getModuleName(module);
    const videoHTML = buildDiagnosticVideoEmbed(videoUrl);
    const canReturnToModule = moduleData && Array.isArray(moduleData.videos) && moduleData.videos.length > 0;
    const backButtonAction = canReturnToModule
        ? `showDiagnosticModule('${module}')`
        : 'goToDiagnostics()';
    const backButtonText = canReturnToModule ? 'Назад' : 'Закрыть';
    
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    
    if (modal && modalBody) {
        modalBody.innerHTML = `
            <div class="diagnostic-video-player">
                <h2 style="color: #2c3e50; margin-bottom: 20px;">🔍 Диагностика: ${moduleName}</h2>
                <p style="color: #6c757d; margin-bottom: 20px;">Следуйте инструкциям в видео</p>
                
                <div style="margin-bottom: 20px;">
                    ${videoHTML}
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="${backButtonAction}" style="flex: 1;">${backButtonText}</button>
                    <button class="btn btn-primary" onclick="goToExercises()" style="flex: 1;">К упражнениям</button>
                </div>
            </div>
        `;
        
        // Show modal
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.zIndex = '9999';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.background = 'rgba(0,0,0,0.5)';
        document.body.style.overflow = 'hidden';
    }
}

// Complete diagnostic
function completeDiagnostic(module) {
    const moduleName = getModuleName(module);
    showToast(`Диагностика "${moduleName}" завершена!`, 'success');
    closeDiagnosticModal();
}

// Close diagnostic modal
function closeDiagnosticModal() {
    stopAllVideos(); // Stop all videos when closing modal
    
    // Force hide all video containers
    document.querySelectorAll('.video-container-universal').forEach(container => {
        container.style.display = 'none';
    });
    
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Additional cleanup after a short delay
    setTimeout(() => {
        document.querySelectorAll('.video-container-universal').forEach(container => {
            container.style.display = '';
        });
    }, 500);
}

// Navigate to diagnostics section
function goToDiagnostics() {
    closeDiagnosticModal();
    navigateToSection('diagnosis');
}

// Navigate to exercises section
function goToExercises() {
    closeDiagnosticModal();
    navigateToSection('exercises');
}

// Get module name
function getModuleName(module) {
    return diagnosisModules[module]?.name || module;
}

window.startDiagnostic = startDiagnostic;
window.showDiagnosticVideoModal = showDiagnosticVideoModal;
window.selectDiagnosticVideoFormat = selectDiagnosticVideoFormat;
window.startDiagnosticWithVideo = startDiagnosticWithVideo;
window.showDiagnosticVideo = showDiagnosticVideo;
window.completeDiagnostic = completeDiagnostic;
window.closeDiagnosticModal = closeDiagnosticModal;
window.getModuleName = getModuleName;
window.goToDiagnostics = goToDiagnostics;
window.goToExercises = goToExercises;

// Diagnosis Editor Functions
function loadDiagnosisModulesForEditor() {
    const modulesContainer = document.getElementById('dev-diagnosis-modules');
    if (!modulesContainer) return;
    
    modulesContainer.innerHTML = '';
    
    Object.keys(diagnosisModules).forEach(moduleKey => {
        const module = diagnosisModules[moduleKey];
        const moduleElement = createDiagnosisModuleElement(moduleKey, module);
        modulesContainer.appendChild(moduleElement);
    });
}

function createDiagnosisModuleElement(moduleKey, module) {
    const div = document.createElement('div');
    div.className = 'diagnosis-module-item';
    div.innerHTML = `
        <div class="module-header">
            <h4>${module.name}</h4>
            <div class="module-actions">
                <button class="btn btn-sm btn-primary" onclick="editDiagnosisModule('${moduleKey}')">Редактировать</button>
                <button class="btn btn-sm btn-danger" onclick="deleteDiagnosisModule('${moduleKey}')">Удалить</button>
            </div>
        </div>
        <div class="module-videos">
            ${module.videos.map(video => `
                <div class="video-item">
                    <span class="video-order">${video.order}</span>
                    <span class="video-title">${video.title}</span>
                    <div class="video-actions">
                        <button class="btn btn-xs btn-secondary" onclick="editDiagnosisVideo('${moduleKey}', ${video.id})">Изменить</button>
                        <button class="btn btn-xs btn-danger" onclick="deleteDiagnosisVideo('${moduleKey}', ${video.id})">Удалить</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-sm btn-success" onclick="addDiagnosisVideo('${moduleKey}')">Добавить видео</button>
    `;
    return div;
}

function addDiagnosisModule() {
    const moduleName = prompt('Введите название модуля:');
    if (!moduleName) return;
    
    const moduleKey = moduleName.toLowerCase().replace(/\s+/g, '-');
    diagnosisModules[moduleKey] = {
        name: moduleName,
        videos: []
    };
    
    loadDiagnosisModulesForEditor();
    showToast('Модуль добавлен', 'success');
}

function editDiagnosisModule(moduleKey) {
    const module = diagnosisModules[moduleKey];
    const newName = prompt('Введите новое название модуля:', module.name);
    if (newName && newName !== module.name) {
        module.name = newName;
        loadDiagnosisModulesForEditor();
        showToast('Модуль обновлен', 'success');
    }
}

function deleteDiagnosisModule(moduleKey) {
    if (confirm('Вы уверены, что хотите удалить этот модуль?')) {
        delete diagnosisModules[moduleKey];
        loadDiagnosisModulesForEditor();
        showToast('Модуль удален', 'success');
    }
}

function addDiagnosisVideo(moduleKey) {
    const module = diagnosisModules[moduleKey];
    const title = prompt('Введите название видео:');
    if (!title) return;
    
    const url = prompt('Введите URL видео:');
    if (!url) return;
    
    const maxId = Math.max(...Object.values(diagnosisModules).flatMap(m => m.videos).map(v => v.id), 0);
    const newOrder = module.videos.length + 1;
    
    module.videos.push({
        id: maxId + 1,
        title: title,
        url: url,
        order: newOrder
    });
    
    loadDiagnosisModulesForEditor();
    showToast('Видео добавлено', 'success');
}

function editDiagnosisVideo(moduleKey, videoId) {
    const module = diagnosisModules[moduleKey];
    const video = module.videos.find(v => v.id === videoId);
    if (!video) return;
    
    const newTitle = prompt('Введите новое название видео:', video.title);
    if (newTitle && newTitle !== video.title) {
        video.title = newTitle;
    }
    
    const newUrl = prompt('Введите новый URL видео:', video.url);
    if (newUrl && newUrl !== video.url) {
        video.url = newUrl;
    }
    
    loadDiagnosisModulesForEditor();
    showToast('Видео обновлено', 'success');
}

function deleteDiagnosisVideo(moduleKey, videoId) {
    if (confirm('Вы уверены, что хотите удалить это видео?')) {
        const module = diagnosisModules[moduleKey];
        module.videos = module.videos.filter(v => v.id !== videoId);
        
        // Reorder remaining videos
        module.videos.forEach((video, index) => {
            video.order = index + 1;
        });
        
        loadDiagnosisModulesForEditor();
        showToast('Видео удалено', 'success');
    }
}

// Export diagnosis editor functions
window.loadDiagnosisModulesForEditor = loadDiagnosisModulesForEditor;
window.addDiagnosisModule = addDiagnosisModule;
window.editDiagnosisModule = editDiagnosisModule;
window.deleteDiagnosisModule = deleteDiagnosisModule;
window.addDiagnosisVideo = addDiagnosisVideo;
window.editDiagnosisVideo = editDiagnosisVideo;
window.deleteDiagnosisVideo = deleteDiagnosisVideo;

// Progress System
const PROGRESS_LEVELS = [
    { level: 1, name: "Новичок", minDays: 0, maxDays: 6, emoji: "🏃‍♂️" },
    { level: 2, name: "Начинающий", minDays: 7, maxDays: 20, emoji: "💪" },
    { level: 3, name: "Продвинутый", minDays: 21, maxDays: 44, emoji: "🏋️‍♂️" },
    { level: 4, name: "Опытный", minDays: 45, maxDays: 89, emoji: "🥇" },
    { level: 5, name: "Эксперт", minDays: 90, maxDays: 999, emoji: "🏆" }
];

// Initialize homepage
function initializeHomepage() {
    updateWelcomeMessage();
    updateProgressDisplay();
    generateCalendar();
    loadThemePreference();
    // Ensure access UI is in sync when homepage initializes
    try { updateAccessUI(); } catch (_) {}
}

// Update welcome message with user name
function updateWelcomeMessage() {
    const userName = user?.first_name || 'Пользователь';
    
    // Check if userProfile exists
    if (!userProfile) {
        console.log('userProfile is null, skipping welcome message update');
        return;
    }
    
    const registrationDate = userProfile.registrationDate || new Date();
    const daysSinceRegistration = Math.floor((new Date() - new Date(registrationDate)) / (1000 * 60 * 60 * 24)) + 1;
    
    const welcomeTitleEl = document.getElementById('welcome-title');
    if (welcomeTitleEl) {
        welcomeTitleEl.textContent = `Привет, ${userName}!`;
    }
    
    const welcomeSubtitleEl = document.getElementById('welcome-subtitle');
    if (welcomeSubtitleEl) {
        welcomeSubtitleEl.innerHTML = `Сегодня твой ${daysSinceRegistration}-ый день<br>на пути к Здоровому телу!`;
    }
}

// Update progress display
function updateProgressDisplay() {
    // Check if userProgress exists
    if (!userProgress) {
        console.log('userProgress is null, skipping progress display update');
        return;
    }
    
    const completedDays = userProgress.completedDays || 0;
    const currentLevel = getCurrentLevel(completedDays);
    const levelProgress = getLevelProgress(completedDays, currentLevel);
    
    // Удалены принудительные стили - это задача CSS
    
    // Update large avatar image based on level
    const avatarImage = document.getElementById('avatar-image');
    if (avatarImage) {
        const gender = (userProfile?.gender || '').toString().toLowerCase();
        const imageUrlsMale = {
            1: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/206/h/2b2a03cab1d383ec241d4c5b429aa180.png', // Новичок
            2: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/128/h/694d2d85c9d8d11bc8a57e8409e99427.png', // Начинающий
            3: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/267/h/6737c592ee593fb44475d68dca6c6fbe.png', // Продвинутый
            4: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/389/h/facd546dad166ff2b5c34971e1bbef58.png', // Опытный
            5: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/263/h/4b85845c4e6cd6d3e9b6d3778cbb493c.png'  // Эксперт
        };

        const imageUrlsFemale = {
            1: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/235/h/a6da6f6b1dfdbbb13257d610d7382764.png', // Уровень 1 (жен.)
            2: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/250/h/7f44000bbcdab177e984cff768b9419a.png', // Уровень 2 (жен.)
            3: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/492/h/71a3683daea9ee97bdcecb61dcef8d45.png', // Уровень 3 (жен.)
            4: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/259/h/e0eb9787ccb370906a35f758afef52f5.png', // Уровень 4 (жен.)
            5: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/149/h/407a653e78a8ad63ba3892d8ad3b4553.png'  // Уровень 5 (жен.)
        };

        const imageUrls = gender === 'female' ? imageUrlsFemale : imageUrlsMale;
        const imageUrl = imageUrls[currentLevel.level] || imageUrls[1];
        if (avatarImage.src !== imageUrl) {
            // Add loading class for smooth transition
            avatarImage.classList.add('loading');
            
            // Create new image to preload
            const newImage = new Image();
            newImage.onload = () => {
                avatarImage.src = imageUrl;
                avatarImage.classList.remove('loading');
            };
            newImage.onerror = () => {
                avatarImage.classList.remove('loading');
                console.warn('Failed to load avatar image:', imageUrl);
            };
            newImage.src = imageUrl;
        }
    }
    
    // Update progress info
    const progressTitle = document.getElementById('progress-title');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressTitle) progressTitle.textContent = `Уровень ${currentLevel.level}: ${currentLevel.name}`;
    if (progressFill) progressFill.style.width = `${levelProgress.percentage}%`;
    if (progressText) progressText.textContent = `${levelProgress.current} из ${levelProgress.total} дней`;
    
    // Update bottom level display
    const levelText = document.getElementById('level-text');
    
    if (levelText) levelText.textContent = `Уровень ${currentLevel.level}. ${currentLevel.name}`;
}

// Determine if user currently has active access to exercise programs
function hasActiveAccess() {
    if (!userProfile) return false;
    if (userProfile.has_access === true) return true;
    
    if (userProfile.subscription_valid_until) {
        const expiry = new Date(userProfile.subscription_valid_until);
        if (!Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now()) {
            return true;
        }
    }
    return false;
}

// Update UI of access-dependent elements (e.g. exercises overlay)
function updateAccessUI() {
    const overlay = document.getElementById('exercises-access-overlay');
    if (!overlay) return;
    
    if (hasActiveAccess()) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    } else {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }
}

// Open Telegram bot (or payment link) to purchase access
function openAccessBot() {
    // TODO: замените на реальную ссылку на вашего бота
    const botUrl = 'https://t.me/zdorovoe_telo_appbot?start=pay';
    
    if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.openTelegramLink === 'function') {
        window.Telegram.WebApp.openTelegramLink(botUrl);
    } else {
        window.open(botUrl, '_blank');
    }
}

// Get current level based on completed days
function getCurrentLevel(completedDays) {
    for (let level of PROGRESS_LEVELS) {
        if (completedDays >= level.minDays && completedDays <= level.maxDays) {
            return level;
        }
    }
    return PROGRESS_LEVELS[0];
}

// Get level progress
function getLevelProgress(completedDays, level) {
    const current = completedDays - level.minDays;
    const total = level.maxDays - level.minDays + 1;
    const percentage = Math.min((current / total) * 100, 100);
    
    return { current, total, percentage };
}

// Generate calendar
function generateCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    
    // Clear calendar
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        dayHeader.style.fontWeight = '600';
        dayHeader.style.color = 'rgba(0, 0, 0, 0.6)';
        calendarGrid.appendChild(dayHeader);
    });
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        // Check if this day is completed
        const dayDate = new Date(currentYear, currentMonth, day);
        if (isDayCompleted(dayDate)) {
            dayElement.classList.add('completed');
        }
        
        // Check if this is today
        if (day === today.getDate() && currentMonth === today.getMonth()) {
            dayElement.classList.add('today');
        }
        
        calendarGrid.appendChild(dayElement);
    }
}

// Check if a day is completed
function isDayCompleted(date) {
    if (!userProgress || !Array.isArray(userProgress.completed_days)) return false;
    const target = date.toDateString();
    return userProgress.completed_days.some(d => new Date(d.completed_at).toDateString() === target);
}

// Theme toggle
function toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    const newTheme = isDark ? 'light' : 'dark';
    
    console.log('Toggling theme:', { isDark, newTheme });
    
    document.body.classList.toggle('dark-theme', !isDark);
    SafeStorage.setItem('theme', newTheme);
    
    // Update slider icon
    const themeIcon = document.getElementById('theme-icon-slider');
    if (themeIcon) {
        themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    }
    
    console.log('Theme toggled successfully. Body classes:', document.body.className);
    showToast(`Переключено на ${newTheme === 'dark' ? 'темную' : 'светлую'} тему`, 'info');
}

// Load theme preference
function loadThemePreference() {
    const savedTheme = SafeStorage.getItem('theme') || 'light'; // По умолчанию светлая тема
    const themeIcon = document.getElementById('theme-icon-slider');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeIcon) themeIcon.textContent = '🌙'; // Луна для темной темы
    } else {
        document.body.classList.remove('dark-theme'); // Убеждаемся, что светлая тема активна
        if (themeIcon) themeIcon.textContent = '☀️'; // Солнце для светлой темы
    }
}

// Tab modal functions
function openTabModal(tabName) {
    console.log('Opening tab modal:', tabName);
    const modal = document.getElementById(`${tabName}-modal`);
    console.log('Modal found:', modal);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Load content if needed
        if (tabName === 'progress') {
            updateProgressModal();
        }
    } else {
        console.error('Modal not found:', `${tabName}-modal`);
    }
}

function closeTabModal() {
    document.querySelectorAll('.tab-modal').forEach(modal => {
        modal.classList.add('hidden');
    });
    document.body.style.overflow = '';
}

// Leaderboard removed

// Update progress modal
function updateProgressModal() {
    // Allow rendering even if userProgress isn't loaded yet
    const safeUserProgress = userProgress || {
        completedDays: 0,
        currentStreak: 0,
        completed_days: []
    };
    
    const completedDays = safeUserProgress.completedDays || 0;
    const currentLevel = getCurrentLevel(completedDays);
    const levelProgress = getLevelProgress(completedDays, currentLevel);
    
    // Update modal progress info
    const progressTitle = document.getElementById('progress-title-modal');
    const progressFill = document.getElementById('progress-fill-modal');
    const progressText = document.getElementById('progress-text-modal');
    
    if (progressTitle) progressTitle.textContent = `Уровень ${currentLevel.level}: ${currentLevel.name}`;
    if (progressFill) progressFill.style.width = `${levelProgress.percentage}%`;
    if (progressText) progressText.textContent = `${levelProgress.current} из ${levelProgress.total} дней`;
    
    // Update modal stats
    const completedDaysEl = document.getElementById('completed-days-modal');
    const currentStreakEl = document.getElementById('current-streak-modal');
    
    if (completedDaysEl) completedDaysEl.textContent = completedDays;
    if (currentStreakEl) currentStreakEl.textContent = safeUserProgress.currentStreak || 0;
    
    // Generate calendar for modal
    generateCalendarModal();
}

// Generate calendar for modal
function generateCalendarModal() {
    const calendarGrid = document.getElementById('calendar-grid-modal');
    if (!calendarGrid) return;
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    
    // Clear calendar
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        dayHeader.style.fontWeight = '600';
        dayHeader.style.color = 'rgba(0, 0, 0, 0.6)';
        calendarGrid.appendChild(dayHeader);
    });
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        // Check if this day is completed
        const dayDate = new Date(currentYear, currentMonth, day);
        if (isDayCompleted(dayDate)) {
            dayElement.classList.add('completed');
        }
        
        // Check if this is today
        if (day === today.getDate() && currentMonth === today.getMonth()) {
            dayElement.classList.add('today');
        }
        
        calendarGrid.appendChild(dayElement);
    }
}

window.initializeHomepage = initializeHomepage;
window.toggleTheme = toggleTheme;
window.openTabModal = openTabModal;
window.closeTabModal = closeTabModal;

// Debug: Check if functions are available
console.log('Functions exported:', {
    editProgram: typeof window.editProgram,
    deleteProgram: typeof window.deleteProgram,
    toggleProgramPublished: typeof window.toggleProgramPublished,
    addNewProgram: typeof window.addNewProgram,
    openTabModal: typeof window.openTabModal,
    closeTabModal: typeof window.closeTabModal
});
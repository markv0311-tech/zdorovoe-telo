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

// Динамическое масштабирование для главного экрана
function updateAdaptiveScale() {
    const root = document.documentElement;
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    
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
    
    // Применяем масштабирование к основным элементам главного экрана
    const elements = {
        '.top-header-container': {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: `calc(15.444vh + 13.2px)`, // Используем наше значение из CSS
            zIndex: '1000',
            pointerEvents: 'none',
            padding: `${10 * scaleFactor}px ${15 * scaleFactor}px`,
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
        '.progress-tab': {
            position: 'absolute',
            top: `${10 * scaleFactor}px`,
            right: `${10 * scaleFactor}px`
        },
        '.leaderboard-tab': {
            position: 'absolute',
            bottom: `${10 * scaleFactor}px`,
            right: `${10 * scaleFactor}px`
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
            bottom: `${120 * scaleFactor}px`, // Между изображением и меню
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'auto',
            minWidth: `${200 * scaleFactor}px`,
            display: 'flex',
            justifyContent: 'center',
            padding: `${12 * scaleFactor}px ${20 * scaleFactor}px`,
            zIndex: '1000'
        },
        // Удалено - изображение будет управляться только через CSS контейнера
        '.human-avatar-center': {
            top: 'calc(15.444vh + 13.2px)', // Используем наше значение из CSS
            left: '10px',
            width: 'calc(100% - 20px)',
            bottom: '180px',
            padding: '10px',
            borderRadius: '12px'
        },
        '.navbar': {
            position: 'fixed',
            bottom: `${20 * scaleFactor}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: `${80 * scaleFactor}%`,
            background: 'rgba(135, 206, 250, 0.15)', // Голубой цвет для жидкого стекла
            backdropFilter: 'blur(20px)',
            borderRadius: `${20 * scaleFactor}px`,
            border: '1px solid rgba(135, 206, 250, 0.3)',
            display: 'flex',
            justifyContent: 'space-around',
            padding: `${6 * scaleFactor}px ${8 * scaleFactor}px`,
            zIndex: '1000',
            boxShadow: '0 8px 32px rgba(135, 206, 250, 0.2)'
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
        '.avatar-image': {
            transform: 'scale(1.024)' // Используем наше значение из CSS
        }
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

// Supabase client
let supabase = null;

// Переопределяем console.log для автоматического добавления DEBUG флага
const originalLog = console.log;
console.log = function(...args) {
    if (DEBUG) {
        Logger.log(...args);
    }
};

const originalError = console.error;
console.error = function(...args) {
    Logger.error(...args);
};

const originalWarn = console.warn;
console.warn = function(...args) {
    Logger.warn(...args);
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
        const { data, error } = await supabase
            .from('programs')
            .insert([payload])
            .select()
            .single();
        if (error) throw error;
        return data;
    }
    
    if (method === 'PUT' && path.startsWith('/programs/')) {
        const programId = path.split('/')[2];
        const { data, error } = await supabase
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
        const { error } = await supabase
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
        const { data: program, error } = await supabase
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
                            <label class="checkbox-label">
                                <input type="checkbox" id="edit-published" ${program.is_published ? 'checked' : ''}>
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
        const { data: program, error: fetchError } = await supabase
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
        // Get program info
        const { data: program, error: programError } = await supabase
            .from('programs')
            .select('*')
            .eq('id', programId)
            .single();
        
        if (programError) throw programError;
        
        // Get program days
        const { data: days, error: daysError } = await supabase
            .from('program_days')
            .select('*')
            .eq('program_id', programId)
            .order('day_index');
        
        if (daysError) throw daysError;
        
        // Open days management modal
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        if (modal && modalBody) {
            modalBody.innerHTML = `
                <div class="program-days-management">
                    <h2 style="color: #2c3e50; margin-bottom: 20px; font-size: 20px;">Управление днями: ${program.title}</h2>
                    
                    <div style="margin-bottom: 20px;">
                        <button data-action="day-add" data-id="${programId}" class="btn btn-primary" style="margin-bottom: 15px;">
                            ➕ Добавить день
                        </button>
                    </div>
                    
                    <div id="days-list" style="max-height: 400px; overflow-y: auto;">
                        ${days.map(day => `
                            <div class="day-item" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: white;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 5px 0; color: #2c3e50;">День ${day.day_index}</h4>
                                        <p style="margin: 0; color: #999; font-size: 12px;">ID: ${day.id}</p>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button data-action="day-exercises" data-id="${day.id}" style="padding: 6px 10px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Упражнения</button>
                                        <button data-action="day-edit" data-id="${day.id}" style="padding: 6px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Редактировать</button>
                                        <button data-action="day-delete" data-id="${day.id}" style="padding: 6px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Удалить</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="loadDeveloperPrograms()">
                            ← Назад к программам
                        </button>
                    </div>
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
        console.error('Failed to load program days:', error);
        showToast('Ошибка загрузки дней: ' + error.message, 'error');
    }
}

async function handleAddDay(programId) {
    console.log('handleAddDay called with program ID:', programId);
    showToast('Добавляем новый день...', 'info');
    
    try {
        // Get next day_index
        const { data: maxDay } = await supabase
            .from('program_days')
            .select('day_index')
            .eq('program_id', programId)
            .order('day_index', { ascending: false })
            .limit(1)
            .single();
        
        const nextDayIndex = (maxDay?.day_index || 0) + 1;
        
        const { data, error } = await supabase
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
        const { data: day, error } = await supabase
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
        const { data: day } = await supabase
            .from('program_days')
            .select('program_id')
            .eq('id', dayId)
            .single();
        
        const { error } = await supabase
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
        
        const { data, error } = await supabase
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
        const { data: day } = await supabase
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
        const { data: day, error: dayError } = await supabase
            .from('program_days')
            .select('*, programs(title)')
            .eq('id', dayId)
            .single();
        
        if (dayError) throw dayError;
        
        // Get exercises for this day
        const { data: exercises, error: exercisesError } = await supabase
            .from('exercises')
            .select('*')
            .eq('program_day_id', dayId)
            .order('order_index');
        
        if (exercisesError) throw exercisesError;
        
        // Open exercises management modal
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
        if (modal && modalBody) {
            modalBody.innerHTML = `
                <div class="exercises-management">
                    <h2 style="color: #2c3e50; margin-bottom: 20px; font-size: 20px;">Упражнения: ${day.programs.title} - День ${day.day_index}</h2>
                    
                    <div style="margin-bottom: 20px;">
                        <button data-action="exercise-add" data-id="${dayId}" class="btn btn-primary" style="margin-bottom: 15px;">
                            ➕ Добавить упражнение
                        </button>
                    </div>
                    
                    <div id="exercises-list" style="max-height: 400px; overflow-y: auto;">
                        ${exercises.map(exercise => `
                            <div class="exercise-item" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: white;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${exercise.order_index}. ${exercise.title}</h4>
                                        <p style="margin: 0 0 5px 0; color: #6c757d; font-size: 14px;">${exercise.description || 'Без описания'}</p>
                                        ${exercise.video_url ? `<p style="margin: 0; color: #007bff; font-size: 12px;">📹 ${exercise.video_url}</p>` : ''}
                                        <p style="margin: 0; color: #999; font-size: 12px;">ID: ${exercise.id}</p>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button data-action="exercise-edit" data-id="${exercise.id}" style="padding: 6px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Редактировать</button>
                                        <button data-action="exercise-delete" data-id="${exercise.id}" style="padding: 6px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Удалить</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="handleProgramDays('${day.program_id}')">
                            ← Назад к дням
                        </button>
                    </div>
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
            userProgress = JSON.parse(cachedProgress);
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
    if (user?.id) {
        loadUserProgress();
        loadUserProfile();
    }
    
    // Ensure only one HTML5 video plays at a time
    setupExclusiveVideoPlayback();
    
    // Lock orientation to portrait on main screen only
    setupOrientationLock();
    
    console.log('App initialization complete');
});

// Initialize Supabase
function initializeSupabase() {
    try {
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase) {
            supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            console.log('Supabase client initialized');
        } else {
            console.warn('Supabase configuration not found, using fallback data');
        }
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
    }
}

// Initialize Telegram WebApp
function initializeTelegram() {
    if (tg) {
    tg.ready();
    tg.expand();
    
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
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('dev') === '1') {
            console.log('Local dev mode - showing developer button');
            isEditor = true;
            showDeveloperButton();
        } else {
            showBrowserDevMode();
        }
    }
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
    
    // TEMPORARY: Always enable editor mode for testing
    console.log('[TEMP] Enabling editor mode for all users');
    isEditor = true;
    showDeveloperButton();
    return;
    
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
        
        // Lock orientation to portrait when on main screen
        const lockOrientation = async () => {
            if (isMainScreen() && 'screen' in window && 'orientation' in screen) {
                try {
                    await screen.orientation.lock('portrait');
                    console.log('Orientation locked to portrait on main screen');
                } catch (err) {
                    console.warn('Could not lock orientation:', err);
                }
            }
        };
        
        // Unlock orientation when leaving main screen
        const unlockOrientation = async () => {
            if (!isMainScreen() && 'screen' in window && 'orientation' in screen) {
                try {
                    await screen.orientation.unlock();
                    console.log('Orientation unlocked');
                } catch (err) {
                    console.warn('Could not unlock orientation:', err);
                }
            }
        };
        
        // Lock on page load if on main screen
        lockOrientation();
        
        // Listen for orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (isMainScreen()) {
                    lockOrientation();
                } else {
                    unlockOrientation();
                }
            }, 100);
        });
        
        // Listen for section changes
        const sectionObserver = new MutationObserver(() => {
            setTimeout(() => {
                if (isMainScreen()) {
                    lockOrientation();
                } else {
                    unlockOrientation();
                }
            }, 100);
        });
        
        // Observe changes to section classes
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => {
            sectionObserver.observe(section, { attributes: true, attributeFilter: ['class'] });
        });
        
        // Listen for modal changes
        const modalObserver = new MutationObserver(() => {
            if (isMainScreen()) {
                lockOrientation();
            } else {
                unlockOrientation();
            }
        });
        
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
        const { data, error } = await supabase
            .rpc('get_user_progress', { p_tg_user_id: user.id });

        console.log('Supabase response - data:', data);
        console.log('Supabase response - error:', error);

        if (error) {
            console.error('Error loading user progress:', error);
            return;
        }

        if (data) {
            userProgress = data;
            // Normalize fields to what UI expects (camel helpers)
            userProgress.completedDays = Array.isArray(userProgress.completed_days) ? userProgress.completed_days.length : 0;
            userProgress.currentStreak = userProgress.level_info?.current_streak || 0;
            userProgress.totalDays = userProgress.level_info?.total_days || 0;
            userProgress.longestStreak = userProgress.level_info?.longest_streak || 0;
            console.log('User progress loaded from database:', userProgress);
            
            // Store in localStorage for persistence
            localStorage.setItem('userProgress', JSON.stringify(userProgress));
        } else {
            console.log('No progress data found, initializing empty progress');
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
            // Derived helpers
            userProgress.completedDays = 0;
            userProgress.currentStreak = 0;
            userProgress.totalDays = 0;
            userProgress.longestStreak = 0;
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

        const { data, error } = await supabase
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
                const today = new Date();
                const completedDay = {
                    program_id: parseInt(programId),
                    day_index: dayIndex,
                    completed_at: today.toISOString()
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
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    // Create completed days map for quick lookup
    const completedDays = new Map();
    if (userProgress.completed_days) {
        userProgress.completed_days.forEach(day => {
            const date = new Date(day.completed_at);
            const dayOfMonth = date.getDate();
            completedDays.set(dayOfMonth, true);
        });
    }
    
    // Generate calendar HTML
    let calendarHTML = '';
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const isCompleted = completedDays.has(day);
        const isToday = day === today.getDate();
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
                
                // Check if this day is completed
                const isCompleted = userProgress.completed_days.some(day => 
                    day.program_id === programId && 
                    day.day_index === dayIndex && 
                    new Date(day.completed_at).toDateString() === new Date().toDateString()
                );
                
                if (isCompleted) {
                    button.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                    button.style.color = 'white';
                    button.style.borderColor = '#28a745';
                    button.innerHTML = `День ${dayIndex} ✅`;
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
    
    const today = new Date().toDateString();
    
    // Check if ANY day was completed today (not just this specific day)
    return userProgress.completed_days.some(day => 
        new Date(day.completed_at).toDateString() === today
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
    if (supabase) {
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
    if (!supabase) return;
    
    console.log('Loading programs from Supabase...');
    
    // Load published programs only (lazy loading - no days/exercises yet)
    const { data: programsData, error: programsError } = await supabase
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
    if (!supabase) return [];
    
    try {
        console.log(`Loading days for program ${programId}...`);
        const { data: daysData, error: daysError } = await supabase
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
    if (!supabase) return [];
    
    try {
        console.log(`Loading exercises for day ${dayId}...`);
        const { data: exercisesData, error: exercisesError } = await supabase
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
        programCard.innerHTML = `
            <img src="${program.image_url}" alt="${program.title}" class="program-image">
            <div class="program-content">
                <h3 class="program-title">${program.title}</h3>
                <p class="program-description">${program.description}</p>
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
        modalBody.innerHTML = `
            <div class="program-detail">
                <img src="${program.image_url}" alt="${program.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px; margin-bottom: 20px;">
                <h2 style="color: #2c3e50; margin-bottom: 15px; font-size: 20px;">${program.title}</h2>
                <p style="color: #6c757d; margin-bottom: 25px; line-height: 1.6;">${program.description}</p>
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
        
        if (supabase) {
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
        
        if (supabase) {
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
}

// Load user data
function loadUserData() {
    // Load saved profile data
    if (userProfile.name) {
        document.getElementById('user-name').value = userProfile.name;
    }
    if (userProfile.birthdate) {
        document.getElementById('user-birthdate').value = userProfile.birthdate;
    }
    if (userProfile.problem) {
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
        const { data: programsData, error: programsError } = await supabase
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
            const { data: programData, error: programError } = await supabase
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
                const { data: dayData, error: dayError } = await supabase
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
                    const { error: exerciseError } = await supabase
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
        const { data: program, error } = await supabase
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
        
        const { error } = await supabase
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
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        console.log('Current user:', user);
        
        if (authError) {
            console.error('Auth error:', authError);
        }
        
        // First check if program exists
        const { data: program, error: fetchError } = await supabase
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
        const { data: deleteData, error: deleteError } = await supabase
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
        const { data: program, error: fetchError } = await supabase
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
        const { error: updateError } = await supabase
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
        
        const { data: newProgram, error } = await supabase
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
        const { data: maxExercise } = await supabase
            .from('exercises')
            .select('order_index')
            .eq('program_day_id', dayId)
            .order('order_index', { ascending: false })
            .limit(1)
            .single();
        
        const nextOrderIndex = (maxExercise?.order_index || 0) + 1;
        
        const { data, error } = await supabase
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
        const { data: exercise, error } = await supabase
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
        
        const { data, error } = await supabase
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
        const { data: exercise } = await supabase
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
        const { data: exercise } = await supabase
            .from('exercises')
            .select('program_day_id')
            .eq('id', exerciseId)
            .single();
        
        const { error } = await supabase
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

        const { data, error } = await supabase
            .rpc('get_user_profile', { p_tg_user_id: user.id });

        if (error) {
            console.error('Error loading user profile:', error);
            return;
        }

        if (data && Object.keys(data).length > 0) {
            userProfile = data;
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
                problem: ''
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
        
        // Validate required fields
        if (!firstName) {
            showNotification('Пожалуйста, введите имя', 'warning');
            return;
        }
        
        if (!age || age < 1 || age > 120) {
            showNotification('Пожалуйста, введите корректный возраст (1-120 лет)', 'warning');
            return;
        }
        
        if (!gender) {
            showNotification('Пожалуйста, выберите пол', 'warning');
            return;
        }
        
        if (!problem) {
            showNotification('Пожалуйста, выберите проблемную зону', 'warning');
            return;
        }

        // Show loading state
        const saveButton = document.querySelector('.save-button');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Сохранение...';
        }

        const { data, error } = await supabase
            .rpc('save_user_profile', {
                p_tg_user_id: user.id,
                p_username: user.username || '',
                p_first_name: firstName,
                p_last_name: user.last_name || '',
                p_age: age,
                p_gender: gender,
                p_problem: problem
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
            console.log('User profile loaded from cache:', userProfile);
            populateProfileForm();
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
            userProgress = JSON.parse(cachedProgress);
            console.log('User progress loaded from cache:', userProgress);
            updateProgressUI();
            updateCalendarHighlighting();
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
    
    // Stop all videos before starting new diagnostic
    stopAllVideos();
    
    // Get module data
    const moduleData = diagnosisModules[module];
    if (!moduleData || moduleData.videos.length === 0) {
        showToast('Видео для диагностики не найдены', 'error');
        return;
    }
    
    // If only one video, show it directly
    if (moduleData.videos.length === 1) {
        showDiagnosticVideo(module, moduleData.videos[0].url);
        return;
    }
    
    // If multiple videos, show selection modal
    showDiagnosticVideoSelection(module, moduleData);
}

// Show diagnostic video selection modal
function showDiagnosticVideoSelection(module, moduleData) {
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    
    if (modal && modalBody) {
        modalBody.innerHTML = `
            <div class="diagnostic-video-selection">
                <h2 style="color: #2c3e50; margin-bottom: 20px;">🔍 Диагностика: ${moduleData.name}</h2>
                <p style="color: #6c757d; margin-bottom: 25px;">Выберите видео для диагностики</p>
                
                <div class="video-selection-list" style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px;">
                    ${moduleData.videos.map((video, index) => `
                        <div class="video-selection-item" style="display: flex; align-items: center; padding: 15px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;" 
                             onclick="selectDiagnosticVideo('${module}', ${video.id})"
                             onmouseover="this.style.borderColor='#007bff'; this.style.backgroundColor='#e3f2fd';"
                             onmouseout="this.style.borderColor='#e9ecef'; this.style.backgroundColor='#f8f9fa';">
                            <div style="background: #007bff; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">
                                ${video.order}
                            </div>
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 5px 0; color: #2c3e50; font-size: 16px;">${video.title}</h4>
                                <p style="margin: 0; color: #6c757d; font-size: 14px;">Нажмите для просмотра</p>
                            </div>
                            <div style="color: #007bff; font-size: 20px;">▶</div>
                        </div>
                    `).join('')}
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="closeDiagnosticModal()" style="flex: 1;">Отмена</button>
                </div>
            </div>
        `;
        
        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.background = 'rgba(0,0,0,0.5)';
        document.body.style.overflow = 'hidden';
    }
}

// Select diagnostic video
function selectDiagnosticVideo(module, videoId) {
    const moduleData = diagnosisModules[module];
    const video = moduleData.videos.find(v => v.id === videoId);
    
    if (video) {
        showDiagnosticVideo(module, video.url);
    } else {
        showToast('Видео не найдено', 'error');
    }
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
    // Stop all videos before showing new diagnostic video
    stopAllVideos();
    
    const moduleName = getModuleName(module);
    const moduleData = diagnosisModules[module];
    
    // Convert Kinoscope links to proper iframe format
    let videoHTML;
    if (videoUrl.includes('kinescope.io/') && !videoUrl.includes('/embed/')) {
        // Convert direct Kinoscope link to embed format
        const videoId = videoUrl.split('/').pop();
        const embedUrl = `https://kinescope.io/embed/${videoId}`;
        
        videoHTML = `
            <div class="video-container-universal">
                <div style="position: relative; padding-top: 56.25%; width: 100%; border-radius: 10px; overflow: hidden;">
                    <iframe class="exercise-video" 
                            src="${embedUrl}" 
                            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;"
                            frameborder="0" 
                            allowfullscreen
                            style="position: absolute; width: 100%; height: 100%; top: 0; left: 0;">
                    </iframe>
                </div>
            </div>
        `;
    } else if (videoUrl.includes('kinescope.io/embed/')) {
        // Already in embed format, use responsive wrapper
        videoHTML = `
            <div class="video-container-universal">
                <div style="position: relative; padding-top: 56.25%; width: 100%; border-radius: 10px; overflow: hidden;">
                    <iframe class="exercise-video" 
                            src="${videoUrl}" 
                            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;"
                            frameborder="0" 
                            allowfullscreen
                            style="position: absolute; width: 100%; height: 100%; top: 0; left: 0;">
                    </iframe>
                </div>
            </div>
        `;
    } else {
        // For other video types (YouTube, etc.) use existing format
        videoHTML = `
            <div class="video-container-universal">
                <iframe class="exercise-video" 
                        src="${videoUrl}" 
                        frameborder="0" 
                        allowfullscreen
                        style="width: 100%; height: 300px; border-radius: 10px;">
                </iframe>
            </div>
        `;
    }
    
    // Show diagnostic modal with video
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    
    if (modal && modalBody) {
        // Determine if we should show "back to selection" or "back to diagnostics"
        const hasMultipleVideos = moduleData && moduleData.videos.length > 1;
        const backButtonText = hasMultipleVideos ? 'Назад к выбору' : 'Назад';
        const backButtonAction = hasMultipleVideos ? `showDiagnosticVideoSelection('${module}', diagnosisModules['${module}'])` : 'goToDiagnostics()';
        
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
window.showDiagnosticVideoSelection = showDiagnosticVideoSelection;
window.selectDiagnosticVideo = selectDiagnosticVideo;

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
        // Удалены принудительные стили - это задача CSS
        // You can change the image source based on the level
        // For now, we'll keep the same image but you can add different images for different levels
            const imageUrls = {
                1: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/130/h/83ad7f33a185d049619b8a1b01c4c02d.png', // Новичок
                2: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/130/h/83ad7f33a185d049619b8a1b01c4c02d.png', // Начинающий
                3: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/130/h/83ad7f33a185d049619b8a1b01c4c02d.png', // Продвинутый
                4: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/130/h/83ad7f33a185d049619b8a1b01c4c02d.png', // Опытный
                5: 'https://fs.getcourse.ru/fileservice/file/download/a/612441/sc/130/h/83ad7f33a185d049619b8a1b01c4c02d.png'  // Эксперт
            };
        
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
        if (tabName === 'leaderboard') {
            loadLeaderboardModal();
        } else if (tabName === 'progress') {
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

// Load leaderboard data for modal
function loadLeaderboardModal() {
    const leaderboardList = document.getElementById('leaderboard-list-modal');
    if (!leaderboardList) return;
    
    // Mock data for now - will be replaced with real data from Supabase
    const mockLeaderboard = [
        { rank: 1, name: 'Алексей', days: 45, avatar: '🏆' },
        { rank: 2, name: 'Мария', days: 38, avatar: '🥈' },
        { rank: 3, name: 'Дмитрий', days: 32, avatar: '🥉' },
        { rank: 4, name: 'Анна', days: 28, avatar: '💪' },
        { rank: 5, name: 'Сергей', days: 25, avatar: '🏃‍♂️' }
    ];
    
    leaderboardList.innerHTML = '';
    
    mockLeaderboard.forEach(user => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        const rankClass = user.rank <= 3 ? `top-${user.rank}` : '';
        
        item.innerHTML = `
            <div class="leaderboard-rank ${rankClass}">${user.rank}</div>
            <div class="leaderboard-avatar">${user.avatar}</div>
            <div class="leaderboard-info">
                <p class="leaderboard-name">${user.name}</p>
                <p class="leaderboard-days">${user.days} дней</p>
            </div>
        `;
        
        leaderboardList.appendChild(item);
    });
}

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
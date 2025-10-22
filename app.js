// Telegram WebApp initialization
let tg = window.Telegram?.WebApp;
let user = null;
let currentMonth = new Date();
let programs = [];
let userProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
let userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
let isDeveloperMode = false;
let isEditor = false;

// Supabase client
let supabase = null;

// Cache system
const CACHE_KEYS = {
    PROGRAMS: 'zdorovoe_telo_programs',
    PROGRAM_DAYS: 'zdorovoe_telo_program_days',
    EXERCISES: 'zdorovoe_telo_exercises',
    LAST_SYNC: 'zdorovoe_telo_last_sync'
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache functions
function getCacheData(key) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        const now = Date.now();
        
        if (data.timestamp && (now - data.timestamp) < CACHE_DURATION) {
            console.log(`[Cache] Hit for ${key}`);
            return data.value;
        } else {
            console.log(`[Cache] Expired for ${key}`);
            localStorage.removeItem(key);
            return null;
        }
    } catch (error) {
        console.error(`[Cache] Error reading ${key}:`, error);
        return null;
    }
}

function setCacheData(key, value) {
    try {
        const data = {
            value: value,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`[Cache] Stored ${key}`);
    } catch (error) {
        console.error(`[Cache] Error storing ${key}:`, error);
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
                    <h2 style="color: #2c3e50; margin-bottom: 20px;">Управление днями: ${program.title}</h2>
                    
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
                                        <p style="margin: 0 0 5px 0; color: #6c757d; font-size: 14px;">${day.title || 'Без названия'}</p>
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
                day_index: nextDayIndex,
                title: `День ${nextDayIndex}`
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
                            <label>Название дня</label>
                            <input type="text" id="edit-day-title" value="${day.title}" required>
                        </div>
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
        const title = document.getElementById('edit-day-title').value;
        const dayIndex = parseInt(document.getElementById('edit-day-index').value);
        
        if (!title.trim()) {
            showToast('Название дня обязательно', 'error');
            return;
        }
        
        showToast('Сохраняем день...', 'info');
        
        const { data, error } = await supabase
            .from('program_days')
            .update({
                title: title.trim(),
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
                    <h2 style="color: #2c3e50; margin-bottom: 20px;">Упражнения: ${day.programs.title} - День ${day.day_index}</h2>
                    
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
    loadUserData();
    
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
        
        // Set up theme
        if (tg.colorScheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        
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
            navigateToSection(section);
        });
    });
    
    // Load user profile if available
    if (user) {
        document.getElementById('user-name').value = user.first_name || '';
        if (user.last_name) {
            document.getElementById('user-name').value += ' ' + user.last_name;
        }
    }
    
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
    
    // Initialize calendar
    updateCalendar();
    updateProgressStats();
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
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
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
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
    
    // Load section-specific content
    if (sectionName === 'reports') {
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
    document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;
    
    // Generate calendar grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const calendarGrid = document.getElementById('calendar-grid');
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
        
        // Check if this day is completed
        const dateKey = dayElement.dataset.date;
        if (userProgress[dateKey]) {
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
    const date = dayElement.dataset.date;
    if (!date) return;
    
    const isCompleted = dayElement.classList.contains('completed');
    console.log('Toggling day completion for:', date, 'currently completed:', isCompleted);
    
    if (isCompleted) {
        dayElement.classList.remove('completed');
        delete userProgress[date];
    } else {
        dayElement.classList.add('completed');
        userProgress[date] = true;
    }
    
    // Save progress locally only
    localStorage.setItem('userProgress', JSON.stringify(userProgress));
    console.log('Progress saved to localStorage:', userProgress);
    updateProgressStats();
}

function updateProgressStats() {
    const completedDays = Object.keys(userProgress).length;
    document.getElementById('completed-days').textContent = completedDays;
    
    // Calculate current streak
    const today = new Date();
    let streak = 0;
    let checkDate = new Date(today);
    
    while (true) {
        const dateKey = checkDate.toISOString().split('T')[0];
        if (userProgress[dateKey]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    document.getElementById('current-streak').textContent = streak;
}

// Programs data
async function loadPrograms() {
    // Try cache first
    const cachedPrograms = getCacheData(CACHE_KEYS.PROGRAMS);
    if (cachedPrograms) {
        console.log('[Load] Using cached programs');
        programs = cachedPrograms;
        renderPrograms();
        return;
    }
    
    // Load from Supabase if no cache
    if (supabase) {
        try {
            await loadProgramsFromSupabase();
        } catch (error) {
            console.error('Failed to load programs from Supabase:', error);
            showToast('Ошибка загрузки программ. Используются локальные данные.', 'error');
            loadDefaultPrograms();
        }
    } else {
        loadDefaultPrograms();
    }
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
    const programsGrid = document.getElementById('programs-grid');
    programsGrid.innerHTML = '';
    
    // Only show published programs in public view
    const publishedPrograms = programs.filter(program => program.is_published);
    
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
                <h2 style="color: #2c3e50; margin-bottom: 15px;">${program.title}</h2>
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
            // Find program in cached data
            program = programs.find(p => p.id === programId);
            if (!program) {
                // Try to reload programs if not found in cache
                console.log('Program not found in cache, reloading...');
                await loadProgramsFromSupabase();
                program = programs.find(p => p.id === programId);
                if (!program) throw new Error('Program not found');
            }
            
            // Lazy load days
            const daysData = await loadProgramDays(programId);
            program.days = daysData;
        } else {
            // Fallback to local data
            program = programs.find(p => p.id === programId);
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
                    <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">${program.title}</h2>
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
            // Find program in cached data
            program = programs.find(p => p.id === programId);
            if (!program) throw new Error('Program not found');
            
            // Lazy load days if not already loaded
            if (!program.days) {
                program.days = await loadProgramDays(programId);
            }
            
            // Find the specific day
            day = program.days.find(d => d.day_index === dayIndex);
            if (!day) throw new Error(`Day ${dayIndex} not found`);
            
            // Lazy load exercises for this day
            exercises = await loadDayExercises(day.id);
        } else {
            // Fallback to local data
            program = programs.find(p => p.id === programId);
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
                    <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">${program.title}</h2>
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
                            videoHTML = `<iframe class="exercise-video" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
                        } else {
                            videoHTML = `<a href="${exercise.video_url}" target="_blank" class="video-link" style="display: block; padding: 20px; background: #f8f9fa; border-radius: 10px; text-align: center; color: #007bff; text-decoration: none; font-weight: 600;">📹 Открыть видео</a>`;
                        }
                    } else if (exercise.video_url.includes('youtube.com/embed')) {
                        // Already embed format
                        videoHTML = `<iframe class="exercise-video" src="${exercise.video_url}" frameborder="0" allowfullscreen></iframe>`;
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
                            // Direct video file - use HTML5 video player
                            videoHTML = `
                                <div class="getcourse-video-container" style="margin: 10px 0;">
                                    <video class="exercise-video" controls preload="none" style="width: 100%; max-width: 100%; height: 200px; border-radius: 10px;">
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
                                            src="${embedUrl}" 
                                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; background: transparent;" 
                                            frameborder="0" 
                                            allowfullscreen
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
                            videoHTML = `<iframe class="exercise-video" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allowfullscreen></iframe>`;
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
            
            modalBody.innerHTML = exercisesHTML;
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
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
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Close all modals function
function closeAllModals() {
    console.log('Closing all modals...');
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
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    console.log('Profile saved to localStorage:', userProfile);
    
    // Show success message
    const button = document.querySelector('.save-button');
    const originalText = button.textContent;
    button.textContent = 'Сохранено!';
    button.style.background = '#28a745';
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
    }, 2000);
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
    
    document.getElementById('subscription-date').textContent = 
        subscriptionDate.toLocaleDateString('ru-RU');
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

// Export all functions for global access
window.navigateToSection = navigateToSection;
window.changeMonth = changeMonth;
window.openProgramModal = openProgramModal;
window.closeProgramModal = closeProgramModal;
window.openDaySelection = openDaySelection;
window.openExerciseModule = openExerciseModule;
window.closeExerciseModal = closeExerciseModal;
window.closeAllModals = closeAllModals;
window.killAllModals = killAllModals;
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

// Debug: Check if functions are available
console.log('Functions exported:', {
    editProgram: typeof window.editProgram,
    deleteProgram: typeof window.deleteProgram,
    toggleProgramPublished: typeof window.toggleProgramPublished,
    addNewProgram: typeof window.addNewProgram
});
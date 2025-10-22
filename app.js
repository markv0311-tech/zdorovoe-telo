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

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing app...');
    
    // Initialize Supabase
    initializeSupabase();
    
    // Initialize Telegram and check editor status
    initializeTelegram();
    
    // Initialize app components
    initializeApp();
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
            showToast('Откройте приложение из Telegram-бота.', 'error');
        }
    }
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
    
    // Load published programs
    const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('*')
        .eq('is_published', true)
        .order('id');
    
    if (programsError) {
        throw new Error(`Failed to load programs: ${programsError.message}`);
    }
    
    // Load days for each program
    for (let program of programsData) {
        const { data: daysData, error: daysError } = await supabase
            .from('program_days')
            .select('*')
            .eq('program_id', program.id)
            .order('day_index');
        
        if (daysError) {
            console.warn(`Failed to load days for program ${program.id}:`, daysError.message);
            program.days = [];
            continue;
        }
        
        // Load exercises for each day
        for (let day of daysData) {
            const { data: exercisesData, error: exercisesError } = await supabase
                .from('exercises')
                .select('*')
                .eq('program_day_id', day.id)
                .order('order_index');
            
            if (exercisesError) {
                console.warn(`Failed to load exercises for day ${day.id}:`, exercisesError.message);
                day.exercises = [];
            } else {
                day.exercises = exercisesData;
            }
        }
        
        program.days = daysData;
    }
    
    programs = programsData;
    console.log('Programs loaded from Supabase:', programs.length);
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
        modalBody.innerHTML = `
            <div class="program-detail">
                <img src="${program.image_url}" alt="${program.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px; margin-bottom: 20px;">
                <h2 style="color: #2c3e50; margin-bottom: 15px;">${program.title}</h2>
                <p style="color: #6c757d; margin-bottom: 25px; line-height: 1.6;">${program.description}</p>
                <p style="color: #007bff; font-weight: 600; margin-bottom: 25px;">Программа рассчитана на ${program.days.length} дней, по ${program.days[0]?.exercises.length || 0} упражнений в день</p>
                <button class="cta-button" onclick="openDaySelection('${program.id}')" style="width: 100%;">
                    Выбрать программу
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
        modal.style.display = 'block';
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
            // Load from Supabase
            const { data: programData, error: programError } = await supabase
                .from('programs')
                .select('*')
                .eq('id', programId)
                .single();
            
            if (programError) throw new Error(`Program not found: ${programError.message}`);
            program = programData;
            
            // Load days
            const { data: daysData, error: daysError } = await supabase
                .from('program_days')
                .select('*')
                .eq('program_id', programId)
                .order('day_index');
            
            if (daysError) throw new Error(`Days not found: ${daysError.message}`);
            program.days = daysData;
        } else {
            // Fallback to local data
            program = programs.find(p => p.id === programId);
            if (!program) throw new Error('Program not found');
        }
        
        closeProgramModal();
        
        const modal = document.getElementById('program-modal');
        const modalBody = document.getElementById('program-modal-body');
        
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
            // Load from Supabase
            const { data: programData, error: programError } = await supabase
                .from('programs')
                .select('*')
                .eq('id', programId)
                .single();
            
            if (programError) throw new Error(`Program not found: ${programError.message}`);
            program = programData;
            
            const { data: dayData, error: dayError } = await supabase
                .from('program_days')
                .select('*')
                .eq('program_id', programId)
                .eq('day_index', dayIndex)
                .single();
            
            if (dayError) throw new Error(`Day not found: ${dayError.message}`);
            day = dayData;
            
            const { data: exercisesData, error: exercisesError } = await supabase
                .from('exercises')
                .select('*')
                .eq('program_day_id', day.id)
                .order('order_index');
            
            if (exercisesError) throw new Error(`Exercises not found: ${exercisesError.message}`);
            exercises = exercisesData;
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
                // Check if it's a YouTube URL and convert to embed format
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
                    } else {
                        // Other video platforms (GetCourse, Vimeo, etc.) - show as link
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
            programDiv.className = 'dev-program-item';
            programDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px;';
            
            programDiv.innerHTML = `
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${program.title} ${program.is_published ? '✅' : '❌'}</h4>
                    <p style="margin: 0 0 5px 0; color: #6c757d; font-size: 14px;">${program.description || 'Без описания'}</p>
                    <small style="color: #999;">ID: ${program.id} | Slug: ${program.slug}</small>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button onclick="if(typeof editProgram === 'function') { editProgram(${program.id}); } else { alert('Функция editProgram не найдена'); }" style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Редактировать</button>
                    <button onclick="if(typeof toggleProgramPublished === 'function') { toggleProgramPublished(${program.id}); } else { alert('Функция toggleProgramPublished не найдена'); }" style="padding: 8px 12px; background: ${program.is_published ? '#dc3545' : '#28a745'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">${program.is_published ? 'Скрыть' : 'Опубликовать'}</button>
                    <button onclick="if(typeof deleteProgram === 'function') { deleteProgram(${program.id}); } else { alert('Функция deleteProgram не найдена'); }" style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Удалить</button>
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
// Telegram WebApp initialization
let tg = window.Telegram.WebApp;
let user = null;
let currentMonth = new Date();
let programs = [];
let userProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
let userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
let isDeveloperMode = false;
let developerContent = JSON.parse(localStorage.getItem('dev_content') || '{}');

// Supabase client
let supabase = null;
let isAuthenticated = false;

// Static frontend configuration

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing app...');
    
    // Initialize Supabase
    initializeSupabase();
    
    // Kill-switch: Force hide ALL modals and overlays on startup
    ['pin-modal', 'subscription-overlay', 'developer-panel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    // Also hide program and exercise modals
    const programModal = document.getElementById('program-modal');
    const exerciseModal = document.getElementById('exercise-modal');
    if (programModal) programModal.style.display = 'none';
    if (exerciseModal) exerciseModal.style.display = 'none';
    
    initializeTelegram();
    initializeApp();
    loadPrograms();
    setupEventListeners();
    loadUserData();
    
    // Add developer tab event listeners after a short delay to ensure DOM is ready
    setTimeout(() => {
        document.querySelectorAll('.dev-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                switchDeveloperTab(tabName);
            });
        });
    }, 100);
    
    console.log('App initialization complete - all modals hidden');
});

// Initialize Supabase
function initializeSupabase() {
    try {
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase) {
            supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            console.log('Supabase client initialized');
            
            // Check authentication status
            checkAuthStatus();
        } else {
            console.warn('Supabase configuration not found, using fallback data');
        }
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
    }
}

// Check authentication status
async function checkAuthStatus() {
    if (!supabase) return;
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.log('Auth check error:', error.message);
            isAuthenticated = false;
        } else {
            isAuthenticated = !!user;
            console.log('Auth status:', isAuthenticated ? 'authenticated' : 'not authenticated');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        isAuthenticated = false;
    }
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

// Initialize Telegram WebApp
function initializeTelegram() {
    tg.ready();
    tg.expand();
    
    // Get user data from Telegram
    user = tg.initDataUnsafe?.user;
    
    // Set up theme
    if (tg.colorScheme === 'dark') {
        document.body.classList.add('dark-theme');
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
    
    // Load developer content if available
    if (developerContent.home) {
        updateHomePage(developerContent.home);
    }
    
    // Check developer mode
    checkDeveloperMode();
    
    // Initialize calendar
    updateCalendar();
    updateProgressStats();
}

// Check developer mode
function checkDeveloperMode() {
    isDeveloperMode = sessionStorage.getItem(DEV_FLAG) === 'true';
    console.log('Developer mode status:', isDeveloperMode);
    
    if (isDeveloperMode) {
        // Don't show panel immediately on page load, just set the flag
        // User can click the button to show it
        console.log('Developer mode is active - panel will auto-open on button click');
    }
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
    programs = [
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
                video_url: `https://www.youtube.com/embed/dQw4w9WgXcQ`, // Placeholder video
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

function seedDefaultProgramsToStorage() {
    if (!developerContent.programs) {
        developerContent.programs = programs;
        localStorage.setItem('dev_content', JSON.stringify(developerContent));
        console.log('Default programs seeded to localStorage');
    }
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
                <button class="cta-button" onclick="openExerciseModule('${program.id}')" style="width: 100%;">
                    Выбрать программу
                </button>
            </div>
        `;
        
        modal.style.display = 'block';
    } else {
        console.error('Modal elements not found');
    }
}

function closeProgramModal() {
    console.log('Closing program modal');
    const modal = document.getElementById('program-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openExerciseModule(programId) {
    console.log('Opening exercise module for program:', programId);
    const program = programs.find(p => p.id === programId);
    if (!program) {
        console.error('Program not found:', programId);
        return;
    }
    
    closeProgramModal();
    
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    
    if (modal && modalBody) {
        let exercisesHTML = `
            <div class="exercise-module">
                <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">${program.title}</h2>
                <p style="color: #6c757d; margin-bottom: 30px; text-align: center;">${program.days.length}-дневная программа упражнений</p>
        `;
        
        program.days.forEach(day => {
            exercisesHTML += `
                <div class="exercise-day">
                    <h4>День ${day.day_index}</h4>
            `;
            
            day.exercises.forEach((exercise, index) => {
                exercisesHTML += `
                    <div class="exercise-item">
                        <div class="exercise-title">${exercise.order_index}. ${exercise.title}</div>
                        <iframe class="exercise-video" src="${exercise.video_url}" frameborder="0" allowfullscreen></iframe>
                        <div class="exercise-description">${exercise.description}</div>
                    </div>
                `;
            });
            
            exercisesHTML += `</div>`;
        });
        
        exercisesHTML += `</div>`;
        
        modalBody.innerHTML = exercisesHTML;
        modal.style.display = 'block';
    } else {
        console.error('Exercise modal elements not found');
    }
}

function closeExerciseModal() {
    console.log('Closing exercise modal');
    const modal = document.getElementById('exercise-modal');
    if (modal) {
        modal.style.display = 'none';
    }
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

// Close all modals function
function closeAllModals() {
    console.log('Closing all modals...');
    closeProgramModal();
    closeExerciseModal();
    closePinModal();
    closeDeveloperPanel();
    // Hide subscription overlay if visible
    const subOverlay = document.getElementById('subscription-overlay');
    if (subOverlay && !subOverlay.classList.contains('hidden')) {
        subOverlay.classList.add('hidden');
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const programModal = document.getElementById('program-modal');
    const exerciseModal = document.getElementById('exercise-modal');
    const pinModal = document.getElementById('pin-modal');
    const subOverlay = document.getElementById('subscription-overlay');
    
    if (event.target === programModal) {
        closeProgramModal();
    }
    if (event.target === exerciseModal) {
        closeExerciseModal();
    }
    if (event.target === pinModal) {
        closePinModal();
    }
    if (event.target === subOverlay) {
        subOverlay.classList.add('hidden');
    }
}

// Developer Access functionality
function openDeveloperAccess() {
    console.log('Opening developer access...');
    if (isDeveloperMode) {
        // If already in developer mode, just show the panel
        showDeveloperPanel();
    } else {
        // Check if sessionStorage has developer flag set
        if (sessionStorage.getItem(DEV_FLAG) === 'true') {
            // Auto-open panel without PIN modal
            isDeveloperMode = true;
            showDeveloperPanel();
        } else {
            // Show PIN modal for first time access
            showPinModal();
        }
    }
}

function showPinModal() {
    console.log('Showing PIN modal...');
    const modal = document.getElementById('pin-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            const input = document.getElementById('pin-input');
            if (input) input.focus();
        }, 100);
    }
}

function closePinModal() {
    console.log('Closing PIN modal...');
    const modal = document.getElementById('pin-modal');
    if (modal) {
        modal.classList.add('hidden');
        const input = document.getElementById('pin-input');
        if (input) input.value = '';
    }
}

function checkPin() {
    const pin = document.getElementById('pin-input').value;
    console.log('Checking PIN...');
    
    if (pin === DEV_PIN) {
        console.log('PIN correct, checking authentication');
        isDeveloperMode = true;
        sessionStorage.setItem(DEV_FLAG, 'true');
        closePinModal();
        
        // Check if user is authenticated
        if (isAuthenticated) {
            showDeveloperPanel();
            loadDeveloperContent();
        } else {
            showLoginForm();
        }
    } else {
        console.log('PIN incorrect');
        alert('Неверный пароль');
    }
}

// Authentication functions
function showLoginForm() {
    const panel = document.getElementById('developer-panel');
    if (!panel) return;
    
    // Show panel but with login form
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    panel.classList.remove('hidden');
    panel.classList.add('active');
    
    // Update header to show login form
    const header = panel.querySelector('.developer-header');
    if (header) {
        header.innerHTML = `
            <h2>Редактор контента</h2>
            <div class="login-form">
                <input type="email" id="login-email" placeholder="Email" style="margin-right: 10px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                <input type="password" id="login-password" placeholder="Пароль" style="margin-right: 10px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                <button onclick="loginUser()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Войти</button>
            </div>
            <button class="close-dev-panel" onclick="closeDeveloperPanel()">&times;</button>
        `;
    }
    
    // Hide tabs and show login message
    const tabs = panel.querySelector('.developer-tabs');
    const content = panel.querySelectorAll('.dev-tab-content');
    if (tabs) tabs.style.display = 'none';
    content.forEach(c => c.style.display = 'none');
    
    // Show login message
    const container = panel.querySelector('.developer-container');
    if (container) {
        const loginMessage = document.createElement('div');
        loginMessage.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <h3>Нет доступа. Войдите как редактор.</h3>
                <p>Для редактирования контента необходимо войти в систему.</p>
            </div>
        `;
        container.appendChild(loginMessage);
    }
    
    window.scrollTo(0, 0);
}

async function loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showToast('Введите email и пароль', 'error');
        return;
    }
    
    if (!supabase) {
        showToast('Supabase не настроен', 'error');
        return;
    }
    
    try {
        console.log('Attempting login...');
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('Login error:', error.message);
            showToast('Ошибка входа: ' + error.message, 'error');
        } else {
            console.log('Login successful');
            isAuthenticated = true;
            showToast('Успешный вход', 'success');
            showDeveloperPanel();
            loadDeveloperContent();
        }
    } catch (error) {
        console.error('Login failed:', error);
        showToast('Ошибка входа', 'error');
    }
}

async function logoutUser() {
    if (!supabase) return;
    
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Logout error:', error.message);
        } else {
            console.log('Logout successful');
            isAuthenticated = false;
            showToast('Выход выполнен', 'info');
            closeDeveloperPanel();
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Developer panel functions
function showDeveloperPanel() {
    console.log('Showing developer panel...');
    const panel = document.getElementById('developer-panel');
    if (!panel) return;
  
    // скрыть все секции
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  
    // показать панель и сделать её активной секцией
    panel.classList.remove('hidden');
    panel.classList.add('active');
    
    // Reset header to normal state
    const header = panel.querySelector('.developer-header');
    if (header) {
        header.innerHTML = `
            <h2>Редактор контента ${isAuthenticated ? '<span style="color: #28a745; font-size: 14px;">(Вход выполнен)</span>' : ''}</h2>
            ${isAuthenticated ? '<button onclick="logoutUser()" style="margin-right: 10px; padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Выйти</button>' : ''}
            <button class="close-dev-panel" onclick="closeDeveloperPanel()">&times;</button>
        `;
    }
    
    // Show tabs and content
    const tabs = panel.querySelector('.developer-tabs');
    if (tabs) tabs.style.display = 'flex';
    
    // Remove login message if exists
    const loginMessage = panel.querySelector('.developer-container > div[style*="text-align: center"]');
    if (loginMessage) {
        loginMessage.remove();
    }
  
    window.scrollTo(0, 0);
}

function closeDeveloperPanel() {
    const panel = document.getElementById('developer-panel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.classList.remove('active');
    // вернёмся на Главную (или профиль)
    document.getElementById('home')?.classList.add('active');
    sessionStorage.removeItem(DEV_FLAG);
}

function loadDeveloperContent() {
    // Load home content
    const homeContent = developerContent.home || {
        hero_image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        headline: 'Здоровое тело',
        greeting: 'Добро пожаловать в ваше путешествие к здоровому образу жизни!',
        cta_text: 'Перейти к упражнениям'
    };
    
    document.getElementById('dev-hero-image').value = homeContent.hero_image_url;
    document.getElementById('dev-headline').value = homeContent.headline;
    document.getElementById('dev-greeting').value = homeContent.greeting;
    document.getElementById('dev-cta').value = homeContent.cta_text;
    
    // Load programs
    loadDeveloperPrograms();
    
    // Load settings
    const settings = developerContent.settings || { calendar_enabled: true };
    document.getElementById('dev-calendar-enabled').checked = settings.calendar_enabled;
}

async function loadDeveloperPrograms() {
    const programsList = document.getElementById('dev-programs-list');
    programsList.innerHTML = '<p>Загрузка программ...</p>';
    
    if (!isAuthenticated) {
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
            programDiv.innerHTML = `
                <div>
                    <h4>${program.title} ${program.is_published ? '✅' : '❌'}</h4>
                    <p>${program.description}</p>
                    <small>ID: ${program.id} | Slug: ${program.slug}</small>
                </div>
                <div>
                    <button onclick="editProgram(${program.id})">Редактировать</button>
                    <button onclick="toggleProgramPublished(${program.id})">${program.is_published ? 'Скрыть' : 'Опубликовать'}</button>
                    <button onclick="deleteProgram(${program.id})">Удалить</button>
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

function saveHomeContent() {
    console.log('Saving home content...');
    const homeContent = {
        hero_image_url: document.getElementById('dev-hero-image').value,
        headline: document.getElementById('dev-headline').value,
        greeting: document.getElementById('dev-greeting').value,
        cta_text: document.getElementById('dev-cta').value
    };
    
    developerContent.home = homeContent;
    localStorage.setItem('dev_content', JSON.stringify(developerContent));
    console.log('Home content saved to localStorage:', homeContent);
    
    // Update the actual home page
    updateHomePage(homeContent);
    
    alert('Главная страница сохранена');
}

function updateHomePage(homeContent) {
    const heroImg = document.querySelector('.hero-image img');
    const headline = document.querySelector('.main-title');
    const greeting = document.querySelector('.greeting');
    const ctaButton = document.querySelector('.cta-button');
    
    if (heroImg) heroImg.src = homeContent.hero_image_url;
    if (headline) headline.textContent = homeContent.headline;
    if (greeting) greeting.textContent = homeContent.greeting;
    if (ctaButton) ctaButton.textContent = homeContent.cta_text;
}

async function addNewProgram() {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    console.log('Adding new program...');
    const title = prompt('Название программы:');
    if (title) {
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        try {
            const { data, error } = await supabase
                .from('programs')
                .insert({
                    slug: slug,
                    title: title,
                    description: 'Описание программы',
                    image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
                    details_md: 'Подробное описание программы в формате Markdown.',
                    is_published: false
                })
                .select()
                .single();
            
            if (error) {
                throw new Error(`Failed to create program: ${error.message}`);
            }
            
            console.log('New program created:', data);
            showToast('Программа создана', 'success');
            loadDeveloperPrograms();
            loadPrograms(); // Refresh public view
        } catch (error) {
            console.error('Failed to create program:', error);
            showToast('Ошибка создания программы: ' + error.message, 'error');
        }
    }
}

async function editProgram(programId) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    try {
        // Load program with days and exercises
        const { data: program, error: programError } = await supabase
            .from('programs')
            .select('*')
            .eq('id', programId)
            .single();
        
        if (programError) {
            throw new Error(`Failed to load program: ${programError.message}`);
        }
        
        // Load days
        const { data: days, error: daysError } = await supabase
            .from('program_days')
            .select('*')
            .eq('program_id', programId)
            .order('day_index');
        
        if (daysError) {
            console.warn('Failed to load days:', daysError.message);
            program.days = [];
        } else {
            // Load exercises for each day
            for (let day of days) {
                const { data: exercises, error: exercisesError } = await supabase
                    .from('exercises')
                    .select('*')
                    .eq('program_day_id', day.id)
                    .order('order_index');
                
                if (exercisesError) {
                    console.warn('Failed to load exercises:', exercisesError.message);
                    day.exercises = [];
                } else {
                    day.exercises = exercises;
                }
            }
            program.days = days;
        }
        
        showProgramEditor(program, programId);
    } catch (error) {
        console.error('Failed to load program for editing:', error);
        showToast('Ошибка загрузки программы: ' + error.message, 'error');
    }
}

function showProgramEditor(program, programId) {
    const programsList = document.getElementById('dev-programs-list');
    programsList.innerHTML = '';
    
    const editorDiv = document.createElement('div');
    editorDiv.className = 'program-editor';
    editorDiv.innerHTML = `
        <h3>Редактирование программы: ${program.title}</h3>
        <div class="form-group">
            <label>Название:</label>
            <input type="text" id="edit-title" value="${program.title}">
        </div>
        <div class="form-group">
            <label>Описание:</label>
            <textarea id="edit-description">${program.description}</textarea>
        </div>
        <div class="form-group">
            <label>URL изображения:</label>
            <input type="url" id="edit-image-url" value="${program.image_url}">
        </div>
        <div class="form-group">
            <label>Slug:</label>
            <input type="text" id="edit-slug" value="${program.slug}">
        </div>
        <div class="form-group">
            <label>Детали (Markdown):</label>
            <textarea id="edit-details-md" rows="4">${program.details_md}</textarea>
        </div>
        <div class="form-group">
            <label class="checkbox-label">
                <input type="checkbox" id="edit-published" ${program.is_published ? 'checked' : ''}>
                <span class="checkmark"></span>
                Опубликовано
            </label>
        </div>
        
        <h4>Дни программы</h4>
        <div id="days-editor">
            ${generateDaysEditorHTML(program.days, programId)}
        </div>
        <button onclick="addDay(${programId})" class="btn btn-secondary">Добавить день</button>
        
        <div class="editor-actions">
            <button onclick="saveProgram(${programId})" class="btn btn-primary">Сохранить</button>
            <button onclick="cancelEdit()" class="btn btn-secondary">Отмена</button>
        </div>
    `;
    
    programsList.appendChild(editorDiv);
}

function generateDaysEditorHTML(days, programId) {
    if (!days || days.length === 0) {
        return '<p>Нет дней в программе. Добавьте первый день.</p>';
    }
    
    return days.map((day, dayIndex) => `
        <div class="day-editor" data-day-index="${dayIndex}">
            <h5>День ${day.day_index}</h5>
            <div class="day-actions">
                <button onclick="deleteDay(${day.id})" class="btn btn-danger btn-sm">Удалить день</button>
            </div>
            <div class="exercises-editor">
                ${generateExercisesEditorHTML(day.exercises, day.id)}
            </div>
            <button onclick="addExercise(${day.id})" class="btn btn-secondary btn-sm">Добавить упражнение</button>
        </div>
    `).join('');
}

function generateExercisesEditorHTML(exercises, dayId) {
    if (!exercises || exercises.length === 0) {
        return '<p>Нет упражнений в этом дне.</p>';
    }
    
    return exercises.map((exercise, exerciseIndex) => `
        <div class="exercise-editor" data-exercise-index="${exerciseIndex}">
            <div class="form-group">
                <label>Порядок:</label>
                <input type="number" value="${exercise.order_index}" onchange="updateExerciseOrder(${exercise.id}, this.value)">
            </div>
            <div class="form-group">
                <label>Название:</label>
                <input type="text" value="${exercise.title}" onchange="updateExerciseField(${exercise.id}, 'title', this.value)">
            </div>
            <div class="form-group">
                <label>URL видео:</label>
                <input type="url" value="${exercise.video_url}" onchange="updateExerciseField(${exercise.id}, 'video_url', this.value)">
            </div>
            <div class="form-group">
                <label>Описание:</label>
                <textarea onchange="updateExerciseField(${exercise.id}, 'description', this.value)">${exercise.description}</textarea>
            </div>
            <button onclick="deleteExercise(${exercise.id})" class="btn btn-danger btn-sm">Удалить упражнение</button>
        </div>
    `).join('');
}

async function deleteProgram(programId) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    if (confirm('Удалить программу? Это также удалит все дни и упражнения.')) {
        try {
            const { error } = await supabase
                .from('programs')
                .delete()
                .eq('id', programId);
            
            if (error) {
                throw new Error(`Failed to delete program: ${error.message}`);
            }
            
            console.log('Program deleted:', programId);
            showToast('Программа удалена', 'success');
            loadDeveloperPrograms();
            loadPrograms(); // Refresh public view
        } catch (error) {
            console.error('Failed to delete program:', error);
            showToast('Ошибка удаления программы: ' + error.message, 'error');
        }
    }
}

async function toggleProgramPublished(programId) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    try {
        // First get current program to toggle published status
        const { data: program, error: fetchError } = await supabase
            .from('programs')
            .select('is_published')
            .eq('id', programId)
            .single();
        
        if (fetchError) {
            throw new Error(`Failed to fetch program: ${fetchError.message}`);
        }
        
        const { error: updateError } = await supabase
            .from('programs')
            .update({ is_published: !program.is_published })
            .eq('id', programId);
        
        if (updateError) {
            throw new Error(`Failed to update program: ${updateError.message}`);
        }
        
        console.log('Program published status toggled:', programId);
        showToast('Статус программы обновлен', 'success');
        loadDeveloperPrograms();
        loadPrograms(); // Refresh public view
    } catch (error) {
        console.error('Failed to toggle program published status:', error);
        showToast('Ошибка обновления программы: ' + error.message, 'error');
    }
}

async function saveProgram(programId) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('programs')
            .update({
                title: document.getElementById('edit-title').value,
                description: document.getElementById('edit-description').value,
                image_url: document.getElementById('edit-image-url').value,
                slug: document.getElementById('edit-slug').value,
                details_md: document.getElementById('edit-details-md').value,
                is_published: document.getElementById('edit-published').checked
            })
            .eq('id', programId);
        
        if (error) {
            throw new Error(`Failed to update program: ${error.message}`);
        }
        
        console.log('Program saved:', programId);
        showToast('Программа сохранена', 'success');
        loadDeveloperPrograms();
        loadPrograms(); // Refresh public view
    } catch (error) {
        console.error('Failed to save program:', error);
        showToast('Ошибка сохранения программы: ' + error.message, 'error');
    }
}

function cancelEdit() {
    loadDeveloperPrograms();
}

async function addDay(programId) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    try {
        // Get current max day_index for this program
        const { data: days, error: daysError } = await supabase
            .from('program_days')
            .select('day_index')
            .eq('program_id', programId)
            .order('day_index', { ascending: false })
            .limit(1);
        
        if (daysError) {
            throw new Error(`Failed to get days: ${daysError.message}`);
        }
        
        const maxDayIndex = days.length > 0 ? days[0].day_index : 0;
        
        const { data, error } = await supabase
            .from('program_days')
            .insert({
                program_id: programId,
                day_index: maxDayIndex + 1
            })
            .select()
            .single();
        
        if (error) {
            throw new Error(`Failed to create day: ${error.message}`);
        }
        
        console.log('Day created:', data);
        showToast('День добавлен', 'success');
        
        // Refresh the editor
        editProgram(programId);
    } catch (error) {
        console.error('Failed to add day:', error);
        showToast('Ошибка добавления дня: ' + error.message, 'error');
    }
}

async function deleteDay(dayId) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    if (confirm('Удалить этот день? Это также удалит все упражнения в этом дне.')) {
        try {
            const { error } = await supabase
                .from('program_days')
                .delete()
                .eq('id', dayId);
            
            if (error) {
                throw new Error(`Failed to delete day: ${error.message}`);
            }
            
            console.log('Day deleted:', dayId);
            showToast('День удален', 'success');
            
            // Find the program being edited and refresh
            const editorDiv = document.querySelector('.program-editor');
            if (editorDiv) {
                const programId = parseInt(editorDiv.querySelector('button[onclick*="addDay"]').onclick.toString().match(/addDay\((\d+)\)/)[1]);
                editProgram(programId);
            }
        } catch (error) {
            console.error('Failed to delete day:', error);
            showToast('Ошибка удаления дня: ' + error.message, 'error');
        }
    }
}

async function addExercise(dayId) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    try {
        // Get current max order_index for this day
        const { data: exercises, error: exercisesError } = await supabase
            .from('exercises')
            .select('order_index')
            .eq('program_day_id', dayId)
            .order('order_index', { ascending: false })
            .limit(1);
        
        if (exercisesError) {
            throw new Error(`Failed to get exercises: ${exercisesError.message}`);
        }
        
        const maxOrderIndex = exercises.length > 0 ? exercises[0].order_index : 0;
        
        const { data, error } = await supabase
            .from('exercises')
            .insert({
                program_day_id: dayId,
                order_index: maxOrderIndex + 1,
                title: 'Новое упражнение',
                video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                description: 'Описание упражнения'
            })
            .select()
            .single();
        
        if (error) {
            throw new Error(`Failed to create exercise: ${error.message}`);
        }
        
        console.log('Exercise created:', data);
        showToast('Упражнение добавлено', 'success');
        
        // Find the program being edited and refresh
        const editorDiv = document.querySelector('.program-editor');
        if (editorDiv) {
            const programId = parseInt(editorDiv.querySelector('button[onclick*="addDay"]').onclick.toString().match(/addDay\((\d+)\)/)[1]);
            editProgram(programId);
        }
    } catch (error) {
        console.error('Failed to add exercise:', error);
        showToast('Ошибка добавления упражнения: ' + error.message, 'error');
    }
}

async function deleteExercise(exerciseId) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    if (confirm('Удалить это упражнение?')) {
        try {
            const { error } = await supabase
                .from('exercises')
                .delete()
                .eq('id', exerciseId);
            
            if (error) {
                throw new Error(`Failed to delete exercise: ${error.message}`);
            }
            
            console.log('Exercise deleted:', exerciseId);
            showToast('Упражнение удалено', 'success');
            
            // Find the program being edited and refresh
            const editorDiv = document.querySelector('.program-editor');
            if (editorDiv) {
                const programId = parseInt(editorDiv.querySelector('button[onclick*="addDay"]').onclick.toString().match(/addDay\((\d+)\)/)[1]);
                editProgram(programId);
            }
        } catch (error) {
            console.error('Failed to delete exercise:', error);
            showToast('Ошибка удаления упражнения: ' + error.message, 'error');
        }
    }
}

async function updateExerciseField(exerciseId, field, value) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('exercises')
            .update({ [field]: value })
            .eq('id', exerciseId);
        
        if (error) {
            throw new Error(`Failed to update exercise: ${error.message}`);
        }
        
        console.log('Exercise field updated:', exerciseId, field, value);
    } catch (error) {
        console.error('Failed to update exercise field:', error);
        showToast('Ошибка обновления упражнения: ' + error.message, 'error');
    }
}

async function updateExerciseOrder(exerciseId, value) {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('exercises')
            .update({ order_index: parseInt(value) })
            .eq('id', exerciseId);
        
        if (error) {
            throw new Error(`Failed to update exercise order: ${error.message}`);
        }
        
        console.log('Exercise order updated:', exerciseId, value);
    } catch (error) {
        console.error('Failed to update exercise order:', error);
        showToast('Ошибка обновления порядка упражнения: ' + error.message, 'error');
    }
}

function saveSettings() {
    console.log('Saving settings...');
    const settings = {
        calendar_enabled: document.getElementById('dev-calendar-enabled').checked
    };
    
    developerContent.settings = settings;
    localStorage.setItem('dev_content', JSON.stringify(developerContent));
    console.log('Settings saved to localStorage:', settings);
    
    alert('Настройки сохранены');
}

// Export/Import functionality
async function exportContent() {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    try {
        console.log('Exporting content...');
        
        // Fetch all data from Supabase
        const { data: programsData, error: programsError } = await supabase
            .from('programs')
            .select(`
                *,
                program_days (
                    *,
                    exercises (*)
                )
            `)
            .order('id');
        
        if (programsError) {
            throw new Error(`Failed to export programs: ${programsError.message}`);
        }
        
        const exportData = {
            programs: programsData,
            exported_at: new Date().toISOString(),
            version: '1.0'
        };
        
        // Create and download file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dev_content_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Content exported successfully');
        showToast('Контент экспортирован', 'success');
    } catch (error) {
        console.error('Failed to export content:', error);
        showToast('Ошибка экспорта: ' + error.message, 'error');
    }
}

async function importContent() {
    if (!isAuthenticated) {
        showToast('Нет доступа. Войдите как редактор.', 'error');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (!importData.programs || !Array.isArray(importData.programs)) {
                throw new Error('Invalid import file format');
            }
            
            console.log('Importing content...');
            
            // Import programs with upsert logic
            for (const program of importData.programs) {
                // Upsert program by slug
                const { data: existingProgram, error: fetchError } = await supabase
                    .from('programs')
                    .select('id')
                    .eq('slug', program.slug)
                    .single();
                
                let programId;
                if (existingProgram) {
                    // Update existing program
                    const { data, error: updateError } = await supabase
                        .from('programs')
                        .update({
                            title: program.title,
                            description: program.description,
                            image_url: program.image_url,
                            details_md: program.details_md,
                            is_published: program.is_published
                        })
                        .eq('id', existingProgram.id)
                        .select()
                        .single();
                    
                    if (updateError) {
                        throw new Error(`Failed to update program: ${updateError.message}`);
                    }
                    programId = existingProgram.id;
                } else {
                    // Create new program
                    const { data, error: insertError } = await supabase
                        .from('programs')
                        .insert({
                            slug: program.slug,
                            title: program.title,
                            description: program.description,
                            image_url: program.image_url,
                            details_md: program.details_md,
                            is_published: program.is_published
                        })
                        .select()
                        .single();
                    
                    if (insertError) {
                        throw new Error(`Failed to create program: ${insertError.message}`);
                    }
                    programId = data.id;
                }
                
                // Import days and exercises
                if (program.program_days && Array.isArray(program.program_days)) {
                    for (const day of program.program_days) {
                        // Upsert day by program_id and day_index
                        const { data: existingDay, error: dayFetchError } = await supabase
                            .from('program_days')
                            .select('id')
                            .eq('program_id', programId)
                            .eq('day_index', day.day_index)
                            .single();
                        
                        let dayId;
                        if (existingDay) {
                            dayId = existingDay.id;
                        } else {
                            const { data: newDay, error: dayInsertError } = await supabase
                                .from('program_days')
                                .insert({
                                    program_id: programId,
                                    day_index: day.day_index
                                })
                                .select()
                                .single();
                            
                            if (dayInsertError) {
                                throw new Error(`Failed to create day: ${dayInsertError.message}`);
                            }
                            dayId = newDay.id;
                        }
                        
                        // Import exercises
                        if (day.exercises && Array.isArray(day.exercises)) {
                            for (const exercise of day.exercises) {
                                // Upsert exercise by program_day_id and order_index
                                const { data: existingExercise, error: exerciseFetchError } = await supabase
                                    .from('exercises')
                                    .select('id')
                                    .eq('program_day_id', dayId)
                                    .eq('order_index', exercise.order_index)
                                    .single();
                                
                                if (existingExercise) {
                                    // Update existing exercise
                                    const { error: exerciseUpdateError } = await supabase
                                        .from('exercises')
                                        .update({
                                            title: exercise.title,
                                            video_url: exercise.video_url,
                                            description: exercise.description
                                        })
                                        .eq('id', existingExercise.id);
                                    
                                    if (exerciseUpdateError) {
                                        throw new Error(`Failed to update exercise: ${exerciseUpdateError.message}`);
                                    }
                                } else {
                                    // Create new exercise
                                    const { error: exerciseInsertError } = await supabase
                                        .from('exercises')
                                        .insert({
                                            program_day_id: dayId,
                                            order_index: exercise.order_index,
                                            title: exercise.title,
                                            video_url: exercise.video_url,
                                            description: exercise.description
                                        });
                                    
                                    if (exerciseInsertError) {
                                        throw new Error(`Failed to create exercise: ${exerciseInsertError.message}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            console.log('Content imported successfully');
            showToast('Контент импортирован', 'success');
            loadDeveloperPrograms();
            loadPrograms(); // Refresh public view
        } catch (error) {
            console.error('Failed to import content:', error);
            showToast('Ошибка импорта: ' + error.message, 'error');
        }
    };
    
    input.click();
}

function switchDeveloperTab(tabName) {
    // Update tab navigation
    document.querySelectorAll('.dev-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.dev-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}

// Developer mode constants
const DEV_PIN = '1234';
const DEV_FLAG = 'isDev';


// Export functions for global access
window.navigateToSection = navigateToSection;
window.changeMonth = changeMonth;
window.openProgramModal = openProgramModal;
window.closeProgramModal = closeProgramModal;
window.openExerciseModule = openExerciseModule;
window.closeExerciseModal = closeExerciseModal;
window.saveProfile = saveProfile;
window.renewSubscription = renewSubscription;
window.openDeveloperAccess = openDeveloperAccess;
window.checkPin = checkPin;
window.closePinModal = closePinModal;
window.closeDeveloperPanel = closeDeveloperPanel;
window.closeAllModals = closeAllModals;
window.saveHomeContent = saveHomeContent;
window.addNewProgram = addNewProgram;
window.editProgram = editProgram;
window.deleteProgram = deleteProgram;
window.toggleProgramPublished = toggleProgramPublished;
window.saveProgram = saveProgram;
window.cancelEdit = cancelEdit;
window.addDay = addDay;
window.deleteDay = deleteDay;
window.addExercise = addExercise;
window.deleteExercise = deleteExercise;
window.updateExerciseField = updateExerciseField;
window.updateExerciseOrder = updateExerciseOrder;
window.saveSettings = saveSettings;
window.showDeveloperPanel = showDeveloperPanel;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.exportContent = exportContent;
window.importContent = importContent;
// Telegram WebApp initialization
let tg = window.Telegram.WebApp;
let user = null;
let currentMonth = new Date();
let programs = [];
let userProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
let userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
let isDeveloperMode = false;
let developerContent = JSON.parse(localStorage.getItem('dev_content') || '{}');

// Static frontend configuration

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing app...');
    
    // Ensure ALL modals and overlays are hidden on page load
    const pinModal = document.getElementById('pin-modal');
    const subOverlay = document.getElementById('subscription-overlay');
    const developerPanel = document.getElementById('developer-panel');
    const programModal = document.getElementById('program-modal');
    const exerciseModal = document.getElementById('exercise-modal');
    
    if (pinModal) pinModal.classList.add('hidden');
    if (subOverlay) subOverlay.classList.add('hidden');
    if (developerPanel) developerPanel.classList.add('hidden');
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
        console.log('Developer mode is active');
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
function loadPrograms() {
    // Load programs from localStorage or use defaults
    if (developerContent.programs && developerContent.programs.length > 0) {
        programs = developerContent.programs;
    } else {
        // Seed default programs to localStorage on first load
        loadDefaultPrograms();
        seedDefaultProgramsToStorage();
    }
    renderPrograms();
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
        showDeveloperPanel();
    } else {
        showPinModal();
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
    const val = (document.getElementById('pin-input')?.value || '').trim();
    if (val === '1234') {
      sessionStorage.setItem(DEV_FLAG, '1');
      closePinModal();        // закрываем окно
      showDeveloperPanel();   // ВКЛЮЧАЕМ панель
    } else {
      alert('Неверный пароль');
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

function loadDeveloperPrograms() {
    const programsList = document.getElementById('dev-programs-list');
    programsList.innerHTML = '';
    
    const devPrograms = developerContent.programs || programs;
    
    devPrograms.forEach((program, index) => {
        const programDiv = document.createElement('div');
        programDiv.className = 'dev-program-item';
        programDiv.innerHTML = `
            <div>
                <h4>${program.title} ${program.is_published ? '✅' : '❌'}</h4>
                <p>${program.description}</p>
                <small>ID: ${program.id} | Slug: ${program.slug}</small>
            </div>
            <div>
                <button onclick="editProgram(${index})">Редактировать</button>
                <button onclick="toggleProgramPublished(${index})">${program.is_published ? 'Скрыть' : 'Опубликовать'}</button>
                <button onclick="deleteProgram(${index})">Удалить</button>
            </div>
        `;
        programsList.appendChild(programDiv);
    });
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

function addNewProgram() {
    console.log('Adding new program...');
    const title = prompt('Название программы:');
    if (title) {
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const newProgram = {
            id: 'program-' + Date.now(),
            slug: slug,
            title: title,
            description: 'Описание программы',
            image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            details_md: 'Подробное описание программы в формате Markdown.',
            is_published: false,
            days: []
        };
        
        if (!developerContent.programs) {
            developerContent.programs = [];
        }
        developerContent.programs.push(newProgram);
        localStorage.setItem('dev_content', JSON.stringify(developerContent));
        console.log('New program added to localStorage:', newProgram);
        loadDeveloperPrograms();
        // Update public programs view
        programs = developerContent.programs;
        renderPrograms();
    }
}

function editProgram(index) {
    const program = developerContent.programs[index];
    showProgramEditor(program, index);
}

function showProgramEditor(program, index) {
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
            ${generateDaysEditorHTML(program.days)}
        </div>
        <button onclick="addDay(${index})" class="btn btn-secondary">Добавить день</button>
        
        <div class="editor-actions">
            <button onclick="saveProgram(${index})" class="btn btn-primary">Сохранить</button>
            <button onclick="cancelEdit()" class="btn btn-secondary">Отмена</button>
        </div>
    `;
    
    programsList.appendChild(editorDiv);
}

function generateDaysEditorHTML(days) {
    if (!days || days.length === 0) {
        return '<p>Нет дней в программе. Добавьте первый день.</p>';
    }
    
    return days.map((day, dayIndex) => `
        <div class="day-editor" data-day-index="${dayIndex}">
            <h5>День ${day.day_index}</h5>
            <div class="day-actions">
                <button onclick="deleteDay(${dayIndex})" class="btn btn-danger btn-sm">Удалить день</button>
            </div>
            <div class="exercises-editor">
                ${generateExercisesEditorHTML(day.exercises, dayIndex)}
            </div>
            <button onclick="addExercise(${dayIndex})" class="btn btn-secondary btn-sm">Добавить упражнение</button>
        </div>
    `).join('');
}

function generateExercisesEditorHTML(exercises, dayIndex) {
    if (!exercises || exercises.length === 0) {
        return '<p>Нет упражнений в этом дне.</p>';
    }
    
    return exercises.map((exercise, exerciseIndex) => `
        <div class="exercise-editor" data-exercise-index="${exerciseIndex}">
            <div class="form-group">
                <label>Порядок:</label>
                <input type="number" value="${exercise.order_index}" onchange="updateExerciseOrder(${dayIndex}, ${exerciseIndex}, this.value)">
            </div>
            <div class="form-group">
                <label>Название:</label>
                <input type="text" value="${exercise.title}" onchange="updateExerciseField(${dayIndex}, ${exerciseIndex}, 'title', this.value)">
            </div>
            <div class="form-group">
                <label>URL видео:</label>
                <input type="url" value="${exercise.video_url}" onchange="updateExerciseField(${dayIndex}, ${exerciseIndex}, 'video_url', this.value)">
            </div>
            <div class="form-group">
                <label>Описание:</label>
                <textarea onchange="updateExerciseField(${dayIndex}, ${exerciseIndex}, 'description', this.value)">${exercise.description}</textarea>
            </div>
            <button onclick="deleteExercise(${dayIndex}, ${exerciseIndex})" class="btn btn-danger btn-sm">Удалить упражнение</button>
        </div>
    `).join('');
}

function deleteProgram(index) {
    if (confirm('Удалить программу?')) {
        developerContent.programs.splice(index, 1);
        localStorage.setItem('dev_content', JSON.stringify(developerContent));
        loadDeveloperPrograms();
        // Update public programs view
        programs = developerContent.programs;
        renderPrograms();
    }
}

function toggleProgramPublished(index) {
    const program = developerContent.programs[index];
    program.is_published = !program.is_published;
    developerContent.programs[index] = program;
    localStorage.setItem('dev_content', JSON.stringify(developerContent));
    loadDeveloperPrograms();
    // Update public programs view
    programs = developerContent.programs;
    renderPrograms();
}

function saveProgram(index) {
    const program = developerContent.programs[index];
    
    // Update program fields
    program.title = document.getElementById('edit-title').value;
    program.description = document.getElementById('edit-description').value;
    program.image_url = document.getElementById('edit-image-url').value;
    program.slug = document.getElementById('edit-slug').value;
    program.details_md = document.getElementById('edit-details-md').value;
    program.is_published = document.getElementById('edit-published').checked;
    
    developerContent.programs[index] = program;
    localStorage.setItem('dev_content', JSON.stringify(developerContent));
    
    // Update public programs view
    programs = developerContent.programs;
    renderPrograms();
    
    // Return to programs list
    loadDeveloperPrograms();
}

function cancelEdit() {
    loadDeveloperPrograms();
}

function addDay(programIndex) {
    const program = developerContent.programs[programIndex];
    const maxDayIndex = program.days.length > 0 ? Math.max(...program.days.map(d => d.day_index)) : 0;
    
    const newDay = {
        day_index: maxDayIndex + 1,
        exercises: []
    };
    
    program.days.push(newDay);
    developerContent.programs[programIndex] = program;
    
    // Refresh the editor
    showProgramEditor(program, programIndex);
}

function deleteDay(dayIndex) {
    if (confirm('Удалить этот день?')) {
        // Find the program being edited
        const editorDiv = document.querySelector('.program-editor');
        if (editorDiv) {
            const programIndex = parseInt(editorDiv.querySelector('button[onclick*="addDay"]').onclick.toString().match(/addDay\((\d+)\)/)[1]);
            const program = developerContent.programs[programIndex];
            
            program.days.splice(dayIndex, 1);
            developerContent.programs[programIndex] = program;
            
            // Refresh the editor
            showProgramEditor(program, programIndex);
        }
    }
}

function addExercise(dayIndex) {
    // Find the program being edited
    const editorDiv = document.querySelector('.program-editor');
    if (editorDiv) {
        const programIndex = parseInt(editorDiv.querySelector('button[onclick*="addDay"]').onclick.toString().match(/addDay\((\d+)\)/)[1]);
        const program = developerContent.programs[programIndex];
        const day = program.days[dayIndex];
        
        const maxOrderIndex = day.exercises.length > 0 ? Math.max(...day.exercises.map(e => e.order_index)) : 0;
        
        const newExercise = {
            order_index: maxOrderIndex + 1,
            title: 'Новое упражнение',
            video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            description: 'Описание упражнения'
        };
        
        day.exercises.push(newExercise);
        program.days[dayIndex] = day;
        developerContent.programs[programIndex] = program;
        
        // Refresh the editor
        showProgramEditor(program, programIndex);
    }
}

function deleteExercise(dayIndex, exerciseIndex) {
    if (confirm('Удалить это упражнение?')) {
        // Find the program being edited
        const editorDiv = document.querySelector('.program-editor');
        if (editorDiv) {
            const programIndex = parseInt(editorDiv.querySelector('button[onclick*="addDay"]').onclick.toString().match(/addDay\((\d+)\)/)[1]);
            const program = developerContent.programs[programIndex];
            const day = program.days[dayIndex];
            
            day.exercises.splice(exerciseIndex, 1);
            program.days[dayIndex] = day;
            developerContent.programs[programIndex] = program;
            
            // Refresh the editor
            showProgramEditor(program, programIndex);
        }
    }
}

function updateExerciseField(dayIndex, exerciseIndex, field, value) {
    // Find the program being edited
    const editorDiv = document.querySelector('.program-editor');
    if (editorDiv) {
        const programIndex = parseInt(editorDiv.querySelector('button[onclick*="addDay"]').onclick.toString().match(/addDay\((\d+)\)/)[1]);
        const program = developerContent.programs[programIndex];
        const day = program.days[dayIndex];
        const exercise = day.exercises[exerciseIndex];
        
        exercise[field] = value;
        day.exercises[exerciseIndex] = exercise;
        program.days[dayIndex] = day;
        developerContent.programs[programIndex] = program;
    }
}

function updateExerciseOrder(dayIndex, exerciseIndex, value) {
    // Find the program being edited
    const editorDiv = document.querySelector('.program-editor');
    if (editorDiv) {
        const programIndex = parseInt(editorDiv.querySelector('button[onclick*="addDay"]').onclick.toString().match(/addDay\((\d+)\)/)[1]);
        const program = developerContent.programs[programIndex];
        const day = program.days[dayIndex];
        const exercise = day.exercises[exerciseIndex];
        
        exercise.order_index = parseInt(value);
        day.exercises[exerciseIndex] = exercise;
        program.days[dayIndex] = day;
        developerContent.programs[programIndex] = program;
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
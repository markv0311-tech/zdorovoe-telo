// Telegram WebApp initialization
let tg = window.Telegram.WebApp;
let user = null;
let currentMonth = new Date();
let programs = [];
let userProgress = JSON.parse(localStorage.getItem('userProgress') || '{}');
let userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
let subscriptionData = null;
let isDeveloperMode = false;
let developerContent = JSON.parse(localStorage.getItem('developerContent') || '{}');

// Static frontend configuration

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
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
    isDeveloperMode = sessionStorage.getItem('isDev') === 'true';
    
    if (isDeveloperMode) {
        showDeveloperPanel();
        loadDeveloperContent();
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
}

// Navigation functions
function navigateToSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    document.getElementById(sectionName).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
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

async function toggleDayCompletion(dayElement) {
    const date = dayElement.dataset.date;
    if (!date) return;
    
    const isCompleted = dayElement.classList.contains('completed');
    
    if (isCompleted) {
        dayElement.classList.remove('completed');
        delete userProgress[date];
    } else {
        dayElement.classList.add('completed');
        userProgress[date] = true;
    }
    
    // Save progress locally only
    localStorage.setItem('userProgress', JSON.stringify(userProgress));
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
    // Always use default programs for static deployment
    loadDefaultPrograms();
    renderPrograms();
}

function loadDefaultPrograms() {
    programs = [
        {
            id: 'shoulders',
            title: 'Плечевой пояс',
            description: 'Укрепление и развитие мышц плечевого пояса',
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: generateExerciseProgram('Плечевой пояс')
        },
        {
            id: 'back',
            title: 'Спина',
            description: 'Укрепление мышц спины и улучшение осанки',
            image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: generateExerciseProgram('Спина')
        },
        {
            id: 'core',
            title: 'Пресс',
            description: 'Развитие мышц пресса и кора',
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: generateExerciseProgram('Пресс')
        },
        {
            id: 'legs',
            title: 'Ноги',
            description: 'Укрепление мышц ног и ягодиц',
            image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: generateExerciseProgram('Ноги')
        },
        {
            id: 'cardio',
            title: 'Кардио',
            description: 'Кардиотренировки для выносливости',
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: generateExerciseProgram('Кардио')
        },
        {
            id: 'flexibility',
            title: 'Гибкость',
            description: 'Упражнения на растяжку и гибкость',
            image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: generateExerciseProgram('Гибкость')
        },
        {
            id: 'strength',
            title: 'Сила',
            description: 'Силовые тренировки для набора мышечной массы',
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: generateExerciseProgram('Сила')
        },
        {
            id: 'recovery',
            title: 'Восстановление',
            description: 'Упражнения для восстановления и релаксации',
            image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: generateExerciseProgram('Восстановление')
        }
    ];
}

function generateExerciseProgram(programType) {
    const exercises = [];
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
    
    for (let day = 1; day <= 10; day++) {
        const dayExercises = [];
        for (let i = 0; i < 6; i++) {
            const exerciseIndex = (day - 1) * 6 + i;
            const exerciseName = programExercises[exerciseIndex % programExercises.length];
            
            dayExercises.push({
                title: exerciseName,
                video: `https://www.youtube.com/embed/dQw4w9WgXcQ`, // Placeholder video
                description: `Подробное описание упражнения "${exerciseName}" для ${programType.toLowerCase()}. Выполняйте медленно и контролируемо, следите за дыханием.`
            });
        }
        exercises.push({
            day: day,
            exercises: dayExercises
        });
    }
    
    return exercises;
}

function renderPrograms() {
    const programsGrid = document.getElementById('programs-grid');
    programsGrid.innerHTML = '';
    
    programs.forEach(program => {
        const programCard = document.createElement('div');
        programCard.className = 'program-card';
        programCard.innerHTML = `
            <img src="${program.image}" alt="${program.title}" class="program-image">
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
    const modal = document.getElementById('program-modal');
    const modalBody = document.getElementById('program-modal-body');
    
    modalBody.innerHTML = `
        <div class="program-detail">
            <img src="${program.image}" alt="${program.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-bottom: 15px;">${program.title}</h2>
            <p style="color: #6c757d; margin-bottom: 25px; line-height: 1.6;">${program.description}</p>
            <p style="color: #007bff; font-weight: 600; margin-bottom: 25px;">Программа рассчитана на 10 дней, по 6 упражнений в день</p>
            <button class="cta-button" onclick="openExerciseModule('${program.id}')" style="width: 100%;">
                Выбрать программу
            </button>
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeProgramModal() {
    document.getElementById('program-modal').style.display = 'none';
}

function openExerciseModule(programId) {
    const program = programs.find(p => p.id === programId);
    if (!program) return;
    
    closeProgramModal();
    
    const modal = document.getElementById('exercise-modal');
    const modalBody = document.getElementById('exercise-modal-body');
    
    let exercisesHTML = `
        <div class="exercise-module">
            <h2 style="color: #2c3e50; margin-bottom: 20px; text-align: center;">${program.title}</h2>
            <p style="color: #6c757d; margin-bottom: 30px; text-align: center;">10-дневная программа упражнений</p>
    `;
    
    program.exercises.forEach(day => {
        exercisesHTML += `
            <div class="exercise-day">
                <h4>День ${day.day}</h4>
        `;
        
        day.exercises.forEach((exercise, index) => {
            exercisesHTML += `
                <div class="exercise-item">
                    <div class="exercise-title">${index + 1}. ${exercise.title}</div>
                    <iframe class="exercise-video" src="${exercise.video}" frameborder="0" allowfullscreen></iframe>
                    <div class="exercise-description">${exercise.description}</div>
                </div>
            `;
        });
        
        exercisesHTML += `</div>`;
    });
    
    exercisesHTML += `</div>`;
    
    modalBody.innerHTML = exercisesHTML;
    modal.style.display = 'block';
}

function closeExerciseModal() {
    document.getElementById('exercise-modal').style.display = 'none';
}

// Profile functions
async function saveProfile() {
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

// Close modals when clicking outside
window.onclick = function(event) {
    const programModal = document.getElementById('program-modal');
    const exerciseModal = document.getElementById('exercise-modal');
    const pinModal = document.getElementById('pin-modal');
    
    if (event.target === programModal) {
        closeProgramModal();
    }
    if (event.target === exerciseModal) {
        closeExerciseModal();
    }
    if (event.target === pinModal) {
        closePinModal();
    }
}

// Developer Access functionality
function openDeveloperAccess() {
    if (isDeveloperMode) {
        showDeveloperPanel();
    } else {
        showPinModal();
    }
}

function showPinModal() {
    document.getElementById('pin-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('pin-input').focus();
    }, 100);
}

function closePinModal() {
    document.getElementById('pin-modal').classList.add('hidden');
    document.getElementById('pin-input').value = '';
}

function checkPin() {
    const pin = document.getElementById('pin-input').value;
    const devPin = '1234';
    
    if (pin === devPin) {
        isDeveloperMode = true;
        sessionStorage.setItem('isDev', 'true');
        closePinModal();
        showDeveloperPanel();
        loadDeveloperContent();
    } else {
        alert('Неверный пароль');
    }
}

// Developer panel functions
function showDeveloperPanel() {
    document.getElementById('developer-panel').classList.remove('hidden');
    // Switch to profile section to show the panel
    navigateToSection('profile');
}

function closeDeveloperPanel() {
    document.getElementById('developer-panel').classList.add('hidden');
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
                <h4>${program.title}</h4>
                <p>${program.description}</p>
            </div>
            <div>
                <button onclick="editProgram(${index})">Редактировать</button>
                <button onclick="deleteProgram(${index})">Удалить</button>
            </div>
        `;
        programsList.appendChild(programDiv);
    });
}

function saveHomeContent() {
    const homeContent = {
        hero_image_url: document.getElementById('dev-hero-image').value,
        headline: document.getElementById('dev-headline').value,
        greeting: document.getElementById('dev-greeting').value,
        cta_text: document.getElementById('dev-cta').value
    };
    
    developerContent.home = homeContent;
    localStorage.setItem('developerContent', JSON.stringify(developerContent));
    
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
    const title = prompt('Название программы:');
    if (title) {
        const newProgram = {
            id: 'program-' + Date.now(),
            title: title,
            description: 'Описание программы',
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            exercises: []
        };
        
        if (!developerContent.programs) {
            developerContent.programs = [];
        }
        developerContent.programs.push(newProgram);
        localStorage.setItem('developerContent', JSON.stringify(developerContent));
        loadDeveloperPrograms();
    }
}

function editProgram(index) {
    const program = developerContent.programs[index];
    const newTitle = prompt('Название программы:', program.title);
    if (newTitle) {
        program.title = newTitle;
        developerContent.programs[index] = program;
        localStorage.setItem('developerContent', JSON.stringify(developerContent));
        loadDeveloperPrograms();
    }
}

function deleteProgram(index) {
    if (confirm('Удалить программу?')) {
        developerContent.programs.splice(index, 1);
        localStorage.setItem('developerContent', JSON.stringify(developerContent));
        loadDeveloperPrograms();
    }
}

function saveSettings() {
    const settings = {
        calendar_enabled: document.getElementById('dev-calendar-enabled').checked
    };
    
    developerContent.settings = settings;
    localStorage.setItem('developerContent', JSON.stringify(developerContent));
    
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
window.saveHomeContent = saveHomeContent;
window.addNewProgram = addNewProgram;
window.editProgram = editProgram;
window.deleteProgram = deleteProgram;
window.saveSettings = saveSettings;

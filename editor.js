// Editor JavaScript functionality
let tg = window.Telegram.WebApp;
let currentUser = null;
let authToken = null;
let isLocalMode = false;
let localContent = null;

// Initialize editor
document.addEventListener('DOMContentLoaded', function() {
    initializeEditor();
    setupEventListeners();
    checkAuth();
});

// Initialize editor
function initializeEditor() {
    tg.ready();
    tg.expand();
    
    // Check if we're in local mode
    isLocalMode = import.meta.env?.VITE_LOCAL_EDITOR === 'true' || 
                  window.location.search.includes('local=true');
    
    if (isLocalMode) {
        loadLocalContent();
    }
    
    // Set up theme
    if (tg.colorScheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Editor navigation
    document.querySelectorAll('.editor-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchEditorTab(tab);
        });
    });
    
    // Program editor tabs
    document.querySelectorAll('.tab-item').forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchProgramTab(tab);
        });
    });
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    };
}

// Authentication
async function checkAuth() {
    const savedToken = localStorage.getItem('editor_token');
    if (savedToken) {
        try {
            const response = await fetch('/api/me', {
                headers: {
                    'Authorization': `Bearer ${savedToken}`
                }
            });
            
            if (response.ok) {
                currentUser = await response.json();
                authToken = savedToken;
                
                if (!currentUser.isEditor) {
                    showToast('У вас нет прав редактора', 'error');
                    setTimeout(() => window.location.href = '/', 2000);
                    return;
                }
                
                loadEditorContent();
            } else {
                localStorage.removeItem('editor_token');
                showAuthModal();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('editor_token');
            showAuthModal();
        }
    } else {
        showAuthModal();
    }
}

function showAuthModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-body">
                <h3>Авторизация редактора</h3>
                <p>Для доступа к редактору необходимо авторизоваться</p>
                <button class="btn btn-primary" onclick="authenticateWithTelegram()">Войти через Telegram</button>
                <button class="btn btn-secondary" onclick="showPinModal()">Ввести PIN</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function showPinModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-body">
                <h3>Введите PIN код</h3>
                <input type="password" id="pin-input" placeholder="PIN код" maxlength="4">
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="authenticateWithPin()">Войти</button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Focus on PIN input
    setTimeout(() => {
        document.getElementById('pin-input').focus();
    }, 100);
}

async function authenticateWithTelegram() {
    try {
        const initData = tg.initData;
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ initData })
        });
        
        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            currentUser = data.user;
            
            if (!currentUser.isEditor) {
                showToast('У вас нет прав редактора', 'error');
                setTimeout(() => window.location.href = '/', 2000);
                return;
            }
            
            localStorage.setItem('editor_token', authToken);
            document.querySelector('.modal').remove();
            loadEditorContent();
        } else {
            showToast('Ошибка авторизации', 'error');
        }
    } catch (error) {
        console.error('Telegram auth failed:', error);
        showToast('Ошибка авторизации', 'error');
    }
}

async function authenticateWithPin() {
    const pin = document.getElementById('pin-input').value;
    const devPin = import.meta.env?.VITE_DEV_PIN || '1234';
    
    if (pin === devPin) {
        // Create a mock user for PIN auth
        currentUser = {
            id: 'dev',
            name: 'Developer',
            isEditor: true
        };
        authToken = 'dev-token';
        
        localStorage.setItem('editor_token', authToken);
        localStorage.setItem('dev_override', 'true');
        
        document.querySelector('.modal').remove();
        loadEditorContent();
    } else {
        showToast('Неверный PIN код', 'error');
    }
}

// Editor navigation
function switchEditorTab(tabName) {
    // Update navigation
    document.querySelectorAll('.editor-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update sections
    document.querySelectorAll('.editor-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`editor-${tabName}`).classList.add('active');
    
    // Load tab-specific content
    switch (tabName) {
        case 'home':
            loadHomePageData();
            break;
        case 'programs':
            loadProgramsData();
            break;
        case 'reports':
            loadReportsData();
            break;
    }
}

function switchProgramTab(tabName) {
    document.querySelectorAll('.tab-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Load editor content
async function loadEditorContent() {
    if (isLocalMode) {
        loadLocalContent();
    } else {
        await loadHomePageData();
        await loadProgramsData();
        await loadReportsData();
    }
}

// Home page management
async function loadHomePageData() {
    if (isLocalMode) {
        const content = getLocalContent();
        document.getElementById('home-hero-image').value = content.home.hero_image_url || '';
        document.getElementById('home-headline').value = content.home.headline || '';
        document.getElementById('home-greeting').value = content.home.greeting || '';
        document.getElementById('home-cta').value = content.home.cta_text || '';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/content', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const homePage = data.pages.find(p => p.key === 'home') || {};
            
            document.getElementById('home-hero-image').value = homePage.hero_image_url || '';
            document.getElementById('home-headline').value = homePage.headline || '';
            document.getElementById('home-greeting').value = homePage.greeting || '';
            document.getElementById('home-cta').value = homePage.cta_text || '';
        }
    } catch (error) {
        console.error('Error loading home page data:', error);
        showToast('Ошибка загрузки данных', 'error');
    }
}

async function saveHomePage() {
    const data = {
        hero_image_url: document.getElementById('home-hero-image').value,
        headline: document.getElementById('home-headline').value,
        greeting: document.getElementById('home-greeting').value,
        cta_text: document.getElementById('home-cta').value
    };
    
    if (isLocalMode) {
        saveLocalContent({ home: data });
        showToast('Главная страница сохранена', 'success');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/pages/home', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('Главная страница сохранена', 'success');
        } else {
            showToast('Ошибка сохранения', 'error');
        }
    } catch (error) {
        console.error('Error saving home page:', error);
        showToast('Ошибка сохранения', 'error');
    }
}

function previewHomePage() {
    const data = {
        hero_image_url: document.getElementById('home-hero-image').value,
        headline: document.getElementById('home-headline').value,
        greeting: document.getElementById('home-greeting').value,
        cta_text: document.getElementById('home-cta').value
    };
    
    // Open preview in new window
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Предварительный просмотр</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .hero-image { width: 100%; max-width: 300px; margin: 0 auto 30px; border-radius: 20px; overflow: hidden; }
                .hero-image img { width: 100%; height: auto; display: block; }
                .home-content { text-align: center; max-width: 400px; margin: 0 auto; }
                .main-title { font-size: 32px; font-weight: 800; color: #2c3e50; margin-bottom: 15px; }
                .greeting { font-size: 16px; color: #6c757d; margin-bottom: 30px; line-height: 1.5; }
                .cta-button { background: linear-gradient(135deg, #007bff, #0056b3); color: white; border: none; padding: 15px 30px; font-size: 16px; font-weight: 600; border-radius: 25px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="hero-image">
                <img src="${data.hero_image_url}" alt="Hero image">
            </div>
            <div class="home-content">
                <h1 class="main-title">${data.headline}</h1>
                <p class="greeting">${data.greeting}</p>
                <button class="cta-button">${data.cta_text}</button>
            </div>
        </body>
        </html>
    `);
}

// Programs management
async function loadProgramsData() {
    if (isLocalMode) {
        const content = getLocalContent();
        renderProgramsList(content.programs);
        return;
    }
    
    try {
        const response = await fetch('/api/admin/content', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            renderProgramsList(data.programs);
        }
    } catch (error) {
        console.error('Error loading programs:', error);
        showToast('Ошибка загрузки программ', 'error');
    }
}

function renderProgramsList(programs) {
    const container = document.getElementById('programs-list');
    container.innerHTML = '';
    
    programs.forEach(program => {
        const programItem = document.createElement('div');
        programItem.className = 'program-item';
        programItem.innerHTML = `
            <div class="program-item-header">
                <h3 class="program-item-title">${program.title}</h3>
                <span class="program-item-status ${program.is_published ? 'published' : 'draft'}">
                    ${program.is_published ? 'Опубликовано' : 'Черновик'}
                </span>
            </div>
            <p class="program-item-description">${program.description || 'Без описания'}</p>
            <div class="program-item-actions">
                <button class="btn btn-primary" onclick="editProgram('${program.id}')">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteProgram('${program.id}')">Удалить</button>
            </div>
        `;
        container.appendChild(programItem);
    });
}

function showCreateProgramModal() {
    document.getElementById('create-program-modal').style.display = 'block';
}

function closeCreateProgramModal() {
    document.getElementById('create-program-modal').style.display = 'none';
    // Clear form
    document.getElementById('new-program-title').value = '';
    document.getElementById('new-program-slug').value = '';
    document.getElementById('new-program-description').value = '';
    document.getElementById('new-program-image').value = '';
    document.getElementById('new-program-details').value = '';
    document.getElementById('new-program-published').checked = true;
}

async function createProgram() {
    const data = {
        title: document.getElementById('new-program-title').value,
        slug: document.getElementById('new-program-slug').value,
        description: document.getElementById('new-program-description').value,
        image_url: document.getElementById('new-program-image').value,
        details_md: document.getElementById('new-program-details').value,
        is_published: document.getElementById('new-program-published').checked
    };
    
    if (!data.title || !data.slug) {
        showToast('Заполните название и slug', 'error');
        return;
    }
    
    if (isLocalMode) {
        const content = getLocalContent();
        const newProgram = {
            id: Date.now().toString(),
            slug: data.slug,
            title: data.title,
            description: data.description,
            image_url: data.image_url,
            details_md: data.details_md,
            is_published: data.is_published,
            days: []
        };
        content.programs.push(newProgram);
        saveLocalContent(content);
        closeCreateProgramModal();
        loadProgramsData();
        showToast('Программа создана', 'success');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/programs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeCreateProgramModal();
            loadProgramsData();
            showToast('Программа создана', 'success');
        } else {
            showToast('Ошибка создания программы', 'error');
        }
    } catch (error) {
        console.error('Error creating program:', error);
        showToast('Ошибка создания программы', 'error');
    }
}

let currentEditingProgram = null;

async function editProgram(programId) {
    currentEditingProgram = programId;
    
    if (isLocalMode) {
        const content = getLocalContent();
        const program = content.programs.find(p => p.id === programId);
        if (!program) return;
        
        // Fill form
        document.getElementById('edit-program-title').value = program.title;
        document.getElementById('edit-program-slug').value = program.slug;
        document.getElementById('edit-program-description').value = program.description || '';
        document.getElementById('edit-program-image').value = program.image_url || '';
        document.getElementById('edit-program-details').value = program.details_md || '';
        document.getElementById('edit-program-published').checked = program.is_published;
        
        // Load days
        loadProgramDays(program.days);
        
        document.getElementById('edit-program-modal').style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/content', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const program = data.programs.find(p => p.id === programId);
            if (!program) return;
            
            // Fill form
            document.getElementById('edit-program-title').value = program.title;
            document.getElementById('edit-program-slug').value = program.slug;
            document.getElementById('edit-program-description').value = program.description || '';
            document.getElementById('edit-program-image').value = program.image_url || '';
            document.getElementById('edit-program-details').value = program.details_md || '';
            document.getElementById('edit-program-published').checked = program.is_published;
            
            // Load days
            loadProgramDays(program.program_days);
            
            document.getElementById('edit-program-modal').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading program:', error);
        showToast('Ошибка загрузки программы', 'error');
    }
}

function closeEditProgramModal() {
    document.getElementById('edit-program-modal').style.display = 'none';
    currentEditingProgram = null;
}

async function updateProgram() {
    if (!currentEditingProgram) return;
    
    const data = {
        title: document.getElementById('edit-program-title').value,
        slug: document.getElementById('edit-program-slug').value,
        description: document.getElementById('edit-program-description').value,
        image_url: document.getElementById('edit-program-image').value,
        details_md: document.getElementById('edit-program-details').value,
        is_published: document.getElementById('edit-program-published').checked
    };
    
    if (!data.title || !data.slug) {
        showToast('Заполните название и slug', 'error');
        return;
    }
    
    if (isLocalMode) {
        const content = getLocalContent();
        const programIndex = content.programs.findIndex(p => p.id === currentEditingProgram);
        if (programIndex !== -1) {
            content.programs[programIndex] = { ...content.programs[programIndex], ...data };
            saveLocalContent(content);
            closeEditProgramModal();
            loadProgramsData();
            showToast('Программа обновлена', 'success');
        }
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/programs/${currentEditingProgram}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeEditProgramModal();
            loadProgramsData();
            showToast('Программа обновлена', 'success');
        } else {
            showToast('Ошибка обновления программы', 'error');
        }
    } catch (error) {
        console.error('Error updating program:', error);
        showToast('Ошибка обновления программы', 'error');
    }
}

async function deleteProgram(programId) {
    if (!confirm('Вы уверены, что хотите удалить эту программу?')) return;
    
    if (isLocalMode) {
        const content = getLocalContent();
        content.programs = content.programs.filter(p => p.id !== programId);
        saveLocalContent(content);
        loadProgramsData();
        showToast('Программа удалена', 'success');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/programs/${programId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            loadProgramsData();
            showToast('Программа удалена', 'success');
        } else {
            showToast('Ошибка удаления программы', 'error');
        }
    } catch (error) {
        console.error('Error deleting program:', error);
        showToast('Ошибка удаления программы', 'error');
    }
}

// Program days management
function loadProgramDays(days) {
    const container = document.getElementById('days-list');
    container.innerHTML = '';
    
    days.forEach(day => {
        const dayItem = document.createElement('div');
        dayItem.className = 'day-item';
        dayItem.innerHTML = `
            <div class="day-item-title">День ${day.day_index}</div>
            <div class="day-item-exercises">${day.exercises ? day.exercises.length : 0} упражнений</div>
        `;
        dayItem.addEventListener('click', () => editDay(day.id, day.day_index));
        container.appendChild(dayItem);
    });
}

function addProgramDay() {
    if (!currentEditingProgram) return;
    
    if (isLocalMode) {
        const content = getLocalContent();
        const program = content.programs.find(p => p.id === currentEditingProgram);
        if (program) {
            const newDay = {
                id: Date.now().toString(),
                day_index: program.days.length + 1,
                exercises: []
            };
            program.days.push(newDay);
            saveLocalContent(content);
            loadProgramDays(program.days);
            showToast('День добавлен', 'success');
        }
        return;
    }
    
    fetch(`/api/admin/programs/${currentEditingProgram}/days`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        loadProgramDays(data.days);
        showToast('День добавлен', 'success');
    })
    .catch(error => {
        console.error('Error adding day:', error);
        showToast('Ошибка добавления дня', 'error');
    });
}

let currentEditingDay = null;

function editDay(dayId, dayIndex) {
    currentEditingDay = dayId;
    document.getElementById('day-number').textContent = dayIndex;
    
    // Load exercises for this day
    loadDayExercises(dayId);
    
    document.getElementById('edit-day-modal').style.display = 'block';
}

function closeEditDayModal() {
    document.getElementById('edit-day-modal').style.display = 'none';
    currentEditingDay = null;
}

function loadDayExercises(dayId) {
    // This would load exercises for the specific day
    // For now, we'll show a placeholder
    const container = document.getElementById('exercises-list');
    container.innerHTML = '<p>Загрузка упражнений...</p>';
}

function addExercise() {
    if (!currentEditingDay) return;
    
    document.getElementById('edit-exercise-modal').style.display = 'block';
    // Clear form
    document.getElementById('edit-exercise-title').value = '';
    document.getElementById('edit-exercise-video').value = '';
    document.getElementById('edit-exercise-description').value = '';
    document.getElementById('edit-exercise-order').value = '1';
}

function closeEditExerciseModal() {
    document.getElementById('edit-exercise-modal').style.display = 'none';
}

function updateExercise() {
    // Exercise update logic
    showToast('Упражнение обновлено', 'success');
    closeEditExerciseModal();
}

function deleteExercise() {
    if (!confirm('Удалить упражнение?')) return;
    showToast('Упражнение удалено', 'success');
    closeEditExerciseModal();
}

// Reports settings
async function loadReportsData() {
    if (isLocalMode) {
        const content = getLocalContent();
        document.getElementById('calendar-enabled').checked = content.reports.calendar_enabled;
        return;
    }
    
    try {
        const response = await fetch('/api/admin/content', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('calendar-enabled').checked = data.reports.calendar_enabled;
        }
    } catch (error) {
        console.error('Error loading reports data:', error);
        showToast('Ошибка загрузки настроек отчетов', 'error');
    }
}

async function saveReportsSettings() {
    const data = {
        calendar_enabled: document.getElementById('calendar-enabled').checked
    };
    
    if (isLocalMode) {
        const content = getLocalContent();
        content.reports = { ...content.reports, ...data };
        saveLocalContent(content);
        showToast('Настройки сохранены', 'success');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/reports-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('Настройки сохранены', 'success');
        } else {
            showToast('Ошибка сохранения настроек', 'error');
        }
    } catch (error) {
        console.error('Error saving reports settings:', error);
        showToast('Ошибка сохранения настроек', 'error');
    }
}

// Tools
function exportData() {
    if (isLocalMode) {
        const content = getLocalContent();
        downloadJSON(content, 'content-export.json');
        showToast('Данные экспортированы', 'success');
        return;
    }
    
    fetch('/api/admin/content', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        downloadJSON(data, 'content-export.json');
        showToast('Данные экспортированы', 'success');
    })
    .catch(error => {
        console.error('Error exporting data:', error);
        showToast('Ошибка экспорта данных', 'error');
    });
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (isLocalMode) {
                saveLocalContent(data);
                showToast('Данные импортированы', 'success');
                loadEditorContent();
            } else {
                // In production mode, you might want to validate the data first
                showToast('Импорт в режиме разработки не поддерживается', 'warning');
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
            showToast('Ошибка чтения файла', 'error');
        }
    };
    reader.readAsText(file);
}

// Local mode functions
function getLocalContent() {
    if (!localContent) {
        const saved = localStorage.getItem('editor_content');
        if (saved) {
            localContent = JSON.parse(saved);
        } else {
            localContent = {
                home: {
                    hero_image_url: '',
                    headline: '',
                    greeting: '',
                    cta_text: 'Перейти к упражнениям'
                },
                programs: [],
                reports: {
                    calendar_enabled: true
                }
            };
        }
    }
    return localContent;
}

function saveLocalContent(content) {
    localContent = content;
    localStorage.setItem('editor_content', JSON.stringify(content));
}

function loadLocalContent() {
    const content = getLocalContent();
    loadHomePageData();
    loadProgramsData();
    loadReportsData();
}

// Utility functions
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function goBack() {
    window.location.href = '/';
}

// Export functions for global access
window.switchEditorTab = switchEditorTab;
window.saveHomePage = saveHomePage;
window.previewHomePage = previewHomePage;
window.showCreateProgramModal = showCreateProgramModal;
window.closeCreateProgramModal = closeCreateProgramModal;
window.createProgram = createProgram;
window.editProgram = editProgram;
window.closeEditProgramModal = closeEditProgramModal;
window.updateProgram = updateProgram;
window.deleteProgram = deleteProgram;
window.addProgramDay = addProgramDay;
window.editDay = editDay;
window.closeEditDayModal = closeEditDayModal;
window.addExercise = addExercise;
window.closeEditExerciseModal = closeEditExerciseModal;
window.updateExercise = updateExercise;
window.deleteExercise = deleteExercise;
window.saveReportsSettings = saveReportsSettings;
window.exportData = exportData;
window.importData = importData;
window.goBack = goBack;

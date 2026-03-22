// ===== CONFIGURATION =====
const API_BASE = '/api/finance';

// ===== FINANCE APP AUTHENTICATION =====
let financeSession = null;

// Get session from URL or localStorage
function getFinanceSession() {
    // First check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlSession = urlParams.get('session');

    if (urlSession) {
        localStorage.setItem('financeSession', urlSession);
        financeSession = urlSession;
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return urlSession;
    }

    // Then check localStorage
    financeSession = localStorage.getItem('financeSession');
    return financeSession;
}

// Check if authenticated
async function checkFinanceAuth() {
    const session = getFinanceSession();
    if (!session) return false;

    try {
        const res = await fetch('/api/finance-auth-check', {
            headers: { 'X-Finance-Session': session }
        });
        const data = await res.json();

        if (!data.authenticated) {
            localStorage.removeItem('financeSession');
            financeSession = null;
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

// Show login modal
function showFinanceLoginModal() {
    const modal = document.createElement('div');
    modal.id = 'finance-login-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: flex; align-items: center; justify-content: center; z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="background: #fff; padding: 2rem; border-radius: 12px; 
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3); width: 100%; max-width: 380px;">
            <h1 style="color: #1a1a2e; margin-bottom: 1.5rem; text-align: center; font-size: 1.5rem;">🔒 Finance App</h1>
            <div id="finance-login-error" style="color: #e74c3c; margin-bottom: 1rem; padding: 0.75rem; 
                 background: #fee; border-radius: 6px; display: none;"></div>
            <form id="finance-login-form">
                <input type="password" id="finance-password" placeholder="Enter password" 
                       style="width: 100%; padding: 0.875rem; margin-bottom: 1rem; border: 2px solid #e0e0e0; 
                              border-radius: 8px; font-size: 1rem;" required autofocus>
                <button type="submit" style="width: 100%; padding: 0.875rem; background: #4f46e5; color: #fff; 
                        border: none; border-radius: 8px; font-size: 1rem; cursor: pointer;">Login</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('finance-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('finance-password').value;
        const errorDiv = document.getElementById('finance-login-error');

        try {
            const res = await fetch('/api/finance-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('financeSession', data.session);
                financeSession = data.session;
                window.location.reload();
            } else {
                errorDiv.textContent = data.error || 'Invalid password';
                errorDiv.style.display = 'block';
            }
        } catch (err) {
            errorDiv.textContent = 'Login failed. Please try again.';
            errorDiv.style.display = 'block';
        }
    });
}

// Initialize finance authentication check
async function initFinanceAuth() {
    const isAuth = await checkFinanceAuth();
    if (!isAuth) {
        showFinanceLoginModal();
        return false;
    }
    return true;
}

// Current month/year state
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();

// Load from localStorage if available
const savedMonth = localStorage.getItem('financeMonth');
const savedYear = localStorage.getItem('financeYear');
if (savedMonth && savedYear) {
    currentMonth = parseInt(savedMonth);
    currentYear = parseInt(savedYear);
}

// ===== API HELPER =====
async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const session = getFinanceSession();

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'X-Finance-Session': session || '',
        },
        ...options,
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        // Handle authentication errors
        if (response.status === 401 && data.code === 'FINANCE_AUTH_REQUIRED') {
            showFinanceLoginModal();
            throw new Error('Session expired. Please login again.');
        }

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    } catch (error) {
        if (error.message !== 'Session expired. Please login again.') {
            showToast(error.message || 'An error occurred', 'error');
        }
        throw error;
    }
}

// ===== CURRENCY FORMATTING =====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

function parseCurrency(str) {
    if (typeof str === 'number') return str;
    return parseFloat(str.replace(/[₹,\s]/g, '')) || 0;
}

// ===== DATE UTILITIES =====
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = getMonthName(date.getMonth() + 1).substring(0, 3);
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

function formatDateForInput(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMonthName(num) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[num - 1] || '';
}

function getDaysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
}

function getDaysRemaining(month, year) {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
        return 0;
    }

    if (year === currentYear && month === currentMonth) {
        const daysInMonth = getDaysInMonth(month, year);
        return daysInMonth - currentDay;
    }

    return getDaysInMonth(month, year);
}

// ===== MONTH NAVIGATOR =====
function initMonthNavigator(onChange) {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const currentMonthEl = document.getElementById('current-month');

    function updateDisplay() {
        if (currentMonthEl) {
            currentMonthEl.textContent = `${getMonthName(currentMonth)} ${currentYear}`;
        }
        localStorage.setItem('financeMonth', currentMonth);
        localStorage.setItem('financeYear', currentYear);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 1) {
                currentMonth = 12;
                currentYear--;
            }
            updateDisplay();
            if (onChange) onChange(currentMonth, currentYear);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
            updateDisplay();
            if (onChange) onChange(currentMonth, currentYear);
        });
    }

    updateDisplay();
}

// ===== MODAL SYSTEM =====
function openModal(title, bodyHTML, onSave) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');

    if (!overlay || !titleEl || !bodyEl) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHTML;

    // Add save button if onSave provided
    if (onSave) {
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        footer.innerHTML = `
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" id="modal-save-btn">Save</button>
        `;
        bodyEl.appendChild(footer);

        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                try {
                    await onSave();
                    closeModal();
                } catch (error) {
                    // Error already handled by api()
                }
            });
        }
    }

    overlay.classList.add('active');
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Close modal on overlay click or close button
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
    }

    const closeBtn = document.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
});

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== CONFIRMATION DIALOG =====
function showConfirm(message, onConfirm) {
    const bodyHTML = `
        <p style="margin-bottom: var(--space-lg);">${message}</p>
    `;

    openModal('Confirm', bodyHTML, async () => {
        if (onConfirm) await onConfirm();
    });
}

// ===== CATEGORY CONFIGURATION =====
const DEFAULT_INCOME_CATEGORIES = [
    { name: 'Salary', icon: '💼' },
    { name: 'Freelance', icon: '💻' },
    { name: 'Business', icon: '🏪' },
    { name: 'Investment', icon: '📈' },
    { name: 'Rental', icon: '🏠' },
    { name: 'Refund', icon: '↩️' },
    { name: 'Gift', icon: '🎁' },
    { name: 'Other', icon: '📌' }
];

const DEFAULT_EXPENSE_CATEGORIES = [
    { name: 'Food & Dining', icon: '🍔', color: '#F97316' },
    { name: 'Groceries', icon: '🛒', color: '#84CC16' },
    { name: 'Transport', icon: '🚗', color: '#3B82F6' },
    { name: 'Rent', icon: '🏠', color: '#8B5CF6' },
    { name: 'Utilities', icon: '💡', color: '#F59E0B' },
    { name: 'Shopping', icon: '🛍️', color: '#EC4899' },
    { name: 'Entertainment', icon: '🎬', color: '#A855F7' },
    { name: 'Health', icon: '🏥', color: '#EF4444' },
    { name: 'Education', icon: '📚', color: '#06B6D4' },
    { name: 'EMI/Loan', icon: '🏦', color: '#64748B' },
    { name: 'Insurance', icon: '🛡️', color: '#14B8A6' },
    { name: 'Subscriptions', icon: '📱', color: '#F43F5E' },
    { name: 'Personal Care', icon: '💇', color: '#D946EF' },
    { name: 'Travel', icon: '✈️', color: '#0EA5E9' },
    { name: 'Gifts & Donations', icon: '🎁', color: '#FB923C' },
    { name: 'Investment', icon: '💰', color: '#22C55E' },
    { name: 'Tax', icon: '📋', color: '#78716C' },
    { name: 'Other', icon: '📌', color: '#94A3B8' }
];

// Load custom categories from localStorage or use defaults
const INCOME_CATEGORIES = JSON.parse(localStorage.getItem('financeIncomeCategories')) || DEFAULT_INCOME_CATEGORIES;
const EXPENSE_CATEGORIES = JSON.parse(localStorage.getItem('financeExpenseCategories')) || DEFAULT_EXPENSE_CATEGORIES;

// Get enabled categories only (filter out disabled ones)
function getEnabledCategories(type = 'expense') {
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return categories.filter(cat => !cat.disabled);
}

// Get all categories including disabled ones
function getAllCategories(type = 'expense') {
    return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

const PAYMENT_METHODS = [
    'Cash', 'UPI', 'Credit Card', 'Debit Card',
    'Net Banking', 'Wallet', 'Other'
];

// ===== SIDEBAR MOBILE TOGGLE =====
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }
});

// ===== THEME =====
function applyTheme(mode) {
    const html = document.documentElement;
    if (mode === 'dark') {
        html.setAttribute('data-theme', 'dark');
    } else if (mode === 'light') {
        html.removeAttribute('data-theme');
    } else {
        // System preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
    }
}

// Apply theme on load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('financeTheme') || 'light';
    applyTheme(savedTheme);
});

// ===== UTILITY HELPERS =====
function getProgressColor(percentage) {
    if (percentage < 60) return 'progress-green';
    if (percentage < 85) return 'progress-yellow';
    return 'progress-red';
}

function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

function buildQueryString(params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            query.append(key, value);
        }
    }
    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
}

// ===== CATEGORY HELPERS =====
function getCategoryIcon(categoryName, type = 'expense') {
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const category = categories.find(c => c.name === categoryName);
    return category ? category.icon : '📌';
}

function getCategoryColor(categoryName) {
    const category = EXPENSE_CATEGORIES.find(c => c.name === categoryName);
    return category ? category.color : '#94A3B8';
}

// ===== FORM HELPERS =====
function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};

    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
        data[key] = value;
    }

    return data;
}

function populateForm(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;

    for (const [key, value] of Object.entries(data)) {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = value;
            } else {
                input.value = value;
            }
        }
    }
}

// ===== VALIDATION HELPERS =====
function validateRequired(fields) {
    for (const [key, value] of Object.entries(fields)) {
        if (!value && value !== 0) {
            showToast(`${key} is required`, 'error');
            return false;
        }
    }
    return true;
}

function validateAmount(amount) {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
        showToast('Please enter a valid amount', 'error');
        return false;
    }
    return true;
}

// ===== EXPORT UTILITIES =====
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

function downloadCSV(data, filename) {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===== NUMBER FORMATTING =====
function formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
}

function formatPercentage(num) {
    return `${parseFloat(num).toFixed(1)}%`;
}

// ===== DATE RANGE HELPERS =====
function getMonthDateRange(month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    return { startDate, endDate };
}

function isDateInRange(date, startDate, endDate) {
    const d = new Date(date);
    return d >= startDate && d <= endDate;
}

// ===== SORTING HELPERS =====
function sortByDate(items, key = 'date', ascending = false) {
    return [...items].sort((a, b) => {
        const dateA = new Date(a[key]);
        const dateB = new Date(b[key]);
        return ascending ? dateA - dateB : dateB - dateA;
    });
}

function sortByAmount(items, key = 'amount', ascending = false) {
    return [...items].sort((a, b) => {
        return ascending ? a[key] - b[key] : b[key] - a[key];
    });
}

// ===== GROUPING HELPERS =====
function groupByDate(items, dateKey = 'date') {
    const groups = {};
    items.forEach(item => {
        const date = new Date(item[dateKey]).toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(item);
    });
    return groups;
}

function groupByCategory(items, categoryKey = 'category') {
    const groups = {};
    items.forEach(item => {
        const category = item[categoryKey];
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(item);
    });
    return groups;
}

// ===== CHART HELPERS =====
function createDoughnut(canvasId, labels, data, colors) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createBarChart(canvasId, labels, datasets) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function createLineChart(canvasId, labels, datasets) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function createHorizontalBar(canvasId, labels, budgeted, actual) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Budgeted',
                    data: budgeted,
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Actual',
                    data: actual,
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.x)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Destroy chart if exists
function destroyChart(chart) {
    if (chart) {
        chart.destroy();
    }
}

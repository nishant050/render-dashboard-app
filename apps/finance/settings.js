// ===== SETTINGS PAGE LOGIC =====

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await initFinanceAuth();
    if (!isAuth) return;

    loadSettings();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('export-json-btn').addEventListener('click', exportJSON);
    document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('clear-data-btn').addEventListener('click', clearAllData);

    // Category management
    document.getElementById('add-expense-category-btn').addEventListener('click', () => openCategoryForm('expense'));
    document.getElementById('add-income-category-btn').addEventListener('click', () => openCategoryForm('income'));
}

// Load settings
async function loadSettings() {
    try {
        const settings = await api('/settings');
        populateSettings(settings);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Populate settings form
function populateSettings(settings) {
    // Theme
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
        radio.checked = radio.value === settings.theme;
    });

    // Date format
    document.getElementById('date-format').value = settings.dateFormat || 'DD/MM/YYYY';

    // Show decimals
    document.getElementById('show-decimals').checked = settings.showDecimals !== false;

    // Default payment method
    document.getElementById('default-payment').value = settings.defaultPaymentMethod || 'Cash';
}

// Save settings
async function saveSettings() {
    try {
        const theme = document.querySelector('input[name="theme"]:checked').value;
        const dateFormat = document.getElementById('date-format').value;
        const showDecimals = document.getElementById('show-decimals').checked;
        const defaultPaymentMethod = document.getElementById('default-payment').value;

        const settings = {
            theme,
            dateFormat,
            showDecimals,
            defaultPaymentMethod
        };

        await api('/settings', {
            method: 'PUT',
            body: settings
        });

        // Apply theme
        applyTheme(theme);
        localStorage.setItem('financeTheme', theme);

        showToast('Settings saved successfully', 'success');
    } catch (error) {
        showToast('Error saving settings', 'error');
    }
}

// Export JSON
async function exportJSON() {
    try {
        const data = await api('/data/export', { method: 'POST' });

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rupeetracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Data exported successfully', 'success');
    } catch (error) {
        showToast('Error exporting data', 'error');
    }
}

// Export CSV
async function exportCSV() {
    try {
        const transactions = await api('/transactions');

        if (!transactions || transactions.length === 0) {
            showToast('No transactions to export', 'info');
            return;
        }

        const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Payment Method', 'Tags'];
        const rows = transactions.map(tx => [
            formatDate(tx.date),
            tx.type,
            tx.category,
            tx.description || '',
            tx.amount,
            tx.paymentMethod || '',
            (tx.tags || []).join('; ')
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rupeetracker-transactions-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('CSV exported successfully', 'success');
    } catch (error) {
        showToast('Error exporting CSV', 'error');
    }
}

// Import data
async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate data structure
        if (!data.transactions && !data.budgets && !data.bills && !data.goals && !data.accounts) {
            showToast('Invalid backup file format', 'error');
            return;
        }

        showConfirm(
            'This will replace all existing data. Are you sure you want to continue?',
            async () => {
                try {
                    await api('/data/import', {
                        method: 'POST',
                        body: data
                    });

                    showToast('Data imported successfully', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } catch (error) {
                    showToast('Error importing data', 'error');
                }
            }
        );
    } catch (error) {
        showToast('Error reading file', 'error');
    }

    // Reset file input
    event.target.value = '';
}

// Clear all data
function clearAllData() {
    openModal('Clear All Data', `
        <div class="text-center">
            <div class="text-4xl mb-md">⚠️</div>
            <p class="mb-md">This will permanently delete all your data including:</p>
            <ul class="text-left mb-lg" style="list-style: disc; padding-left: 1.5rem;">
                <li>All transactions</li>
                <li>All budgets</li>
                <li>All bills</li>
                <li>All goals</li>
                <li>All accounts</li>
                <li>All settings</li>
            </ul>
            <p class="amount-negative font-semibold mb-md">This action cannot be undone!</p>
            <div class="form-group">
                <label class="form-label">Type "DELETE" to confirm</label>
                <input type="text" class="form-input" id="confirm-delete" placeholder="DELETE">
            </div>
        </div>
    `, async () => {
        const confirmText = document.getElementById('confirm-delete').value;
        if (confirmText !== 'DELETE') {
            showToast('Please type DELETE to confirm', 'error');
            return;
        }

        try {
            await api('/data/clear', { method: 'DELETE' });
            showToast('All data cleared', 'success');
            setTimeout(() => {
                window.location.href = '/finance/';
            }, 1000);
        } catch (error) {
            showToast('Error clearing data', 'error');
        }
    });
}

// ===== CATEGORY MANAGEMENT =====

// Load and render categories
function loadCategories() {
    const expenseCategories = JSON.parse(localStorage.getItem('financeExpenseCategories')) || EXPENSE_CATEGORIES;
    const incomeCategories = JSON.parse(localStorage.getItem('financeIncomeCategories')) || INCOME_CATEGORIES;

    renderCategoryList('expense', expenseCategories);
    renderCategoryList('income', incomeCategories);
}

// Render category list
function renderCategoryList(type, categories) {
    const container = document.getElementById(`${type}-categories-list`);
    if (!container) return;

    let html = '';
    categories.forEach((cat, index) => {
        const isDisabled = cat.disabled;
        html += `
            <div class="category-item ${isDisabled ? 'disabled' : ''}" data-index="${index}">
                <div class="category-info">
                    <span class="category-icon">${cat.icon}</span>
                    <span class="category-name">${cat.name}</span>
                    ${cat.color ? `<span class="category-color" style="background-color: ${cat.color}"></span>` : ''}
                </div>
                <div class="category-actions">
                    <button class="btn btn-ghost btn-xs" onclick="toggleCategory('${type}', ${index})">
                        ${isDisabled ? '✅ Enable' : '❌ Disable'}
                    </button>
                    <button class="btn btn-ghost btn-xs" onclick="editCategory('${type}', ${index})">✏️ Edit</button>
                    <button class="btn btn-ghost btn-xs" onclick="deleteCategory('${type}', ${index})">🗑️ Delete</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Open category form
function openCategoryForm(type, existingCategory = null, index = null) {
    const formHTML = `
        <form id="category-form">
            <div class="form-group">
                <label class="form-label">Category Name</label>
                <input type="text" name="name" class="form-input" placeholder="e.g., Food, Travel"
                    value="${existingCategory?.name || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Icon (emoji)</label>
                <input type="text" name="icon" class="form-input" placeholder="e.g., 🍔, 🚗"
                    value="${existingCategory?.icon || '📌'}" required>
            </div>
            ${type === 'expense' ? `
            <div class="form-group">
                <label class="form-label">Color (hex)</label>
                <input type="color" name="color" class="form-input"
                    value="${existingCategory?.color || '#94A3B8'}">
            </div>
            ` : ''}
        </form>
    `;

    openModal(existingCategory ? 'Edit Category' : 'Add Category', formHTML, async () => {
        const form = document.getElementById('category-form');
        const formData = new FormData(form);

        const category = {
            name: formData.get('name'),
            icon: formData.get('icon'),
            ...(type === 'expense' && { color: formData.get('color') })
        };

        if (!validateRequired({ name: category.name, icon: category.icon })) return;

        const categories = JSON.parse(localStorage.getItem(`finance${type.charAt(0).toUpperCase() + type.slice(1)}Categories`)) ||
            (type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);

        if (existingCategory && index !== null) {
            categories[index] = category;
        } else {
            categories.push(category);
        }

        localStorage.setItem(`finance${type.charAt(0).toUpperCase() + type.slice(1)}Categories`, JSON.stringify(categories));
        renderCategoryList(type, categories);
        showToast('Category saved successfully', 'success');
    });
}

// Edit category
function editCategory(type, index) {
    const categories = JSON.parse(localStorage.getItem(`finance${type.charAt(0).toUpperCase() + type.slice(1)}Categories`)) ||
        (type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);
    const category = categories[index];
    openCategoryForm(type, category, index);
}

// Toggle category enabled/disabled
function toggleCategory(type, index) {
    const categories = JSON.parse(localStorage.getItem(`finance${type.charAt(0).toUpperCase() + type.slice(1)}Categories`)) ||
        (type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);

    categories[index].disabled = !categories[index].disabled;
    localStorage.setItem(`finance${type.charAt(0).toUpperCase() + type.slice(1)}Categories`, JSON.stringify(categories));
    renderCategoryList(type, categories);
    showToast(`Category ${categories[index].disabled ? 'disabled' : 'enabled'}`, 'success');
}

// Delete category
function deleteCategory(type, index) {
    showConfirm('Are you sure you want to delete this category?', () => {
        const categories = JSON.parse(localStorage.getItem(`finance${type.charAt(0).toUpperCase() + type.slice(1)}Categories`)) ||
            (type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);

        categories.splice(index, 1);
        localStorage.setItem(`finance${type.charAt(0).toUpperCase() + type.slice(1)}Categories`, JSON.stringify(categories));
        renderCategoryList(type, categories);
        showToast('Category deleted successfully', 'success');
    });
}

// Initialize categories on page load
document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await initFinanceAuth();
    if (!isAuth) return;

    loadCategories();
});

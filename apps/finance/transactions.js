// Transactions Page Logic
let currentType = 'all';
let currentCategory = '';
let searchQuery = '';
let sortBy = '-date';

document.addEventListener('DOMContentLoaded', () => {
    initMonthNavigator(loadTransactions);
    setupFilters();
    loadTransactions(currentMonth, currentYear);

    // Add Transaction button
    document.getElementById('add-transaction-btn').addEventListener('click', () => {
        openTransactionForm('expense');
    });
});

function setupFilters() {
    // Type tabs
    const typeTabs = document.querySelectorAll('.tab-btn');
    typeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            typeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentType = tab.dataset.type;
            loadTransactions(currentMonth, currentYear);
        });
    });

    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    const allCategories = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = `${cat.icon} ${cat.name}`;
        categoryFilter.appendChild(option);
    });

    categoryFilter.addEventListener('change', () => {
        currentCategory = categoryFilter.value;
        loadTransactions(currentMonth, currentYear);
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce(() => {
        searchQuery = searchInput.value;
        loadTransactions(currentMonth, currentYear);
    }, 300));
}

async function loadTransactions(month, year) {
    try {
        const params = {
            month,
            year,
            sort: sortBy
        };

        if (currentType !== 'all') params.type = currentType;
        if (currentCategory) params.category = currentCategory;
        if (searchQuery) params.search = searchQuery;

        const queryString = buildQueryString(params);
        const transactions = await api(`/transactions${queryString}`);
        renderTransactionList(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function renderTransactionList(transactions) {
    const container = document.getElementById('transaction-list');

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💸</div>
                <div class="empty-state-title">No Transactions Found</div>
                <div class="empty-state-text">Add your first transaction to get started</div>
            </div>
        `;
        return;
    }

    // Group transactions by date
    const grouped = groupByDate(transactions);
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    let html = '';

    sortedDates.forEach(dateStr => {
        const date = new Date(dateStr);
        const dayTransactions = grouped[dateStr];
        const dailyTotal = dayTransactions.reduce((sum, tx) => {
            return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
        }, 0);

        html += `
            <div class="transaction-group">
                <div class="transaction-group-header">
                    <span>${formatDate(dateStr)}</span>
                    <span class="${dailyTotal >= 0 ? 'amount-positive' : 'amount-negative'}">
                        ${dailyTotal >= 0 ? '+' : ''}${formatCurrency(dailyTotal)}
                    </span>
                </div>
        `;

        dayTransactions.forEach(tx => {
            const icon = getCategoryIcon(tx.category, tx.type);
            const amountClass = tx.type === 'income' ? 'amount-positive' : 'amount-negative';
            const amountPrefix = tx.type === 'income' ? '+' : '-';

            html += `
                <div class="transaction-row">
                    <div class="transaction-icon">${icon}</div>
                    <div class="transaction-details">
                        <div class="transaction-description">${tx.description || tx.category}</div>
                        <div class="transaction-meta">
                            ${tx.category} • ${tx.paymentMethod || 'Cash'}
                            ${tx.tags && tx.tags.length > 0 ? ' • ' + tx.tags.map(t => `<span class="tag">${t}</span>`).join('') : ''}
                        </div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountPrefix}${formatCurrency(tx.amount)}
                    </div>
                    <div class="transaction-actions">
                        <button class="btn btn-ghost btn-sm" onclick="editTransaction('${tx._id}')">✏️</button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteTransaction('${tx._id}')">🗑️</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
    });

    container.innerHTML = html;
}

function openTransactionForm(type, existingData = null) {
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const categoryOptions = categories.map(c =>
        `<option value="${c.name}" ${existingData?.category === c.name ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');

    const paymentOptions = PAYMENT_METHODS.map(m =>
        `<option value="${m}" ${existingData?.paymentMethod === m ? 'selected' : ''}>${m}</option>`
    ).join('');

    const formHTML = `
        <form id="transaction-form">
            <div class="form-group">
                <label class="form-label">Type</label>
                <div class="type-toggle">
                    <button type="button" class="${type === 'income' ? 'active' : ''}" data-type="income">Income</button>
                    <button type="button" class="${type === 'expense' ? 'active' : ''}" data-type="expense">Expense</button>
                </div>
                <input type="hidden" name="type" value="${type}">
            </div>
            <div class="form-group">
                <label class="form-label">Amount (₹)</label>
                <input type="number" name="amount" class="form-input" placeholder="0.00" step="0.01" 
                    value="${existingData?.amount || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Category</label>
                <select name="category" class="form-select" required>
                    <option value="">Select category</option>
                    ${categoryOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" name="description" class="form-input" placeholder="Enter description"
                    value="${existingData?.description || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" name="date" class="form-input" 
                    value="${existingData ? formatDateForInput(existingData.date) : formatDateForInput(new Date())}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Payment Method</label>
                <select name="paymentMethod" class="form-select">
                    ${paymentOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Tags (comma separated)</label>
                <input type="text" name="tags" class="form-input" placeholder="tag1, tag2"
                    value="${existingData?.tags?.join(', ') || ''}">
            </div>
        </form>
    `;

    const title = existingData ? 'Edit Transaction' : `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`;

    openModal(title, formHTML, async () => {
        const form = document.getElementById('transaction-form');
        const formData = new FormData(form);
        const tags = formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()).filter(t => t) : [];

        const data = {
            type: formData.get('type'),
            amount: parseFloat(formData.get('amount')),
            category: formData.get('category'),
            description: formData.get('description'),
            date: formData.get('date'),
            paymentMethod: formData.get('paymentMethod'),
            tags
        };

        if (!validateAmount(data.amount)) return;
        if (!validateRequired({ category: data.category })) return;

        if (existingData) {
            await api(`/transactions/${existingData._id}`, { method: 'PUT', body: data });
            showToast('Transaction updated successfully', 'success');
        } else {
            await api('/transactions', { method: 'POST', body: data });
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully`, 'success');
        }

        loadTransactions(currentMonth, currentYear);
    });

    // Type toggle functionality
    const typeButtons = document.querySelectorAll('.type-toggle button');
    typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            typeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const newType = btn.dataset.type;
            document.querySelector('input[name="type"]').value = newType;

            // Update category dropdown
            const categorySelect = document.querySelector('select[name="category"]');
            const newCategories = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
            categorySelect.innerHTML = '<option value="">Select category</option>' +
                newCategories.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
        });
    });
}

async function editTransaction(id) {
    try {
        const transaction = await api(`/transactions`);
        const tx = transaction.find(t => t._id === id);
        if (tx) {
            openTransactionForm(tx.type, tx);
        }
    } catch (error) {
        console.error('Error fetching transaction:', error);
    }
}

async function deleteTransaction(id) {
    showConfirm('Are you sure you want to delete this transaction?', async () => {
        try {
            await api(`/transactions/${id}`, { method: 'DELETE' });
            showToast('Transaction deleted successfully', 'success');
            loadTransactions(currentMonth, currentYear);
        } catch (error) {
            console.error('Error deleting transaction:', error);
        }
    });
}

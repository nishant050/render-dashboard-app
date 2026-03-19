// Dashboard Page Logic
let categoryChart = null;
let trendChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initMonthNavigator(loadDashboard);
    loadDashboard(currentMonth, currentYear);

    // Add Income button
    document.getElementById('add-income-btn').addEventListener('click', () => {
        openTransactionForm('income');
    });

    // Add Expense button
    document.getElementById('add-expense-btn').addEventListener('click', () => {
        openTransactionForm('expense');
    });
});

async function loadDashboard(month, year) {
    try {
        const [summary, budget, bills, goals, transactions, trends] = await Promise.all([
            api(`/transactions/summary?month=${month}&year=${year}`),
            api(`/budgets?month=${month}&year=${year}`),
            api('/bills/upcoming?days=15'),
            api('/goals/summary'),
            api(`/transactions?month=${month}&year=${year}&limit=8&sort=-date`),
            api('/reports/trends?months=6')
        ]);

        renderSummaryCards(summary, budget);
        renderBudgetProgress(budget, summary);
        renderUpcomingBills(bills);
        renderRecentTransactions(transactions);
        renderGoalsSummary(goals);
        renderMiniCharts(summary, trends);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderSummaryCards(summary, budget) {
    const totalIncome = summary.totalIncome || 0;
    const totalExpenses = summary.totalExpenses || 0;
    const savings = summary.savings || 0;
    const savingsRate = summary.savingsRate || 0;

    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('savings-rate').textContent = `${savingsRate}%`;

    // Calculate remaining budget
    if (budget) {
        const remaining = budget.totalBudget - totalExpenses;
        document.getElementById('remaining-budget').textContent = formatCurrency(remaining);
        document.getElementById('remaining-budget').className =
            `summary-card-value ${remaining >= 0 ? 'amount-positive' : 'amount-negative'}`;
    } else {
        document.getElementById('remaining-budget').textContent = 'N/A';
    }

    // Trend indicators (placeholder - would need last month's data for real comparison)
    document.getElementById('income-trend').innerHTML = '<span class="trend-up">↑ 12%</span>';
    document.getElementById('expenses-trend').innerHTML = '<span class="trend-down">↓ 5%</span>';
    document.getElementById('budget-trend').innerHTML = '<span class="trend-up">On track</span>';
    document.getElementById('savings-trend').innerHTML = `<span class="${savingsRate > 20 ? 'trend-up' : 'trend-down'}">${savingsRate > 20 ? '↑' : '↓'} ${savingsRate}%</span>`;
}

function renderBudgetProgress(budget, summary) {
    const container = document.getElementById('budget-progress-content');

    if (!budget) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-title">No Budget Set</div>
                <div class="empty-state-text">Set up your monthly budget to track spending</div>
                <a href="/finance/budget.html" class="btn btn-primary mt-md">Set Budget</a>
            </div>
        `;
        return;
    }

    const totalSpent = summary.totalExpenses || 0;
    const percentage = budget.totalBudget > 0 ? (totalSpent / budget.totalBudget * 100) : 0;
    const progressColor = getProgressColor(percentage);

    let html = `
        <div class="budget-overview">
            <div class="budget-overview-header">
                <span>${formatCurrency(totalSpent)} spent of ${formatCurrency(budget.totalBudget)}</span>
                <span>${percentage.toFixed(1)}%</span>
            </div>
            <div class="budget-overview-bar">
                <div class="budget-overview-fill ${progressColor}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
        </div>
    `;

    // Top 5 categories
    if (budget.categories && budget.categories.length > 0) {
        const topCategories = budget.categories.slice(0, 5);
        html += '<div class="budget-categories">';

        topCategories.forEach(cat => {
            const spent = summary.byCategory?.find(c => c._id === cat.name)?.total || 0;
            const catPercentage = cat.allocated > 0 ? (spent / cat.allocated * 100) : 0;
            const catColor = getProgressColor(catPercentage);

            html += `
                <div class="budget-category-row">
                    <div class="budget-category-icon">${getCategoryIcon(cat.name)}</div>
                    <div class="budget-category-info">
                        <div class="budget-category-name">${cat.name}</div>
                        <div class="budget-category-bar">
                            <div class="budget-category-fill ${catColor}" style="width: ${Math.min(catPercentage, 100)}%"></div>
                        </div>
                    </div>
                    <div class="budget-category-numbers">
                        <div class="budget-category-spent">${formatCurrency(spent)}</div>
                        <div class="budget-category-allocated">/ ${formatCurrency(cat.allocated)}</div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
    }

    container.innerHTML = html;
}

function renderUpcomingBills(bills) {
    const container = document.getElementById('upcoming-bills-content');

    if (!bills || bills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-title">No Upcoming Bills</div>
                <div class="empty-state-text">Add recurring bills to track them here</div>
            </div>
        `;
        return;
    }

    let html = '<ul class="widget-list">';
    bills.slice(0, 5).forEach(bill => {
        const daysText = bill.daysUntil === 0 ? 'Today' :
            bill.daysUntil === 1 ? 'Tomorrow' :
                `In ${bill.daysUntil} days`;

        html += `
            <li>
                <div>
                    <div style="font-weight: 500;">${bill.name}</div>
                    <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">${daysText}</div>
                </div>
                <div style="font-weight: 600;">${formatCurrency(bill.amount)}</div>
            </li>
        `;
    });
    html += '</ul>';

    container.innerHTML = html;
}

function renderRecentTransactions(transactions) {
    const container = document.getElementById('recent-transactions-content');

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💸</div>
                <div class="empty-state-title">No Transactions Yet</div>
                <div class="empty-state-text">Start tracking your income and expenses</div>
            </div>
        `;
        return;
    }

    let html = '<ul class="widget-list">';
    transactions.forEach(tx => {
        const icon = getCategoryIcon(tx.category, tx.type);
        const amountClass = tx.type === 'income' ? 'amount-positive' : 'amount-negative';
        const amountPrefix = tx.type === 'income' ? '+' : '-';

        html += `
            <li>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                    <span>${icon}</span>
                    <div>
                        <div style="font-weight: 500;">${tx.description || tx.category}</div>
                        <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">${formatDate(tx.date)}</div>
                    </div>
                </div>
                <div class="${amountClass}" style="font-weight: 600;">${amountPrefix}${formatCurrency(tx.amount)}</div>
            </li>
        `;
    });
    html += '</ul>';

    container.innerHTML = html;
}

function renderGoalsSummary(goals) {
    const container = document.getElementById('goals-summary-content');

    if (!goals || goals.activeCount === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎯</div>
                <div class="empty-state-title">No Goals Set</div>
                <div class="empty-state-text">Create savings goals to track your progress</div>
            </div>
        `;
        return;
    }

    let html = `
        <div style="display: flex; gap: var(--space-lg); margin-bottom: var(--space-md);">
            <div>
                <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">Total Saved</div>
                <div style="font-size: var(--font-size-xl); font-weight: 700;">${formatCurrency(goals.totalSaved)}</div>
            </div>
            <div>
                <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">Remaining</div>
                <div style="font-size: var(--font-size-xl); font-weight: 700;">${formatCurrency(goals.totalRemaining)}</div>
            </div>
            <div>
                <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">Active Goals</div>
                <div style="font-size: var(--font-size-xl); font-weight: 700;">${goals.activeCount}</div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function renderMiniCharts(summary, trends) {
    // Category chart
    if (categoryChart) {
        categoryChart.destroy();
    }

    if (summary.byCategory && summary.byCategory.length > 0) {
        const labels = summary.byCategory.map(c => c._id);
        const data = summary.byCategory.map(c => c.total);
        const colors = summary.byCategory.map(c => getCategoryColor(c._id));

        categoryChart = createDoughnut('category-chart', labels, data, colors);
    }

    // Trend chart - use actual trends data
    if (trendChart) {
        trendChart.destroy();
    }

    if (trends && trends.length > 0) {
        const trendLabels = trends.map(t => getMonthName(t.month).substring(0, 3));
        const incomeData = trends.map(t => t.income);
        const expenseData = trends.map(t => t.expenses);

        trendChart = createBarChart('trend-chart', trendLabels, [
            {
                label: 'Income',
                data: incomeData,
                backgroundColor: 'rgba(34, 197, 94, 0.5)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 1
            },
            {
                label: 'Expenses',
                data: expenseData,
                backgroundColor: 'rgba(239, 68, 68, 0.5)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1
            }
        ]);
    }
}

function openTransactionForm(type) {
    const categories = getEnabledCategories(type);
    const categoryOptions = categories.map(c =>
        `<option value="${c.name}">${c.icon} ${c.name}</option>`
    ).join('');

    const paymentOptions = PAYMENT_METHODS.map(m =>
        `<option value="${m}">${m}</option>`
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
                <input type="number" name="amount" class="form-input" placeholder="0.00" step="0.01" required>
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
                <input type="text" name="description" class="form-input" placeholder="Enter description">
            </div>
            <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" name="date" class="form-input" value="${formatDateForInput(new Date())}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Payment Method</label>
                <select name="paymentMethod" class="form-select">
                    ${paymentOptions}
                </select>
            </div>
        </form>
    `;

    openModal(`Add ${type.charAt(0).toUpperCase() + type.slice(1)}`, formHTML, async () => {
        const form = document.getElementById('transaction-form');
        const formData = new FormData(form);
        const data = {
            type: formData.get('type'),
            amount: parseFloat(formData.get('amount')),
            category: formData.get('category'),
            description: formData.get('description'),
            date: formData.get('date'),
            paymentMethod: formData.get('paymentMethod')
        };

        if (!validateAmount(data.amount)) return;
        if (!validateRequired({ category: data.category })) return;

        await api('/transactions', { method: 'POST', body: data });
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully`, 'success');
        loadDashboard(currentMonth, currentYear);
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
            const newCategories = getEnabledCategories(newType);
            categorySelect.innerHTML = '<option value="">Select category</option>' +
                newCategories.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
        });
    });
}

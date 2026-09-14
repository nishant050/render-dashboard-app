// Budget Page Logic
document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await initFinanceAuth();
    if (!isAuth) return;

    initMonthNavigator(loadBudget);
    loadBudget(currentMonth, currentYear);

    // Set Budget button
    document.getElementById('set-budget-btn').addEventListener('click', async () => {
        try {
            const existingBudget = await api(`/budgets?month=${currentMonth}&year=${currentYear}`);
            openBudgetEditor(currentMonth, currentYear, existingBudget);
        } catch (error) {
            console.error('Error fetching budget:', error);
            openBudgetEditor(currentMonth, currentYear, null);
        }
    });
});

async function loadBudget(month, year) {
    try {
        const [budget, performance] = await Promise.all([
            api(`/budgets?month=${month}&year=${year}`),
            api(`/budgets/performance?month=${month}&year=${year}`)
        ]);

        renderBudgetOverview(budget, performance);
        renderCategoryBudgets(budget, performance);
    } catch (error) {
        console.error('Error loading budget:', error);
    }
}

function renderBudgetOverview(budget, performance) {
    const container = document.getElementById('budget-overview-content');
    const btn = document.getElementById('set-budget-btn');

    if (!budget) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-title">No Budget Set</div>
                <div class="empty-state-text">Set up your monthly budget to track spending</div>
            </div>
        `;
        btn.textContent = 'Set Budget';
        return;
    }

    btn.textContent = 'Edit Budget';

    const totalSpent = performance?.totalSpent || 0;
    const totalBudget = budget.totalBudget;
    const percentage = totalBudget > 0 ? (totalSpent / totalBudget * 100) : 0;
    const remaining = totalBudget - totalSpent;
    const progressColor = getProgressColor(percentage);

    container.innerHTML = `
        <div class="budget-overview">
            <div class="budget-overview-header">
                <span>${formatCurrency(totalSpent)} spent of ${formatCurrency(totalBudget)}</span>
                <span>${percentage.toFixed(1)}%</span>
            </div>
            <div class="budget-overview-bar">
                <div class="budget-overview-fill ${progressColor}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
            <div class="budget-overview-text">
                <span>Remaining: <strong class="${remaining >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(remaining)}</strong></span>
                <span>•</span>
                <span>Categories: ${budget.categories?.length || 0}</span>
            </div>
        </div>
    `;
}

function renderCategoryBudgets(budget, performance) {
    const container = document.getElementById('category-budgets-content');

    if (!budget || !budget.categories || budget.categories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-title">No Categories</div>
                <div class="empty-state-text">Set a budget to see category breakdown</div>
            </div>
        `;
        return;
    }

    let html = '';

    budget.categories.forEach(cat => {
        const spent = performance?.categories?.find(c => c.name === cat.name)?.spent || 0;
        const percentage = cat.allocated > 0 ? (spent / cat.allocated * 100) : 0;
        const remaining = cat.allocated - spent;
        const progressColor = getProgressColor(percentage);
        const icon = getCategoryIcon(cat.name);

        html += `
            <div class="budget-category-row">
                <div class="budget-category-icon">${icon}</div>
                <div class="budget-category-info">
                    <div class="budget-category-name">${cat.name}</div>
                    <div class="budget-category-bar">
                        <div class="budget-category-fill ${progressColor}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </div>
                <div class="budget-category-numbers">
                    <div class="budget-category-spent">${formatCurrency(spent)}</div>
                    <div class="budget-category-allocated">/ ${formatCurrency(cat.allocated)}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary);">
                        ${formatCurrency(remaining)} remaining
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function openBudgetEditor(month, year, existingBudget = null) {
    const categories = getEnabledCategories('expense');
    let totalAllocated = 0;

    const categoryInputs = categories.map(cat => {
        const existing = existingBudget?.categories?.find(c => c.name === cat.name);
        const allocated = existing?.allocated || 0;
        totalAllocated += allocated;

        return `
            <div class="allocation-row">
                <label>${cat.icon} ${cat.name}</label>
                <input type="number" name="cat_${cat.name.replace(/\s+/g, '_')}" 
                    class="form-input" placeholder="0" step="100" value="${allocated}">
            </div>
        `;
    }).join('');

    const formHTML = `
        <form id="budget-form">
            <div class="form-group">
                <label class="form-label">Total Monthly Budget (₹)</label>
                <input type="number" name="totalBudget" class="form-input" placeholder="0" step="1000"
                    value="${existingBudget?.totalBudget || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Category Allocations</label>
                <div class="allocation-grid">
                    ${categoryInputs}
                </div>
            </div>
            <div class="form-group">
                <div style="display: flex; justify-content: space-between; padding: var(--space-md); background: var(--bg-primary); border-radius: var(--radius-md);">
                    <span>Total Allocated:</span>
                    <strong id="total-allocated">${formatCurrency(totalAllocated)}</strong>
                </div>
            </div>
            <div class="form-group">
                <button type="button" class="btn btn-ghost" id="copy-last-month-btn">Copy from Last Month</button>
            </div>
        </form>
    `;

    openModal(existingBudget ? 'Edit Budget' : 'Set Budget', formHTML, async () => {
        const form = document.getElementById('budget-form');
        const formData = new FormData(form);

        const totalBudget = parseFloat(formData.get('totalBudget'));
        if (!validateAmount(totalBudget)) return;

        const categoryAllocations = [];
        let totalAllocated = 0;

        categories.forEach(cat => {
            const inputName = `cat_${cat.name.replace(/\s+/g, '_')}`;
            const allocated = parseFloat(formData.get(inputName)) || 0;
            if (allocated > 0) {
                categoryAllocations.push({
                    name: cat.name,
                    allocated
                });
                totalAllocated += allocated;
            }
        });

        const data = {
            month,
            year,
            totalBudget,
            categories: categoryAllocations
        };

        await api('/budgets', { method: 'POST', body: data });
        showToast('Budget saved successfully', 'success');
        loadBudget(month, year);
    });

    // Update total allocated on input change
    const inputs = document.querySelectorAll('#budget-form input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            let total = 0;
            inputs.forEach(inp => {
                if (inp.name !== 'totalBudget') {
                    total += parseFloat(inp.value) || 0;
                }
            });
            document.getElementById('total-allocated').textContent = formatCurrency(total);
        });
    });

    // Copy from last month
    document.getElementById('copy-last-month-btn').addEventListener('click', async () => {
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
        }

        try {
            const prevBudget = await api(`/budgets?month=${prevMonth}&year=${prevYear}`);
            if (prevBudget) {
                // Fill form with previous budget values
                document.querySelector('input[name="totalBudget"]').value = prevBudget.totalBudget;

                prevBudget.categories.forEach(cat => {
                    const inputName = `cat_${cat.name.replace(/\s+/g, '_')}`;
                    const input = document.querySelector(`input[name="${inputName}"]`);
                    if (input) {
                        input.value = cat.allocated;
                    }
                });

                // Trigger update of total
                inputs.forEach(input => input.dispatchEvent(new Event('input')));
                showToast('Copied from last month', 'success');
            } else {
                showToast('No budget found for last month', 'info');
            }
        } catch (error) {
            showToast('Error copying budget', 'error');
        }
    });
}

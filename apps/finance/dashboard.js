let plan = null;
let saveTimer = null;

const columns = {
    incomes: [
        { key: 'name', label: 'Income' },
        { key: 'amount', label: 'Amount', type: 'number' }
    ],
    expenses: [
        { key: 'name', label: 'Expense' },
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'store', label: 'Stored In' }
    ],
    stores: [
        { key: 'name', label: 'Store' },
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'purpose', label: 'Purpose' }
    ],
    investments: [
        { key: 'fund', label: 'Mutual Fund' },
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'purpose', label: 'Purpose' }
    ],
    goals: [
        { key: 'important', label: 'Start', type: 'checkbox' },
        { key: 'name', label: 'Goal' },
        { key: 'expectedAmount', label: 'Target', type: 'number' },
        { key: 'years', label: 'Years', type: 'number' },
        { key: 'interestRate', label: 'Return %', type: 'number' },
        { key: 'monthlyEmi', label: 'Monthly SIP', type: 'number' },
        { key: 'fund', label: 'Fund' }
    ]
};

const blankRows = {
    incomes: { name: '', amount: 0 },
    expenses: { name: '', amount: 0, store: '' },
    stores: { name: '', amount: 0, purpose: '' },
    investments: { fund: '', amount: 0, purpose: '' },
    goals: { important: false, name: '', expectedAmount: 0, years: 1, interestRate: 10, monthlyEmi: 0, fund: '' }
};

document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await initFinanceAuth();
    if (!isAuth) return;

    await loadPlan();
    bindActions();
});

async function loadPlan() {
    plan = await api('/plan');
    normalizePlan();
    renderPlan();
}

function normalizePlan() {
    for (const key of Object.keys(blankRows)) {
        if (!Array.isArray(plan[key])) plan[key] = [];
    }
}

function bindActions() {
    document.getElementById('save-plan-btn').addEventListener('click', savePlan);
    document.getElementById('reset-plan-btn').addEventListener('click', resetPlan);
    document.getElementById('change-password-btn').addEventListener('click', openPasswordModal);

    document.querySelectorAll('[data-add-row]').forEach((button) => {
        button.addEventListener('click', () => {
            const section = button.dataset.addRow;
            plan[section].push({ ...blankRows[section] });
            renderPlan();
            queueSave();
        });
    });
}

function renderPlan() {
    renderSummary();
    renderEditableTable('incomes', 'income-table');
    renderEditableTable('expenses', 'expense-table');
    renderEditableTable('stores', 'stores-table');
    renderEditableTable('investments', 'investments-table');
    renderEditableTable('goals', 'goals-table');
    renderOneYearGoals();
    renderChecks();
}

function renderSummary() {
    const income = sum(plan.incomes, 'amount');
    const expenses = sum(plan.expenses, 'amount');
    const stores = sum(plan.stores, 'amount');
    const sip = sum(plan.investments, 'amount');
    const importantSip = plan.goals.filter((goal) => goal.important).reduce((total, goal) => total + toNumber(goal.monthlyEmi), 0);
    const freeCash = income - expenses;
    const savingsRate = income > 0 ? (freeCash / income) * 100 : 0;

    const cards = [
        { label: 'Monthly Income', value: money(income), detail: `${plan.incomes.length} income lines`, tone: 'good' },
        { label: 'Monthly Expenses', value: money(expenses), detail: `${money(freeCash)} left`, tone: freeCash >= 0 ? 'good' : 'bad' },
        { label: 'Money Stored', value: money(stores), detail: `${money(stores - expenses)} vs expenses`, tone: Math.abs(stores - expenses) < 5 ? 'good' : 'warn' },
        { label: 'Monthly SIPs', value: money(sip), detail: `${money(importantSip)} important goals`, tone: sip <= freeCash ? 'good' : 'warn' },
        { label: 'Savings Rate', value: `${savingsRate.toFixed(1)}%`, detail: 'Income after expenses', tone: savingsRate >= 20 ? 'good' : 'warn' }
    ];

    document.getElementById('summary-grid').innerHTML = cards.map((card) => `
        <article class="summary-card ${card.tone}">
            <span>${card.label}</span>
            <strong>${card.value}</strong>
            <small>${card.detail}</small>
        </article>
    `).join('');
}

function renderEditableTable(section, elementId) {
    const config = columns[section];
    const rows = plan[section];
    const table = document.getElementById(elementId);

    table.innerHTML = `
        <div class="table-grid ${section}" style="--cols: ${config.length + 1}">
            ${config.map((column) => `<div class="th">${column.label}</div>`).join('')}
            <div class="th"></div>
            ${rows.map((row, index) => renderRow(section, row, index, config)).join('')}
            ${renderTotalRow(section, config)}
        </div>
    `;

    table.querySelectorAll('input, textarea').forEach((input) => {
        input.addEventListener('input', handleCellInput);
        input.addEventListener('change', handleCellInput);
    });

    table.querySelectorAll('[data-delete-row]').forEach((button) => {
        button.addEventListener('click', () => {
            plan[button.dataset.section].splice(Number(button.dataset.index), 1);
            renderPlan();
            queueSave();
        });
    });
}

function renderRow(section, row, index, config) {
    const cells = config.map((column) => {
        const value = row[column.key] ?? '';
        if (column.type === 'checkbox') {
            return `
                <label class="check-cell">
                    <input type="checkbox" data-section="${section}" data-index="${index}" data-key="${column.key}" ${value ? 'checked' : ''}>
                </label>
            `;
        }

        const inputType = column.type === 'number' ? 'number' : 'text';
        const step = column.type === 'number' ? ' step="0.01"' : '';
        return `
            <input type="${inputType}"${step} value="${escapeAttr(value)}"
                data-section="${section}" data-index="${index}" data-key="${column.key}">
        `;
    }).join('');

    return `
        ${cells}
        <button class="row-delete" data-delete-row data-section="${section}" data-index="${index}" type="button" title="Delete row">x</button>
    `;
}

function renderTotalRow(section, config) {
    const amountKey = section === 'goals' ? 'monthlyEmi' : 'amount';
    if (!config.some((column) => column.key === amountKey)) return '';
    const total = sum(plan[section], amountKey);
    const fillerCount = config.length - 1;
    return `
        <div class="total-label">Total</div>
        <div class="total-value">${money(total)}</div>
        ${Array.from({ length: Math.max(0, fillerCount - 1) }, () => '<div class="total-empty"></div>').join('')}
        <div class="total-empty"></div>
    `;
}

function handleCellInput(event) {
    const input = event.target;
    const section = input.dataset.section;
    const index = Number(input.dataset.index);
    const key = input.dataset.key;
    const type = columns[section].find((column) => column.key === key)?.type;

    plan[section][index][key] = type === 'checkbox' ? input.checked : type === 'number' ? toNumber(input.value) : input.value;
    renderSummary();
    renderOneYearGoals();
    renderChecks();
    queueSave();
}

function renderOneYearGoals() {
    const list = document.getElementById('one-year-list');
    const shortTerm = plan.investments
        .filter((item) => ['trip', 'gift', 'gold', 'honey', 'car'].some((word) => String(item.purpose).toLowerCase().includes(word)))
        .sort((a, b) => toNumber(b.amount) - toNumber(a.amount));

    if (!shortTerm.length) {
        list.innerHTML = '<p class="muted">No short-term investment purposes found.</p>';
        return;
    }

    list.innerHTML = shortTerm.map((item) => `
        <div class="compact-row">
            <span>${escapeHtml(item.fund)}</span>
            <strong>${money(item.amount)}</strong>
        </div>
    `).join('');
}

function renderChecks() {
    const income = sum(plan.incomes, 'amount');
    const expenses = sum(plan.expenses, 'amount');
    const stores = sum(plan.stores, 'amount');
    const sip = sum(plan.investments, 'amount');
    const checks = [];

    checks.push(buildCheck('Income covers expenses', income >= expenses, `${money(income - expenses)} monthly buffer`));
    checks.push(buildCheck('Stores match expense plan', Math.abs(stores - expenses) < 5, `${money(stores - expenses)} difference`));
    checks.push(buildCheck('Investments fit inside savings', sip <= Math.max(0, income - expenses), `${money(Math.max(0, income - expenses) - sip)} remaining after SIPs`));

    const storeNames = new Set(plan.stores.map((store) => String(store.name).trim()).filter(Boolean));
    const missingStores = plan.expenses
        .map((expense) => expense.store)
        .filter((store) => store && !storeNames.has(store));
    checks.push(buildCheck('Expense stores exist', missingStores.length === 0, missingStores.length ? `Missing: ${[...new Set(missingStores)].join(', ')}` : 'All expense stores mapped'));

    document.getElementById('check-list').innerHTML = checks.join('');
}

function buildCheck(title, passed, detail) {
    return `
        <div class="check-row ${passed ? 'passed' : 'attention'}">
            <div>
                <strong>${title}</strong>
                <span>${escapeHtml(detail)}</span>
            </div>
            <b>${passed ? 'OK' : 'Fix'}</b>
        </div>
    `;
}

function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePlan, 900);
}

async function savePlan() {
    clearTimeout(saveTimer);
    await api('/plan', { method: 'PUT', body: plan });
    showToast('Plan saved', 'success');
}

async function resetPlan() {
    showConfirm('Reset this page to the original sample values from your spreadsheet?', async () => {
        await api('/settings', { method: 'PUT', body: { monthlyPlan: null } });
        await loadPlan();
        showToast('Sample plan restored', 'success');
    });
}

function openPasswordModal() {
    openModal('Change Password', `
        <form id="password-form">
            <div class="form-group">
                <label class="form-label">Current password</label>
                <input class="form-input" type="password" name="currentPassword" autocomplete="current-password" required>
            </div>
            <div class="form-group">
                <label class="form-label">New password</label>
                <input class="form-input" type="password" name="newPassword" autocomplete="new-password" minlength="6" required>
            </div>
            <div class="form-group">
                <label class="form-label">Confirm new password</label>
                <input class="form-input" type="password" name="confirmPassword" autocomplete="new-password" minlength="6" required>
            </div>
        </form>
    `, async () => {
        const form = document.getElementById('password-form');
        const data = Object.fromEntries(new FormData(form).entries());
        if (data.newPassword !== data.confirmPassword) {
            showToast('New passwords do not match', 'error');
            throw new Error('Password mismatch');
        }

        const response = await fetch('/api/finance-change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Finance-Session': getFinanceSession() || ''
            },
            body: JSON.stringify({
                currentPassword: data.currentPassword,
                newPassword: data.newPassword
            })
        });
        const result = await response.json();
        if (!response.ok) {
            showToast(result.error || 'Password change failed', 'error');
            throw new Error(result.error || 'Password change failed');
        }
        showToast('Password changed', 'success');
    });
}

function sum(items, key) {
    return items.reduce((total, item) => total + toNumber(item[key]), 0);
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function money(value) {
    return `Rs. ${toNumber(value).toLocaleString('en-IN', {
        minimumFractionDigits: Number.isInteger(toNumber(value)) ? 0 : 2,
        maximumFractionDigits: 2
    })}`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
}

// ===== ACCOUNTS PAGE LOGIC =====

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await initFinanceAuth();
    if (!isAuth) return;

    loadAccounts();
    document.getElementById('add-account-btn').addEventListener('click', () => openAccountForm());
    document.getElementById('transfer-btn').addEventListener('click', () => openTransferForm());
});

// Load accounts
async function loadAccounts() {
    try {
        const accounts = await api(`/accounts?month=${currentMonth}&year=${currentYear}`);
        renderNetWorth(accounts);
        renderAccountCards(accounts);
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

// Render net worth
function renderNetWorth(accounts) {
    const netWorth = accounts.reduce((sum, acc) => {
        return sum + (acc.type === 'credit_card' ? -acc.balance : acc.balance);
    }, 0);

    document.getElementById('net-worth-value').textContent = formatCurrency(netWorth);
}

// Render account cards
function renderAccountCards(accounts) {
    const container = document.getElementById('accounts-grid');

    if (!accounts || accounts.length === 0) {
        showEmptyState(
            container,
            '🏦',
            'No Accounts',
            'Add your bank accounts, wallets, and credit cards',
            'Add Your First Account',
            () => openAccountForm()
        );
        return;
    }

    let html = '<div class="grid grid-2 gap-lg">';
    accounts.forEach(account => {
        const isCreditCard = account.type === 'credit_card';
        const pendingAmount = account.pendingAmount || 0;
        const balanceClass = isCreditCard ? (account.balance > 0 ? 'amount-negative' : 'amount-positive') : 'amount-positive';
        const typeLabel = account.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

        const pendingBillInfo = isCreditCard && pendingAmount > 0
            ? `<div class="account-pending">Pending: ${formatCurrency(pendingAmount)}</div>`
            : '';

        html += `
            <div class="account-card">
                <div class="account-info">
                    <div class="account-icon">${account.icon || getAccountIcon(account.type)}</div>
                    <div>
                        <div class="account-name">${account.name}</div>
                        <div class="account-type">${typeLabel}</div>
                        ${pendingBillInfo}
                    </div>
                </div>
                <div class="account-balance ${balanceClass}">${formatCurrency(account.balance)}</div>
                <div class="account-actions">
                    ${isCreditCard ? `<button class="btn btn-primary btn-sm" onclick="createCreditCardBill('${account._id}', '${account.name}')">Create Bill</button>` : ''}
                    <button class="btn btn-ghost btn-sm" onclick="editAccount('${account._id}')">Edit</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteAccount('${account._id}')">Delete</button>
                </div>
            </div>
        `;
    });

    // Add account card
    html += `
        <div class="account-card" style="cursor: pointer; border-style: dashed;" onclick="openAccountForm()">
            <div class="account-info">
                <div class="account-icon">➕</div>
                <div>
                    <div class="account-name">Add Account</div>
                    <div class="account-type">Click to add new</div>
                </div>
            </div>
        </div>
    `;

    html += '</div>';
    container.innerHTML = html;
}

// Get account icon
function getAccountIcon(type) {
    const icons = {
        bank: '🏦',
        cash: '💵',
        credit_card: '💳',
        wallet: '👛',
        investment: '📈'
    };
    return icons[type] || '🏦';
}

// Open account form
async function openAccountForm(existingAccount = null) {
    const isEdit = !!existingAccount;
    const title = isEdit ? 'Edit Account' : 'Add Account';

    const formHTML = `
        <form id="account-form">
            <div class="form-group">
                <label class="form-label">Account Name</label>
                <input type="text" class="form-input" id="account-name" placeholder="e.g., HDFC Savings, Cash Wallet"
                    value="${existingAccount?.name || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Account Type</label>
                <select class="form-select" id="account-type" required>
                    <option value="bank" ${existingAccount?.type === 'bank' ? 'selected' : ''}>Bank Account</option>
                    <option value="cash" ${existingAccount?.type === 'cash' ? 'selected' : ''}>Cash</option>
                    <option value="credit_card" ${existingAccount?.type === 'credit_card' ? 'selected' : ''}>Credit Card</option>
                    <option value="wallet" ${existingAccount?.type === 'wallet' ? 'selected' : ''}>Digital Wallet</option>
                    <option value="investment" ${existingAccount?.type === 'investment' ? 'selected' : ''}>Investment</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Opening Balance (₹)</label>
                <input type="number" class="form-input" id="account-balance" placeholder="0.00" step="0.01"
                    value="${existingAccount?.balance || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Icon</label>
                <div class="flex gap-sm" id="icon-picker">
                    <button type="button" class="btn btn-ghost icon-btn ${existingAccount?.icon === '🏦' || !existingAccount ? 'active' : ''}" data-icon="🏦">🏦</button>
                    <button type="button" class="btn btn-ghost icon-btn ${existingAccount?.icon === '💵' ? 'active' : ''}" data-icon="💵">💵</button>
                    <button type="button" class="btn btn-ghost icon-btn ${existingAccount?.icon === '💳' ? 'active' : ''}" data-icon="💳">💳</button>
                    <button type="button" class="btn btn-ghost icon-btn ${existingAccount?.icon === '👛' ? 'active' : ''}" data-icon="👛">👛</button>
                    <button type="button" class="btn btn-ghost icon-btn ${existingAccount?.icon === '📈' ? 'active' : ''}" data-icon="📈">📈</button>
                    <button type="button" class="btn btn-ghost icon-btn ${existingAccount?.icon === '💰' ? 'active' : ''}" data-icon="💰">💰</button>
                </div>
                <input type="hidden" id="account-icon" value="${existingAccount?.icon || '🏦'}">
            </div>
        </form>
    `;

    openModal(title, formHTML, async () => {
        const name = document.getElementById('account-name').value;
        const type = document.getElementById('account-type').value;
        const balance = parseFloat(document.getElementById('account-balance').value) || 0;
        const icon = document.getElementById('account-icon').value;

        if (!name) {
            showToast('Please enter an account name', 'error');
            return;
        }

        const data = { name, type, balance, icon };

        if (isEdit) {
            await api(`/accounts/${existingAccount._id}`, {
                method: 'PUT',
                body: data
            });
            showToast('Account updated successfully', 'success');
        } else {
            await api('/accounts', {
                method: 'POST',
                body: data
            });
            showToast('Account added successfully', 'success');
        }

        loadAccounts();
    });

    // Icon picker functionality
    const iconButtons = document.querySelectorAll('.icon-btn');
    iconButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            iconButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('account-icon').value = btn.dataset.icon;
        });
    });
}

// Edit account
async function editAccount(id) {
    try {
        const accounts = await api('/accounts');
        const account = accounts.find(a => a._id === id);
        if (account) {
            openAccountForm(account);
        }
    } catch (error) {
        showToast('Error loading account', 'error');
    }
}

// Delete account
async function deleteAccount(id) {
    showConfirm('Are you sure you want to delete this account?', async () => {
        try {
            await api(`/accounts/${id}`, { method: 'DELETE' });
            showToast('Account deleted', 'success');
            loadAccounts();
        } catch (error) {
            showToast('Error deleting account', 'error');
        }
    });
}

// Open transfer form
async function openTransferForm() {
    try {
        const accounts = await api('/accounts');

        if (accounts.length < 2) {
            showToast('You need at least 2 accounts to make a transfer', 'error');
            return;
        }

        const accountOptions = accounts.map(acc =>
            `<option value="${acc._id}">${acc.icon} ${acc.name} (${formatCurrency(acc.balance)})</option>`
        ).join('');

        openModal('Transfer Between Accounts', `
            <form id="transfer-form">
                <div class="form-group">
                    <label class="form-label">From Account</label>
                    <select class="form-select" id="transfer-from" required>
                        ${accountOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">To Account</label>
                    <select class="form-select" id="transfer-to" required>
                        ${accountOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Amount (₹)</label>
                    <input type="number" class="form-input" id="transfer-amount" placeholder="0.00" min="0" step="0.01" required>
                </div>
            </form>
        `, async () => {
            const fromId = document.getElementById('transfer-from').value;
            const toId = document.getElementById('transfer-to').value;
            const amount = parseFloat(document.getElementById('transfer-amount').value);

            if (!amount || amount <= 0) {
                showToast('Please enter a valid amount', 'error');
                return;
            }

            if (fromId === toId) {
                showToast('Please select different accounts', 'error');
                return;
            }

            await api('/accounts/transfer', {
                method: 'POST',
                body: { fromId, toId, amount }
            });

            showToast('Transfer completed successfully', 'success');
            loadAccounts();
        });
    } catch (error) {
        showToast('Error loading accounts', 'error');
    }
}

// Create credit card bill
async function createCreditCardBill(accountId, accountName) {
    try {
        const accounts = await api('/accounts');
        const account = accounts.find(a => a._id === accountId);

        if (!account) {
            showToast('Account not found', 'error');
            return;
        }

        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const formHTML = `
            <form id="credit-card-bill-form">
                <div class="form-group">
                    <label class="form-label">Bill Name</label>
                    <input type="text" name="name" class="form-input" placeholder="e.g., HDFC Credit Card Bill"
                        value="${accountName} Bill" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Amount (₹)</label>
                    <input type="number" name="amount" class="form-input" placeholder="0.00" step="0.01"
                        value="${Math.abs(account.balance)}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Bill Month</label>
                    <div class="flex gap-sm">
                        <select name="month" class="form-select" required>
                            ${Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
            `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${getMonthName(m)}</option>`
        ).join('')}
                        </select>
                        <select name="year" class="form-select" required>
                            ${Array.from({ length: 3 }, (_, i) => currentYear - 1 + i).map(y =>
            `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
        ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Due Day (1-31)</label>
                    <input type="number" name="dueDay" class="form-input" min="1" max="31"
                        value="15" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select name="category" class="form-select" required>
                        <option value="">Select category</option>
                        ${getEnabledCategories('expense').map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea name="notes" class="form-textarea" placeholder="Additional notes..."></textarea>
                </div>
            </form>
        `;

        openModal('Create Credit Card Bill', formHTML, async () => {
            const form = document.getElementById('credit-card-bill-form');
            const formData = new FormData(form);

            const data = {
                name: formData.get('name'),
                amount: parseFloat(formData.get('amount')),
                month: parseInt(formData.get('month')),
                year: parseInt(formData.get('year')),
                dueDay: parseInt(formData.get('dueDay')),
                category: formData.get('category'),
                notes: formData.get('notes'),
                type: 'one-time',
                isRecurring: false,
                accountId: accountId
            };

            if (!validateAmount(data.amount)) return;
            if (!validateRequired({ name: data.name, category: data.category, dueDay: data.dueDay })) return;

            await api('/bills', { method: 'POST', body: data });
            showToast('Credit card bill created successfully', 'success');
            loadAccounts();
        });
    } catch (error) {
        showToast('Error creating credit card bill', 'error');
    }
}

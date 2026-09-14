// Bills Page Logic
let currentStatus = 'all';
let isCalendarView = false;

document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await initFinanceAuth();
    if (!isAuth) return;

    initMonthNavigator(loadBills);
    loadBills(currentMonth, currentYear);
    setupFilters();

    // Add Bill button
    document.getElementById('add-bill-btn').addEventListener('click', () => {
        openBillForm();
    });

    // Toggle view button
    document.getElementById('toggle-view-btn').addEventListener('click', () => {
        isCalendarView = !isCalendarView;
        const btn = document.getElementById('toggle-view-btn');
        btn.textContent = isCalendarView ? '📋 List View' : '📅 Calendar View';

        document.getElementById('bill-list').classList.toggle('hidden', isCalendarView);
        document.getElementById('calendar-view').classList.toggle('hidden', !isCalendarView);

        if (isCalendarView) {
            renderBillCalendar(currentMonth, currentYear);
        }
    });
});

function setupFilters() {
    const tabs = document.querySelectorAll('#bill-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentStatus = tab.dataset.status;
            loadBills(currentMonth, currentYear);
        });
    });
}

async function loadBills(month, year) {
    try {
        const bills = await api(`/bills/status?month=${month}&year=${year}`);
        renderBillsSummary(bills);
        renderBillList(bills);

        if (isCalendarView) {
            renderBillCalendar(month, year);
        }
    } catch (error) {
        console.error('Error loading bills:', error);
    }
}

function renderBillsSummary(bills) {
    const pending = bills.filter(b => b.status === 'pending');
    const paid = bills.filter(b => b.status === 'paid');
    const overdue = bills.filter(b => b.status === 'overdue');

    const totalPending = pending.reduce((sum, b) => sum + b.amount, 0);
    const totalPaid = paid.reduce((sum, b) => sum + b.amount, 0);
    const totalOverdue = overdue.reduce((sum, b) => sum + b.amount, 0);

    document.getElementById('total-pending').textContent = formatCurrency(totalPending);
    document.getElementById('total-paid').textContent = formatCurrency(totalPaid);
    document.getElementById('total-overdue').textContent = formatCurrency(totalOverdue);
}

function renderBillList(bills) {
    const container = document.getElementById('bill-list');

    let filteredBills = bills;
    if (currentStatus !== 'all') {
        filteredBills = bills.filter(b => b.status === currentStatus);
    }

    if (!filteredBills || filteredBills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-title">No Bills Found</div>
                <div class="empty-state-text">${currentStatus === 'all' ? 'Add recurring bills to track them' : `No ${currentStatus} bills`}</div>
            </div>
        `;
        return;
    }

    let html = '';

    filteredBills.forEach(bill => {
        const icon = getCategoryIcon(bill.category);
        const statusClass = `status-${bill.status}`;
        const statusText = bill.status.charAt(0).toUpperCase() + bill.status.slice(1);

        html += `
            <div class="bill-card">
                <div class="bill-header">
                    <div>
                        <div class="bill-name">${icon} ${bill.name}</div>
                        <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">${bill.category} • ${bill.type === 'one-time' ? 'One-time' : bill.frequency}</div>
                    </div>
                    <span class="badge ${statusClass}">${statusText}</span>
                </div>
                <div class="bill-amount">${formatCurrency(bill.amount)}</div>
                <div class="bill-details">
                    <span>📅 Due: ${bill.dueDay}${getDaySuffix(bill.dueDay)} of every month</span>
                    ${bill.autoPay ? '<span>🔄 Auto-pay enabled</span>' : ''}
                </div>
                <div class="bill-actions">
                    ${bill.status !== 'paid' ? `<button class="btn btn-primary btn-sm" onclick="payBill('${bill._id}')">Mark Paid</button>` : ''}
                    <button class="btn btn-ghost btn-sm" onclick="editBill('${bill._id}')">✏️ Edit</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteBill('${bill._id}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderBillCalendar(month, year) {
    const container = document.getElementById('calendar-grid');
    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = new Date(year, month - 1, 1).getDay();

    let html = '';

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day"></div>';
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === new Date().getDate() &&
            month === new Date().getMonth() + 1 &&
            year === new Date().getFullYear();

        html += `
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-number">${day}</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

function openBillForm(existingBill = null) {
    const categoryOptions = getEnabledCategories('expense').map(c =>
        `<option value="${c.name}" ${existingBill?.category === c.name ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');

    const formHTML = `
        <form id="bill-form">
            <div class="form-group">
                <label class="form-label">Bill Name</label>
                <input type="text" name="name" class="form-input" placeholder="e.g., Netflix, Electricity"
                    value="${existingBill?.name || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Amount (₹)</label>
                <input type="number" name="amount" class="form-input" placeholder="0.00" step="0.01"
                    value="${existingBill?.amount || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Category</label>
                <select name="category" class="form-select" required>
                    <option value="">Select category</option>
                    ${categoryOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Type</label>
                <select name="type" class="form-select" id="bill-type-select">
                    <option value="recurring" ${existingBill?.type === 'recurring' || !existingBill ? 'selected' : ''}>Recurring Bill</option>
                    <option value="one-time" ${existingBill?.type === 'one-time' ? 'selected' : ''}>One-time Payment</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Due Day (1-31)</label>
                <input type="number" name="dueDay" class="form-input" min="1" max="31"
                    value="${existingBill?.dueDay || ''}" required>
            </div>
            <div class="form-group" id="frequency-group">
                <label class="form-label">Frequency</label>
                <select name="frequency" class="form-select">
                    <option value="monthly" ${existingBill?.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                    <option value="quarterly" ${existingBill?.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                    <option value="yearly" ${existingBill?.frequency === 'yearly' ? 'selected' : ''}>Yearly</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">
                    <input type="checkbox" name="autoPay" ${existingBill?.autoPay ? 'checked' : ''}>
                    Enable Auto-pay
                </label>
            </div>
            <div class="form-group">
                <label class="form-label">Remind Days Before Due</label>
                <input type="number" name="remindDaysBefore" class="form-input" min="0" max="30"
                    value="${existingBill?.remindDaysBefore || 3}">
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea name="notes" class="form-textarea" placeholder="Additional notes...">${existingBill?.notes || ''}</textarea>
            </div>
        </form>
    `;

    openModal(existingBill ? 'Edit Bill' : 'Add Bill', formHTML, async () => {
        const form = document.getElementById('bill-form');
        const formData = new FormData(form);

        const data = {
            name: formData.get('name'),
            amount: parseFloat(formData.get('amount')),
            category: formData.get('category'),
            type: formData.get('type'),
            dueDay: parseInt(formData.get('dueDay')),
            frequency: formData.get('frequency'),
            autoPay: formData.get('autoPay') === 'on',
            remindDaysBefore: parseInt(formData.get('remindDaysBefore')) || 3,
            notes: formData.get('notes')
        };

        if (!validateAmount(data.amount)) return;
        if (!validateRequired({ name: data.name, category: data.category, dueDay: data.dueDay })) return;

        if (existingBill) {
            await api(`/bills/${existingBill._id}`, { method: 'PUT', body: data });
            showToast('Bill updated successfully', 'success');
        } else {
            await api('/bills', { method: 'POST', body: data });
            showToast('Bill added successfully', 'success');
        }

        loadBills(currentMonth, currentYear);
    });

    // Handle type selector visibility
    const typeSelect = document.getElementById('bill-type-select');
    const frequencyGroup = document.getElementById('frequency-group');

    if (typeSelect && frequencyGroup) {
        typeSelect.addEventListener('change', () => {
            frequencyGroup.style.display = typeSelect.value === 'recurring' ? 'block' : 'none';
        });

        // Initial visibility
        frequencyGroup.style.display = typeSelect.value === 'recurring' ? 'block' : 'none';
    }
}

async function editBill(id) {
    try {
        const bills = await api(`/bills?month=${currentMonth}&year=${currentYear}`);
        const bill = bills.find(b => b._id === id);
        if (bill) {
            openBillForm(bill);
        }
    } catch (error) {
        console.error('Error fetching bill:', error);
    }
}

async function deleteBill(id) {
    showConfirm('Are you sure you want to delete this bill?', async () => {
        try {
            await api(`/bills/${id}`, { method: 'DELETE' });
            showToast('Bill deleted successfully', 'success');
            loadBills(currentMonth, currentYear);
        } catch (error) {
            console.error('Error deleting bill:', error);
        }
    });
}

async function payBill(id) {
    try {
        const bills = await api(`/bills?month=${currentMonth}&year=${currentYear}`);
        const bill = bills.find(b => b._id === id);
        if (!bill) return;

        const formHTML = `
            <form id="pay-bill-form">
                <div class="form-group">
                    <label class="form-label">Amount (₹)</label>
                    <input type="number" name="amount" class="form-input" value="${bill.amount}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Payment Method</label>
                    <select name="paymentMethod" class="form-select">
                        ${PAYMENT_METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" name="date" class="form-input" value="${formatDateForInput(new Date())}" required>
                </div>
            </form>
        `;

        openModal(`Pay Bill: ${bill.name}`, formHTML, async () => {
            const form = document.getElementById('pay-bill-form');
            const formData = new FormData(form);

            const data = {
                amount: parseFloat(formData.get('amount')),
                paymentMethod: formData.get('paymentMethod'),
                date: formData.get('date')
            };

            await api(`/bills/${id}/pay`, { method: 'POST', body: data });
            showToast('Bill marked as paid', 'success');
            loadBills(currentMonth, currentYear);
        });
    } catch (error) {
        console.error('Error paying bill:', error);
    }
}

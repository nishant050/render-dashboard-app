// ===== REPORTS PAGE LOGIC =====

let currentReport = 'monthly';
let charts = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initMonthNavigator(() => loadReports(currentMonth, currentYear));
    setupReportTabs();
    loadReports(currentMonth, currentYear);
});

// Setup report tabs
function setupReportTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentReport = tab.dataset.report;
            loadReports(currentMonth, currentYear);
        });
    });
}

// Load reports
async function loadReports(month, year) {
    const container = document.getElementById('report-content');
    container.innerHTML = '<div class="skeleton" style="height: 400px;"></div>';

    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    charts = {};

    switch (currentReport) {
        case 'monthly':
            await loadMonthlyReport(month, year);
            break;
        case 'trends':
            await loadTrendsReport();
            break;
        case 'category':
            await loadCategoryReport();
            break;
        case 'yearly':
            await loadYearlyReport(year);
            break;
    }
}

// ===== MONTHLY REPORT =====
async function loadMonthlyReport(month, year) {
    try {
        const data = await api(`/reports/monthly?month=${month}&year=${year}`);
        const container = document.getElementById('report-content');

        let html = `
            <!-- Summary Row -->
            <div class="summary-cards mb-xl">
                <div class="summary-card">
                    <div class="summary-card-icon">💰</div>
                    <div class="summary-card-label">Total Income</div>
                    <div class="summary-card-value amount-positive">${formatCurrency(data.totalIncome)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-icon">💸</div>
                    <div class="summary-card-label">Total Expenses</div>
                    <div class="summary-card-value amount-negative">${formatCurrency(data.totalExpenses)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-icon">🏦</div>
                    <div class="summary-card-label">Savings</div>
                    <div class="summary-card-value ${data.savings >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(data.savings)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-icon">📈</div>
                    <div class="summary-card-label">Savings Rate</div>
                    <div class="summary-card-value">${data.savingsRate}%</div>
                </div>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-2 gap-lg mb-xl">
                <div class="widget">
                    <h3 class="widget-title mb-md">Income by Source</h3>
                    <div class="chart-container">
                        <canvas id="income-chart"></canvas>
                    </div>
                </div>
                <div class="widget">
                    <h3 class="widget-title mb-md">Expenses by Category</h3>
                    <div class="chart-container">
                        <canvas id="expense-chart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Daily Spending -->
            <div class="widget mb-xl">
                <h3 class="widget-title mb-md">Daily Spending</h3>
                <div class="chart-container">
                    <canvas id="daily-chart"></canvas>
                </div>
            </div>

            <!-- Payment Methods -->
            <div class="grid grid-2 gap-lg mb-xl">
                <div class="widget">
                    <h3 class="widget-title mb-md">Payment Methods</h3>
                    <div class="chart-container">
                        <canvas id="payment-chart"></canvas>
                    </div>
                </div>
                <div class="widget">
                    <h3 class="widget-title mb-md">Top Transactions</h3>
                    <div id="top-transactions"></div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Render charts
        renderIncomeChart(data);
        renderExpenseChart(data);
        renderDailyChart(data);
        renderPaymentChart(data);
        renderTopTransactions(data);

    } catch (error) {
        document.getElementById('report-content').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-title">Error Loading Report</div>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function renderIncomeChart(data) {
    const ctx = document.getElementById('income-chart');
    if (!ctx) return;

    const incomeCategories = data.byCategory?.filter(c => c.type === 'income') || [];
    if (incomeCategories.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><p>No income data</p></div>';
        return;
    }

    charts.income = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: incomeCategories.map(c => c._id),
            datasets: [{
                data: incomeCategories.map(c => c.total),
                backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
                    }
                }
            }
        }
    });
}

function renderExpenseChart(data) {
    const ctx = document.getElementById('expense-chart');
    if (!ctx) return;

    const expenseCategories = data.byCategory?.filter(c => c.type === 'expense') || [];
    if (expenseCategories.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><p>No expense data</p></div>';
        return;
    }

    charts.expense = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: expenseCategories.map(c => c._id),
            datasets: [{
                data: expenseCategories.map(c => c.total),
                backgroundColor: expenseCategories.map(c => getCategoryColor(c._id)),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
                    }
                }
            }
        }
    });
}

function renderDailyChart(data) {
    const ctx = document.getElementById('daily-chart');
    if (!ctx || !data.byDate) return;

    charts.daily = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.byDate.map(d => d._id),
            datasets: [
                {
                    label: 'Income',
                    data: data.byDate.map(d => d.income),
                    backgroundColor: '#22c55e',
                    borderRadius: 4
                },
                {
                    label: 'Expenses',
                    data: data.byDate.map(d => d.expense),
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (value) => formatCurrency(value) }
                }
            }
        }
    });
}

function renderPaymentChart(data) {
    const ctx = document.getElementById('payment-chart');
    if (!ctx || !data.byPaymentMethod) return;

    const methods = data.byPaymentMethod.filter(m => m._id);
    if (methods.length === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><p>No payment data</p></div>';
        return;
    }

    charts.payment = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: methods.map(m => m._id),
            datasets: [{
                data: methods.map(m => m.total),
                backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
                    }
                }
            }
        }
    });
}

function renderTopTransactions(data) {
    const container = document.getElementById('top-transactions');
    if (!container || !data.topTransactions || data.topTransactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No transactions</p></div>';
        return;
    }

    let html = '<ul class="widget-list">';
    data.topTransactions.forEach(tx => {
        const amountClass = tx.type === 'income' ? 'amount-positive' : 'amount-negative';
        html += `
            <li>
                <div class="flex items-center gap-sm">
                    <span>${getCategoryIcon(tx.category, tx.type)}</span>
                    <div>
                        <div class="font-medium">${tx.description || tx.category}</div>
                        <div class="text-sm text-secondary">${formatDate(tx.date)}</div>
                    </div>
                </div>
                <div class="font-semibold ${amountClass}">${formatCurrency(tx.amount)}</div>
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// ===== TRENDS REPORT =====
async function loadTrendsReport() {
    try {
        const data = await api('/reports/trends?months=12');
        const container = document.getElementById('report-content');

        let html = `
            <div class="grid grid-2 gap-lg mb-xl">
                <div class="widget">
                    <h3 class="widget-title mb-md">Income vs Expenses (12 Months)</h3>
                    <div class="chart-container">
                        <canvas id="trend-bar-chart"></canvas>
                    </div>
                </div>
                <div class="widget">
                    <h3 class="widget-title mb-md">Savings Trend</h3>
                    <div class="chart-container">
                        <canvas id="trend-savings-chart"></canvas>
                    </div>
                </div>
            </div>
            <div class="widget">
                <h3 class="widget-title mb-md">Month-by-Month Data</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Income</th>
                            <th>Expenses</th>
                            <th>Savings</th>
                            <th>Savings Rate</th>
                        </tr>
                    </thead>
                    <tbody id="trends-table-body"></tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        // Render charts
        const labels = data.map(t => getMonthName(t.month).substring(0, 3));
        const incomeData = data.map(t => t.income);
        const expenseData = data.map(t => t.expenses);
        const savingsData = data.map(t => t.savings);

        charts.trendBar = new Chart(document.getElementById('trend-bar-chart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Income', data: incomeData, backgroundColor: '#22c55e', borderRadius: 4 },
                    { label: 'Expenses', data: expenseData, backgroundColor: '#ef4444', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } }
                },
                scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(v) } } }
            }
        });

        charts.trendSavings = new Chart(document.getElementById('trend-savings-chart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Savings',
                    data: savingsData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } }
                },
                scales: { y: { ticks: { callback: (v) => formatCurrency(v) } } }
            }
        });

        // Render table
        let tableHtml = '';
        data.forEach(t => {
            tableHtml += `
                <tr>
                    <td>${getMonthName(t.month)} ${t.year}</td>
                    <td class="amount-positive">${formatCurrency(t.income)}</td>
                    <td class="amount-negative">${formatCurrency(t.expenses)}</td>
                    <td class="${t.savings >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(t.savings)}</td>
                    <td>${t.savingsRate}%</td>
                </tr>
            `;
        });
        document.getElementById('trends-table-body').innerHTML = tableHtml;

    } catch (error) {
        document.getElementById('report-content').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-title">Error Loading Trends</div>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// ===== CATEGORY REPORT =====
async function loadCategoryReport() {
    const container = document.getElementById('report-content');

    let html = `
        <div class="widget mb-lg">
            <div class="form-group">
                <label class="form-label">Select Category</label>
                <select class="form-select" id="category-select" style="max-width: 300px;">
                    ${EXPENSE_CATEGORIES.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('')}
                </select>
            </div>
        </div>
        <div id="category-report-content"></div>
    `;

    container.innerHTML = html;

    document.getElementById('category-select').addEventListener('change', (e) => {
        loadCategoryData(e.target.value);
    });

    loadCategoryData(EXPENSE_CATEGORIES[0].name);
}

async function loadCategoryData(category) {
    const content = document.getElementById('category-report-content');
    content.innerHTML = '<div class="skeleton" style="height: 300px;"></div>';

    try {
        const data = await api(`/reports/category/${encodeURIComponent(category)}?months=6`);

        let html = `
            <div class="widget mb-lg">
                <h3 class="widget-title mb-md">${category} - Last 6 Months</h3>
                <div class="chart-container">
                    <canvas id="category-trend-chart"></canvas>
                </div>
            </div>
            <div class="widget">
                <h3 class="widget-title mb-md">Recent Transactions</h3>
                <div id="category-transactions"></div>
            </div>
        `;

        content.innerHTML = html;

        // Render chart
        const labels = data.monthly.map(m => `${getMonthName(m.month).substring(0, 3)} ${m.year}`);
        const amounts = data.monthly.map(m => m.total);

        if (charts.categoryTrend) charts.categoryTrend.destroy();
        charts.categoryTrend = new Chart(document.getElementById('category-trend-chart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: category,
                    data: amounts,
                    borderColor: getCategoryColor(category),
                    backgroundColor: `${getCategoryColor(category)}20`,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } }
                },
                scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(v) } } }
            }
        });

        // Render transactions
        const txContainer = document.getElementById('category-transactions');
        if (!data.transactions || data.transactions.length === 0) {
            txContainer.innerHTML = '<div class="empty-state"><p>No transactions</p></div>';
        } else {
            let txHtml = '<ul class="widget-list">';
            data.transactions.forEach(tx => {
                txHtml += `
                    <li>
                        <div>
                            <div class="font-medium">${tx.description || tx.category}</div>
                            <div class="text-sm text-secondary">${formatDate(tx.date)}</div>
                        </div>
                        <div class="font-semibold amount-negative">${formatCurrency(tx.amount)}</div>
                    </li>
                `;
            });
            txHtml += '</ul>';
            txContainer.innerHTML = txHtml;
        }

    } catch (error) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-title">Error Loading Category Data</div>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// ===== YEARLY REPORT =====
async function loadYearlyReport(year) {
    try {
        const data = await api(`/reports/yearly?year=${year}`);
        const container = document.getElementById('report-content');

        let html = `
            <div class="summary-cards mb-xl">
                <div class="summary-card">
                    <div class="summary-card-icon">💰</div>
                    <div class="summary-card-label">Total Income</div>
                    <div class="summary-card-value amount-positive">${formatCurrency(data.totalIncome)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-icon">💸</div>
                    <div class="summary-card-label">Total Expenses</div>
                    <div class="summary-card-value amount-negative">${formatCurrency(data.totalExpenses)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-icon">🏦</div>
                    <div class="summary-card-label">Total Savings</div>
                    <div class="summary-card-value ${data.totalSavings >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(data.totalSavings)}</div>
                </div>
            </div>
            <div class="widget">
                <h3 class="widget-title mb-md">Month-by-Month Breakdown</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Income</th>
                            <th>Expenses</th>
                            <th>Savings</th>
                        </tr>
                    </thead>
                    <tbody id="yearly-table-body"></tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        // Render table
        let tableHtml = '';
        data.months.forEach(m => {
            tableHtml += `
                <tr>
                    <td>${getMonthName(m.month)}</td>
                    <td class="amount-positive">${formatCurrency(m.income)}</td>
                    <td class="amount-negative">${formatCurrency(m.expenses)}</td>
                    <td class="${m.savings >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(m.savings)}</td>
                </tr>
            `;
        });
        document.getElementById('yearly-table-body').innerHTML = tableHtml;

    } catch (error) {
        document.getElementById('report-content').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-title">Error Loading Yearly Report</div>
                <p>${error.message}</p>
            </div>
        `;
    }
}

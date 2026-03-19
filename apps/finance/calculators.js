// ===== CALCULATORS PAGE LOGIC =====

let currentChart = null;

// Show calculator hub
function showHub() {
    document.getElementById('calculator-hub').classList.remove('hidden');
    document.getElementById('calculator-container').classList.add('hidden');
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

// Show specific calculator
function showCalculator(type) {
    document.getElementById('calculator-hub').classList.add('hidden');
    document.getElementById('calculator-container').classList.remove('hidden');

    const content = document.getElementById('calculator-content');

    switch (type) {
        case 'emi':
            renderEMICalculator();
            break;
        case 'compound':
            renderCompoundInterestCalc();
            break;
        case 'sip':
            renderSIPCalculator();
            break;
        case 'lumpsum':
            renderLumpsumCalc();
            break;
        case 'fd':
            renderFDCalculator();
            break;
        case 'ppf':
            renderPPFCalculator();
            break;
        case 'gratuity':
            renderGratuityCalc();
            break;
        case 'tax':
            renderTaxCalculator();
            break;
        case 'gst':
            renderGSTCalculator();
            break;
        case 'inflation':
            renderInflationCalc();
            break;
        case 'retirement':
            renderRetirementCalc();
            break;
        case 'rentvsbuy':
            renderRentVsBuyCalc();
            break;
        case 'loancompare':
            renderLoanCompare();
            break;
        case 'savingsgoal':
            renderSavingsGoalCalc();
            break;
    }
}

// Setup slider sync
function setupSliderSync(sliderId, inputId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);

    if (slider && input) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            recalculate();
        });
        input.addEventListener('input', () => {
            slider.value = input.value;
            recalculate();
        });
    }
}

// Format calculator result
function formatCalcResult(label, value, isCurrency = true) {
    const formatted = isCurrency ? formatCurrency(value) : value;
    return `
        <div class="calc-result-card">
            <div class="calc-result-label">${label}</div>
            <div class="calc-result-value">${formatted}</div>
        </div>
    `;
}

// ===== EMI CALCULATOR =====
function renderEMICalculator() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🏦 EMI Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Loan Amount (₹)</label>
                    <div class="slider-input">
                        <input type="range" id="emi-amount-slider" min="100000" max="50000000" value="1000000" step="100000">
                        <input type="number" class="form-input" id="emi-amount" value="1000000" min="0">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Interest Rate (%)</label>
                    <div class="slider-input">
                        <input type="range" id="emi-rate-slider" min="1" max="30" value="8.5" step="0.1">
                        <input type="number" class="form-input" id="emi-rate" value="8.5" min="0" step="0.1">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Tenure (Years)</label>
                    <div class="slider-input">
                        <input type="range" id="emi-tenure-slider" min="1" max="30" value="20" step="1">
                        <input type="number" class="form-input" id="emi-tenure" value="20" min="1" max="30">
                    </div>
                </div>
            </div>
            <div>
                <div id="emi-results"></div>
                <div class="card mt-lg">
                    <h3 class="mb-md">Payment Breakdown</h3>
                    <div class="mini-chart-container">
                        <canvas id="emi-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupSliderSync('emi-amount-slider', 'emi-amount');
    setupSliderSync('emi-rate-slider', 'emi-rate');
    setupSliderSync('emi-tenure-slider', 'emi-tenure');
    recalculate();
}

function recalculateEMI() {
    const P = parseFloat(document.getElementById('emi-amount').value) || 0;
    const r = (parseFloat(document.getElementById('emi-rate').value) || 0) / 100 / 12;
    const n = (parseFloat(document.getElementById('emi-tenure').value) || 0) * 12;

    if (P <= 0 || r <= 0 || n <= 0) return;

    const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - P;

    document.getElementById('emi-results').innerHTML = `
        ${formatCalcResult('Monthly EMI', emi)}
        ${formatCalcResult('Total Interest', totalInterest)}
        ${formatCalcResult('Total Payment', totalPayment)}
    `;

    // Update chart
    const ctx = document.getElementById('emi-chart');
    if (ctx) {
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Principal', 'Interest'],
                datasets: [{
                    data: [P, totalInterest],
                    backgroundColor: ['#6366f1', '#ef4444'],
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
}

// ===== COMPOUND INTEREST CALCULATOR =====
function renderCompoundInterestCalc() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">📈 Compound Interest Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Principal Amount (₹)</label>
                    <input type="number" class="form-input" id="ci-principal" value="100000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Annual Rate (%)</label>
                    <input type="number" class="form-input" id="ci-rate" value="8" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Time Period (Years)</label>
                    <input type="number" class="form-input" id="ci-time" value="10" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label">Compounding Frequency</label>
                    <select class="form-select" id="ci-frequency">
                        <option value="12">Monthly</option>
                        <option value="4">Quarterly</option>
                        <option value="2">Half-Yearly</option>
                        <option value="1">Yearly</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Monthly Addition (₹) (Optional)</label>
                    <input type="number" class="form-input" id="ci-monthly" value="0" min="0">
                </div>
            </div>
            <div>
                <div id="ci-results"></div>
                <div class="card mt-lg">
                    <h3 class="mb-md">Growth Over Time</h3>
                    <div class="mini-chart-container">
                        <canvas id="ci-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    ['ci-principal', 'ci-rate', 'ci-time', 'ci-frequency', 'ci-monthly'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateCI);
    });
    recalculateCI();
}

function recalculateCI() {
    const P = parseFloat(document.getElementById('ci-principal').value) || 0;
    const r = (parseFloat(document.getElementById('ci-rate').value) || 0) / 100;
    const t = parseFloat(document.getElementById('ci-time').value) || 0;
    const n = parseInt(document.getElementById('ci-frequency').value) || 12;
    const monthly = parseFloat(document.getElementById('ci-monthly').value) || 0;

    if (P <= 0 || r <= 0 || t <= 0) return;

    const A = P * Math.pow(1 + r / n, n * t);
    const totalInterest = A - P;

    document.getElementById('ci-results').innerHTML = `
        ${formatCalcResult('Final Amount', A)}
        ${formatCalcResult('Total Interest', totalInterest)}
    `;

    // Growth chart
    const years = [];
    const amounts = [];
    for (let i = 0; i <= t; i++) {
        years.push(`Year ${i}`);
        amounts.push(P * Math.pow(1 + r / n, n * i));
    }

    const ctx = document.getElementById('ci-chart');
    if (ctx) {
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Amount',
                    data: amounts,
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
                    tooltip: {
                        callbacks: {
                            label: (context) => formatCurrency(context.raw)
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
}

// ===== SIP CALCULATOR =====
function renderSIPCalculator() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">💰 SIP Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Monthly SIP (₹)</label>
                    <input type="number" class="form-input" id="sip-amount" value="10000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Expected Return (% p.a.)</label>
                    <input type="number" class="form-input" id="sip-rate" value="12" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Period (Years)</label>
                    <input type="number" class="form-input" id="sip-period" value="10" min="1">
                </div>
            </div>
            <div>
                <div id="sip-results"></div>
                <div class="card mt-lg">
                    <h3 class="mb-md">Investment Growth</h3>
                    <div class="mini-chart-container">
                        <canvas id="sip-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    ['sip-amount', 'sip-rate', 'sip-period'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateSIP);
    });
    recalculateSIP();
}

function recalculateSIP() {
    const P = parseFloat(document.getElementById('sip-amount').value) || 0;
    const r = (parseFloat(document.getElementById('sip-rate').value) || 0) / 100 / 12;
    const n = (parseFloat(document.getElementById('sip-period').value) || 0) * 12;

    if (P <= 0 || r <= 0 || n <= 0) return;

    const totalInvested = P * n;
    const futureValue = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const returns = futureValue - totalInvested;

    document.getElementById('sip-results').innerHTML = `
        ${formatCalcResult('Total Invested', totalInvested)}
        ${formatCalcResult('Estimated Returns', returns)}
        ${formatCalcResult('Total Value', futureValue)}
    `;

    // Chart
    const ctx = document.getElementById('sip-chart');
    if (ctx) {
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Invested', 'Returns'],
                datasets: [{
                    data: [totalInvested, returns],
                    backgroundColor: ['#6366f1', '#22c55e'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => formatCurrency(context.raw)
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
}

// ===== LUMPSUM CALCULATOR =====
function renderLumpsumCalc() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🏛️ Lumpsum Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Investment Amount (₹)</label>
                    <input type="number" class="form-input" id="lump-amount" value="500000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Expected Return (% p.a.)</label>
                    <input type="number" class="form-input" id="lump-rate" value="12" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Period (Years)</label>
                    <input type="number" class="form-input" id="lump-period" value="10" min="1">
                </div>
            </div>
            <div>
                <div id="lump-results"></div>
                <div class="card mt-lg">
                    <h3 class="mb-md">Growth Projection</h3>
                    <div class="mini-chart-container">
                        <canvas id="lump-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    ['lump-amount', 'lump-rate', 'lump-period'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateLumpsum);
    });
    recalculateLumpsum();
}

function recalculateLumpsum() {
    const P = parseFloat(document.getElementById('lump-amount').value) || 0;
    const r = (parseFloat(document.getElementById('lump-rate').value) || 0) / 100;
    const t = parseFloat(document.getElementById('lump-period').value) || 0;

    if (P <= 0 || r <= 0 || t <= 0) return;

    const futureValue = P * Math.pow(1 + r, t);
    const returns = futureValue - P;

    document.getElementById('lump-results').innerHTML = `
        ${formatCalcResult('Future Value', futureValue)}
        ${formatCalcResult('Total Returns', returns)}
    `;

    // Chart
    const years = [];
    const amounts = [];
    for (let i = 0; i <= t; i++) {
        years.push(`Year ${i}`);
        amounts.push(P * Math.pow(1 + r, i));
    }

    const ctx = document.getElementById('lump-chart');
    if (ctx) {
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Value',
                    data: amounts,
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
                    tooltip: {
                        callbacks: {
                            label: (context) => formatCurrency(context.raw)
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
}

// ===== FD CALCULATOR =====
function renderFDCalculator() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🏧 FD Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Deposit Amount (₹)</label>
                    <input type="number" class="form-input" id="fd-amount" value="100000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Interest Rate (% p.a.)</label>
                    <input type="number" class="form-input" id="fd-rate" value="7" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Tenure (Years)</label>
                    <input type="number" class="form-input" id="fd-tenure" value="5" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label">Compounding</label>
                    <select class="form-select" id="fd-compounding">
                        <option value="4">Quarterly</option>
                        <option value="2">Half-Yearly</option>
                        <option value="1">Yearly</option>
                    </select>
                </div>
            </div>
            <div>
                <div id="fd-results"></div>
            </div>
        </div>
    `;

    ['fd-amount', 'fd-rate', 'fd-tenure', 'fd-compounding'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateFD);
    });
    recalculateFD();
}

function recalculateFD() {
    const P = parseFloat(document.getElementById('fd-amount').value) || 0;
    const r = (parseFloat(document.getElementById('fd-rate').value) || 0) / 100;
    const t = parseFloat(document.getElementById('fd-tenure').value) || 0;
    const n = parseInt(document.getElementById('fd-compounding').value) || 4;

    if (P <= 0 || r <= 0 || t <= 0) return;

    const maturity = P * Math.pow(1 + r / n, n * t);
    const interest = maturity - P;

    document.getElementById('fd-results').innerHTML = `
        ${formatCalcResult('Maturity Amount', maturity)}
        ${formatCalcResult('Interest Earned', interest)}
    `;
}

// ===== PPF CALCULATOR =====
function renderPPFCalculator() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🏦 PPF Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Yearly Deposit (₹) (Max ₹1,50,000)</label>
                    <input type="number" class="form-input" id="ppf-deposit" value="150000" min="0" max="150000">
                </div>
                <div class="form-group">
                    <label class="form-label">Interest Rate (%)</label>
                    <input type="number" class="form-input" id="ppf-rate" value="7.1" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Tenure (Years)</label>
                    <input type="number" class="form-input" id="ppf-tenure" value="15" min="15" max="50">
                </div>
            </div>
            <div>
                <div id="ppf-results"></div>
            </div>
        </div>
    `;

    ['ppf-deposit', 'ppf-rate', 'ppf-tenure'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculatePPF);
    });
    recalculatePPF();
}

function recalculatePPF() {
    const deposit = parseFloat(document.getElementById('ppf-deposit').value) || 0;
    const r = (parseFloat(document.getElementById('ppf-rate').value) || 0) / 100;
    const t = parseFloat(document.getElementById('ppf-tenure').value) || 0;

    if (deposit <= 0 || r <= 0 || t <= 0) return;

    let balance = 0;
    for (let i = 0; i < t; i++) {
        balance = (balance + deposit) * (1 + r);
    }

    const totalDeposited = deposit * t;
    const interest = balance - totalDeposited;

    document.getElementById('ppf-results').innerHTML = `
        ${formatCalcResult('Maturity Amount', balance)}
        ${formatCalcResult('Total Deposited', totalDeposited)}
        ${formatCalcResult('Total Interest', interest)}
    `;
}

// ===== GRATUITY CALCULATOR =====
function renderGratuityCalc() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🎖️ Gratuity Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Last Drawn Salary (Basic + DA) (₹)</label>
                    <input type="number" class="form-input" id="grat-salary" value="50000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Years of Service</label>
                    <input type="number" class="form-input" id="grat-years" value="10" min="0" step="0.5">
                </div>
            </div>
            <div>
                <div id="grat-results"></div>
                <div class="card mt-lg">
                    <p class="text-secondary">Eligibility: Minimum 5 years of continuous service required.</p>
                </div>
            </div>
        </div>
    `;

    ['grat-salary', 'grat-years'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateGratuity);
    });
    recalculateGratuity();
}

function recalculateGratuity() {
    const salary = parseFloat(document.getElementById('grat-salary').value) || 0;
    const years = parseFloat(document.getElementById('grat-years').value) || 0;

    if (salary <= 0 || years < 5) {
        document.getElementById('grat-results').innerHTML = `
            <div class="calc-result-card" style="background: var(--bg-primary);">
                <div class="calc-result-label">Not Eligible</div>
                <div class="calc-result-value" style="color: var(--text-secondary);">Minimum 5 years required</div>
            </div>
        `;
        return;
    }

    const gratuity = (15 * salary * years) / 26;

    document.getElementById('grat-results').innerHTML = `
        ${formatCalcResult('Estimated Gratuity', gratuity)}
    `;
}

// ===== TAX CALCULATOR =====
function renderTaxCalculator() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">📋 Income Tax Calculator (FY 2024-25)</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Annual Gross Income (₹)</label>
                    <input type="number" class="form-input" id="tax-income" value="1000000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Tax Regime</label>
                    <div class="tabs">
                        <button class="tab-btn active" data-regime="new">New Regime</button>
                        <button class="tab-btn" data-regime="old">Old Regime</button>
                    </div>
                </div>
                <div id="old-regime-deductions" class="hidden">
                    <div class="form-group">
                        <label class="form-label">80C Deductions (₹)</label>
                        <input type="number" class="form-input" id="tax-80c" value="150000" min="0" max="150000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">80D Health Insurance (₹)</label>
                        <input type="number" class="form-input" id="tax-80d" value="25000" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">HRA Exemption (₹)</label>
                        <input type="number" class="form-input" id="tax-hra" value="0" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Standard Deduction (₹)</label>
                        <input type="number" class="form-input" id="tax-standard" value="50000" min="0">
                    </div>
                </div>
            </div>
            <div>
                <div id="tax-results"></div>
            </div>
        </div>
    `;

    // Regime toggle
    const regimeTabs = document.querySelectorAll('.tab-btn');
    regimeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            regimeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const regime = tab.dataset.regime;
            document.getElementById('old-regime-deductions').classList.toggle('hidden', regime === 'new');
            recalculateTax();
        });
    });

    ['tax-income', 'tax-80c', 'tax-80d', 'tax-hra', 'tax-standard'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateTax);
    });
    recalculateTax();
}

function recalculateTax() {
    const income = parseFloat(document.getElementById('tax-income').value) || 0;
    const isNewRegime = document.querySelector('.tab-btn.active').dataset.regime === 'new';

    let taxableIncome = income;
    let tax = 0;

    if (isNewRegime) {
        // New regime slabs (FY 2024-25)
        taxableIncome = Math.max(0, income - 50000); // Standard deduction
        const slabs = [
            { limit: 300000, rate: 0 },
            { limit: 600000, rate: 0.05 },
            { limit: 900000, rate: 0.10 },
            { limit: 1200000, rate: 0.15 },
            { limit: 1500000, rate: 0.20 },
            { limit: Infinity, rate: 0.30 }
        ];

        let remaining = taxableIncome;
        let prevLimit = 0;
        for (const slab of slabs) {
            if (remaining <= 0) break;
            const taxableInSlab = Math.min(remaining, slab.limit - prevLimit);
            tax += taxableInSlab * slab.rate;
            remaining -= taxableInSlab;
            prevLimit = slab.limit;
        }
    } else {
        // Old regime
        const deduction80c = parseFloat(document.getElementById('tax-80c').value) || 0;
        const deduction80d = parseFloat(document.getElementById('tax-80d').value) || 0;
        const hra = parseFloat(document.getElementById('tax-hra').value) || 0;
        const standard = parseFloat(document.getElementById('tax-standard').value) || 0;

        taxableIncome = Math.max(0, income - deduction80c - deduction80d - hra - standard);

        const slabs = [
            { limit: 250000, rate: 0 },
            { limit: 500000, rate: 0.05 },
            { limit: 1000000, rate: 0.20 },
            { limit: Infinity, rate: 0.30 }
        ];

        let remaining = taxableIncome;
        let prevLimit = 0;
        for (const slab of slabs) {
            if (remaining <= 0) break;
            const taxableInSlab = Math.min(remaining, slab.limit - prevLimit);
            tax += taxableInSlab * slab.rate;
            remaining -= taxableInSlab;
            prevLimit = slab.limit;
        }
    }

    const cess = tax * 0.04;
    const totalTax = tax + cess;
    const effectiveRate = income > 0 ? (totalTax / income * 100).toFixed(2) : 0;
    const monthlyTDS = totalTax / 12;

    document.getElementById('tax-results').innerHTML = `
        ${formatCalcResult('Taxable Income', taxableIncome)}
        ${formatCalcResult('Tax Before Cess', tax)}
        ${formatCalcResult('Cess (4%)', cess)}
        ${formatCalcResult('Total Tax', totalTax)}
        <div class="calc-result-card">
            <div class="calc-result-label">Effective Tax Rate</div>
            <div class="calc-result-value">${effectiveRate}%</div>
        </div>
        ${formatCalcResult('Monthly TDS', monthlyTDS)}
    `;
}

// ===== GST CALCULATOR =====
function renderGSTCalculator() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🧾 GST Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Amount (₹)</label>
                    <input type="number" class="form-input" id="gst-amount" value="10000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">GST Rate (%)</label>
                    <select class="form-select" id="gst-rate">
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18" selected>18%</option>
                        <option value="28">28%</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Mode</label>
                    <div class="tabs">
                        <button class="tab-btn active" data-mode="exclusive">Exclusive</button>
                        <button class="tab-btn" data-mode="inclusive">Inclusive</button>
                    </div>
                </div>
            </div>
            <div>
                <div id="gst-results"></div>
            </div>
        </div>
    `;

    const modeTabs = document.querySelectorAll('.tab-btn');
    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            recalculateGST();
        });
    });

    ['gst-amount', 'gst-rate'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateGST);
    });
    recalculateGST();
}

function recalculateGST() {
    const amount = parseFloat(document.getElementById('gst-amount').value) || 0;
    const rate = parseFloat(document.getElementById('gst-rate').value) || 0;
    const isInclusive = document.querySelector('.tab-btn.active').dataset.mode === 'inclusive';

    let baseAmount, gstAmount, total;

    if (isInclusive) {
        total = amount;
        baseAmount = amount / (1 + rate / 100);
        gstAmount = amount - baseAmount;
    } else {
        baseAmount = amount;
        gstAmount = amount * rate / 100;
        total = amount + gstAmount;
    }

    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;

    document.getElementById('gst-results').innerHTML = `
        ${formatCalcResult('Base Amount', baseAmount)}
        ${formatCalcResult('CGST', cgst)}
        ${formatCalcResult('SGST', sgst)}
        ${formatCalcResult('Total GST', gstAmount)}
        ${formatCalcResult('Total Amount', total)}
    `;
}

// ===== INFLATION CALCULATOR =====
function renderInflationCalc() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">📉 Inflation Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Current Cost (₹)</label>
                    <input type="number" class="form-input" id="inf-cost" value="50000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Inflation Rate (% p.a.)</label>
                    <input type="number" class="form-input" id="inf-rate" value="6" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Years</label>
                    <input type="number" class="form-input" id="inf-years" value="10" min="1">
                </div>
            </div>
            <div>
                <div id="inf-results"></div>
            </div>
        </div>
    `;

    ['inf-cost', 'inf-rate', 'inf-years'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateInflation);
    });
    recalculateInflation();
}

function recalculateInflation() {
    const cost = parseFloat(document.getElementById('inf-cost').value) || 0;
    const rate = (parseFloat(document.getElementById('inf-rate').value) || 0) / 100;
    const years = parseFloat(document.getElementById('inf-years').value) || 0;

    if (cost <= 0 || years <= 0) return;

    const futureCost = cost * Math.pow(1 + rate, years);
    const purchasingPowerLoss = futureCost - cost;

    document.getElementById('inf-results').innerHTML = `
        ${formatCalcResult('Future Cost', futureCost)}
        ${formatCalcResult('Purchasing Power Loss', purchasingPowerLoss)}
        <div class="calc-result-card">
            <div class="calc-result-label">Message</div>
            <div class="calc-result-value" style="font-size: 1rem;">₹${formatCurrency(cost)}/month today = ₹${formatCurrency(futureCost)}/month in ${years} years</div>
        </div>
    `;
}

// ===== RETIREMENT CALCULATOR =====
function renderRetirementCalc() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🏖️ Retirement Planner</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Current Age</label>
                    <input type="number" class="form-input" id="ret-current-age" value="30" min="18">
                </div>
                <div class="form-group">
                    <label class="form-label">Retirement Age</label>
                    <input type="number" class="form-input" id="ret-retire-age" value="60" min="30">
                </div>
                <div class="form-group">
                    <label class="form-label">Monthly Expenses Now (₹)</label>
                    <input type="number" class="form-input" id="ret-expenses" value="50000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Inflation (%)</label>
                    <input type="number" class="form-input" id="ret-inflation" value="6" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Investment Return (%)</label>
                    <input type="number" class="form-input" id="ret-return" value="12" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Current Savings (₹)</label>
                    <input type="number" class="form-input" id="ret-savings" value="500000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Life Expectancy</label>
                    <input type="number" class="form-input" id="ret-life" value="80" min="60">
                </div>
            </div>
            <div>
                <div id="ret-results"></div>
            </div>
        </div>
    `;

    ['ret-current-age', 'ret-retire-age', 'ret-expenses', 'ret-inflation', 'ret-return', 'ret-savings', 'ret-life'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateRetirement);
    });
    recalculateRetirement();
}

function recalculateRetirement() {
    const currentAge = parseInt(document.getElementById('ret-current-age').value) || 0;
    const retireAge = parseInt(document.getElementById('ret-retire-age').value) || 0;
    const expenses = parseFloat(document.getElementById('ret-expenses').value) || 0;
    const inflation = (parseFloat(document.getElementById('ret-inflation').value) || 0) / 100;
    const returnRate = (parseFloat(document.getElementById('ret-return').value) || 0) / 100;
    const savings = parseFloat(document.getElementById('ret-savings').value) || 0;
    const lifeExpectancy = parseInt(document.getElementById('ret-life').value) || 0;

    if (currentAge >= retireAge || expenses <= 0) return;

    const yearsToRetire = retireAge - currentAge;
    const retirementYears = lifeExpectancy - retireAge;

    const monthlyExpensesAtRetire = expenses * Math.pow(1 + inflation, yearsToRetire);
    const annualExpensesAtRetire = monthlyExpensesAtRetire * 12;
    const totalCorpusNeeded = annualExpensesAtRetire * retirementYears;
    const currentShortfall = totalCorpusNeeded - savings;
    const monthlySavingNeeded = currentShortfall / (yearsToRetire * 12);

    document.getElementById('ret-results').innerHTML = `
        ${formatCalcResult('Monthly Expenses at Retirement', monthlyExpensesAtRetire)}
        ${formatCalcResult('Total Corpus Needed', totalCorpusNeeded)}
        ${formatCalcResult('Current Shortfall', currentShortfall)}
        ${formatCalcResult('Monthly Saving Needed', monthlySavingNeeded)}
    `;
}

// ===== RENT VS BUY CALCULATOR =====
function renderRentVsBuyCalc() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🏠 Rent vs Buy Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <h3 class="mb-md">Rent Details</h3>
                <div class="form-group">
                    <label class="form-label">Monthly Rent (₹)</label>
                    <input type="number" class="form-input" id="rvb-rent" value="25000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Annual Rent Increase (%)</label>
                    <input type="number" class="form-input" id="rvb-rent-increase" value="5" min="0" step="0.1">
                </div>
                <h3 class="mb-md mt-lg">Buy Details</h3>
                <div class="form-group">
                    <label class="form-label">Property Price (₹)</label>
                    <input type="number" class="form-input" id="rvb-price" value="5000000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Down Payment (%)</label>
                    <input type="number" class="form-input" id="rvb-down" value="20" min="0" max="100">
                </div>
                <div class="form-group">
                    <label class="form-label">Loan Rate (%)</label>
                    <input type="number" class="form-input" id="rvb-loan-rate" value="8.5" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Loan Tenure (Years)</label>
                    <input type="number" class="form-input" id="rvb-tenure" value="20" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label">Property Appreciation (% p.a.)</label>
                    <input type="number" class="form-input" id="rvb-appreciation" value="5" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Comparison Period (Years)</label>
                    <input type="number" class="form-input" id="rvb-years" value="10" min="1">
                </div>
            </div>
            <div>
                <div id="rvb-results"></div>
            </div>
        </div>
    `;

    ['rvb-rent', 'rvb-rent-increase', 'rvb-price', 'rvb-down', 'rvb-loan-rate', 'rvb-tenure', 'rvb-appreciation', 'rvb-years'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateRentVsBuy);
    });
    recalculateRentVsBuy();
}

function recalculateRentVsBuy() {
    const rent = parseFloat(document.getElementById('rvb-rent').value) || 0;
    const rentIncrease = (parseFloat(document.getElementById('rvb-rent-increase').value) || 0) / 100;
    const price = parseFloat(document.getElementById('rvb-price').value) || 0;
    const downPaymentPercent = parseFloat(document.getElementById('rvb-down').value) || 0;
    const loanRate = (parseFloat(document.getElementById('rvb-loan-rate').value) || 0) / 100;
    const tenure = parseFloat(document.getElementById('rvb-tenure').value) || 0;
    const appreciation = (parseFloat(document.getElementById('rvb-appreciation').value) || 0) / 100;
    const years = parseFloat(document.getElementById('rvb-years').value) || 0;

    if (rent <= 0 || price <= 0 || years <= 0) return;

    // Total rent cost
    let totalRent = 0;
    let currentRent = rent;
    for (let i = 0; i < years; i++) {
        totalRent += currentRent * 12;
        currentRent *= (1 + rentIncrease);
    }

    // Total buy cost
    const downPayment = price * downPaymentPercent / 100;
    const loanAmount = price - downPayment;
    const monthlyRate = loanRate / 12;
    const months = tenure * 12;
    const emi = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
    const totalEMI = emi * Math.min(years * 12, months);
    const propertyValue = price * Math.pow(1 + appreciation, years);
    const netBuyCost = downPayment + totalEMI - propertyValue;

    document.getElementById('rvb-results').innerHTML = `
        ${formatCalcResult('Total Rent Cost', totalRent)}
        ${formatCalcResult('Total Buy Cost', downPayment + totalEMI)}
        ${formatCalcResult('Property Value After ' + years + ' Years', propertyValue)}
        ${formatCalcResult('Net Buy Cost', netBuyCost)}
        <div class="calc-result-card">
            <div class="calc-result-label">Verdict</div>
            <div class="calc-result-value" style="font-size: 1rem;">${totalRent < netBuyCost ? 'Renting is cheaper' : 'Buying is cheaper'} by ${formatCurrency(Math.abs(totalRent - netBuyCost))}</div>
        </div>
    `;
}

// ===== LOAN COMPARISON =====
function renderLoanCompare() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">⚖️ Loan Comparison</h2>
        <div class="card">
            <div class="grid grid-3 gap-lg">
                <div>
                    <h3 class="mb-md">Loan 1</h3>
                    <div class="form-group">
                        <label class="form-label">Bank Name</label>
                        <input type="text" class="form-input" id="loan1-bank" value="Bank A">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Amount (₹)</label>
                        <input type="number" class="form-input" id="loan1-amount" value="1000000" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rate (%)</label>
                        <input type="number" class="form-input" id="loan1-rate" value="8.5" min="0" step="0.1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tenure (Years)</label>
                        <input type="number" class="form-input" id="loan1-tenure" value="20" min="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Processing Fee (₹)</label>
                        <input type="number" class="form-input" id="loan1-fee" value="5000" min="0">
                    </div>
                </div>
                <div>
                    <h3 class="mb-md">Loan 2</h3>
                    <div class="form-group">
                        <label class="form-label">Bank Name</label>
                        <input type="text" class="form-input" id="loan2-bank" value="Bank B">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Amount (₹)</label>
                        <input type="number" class="form-input" id="loan2-amount" value="1000000" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rate (%)</label>
                        <input type="number" class="form-input" id="loan2-rate" value="9" min="0" step="0.1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tenure (Years)</label>
                        <input type="number" class="form-input" id="loan2-tenure" value="20" min="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Processing Fee (₹)</label>
                        <input type="number" class="form-input" id="loan2-fee" value="3000" min="0">
                    </div>
                </div>
                <div>
                    <h3 class="mb-md">Loan 3</h3>
                    <div class="form-group">
                        <label class="form-label">Bank Name</label>
                        <input type="text" class="form-input" id="loan3-bank" value="Bank C">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Amount (₹)</label>
                        <input type="number" class="form-input" id="loan3-amount" value="1000000" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rate (%)</label>
                        <input type="number" class="form-input" id="loan3-rate" value="8.75" min="0" step="0.1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tenure (Years)</label>
                        <input type="number" class="form-input" id="loan3-tenure" value="20" min="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Processing Fee (₹)</label>
                        <input type="number" class="form-input" id="loan3-fee" value="4000" min="0">
                    </div>
                </div>
            </div>
            <div id="loan-results" class="mt-lg"></div>
        </div>
    `;

    for (let i = 1; i <= 3; i++) {
        ['bank', 'amount', 'rate', 'tenure', 'fee'].forEach(field => {
            document.getElementById(`loan${i}-${field}`).addEventListener('input', recalculateLoanCompare);
        });
    }
    recalculateLoanCompare();
}

function recalculateLoanCompare() {
    const loans = [];
    for (let i = 1; i <= 3; i++) {
        const bank = document.getElementById(`loan${i}-bank`).value;
        const amount = parseFloat(document.getElementById(`loan${i}-amount`).value) || 0;
        const rate = (parseFloat(document.getElementById(`loan${i}-rate`).value) || 0) / 100;
        const tenure = parseFloat(document.getElementById(`loan${i}-tenure`).value) || 0;
        const fee = parseFloat(document.getElementById(`loan${i}-fee`).value) || 0;

        if (amount > 0 && rate > 0 && tenure > 0) {
            const monthlyRate = rate / 12;
            const months = tenure * 12;
            const emi = amount * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
            const totalInterest = emi * months - amount;
            const totalCost = amount + totalInterest + fee;

            loans.push({ bank, emi, totalInterest, totalCost, fee });
        }
    }

    if (loans.length === 0) {
        document.getElementById('loan-results').innerHTML = '<p class="text-secondary">Enter loan details to compare</p>';
        return;
    }

    const cheapest = loans.reduce((min, loan) => loan.totalCost < min.totalCost ? loan : min);

    let html = '<table class="data-table"><thead><tr><th>Bank</th><th>EMI</th><th>Total Interest</th><th>Processing Fee</th><th>Total Cost</th></tr></thead><tbody>';
    loans.forEach(loan => {
        const isCheapest = loan.bank === cheapest.bank;
        html += `<tr style="${isCheapest ? 'background: rgba(34, 197, 94, 0.1);' : ''}">
            <td>${loan.bank} ${isCheapest ? '✓' : ''}</td>
            <td>${formatCurrency(loan.emi)}</td>
            <td>${formatCurrency(loan.totalInterest)}</td>
            <td>${formatCurrency(loan.fee)}</td>
            <td>${formatCurrency(loan.totalCost)}</td>
        </tr>`;
    });
    html += '</tbody></table>';

    document.getElementById('loan-results').innerHTML = html;
}

// ===== SAVINGS GOAL CALCULATOR =====
function renderSavingsGoalCalc() {
    const content = document.getElementById('calculator-content');
    content.innerHTML = `
        <h2 class="mb-lg">🎯 Savings Goal Calculator</h2>
        <div class="calc-layout">
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Target Amount (₹)</label>
                    <input type="number" class="form-input" id="sg-target" value="1000000" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Time Frame (Months)</label>
                    <input type="number" class="form-input" id="sg-months" value="60" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label">Expected Return (% p.a.)</label>
                    <input type="number" class="form-input" id="sg-rate" value="8" min="0" step="0.1">
                </div>
            </div>
            <div>
                <div id="sg-results"></div>
            </div>
        </div>
    `;

    ['sg-target', 'sg-months', 'sg-rate'].forEach(id => {
        document.getElementById(id).addEventListener('input', recalculateSavingsGoal);
    });
    recalculateSavingsGoal();
}

function recalculateSavingsGoal() {
    const target = parseFloat(document.getElementById('sg-target').value) || 0;
    const months = parseFloat(document.getElementById('sg-months').value) || 0;
    const rate = (parseFloat(document.getElementById('sg-rate').value) || 0) / 100 / 12;

    if (target <= 0 || months <= 0) return;

    // With returns
    const monthlyWithReturns = target * rate / (Math.pow(1 + rate, months) - 1);
    // Without returns
    const monthlyWithoutReturns = target / months;
    const totalDeposited = monthlyWithReturns * months;
    const interestEarned = target - totalDeposited;

    document.getElementById('sg-results').innerHTML = `
        ${formatCalcResult('Monthly Saving (with returns)', monthlyWithReturns)}
        ${formatCalcResult('Monthly Saving (without returns)', monthlyWithoutReturns)}
        ${formatCalcResult('Total Deposited', totalDeposited)}
        ${formatCalcResult('Interest Earned', interestEarned)}
    `;
}

// Generic recalculate function
function recalculate() {
    // This will be called by slider sync
    // Check which calculator is active and call appropriate recalculate
    const emiAmount = document.getElementById('emi-amount');
    if (emiAmount) recalculateEMI();
}

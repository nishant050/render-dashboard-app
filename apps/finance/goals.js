// Goals Page Logic
document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await initFinanceAuth();
    if (!isAuth) return;

    loadGoals();

    // Add Goal button
    document.getElementById('add-goal-btn').addEventListener('click', () => {
        openGoalForm();
    });
});

async function loadGoals() {
    try {
        const [goals, summary] = await Promise.all([
            api('/goals'),
            api('/goals/summary')
        ]);

        renderGoalsSummary(summary);
        renderGoalGrid(goals);
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

function renderGoalsSummary(summary) {
    document.getElementById('total-saved').textContent = formatCurrency(summary.totalSaved);
    document.getElementById('total-remaining').textContent = formatCurrency(summary.totalRemaining);
    document.getElementById('active-count').textContent = summary.activeCount;
    document.getElementById('completed-count').textContent = summary.completedCount;
}

function renderGoalGrid(goals) {
    const container = document.getElementById('goal-grid');

    if (!goals || goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎯</div>
                <div class="empty-state-title">No Goals Set</div>
                <div class="empty-state-text">Create your first savings goal to start tracking</div>
            </div>
        `;
        return;
    }

    // Sort: active first, then completed
    const sortedGoals = [...goals].sort((a, b) => {
        if (a.isCompleted === b.isCompleted) {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.isCompleted ? 1 : -1;
    });

    let html = '<div class="grid-3">';

    sortedGoals.forEach(goal => {
        const percentage = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount * 100) : 0;
        const remaining = goal.targetAmount - goal.currentAmount;
        const progressColor = getProgressColor(percentage);

        let monthlyTarget = '';
        if (goal.targetDate && !goal.isCompleted) {
            const today = new Date();
            const targetDate = new Date(goal.targetDate);
            const monthsRemaining = Math.max(1, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24 * 30)));
            const monthlyAmount = remaining / monthsRemaining;
            monthlyTarget = `<div style="font-size: var(--font-size-sm); color: var(--text-secondary);">
                Monthly target: ${formatCurrency(monthlyAmount)}/mo to reach by ${formatDate(goal.targetDate)}
            </div>`;
        }

        const priorityColors = {
            high: 'badge-danger',
            medium: 'badge-warning',
            low: 'badge-info'
        };

        html += `
            <div class="goal-card ${goal.isCompleted ? 'completed' : ''}">
                <div class="goal-header">
                    <div class="goal-icon">${goal.icon}</div>
                    <span class="badge ${priorityColors[goal.priority]}">${goal.priority}</span>
                </div>
                <div class="goal-name">${goal.name}</div>
                <div class="goal-progress">
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill ${progressColor}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div class="goal-progress-text">
                        <span class="goal-amount">${formatCurrency(goal.currentAmount)}</span>
                        <span class="goal-target">/ ${formatCurrency(goal.targetAmount)}</span>
                    </div>
                </div>
                <div class="goal-meta">
                    ${goal.isCompleted ? '<span class="badge badge-success">🎉 Completed</span>' :
                `<span>${formatCurrency(remaining)} remaining</span>`}
                    ${monthlyTarget}
                </div>
                <div class="goal-actions">
                    ${!goal.isCompleted ? `<button class="btn btn-primary btn-sm" onclick="openContributeForm('${goal._id}')">➕ Contribute</button>` : ''}
                    <button class="btn btn-ghost btn-sm" onclick="showContributionHistory('${goal._id}')">📜 History</button>
                    <button class="btn btn-ghost btn-sm" onclick="editGoal('${goal._id}')">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteGoal('${goal._id}')">🗑️</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function openGoalForm(existingGoal = null) {
    const iconOptions = ['🎯', '🏠', '🚗', '✈️', '💰', '📚', '🎓', '💍', '🏥', '🎁', '📱', '💻', '🎮', '🏋️', '🎨'].map(icon =>
        `<option value="${icon}" ${existingGoal?.icon === icon ? 'selected' : ''}>${icon}</option>`
    ).join('');

    const formHTML = `
        <form id="goal-form">
            <div class="form-group">
                <label class="form-label">Goal Name</label>
                <input type="text" name="name" class="form-input" placeholder="e.g., Emergency Fund, Vacation"
                    value="${existingGoal?.name || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Target Amount (₹)</label>
                <input type="number" name="targetAmount" class="form-input" placeholder="0" step="1000"
                    value="${existingGoal?.targetAmount || ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Target Date (optional)</label>
                <input type="date" name="targetDate" class="form-input"
                    value="${existingGoal?.targetDate ? formatDateForInput(existingGoal.targetDate) : ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Initial Amount (₹)</label>
                <input type="number" name="currentAmount" class="form-input" placeholder="0" step="100"
                    value="${existingGoal?.currentAmount || 0}">
            </div>
            <div class="form-group">
                <label class="form-label">Priority</label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="priority" value="high" ${existingGoal?.priority === 'high' ? 'checked' : ''}>
                        High
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="priority" value="medium" ${existingGoal?.priority === 'medium' || !existingGoal ? 'checked' : ''}>
                        Medium
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="priority" value="low" ${existingGoal?.priority === 'low' ? 'checked' : ''}>
                        Low
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Icon</label>
                <select name="icon" class="form-select">
                    ${iconOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea name="notes" class="form-textarea" placeholder="Additional notes...">${existingGoal?.notes || ''}</textarea>
            </div>
        </form>
    `;

    openModal(existingGoal ? 'Edit Goal' : 'Add Goal', formHTML, async () => {
        const form = document.getElementById('goal-form');
        const formData = new FormData(form);

        const data = {
            name: formData.get('name'),
            targetAmount: parseFloat(formData.get('targetAmount')),
            targetDate: formData.get('targetDate') || null,
            currentAmount: parseFloat(formData.get('currentAmount')) || 0,
            priority: formData.get('priority'),
            icon: formData.get('icon'),
            notes: formData.get('notes')
        };

        if (!validateAmount(data.targetAmount)) return;
        if (!validateRequired({ name: data.name })) return;

        if (existingGoal) {
            await api(`/goals/${existingGoal._id}`, { method: 'PUT', body: data });
            showToast('Goal updated successfully', 'success');
        } else {
            await api('/goals', { method: 'POST', body: data });
            showToast('Goal added successfully', 'success');
        }

        loadGoals();
    });
}

async function editGoal(id) {
    try {
        const goals = await api('/goals');
        const goal = goals.find(g => g._id === id);
        if (goal) {
            openGoalForm(goal);
        }
    } catch (error) {
        console.error('Error fetching goal:', error);
    }
}

async function deleteGoal(id) {
    showConfirm('Are you sure you want to delete this goal?', async () => {
        try {
            await api(`/goals/${id}`, { method: 'DELETE' });
            showToast('Goal deleted successfully', 'success');
            loadGoals();
        } catch (error) {
            console.error('Error deleting goal:', error);
        }
    });
}

async function openContributeForm(goalId) {
    try {
        const goals = await api('/goals');
        const goal = goals.find(g => g._id === goalId);
        if (!goal) return;

        const remaining = goal.targetAmount - goal.currentAmount;

        const formHTML = `
            <form id="contribute-form">
                <div style="margin-bottom: var(--space-md);">
                    <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">Current Progress</div>
                    <div style="font-size: var(--font-size-xl); font-weight: 700;">
                        ${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)}
                    </div>
                    <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">
                        ${formatCurrency(remaining)} remaining
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Contribution Amount (₹)</label>
                    <input type="number" name="amount" class="form-input" placeholder="0" step="100" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Note (optional)</label>
                    <input type="text" name="note" class="form-input" placeholder="e.g., Monthly savings">
                </div>
            </form>
        `;

        openModal(`Contribute to ${goal.name}`, formHTML, async () => {
            const form = document.getElementById('contribute-form');
            const formData = new FormData(form);

            const data = {
                amount: parseFloat(formData.get('amount')),
                note: formData.get('note')
            };

            if (!validateAmount(data.amount)) return;

            await api(`/goals/${goalId}/contribute`, { method: 'POST', body: data });

            // Check if goal is completed
            const newTotal = goal.currentAmount + data.amount;
            if (newTotal >= goal.targetAmount) {
                showToast('🎉 Congratulations! Goal achieved!', 'success');
            } else {
                showToast('Contribution added successfully', 'success');
            }

            loadGoals();
        });
    } catch (error) {
        console.error('Error opening contribute form:', error);
    }
}

async function showContributionHistory(goalId) {
    try {
        const goals = await api('/goals');
        const goal = goals.find(g => g._id === goalId);
        if (!goal) return;

        let html = '';

        if (!goal.contributions || goal.contributions.length === 0) {
            html = `
                <div class="empty-state">
                    <div class="empty-state-icon">📜</div>
                    <div class="empty-state-title">No Contributions Yet</div>
                    <div class="empty-state-text">Make your first contribution to this goal</div>
                </div>
            `;
        } else {
            html = '<div class="contribution-timeline">';

            // Sort contributions by date (newest first)
            const sortedContributions = [...goal.contributions].sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            );

            sortedContributions.forEach(contribution => {
                html += `
                    <div class="contribution-item">
                        <div style="font-weight: 600;">${formatCurrency(contribution.amount)}</div>
                        <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">
                            ${formatDate(contribution.date)}
                            ${contribution.note ? ` • ${contribution.note}` : ''}
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        openModal(`Contribution History: ${goal.name}`, html);
    } catch (error) {
        console.error('Error loading contribution history:', error);
    }
}

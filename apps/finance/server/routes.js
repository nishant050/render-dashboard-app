const express = require('express');
const router = express.Router();
const Transaction = require('./models/Transaction');
const Budget = require('./models/Budget');
const Bill = require('./models/Bill');
const Goal = require('./models/Goal');
const Account = require('./models/Account');
const Settings = require('./models/Settings');

// ===== TRANSACTIONS =====

// GET /transactions - List with filters
router.get('/transactions', async (req, res) => {
    try {
        const { month, year, type, category, search, sort = '-date', limit } = req.query;
        const query = {};

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        }

        if (type && type !== 'all') query.type = type;
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { description: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        let transactions = Transaction.find(query).sort(sort);
        if (limit) transactions = transactions.limit(parseInt(limit));

        res.json(await transactions.exec());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /transactions - Create new
router.post('/transactions', async (req, res) => {
    try {
        const transaction = new Transaction(req.body);
        await transaction.save();

        // Update account balance if accountId provided
        if (transaction.accountId) {
            const account = await Account.findById(transaction.accountId);
            if (account) {
                account.balance += transaction.type === 'income' ? transaction.amount : -transaction.amount;
                await account.save();
            }
        }

        res.status(201).json(transaction);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /transactions/:id - Update existing
router.put('/transactions/:id', async (req, res) => {
    try {
        const oldTransaction = await Transaction.findById(req.params.id);
        if (!oldTransaction) return res.status(404).json({ error: 'Transaction not found' });

        // Reverse old account balance change
        if (oldTransaction.accountId) {
            const account = await Account.findById(oldTransaction.accountId);
            if (account) {
                account.balance -= oldTransaction.type === 'income' ? oldTransaction.amount : -oldTransaction.amount;
                await account.save();
            }
        }

        const transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });

        // Apply new account balance change
        if (transaction.accountId) {
            const account = await Account.findById(transaction.accountId);
            if (account) {
                account.balance += transaction.type === 'income' ? transaction.amount : -transaction.amount;
                await account.save();
            }
        }

        res.json(transaction);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /transactions/:id - Delete
router.delete('/transactions/:id', async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        // Reverse account balance change
        if (transaction.accountId) {
            const account = await Account.findById(transaction.accountId);
            if (account) {
                account.balance -= transaction.type === 'income' ? transaction.amount : -transaction.amount;
                await account.save();
            }
        }

        await Transaction.findByIdAndDelete(req.params.id);
        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /transactions/bulk-delete - Bulk delete
router.post('/transactions/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        await Transaction.deleteMany({ _id: { $in: ids } });
        res.json({ message: `${ids.length} transactions deleted` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /transactions/summary - Aggregation
router.get('/transactions/summary', async (req, res) => {
    try {
        const { month, year } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const summary = await Transaction.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const byCategory = await Transaction.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    type: { $first: '$type' }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const byPaymentMethod = await Transaction.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: '$paymentMethod',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const byDate = await Transaction.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dayOfMonth: '$date' },
                    income: {
                        $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
                    },
                    expense: {
                        $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const income = summary.find(s => s._id === 'income')?.total || 0;
        const expenses = summary.find(s => s._id === 'expense')?.total || 0;

        res.json({
            totalIncome: income,
            totalExpenses: expenses,
            savings: income - expenses,
            savingsRate: income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0,
            byCategory,
            byPaymentMethod,
            byDate
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== BUDGETS =====

// GET /budgets - Find by month+year
router.get('/budgets', async (req, res) => {
    try {
        const { month, year } = req.query;
        const budget = await Budget.findOne({ month: parseInt(month), year: parseInt(year) });
        res.json(budget || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /budgets - Upsert
router.post('/budgets', async (req, res) => {
    try {
        const { month, year, ...data } = req.body;
        const budget = await Budget.findOneAndUpdate(
            { month, year },
            { month, year, ...data },
            { upsert: true, new: true }
        );
        res.json(budget);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /budgets/copy - Copy from source month
router.post('/budgets/copy', async (req, res) => {
    try {
        const { fromMonth, fromYear, toMonth, toYear } = req.body;
        const sourceBudget = await Budget.findOne({ month: fromMonth, year: fromYear });
        if (!sourceBudget) return res.status(404).json({ error: 'Source budget not found' });

        const newBudget = await Budget.findOneAndUpdate(
            { month: toMonth, year: toYear },
            {
                month: toMonth,
                year: toYear,
                totalBudget: sourceBudget.totalBudget,
                categories: sourceBudget.categories
            },
            { upsert: true, new: true }
        );
        res.json(newBudget);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /budgets/performance - Budget vs actual
router.get('/budgets/performance', async (req, res) => {
    try {
        const { month, year } = req.query;
        const budget = await Budget.findOne({ month: parseInt(month), year: parseInt(year) });
        if (!budget) return res.json(null);

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const spending = await Transaction.aggregate([
            {
                $match: {
                    type: 'expense',
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$category',
                    spent: { $sum: '$amount' }
                }
            }
        ]);

        const performance = budget.categories.map(cat => {
            const spent = spending.find(s => s._id === cat.name)?.spent || 0;
            return {
                name: cat.name,
                allocated: cat.allocated,
                spent,
                remaining: cat.allocated - spent,
                percentage: cat.allocated > 0 ? (spent / cat.allocated * 100).toFixed(1) : 0
            };
        });

        res.json({
            totalBudget: budget.totalBudget,
            totalSpent: spending.reduce((sum, s) => sum + s.spent, 0),
            categories: performance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== BILLS =====

// GET /bills - All active bills
router.get('/bills', async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = { isActive: true };

        // Filter one-time bills by month and year if provided
        if (month && year) {
            query.$or = [
                { type: 'recurring' },
                { type: 'one-time', month: parseInt(month), year: parseInt(year) }
            ];
        }

        const bills = await Bill.find(query).sort({ dueDay: 1 });
        res.json(bills);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /bills - Create new bill
router.post('/bills', async (req, res) => {
    try {
        const bill = new Bill(req.body);
        await bill.save();
        res.status(201).json(bill);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /bills/:id - Update bill
router.put('/bills/:id', async (req, res) => {
    try {
        const bill = await Bill.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!bill) return res.status(404).json({ error: 'Bill not found' });
        res.json(bill);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /bills/:id - Delete bill
router.delete('/bills/:id', async (req, res) => {
    try {
        await Bill.findByIdAndDelete(req.params.id);
        res.json({ message: 'Bill deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /bills/status - Bills with payment status for month
router.get('/bills/status', async (req, res) => {
    try {
        const { month, year } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Find bills that are either recurring or one-time bills for this month
        const bills = await Bill.find({
            isActive: true,
            $or: [
                { type: 'recurring' },
                { type: 'one-time', month: parseInt(month), year: parseInt(year) }
            ]
        });

        const paidBills = await Transaction.find({
            billId: { $ne: null },
            date: { $gte: startDate, $lte: endDate }
        }).distinct('billId');

        const today = new Date();
        const billsWithStatus = bills.map(bill => {
            const dueDate = new Date(year, month - 1, bill.dueDay);
            let status = 'pending';
            if (paidBills.some(id => id.toString() === bill._id.toString())) {
                status = 'paid';
            } else if (dueDate < today) {
                status = 'overdue';
            }
            return { ...bill.toObject(), status, dueDate };
        });

        res.json(billsWithStatus);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /bills/:id/pay - Mark bill as paid
router.post('/bills/:id/pay', async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id);
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        const transaction = new Transaction({
            type: 'expense',
            amount: req.body.amount || bill.amount,
            category: bill.category,
            description: `Bill payment - ${bill.name}`,
            date: req.body.date || new Date(),
            paymentMethod: req.body.paymentMethod || 'Cash',
            billId: bill._id
        });

        await transaction.save();

        if (transaction.accountId) {
            const account = await Account.findById(transaction.accountId);
            if (account) {
                account.balance -= transaction.amount;
                await account.save();
            }
        }

        res.json({ transaction, message: 'Bill marked as paid' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /bills/upcoming - Upcoming bills
router.get('/bills/upcoming', async (req, res) => {
    try {
        const { days = 15 } = req.query;
        const bills = await Bill.find({ isActive: true });
        const today = new Date();
        const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

        const upcoming = [];
        bills.forEach(bill => {
            let dueDate = new Date(today.getFullYear(), today.getMonth(), bill.dueDay);
            if (dueDate < today) {
                dueDate.setMonth(dueDate.getMonth() + 1);
            }
            if (dueDate <= futureDate) {
                const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                upcoming.push({ ...bill.toObject(), dueDate, daysLeft });
            }
        });

        upcoming.sort((a, b) => a.dueDate - b.dueDate);
        res.json(upcoming);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== GOALS =====

// GET /goals - All goals
router.get('/goals', async (req, res) => {
    try {
        const goals = await Goal.find().sort({ priority: 1, createdAt: -1 });
        res.json(goals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /goals - Create new goal
router.post('/goals', async (req, res) => {
    try {
        const goal = new Goal(req.body);
        await goal.save();
        res.status(201).json(goal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /goals/:id - Update goal
router.put('/goals/:id', async (req, res) => {
    try {
        const goal = await Goal.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!goal) return res.status(404).json({ error: 'Goal not found' });
        res.json(goal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /goals/:id - Delete goal
router.delete('/goals/:id', async (req, res) => {
    try {
        await Goal.findByIdAndDelete(req.params.id);
        res.json({ message: 'Goal deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /goals/:id/contribute - Add contribution
router.post('/goals/:id/contribute', async (req, res) => {
    try {
        const goal = await Goal.findById(req.params.id);
        if (!goal) return res.status(404).json({ error: 'Goal not found' });

        goal.contributions.push({
            amount: req.body.amount,
            note: req.body.note || ''
        });
        goal.currentAmount += req.body.amount;

        if (goal.currentAmount >= goal.targetAmount) {
            goal.isCompleted = true;
        }

        await goal.save();
        res.json(goal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /goals/summary - Goals summary
router.get('/goals/summary', async (req, res) => {
    try {
        const goals = await Goal.find();
        const activeGoals = goals.filter(g => !g.isCompleted);
        const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
        const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);

        res.json({
            totalSaved,
            totalRemaining: totalTarget - totalSaved,
            activeCount: activeGoals.length,
            completedCount: goals.length - activeGoals.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== ACCOUNTS =====

// GET /accounts - All accounts
router.get('/accounts', async (req, res) => {
    try {
        const { month, year } = req.query;
        const accounts = await Account.find().sort({ type: 1, name: 1 });

        // Get pending bills for credit cards if month/year provided
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            // Get all one-time bills for credit cards in this month
            const bills = await Bill.find({
                accountId: { $in: accounts.filter(a => a.type === 'credit_card').map(a => a._id) },
                type: 'one-time',
                month: parseInt(month),
                year: parseInt(year)
            });

            // Get paid bills by checking transactions
            const paidBills = await Transaction.find({
                billId: { $ne: null },
                date: { $gte: startDate, $lte: endDate }
            }).distinct('billId');

            const paidBillIds = new Set(paidBills.map(id => id.toString()));

            // Add pending bills to accounts
            accounts.forEach(account => {
                if (account.type === 'credit_card') {
                    const accountBills = bills.filter(b =>
                        b.accountId.toString() === account._id.toString() &&
                        !paidBillIds.has(b._id.toString())
                    );
                    account.pendingBills = accountBills;
                    account.pendingAmount = accountBills.reduce((sum, b) => sum + b.amount, 0);
                }
            });
        }

        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /accounts - Create account
router.post('/accounts', async (req, res) => {
    try {
        const account = new Account(req.body);
        await account.save();
        res.status(201).json(account);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /accounts/:id - Update account
router.put('/accounts/:id', async (req, res) => {
    try {
        const account = await Account.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json(account);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /accounts/:id - Delete account
router.delete('/accounts/:id', async (req, res) => {
    try {
        await Account.findByIdAndDelete(req.params.id);
        res.json({ message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /accounts/transfer - Transfer between accounts
router.post('/accounts/transfer', async (req, res) => {
    try {
        const { fromId, toId, amount } = req.body;
        const fromAccount = await Account.findById(fromId);
        const toAccount = await Account.findById(toId);

        if (!fromAccount || !toAccount) {
            return res.status(404).json({ error: 'Account not found' });
        }

        fromAccount.balance -= amount;
        toAccount.balance += amount;

        await fromAccount.save();
        await toAccount.save();

        res.json({ fromAccount, toAccount, message: 'Transfer completed' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /accounts/net-worth - Net worth
router.get('/accounts/net-worth', async (req, res) => {
    try {
        const accounts = await Account.find();
        const netWorth = accounts.reduce((sum, acc) => {
            return sum + (acc.type === 'credit_card' ? -acc.balance : acc.balance);
        }, 0);
        res.json({ netWorth, accounts: accounts.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== REPORTS =====

// GET /reports/monthly - Monthly report
router.get('/reports/monthly', async (req, res) => {
    try {
        const { month, year } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const transactions = await Transaction.find({
            date: { $gte: startDate, $lte: endDate }
        });

        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

        const byCategory = await Transaction.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: '$category', total: { $sum: '$amount' }, type: { $first: '$type' } } },
            { $sort: { total: -1 } }
        ]);

        const byPaymentMethod = await Transaction.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }
        ]);

        const byDate = await Transaction.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dayOfMonth: '$date' },
                    income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
                    expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const topTransactions = await Transaction.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ amount: -1 }).limit(5);

        res.json({
            totalIncome: income,
            totalExpenses: expenses,
            savings: income - expenses,
            savingsRate: income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0,
            byCategory,
            byPaymentMethod,
            byDate,
            topTransactions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /reports/yearly - Yearly report
router.get('/reports/yearly', async (req, res) => {
    try {
        const { year } = req.query;
        const months = [];

        for (let m = 1; m <= 12; m++) {
            const startDate = new Date(year, m - 1, 1);
            const endDate = new Date(year, m, 0, 23, 59, 59);

            const monthData = await Transaction.aggregate([
                { $match: { date: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: '$amount' }
                    }
                }
            ]);

            const income = monthData.find(d => d._id === 'income')?.total || 0;
            const expenses = monthData.find(d => d._id === 'expense')?.total || 0;

            months.push({
                month: m,
                income,
                expenses,
                savings: income - expenses
            });
        }

        const totalIncome = months.reduce((sum, m) => sum + m.income, 0);
        const totalExpenses = months.reduce((sum, m) => sum + m.expenses, 0);

        res.json({
            year: parseInt(year),
            totalIncome,
            totalExpenses,
            totalSavings: totalIncome - totalExpenses,
            months
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /reports/trends - Trends report
router.get('/reports/trends', async (req, res) => {
    try {
        const { months = 12 } = req.query;
        const trends = [];
        const today = new Date();

        for (let i = parseInt(months) - 1; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const monthData = await Transaction.aggregate([
                { $match: { date: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: '$amount' }
                    }
                }
            ]);

            const income = monthData.find(d => d._id === 'income')?.total || 0;
            const expenses = monthData.find(d => d._id === 'expense')?.total || 0;

            trends.push({
                month: date.getMonth() + 1,
                year: date.getFullYear(),
                income,
                expenses,
                savings: income - expenses,
                savingsRate: income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0
            });
        }

        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /reports/category/:category - Category deep dive
router.get('/reports/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { months = 6 } = req.query;
        const today = new Date();
        const monthly = [];

        for (let i = parseInt(months) - 1; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const total = await Transaction.aggregate([
                { $match: { category, date: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            monthly.push({
                month: date.getMonth() + 1,
                year: date.getFullYear(),
                total: total[0]?.total || 0
            });
        }

        const transactions = await Transaction.find({ category }).sort({ date: -1 }).limit(20);

        res.json({ category, monthly, transactions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== SETTINGS =====

// GET /settings - Get settings
router.get('/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /settings - Update settings
router.put('/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create(req.body);
        } else {
            settings = await Settings.findOneAndUpdate({}, req.body, { new: true });
        }
        res.json(settings);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /data/export - Export all data
router.post('/data/export', async (req, res) => {
    try {
        const data = {
            transactions: await Transaction.find(),
            budgets: await Budget.find(),
            bills: await Bill.find(),
            goals: await Goal.find(),
            accounts: await Account.find(),
            settings: await Settings.find(),
            exportDate: new Date().toISOString()
        };
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /data/import - Import data
router.post('/data/import', async (req, res) => {
    try {
        const { transactions, budgets, bills, goals, accounts, settings } = req.body;

        await Transaction.deleteMany({});
        await Budget.deleteMany({});
        await Bill.deleteMany({});
        await Goal.deleteMany({});
        await Account.deleteMany({});
        await Settings.deleteMany({});

        if (transactions?.length) await Transaction.insertMany(transactions);
        if (budgets?.length) await Budget.insertMany(budgets);
        if (bills?.length) await Bill.insertMany(bills);
        if (goals?.length) await Goal.insertMany(goals);
        if (accounts?.length) await Account.insertMany(accounts);
        if (settings?.length) await Settings.insertMany(settings);

        res.json({ message: 'Data imported successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /data/clear - Clear all data
router.delete('/data/clear', async (req, res) => {
    try {
        await Transaction.deleteMany({});
        await Budget.deleteMany({});
        await Bill.deleteMany({});
        await Goal.deleteMany({});
        await Account.deleteMany({});
        await Settings.deleteMany({});
        res.json({ message: 'All data cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    totalBudget: { type: Number, required: true },
    categories: [{
        name: { type: String, required: true },
        allocated: { type: Number, required: true }
    }]
}, { timestamps: true });

budgetSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('FinanceBudget', budgetSchema);

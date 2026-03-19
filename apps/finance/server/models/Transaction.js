const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    paymentMethod: { type: String, default: '' },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceAccount' },
    tags: [String],
    billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: String
}, { timestamps: true });

transactionSchema.index({ date: -1 });
transactionSchema.index({ type: 1, date: -1 });
transactionSchema.index({ category: 1 });

module.exports = mongoose.model('FinanceTransaction', transactionSchema);

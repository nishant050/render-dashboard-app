const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['bank', 'cash', 'credit_card', 'wallet', 'investment'], required: true },
    balance: { type: Number, required: true },
    icon: { type: String, default: '🏦' }
}, { timestamps: true });

accountSchema.index({ type: 1 });

module.exports = mongoose.model('FinanceAccount', accountSchema);

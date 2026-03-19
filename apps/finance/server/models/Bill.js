const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    dueDay: { type: Number, required: true, min: 1, max: 31 },
    isRecurring: { type: Boolean, default: true },
    type: { type: String, enum: ['recurring', 'one-time'], default: 'recurring' },
    frequency: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
    autoPay: { type: Boolean, default: false },
    remindDaysBefore: { type: Number, default: 3 },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    month: { type: Number, min: 1, max: 12 },
    year: { type: Number },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }
}, { timestamps: true });

billSchema.index({ dueDay: 1 });
billSchema.index({ isActive: 1 });
billSchema.index({ month: 1, year: 1 });
billSchema.index({ accountId: 1, month: 1, year: 1 });

module.exports = mongoose.model('Bill', billSchema);

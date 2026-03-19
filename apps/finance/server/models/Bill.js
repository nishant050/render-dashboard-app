const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    dueDay: { type: Number, required: true, min: 1, max: 31 },
    isRecurring: { type: Boolean, default: true },
    frequency: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
    autoPay: { type: Boolean, default: false },
    remindDaysBefore: { type: Number, default: 3 },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

billSchema.index({ dueDay: 1 });
billSchema.index({ isActive: 1 });

module.exports = mongoose.model('Bill', billSchema);

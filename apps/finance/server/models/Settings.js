const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
    dateFormat: { type: String, enum: ['DD/MM/YYYY', 'DD MMM YYYY'], default: 'DD/MM/YYYY' },
    showDecimals: { type: Boolean, default: true },
    defaultPaymentMethod: { type: String, default: 'Cash' },
    currency: { type: String, default: 'INR' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);

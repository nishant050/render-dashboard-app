const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    targetDate: { type: Date, default: null },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    icon: { type: String, default: '🎯' },
    notes: { type: String, default: '' },
    isCompleted: { type: Boolean, default: false },
    contributions: [{
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        note: { type: String, default: '' }
    }]
}, { timestamps: true });

goalSchema.index({ priority: 1 });
goalSchema.index({ isCompleted: 1 });

module.exports = mongoose.model('Goal', goalSchema);

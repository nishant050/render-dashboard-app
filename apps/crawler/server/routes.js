const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const CrawlerTask = mongoose.model('CrawlerTask');
const CrawlerRun = mongoose.model('CrawlerRun');

// --- Crawler API Endpoints ---

// Get all tasks
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await CrawlerTask.find().sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new task
router.post('/tasks', async (req, res) => {
    try {
        const task = new CrawlerTask(req.body);
        await task.save();
        res.status(201).json(task);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update task
router.put('/tasks/:id', async (req, res) => {
    try {
        const task = await CrawlerTask.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete task
router.delete('/tasks/:id', async (req, res) => {
    try {
        const task = await CrawlerTask.findByIdAndDelete(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        // Optionally delete runs too
        await CrawlerRun.deleteMany({ taskId: req.params.id });
        res.json({ message: 'Task deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get runs for task
router.get('/runs/:taskId', async (req, res) => {
    try {
        const runs = await CrawlerRun.find({ taskId: req.params.taskId })
            .sort({ startTime: -1 })
            .limit(50);
        res.json(runs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single run
router.get('/runs/detail/:id', async (req, res) => {
    try {
        const run = await CrawlerRun.findById(req.params.id);
        if (!run) return res.status(404).json({ error: 'Run not found' });
        res.json(run);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Storage API Endpoints ---
const fs = require('fs');
const path = require('path');
const util = require('util');

// Get storage usage
router.get('/storage/info', async (req, res) => {
    try {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'crawler');
        let totalSizeBytes = 0;
        let fileCount = 0;

        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            for (const file of files) {
                const stat = fs.statSync(path.join(uploadsDir, file));
                totalSizeBytes += stat.size;
                fileCount++;
            }
        }
        res.json({ totalSizeBytes, fileCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear storage
router.delete('/storage/clear', async (req, res) => {
    try {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'crawler');
        let deletedCount = 0;

        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            for (const file of files) {
                fs.unlinkSync(path.join(uploadsDir, file));
                deletedCount++;
            }
        }
        
        // Remove attachment references from CrawlerRun documents
        await CrawlerRun.updateMany({}, { $set: { attachments: [] } });

        res.json({ message: 'Storage cleared successfully', deletedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

const os = require('os');
const fs = require('fs');
const express = require('express');

const router = express.Router();

// --- State & History ---
const HISTORY_LIMIT = 60; // 60 seconds history
const history = {
    timestamps: [],
    cpu: [],
    ram: []
};

let previousCpuTimes = null;
let currentCpuUsage = 0;
let httpServer = null;

// Active users map: key = `${ip}_${userAgentHash}` -> user details
const activeUsers = new Map();
const USER_EXPIRY_MS = 3 * 60 * 1000; // 3 minutes without request = expired
const ACTIVE_THRESHOLD_MS = 30 * 1000; // 30 seconds = live active

let totalRequestsCounter = 0;

// --- Helper Functions ---

function getCpuTimes() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
        for (const type in cpu.times) {
            total += cpu.times[type];
        }
        idle += cpu.times.idle;
    }
    return { idle, total, count: cpus.length, model: cpus[0]?.model || 'Unknown CPU', speed: cpus[0]?.speed || 0 };
}

function calculateCpuUsage() {
    const current = getCpuTimes();
    if (previousCpuTimes) {
        const idleDiff = current.idle - previousCpuTimes.idle;
        const totalDiff = current.total - previousCpuTimes.total;
        if (totalDiff > 0) {
            currentCpuUsage = Math.max(0, Math.min(100, (1 - idleDiff / totalDiff) * 100));
        }
    }
    previousCpuTimes = current;
    return {
        percent: Number(currentCpuUsage.toFixed(1)),
        cores: current.count,
        model: current.model,
        speedMhz: current.speed
    };
}

// Initial CPU read
previousCpuTimes = getCpuTimes();

function parseUserAgent(ua = '') {
    let browser = 'Unknown Browser';
    let osName = 'Unknown OS';
    let device = 'Desktop';

    // Device check
    if (/mobile/i.test(ua)) device = 'Mobile';
    else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

    // OS check
    if (/windows nt 10\.0/i.test(ua)) osName = 'Windows 10/11';
    else if (/windows/i.test(ua)) osName = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) osName = 'macOS';
    else if (/iphone|ipad|ipod/i.test(ua)) osName = 'iOS';
    else if (/android/i.test(ua)) osName = 'Android';
    else if (/linux/i.test(ua)) osName = 'Linux';

    // Browser check
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
    else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/firefox\//i.test(ua)) browser = 'Firefox';
    else if (/curl|axios|python|postman|node-fetch/i.test(ua)) browser = 'API / Bot';

    return { browser, os: osName, device };
}

function resolveAppName(pathname = '') {
    const p = pathname.toLowerCase();
    if (p === '/' || p === '/index.html') return 'Dashboard';
    if (p.startsWith('/apps/jupyter') || p.startsWith('/jupyter')) return 'Jupyter Lab';
    if (p.startsWith('/apps/filehub') || p.startsWith('/api/files')) return 'File Hub';
    if (p.startsWith('/dietplan')) return 'Diet Plan';
    if (p.startsWith('/finance') || p.startsWith('/apps/finance')) return 'Finance Tracker';
    if (p.startsWith('/apps/newshunt') || p.startsWith('/api/newshunt')) return 'NewsHunt';
    if (p.startsWith('/apps/crawler') || p.startsWith('/api/crawler')) return 'Crawler Engine';
    if (p.startsWith('/apps/investing-lab')) return 'Investing Lab';
    if (p.startsWith('/apps/learn-investing')) return 'Learn Investing';
    if (p.startsWith('/apps/quicknotes') || p.startsWith('/api/quicknotes')) return 'Quick Notes';
    if (p.startsWith('/apps/hosthtml') || p.startsWith('/p/')) return 'Host HTML';
    if (p.startsWith('/apps/proxybrowser') || p.startsWith('/api/proxy')) return 'Proxy Browser';
    if (p.startsWith('/apps/apitest')) return 'API Test Hub';
    if (p.startsWith('/apps/fretboard-trainer')) return 'Fretboard Trainer';
    if (p.startsWith('/apps/monitor') || p.startsWith('/api/monitor')) return 'Server Monitor';
    if (p.startsWith('/apps/vestibular-migraine')) return 'Vestibular Migraine';
    return p.length > 25 ? p.substring(0, 25) + '...' : p;
}

function getDiskMetrics() {
    return new Promise((resolve) => {
        if (typeof fs.statfs !== 'function') {
            return resolve({ totalGB: 0, usedGB: 0, freeGB: 0, percent: 0 });
        }
        fs.statfs('.', (err, stats) => {
            if (err || !stats) {
                return resolve({ totalGB: 0, usedGB: 0, freeGB: 0, percent: 0 });
            }
            const bsize = stats.bsize || 4096;
            const totalBytes = bsize * stats.blocks;
            const freeBytes = bsize * stats.bavail;
            const usedBytes = Math.max(0, totalBytes - freeBytes);
            const percent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

            resolve({
                totalGB: Number((totalBytes / (1024 ** 3)).toFixed(2)),
                usedGB: Number((usedBytes / (1024 ** 3)).toFixed(2)),
                freeGB: Number((freeBytes / (1024 ** 3)).toFixed(2)),
                percent: Number(percent.toFixed(1))
            });
        });
    });
}

function getTcpConnections() {
    return new Promise((resolve) => {
        if (!httpServer || typeof httpServer.getConnections !== 'function') {
            return resolve(0);
        }
        httpServer.getConnections((err, count) => {
            if (err) resolve(0);
            else resolve(count || 0);
        });
    });
}

function pruneStaleUsers() {
    const now = Date.now();
    for (const [key, user] of activeUsers.entries()) {
        if (now - user.lastActive > USER_EXPIRY_MS) {
            activeUsers.delete(key);
        }
    }
}

async function collectMetrics() {
    pruneStaleUsers();

    // CPU
    const cpuInfo = calculateCpuUsage();

    // RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = (usedMem / totalMem) * 100;
    const memUsage = process.memoryUsage();

    // Disk
    const diskInfo = await getDiskMetrics();

    // TCP Connections
    const tcpCount = await getTcpConnections();

    // Format active users
    const now = Date.now();
    const usersList = [];
    for (const [id, u] of activeUsers.entries()) {
        const inactiveMs = now - u.lastActive;
        usersList.push({
            id,
            ip: u.ip,
            browser: u.browser,
            os: u.os,
            device: u.device,
            currentApp: u.currentApp,
            path: u.path,
            firstSeen: u.firstSeen,
            lastActive: u.lastActive,
            durationSeconds: Math.round((now - u.firstSeen) / 1000),
            requestsCount: u.requestsCount,
            isLive: inactiveMs < ACTIVE_THRESHOLD_MS
        });
    }

    // Sort: live first, then most recently active
    usersList.sort((a, b) => b.lastActive - a.lastActive);

    // Update historical buffer
    const timestampLabel = new Date().toLocaleTimeString('en-US', { hour12: false });
    history.timestamps.push(timestampLabel);
    history.cpu.push(cpuInfo.percent);
    history.ram.push(Number(ramPercent.toFixed(1)));

    if (history.timestamps.length > HISTORY_LIMIT) {
        history.timestamps.shift();
        history.cpu.shift();
        history.ram.shift();
    }

    return {
        timestamp: Date.now(),
        cpu: cpuInfo,
        ram: {
            totalGB: Number((totalMem / (1024 ** 3)).toFixed(2)),
            usedGB: Number((usedMem / (1024 ** 3)).toFixed(2)),
            freeGB: Number((freeMem / (1024 ** 3)).toFixed(2)),
            percent: Number(ramPercent.toFixed(1)),
            processRssMB: Number((memUsage.rss / (1024 ** 2)).toFixed(1)),
            heapUsedMB: Number((memUsage.heapUsed / (1024 ** 2)).toFixed(1)),
            heapTotalMB: Number((memUsage.heapTotal / (1024 ** 2)).toFixed(1))
        },
        disk: diskInfo,
        traffic: {
            activeConnections: tcpCount,
            activeUsersCount: usersList.filter(u => u.isLive).length,
            totalActiveSessions: usersList.length,
            totalRequests: totalRequestsCounter
        },
        activeUsers: usersList,
        system: {
            platform: os.platform(),
            release: os.release(),
            hostname: os.hostname(),
            arch: os.arch(),
            nodeVersion: process.version,
            pid: process.pid,
            uptimeSeconds: Math.floor(os.uptime()),
            processUptimeSeconds: Math.floor(process.uptime()),
            loadAvg: os.loadavg ? os.loadavg().map(v => Number(v.toFixed(2))) : [0, 0, 0]
        },
        history
    };
}

// Background ticker to record history even if no client is actively polling
setInterval(async () => {
    try {
        calculateCpuUsage();
        pruneStaleUsers();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const ramPercent = ((totalMem - freeMem) / totalMem) * 100;
        const timestampLabel = new Date().toLocaleTimeString('en-US', { hour12: false });

        history.timestamps.push(timestampLabel);
        history.cpu.push(Number(currentCpuUsage.toFixed(1)));
        history.ram.push(Number(ramPercent.toFixed(1)));

        if (history.timestamps.length > HISTORY_LIMIT) {
            history.timestamps.shift();
            history.cpu.shift();
            history.ram.shift();
        }
    } catch {}
}, 2000);

// --- Traffic Tracking Middleware ---
function trackingMiddleware() {
    return (req, res, next) => {
        // Skip noise: don't track monitoring SSE stream or static fonts/icons requests as separate user page hits
        const path = req.path || '';
        if (path.startsWith('/api/monitor/stream')) {
            return next();
        }

        totalRequestsCounter++;

        // Extract client IP
        const forwarded = req.headers['x-forwarded-for'];
        let ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
        if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';

        const ua = req.headers['user-agent'] || '';
        const userHash = `${ip}_${ua.substring(0, 40)}`;

        const now = Date.now();
        const appName = resolveAppName(path);

        if (activeUsers.has(userHash)) {
            const user = activeUsers.get(userHash);
            user.lastActive = now;
            user.requestsCount++;
            if (!path.includes('.')) { // Prefer real page/API hits over asset files
                user.path = path;
                user.currentApp = appName;
            }
        } else {
            const parsed = parseUserAgent(ua);
            activeUsers.set(userHash, {
                ip,
                ...parsed,
                path,
                currentApp: appName,
                firstSeen: now,
                lastActive: now,
                requestsCount: 1
            });
        }

        next();
    };
}

// --- Routes ---

// REST Metrics
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await collectMetrics();
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Real-time SSE Stream
router.get('/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx / Render)

    // Send initial immediate payload
    try {
        const initial = await collectMetrics();
        res.write(`data: ${JSON.stringify(initial)}\n\n`);
    } catch {}

    // Push every 1000ms
    const interval = setInterval(async () => {
        try {
            const data = await collectMetrics();
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
            console.error('[Monitor] SSE push error:', err.message);
        }
    }, 1000);

    req.on('close', () => {
        clearInterval(interval);
    });
});

module.exports = {
    router,
    middleware: trackingMiddleware,
    setServer: (server) => { httpServer = server; }
};

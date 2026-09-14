// --- DOM Element References ---
const elUptime = document.getElementById('val-uptime');
const elPlatform = document.getElementById('val-platform');
const elConnectionStatus = document.getElementById('connection-status');
const elStatusLabel = document.getElementById('status-label');

// Gauges
const gaugeCpu = document.getElementById('gauge-cpu');
const gaugeRam = document.getElementById('gauge-ram');
const gaugeDisk = document.getElementById('gauge-disk');

// Metric Values
const elValCpu = document.getElementById('val-cpu');
const elCpuCores = document.getElementById('val-cpu-cores');
const elCpuSpeed = document.getElementById('val-cpu-speed');
const elCpuModel = document.getElementById('val-cpu-model');

const elValRam = document.getElementById('val-ram');
const elRamUsedTotal = document.getElementById('val-ram-used-total');
const elRamFree = document.getElementById('val-ram-free');
const elProcessHeap = document.getElementById('val-process-heap');

const elValDisk = document.getElementById('val-disk');
const elDiskUsed = document.getElementById('val-disk-used');
const elDiskFree = document.getElementById('val-disk-free');
const elDiskTotal = document.getElementById('val-disk-total');

const elLiveUsers = document.getElementById('val-live-users');
const elTcpConn = document.getElementById('val-tcp-conn');
const elTotalSessions = document.getElementById('val-total-sessions');
const elTotalRequests = document.getElementById('val-total-requests');

// Chart & Legend
const legendCpuVal = document.getElementById('legend-cpu-val');
const legendRamVal = document.getElementById('legend-ram-val');
const canvas = document.getElementById('timelineChart');
const ctx = canvas ? canvas.getContext('2d') : null;

// Table
const usersTableBody = document.getElementById('users-table-body');
const badgeUsersCount = document.getElementById('badge-users-count');
const toggleMaskIp = document.getElementById('toggle-mask-ip');

// System details
const elHostname = document.getElementById('val-hostname');
const elRelease = document.getElementById('val-release');
const elArch = document.getElementById('val-arch');
const elLoadAvg = document.getElementById('val-loadavg');
const elNodeVer = document.getElementById('val-node-ver');
const elPid = document.getElementById('val-pid');
const elRss = document.getElementById('val-rss');
const elHeapTotal = document.getElementById('val-heap-total');

// Circumference of circle with r=42 is ~264
const GAUGE_CIRCUMFERENCE = 264;

let sseSource = null;
let reconnectTimer = null;
let currentHistory = { cpu: [], ram: [], timestamps: [] };

// --- Formatting Helpers ---

function setGauge(circle, percent) {
    if (!circle) return;
    const clamped = Math.max(0, Math.min(100, percent || 0));
    const offset = GAUGE_CIRCUMFERENCE - (clamped / 100) * GAUGE_CIRCUMFERENCE;
    circle.style.strokeDashoffset = offset;
}

function formatUptime(totalSeconds) {
    if (!totalSeconds || totalSeconds < 0) return '00:00:00';
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (days > 0) {
        return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

function formatRelativeTime(timestamp) {
    const diffSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (diffSec < 4) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

function maskIpAddress(ip = '') {
    if (!toggleMaskIp || !toggleMaskIp.checked) return ip;
    if (ip === '127.0.0.1' || ip === 'localhost') return ip;
    // IPv4: mask last octet
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
    // IPv6 or others: mask last segment
    if (ip.includes(':')) {
        const v6 = ip.split(':');
        v6[v6.length - 1] = 'xxxx';
        return v6.join(':');
    }
    return ip;
}

function getDeviceIcon(device = '') {
    if (device === 'Mobile') return '📱';
    if (device === 'Tablet') return '📟';
    return '💻';
}

// --- Canvas Chart Engine ---

function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    if (ctx) ctx.scale(dpr, dpr);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawChart(history) {
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 15, bottom: 25, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Draw horizontal grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const gridSteps = [0, 25, 50, 75, 100];
    for (const step of gridSteps) {
        const y = padding.top + chartHeight - (step / 100) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
        ctx.fillText(`${step}%`, padding.left - 6, y);
    }

    const cpuData = history.cpu || [];
    const ramData = history.ram || [];
    const count = Math.max(cpuData.length, 2);

    function drawLine(data, strokeColor, fillColor) {
        if (data.length < 2) return;

        const getX = (i) => padding.left + (i / (count - 1)) * chartWidth;
        const getY = (val) => padding.top + chartHeight - (Math.max(0, Math.min(100, val)) / 100) * chartHeight;

        // Gradient Fill
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(data[0]));
        for (let i = 1; i < data.length; i++) {
            ctx.lineTo(getX(i), getY(data[i]));
        }
        ctx.lineTo(getX(data.length - 1), padding.top + chartHeight);
        ctx.lineTo(getX(0), padding.top + chartHeight);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Stroke Line
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(data[0]));
        for (let i = 1; i < data.length; i++) {
            ctx.lineTo(getX(i), getY(data[i]));
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // Gradient fills
    const cpuGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    cpuGradient.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    cpuGradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    const ramGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    ramGradient.addColorStop(0, 'rgba(168, 85, 247, 0.25)');
    ramGradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

    // Draw RAM (purple) first, then CPU (cyan) on top
    drawLine(ramData, '#a855f7', ramGradient);
    drawLine(cpuData, '#06b6d4', cpuGradient);
}

// --- Active Users Table Rendering ---

function renderUsersTable(users = []) {
    if (!usersTableBody) return;

    badgeUsersCount.textContent = `${users.length} Connected`;

    if (users.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">No active client sessions recorded yet. Activity will appear live.</td>
            </tr>
        `;
        return;
    }

    usersTableBody.innerHTML = users.map(u => {
        const statusClass = u.isLive ? 'user-status--live' : 'user-status--idle';
        const statusText = u.isLive ? '🟢 Live' : '🟡 Idle';
        const deviceIcon = getDeviceIcon(u.device);
        const displayIp = maskIpAddress(u.ip);
        const sessionMins = Math.floor(u.durationSeconds / 60);
        const sessionSecs = u.durationSeconds % 60;
        const sessionStr = sessionMins > 0 ? `${sessionMins}m ${sessionSecs}s` : `${sessionSecs}s`;

        return `
            <tr>
                <td><span class="user-status-pill ${statusClass}">${statusText}</span></td>
                <td><span class="ip-tag">${displayIp}</span></td>
                <td><span>${deviceIcon} ${u.os}</span></td>
                <td><span>${u.browser}</span></td>
                <td>
                    <div class="app-tag">${u.currentApp}</div>
                    <div class="path-sub">${u.path}</div>
                </td>
                <td><strong>${u.requestsCount}</strong></td>
                <td><span>${sessionStr}</span></td>
                <td><span>${formatRelativeTime(u.lastActive)}</span></td>
            </tr>
        `;
    }).join('');
}

// Toggle IP masking dynamically
if (toggleMaskIp) {
    toggleMaskIp.addEventListener('change', () => {
        if (window.lastMetricsData) {
            renderUsersTable(window.lastMetricsData.activeUsers || []);
        }
    });
}

// --- Update UI with Metrics ---

function updateUI(data) {
    if (!data) return;
    window.lastMetricsData = data;

    // Status & Uptime
    elConnectionStatus.className = 'connection-status status-connected';
    elStatusLabel.textContent = 'Live Stream (1s)';

    if (data.system) {
        elUptime.textContent = formatUptime(data.system.processUptimeSeconds);
        elPlatform.textContent = `${data.system.platform} (${data.system.arch})`;
        elHostname.textContent = data.system.hostname;
        elRelease.textContent = data.system.release;
        elArch.textContent = data.system.arch;
        elNodeVer.textContent = data.system.nodeVersion || '-';
        elPid.textContent = data.system.pid || '-';
        if (data.system.loadAvg) {
            elLoadAvg.textContent = data.system.loadAvg.join(', ');
        }
    }

    // CPU
    if (data.cpu) {
        elValCpu.textContent = Math.round(data.cpu.percent);
        setGauge(gaugeCpu, data.cpu.percent);
        elCpuCores.textContent = `${data.cpu.cores} Cores`;
        elCpuSpeed.textContent = `${data.cpu.speedMhz} MHz`;
        elCpuModel.textContent = data.cpu.model;
        legendCpuVal.textContent = `${data.cpu.percent}%`;
    }

    // RAM
    if (data.ram) {
        elValRam.textContent = Math.round(data.ram.percent);
        setGauge(gaugeRam, data.ram.percent);
        elRamUsedTotal.textContent = `${data.ram.usedGB} / ${data.ram.totalGB} GB`;
        elRamFree.textContent = `${data.ram.freeGB} GB`;
        elProcessHeap.textContent = `${data.ram.heapUsedMB} MB`;
        elRss.textContent = `${data.ram.processRssMB} MB`;
        elHeapTotal.textContent = `${data.ram.heapTotalMB} MB`;
        legendRamVal.textContent = `${data.ram.percent}%`;
    }

    // Disk
    if (data.disk) {
        elValDisk.textContent = Math.round(data.disk.percent);
        setGauge(gaugeDisk, data.disk.percent);
        elDiskUsed.textContent = `${data.disk.usedGB} GB`;
        elDiskFree.textContent = `${data.disk.freeGB} GB`;
        elDiskTotal.textContent = `${data.disk.totalGB} GB`;
    }

    // Traffic & Users
    if (data.traffic) {
        elLiveUsers.textContent = data.traffic.activeUsersCount;
        elTcpConn.textContent = data.traffic.activeConnections;
        elTotalSessions.textContent = data.traffic.totalActiveSessions;
        elTotalRequests.textContent = data.traffic.totalRequests.toLocaleString();
    }

    // Users table
    renderUsersTable(data.activeUsers || []);

    // Timeline Chart
    if (data.history) {
        currentHistory = data.history;
        drawChart(currentHistory);
    }
}

// --- SSE Streaming Connection ---

function connectSSE() {
    if (sseSource) {
        sseSource.close();
    }

    sseSource = new EventSource('/api/monitor/stream');

    sseSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            updateUI(data);
        } catch (err) {
            console.error('[Monitor SSE] Error parsing payload:', err);
        }
    };

    sseSource.onerror = () => {
        elConnectionStatus.className = 'connection-status status-disconnected';
        elStatusLabel.textContent = 'Reconnecting...';
        sseSource.close();

        // Fallback polling while reconnecting
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connectSSE();
            }, 3000);
        }
    };
}

// Initial fetch & SSE start
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/monitor/metrics')
        .then(r => r.json())
        .then(updateUI)
        .catch(() => {});

    connectSSE();
});

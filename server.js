const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const os = require('os');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const AdmZip = require('adm-zip');
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

// --- MongoDB Configuration ---
const MONGO_URI = 'mongodb://admin:admin123@ac-wnbtpbs-shard-00-00.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-01.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-02.42f6xm7.mongodb.net:27017/render-dashboard?ssl=true&replicaSet=atlas-usm1o0-shard-0&authSource=admin&retryWrites=true&w=majority&appName=diet-plan';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB (render-dashboard)'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Schemas & Models ---

// NewsHunt
const newsHuntSchema = new mongoose.Schema({
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    feeds: { type: [mongoose.Schema.Types.Mixed], default: [] },
    articles: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    chatHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
    articleContent: { type: Map, of: String, default: {} }
}, { timestamps: true });
const NewsHuntData = mongoose.model('NewsHuntData', newsHuntSchema);

// QuickNotes
const quickNoteSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    color: { type: String, default: 'linen' },
    pinned: { type: Boolean, default: false },
    isEncrypted: { type: Boolean, default: false }
}, { timestamps: true });
const QuickNote = mongoose.model('QuickNote', quickNoteSchema);

const learnInvestingSchema = new mongoose.Schema({
    profiles: { type: mongoose.Schema.Types.Mixed, default: {} },
    currentProfileId: { type: String, default: null }
}, { timestamps: true });
const LearnInvestingState = mongoose.model('LearnInvestingState', learnInvestingSchema);

const investingLabSchema = new mongoose.Schema({
    profiles: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
const InvestingLabState = mongoose.model('InvestingLabState', investingLabSchema);

const fretboardTrainerSchema = new mongoose.Schema({
    progress: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
const FretboardTrainerState = mongoose.model('FretboardTrainerState', fretboardTrainerSchema);

const fileHubEntrySchema = new mongoose.Schema({
    path: { type: String, required: true, unique: true },
    parentPath: { type: String, default: '' },
    name: { type: String, required: true },
    isDirectory: { type: Boolean, default: false },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    storageType: { type: String, enum: ['gridfs', 'inline'], default: 'inline' },
    gridFsFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    content: { type: Buffer, default: null }
}, { timestamps: true });
const FileHubEntry = mongoose.model('FileHubEntry', fileHubEntrySchema);

// Host HTML App
const hostedHtmlSchema = new mongoose.Schema({
    path: { type: String, required: true, unique: true, match: /^[a-zA-Z0-9_-]{1,50}$/ },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    views: { type: Number, default: 0 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
hostedHtmlSchema.index({ path: 1 }, { unique: true });
const HostedHtml = mongoose.model('HostedHtml', hostedHtmlSchema);

// Crawler App
const crawlerTaskSchema = new mongoose.Schema({
    name: { type: String, required: true },
    startUrls: { type: [String], default: [] },
    goal: { type: String, required: true },
    frequencyMinutes: { type: Number, required: true, default: 60 * 24 }, // Daily default
    nextRunAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    primaryModel: { type: String, default: 'groq' }, // Reference provider ID (e.g. 'groq', 'gemini')
    fallbackModel: { type: String, default: 'gemini' }
}, { timestamps: true });
const CrawlerTask = mongoose.model('CrawlerTask', crawlerTaskSchema);

const crawlerRunSchema = new mongoose.Schema({
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrawlerTask', required: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    status: { type: String, enum: ['running', 'success', 'failed', 'stopped'], default: 'running' },
    finalSummary: { type: String, default: '' },
    visitedUrls: { type: [String], default: [] },
    attachments: [{ 
        name: String, 
        url: String 
    }],
    activityLog: { type: [String], default: [] },
    error: { type: String, default: '' }
}, { timestamps: true });
const CrawlerRun = mongoose.model('CrawlerRun', crawlerRunSchema);

// Dashboard Settings (app enable/disable)
const dashboardSettingsSchema = new mongoose.Schema({
    disabledApps: { type: [String], default: [] }
}, { timestamps: true });
const DashboardSettings = mongoose.model('DashboardSettings', dashboardSettingsSchema);

// --- Dashboard Settings Cache ---
let _disabledAppsCache = new Set();
let _disabledAppsCacheReady = false;

async function loadDashboardSettings() {
    try {
        let doc = await DashboardSettings.findOne({});
        if (!doc) doc = await DashboardSettings.create({ disabledApps: [] });
        _disabledAppsCache = new Set(doc.disabledApps || []);
        _disabledAppsCacheReady = true;
        return doc;
    } catch (e) {
        console.error('Failed to load dashboard settings:', e.message);
        return null;
    }
}

function isAppDisabled(appId) {
    return _disabledAppsCache.has(appId);
}

// Scrape.do API key - set via SCRAPE_DO_API_KEY environment variable
// Default to user-provided key if not set, will fall back to manual links
const SCRAPE_DO_API_KEY = process.env.SCRAPE_DO_API_KEY || '942211ddfd1b40c5aaac053e55d17fb2bacb64a543d';

const app = express();
const PORT = process.env.PORT || 3000;

// --- Finance App Password Protection ---
const FINANCE_PASSWORD_FILE = path.join(__dirname, 'finance-password.json');
const loadFinancePassword = () => {
    try {
        const data = JSON.parse(fs.readFileSync(FINANCE_PASSWORD_FILE, 'utf8'));
        return typeof data.password === 'string' && data.password ? data.password : 'admin123';
    } catch {
        return 'admin123';
    }
};
let FINANCE_PASSWORD = loadFinancePassword();
const financeAuth = new Map(); // sessionId -> true (authenticated)

// Generate a simple session token
const generateSessionToken = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const getCookieValue = (req, name) => {
    const cookies = String(req.headers.cookie || '').split(';');
    for (const cookie of cookies) {
        const [key, ...value] = cookie.trim().split('=');
        if (key === name) return decodeURIComponent(value.join('='));
    }
    return null;
};

const getFinanceSessionToken = (req) => (
    req.headers['x-finance-session'] ||
    req.query.session ||
    getCookieValue(req, 'financeSession')
);

// Finance authentication middleware - protects /finance and /api/finance routes
const requireFinanceAuth = (req, res, next) => {
    const sessionToken = getFinanceSessionToken(req);

    if (financeAuth.has(sessionToken)) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required', code: 'FINANCE_AUTH_REQUIRED' });
    }
};

// Middleware to parse JSON bodies
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// --- DietPlan Proxy & Process Setup ---
const pythonCmd = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
let dietPlanProcess = null;

// DietPlan is launched after DB is ready so we can check if it's disabled
async function startDietPlanIfEnabled() {
    if (isAppDisabled('dietplan')) {
        console.log('[DietPlan] App is disabled — skipping subprocess launch.');
        return;
    }
    dietPlanProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--port', '8005', '--host', '127.0.0.1', '--root-path', '/dietplan'], {
        cwd: path.join(__dirname, 'apps', 'DietPlan'),
        env: process.env
    });
    dietPlanProcess.stdout.on('data', d => console.log(`DietPlan: ${d}`));
    dietPlanProcess.stderr.on('data', d => console.error(`DietPlan Error: ${d}`));
    console.log('[DietPlan] Subprocess started.');
}

app.use('/dietplan', (req, res, next) => {
    if (isAppDisabled('dietplan')) {
        return res.status(503).send('<h2>Diet Plan is currently disabled.</h2><p>Enable it from the dashboard settings.</p>');
    }
    next();
}, createProxyMiddleware({
    target: 'http://127.0.0.1:8005',
    changeOrigin: true,
    pathRewrite: {
        '^/dietplan': ''
    }
}));

// --- Jupyter Lab Process & Proxy Setup ---
const JUPYTER_PORT = process.env.JUPYTER_PORT || 8888;
const JUPYTER_TOKEN = process.env.JUPYTER_TOKEN || 'jupyter-workspace';
const JUPYTER_ROOT_DIR = process.env.JUPYTER_ROOT_DIR || path.resolve(__dirname);

let jupyterProcess = null;
let isJupyterStarting = false;
let isJupyterReady = false;
let jupyterCheckTimer = null;

async function checkJupyterHealth() {
    try {
        const resp = await axios.get(`http://127.0.0.1:${JUPYTER_PORT}/jupyter/api/status?token=${JUPYTER_TOKEN}`, {
            timeout: 2000,
            validateStatus: () => true
        });
        if (resp.status >= 200 && resp.status < 400) {
            isJupyterReady = true;
            isJupyterStarting = false;
            return true;
        }
    } catch {
        // Server not responding yet
    }
    isJupyterReady = false;
    return false;
}

function pollJupyterUntilReady(maxAttempts = 40) {
    if (jupyterCheckTimer) clearInterval(jupyterCheckTimer);
    let attempts = 0;
    jupyterCheckTimer = setInterval(async () => {
        attempts++;
        const ready = await checkJupyterHealth();
        if (ready) {
            console.log(`[Jupyter] Server is live and healthy on port ${JUPYTER_PORT}`);
            clearInterval(jupyterCheckTimer);
            jupyterCheckTimer = null;
        } else if (attempts >= maxAttempts) {
            console.warn('[Jupyter] Health check polling completed (still starting or waiting for connection).');
            isJupyterStarting = false;
            clearInterval(jupyterCheckTimer);
            jupyterCheckTimer = null;
        }
    }, 1500);
}

async function startJupyterIfEnabled() {
    if (isAppDisabled('jupyter')) {
        console.log('[Jupyter] App is disabled — skipping subprocess launch.');
        return;
    }
    if (jupyterProcess) {
        console.log('[Jupyter] Subprocess already running.');
        return;
    }

    isJupyterStarting = true;
    isJupyterReady = false;

    const jupyterArgs = [
        '-m', 'jupyter', 'lab',
        `--port=${JUPYTER_PORT}`,
        '--ip=127.0.0.1',
        '--no-browser',
        '--ServerApp.base_url=/jupyter/',
        `--IdentityProvider.token=${JUPYTER_TOKEN}`,
        `--ServerApp.token=${JUPYTER_TOKEN}`,
        '--ServerApp.allow_origin=*',
        '--ServerApp.disable_check_xsrf=True',
        `--ServerApp.root_dir=${JUPYTER_ROOT_DIR}`,
        '--MappingKernelManager.cull_idle_timeout=0',
        '--ServerApp.shutdown_no_activity_timeout=0'
    ];

    try {
        jupyterProcess = spawn(pythonCmd, jupyterArgs, {
            cwd: JUPYTER_ROOT_DIR,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1'
            }
        });

        jupyterProcess.stdout.on('data', d => {
            const msg = d.toString();
            if (msg.includes('Jupyter Server') && msg.includes('running at')) {
                isJupyterReady = true;
                isJupyterStarting = false;
            }
        });

        jupyterProcess.stderr.on('data', d => {
            const msg = d.toString();
            if (msg.includes('Jupyter Server') && msg.includes('running at')) {
                isJupyterReady = true;
                isJupyterStarting = false;
            }
        });

        jupyterProcess.on('exit', (code, signal) => {
            console.log(`[Jupyter] Process exited (code: ${code}, signal: ${signal})`);
            jupyterProcess = null;
            isJupyterReady = false;
            isJupyterStarting = false;
        });

        console.log(`[Jupyter] Subprocess spawned (PID: ${jupyterProcess.pid}, Port: ${JUPYTER_PORT}, Root: ${JUPYTER_ROOT_DIR})`);
        pollJupyterUntilReady();
    } catch (err) {
        console.error('[Jupyter] Failed to spawn process:', err.message);
        isJupyterStarting = false;
    }
}

function stopJupyter() {
    if (jupyterCheckTimer) {
        clearInterval(jupyterCheckTimer);
        jupyterCheckTimer = null;
    }
    if (jupyterProcess) {
        console.log('[Jupyter] Stopping subprocess...');
        try {
            jupyterProcess.kill('SIGTERM');
        } catch {}
        jupyterProcess = null;
    }
    isJupyterReady = false;
    isJupyterStarting = false;
}

async function restartJupyter() {
    stopJupyter();
    await new Promise(r => setTimeout(r, 1000));
    await startJupyterIfEnabled();
    return { ok: true };
}

// Jupyter Proxy Middleware with WebSockets and frame-protection stripping
const jupyterProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${JUPYTER_PORT}`,
    pathFilter: '/jupyter',
    changeOrigin: true,
    ws: true,
    on: {
        proxyReq: fixRequestBody,
        proxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
        },
        error: (err, req, res) => {
            if (res.writeHead && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                    <body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0e131f;color:#f0f4f8;">
                        <h2>🪐 Jupyter Lab is initializing...</h2>
                        <p style="color:#94a3b8;">The server is starting up or reloading. Please wait a few seconds and refresh.</p>
                        <p><a href="/apps/jupyter/index.html" style="color:#f97316;font-weight:600;text-decoration:none;">Return to Jupyter Dashboard</a></p>
                    </body>
                    </html>
                `);
            }
        }
    }
});

// Protect & route /jupyter
app.use('/jupyter', (req, res, next) => {
    if (isAppDisabled('jupyter')) {
        return res.status(503).send('<h2>Jupyter Lab is currently disabled.</h2><p>Enable it from the dashboard settings.</p>');
    }
    next();
});

app.use(jupyterProxy);

// Jupyter status and management APIs
app.get('/api/jupyter/status', async (req, res) => {
    if (!isJupyterReady && jupyterProcess) {
        await checkJupyterHealth();
    }
    res.json({
        running: isJupyterReady,
        starting: isJupyterStarting,
        token: JUPYTER_TOKEN,
        port: JUPYTER_PORT,
        rootDir: JUPYTER_ROOT_DIR,
        url: `/jupyter/lab?token=${encodeURIComponent(JUPYTER_TOKEN)}`
    });
});

app.post('/api/jupyter/restart', async (req, res) => {
    try {
        await restartJupyter();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// --- Finance Login API ---
app.post('/api/finance-login', (req, res) => {
    const { password } = req.body;

    if (password === FINANCE_PASSWORD) {
        const sessionToken = generateSessionToken();
        financeAuth.set(sessionToken, true);
        res.cookie('financeSession', sessionToken, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 30
        });
        res.json({ success: true, session: sessionToken });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

app.post('/api/finance-change-password', requireFinanceAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (currentPassword !== FINANCE_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    FINANCE_PASSWORD = newPassword.trim();
    await fsPromises.writeFile(
        FINANCE_PASSWORD_FILE,
        JSON.stringify({ password: FINANCE_PASSWORD, updatedAt: new Date().toISOString() }, null, 2)
    );

    res.json({ success: true, message: 'Password changed successfully' });
});

// --- Finance Auth Check API ---
app.get('/api/finance-auth-check', (req, res) => {
    const sessionToken = getFinanceSessionToken(req);

    if (financeAuth.has(sessionToken)) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

// --- Crawler API Routes ---
const crawlerRoutes = require('./apps/crawler/server/routes');
app.use('/api/crawler', crawlerRoutes);
app.use('/uploads/crawler', express.static(path.join(__dirname, 'uploads', 'crawler')));
const crawlerEngine = require('./apps/crawler/server/engine');
crawlerEngine.startBackgroundWorker();
// Pass the isAppDisabled check into the crawler engine so its worker loop can skip when disabled
crawlerEngine.setDisabledCheck(() => isAppDisabled('crawler'));

// --- AI Proxy for NVIDIA (CORS Bypass) ---
app.post('/api/ai/nvidia-proxy', async (req, res) => {
    try {
        const response = await axios({
            method: 'POST',
            url: 'https://integrate.api.nvidia.com/v1/chat/completions',
            data: req.body,
            headers: {
                'Authorization': req.headers.authorization,
                'Content-Type': 'application/json'
            },
            responseType: 'stream',
            validateStatus: () => true
        });

        if (response.headers['content-type']) res.set('Content-Type', response.headers['content-type']);
        res.status(response.status);
        response.data.pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Proxy Browser API ---
app.use('/api/proxy', async (req, res) => {
    const getFirstValue = (value) => Array.isArray(value) ? value[value.length - 1] : value;
    const appendProxyParams = (searchParams, key, value) => {
        if (Array.isArray(value)) {
            value.forEach((entry) => searchParams.append(key, entry));
            return;
        }
        if (typeof value !== 'undefined') {
            searchParams.append(key, value);
        }
    };
    const decodeProxyRequestUrl = (value) => {
        if (!value) return null;
        try {
            const parsed = new URL(value, 'http://localhost');
            if (parsed.pathname !== '/api/proxy') {
                return null;
            }

            const embeddedUrl = parsed.searchParams.get('url');
            if (!embeddedUrl) {
                return null;
            }

            const resolvedUrl = new URL(embeddedUrl);
            parsed.searchParams.forEach((entry, key) => {
                if (key !== 'url') {
                    resolvedUrl.searchParams.append(key, entry);
                }
            });

            return resolvedUrl.toString();
        } catch (error) {
            return null;
        }
    };

    let targetUrl = getFirstValue(req.query.url);
    if (!targetUrl) return res.status(400).send('URL is required');

    try {
        const parsedUrl = new URL(targetUrl);
        
        // Native form submissions append their own fields onto the proxy request,
        // so copy every non-proxy field back onto the destination URL.
        for (const [key, value] of Object.entries(req.query)) {
            if (key !== 'url') {
                appendProxyParams(parsedUrl.searchParams, key, value);
            }
        }
        targetUrl = parsedUrl.toString();
        const forwardedReferer = decodeProxyRequestUrl(req.headers.referer) || targetUrl;
        const forwardedOrigin = (() => {
            try {
                return new URL(forwardedReferer).origin;
            } catch (error) {
                return parsedUrl.origin;
            }
        })();

        // Axios request options
        const axiosOptions = {
            method: req.method,
            url: targetUrl,
            data: req.method !== 'GET' ? req.body : undefined,
            responseType: 'stream', // Use stream for memory efficiency and range support!
            validateStatus: () => true, // Accept all statuses
            maxRedirects: 0, // Let the proxy handle redirects so the browser's address bar updates
            headers: {
                // Forward some safe headers
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': req.headers.accept || '*/*',
                'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
                ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
                ...(req.headers.range ? { 'Range': req.headers.range } : {}),
                'Origin': forwardedOrigin,
                'Referer': forwardedReferer,
            }
        };

        const response = await axios(axiosOptions);

        // Check for redirects
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            // Redirect the client to the new location so the browser and sandbox know the final URL
            const finalUrl = new URL(response.headers.location, targetUrl).href;
            return res.redirect(`/api/proxy?url=${encodeURIComponent(finalUrl)}`);
        }

        const contentType = response.headers['content-type'] || '';
        
        // Strip headers that prevent framing or cause encoding/parsing conflicts
        const headersToKeep = { ...response.headers };
        delete headersToKeep['x-frame-options'];
        delete headersToKeep['content-security-policy'];
        delete headersToKeep['content-security-policy-report-only'];
        delete headersToKeep['strict-transport-security'];
        delete headersToKeep['set-cookie']; // Let the client handle them or ignore for simple proxy
        delete headersToKeep['transfer-encoding'];
        delete headersToKeep['connection'];
        delete headersToKeep['content-encoding']; // Axios decompresses the stream by default

        // For modified text types (HTML/CSS), delete original content-length so Express can recalculate it
        if (contentType.includes('text/html') || contentType.includes('text/css')) {
            delete headersToKeep['content-length'];
        }
        
        // Set response headers and status
        res.set(headersToKeep);
        res.status(response.status);

        if (contentType.includes('text/html')) {
            // Read HTML stream into memory for parsing and rewriting
            const chunks = [];
            response.data.on('data', (chunk) => chunks.push(chunk));
            response.data.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const html = buffer.toString('utf-8');
                const $ = cheerio.load(html);
                const serializedTargetUrl = JSON.stringify(targetUrl);

                // Re-write URLs
                const rewriteUrl = (originalUrl) => {
                    if (!originalUrl) return originalUrl;
                    originalUrl = originalUrl.trim();
                    // Ignore base64, javascript, hash links
                    if (
                        originalUrl.startsWith('data:') ||
                        originalUrl.startsWith('javascript:') ||
                        originalUrl.startsWith('mailto:') ||
                        originalUrl.startsWith('tel:') ||
                        originalUrl.startsWith('#')
                    ) return originalUrl;
                    try {
                        let absoluteUrl = new URL(originalUrl, targetUrl).href;
                        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                    } catch (e) {
                        return originalUrl;
                    }
                };

                // Process typical attributes where URLs reside
                $('a').each((i, el) => { if ($(el).attr('href')) $(el).attr('href', rewriteUrl($(el).attr('href'))); });
                $('link').each((i, el) => { if ($(el).attr('href')) $(el).attr('href', rewriteUrl($(el).attr('href'))); });
                $('img').each((i, el) => { if ($(el).attr('src')) $(el).attr('src', rewriteUrl($(el).attr('src'))); });
                $('script').each((i, el) => { if ($(el).attr('src')) $(el).attr('src', rewriteUrl($(el).attr('src'))); });
                $('iframe').each((i, el) => { if ($(el).attr('src')) $(el).attr('src', rewriteUrl($(el).attr('src'))); });
                $('source').each((i, el) => { if ($(el).attr('src')) $(el).attr('src', rewriteUrl($(el).attr('src'))); });
                $('video').each((i, el) => { if ($(el).attr('src')) $(el).attr('src', rewriteUrl($(el).attr('src'))); });
                $('audio').each((i, el) => { if ($(el).attr('src')) $(el).attr('src', rewriteUrl($(el).attr('src'))); });
                $('track').each((i, el) => { if ($(el).attr('src')) $(el).attr('src', rewriteUrl($(el).attr('src'))); });
                $('img').each((i, el) => {
                    if ($(el).attr('srcset')) {
                        const rewrittenSrcset = $(el).attr('srcset')
                            .split(',')
                            .map((candidate) => {
                                const [candidateUrl, descriptor] = candidate.trim().split(/\s+/, 2);
                                const rewritten = rewriteUrl(candidateUrl);
                                return descriptor ? `${rewritten} ${descriptor}` : rewritten;
                            })
                            .join(', ');
                        $(el).attr('srcset', rewrittenSrcset);
                    }
                });
                $('source').each((i, el) => {
                    if ($(el).attr('srcset')) {
                        const rewrittenSrcset = $(el).attr('srcset')
                            .split(',')
                            .map((candidate) => {
                                const [candidateUrl, descriptor] = candidate.trim().split(/\s+/, 2);
                                const rewritten = rewriteUrl(candidateUrl);
                                return descriptor ? `${rewritten} ${descriptor}` : rewritten;
                            })
                            .join(', ');
                        $(el).attr('srcset', rewrittenSrcset);
                    }
                });
                $('form').each((i, el) => { 
                    const action = $(el).attr('action');
                    if (action) { 
                        const rewrittenAction = rewriteUrl(action);
                        $(el).attr('action', rewrittenAction);

                        const method = ($(el).attr('method') || 'get').toLowerCase();
                        if (method === 'get') {
                            $(el).find('input[name="url"][data-proxy-hidden="true"]').remove();

                            try {
                                const embeddedUrl = new URL(rewrittenAction, 'http://localhost').searchParams.get('url');
                                if (embeddedUrl) {
                                    $(el).prepend(`<input type="hidden" name="url" value="${embeddedUrl}" data-proxy-hidden="true">`);
                                }
                            } catch (error) {}
                        }
                    } 
                });
                
                // Rewrite URL in style attributes
                $('[style]').each((i, el) => {
                    let style = $(el).attr('style');
                    if (style && style.includes('url(')) {
                        style = style.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, url) => {
                             if (url.startsWith('data:')) return match;
                             return `url(${quote}${rewriteUrl(url)}${quote})`;
                        });
                        $(el).attr('style', style);
                    }
                });

                // Inject script to override window.fetch, XMLHttpRequest, location, service worker, etc.
                const interceptScript = `
                    <script>
                        (() => {
                            const PROXY_PATH = '/api/proxy?url=';
                            const INITIAL_TARGET_URL = ${serializedTargetUrl};
                            const SKIP_PROTOCOLS = ['about:', 'blob:', 'data:', 'javascript:', 'mailto:', 'tel:', '#'];

                            // Disable service worker registrations to prevent bypassing this proxy
                            if (navigator.serviceWorker) {
                                navigator.serviceWorker.register = function() {
                                    return Promise.reject(new Error("Service Workers disabled in proxy mode"));
                                };
                            }

                            const notifyParent = (url) => {
                                try {
                                    window.parent.postMessage({ type: 'proxy:navigation', url }, window.location.origin);
                                } catch (error) {}
                            };

                            const unwrapProxyUrl = (value) => {
                                if (!value) return null;
                                try {
                                    const parsed = new URL(String(value), window.location.origin);
                                    if (parsed.origin === window.location.origin && parsed.pathname === '/api/proxy') {
                                        const embeddedUrl = parsed.searchParams.get('url');
                                        if (!embeddedUrl) {
                                            return null;
                                        }

                                        const resolvedUrl = new URL(embeddedUrl);
                                        parsed.searchParams.forEach((entry, key) => {
                                            if (key !== 'url') {
                                                resolvedUrl.searchParams.append(key, entry);
                                            }
                                        });

                                        return resolvedUrl.toString();
                                    }
                                } catch (error) {}
                                return null;
                            };

                            const getActiveTargetUrl = () => unwrapProxyUrl(window.location.href) || INITIAL_TARGET_URL;

                            const toAbsoluteUrl = (value, baseUrl = getActiveTargetUrl()) => {
                                const originalValue = String(value || '').trim();
                                if (!originalValue || SKIP_PROTOCOLS.some((prefix) => originalValue.startsWith(prefix))) {
                                    return originalValue;
                                }
                                const proxiedTarget = unwrapProxyUrl(originalValue);
                                if (proxiedTarget) return proxiedTarget;
                                try {
                                    return new URL(originalValue, baseUrl).href;
                                } catch (error) {
                                    return originalValue;
                                }
                            };

                            const toProxyUrl = (value, baseUrl = getActiveTargetUrl()) => {
                                const originalValue = String(value || '').trim();
                                if (!originalValue || SKIP_PROTOCOLS.some((prefix) => originalValue.startsWith(prefix))) {
                                    return originalValue;
                                }
                                const proxiedTarget = unwrapProxyUrl(originalValue);
                                const absoluteUrl = proxiedTarget || toAbsoluteUrl(originalValue, baseUrl);
                                try {
                                    return PROXY_PATH + encodeURIComponent(new URL(absoluteUrl).href);
                                } catch (error) {
                                    return originalValue;
                                }
                            };

                            const syncNavigationState = (candidateUrl) => {
                                const nextUrl = candidateUrl || getActiveTargetUrl();
                                notifyParent(nextUrl);
                            };

                            // Override fetch & XHR
                            const originalFetch = window.fetch.bind(window);
                            window.fetch = (input, init) => {
                                if (typeof input === 'string' || input instanceof URL) {
                                    input = toProxyUrl(String(input));
                                } else if (input instanceof Request) {
                                    input = new Request(toProxyUrl(input.url), input);
                                }
                                return originalFetch(input, init);
                            };

                            const originalXHROpen = XMLHttpRequest.prototype.open;
                            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                                const rewrittenUrl = (typeof url === 'string' || url instanceof URL) ? toProxyUrl(String(url)) : url;
                                return originalXHROpen.call(this, method, rewrittenUrl, ...rest);
                            };

                            // Virtualize location properties to reflect target website
                            try {
                                const originalLocationProto = Location.prototype;
                                const targetProperties = ['href', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash', 'origin'];
                                
                                targetProperties.forEach(prop => {
                                    const desc = Object.getOwnPropertyDescriptor(originalLocationProto, prop);
                                    if (!desc) return;
                                    
                                    Object.defineProperty(originalLocationProto, prop, {
                                        configurable: true,
                                        enumerable: true,
                                        get() {
                                            const targetUrl = getActiveTargetUrl();
                                            try {
                                                const parsed = new URL(targetUrl);
                                                return parsed[prop];
                                            } catch (e) {
                                                return desc.get.call(this);
                                            }
                                        },
                                        set(value) {
                                            if (prop === 'href') {
                                                desc.set.call(this, toProxyUrl(value));
                                            } else {
                                                const targetUrl = getActiveTargetUrl();
                                                try {
                                                    const parsed = new URL(targetUrl);
                                                    parsed[prop] = value;
                                                    desc.set.call(this, toProxyUrl(parsed.href));
                                                } catch (e) {
                                                    desc.set.call(this, value);
                                                }
                                            }
                                        }
                                    });
                                });

                                const originalReplace = Location.prototype.replace;
                                Location.prototype.replace = function(url) {
                                    return originalReplace.call(this, toProxyUrl(url));
                                };

                                const originalAssign = Location.prototype.assign;
                                Location.prototype.assign = function(url) {
                                    return originalAssign.call(this, toProxyUrl(url));
                                };
                            } catch (e) {
                                console.warn("Location virtualization override failed", e);
                            }

                            // Virtualize document URL properties
                            try {
                                Object.defineProperty(Document.prototype, 'URL', {
                                    configurable: true,
                                    enumerable: true,
                                    get() { return getActiveTargetUrl(); }
                                });
                                Object.defineProperty(Document.prototype, 'documentURI', {
                                    configurable: true,
                                    enumerable: true,
                                    get() { return getActiveTargetUrl(); }
                                });
                                Object.defineProperty(Document.prototype, 'domain', {
                                    configurable: true,
                                    enumerable: true,
                                    get() {
                                        try {
                                            return new URL(getActiveTargetUrl()).hostname;
                                        } catch (e) {
                                            return '';
                                        }
                                    },
                                    set(value) {}
                                });
                            } catch (e) {}

                            // Override setAttribute and DOM properties for URLs
                            const originalSetAttribute = Element.prototype.setAttribute;
                            Element.prototype.setAttribute = function(name, value) {
                                const normalizedName = String(name || '').toLowerCase();
                                if (value != null && ['action', 'href', 'poster', 'src'].includes(normalizedName)) {
                                    value = toProxyUrl(String(value));
                                }
                                return originalSetAttribute.call(this, name, value);
                            };

                            const patchUrlProperty = (prototype, propertyName) => {
                                if (!prototype) return;
                                const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
                                if (!descriptor || typeof descriptor.set !== 'function' || typeof descriptor.get !== 'function') {
                                    return;
                                }

                                Object.defineProperty(prototype, propertyName, {
                                    configurable: descriptor.configurable,
                                    enumerable: descriptor.enumerable,
                                    get() {
                                        return descriptor.get.call(this);
                                    },
                                    set(value) {
                                        const nextValue = value == null ? value : toProxyUrl(String(value));
                                        descriptor.set.call(this, nextValue);
                                    }
                                });
                            };

                            patchUrlProperty(HTMLAnchorElement && HTMLAnchorElement.prototype, 'href');
                            patchUrlProperty(HTMLFormElement && HTMLFormElement.prototype, 'action');
                            patchUrlProperty(HTMLIFrameElement && HTMLIFrameElement.prototype, 'src');
                            patchUrlProperty(HTMLImageElement && HTMLImageElement.prototype, 'src');
                            patchUrlProperty(HTMLLinkElement && HTMLLinkElement.prototype, 'href');
                            patchUrlProperty(HTMLMediaElement && HTMLMediaElement.prototype, 'src');
                            patchUrlProperty(HTMLScriptElement && HTMLScriptElement.prototype, 'src');
                            patchUrlProperty(HTMLSourceElement && HTMLSourceElement.prototype, 'src');
                            patchUrlProperty(HTMLTrackElement && HTMLTrackElement.prototype, 'src');

                            const wrapHistoryMethod = (methodName) => {
                                const originalMethod = history[methodName].bind(history);
                                history[methodName] = (state, title, url) => {
                                    const nextArguments = [state, title, url];
                                    if (typeof url === 'string' || url instanceof URL) {
                                        nextArguments[2] = toProxyUrl(url);
                                    }
                                    const result = originalMethod(...nextArguments);
                                    syncNavigationState(unwrapProxyUrl(window.location.href));
                                    return result;
                                };
                            };

                            wrapHistoryMethod('pushState');
                            wrapHistoryMethod('replaceState');

                            const originalOpen = window.open.bind(window);
                            window.open = (url, ...rest) => {
                                if (typeof url !== 'string' && !(url instanceof URL)) {
                                    return originalOpen(url, ...rest);
                                }
                                return originalOpen(toProxyUrl(url), ...rest);
                            };

                            // Wrap HTMLFormElement.prototype.submit to catch programmatic submit calls
                            if (HTMLFormElement && HTMLFormElement.prototype.submit) {
                                const originalSubmit = HTMLFormElement.prototype.submit;
                                HTMLFormElement.prototype.submit = function() {
                                    const action = this.getAttribute('action') || getActiveTargetUrl();
                                    this.setAttribute('action', toProxyUrl(action));
                                    return originalSubmit.call(this);
                                };
                            }

                            document.addEventListener('click', (event) => {
                                const anchor = event.target.closest && event.target.closest('a[href]');
                                if (!anchor) return;
                                const href = anchor.getAttribute('href');
                                const rewrittenHref = toProxyUrl(href);
                                if (rewrittenHref && rewrittenHref !== href) {
                                    anchor.setAttribute('href', rewrittenHref);
                                }
                                const absoluteHref = toAbsoluteUrl(href);
                                if (absoluteHref) {
                                    syncNavigationState(absoluteHref);
                                }
                            }, true);

                            document.addEventListener('submit', (event) => {
                                const form = event.target;
                                if (!(form instanceof HTMLFormElement)) return;
                                const action = form.getAttribute('action') || getActiveTargetUrl();
                                const rewrittenAction = toProxyUrl(action);
                                if (rewrittenAction) {
                                    form.setAttribute('action', rewrittenAction);
                                }
                                const absoluteAction = toAbsoluteUrl(action);
                                if (absoluteAction) {
                                    syncNavigationState(absoluteAction);
                                }
                            }, true);

                            window.addEventListener('popstate', () => syncNavigationState(unwrapProxyUrl(window.location.href)));
                            window.addEventListener('hashchange', () => syncNavigationState(unwrapProxyUrl(window.location.href)));
                            window.addEventListener('load', () => syncNavigationState(unwrapProxyUrl(window.location.href)));

                            syncNavigationState(getActiveTargetUrl());
                        })();
                    </script>
                `;
                $('head').prepend(interceptScript);

                res.send(Buffer.from($.html(), 'utf-8'));
            });
            response.data.on('error', (err) => {
                console.error('HTML Proxy stream error:', err.message);
                if (!res.headersSent) res.status(500).send('Proxy Stream Error');
            });
        } else if (contentType.includes('text/css')) {
             // Read CSS stream into memory for url rewriting
             const chunks = [];
             response.data.on('data', (chunk) => chunks.push(chunk));
             response.data.on('end', () => {
                 const buffer = Buffer.concat(chunks);
                 let css = buffer.toString('utf-8');
                 css = css.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, url) => {
                     if (url.startsWith('data:')) return match;
                     try {
                         let absoluteUrl = new URL(url, targetUrl).href;
                         return `url(${quote}/api/proxy?url=${encodeURIComponent(absoluteUrl)}${quote})`;
                     } catch (e) {
                         return match;
                     }
                 });
                 css = css.replace(/@import\s+(?:url\()?\s*(['"])(.*?)\1\s*\)?/g, (match, quote, url) => {
                      if (url.startsWith('data:')) return match;
                      try {
                          let absoluteUrl = new URL(url, targetUrl).href;
                          return `@import url(${quote}/api/proxy?url=${encodeURIComponent(absoluteUrl)}${quote})`;
                      } catch (e) {
                          return match;
                      }
                 });
                 res.send(Buffer.from(css, 'utf-8'));
             });
             response.data.on('error', (err) => {
                 console.error('CSS Proxy stream error:', err.message);
                 if (!res.headersSent) res.status(500).send('Proxy Stream Error');
             });
        } else {
            // Stream binary data directly (images, video/audio chunks, media streams, js, etc.)
            response.data.pipe(res);
            response.data.on('error', (err) => {
                console.error('Binary Proxy pipe error:', err.message);
                // Can't set status if headers already sent, which is likely for streamed media
            });
        }
    } catch (error) {
        console.error('Proxy Error:', error.message);
        if (!res.headersSent) {
            res.status(error.response ? error.response.status : 500).send(`Proxy Error: ${error.message}`);
        }
    }
});

// --- Host HTML API Routes ---
app.use('/api/hosthtml', express.json({ limit: '10mb' }));

app.get('/api/hosthtml/pages', async (req, res) => {
    try {
        const pages = await HostedHtml.find().select('path title views updatedAt data').sort({ updatedAt: -1 });
        // Return a lightweight hasData flag instead of shipping the whole blob in the list
        const safePages = pages.map(p => {
            const d = p.data;
            const hasData = d && typeof d === 'object' && Object.keys(d).length > 0;
            return {
                path: p.path,
                title: p.title,
                views: p.views,
                updatedAt: p.updatedAt,
                hasData
            };
        });
        res.json(safePages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/hosthtml/pages', async (req, res) => {
    try {
        const { path, title, content } = req.body;
        if (!path || !title || !content) return res.status(400).json({ error: 'Missing required fields' });
        
        const existing = await HostedHtml.findOne({ path });
        if (existing) return res.status(400).json({ error: 'Path already exists' });
        
        const newPage = new HostedHtml({ path, title, content });
        await newPage.save();
        res.json({ success: true, page: newPage });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/hosthtml/pages/:path', async (req, res) => {
    try {
        const page = await HostedHtml.findOne({ path: req.params.path });
        if (!page) return res.status(404).json({ error: 'Page not found' });
        res.json(page);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/hosthtml/pages/:path', async (req, res) => {
    try {
        const { title, content } = req.body;
        const page = await HostedHtml.findOneAndUpdate(
            { path: req.params.path },
            { title, content },
            { new: true }
        );
        if (!page) return res.status(404).json({ error: 'Page not found' });
        res.json({ success: true, page });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/hosthtml/pages/:path', async (req, res) => {
    try {
        const result = await HostedHtml.findOneAndDelete({ path: req.params.path });
        if (!result) return res.status(404).json({ error: 'Page not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Host HTML Server-Side Shared Data (replaces browser localStorage/IndexedDB for hosted pages) ---
// All visitors to the same /p/:path see and modify the exact same server-stored data object.
//
// In addition to the explicit window.HostedStorage API, we now inject transparent
// shims for localStorage and sessionStorage. Most existing "paste an HTML app"
// workflows therefore get cross-device shared persistence automatically.
app.get('/api/hosthtml/pages/:path/data', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const page = await HostedHtml.findOne({ path: req.params.path }).select('data');
        if (!page) return res.status(404).json({ error: 'Page not found' });
        res.json(page.data || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/hosthtml/pages/:path/data', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const { data } = req.body;
        if (data === undefined) {
            return res.status(400).json({ error: 'Request body must include "data"' });
        }
        const page = await HostedHtml.findOneAndUpdate(
            { path: req.params.path },
            { data },
            { new: true }
        );
        if (!page) return res.status(404).json({ error: 'Page not found' });
        res.json({ success: true, data: page.data || {} });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/hosthtml/pages/:path/data', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const page = await HostedHtml.findOneAndUpdate(
            { path: req.params.path },
            { data: {} },
            { new: true }
        );
        if (!page) return res.status(404).json({ error: 'Page not found' });
        res.json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Host HTML Render Endpoint ---
// IMPORTANT: We deliberately do NOT use the restrictive CSP sandbox here.
// The previous "sandbox allow-scripts allow-forms" (no allow-same-origin) was
// causing SecurityError on sessionStorage / localStorage / IndexedDB and
// origin mismatch errors inside real single-page apps.
//
// Hosted pages are now served as normal same-origin documents so they can use
// modern web APIs.
//
// Data persistence for hosted pages is provided by a server-backed store
// (the `data` field on the HostedHtml document). In addition to the explicit
// window.HostedStorage helper we also install transparent shims for the
// classic localStorage and sessionStorage APIs. This means the majority of
// "single file HTML apps" users paste in will automatically have their data
// shared across devices/browsers without any code changes inside the hosted HTML.
app.get('/p/:path', async (req, res) => {
    try {
        const page = await HostedHtml.findOne({ path: req.params.path });
        if (!page) return res.status(404).send('Page not found');
        
        // Increment views in background
        HostedHtml.updateOne({ _id: page._id }, { $inc: { views: 1 } }).exec();

        const pagePath = page.path;
        const safePath = JSON.stringify(pagePath);

        // Snapshot of server data at render time. This seeds the transparent storage
        // shims synchronously so that the first reads (even before any network) see
        // the latest data from other devices.
        const initialData = page.data || {};

        // Permissive but still somewhat reasonable CSP for user-provided SPAs.
        // Allows inline scripts/styles (very common), eval (some frameworks), data/blob URLs, and network requests.
        const permissiveCSP = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: *; connect-src 'self' *; img-src 'self' data: blob: https: http:; media-src 'self' data: blob: https: http:; style-src 'self' 'unsafe-inline' https: http: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: data: blob:;";
        res.setHeader('Content-Security-Policy', permissiveCSP);
        res.set('Cache-Control', 'no-store, private');

        // Build the storage helper injected into every hosted page.
        // It provides:
        //  - Transparent localStorage + sessionStorage facades backed by the server data
        //    (so most existing pasted SPAs "just work" across devices).
        //  - The explicit window.HostedStorage API (updated to be mostly sync after seed).
        //  - A refresh() helper + visibilitychange listener for picking up remote changes.
        const storageHelper = `
<script id="hosted-storage-helper">
(function () {
  const PAGE_PATH = ${safePath};
  const API = '/api/hosthtml/pages/' + encodeURIComponent(PAGE_PATH) + '/data';

  // Seeded synchronously from the snapshot embedded at page serve time.
  // This is the source of truth for the shims and the explicit API.
  let memoryData = ${JSON.stringify(initialData)};

  async function apiGet() {
    const r = await fetch(API, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('HostedStorage: failed to load (' + r.status + ')');
    return r.json();
  }
  async function apiPut(dataObj) {
    const r = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ data: dataObj })
    });
    if (!r.ok) throw new Error('HostedStorage: failed to save (' + r.status + ')');
    return r.json();
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      apiPut(memoryData).catch(err => console.warn('HostedStorage save failed', err));
    }, 400);
  }

  function makeStorage() {
    return {
      getItem(key) {
        if (key == null) return null;
        const k = String(key);
        return Object.prototype.hasOwnProperty.call(memoryData, k) ? String(memoryData[k]) : null;
      },
      setItem(key, val) {
        if (key == null) return;
        memoryData[String(key)] = String(val == null ? '' : val);
        scheduleSave();
      },
      removeItem(key) {
        if (key == null) return;
        delete memoryData[String(key)];
        scheduleSave();
      },
      clear() {
        memoryData = {};
        scheduleSave();
      },
      get length() {
        return Object.keys(memoryData).length;
      },
      key(index) {
        const keys = Object.keys(memoryData);
        return (index >= 0 && index < keys.length) ? keys[index] : null;
      }
    };
  }

  const serverLocalStorage = makeStorage();
  const serverSessionStorage = makeStorage();

  // Install transparent shims. Both map to the same server-backed memory so that
  // classic localStorage/sessionStorage usage in pasted SPAs becomes shared & persistent.
  try {
    Object.defineProperty(window, 'localStorage', {
      value: serverLocalStorage,
      configurable: true,
      enumerable: true,
      writable: false
    });
  } catch (e) {
    console.warn('[HostedStorage] Could not override localStorage', e);
  }
  try {
    Object.defineProperty(window, 'sessionStorage', {
      value: serverSessionStorage,
      configurable: true,
      enumerable: true,
      writable: false
    });
  } catch (e) {
    console.warn('[HostedStorage] Could not override sessionStorage', e);
  }

  // Explicit API. After the synchronous seed these are mostly sync (await on
  // a non-thenable value still works, preserving backward compatibility).
  const HostedStorage = {
    getAll() {
      return { ...memoryData };
    },
    async setAll(newData) {
      if (newData && typeof newData === 'object' && !Array.isArray(newData)) {
        memoryData = { ...newData };
      } else {
        memoryData = newData != null ? newData : {};
      }
      scheduleSave();
      return { ...memoryData };
    },
    get(key, defaultValue) {
      const k = String(key);
      return Object.prototype.hasOwnProperty.call(memoryData, k) ? memoryData[k] : defaultValue;
    },
    set(key, value) {
      memoryData[String(key)] = value;
      scheduleSave();
      return Promise.resolve();
    },
    clear() {
      memoryData = {};
      scheduleSave();
      return Promise.resolve();
    },
    loadState() { return this.getAll(); },
    saveState(state) { return this.setAll(state); },
    async refresh() {
      try {
        const fresh = await apiGet();
        memoryData = (fresh && typeof fresh === 'object') ? fresh : {};
      } catch (e) {
        console.warn('[HostedStorage] refresh failed', e);
      }
      return { ...memoryData };
    }
  };

  window.HostedStorage = HostedStorage;
  window.__HOSTED_PAGE_PATH__ = PAGE_PATH;

  // When the tab becomes visible again, pull latest from server (helps seeing
  // writes that happened on another device while this tab was in the background).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      HostedStorage.refresh().catch(() => {});
    }
  });

  console.log('%c[HostedStorage] Server-backed storage ready for /p/' + PAGE_PATH + ' (localStorage/sessionStorage + HostedStorage are now shared across devices)', 'color:#22c55e');
})();
</script>`.trim();

        // Inject the helper script as early as possible using cheerio when we can.
        let finalContent = page.content;
        try {
          const $ = cheerio.load(page.content, { decodeEntities: false, xmlMode: false });
          let injected = false;

          if ($('head').length > 0) {
            $('head').prepend(storageHelper + '\n');
            injected = true;
          } else if ($('html').length > 0) {
            const htmlEl = $('html').first();
            if (htmlEl.children('head').length === 0) {
              htmlEl.prepend('<head></head>');
            }
            $('head').prepend(storageHelper + '\n');
            injected = true;
          }

          if (injected) {
            finalContent = $.html();
          } else {
            // Extremely minimal document — just prepend
            finalContent = storageHelper + '\n' + page.content;
          }
        } catch (injectErr) {
          // Fallback: prepend the script. Most browsers will still execute it before the rest of the document.
          console.warn('HostedStorage injection via cheerio failed, using fallback prepend:', injectErr.message);
          finalContent = storageHelper + '\n' + page.content;
        }

        res.type('html').send(finalContent);
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

// --- Finance API Routes (Protected) ---
const financeRoutes = require('./apps/finance/server/routes');
app.use('/api/finance', requireFinanceAuth, financeRoutes);

// --- Finance App Static Files (Protected) ---
// Custom middleware to protect static files under /finance
const protectFinanceStatic = (req, res, next) => {
    const sessionToken = getFinanceSessionToken(req);

    if (financeAuth.has(sessionToken)) {
        next();
    } else {
        // Redirect to login page or return auth required
        res.redirect('/finance-login.html');
    }
};

// Serve finance app static files from /finance/ URL (protected)
app.use('/finance', protectFinanceStatic, express.static(path.join(__dirname, 'apps', 'finance')));

// Also serve a dedicated login page for finance
app.get('/finance-login.html', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Finance App - Login</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
               min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .login-container { background: #fff; padding: 2rem; border-radius: 12px; 
                          box-shadow: 0 10px 40px rgba(0,0,0,0.3); width: 100%; max-width: 380px; }
        h1 { color: #1a1a2e; margin-bottom: 1.5rem; text-align: center; font-size: 1.5rem; }
        .error { color: #e74c3c; margin-bottom: 1rem; padding: 0.75rem; background: #fee; 
                border-radius: 6px; display: none; }
        input { width: 100%; padding: 0.875rem; margin-bottom: 1rem; border: 2px solid #e0e0e0; 
               border-radius: 8px; font-size: 1rem; transition: border-color 0.2s; }
        input:focus { outline: none; border-color: #4f46e5; }
        button { width: 100%; padding: 0.875rem; background: #4f46e5; color: #fff; border: none; 
                border-radius: 8px; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
        button:hover { background: #4338ca; }
        .back-link { display: block; text-align: center; margin-top: 1rem; color: #666; 
                    text-decoration: none; }
        .back-link:hover { color: #4f46e5; }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>🔒 Finance App</h1>
        <div class="error" id="error"></div>
        <form id="loginForm">
            <input type="password" id="password" placeholder="Enter password" required autofocus>
            <button type="submit">Login</button>
        </form>
        <a href="/" class="back-link">← Back to Dashboard</a>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            
            try {
                const res = await fetch('/api/finance-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                
                if (data.success) {
                    // Store session and redirect to finance app
                    localStorage.setItem('financeSession', data.session);
                    window.location.href = '/finance/index.html?session=' + data.session;
                } else {
                    errorDiv.textContent = data.error || 'Invalid password';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.textContent = 'Login failed. Please try again.';
                errorDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>
    `);
});

// --- Escaped Proxy Navigation Interceptor ---
// Catches relative URLs (e.g. /results) that escaped the iframe sandbox and forwards them back to the proxy.
app.use((req, res, next) => {
    // Exclude API, uploads, and specific backend routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/dietplan')) {
        return next();
    }
    
    const referer = req.headers.referer;
    if (referer && referer.includes('/api/proxy?url=')) {
        try {
            const parsedReferer = new URL(referer);
            const embeddedUrlStr = parsedReferer.searchParams.get('url');
            if (embeddedUrlStr) {
                const targetBase = new URL(embeddedUrlStr);
                const escapedUrl = new URL(req.originalUrl, targetBase.href).href;
                // Avoid infinite loop if it's somehow matching
                if (req.path !== '/api/proxy') {
                    return res.redirect(`/api/proxy?url=${encodeURIComponent(escapedUrl)}`);
                }
            }
        } catch (error) {}
    }
    next();
});

// --- Dashboard Settings API ---
app.get('/api/dashboard/settings', async (req, res) => {
    try {
        let doc = await DashboardSettings.findOne({});
        if (!doc) doc = await DashboardSettings.create({ disabledApps: [] });
        res.json({ disabledApps: doc.disabledApps || [] });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

app.post('/api/dashboard/settings', async (req, res) => {
    try {
        const { disabledApps } = req.body;
        if (!Array.isArray(disabledApps)) {
            return res.status(400).json({ error: 'disabledApps must be an array of app IDs' });
        }
        const filtered = disabledApps.filter(id => typeof id === 'string' && id.trim());
        let doc = await DashboardSettings.findOne({});
        if (!doc) doc = new DashboardSettings();
        doc.disabledApps = filtered;
        await doc.save();
        // Update the in-memory cache immediately
        _disabledAppsCache = new Set(filtered);
        console.log('[Dashboard] Disabled apps updated:', filtered);
        if (_disabledAppsCache.has('jupyter')) {
            stopJupyter();
        } else if (!jupyterProcess) {
            startJupyterIfEnabled();
        }
        res.json({ ok: true, disabledApps: filtered });
    } catch (e) {
        console.error('Error saving dashboard settings:', e);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// --- Static File Serving ---
// Serve the main front-end, apps, and uploads
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve the new assets folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public', express.static('public'));


// --- File Explorer Setup ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const fileHubTempUploadDir = path.join(os.tmpdir(), 'render-dashboard-filehub-uploads');
fs.mkdirSync(fileHubTempUploadDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: fileHubTempUploadDir,
        filename: (req, file, cb) => {
            const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${path.basename(file.originalname)}`;
            cb(null, uniqueName);
        }
    })
});

const normalizeFileHubPath = (input = '') => String(input || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('/');

const joinFileHubPath = (...parts) => normalizeFileHubPath(parts.filter(Boolean).join('/'));

const getFileHubParentPath = (filePath = '') => {
    const normalizedPath = normalizeFileHubPath(filePath);
    if (!normalizedPath) return '';
    const segments = normalizedPath.split('/');
    segments.pop();
    return segments.join('/');
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fileHubPathRegex = (basePath = '') => {
    const normalizedPath = normalizeFileHubPath(basePath);
    return normalizedPath
        ? new RegExp(`^${escapeRegExp(normalizedPath)}(?:/|$)`)
        : /.*/;
};

const FILE_HUB_MIME_TYPES = {
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

const getFileHubMimeType = (filename, fallback = 'application/octet-stream') => {
    const extension = path.extname(filename || '').toLowerCase();
    return FILE_HUB_MIME_TYPES[extension] || fallback;
};

const ensureFileHubFolderExists = async (folderPath = '') => {
    const normalizedPath = normalizeFileHubPath(folderPath);
    if (!normalizedPath) return;

    const segments = normalizedPath.split('/');
    let currentPath = '';

    for (const segment of segments) {
        currentPath = joinFileHubPath(currentPath, segment);
        await FileHubEntry.findOneAndUpdate(
            { path: currentPath },
            {
                $setOnInsert: {
                    path: currentPath,
                    parentPath: getFileHubParentPath(currentPath),
                    name: segment,
                    isDirectory: true,
                    mimeType: 'inode/directory',
                    size: 0,
                    content: null
                }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
    }
};

let fileHubGridFsBucket;
const waitForMongoConnection = async () => {
    if (mongoose.connection.readyState === 1) return;
    await mongoose.connection.asPromise();
};

const getFileHubGridFsBucket = () => {
    if (!mongoose.connection.db) {
        throw new Error('MongoDB connection is not ready.');
    }

    if (!fileHubGridFsBucket) {
        fileHubGridFsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'filehubFiles'
        });
    }

    return fileHubGridFsBucket;
};

const deleteFileHubGridFsFile = async (fileId) => {
    if (!fileId) return;

    try {
        await waitForMongoConnection();
        await getFileHubGridFsBucket().delete(fileId);
    } catch (error) {
        if (error?.codeName !== 'FileNotFound' && !String(error?.message || '').includes('FileNotFound')) {
            throw error;
        }
    }
};

const uploadFileHubDiskFileToGridFs = async ({ sourcePath, filePath, name, mimeType }) => {
    await waitForMongoConnection();
    const bucket = getFileHubGridFsBucket();
    const uploadStream = bucket.openUploadStream(filePath, {
        metadata: {
            fileHubPath: filePath,
            originalName: name,
            mimeType
        }
    });

    await pipeline(fs.createReadStream(sourcePath), uploadStream);
    return uploadStream.id;
};

const uploadFileHubBufferToGridFs = async ({ buffer, filePath, name, mimeType }) => {
    await waitForMongoConnection();
    const bucket = getFileHubGridFsBucket();

    return new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(filePath, {
            metadata: {
                fileHubPath: filePath,
                originalName: name,
                mimeType
            }
        });

        uploadStream.on('error', reject);
        uploadStream.on('finish', () => resolve(uploadStream.id));
        uploadStream.end(buffer);
    });
};

const updateFileHubFileMetadata = async ({ filePath, name, size, mimeType, gridFsFileId }) => {
    const normalizedPath = normalizeFileHubPath(filePath);
    const existing = await FileHubEntry.findOne({ path: normalizedPath }).select('gridFsFileId');

    const savedEntry = await FileHubEntry.findOneAndUpdate(
        { path: normalizedPath },
        {
            $set: {
                path: normalizedPath,
                parentPath: getFileHubParentPath(normalizedPath),
                name,
                isDirectory: false,
                mimeType: mimeType || getFileHubMimeType(name),
                size,
                storageType: 'gridfs',
                gridFsFileId,
                content: null
            }
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    if (existing?.gridFsFileId && !existing.gridFsFileId.equals(gridFsFileId)) {
        await deleteFileHubGridFsFile(existing.gridFsFileId);
    }

    return savedEntry;
};

const saveFileHubFileFromDisk = async ({ filePath, name, sourcePath, size, mimeType }) => {
    const normalizedPath = normalizeFileHubPath(filePath);
    await ensureFileHubFolderExists(getFileHubParentPath(normalizedPath));

    let gridFsFileId;
    try {
        gridFsFileId = await uploadFileHubDiskFileToGridFs({
            sourcePath,
            filePath: normalizedPath,
            name,
            mimeType: mimeType || getFileHubMimeType(name)
        });

        return await updateFileHubFileMetadata({
            filePath: normalizedPath,
            name,
            size,
            mimeType,
            gridFsFileId
        });
    } catch (error) {
        await deleteFileHubGridFsFile(gridFsFileId);
        throw error;
    }
};

const saveFileHubFile = async ({ filePath, name, buffer, mimeType }) => {
    const normalizedPath = normalizeFileHubPath(filePath);
    await ensureFileHubFolderExists(getFileHubParentPath(normalizedPath));

    let gridFsFileId;
    try {
        gridFsFileId = await uploadFileHubBufferToGridFs({
            buffer,
            filePath: normalizedPath,
            name,
            mimeType: mimeType || getFileHubMimeType(name)
        });

        return await updateFileHubFileMetadata({
            filePath: normalizedPath,
            name,
            size: buffer.length,
            mimeType,
            gridFsFileId
        });
    } catch (error) {
        await deleteFileHubGridFsFile(gridFsFileId);
        throw error;
    }
};

const renameFileHubEntryTree = async (sourcePath, targetPath, targetName) => {
    const normalizedSourcePath = normalizeFileHubPath(sourcePath);
    const normalizedTargetPath = normalizeFileHubPath(targetPath);
    const entries = await FileHubEntry.find({ path: { $regex: fileHubPathRegex(normalizedSourcePath) } }).sort({ path: 1 });

    for (const entry of entries) {
        const suffix = entry.path.slice(normalizedSourcePath.length);
        entry.path = `${normalizedTargetPath}${suffix}`;
        entry.parentPath = getFileHubParentPath(entry.path);
        entry.name = entry.path.split('/').pop();
        if (entry.path === normalizedTargetPath) {
            entry.name = targetName;
        }
        await entry.save();
    }
};


// --- Newspaper Scraper Setup ---
// CORRECTED: Removed hardcoded logo URLs. The path will be generated automatically.
const NEWSPAPERS_CONFIG = [
    { name: "Hindustan Times", url: "https://epaperwave.com/hindustan-times-epaper-pdf-today/" },
    { name: "The Times of India", url: "https://epaperwave.com/the-times-of-india-epaper-pdf-download/" },
    { name: "The Mint", url: "https://epaperwave.com/download-the-mint-epaper-pdf-for-free-today/" },
    { name: "Dainik Bhaskar", url: "https://epaperwave.com/dainik-bhaskar-epaper-today-pdf/" },
    { name: "Punjab Kesari", url: "https://epaperwave.com/free-punjab-kesari-epaper-pdf-download-now/" },
    { name: "The Hindu", url: "https://epaperwave.com/the-hindu-newspaper-today-pdf-download/" },
    { name: "The Indian Express", url: "https://epaperwave.com/download-today-the-new-indian-express-newspaper/" },
    { name: "Amar Ujala", url: "https://epaperwave.com/amar-ujala-epaper-download-link-for-free/" },
    { name: "Jansatta", url: "https://epaperwave.com/jansatta-epaper-today-pdf-download/" },
    { name: "The Tribune", url: "https://epaperwave.com/the-tribune-epaper-pdf-download-daily/" },
    { name: "The Telegraph", url: "https://epaperwave.com/the-telegraph-epaper-today-pdf-download/" },
    { name: "Pudhari", url: "https://epaperwave.com/pudhari-epaper-today-pdf/" }
];
let newspaperCache = { data: null, lastFetched: 0 };

// Store for manually updated newspaper links
let manualNewspaperLinks = {};

// --- API Routes ---

// 1. LIST contents of a directory
app.get('/api/files', async (req, res) => {
    try {
        const currentPath = normalizeFileHubPath(req.query.path);
        const items = await FileHubEntry.find({ parentPath: currentPath })
            .sort({ isDirectory: -1, name: 1 })
            .select('name isDirectory');

        res.json(items.map(item => ({
            name: item.name,
            isDirectory: item.isDirectory
        })));
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).send('Server error while listing files.');
    }
});

// 2. UPLOAD a file
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const currentPath = normalizeFileHubPath(req.body.path);
        const filePath = joinFileHubPath(currentPath, req.file.originalname);

        await saveFileHubFileFromDisk({
            filePath,
            name: req.file.originalname,
            sourcePath: req.file.path,
            size: req.file.size,
            mimeType: req.file.mimetype || getFileHubMimeType(req.file.originalname)
        });

        res.json({ message: `File '${req.file.originalname}' uploaded successfully!` });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).send('Server error while uploading file.');
    } finally {
        if (req.file?.path) {
            fsPromises.unlink(req.file.path).catch(() => {});
        }
    }
});

// 3. CREATE a new folder
app.post('/api/folders', async (req, res) => {
    try {
        const { name, path: currentPath } = req.body;
        if (!name) {
            return res.status(400).send('Folder name is required.');
        }

        const normalizedParentPath = normalizeFileHubPath(currentPath);
        const newFolderPath = joinFileHubPath(normalizedParentPath, name);
        const existing = await FileHubEntry.findOne({ path: newFolderPath });

        if (existing) {
            return res.status(409).send('An item with that name already exists.');
        }

        await ensureFileHubFolderExists(newFolderPath);
        res.status(201).json({ message: `Folder '${name}' created successfully!` });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).send('Server error while creating folder.');
    }
});

// 4. DELETE a file or folder
app.delete('/api/delete', async (req, res) => {
    try {
        const { name, path: currentPath } = req.body;
        if (!name) {
            return res.status(400).send('Item name is required.');
        }

        const itemPath = joinFileHubPath(currentPath, name);
        const item = await FileHubEntry.findOne({ path: itemPath });
        if (!item) {
            return res.status(404).send('Item not found.');
        }

        const entriesToDelete = item.isDirectory
            ? await FileHubEntry.find({ path: { $regex: fileHubPathRegex(itemPath) } }).select('gridFsFileId')
            : [item];

        await Promise.all(entriesToDelete
            .map(entry => entry.gridFsFileId)
            .filter(Boolean)
            .map(deleteFileHubGridFsFile));

        if (item.isDirectory) {
            await FileHubEntry.deleteMany({ path: { $regex: fileHubPathRegex(itemPath) } });
        } else {
            await FileHubEntry.deleteOne({ path: itemPath });
        }

        res.json({ message: `Item '${name}' deleted successfully!` });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).send('Server error while deleting item.');
    }
});

// 5. RENAME a file or folder
app.put('/api/rename', async (req, res) => {
    try {
        const { oldName, newName, path: currentPath } = req.body;
        if (!oldName || !newName) {
            return res.status(400).send('Old and new names are required.');
        }

        const normalizedParentPath = normalizeFileHubPath(currentPath);
        const oldPath = joinFileHubPath(normalizedParentPath, oldName);
        const newPath = joinFileHubPath(normalizedParentPath, newName);
        const existing = await FileHubEntry.findOne({ path: oldPath });

        if (!existing) {
            return res.status(404).send('Item not found.');
        }

        const conflict = await FileHubEntry.findOne({ path: newPath });
        if (conflict) {
            return res.status(409).send('An item with that name already exists.');
        }

        if (existing.isDirectory) {
            await renameFileHubEntryTree(oldPath, newPath, newName);
        } else {
            existing.path = newPath;
            existing.parentPath = normalizedParentPath;
            existing.name = newName;
            existing.mimeType = getFileHubMimeType(newName, existing.mimeType);
            await existing.save();
        }

        res.json({ message: `Renamed '${oldName}' to '${newName}' successfully!` });
    } catch (error) {
        console.error('Error renaming item:', error);
        res.status(500).send('Server error while renaming item.');
    }
});

// 6. CREATE a new text file
app.post('/api/text-file', async (req, res) => {
    try {
        const { filename, content, path: currentPath } = req.body;
        if (!filename) {
            return res.status(400).send('Filename is required.');
        }

        const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`;
        const newFilePath = joinFileHubPath(currentPath, finalFilename);

        await saveFileHubFile({
            filePath: newFilePath,
            name: finalFilename,
            buffer: Buffer.from(content || '', 'utf-8'),
            mimeType: 'text/plain; charset=utf-8'
        });

        res.status(201).json({ message: `File '${finalFilename}' created successfully!` });
    } catch (error) {
        console.error('Error creating text file:', error);
        res.status(500).send('Server error while creating text file.');
    }
});

// 7. MOVE a file or folder
app.put('/api/move', async (req, res) => {
    try {
        const { sourcePath, targetPath } = req.body;
        if (!sourcePath || !targetPath) {
            return res.status(400).send('Source and target paths are required.');
        }

        const normalizedSourcePath = normalizeFileHubPath(sourcePath);
        const normalizedTargetPath = normalizeFileHubPath(targetPath);
        const item = await FileHubEntry.findOne({ path: normalizedSourcePath });

        if (!item) {
            return res.status(404).send('Source item not found.');
        }

        if (item.isDirectory && (normalizedTargetPath === normalizedSourcePath || normalizedTargetPath.startsWith(`${normalizedSourcePath}/`))) {
            return res.status(400).send('Cannot move a folder into itself.');
        }

        const conflict = await FileHubEntry.findOne({ path: normalizedTargetPath });
        if (conflict) {
            return res.status(409).send('Target item already exists.');
        }

        await ensureFileHubFolderExists(getFileHubParentPath(normalizedTargetPath));

        if (item.isDirectory) {
            await renameFileHubEntryTree(normalizedSourcePath, normalizedTargetPath, path.basename(normalizedTargetPath));
        } else {
            item.path = normalizedTargetPath;
            item.parentPath = getFileHubParentPath(normalizedTargetPath);
            item.name = path.basename(normalizedTargetPath);
            await item.save();
        }

        res.json({ message: `Moved '${sourcePath}' to '${targetPath}' successfully!` });
    } catch (error) {
        console.error('Error moving item:', error);
        res.status(500).send('Server error while moving item.');
    }
});

// 8. CLEAR ALL files and folders
app.delete('/api/clear-all', async (req, res) => {
    try {
        try {
            await getFileHubGridFsBucket().drop();
        } catch (error) {
            if (error?.codeName !== 'NamespaceNotFound') {
                throw error;
            }
        }
        await FileHubEntry.deleteMany({});
        res.json({ message: 'All files and folders have been cleared.' });
    } catch (error) {
        console.error('Error clearing storage:', error);
        res.status(500).send('Server error while clearing storage.');
    }
});

// 9. GET storage info
app.get('/api/storage-info', async (req, res) => {
    try {
        const result = await FileHubEntry.aggregate([
            { $match: { isDirectory: false } },
            { $group: { _id: null, used: { $sum: '$size' } } }
        ]);
        const used = result[0]?.used || 0;
        res.json({ used });
    } catch (error) {
        console.error('Error getting storage info:', error);
        res.status(500).json({ error: 'Failed to get storage info' });
    }
});

const getFileHubEntryBuffer = async (entry) => {
    if (!entry?.gridFsFileId) {
        return entry?.content || Buffer.alloc(0);
    }

    await waitForMongoConnection();

    return new Promise((resolve, reject) => {
        const chunks = [];
        const downloadStream = getFileHubGridFsBucket().openDownloadStream(entry.gridFsFileId);
        downloadStream.on('data', chunk => chunks.push(chunk));
        downloadStream.on('error', reject);
        downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

// 10. FILE CONTENT AND ZIP DOWNLOAD
const sendFileHubEntryContent = async (entry, res) => {
    res.set('Content-Type', entry.mimeType || getFileHubMimeType(entry.name));
    res.set('Content-Length', entry.size || 0);
    res.set('Cache-Control', 'no-store');

    if (entry.gridFsFileId) {
        await waitForMongoConnection();
        const downloadStream = getFileHubGridFsBucket().openDownloadStream(entry.gridFsFileId);
        downloadStream.on('error', error => {
            console.error('Error streaming File Hub content:', error);
            if (!res.headersSent) {
                res.status(500).send('Server error while streaming file content.');
            } else {
                res.destroy(error);
            }
        });
        downloadStream.pipe(res);
        return;
    }

    const content = entry.content || Buffer.alloc(0);
    res.set('Content-Length', entry.size || content.length);
    res.send(content);
};

app.head('/api/file-content', async (req, res) => {
    try {
        const filePath = normalizeFileHubPath(req.query.path);
        const entry = await FileHubEntry.findOne({ path: filePath, isDirectory: false }).select('-content');

        if (!entry) {
            return res.status(404).send('File not found.');
        }

        res.set('Content-Type', entry.mimeType || getFileHubMimeType(entry.name));
        res.set('Content-Length', entry.size || 0);
        res.set('Cache-Control', 'no-store');
        res.status(200).end();
    } catch (error) {
        console.error('Error fetching file metadata:', error);
        res.status(500).send('Server error while fetching file metadata.');
    }
});

app.get('/api/file-content', async (req, res) => {
    try {
        const filePath = normalizeFileHubPath(req.query.path);
        const entry = await FileHubEntry.findOne({ path: filePath, isDirectory: false });

        if (!entry) {
            return res.status(404).send('File not found.');
        }

        await sendFileHubEntryContent(entry, res);
    } catch (error) {
        console.error('Error fetching file content:', error);
        res.status(500).send('Server error while fetching file content.');
    }
});

app.get('/api/download-zip', async (req, res) => {
    try {
        const currentPath = normalizeFileHubPath(req.query.path);
        const zip = new AdmZip();
        const folderName = currentPath.split('/').pop() || 'root';

        let files;
        if (!currentPath) {
            files = await FileHubEntry.find({ isDirectory: false }).sort({ path: 1 });
        } else {
            const selectedEntry = await FileHubEntry.findOne({ path: currentPath });
            if (!selectedEntry) {
                return res.status(404).send('Folder not found.');
            }

            if (selectedEntry.isDirectory) {
                files = await FileHubEntry.find({
                    isDirectory: false,
                    path: { $regex: fileHubPathRegex(currentPath) }
                }).sort({ path: 1 });
            } else {
                files = [selectedEntry];
            }
        }

        for (const file of files) {
            const relativePath = currentPath && file.path.startsWith(`${currentPath}/`)
                ? file.path.slice(currentPath.length + 1)
                : file.name;
            zip.addFile(relativePath || file.name, await getFileHubEntryBuffer(file));
        }

        const zipBuffer = zip.toBuffer();

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${folderName}.zip"`);
        res.send(zipBuffer);
    } catch (error) {
        console.error('Error creating ZIP:', error);
        res.status(500).json({ error: 'Failed to create ZIP archive' });
    }
});

// 11. EXTRACT ZIP file
app.post('/api/extract-zip', async (req, res) => {
    try {
        const { name, path: currentPath } = req.body;

        if (!name) {
            return res.status(400).send('ZIP filename is required.');
        }

        const ext = name.split('.').pop().toLowerCase();
        if (ext !== 'zip') {
            return res.status(400).send('Only ZIP files can be extracted.');
        }

        const zipPath = joinFileHubPath(currentPath, name);
        const extractPath = joinFileHubPath(currentPath, name.replace(/\.zip$/i, ''));
        const zipEntry = await FileHubEntry.findOne({ path: zipPath, isDirectory: false });

        if (!zipEntry) {
            return res.status(404).send('ZIP file not found.');
        }

        await ensureFileHubFolderExists(extractPath);

        const zip = new AdmZip(await getFileHubEntryBuffer(zipEntry));
        for (const entry of zip.getEntries()) {
            const entryPath = normalizeFileHubPath(entry.entryName);
            if (!entryPath) continue;

            const targetPath = joinFileHubPath(extractPath, entryPath);
            if (entry.isDirectory) {
                await ensureFileHubFolderExists(targetPath);
                continue;
            }

            await saveFileHubFile({
                filePath: targetPath,
                name: path.basename(targetPath),
                buffer: entry.getData(),
                mimeType: getFileHubMimeType(targetPath)
            });
        }

        res.json({ message: `ZIP file extracted successfully to '${path.basename(extractPath)}'!` });
    } catch (error) {
        console.error('Error extracting ZIP:', error);
        res.status(500).json({ error: 'Failed to extract ZIP file' });
    }
});

// 12. LEARN INVESTING STATE
const normalizeLearnInvestingState = (state = {}) => ({
    profiles: isPlainObject(state.profiles) ? state.profiles : {},
    currentProfileId: typeof state.currentProfileId === 'string' && state.currentProfileId.trim()
        ? state.currentProfileId.trim()
        : null
});

const readLearnInvestingState = async () => {
    const data = await LearnInvestingState.findOne({});
    if (!data) return { profiles: {}, currentProfileId: null };
    return normalizeLearnInvestingState(typeof data.toObject === 'function' ? data.toObject() : data);
};

const writeLearnInvestingState = async (state) => {
    const normalized = normalizeLearnInvestingState(state);
    const existing = await LearnInvestingState.findOne({});

    if (existing) {
        existing.profiles = normalized.profiles;
        existing.currentProfileId = normalized.currentProfileId;
        existing.markModified('profiles');
        await existing.save();
        return existing;
    }

    return LearnInvestingState.create(normalized);
};

app.get('/api/learn-investing/state', async (req, res) => {
    try {
        const state = await readLearnInvestingState();
        res.json(state);
    } catch (error) {
        console.error('Error reading learn-investing state:', error);
        res.status(500).json({ error: 'Failed to read learn-investing state' });
    }
});

app.post('/api/learn-investing/state', async (req, res) => {
    try {
        const state = await writeLearnInvestingState(req.body);
        res.json({ success: true, state });
    } catch (error) {
        console.error('Error saving learn-investing state:', error);
        res.status(500).json({ error: 'Failed to save learn-investing state' });
    }
});

// 12A. INVESTING LAB STATE
const normalizeInvestingLabState = (state = {}) => ({
    profiles: isPlainObject(state.profiles) ? state.profiles : {}
});

const readInvestingLabState = async () => {
    const data = await InvestingLabState.findOne({});
    if (!data) return { profiles: {} };
    return normalizeInvestingLabState(typeof data.toObject === 'function' ? data.toObject() : data);
};

const writeInvestingLabState = async (state) => {
    const normalized = normalizeInvestingLabState(state);
    const existing = await InvestingLabState.findOne({});

    if (existing) {
        existing.profiles = normalized.profiles;
        existing.markModified('profiles');
        await existing.save();
        return existing;
    }

    return InvestingLabState.create(normalized);
};

app.get('/api/investing-lab/state', async (req, res) => {
    try {
        const state = await readInvestingLabState();
        res.json(state);
    } catch (error) {
        console.error('Error reading investing-lab state:', error);
        res.status(500).json({ error: 'Failed to read investing-lab state' });
    }
});

app.post('/api/investing-lab/state', async (req, res) => {
    try {
        const state = await writeInvestingLabState(req.body);
        res.json({ success: true, state });
    } catch (error) {
        console.error('Error saving investing-lab state:', error);
        res.status(500).json({ error: 'Failed to save investing-lab state' });
    }
});


// 12B. FRETBOARD TRAINER PROGRESS
const defaultFretboardProgress = () => ({
    cards: {},
    sequenceCursor: 0,
    totalAnswered: 0,
    correctAnswered: 0
});

const normalizeNumber = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
};

const normalizeFretboardProgress = (progress = {}) => {
    const normalized = defaultFretboardProgress();
    const sourceCards = isPlainObject(progress.cards) ? progress.cards : {};

    Object.entries(sourceCards).forEach(([key, value]) => {
        if (!/^[1-6]:([0-9]|1[0-9]|2[0-4])$/.test(key) || !isPlainObject(value)) return;

        normalized.cards[key] = {
            asked: normalizeNumber(value.asked),
            correct: normalizeNumber(value.correct),
            wrong: normalizeNumber(value.wrong),
            skipped: normalizeNumber(value.skipped),
            streak: normalizeNumber(value.streak),
            mastery: normalizeNumber(value.mastery, 0, 8),
            lastSeen: normalizeNumber(value.lastSeen),
            lastAnswered: normalizeNumber(value.lastAnswered)
        };
    });

    normalized.sequenceCursor = normalizeNumber(progress.sequenceCursor, 0);
    normalized.totalAnswered = normalizeNumber(progress.totalAnswered, 0);
    normalized.correctAnswered = normalizeNumber(progress.correctAnswered, 0);

    return normalized;
};

const readFretboardProgress = async () => {
    const data = await FretboardTrainerState.findOne({});
    if (!data) return defaultFretboardProgress();
    const state = typeof data.toObject === 'function' ? data.toObject() : data;
    return normalizeFretboardProgress(state.progress);
};

const writeFretboardProgress = async (progress) => {
    const normalized = normalizeFretboardProgress(progress);
    const existing = await FretboardTrainerState.findOne({});

    if (existing) {
        existing.progress = normalized;
        existing.markModified('progress');
        await existing.save();
        return normalized;
    }

    await FretboardTrainerState.create({ progress: normalized });
    return normalized;
};

app.get('/api/fretboard-trainer/progress', async (req, res) => {
    try {
        const progress = await readFretboardProgress();
        res.json(progress);
    } catch (error) {
        console.error('Error reading fretboard trainer progress:', error);
        res.status(500).json({ error: 'Failed to read fretboard trainer progress' });
    }
});

app.post('/api/fretboard-trainer/progress', async (req, res) => {
    try {
        const progress = await writeFretboardProgress(req.body || {});
        res.json(progress);
    } catch (error) {
        console.error('Error saving fretboard trainer progress:', error);
        res.status(500).json({ error: 'Failed to save fretboard trainer progress' });
    }
});


// 12A. Manually update newspaper link
app.post('/api/newspapers/update', (req, res) => {
    const { newspaperName, link } = req.body;
    if (!newspaperName || !link) {
        return res.status(400).json({ error: 'newspaperName and link are required' });
    }

    manualNewspaperLinks[newspaperName.toLowerCase()] = link;

    // Clear cache so the new link is used immediately
    newspaperCache = { data: null, lastFetched: 0 };

    res.json({ success: true, message: `Updated ${newspaperName} link` });
});


// 12. SCRAPE for latest newspapers
app.get('/api/newspapers', async (req, res) => {
    const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

    if (Date.now() - newspaperCache.lastFetched < CACHE_DURATION && newspaperCache.data) {
        return res.json(newspaperCache.data);
    }

    console.log('Cache stale or empty. Scraping for new e-papers...');

    const scrapeNewspaper = async (newspaperInfo, targetDate, retries = 3) => {
        // Use IST timezone for date calculation
        const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istDate = new Date(targetDate.getTime() + istOffset);
        const dateStr = istDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

        const tryScrape = async (attempt) => {
            try {
                // Use scrape.do API if API key is available
                if (SCRAPE_DO_API_KEY) {
                    console.log(`[DEBUG] ${newspaperInfo.name}: Using scrape.do API (super mode)`);

                    // Use improved scrape.do API with super=true, render=true, returnJSON=true
                    const scrapeUrl = `http://api.scrape.do/?url=${encodeURIComponent(newspaperInfo.url)}&token=${SCRAPE_DO_API_KEY}&super=true&sessionId=${Date.now()}&render=true&returnJSON=true`;

                    console.log(`[DEBUG] ${newspaperInfo.name}: Calling scrape.do API...`);
                    const { data } = await axios.get(scrapeUrl, { timeout: 120000 });

                    // With returnJSON=true, response is JSON with 'content' property containing HTML
                    const html = data.content || data;
                    const $ = cheerio.load(html);
                    let foundLink = null;

                    // Debug: Log sample of HTML
                    const bodyText = $('body').text().substring(0, 500);
                    console.log(`[DEBUG] ${newspaperInfo.name} - Sample HTML: ${bodyText.replace(/\s+/g, ' ')}`);

                    // Look for the PDF download links in the HTML
                    // Method 1: Look for center-aligned paragraphs with the date
                    $('p.has-text-align-center').each((i, el) => {
                        const text = $(el).text();
                        if (text.includes(dateStr) || text.includes(istDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }))) {
                            const linkTag = $(el).find('a').first();
                            if (linkTag.length) {
                                foundLink = linkTag.attr('href');
                                return false;
                            }
                        }
                    });

                    // Method 2: Look for Google Drive links
                    if (!foundLink) {
                        $('a[href*="drive.google.com"]').each((i, el) => {
                            const linkText = $(el).text();
                            const parentText = $(el).parent().text();
                            if (linkText.toLowerCase().includes(dateStr.toLowerCase()) ||
                                parentText.toLowerCase().includes(dateStr.toLowerCase())) {
                                foundLink = $(el).attr('href');
                                return false;
                            }
                        });
                    }

                    // Method 3: Look for links with "Download" and date
                    if (!foundLink) {
                        $('a').each((i, el) => {
                            const linkText = $(el).text();
                            if (linkText.toLowerCase().includes('download') && linkText.includes(dateStr)) {
                                const href = $(el).attr('href');
                                if (href && (href.includes('drive.google.com') || href.includes('epaperwave.com'))) {
                                    foundLink = href;
                                    return false;
                                }
                            }
                        });
                    }

                    // Fallback: If no exact date match, get the first available Google Drive link
                    if (!foundLink) {
                        console.log(`[DEBUG] ${newspaperInfo.name}: No link found for date ${dateStr}, getting first available link`);
                        $('a[href*="drive.google.com"]').each((i, el) => {
                            const href = $(el).attr('href');
                            if (href && href.includes('/view?')) {
                                foundLink = href;
                                return false;
                            }
                        });
                    }

                    if (!foundLink) {
                        console.log(`[DEBUG] ${newspaperInfo.name}: No link found at all`);
                    }

                    return foundLink;
                }

                // No API key, skip scraping
                console.log(`[DEBUG] ${newspaperInfo.name}: No scrape.do API key, skipping scrape`);
                return null;
            } catch (error) {
                if (attempt < retries) {
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 2000));
                    return tryScrape(attempt + 1);
                }
                throw error;
            }
        };

        try {
            const foundLink = await tryScrape(1);
            const logoFileName = newspaperInfo.name.toLowerCase().replace(/ /g, '-') + '.png';
            return {
                ...newspaperInfo,
                link: foundLink,
                logo: `/assets/${logoFileName}`
            };
        } catch (error) {
            console.error(`Failed to scrape ${newspaperInfo.name}:`, error.message);
            const logoFileName = newspaperInfo.name.toLowerCase().replace(/ /g, '-') + '.png';
            return { ...newspaperInfo, link: null, logo: `/assets/${logoFileName}` };
        }
    };

    const findPapersForDate = async (date) => {
        const results = [];
        for (const config of NEWSPAPERS_CONFIG) {
            // Add delay between each request to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            const result = await scrapeNewspaper(config, date);
            results.push(result);
        }
        return results;
    };

    let results = await findPapersForDate(new Date());
    let displayDate = new Date();

    if (!results.some(p => p.link)) {
        console.log("No papers found for today. Checking yesterday...");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        results = await findPapersForDate(yesterday);
        displayDate = yesterday;
    }

    // Add manual links as fallback for newspapers that don't have scraped links
    results = results.map(paper => {
        if (!paper.link && manualNewspaperLinks[paper.name.toLowerCase()]) {
            return { ...paper, link: manualNewspaperLinks[paper.name.toLowerCase()] };
        }
        return paper;
    });

    const finalData = {
        date: displayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        papers: results.filter(p => p.link)
    };

    newspaperCache = { data: finalData, lastFetched: Date.now() };
    res.json(finalData);
});



// --- CORS Proxy (used by NewsHunt to fetch RSS feeds) ---
const proxyFetch = (targetUrl) => {
    return new Promise((resolve, reject) => {
        const lib = targetUrl.startsWith('https') ? https : require('http');
        const req = lib.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 15000
        }, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                proxyFetch(response.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            response.setEncoding('utf8');
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
            response.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
};

app.get('/proxy', async (req, res) => {
    const target = req.query.url;
    if (!target) {
        return res.status(400).json({ error: 'Missing ?url= parameter' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const body = await proxyFetch(target);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(body);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ===============================================
// === NEWSHUNT SERVER-SIDE PERSISTENCE ==========
// ===============================================

const NEWSHUNT_DATA_PATH = path.join(__dirname, 'newshunt_data.json');

const NEWSHUNT_DEFAULT_STATE = Object.freeze({
    settings: {},
    feeds: [],
    articles: {},
    chatHistory: [],
    articleContent: {}
});

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toPlainValue = (value) => {
    if (!value) return value;
    if (typeof value.toObject === 'function') {
        return value.toObject({ flattenMaps: true });
    }
    if (value instanceof Map) {
        return Object.fromEntries(value.entries());
    }
    return value;
};

const normalizeNewshuntSettings = (settings) => {
    const plainSettings = toPlainValue(settings);
    return isPlainObject(plainSettings) ? { ...plainSettings } : {};
};

const normalizeNewshuntFeeds = (feeds) => {
    if (!Array.isArray(feeds)) return [];

    return feeds
        .filter(feed => isPlainObject(feed) && typeof feed.url === 'string' && feed.url.trim())
        .map(feed => ({
            ...feed,
            url: feed.url.trim(),
            name: typeof feed.name === 'string' ? feed.name : ''
        }));
};

const NEWSHUNT_RETENTION_DAYS = Math.max(1, Number(process.env.NEWSHUNT_RETENTION_DAYS) || 3);

const parseNewshuntTimestamp = (value) => {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
        const time = value.getTime();
        return Number.isFinite(time) ? time : null;
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) return null;
        return value < 10000000000 ? value * 1000 : value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || /^invalid date$/i.test(trimmed)) return null;

        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            return parseNewshuntTimestamp(Number(trimmed));
        }

        const parsed = Date.parse(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

const normalizeNewshuntArticleDateFields = (article, options = {}) => {
    const normalized = { ...article };
    const pubDateMs = parseNewshuntTimestamp(normalized.pubDate);
    const dateAddedMs = parseNewshuntTimestamp(normalized.dateAdded);

    if (pubDateMs) normalized.pubDate = new Date(pubDateMs).toISOString();
    else if (Object.prototype.hasOwnProperty.call(normalized, 'pubDate')) normalized.pubDate = '';

    if (dateAddedMs) normalized.dateAdded = dateAddedMs;
    else if (options.defaultDateAdded) normalized.dateAdded = Date.now();
    else delete normalized.dateAdded;

    return normalized;
};

const getNewshuntArticleTimestamp = (article) => {
    if (!article) return null;
    return parseNewshuntTimestamp(article.pubDate) || parseNewshuntTimestamp(article.dateAdded);
};

const cleanupNewshuntArticles = (data, maxAgeDays = NEWSHUNT_RETENTION_DAYS) => {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const articles = data.articles || {};
    const articleContent = data.articleContent || {};
    const result = {
        deletedCount: 0,
        oldArticleCount: 0,
        invalidDateCount: 0,
        normalizedDateCount: 0,
        contentDeletedCount: 0
    };

    for (const guid of Object.keys(articles)) {
        const article = articles[guid];
        const beforePubDate = article && article.pubDate;
        const beforeDateAdded = article && article.dateAdded;
        const normalized = normalizeNewshuntArticleDateFields(article || {});
        const articleDate = getNewshuntArticleTimestamp(normalized);

        if (!articleDate || articleDate < cutoff) {
            delete articles[guid];
            if (Object.prototype.hasOwnProperty.call(articleContent, guid)) {
                delete articleContent[guid];
                result.contentDeletedCount++;
            }
            result.deletedCount++;
            if (!articleDate) result.invalidDateCount++;
            else result.oldArticleCount++;
            continue;
        }

        if (normalized.pubDate !== beforePubDate || normalized.dateAdded !== beforeDateAdded) {
            articles[guid] = normalized;
            result.normalizedDateCount++;
        }
    }

    return result;
};

const cleanupSummary = (cleanup) => {
    const parts = [];
    if (cleanup.oldArticleCount) parts.push(`${cleanup.oldArticleCount} old`);
    if (cleanup.invalidDateCount) parts.push(`${cleanup.invalidDateCount} invalid-date`);
    if (cleanup.normalizedDateCount) parts.push(`${cleanup.normalizedDateCount} date-normalized`);
    return parts.length ? parts.join(', ') : 'none';
};

const normalizeNewshuntArticles = (articles) => {
    const plainArticles = toPlainValue(articles);
    const articleMap = Array.isArray(plainArticles)
        ? Object.fromEntries(
            plainArticles
                .filter(article => isPlainObject(article) && typeof article.guid === 'string' && article.guid.trim())
                .map(article => [article.guid.trim(), article])
        )
        : (isPlainObject(plainArticles) ? plainArticles : {});

    const normalized = {};

    for (const [guid, article] of Object.entries(articleMap)) {
        if (!isPlainObject(article)) continue;

        const normalizedGuid = typeof article.guid === 'string' && article.guid.trim()
            ? article.guid.trim()
            : String(guid || '').trim();

        if (!normalizedGuid) continue;

        normalized[normalizedGuid] = normalizeNewshuntArticleDateFields({
            ...article,
            guid: normalizedGuid
        });
    }

    return normalized;
};

const normalizeNewshuntData = (data = {}) => {
    const plainData = toPlainValue(data) || {};

    return {
        settings: normalizeNewshuntSettings(plainData.settings),
        feeds: normalizeNewshuntFeeds(plainData.feeds),
        articles: normalizeNewshuntArticles(plainData.articles),
        chatHistory: Array.isArray(plainData.chatHistory) ? plainData.chatHistory : [],
        articleContent: isPlainObject(plainData.articleContent) ? { ...plainData.articleContent } : {}
    };
};

const ensureNewshuntDocument = async () => {
    let data = await NewsHuntData.findOne({});

    if (!data) {
        console.log('Seeding NewsHunt data from JSON...');
        let seedData = NEWSHUNT_DEFAULT_STATE;

        if (fs.existsSync(NEWSHUNT_DATA_PATH)) {
            const jsonData = JSON.parse(await fsPromises.readFile(NEWSHUNT_DATA_PATH, 'utf-8'));
            seedData = normalizeNewshuntData(jsonData);
        }

        data = await NewsHuntData.create(seedData);
    }

    return data;
};

const readNewshuntData = async () => {
    try {
        const data = await ensureNewshuntDocument();
        return normalizeNewshuntData(data);
    } catch (e) {
        console.error('Error reading newshunt data:', e);
        throw e;
    }
};

const writeNewshuntData = async (data) => {
    const normalized = normalizeNewshuntData(data);
    
    // Use findOneAndUpdate with upsert to avoid Mongoose VersionError on concurrent writes
    const result = await NewsHuntData.findOneAndUpdate(
        {},
        {
            $set: {
                settings: normalized.settings,
                feeds: normalized.feeds,
                articles: normalized.articles,
                chatHistory: normalized.chatHistory,
                articleContent: normalized.articleContent
            }
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    return result;
};

const applyNewshuntUpdate = async (update = {}) => {
    await ensureNewshuntDocument();
    return NewsHuntData.updateOne(
        {},
        update
    );
};

// GET /api/newshunt/ai-config — provide API keys from environment variables
app.get('/api/newshunt/ai-config', (req, res) => {
    const config = {};
    if (process.env.GROQ_API_KEY) config.groq = process.env.GROQ_API_KEY;
    if (process.env.OPENROUTER_API_KEY) config.openrouter = process.env.OPENROUTER_API_KEY;
    if (process.env.CEREBRAS_API_KEY) config.cerebras = process.env.CEREBRAS_API_KEY;
    if (process.env.NVIDIA_API_KEY) config.nvidia = process.env.NVIDIA_API_KEY;
    if (process.env.GEMINI_API_KEY) config.gemini = process.env.GEMINI_API_KEY;
    if (process.env.MISTRAL_API_KEY) config.mistral = process.env.MISTRAL_API_KEY;
    res.json(config);
});

// ==========================================================================
// SERVER-SIDE BACKGROUND CATEGORIZATION SYSTEM
// ==========================================================================
// The full AI categorization pipeline runs on the server — continues
// running even after the user closes their browser or shuts down their PC.

// --- Background job state ---
const bgJob = {
    active: false,
    phase: null,        // 'fetching'|'saving'|'rating'|'grouping'|'merging'|'done'|'error'
    progress: null,     // e.g. "8/24"
    startedAt: null,
    finishedAt: null,
    newArticlesCount: 0,
    error: null,
    lastMessage: ''
};

function bgLog(phase, message, progress) {
    bgJob.phase = phase;
    bgJob.lastMessage = message;
    if (progress !== undefined) bgJob.progress = progress;
    console.log('[BG] [' + phase + '] ' + message + (progress ? ' (' + progress + ')' : ''));
}

// --- Server-side RSS fetch + XML parse ---
function parseNewsXml(xmlText, feedUrl) {
    const $ = cheerio.load(xmlText, { xmlMode: true });
    const items = [];
    const strip = (h) => (h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const trunc = (s, n) => s && s.length > n ? s.slice(0, n) : (s || '');
    const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0; return Math.abs(h).toString(36); };
    const isAtom = $('feed').length > 0;
    if (isAtom) {
        const feedTitle = $('feed > title').first().text().trim();
        $('entry').each((_, el) => {
            const title = $(el).find('title').first().text().trim();
            const link = $(el).find('link[rel="alternate"]').attr('href') || $(el).find('link').first().attr('href') || '';
            const desc = strip($(el).find('summary').text() || $(el).find('content').text());
            const pubDate = $(el).find('published').text() || $(el).find('updated').text() || '';
            const id = $(el).find('id').text() || link;
            const cats = []; $(el).find('category').each((__, c) => cats.push($(c).attr('term') || $(c).text()));
            items.push(normalizeNewshuntArticleDateFields({ guid: hash(id || title + link), title, link: link.trim(), description: trunc(desc, 500), pubDate, feedUrl, feedTitle, creator: '', categories: cats, image: '', dateAdded: Date.now(), isRead: false, stars: null, ratingReason: null }, { defaultDateAdded: true }));
        });
    } else {
        const feedTitle = $('channel > title').first().text().trim();
        $('item').each((_, el) => {
            const title = $(el).find('title').first().text().trim();
            const link = $(el).find('link').first().text().trim();
            const desc = strip($(el).find('description').text() || $(el).find('encoded').text());
            const pubDate = $(el).find('pubDate').text();
            const id = $(el).find('guid').text() || link || hash(title + link);
            const creator = $(el).find('creator').text() || '';
            const cats = []; $(el).find('category').each((__, c) => cats.push($(c).text()));
            let image = ''; const enc = $(el).find('enclosure[type^="image"]'); if (enc.length) image = enc.attr('url') || '';
            items.push(normalizeNewshuntArticleDateFields({ guid: hash(id), title, link: link.trim(), description: trunc(desc, 500), pubDate, feedUrl, feedTitle, creator, categories: cats, image, dateAdded: Date.now(), isRead: false, stars: null, ratingReason: null }, { defaultDateAdded: true }));
        });
    }
    return items;
}

async function serverFetchAllFeeds(feeds) {
    const allItems = [];
    const errors = [];
    const baseURL = 'http://localhost:' + (process.env.PORT || 3000);
    await Promise.allSettled(feeds.map(async (feed) => {
        try {
            const resp = await axios.get(baseURL + '/proxy?url=' + encodeURIComponent(feed.url), {
                timeout: 25000,
                headers: { 'User-Agent': 'NewsHunt-Server/1.0', 'Accept': 'application/xml,text/xml,*/*' }
            });
            allItems.push(...parseNewsXml(resp.data, feed.url));
        } catch (e) {
            errors.push({ url: feed.url, error: e.message });
            console.warn('[BG] Feed error (' + feed.url + '):', e.message);
        }
    }));
    const uniqueMap = new Map();
    allItems.forEach(item => { if (!uniqueMap.has(item.guid)) uniqueMap.set(item.guid, item); });
    const data = await readNewshuntData();
    const cleanup = cleanupNewshuntArticles(data);
    if (cleanup.deletedCount > 0 || cleanup.normalizedDateCount > 0) {
        await writeNewshuntData(data);
    }
    const existingGuids = new Set(Object.keys(data.articles || {}));
    const newArticles = [...uniqueMap.values()].filter(a => !existingGuids.has(a.guid));
    return { newArticles, errors };
}

// --- Server-side AI caller ---
const SRV_AI = {
    groq:       { url: 'https://api.groq.com/openai/v1/chat/completions',        env: 'GROQ_API_KEY',       defaultModel: 'llama-3.3-70b-versatile' },
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions',           env: 'OPENROUTER_API_KEY', defaultModel: 'google/gemini-2.0-flash-001' },
    cerebras:   { url: 'https://api.cerebras.ai/v1/chat/completions',             env: 'CEREBRAS_API_KEY',   defaultModel: 'llama3.1-8b' },
    nvidia:     { url: 'https://integrate.api.nvidia.com/v1/chat/completions',     env: 'NVIDIA_API_KEY',    defaultModel: 'z-ai/glm4.7' },
    mistral:    { url: 'https://api.mistral.ai/v1/chat/completions',              env: 'MISTRAL_API_KEY',    defaultModel: 'mistral-small-2603' },
    gemini:     { url: 'https://generativelanguage.googleapis.com/v1beta/models', env: 'GEMINI_API_KEY',     defaultModel: 'gemini-2.0-flash' }
};

function normalizeServerAIModel(provider, model) {
    const raw = String(model || '').trim();
    if (!raw) return raw;

    const normalized = raw.toLowerCase().replace(/[\s_]+/g, '-');
    if (provider === 'cerebras' && ['glm-4.7', 'glm4.7', 'z-ai/glm4.7', 'zai-glm-4.7'].includes(normalized)) {
        return 'zai-glm-4.7';
    }

    if (provider === 'nvidia' && ['glm-4.7', 'glm4.7', 'zai-glm-4.7', 'z-ai/glm4.7'].includes(normalized)) {
        return 'z-ai/glm4.7';
    }

    return raw;
}

function isServerAIThinkingPart(part) {
    if (!part || typeof part !== 'object') return false;
    const type = String(part.type || '').toLowerCase();
    const role = String(part.role || '').toLowerCase();
    return part.thought === true
        || type === 'reasoning'
        || type === 'reasoning_content'
        || type === 'thinking'
        || type === 'thought'
        || role === 'thought';
}

function extractServerAITextParts(value) {
    let content = '';
    let reasoning = '';
    const parts = Array.isArray(value) ? value : [value];

    for (const part of parts) {
        if (typeof part === 'string') {
            content += part;
            continue;
        }

        if (!part || typeof part !== 'object') continue;
        const text = typeof part.text === 'string'
            ? part.text
            : (typeof part.content === 'string' ? part.content : '');
        if (!text) continue;

        if (isServerAIThinkingPart(part)) reasoning += text;
        else content += text;
    }

    return { content, reasoning };
}

function flattenServerAIText(value) {
    const parts = extractServerAITextParts(value);
    return `${parts.content}${parts.reasoning}`;
}

function extractServerAIMessageText(message = {}) {
    const contentParts = extractServerAITextParts(message.content);
    return [
        contentParts.content,
        flattenServerAIText(message.reasoning_content),
        flattenServerAIText(message.reasoning),
        contentParts.reasoning
    ].filter(Boolean).join('');
}

async function callAIServer(messages, options, settings) {
    options = options || {};
    settings = settings || {};
    let provider, model;
    const taskKey = options.task ? ('task_model_' + options.task) : null;
    const taskModel = taskKey ? settings[taskKey] : null;
    if (taskModel && taskModel.provider && taskModel.model) { provider = taskModel.provider; model = taskModel.model; }
    else {
        const def = settings['ai_default_model'];
        if (def && def.provider && def.model) { provider = def.provider; model = def.model; }
        else { provider = settings['ai_provider'] || 'groq'; model = settings['ai_model'] || (SRV_AI[provider] || {}).defaultModel || ''; }
    }
    model = normalizeServerAIModel(provider, model);
    const prov = SRV_AI[provider];
    if (!prov) throw new Error('Unknown AI provider: ' + provider);
    const apiKey = process.env[prov.env] || settings['api_key_' + provider] || settings['ai_api_key'] || '';
    if (!apiKey) throw new Error('No API key for "' + provider + '". Set env var ' + prov.env + ' or configure in NewsHunt Settings.');

    if (provider === 'gemini') {
        const url = prov.url + '/' + model + ':generateContent?key=' + apiKey;
        const contents = []; let sysInst = null;
        for (const m of messages) {
            if (m.role === 'system') sysInst = { parts: [{ text: m.content }] };
            else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
        }
        const genCfg = { temperature: options.temperature != null ? options.temperature : 0.1, maxOutputTokens: options.max_tokens || 4096 };
        if (options.response_format && options.response_format.type === 'json_object') genCfg.responseMimeType = 'application/json';
        const body = { contents, generationConfig: genCfg, ...(sysInst ? { systemInstruction: sysInst } : {}) };
        const r = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 90000 });
        return (r.data.candidates[0].content.parts || []).map(p => p.text || '').join('');
    }

    const hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
    if (provider === 'openrouter') { hdrs['HTTP-Referer'] = 'https://newshunt-app'; hdrs['X-Title'] = 'NewsHunt'; }
    const base = { model, messages, temperature: options.temperature != null ? options.temperature : 0.1, max_tokens: options.max_tokens || 4096 };
    const jsonBody = Object.assign({}, base, options.response_format ? { response_format: options.response_format } : {});
    const attempts = provider === 'nvidia'
        ? [
            Object.assign({}, jsonBody, { chat_template_kwargs: { enable_thinking: false, clear_thinking: true } }),
            Object.assign({}, base, { chat_template_kwargs: { enable_thinking: false, clear_thinking: true } }),
            jsonBody,
            base
        ]
        : [jsonBody, base];
    let lastErr;
    for (const body of attempts) {
        try {
            const r = await axios.post(prov.url, body, { headers: hdrs, timeout: 90000 });
            return extractServerAIMessageText(r.data.choices && r.data.choices[0] && r.data.choices[0].message || {});
        }
        catch (e) { lastErr = (e.response && e.response.data && e.response.data.error && e.response.data.error.message) || e.message; }
    }
    throw new Error(lastErr || 'AI request failed');
}

function buildInvestingLabFallbackFeedback(body = {}) {
    const answer = String(body.answer || '').toLowerCase();
    const context = isPlainObject(body.context) ? body.context : {};
    const metrics = isPlainObject(context.metrics) ? context.metrics : {};
    const checks = [];

    if (answer.includes('risk') || answer.includes('stop') || answer.includes('loss')) {
        checks.push('Good: tumne risk control mention kiya. Ab isko position size, stop level, aur maximum loss mein convert karo before simulator trade.');
    } else {
        checks.push('Missing: risk plan add karo. Jab tak invalidation, stop loss, aur position size defined nahi hai, trade idea incomplete hai.');
    }

    if (answer.includes('debt') || answer.includes('cash') || answer.includes('roe') || answer.includes('pe') || answer.includes('growth')) {
        checks.push('Good: tum decision ko business numbers se link kar rahe ho. Har metric ko sector se compare karo aur dekho price ne already ye expectation discount kiya hai ya nahi.');
    } else {
        checks.push('Missing: research page se at least do numbers mention karo, jaise ROE, debt/equity, growth, P/E, cash flow, ya promoter pledge.');
    }

    if (answer.includes('support') || answer.includes('resistance') || answer.includes('volume') || answer.includes('trend')) {
        checks.push('Good: tumne research ko market behavior se connect kiya. Price chase karne ke bajay chart se execution timing decide karo.');
    } else {
        checks.push('Next step: chart trigger add karo. Decide karo action support ke paas hoga, breakout par hoga, ya volume confirmation ke baad.');
    }

    if (metrics.debtEquity && Number(metrics.debtEquity) > 1.2) {
        checks.push('Watch item: is drill mein debt/equity elevated hai, isliye bullish view tabhi valid hoga jab tum explain kar pao ki debt risk acceptable kyun hai.');
    }

    return [
        'Rule-based coach feedback:',
        ...checks,
        'Before trading: thesis ek sentence mein likho, opposite evidence list karo, phir sirf wahi paper order place karo jo plan se match karta hai.'
    ].join('\n- ');
}

app.post('/api/investing-lab/ai-feedback', async (req, res) => {
    try {
        const payload = isPlainObject(req.body) ? req.body : {};
        const answer = String(payload.answer || '').trim().slice(0, 4500);
        const prompt = String(payload.prompt || '').trim().slice(0, 1200);
        const context = isPlainObject(payload.context) ? payload.context : {};

        if (!answer) {
            return res.status(400).json({ error: 'Answer is required for AI feedback' });
        }

        const contextText = JSON.stringify(context, null, 2).slice(0, 5000);
        const messages = [
            {
                role: 'system',
                content: [
                    'You are an investing lab coach for beginner stock market students.',
                    'Always answer in simple Hinglish by default because the learner may not understand advanced English. Use Hindi-English mixed explanations with familiar market terms.',
                    'Give strict but encouraging training feedback. This is simulated education, not financial advice.',
                    'Use Indian market language when relevant: Rs, NSE/BSE, delivery, intraday, option chain, support, resistance, and position sizing.',
                    'Evaluate whether the learner used the right numbers, interpreted them correctly, controlled risk, and avoided emotional trading.',
                    'Keep the response concise in markdown with sections: Score, Sahi reasoning, Missing evidence, Risk check, Next simulator action.'
                ].join(' ')
            },
            {
                role: 'user',
                content: [
                    'Assignment prompt:',
                    prompt || 'Review the learner interpretation.',
                    '',
                    'Research/simulator context:',
                    contextText,
                    '',
                    'Learner interpretation:',
                    answer
                ].join('\n')
            }
        ];

        let aiSettings = {};
        try {
            const newshuntData = await readNewshuntData();
            aiSettings = isPlainObject(newshuntData.settings) ? newshuntData.settings : {};
        } catch (settingsError) {
            console.warn('Investing lab could not read AI settings:', settingsError.message);
        }

        const feedback = await callAIServer(messages, {
            temperature: 0.2,
            max_tokens: 700
        }, aiSettings);

        res.json({ success: true, source: 'ai', feedback: String(feedback || '').trim() });
    } catch (error) {
        console.warn('Investing lab AI feedback fallback:', error.message);
        res.json({
            success: true,
            source: 'rule-based',
            feedback: buildInvestingLabFallbackFeedback(req.body)
        });
    }
});

function buildInvestingLabResearchHelpFallback(body = {}) {
    const context = isPlainObject(body.context) ? body.context : {};
    const label = String(context.label || context.topic || 'this research section').trim();
    const value = String(context.value || '').trim();
    const help = String(context.help || 'Use this information as one input in the research process.').trim();
    const question = String(body.question || '').trim();

    return [
        `**${label}**`,
        '',
        help + (value ? ` Abhi value: ${value}.` : ''),
        '',
        'Kaise use karna hai:',
        '- Pehle samjho ye number kya measure karta hai.',
        '- Phir decide karo ye tumhari thesis ko support karta hai ya weak karta hai.',
        '- Finally isko risk, valuation, chart level, aur opposite evidence ke saath connect karo before simulator trade.',
        question ? `\nTumhare question ke liye: ${question}` : ''
    ].filter(Boolean).join('\n');
}

app.post('/api/investing-lab/research-help', async (req, res) => {
    try {
        const payload = isPlainObject(req.body) ? req.body : {};
        const question = String(payload.question || '').trim().slice(0, 1200);
        const context = isPlainObject(payload.context) ? payload.context : {};
        const history = Array.isArray(payload.messages) ? payload.messages.slice(-8) : [];
        const contextText = JSON.stringify(context, null, 2).slice(0, 5000);
        const historyText = history.map(message => {
            const role = message && message.role === 'user' ? 'Learner' : 'Coach';
            return `${role}: ${String((message && message.content) || '').slice(0, 900)}`;
        }).join('\n');

        const messages = [
            {
                role: 'system',
                content: [
                    'You are an AI research tutor inside a simulated Indian stock market learning lab.',
                    'Always answer in simple Hinglish by default because the learner may not understand advanced English. Use Hindi-English mixed explanations with familiar market terms.',
                    'Explain the selected research section in simple, practical language for a beginner.',
                    'Use Indian market language when relevant: Rs, NSE/BSE, delivery, intraday, support, resistance, option chain, OI, IV, theta, risk, and position sizing.',
                    'Do not give real financial advice. Teach how to interpret the section and what the learner should check next.',
                    'Return concise markdown with Hinglish sections: Meaning, Kaise read karein, Common mistake, Worksheet mein kya likhna hai.'
                ].join(' ')
            },
            {
                role: 'user',
                content: [
                    'Selected research context:',
                    contextText,
                    '',
                    historyText ? `Chat so far:\n${historyText}\n` : '',
                    'Learner question:',
                    question || 'Explain this section clearly and tell me how to use it in my research.'
                ].join('\n')
            }
        ];

        let aiSettings = {};
        try {
            const newshuntData = await readNewshuntData();
            aiSettings = isPlainObject(newshuntData.settings) ? newshuntData.settings : {};
        } catch (settingsError) {
            console.warn('Investing lab could not read research help AI settings:', settingsError.message);
        }

        const answer = await callAIServer(messages, {
            temperature: 0.2,
            max_tokens: 750
        }, aiSettings);

        res.json({ success: true, source: 'ai', answer: String(answer || '').trim() });
    } catch (error) {
        console.warn('Investing lab research help fallback:', error.message);
        res.json({
            success: true,
            source: 'rule-based',
            answer: buildInvestingLabResearchHelpFallback(req.body)
        });
    }
});

function cleanJson(text) {
    let s = String(text || '').trim();
    if (s.startsWith('```')) s = s.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    return s.replace(/[\u0000-\u0019]+/g, '');
}

function extractBalancedJson(text, openChar, closeChar) {
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === '\\' && inString) {
            escaped = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (ch === openChar) {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === closeChar) {
            depth--;
            if (depth === 0 && start !== -1) {
                return text.slice(start, i + 1);
            }
        }
    }

    return start !== -1 ? text.slice(start) : '';
}

function parseServerRatingsResponse(responseText) {
    const cleaned = cleanJson(responseText);
    const candidates = [
        cleaned,
        extractBalancedJson(cleaned, '{', '}'),
        extractBalancedJson(cleaned, '[', ']')
    ].filter(Boolean);
    let lastError = null;

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            const ratings = Array.isArray(parsed) ? parsed : (parsed && parsed.ratings);
            if (!Array.isArray(ratings)) {
                throw new Error('Response JSON did not contain a ratings array');
            }

            return ratings
                .map(rating => ({
                    index: Number(rating && rating.index),
                    stars: Number(rating && rating.stars),
                    reason: String((rating && rating.reason) || '').trim()
                }))
                .filter(rating =>
                    Number.isInteger(rating.index)
                    && rating.index >= 0
                    && Number.isInteger(rating.stars)
                    && rating.stars >= 1
                    && rating.stars <= 5
                );
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to parse ratings JSON');
}

function parseServerJsonObjectResponse(responseText) {
    const cleaned = cleanJson(responseText);
    const candidates = [
        cleaned,
        extractBalancedJson(cleaned, '{', '}')
    ].filter(Boolean);
    let lastError = null;

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Response JSON was not an object');
            }
            return parsed;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to parse JSON object');
}

function parseServerJsonArrayResponse(responseText) {
    const cleaned = cleanJson(responseText);
    const candidates = [
        cleaned,
        extractBalancedJson(cleaned, '[', ']')
    ].filter(Boolean);
    let lastError = null;

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (!Array.isArray(parsed)) {
                throw new Error('Response JSON was not an array');
            }
            return parsed;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to parse JSON array');
}

async function rateServerArticleBatch(batch, settings, promptContext, progressLabel) {
    if (!Array.isArray(batch) || batch.length === 0) return 0;

    const iText = promptContext && promptContext.iText || '';
    const aText = promptContext && promptContext.aText || '';
    const cText = promptContext && promptContext.cText || '';
    const articleList = batch.map((a, idx) =>
        '[' + idx + '] Title: "' + a.title + '"\nSource: ' + (a.feedTitle || 'Unknown') + '\nDescription: ' + (a.description || '').slice(0, 160) + '\nCategories: ' + ((a.categories || []).join(', ') || 'N/A')
    ).join('\n\n');
    const prompt = 'You are an intelligent news curator. Rate each article 1-5 stars.\n5=Must Read (major world events, policy, AI/tech breakthroughs, financial impact)\n4=High Value (important analysis, industry news)\n3=Interesting (worth reading, not urgent)\n2=Low Value (minor/niche)\n1=Skip (clickbait, gossip, redundant)\nRules: +1 star for user interests, force 1 star for avoid topics.' + iText + aText + cText + '\n\n## Articles\n' + articleList + '\n\nRespond ONLY with JSON:\n{"ratings":[{"index":0,"stars":4,"reason":"Brief reason under 18 words"}]}';

    for (let att = 0; att < 3; att++) {
        try {
            bgLog('rating', 'Rating articles', progressLabel);
            const resp = await callAIServer(
                [{ role: 'system', content: 'Return only valid JSON matching the schema.' }, { role: 'user', content: prompt }],
                { temperature: 0.1, max_tokens: 3000, response_format: { type: 'json_object' }, task: 'categorize' },
                settings
            );
            const ratings = parseServerRatingsResponse(resp);
            const fresh = await readNewshuntData();
            const appliedIndexes = new Set();
            let applied = 0;

            for (const r of ratings) {
                if (appliedIndexes.has(r.index)) continue;
                const art = batch[r.index];
                if (!art) continue;
                if (fresh.articles[art.guid]) {
                    fresh.articles[art.guid].stars = r.stars;
                    fresh.articles[art.guid].ratingReason = String(r.reason || '').trim();
                    fresh.articles[art.guid].ratedAt = Date.now();
                    appliedIndexes.add(r.index);
                    applied++;
                }
            }

            if (applied === 0) {
                throw new Error('AI response contained no usable ratings for this batch');
            }

            await writeNewshuntData(fresh);

            if (appliedIndexes.size === batch.length) {
                return applied;
            }

            const missingArticles = batch.filter((_, index) => !appliedIndexes.has(index));
            bgLog('rating', 'Retrying ' + missingArticles.length + ' articles missed by the previous rating response', progressLabel);
            return applied + await rateServerArticleBatch(missingArticles, settings, promptContext, progressLabel);
        } catch (e) {
            if (att >= 2) {
                if (batch.length > 1) {
                    const midpoint = Math.ceil(batch.length / 2);
                    bgLog('rating', 'Splitting rating batch after repeated failures', progressLabel);
                    return await rateServerArticleBatch(batch.slice(0, midpoint), settings, promptContext, progressLabel)
                        + await rateServerArticleBatch(batch.slice(midpoint), settings, promptContext, progressLabel);
                }

                console.error('[BG] Rating batch failed:', e.message);
                throw e;
            }

            await new Promise(r => setTimeout(r, 1000 * (att + 1)));
        }
    }

    return 0;
}

// Pass 1: Star-rate uncategorized articles in batches
async function bgRate(settings) {
    const data = await readNewshuntData();
    const uncats = Object.values(data.articles || {}).filter(a => a.stars == null);
    if (uncats.length === 0) return 0;
    const interests = settings['interests'] || [];
    const avoid = settings['avoid_topics'] || [];
    const custom = settings['custom_instructions'] || '';
    const iText = interests.length ? '\n**User interests**: ' + interests.join(', ') : '';
    const aText = avoid.length ? '\n**Topics to avoid**: ' + avoid.join(', ') : '';
    const cText = custom ? '\n**Additional context**: "' + custom + '"' : '';
    const BATCH = 8;
    let total = 0;
    for (let i = 0; i < uncats.length; i += BATCH) {
        const batch = uncats.slice(i, i + BATCH);
        total += await rateServerArticleBatch(batch, settings, { iText, aText, cText }, Math.min(i + BATCH, uncats.length) + '/' + uncats.length);
        if (i + BATCH < uncats.length) await new Promise(r => setTimeout(r, 800));
    }
    return total;
}

// Pass 2: Group duplicate stories + assign topic tags
async function bgGroupAndTag(settings) {
    const data = await readNewshuntData();
    const untagged = Object.values(data.articles || {}).filter(a => !a.topics || a.topics.length === 0);
    if (untagged.length === 0) return { grouped: 0, tagged: 0 };
    const BATCH = 30;
    let grouped = 0, tagged = 0;
    for (let i = 0; i < untagged.length; i += BATCH) {
        const batch = untagged.slice(i, i + BATCH);
        bgLog('grouping', 'Grouping & tagging', Math.min(i + BATCH, untagged.length) + '/' + untagged.length);
        const list = batch.map((a, idx) => '[' + idx + '] "' + a.title + '" (' + (a.feedTitle || 'Unknown') + ', ' + (a.stars || '?') + ' stars)').join('\n');
        const prompt = 'You are a news editor. For these articles:\n1. Group articles covering the EXACT same news event (pick best as primary).\n2. Assign 1-3 specific event tags to every article (e.g. "Russia-Ukraine War", "ISRO Launch" — not generic "World News").\n\n## Articles\n' + list + '\n\nRespond with ONLY valid JSON:\n{"groups":[{"primaryIndex":0,"relatedIndices":[3],"groupLabel":"Specific event"}],"topics":[{"index":0,"tags":["Tag One","Tag Two"]}]}\n\nEvery article must appear in topics. Tags: 2-4 words, title-cased.';
        try {
            const resp = await callAIServer(
                [{ role: 'system', content: 'Return only valid JSON. No markdown.' }, { role: 'user', content: prompt }],
                { temperature: 0.1, max_tokens: 4096, task: 'group' },
                settings
            );
            const result = parseServerJsonObjectResponse(resp);
            const fresh = await readNewshuntData();
            if (result.groups) {
                for (const grp of result.groups) {
                    const primary = batch[grp.primaryIndex];
                    if (!primary || !fresh.articles[primary.guid]) continue;
                    const gid = primary.guid;
                    Object.assign(fresh.articles[primary.guid], { groupId: gid, isGroupPrimary: true, groupLabel: grp.groupLabel, relatedCount: (grp.relatedIndices || []).length });
                    for (const ri of (grp.relatedIndices || [])) {
                        const rel = batch[ri];
                        if (rel && rel.guid !== primary.guid && fresh.articles[rel.guid]) {
                            Object.assign(fresh.articles[rel.guid], { groupId: gid, isGroupPrimary: false, groupLabel: grp.groupLabel, relatedCount: 0 });
                            grouped++;
                        }
                    }
                }
            }
            if (result.topics) {
                for (const t of result.topics) {
                    const art = batch[t.index];
                    if (art && t.tags && t.tags.length > 0 && fresh.articles[art.guid]) {
                        fresh.articles[art.guid].topics = t.tags;
                        tagged++;
                    }
                }
            }
            await writeNewshuntData(fresh);
        } catch (e) { console.error('[BG] Group batch failed:', e.message); throw e; }
        if (i + BATCH < untagged.length) await new Promise(r => setTimeout(r, 800));
    }
    return { grouped, tagged };
}

async function groupServerArticleBatchV2(batch, settings, progressLabel) {
    if (!Array.isArray(batch) || batch.length === 0) return { grouped: 0, tagged: 0 };

    const list = batch.map((a, idx) => '[' + idx + '] "' + a.title + '" (' + (a.feedTitle || 'Unknown') + ', ' + (a.stars || '?') + ' stars)').join('\n');
    const prompt = 'You are a news editor. For these articles:\n1. Group articles covering the exact same news event and pick the best primary article.\n2. Assign 1-3 specific event tags to every article.\n\nUse specific event tags like \"Russia Ukraine War\" or \"ISRO Launch\", not broad labels like \"World News\" or \"Technology\".\n\n## Articles\n' + list + '\n\nRespond only with valid JSON in this shape:\n{"groups":[{"primaryIndex":0,"relatedIndices":[3],"groupLabel":"Specific event"}],"topics":[{"index":0,"tags":["Tag One","Tag Two"]}]}\n\nEvery article must appear in topics. Tags must be 2-4 words and title-cased.';

    for (let att = 0; att < 3; att++) {
        try {
            bgLog('grouping', 'Grouping & tagging', progressLabel);
            const resp = await callAIServer(
                [{ role: 'system', content: 'Return only valid JSON. No markdown, no prose, no reasoning.' }, { role: 'user', content: prompt }],
                { temperature: 0.1, max_tokens: 4096, response_format: { type: 'json_object' }, task: 'group' },
                settings
            );
            const result = parseServerJsonObjectResponse(resp);
            const fresh = await readNewshuntData();
            let grouped = 0, tagged = 0;
            const taggedIndexes = new Set();

            if (Array.isArray(result.groups)) {
                for (const grp of result.groups) {
                    const primaryIndex = Number(grp && grp.primaryIndex);
                    const primary = batch[primaryIndex];
                    if (!Number.isInteger(primaryIndex) || !primary || !fresh.articles[primary.guid]) continue;
                    const relatedIndices = Array.isArray(grp.relatedIndices)
                        ? grp.relatedIndices.map(Number).filter(Number.isInteger)
                        : [];
                    const gid = primary.guid;
                    Object.assign(fresh.articles[primary.guid], {
                        groupId: gid,
                        isGroupPrimary: true,
                        groupLabel: String(grp.groupLabel || '').trim(),
                        relatedCount: relatedIndices.length
                    });
                    for (const ri of relatedIndices) {
                        const rel = batch[ri];
                        if (rel && rel.guid !== primary.guid && fresh.articles[rel.guid]) {
                            Object.assign(fresh.articles[rel.guid], {
                                groupId: gid,
                                isGroupPrimary: false,
                                groupLabel: String(grp.groupLabel || '').trim(),
                                relatedCount: 0
                            });
                            grouped++;
                        }
                    }
                }
            }

            if (Array.isArray(result.topics)) {
                for (const topicItem of result.topics) {
                    const index = Number(topicItem && topicItem.index);
                    const art = batch[index];
                    const tags = Array.isArray(topicItem && topicItem.tags)
                        ? topicItem.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 3)
                        : [];
                    if (Number.isInteger(index) && art && tags.length > 0 && fresh.articles[art.guid]) {
                        fresh.articles[art.guid].topics = tags;
                        taggedIndexes.add(index);
                        tagged++;
                    }
                }
            }

            if (tagged === 0) {
                throw new Error('AI response contained no usable topic tags for this batch');
            }

            await writeNewshuntData(fresh);

            if (taggedIndexes.size === batch.length) {
                return { grouped, tagged };
            }

            const missingArticles = batch.filter((_, index) => !taggedIndexes.has(index));
            bgLog('grouping', 'Retrying ' + missingArticles.length + ' articles missed by the previous topic response', progressLabel);
            const recovered = await groupServerArticleBatchV2(missingArticles, settings, progressLabel);
            return { grouped: grouped + recovered.grouped, tagged: tagged + recovered.tagged };
        } catch (e) {
            if (att >= 2) {
                if (batch.length > 1) {
                    const midpoint = Math.ceil(batch.length / 2);
                    bgLog('grouping', 'Splitting grouping batch after repeated failures', progressLabel);
                    const left = await groupServerArticleBatchV2(batch.slice(0, midpoint), settings, progressLabel);
                    const right = await groupServerArticleBatchV2(batch.slice(midpoint), settings, progressLabel);
                    return { grouped: left.grouped + right.grouped, tagged: left.tagged + right.tagged };
                }

                console.error('[BG] Group batch failed:', e.message);
                throw e;
            }

            await new Promise(r => setTimeout(r, 1000 * (att + 1)));
        }
    }

    return { grouped: 0, tagged: 0 };
}

async function bgGroupAndTagV2(settings) {
    const data = await readNewshuntData();
    const untagged = Object.values(data.articles || {}).filter(a => !a.topics || a.topics.length === 0);
    if (untagged.length === 0) return { grouped: 0, tagged: 0 };
    const BATCH = 30;
    let grouped = 0, tagged = 0;

    for (let i = 0; i < untagged.length; i += BATCH) {
        const batch = untagged.slice(i, i + BATCH);
        const result = await groupServerArticleBatchV2(batch, settings, Math.min(i + BATCH, untagged.length) + '/' + untagged.length);
        grouped += result.grouped;
        tagged += result.tagged;
        if (i + BATCH < untagged.length) await new Promise(r => setTimeout(r, 800));
    }

    return { grouped, tagged };
}

// Pass 3: Merge redundant topic labels globally
async function bgMergeTopics(settings) {
    const data = await readNewshuntData();
    const topicMap = {};
    Object.values(data.articles || {}).forEach(a => (a.topics || []).forEach(t => { topicMap[t] = (topicMap[t] || 0) + 1; }));
    const topics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]);
    if (topics.length < 2) return 0;
    bgLog('merging', 'Merging redundant topic labels');
    const list = topics.map((t, i) => '[' + i + '] "' + t[0] + '" (' + t[1] + ' articles)').join('\n');
    const prompt = 'Identify duplicate/redundant topic labels that mean the same thing (e.g., "AI" = "Artificial Intelligence").\n\nTopics:\n' + list + '\n\nReturn ONLY a JSON array:\n[{"primary":"Best name","aliases":["Alias to merge"]}]\n\nIf none, return []. Aliases must exactly match names from the list above.';
    try {
        const resp = await callAIServer(
            [{ role: 'system', content: 'Return only a valid JSON array.' }, { role: 'user', content: prompt }],
            { temperature: 0.0, max_tokens: 2000, task: 'group' },
            settings
        );
        const merges = parseServerJsonArrayResponse(resp);
        if (!Array.isArray(merges) || merges.length === 0) return 0;
        const fresh = await readNewshuntData();
        let count = 0;
        for (const merge of merges) {
            if (!merge.primary || !Array.isArray(merge.aliases)) continue;
            for (const art of Object.values(fresh.articles)) {
                if (!art.topics || !art.topics.length) continue;
                const s = new Set(art.topics);
                let changed = false;
                for (const alias of merge.aliases) {
                    if (alias !== merge.primary && s.has(alias)) { s.delete(alias); s.add(merge.primary); changed = true; count++; }
                }
                if (changed) art.topics = Array.from(s);
            }
        }
        if (count > 0) await writeNewshuntData(fresh);
        return count;
    } catch (e) { console.error('[BG] Topic merge failed:', e.message); return 0; }
}

function parseServerTopicMergesResponse(responseText) {
    try {
        const parsed = parseServerJsonObjectResponse(responseText);
        return Array.isArray(parsed.merges) ? parsed.merges : [];
    } catch {
        return parseServerJsonArrayResponse(responseText);
    }
}

async function requestTopicMergeBatch(topicBatch, settings, progressLabel) {
    if (!Array.isArray(topicBatch) || topicBatch.length < 2) return [];

    const list = topicBatch.map((t, i) => '[' + i + '] "' + t[0] + '" (' + t[1] + ' articles)').join('\n');
    const prompt = 'Identify duplicate or redundant topic labels that mean the same thing. Use only exact names from this list as aliases.\n\nTopics:\n' + list + '\n\nRespond only with valid JSON in this shape:\n{"merges":[{"primary":"Best name","aliases":["Alias to merge"]}]}\n\nIf none, return {"merges":[]}.';

    for (let att = 0; att < 3; att++) {
        try {
            bgLog('merging', 'Merging redundant topic labels', progressLabel);
            const resp = await callAIServer(
                [{ role: 'system', content: 'Return only a valid JSON object. No markdown, no prose, no reasoning.' }, { role: 'user', content: prompt }],
                { temperature: 0.0, max_tokens: 2500, response_format: { type: 'json_object' }, task: 'group' },
                settings
            );
            return parseServerTopicMergesResponse(resp);
        } catch (e) {
            if (att >= 2) {
                if (topicBatch.length > 30) {
                    const midpoint = Math.ceil(topicBatch.length / 2);
                    const left = await requestTopicMergeBatch(topicBatch.slice(0, midpoint), settings, progressLabel);
                    const right = await requestTopicMergeBatch(topicBatch.slice(midpoint), settings, progressLabel);
                    return [...left, ...right];
                }

                console.error('[BG] Topic merge batch failed:', e.message);
                return [];
            }

            await new Promise(r => setTimeout(r, 1000 * (att + 1)));
        }
    }

    return [];
}

async function bgMergeTopicsV2(settings) {
    const data = await readNewshuntData();
    const topicMap = {};
    Object.values(data.articles || {}).forEach(a => (a.topics || []).forEach(t => {
        const topic = String(t || '').trim();
        if (topic) topicMap[topic] = (topicMap[topic] || 0) + 1;
    }));

    const topics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]);
    if (topics.length < 2) return 0;

    const BATCH = 100;
    const merges = [];
    for (let i = 0; i < topics.length; i += BATCH) {
        const batch = topics.slice(i, i + BATCH);
        merges.push(...await requestTopicMergeBatch(batch, settings, Math.min(i + BATCH, topics.length) + '/' + topics.length));
        if (i + BATCH < topics.length) await new Promise(r => setTimeout(r, 800));
    }

    if (merges.length === 0) return 0;

    const fresh = await readNewshuntData();
    let count = 0;
    for (const merge of merges) {
        if (!merge || !merge.primary || !Array.isArray(merge.aliases)) continue;
        const primary = String(merge.primary).trim();
        const aliases = merge.aliases.map(alias => String(alias || '').trim()).filter(alias => alias && alias !== primary);
        if (!primary || aliases.length === 0) continue;

        for (const art of Object.values(fresh.articles || {})) {
            if (!Array.isArray(art.topics) || art.topics.length === 0) continue;
            const s = new Set(art.topics);
            let changed = false;
            for (const alias of aliases) {
                if (s.has(alias)) {
                    s.delete(alias);
                    s.add(primary);
                    changed = true;
                    count++;
                }
            }
            if (changed) art.topics = Array.from(s);
        }
    }

    if (count > 0) await writeNewshuntData(fresh);
    return count;
}

// --- Main background job orchestrator ---
async function runBackgroundJob(opts) {
    const categorizeOnly = opts && opts.categorizeOnly;
    if (bgJob.active) return false;
    bgJob.active = true;
    bgJob.startedAt = Date.now();
    bgJob.finishedAt = null;
    bgJob.error = null;
    bgJob.newArticlesCount = 0;
    bgJob.progress = null;

    // Runs async — does NOT block the HTTP response
    (async () => {
        try {
            const data = await readNewshuntData();
            const settings = data.settings || {};

            if (!categorizeOnly) {
                bgLog('fetching', 'Fetching RSS feeds');
                const feeds = Array.isArray(data.feeds) ? data.feeds : [];
                if (feeds.length === 0) { bgLog('done', 'No feeds configured'); return; }
                const { newArticles, errors } = await serverFetchAllFeeds(feeds);
                bgJob.newArticlesCount = newArticles.length;
                bgLog('saving', 'Saving ' + newArticles.length + ' new articles, ' + errors.length + ' errors');
                const fresh = await readNewshuntData();
                newArticles.forEach(a => { fresh.articles[a.guid] = normalizeNewshuntArticleDateFields(a, { defaultDateAdded: true }); });
                const cleanup = cleanupNewshuntArticles(fresh);

                if (newArticles.length > 0 || cleanup.deletedCount > 0 || cleanup.normalizedDateCount > 0) {
                    await writeNewshuntData(fresh);
                }

                if (cleanup.deletedCount > 0 || cleanup.normalizedDateCount > 0) {
                    bgLog('saving', 'Cleanup complete: ' + cleanupSummary(cleanup));
                }
            }

            const hasKey = Object.values(SRV_AI).some(p => !!process.env[p.env])
                || !!settings['ai_api_key']
                || Object.keys(SRV_AI).some(p => !!settings['api_key_' + p]);
            if (!hasKey) { bgLog('done', 'No AI API key — skipping categorization'); return; }

            const freshData = await readNewshuntData();
            const uncatCount = Object.values(freshData.articles || {}).filter(a => a.stars == null).length;
            const untaggedCount = Object.values(freshData.articles || {}).filter(a => !a.topics || a.topics.length === 0).length;
            if (uncatCount === 0 && untaggedCount === 0) {
                const merged = await bgMergeTopicsV2(settings);
                bgLog('done', 'All articles already categorized. Topics merged: ' + merged);
                return;
            }

            let rated = 0;
            if (uncatCount > 0) {
                rated = await bgRate(settings);
                bgLog('rating', 'Rated ' + rated + ' articles');
            } else {
                bgLog('rating', 'No unrated articles');
            }

            const afterRatingData = await readNewshuntData();
            const needsTags = Object.values(afterRatingData.articles || {}).some(a => !a.topics || a.topics.length === 0);
            let grouped = 0, tagged = 0;
            if (needsTags) {
                const groupedResult = await bgGroupAndTagV2(settings);
                grouped = groupedResult.grouped;
                tagged = groupedResult.tagged;
                bgLog('grouping', 'Grouped ' + grouped + ', tagged ' + tagged);
            } else {
                bgLog('grouping', 'All articles already tagged');
            }

            const merged = await bgMergeTopicsV2(settings);
            bgLog('done', 'Complete — Rated: ' + rated + ', Grouped: ' + grouped + ', Tagged: ' + tagged + ', Topics merged: ' + merged);

        } catch (e) {
            bgJob.error = e.message;
            bgLog('error', 'Job failed: ' + e.message);
            console.error('[BG] Fatal error:', e);
        } finally {
            bgJob.active = false;
            bgJob.finishedAt = Date.now();
        }
    })();

    return true;
}

// ==========================================================================
// NEWSHUNT AUTO-REFRESH SCHEDULER
// ==========================================================================
// Automatically triggers full feed refresh + AI categorization twice daily.
// Defaults to 05:00 and 17:00 IST; override with NEWSHUNT_AUTO_REFRESH_TIMES.

const autoRefresh = {
    IST_OFFSET_MS: 5.5 * 60 * 60 * 1000  // UTC+05:30
};

function getISTNow() {
    const now = new Date();
    return new Date(now.getTime() + autoRefresh.IST_OFFSET_MS + now.getTimezoneOffset() * 60000);
}

function parseNewshuntAutoRefreshSlots(value) {
    const raw = (typeof value === 'string' && value.trim()) ? value : '05:00,17:00';
    const slots = [];

    for (const token of raw.split(',')) {
        const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(token.trim());
        if (!match) continue;

        const hour = Number(match[1]);
        const minute = Number(match[2]);
        const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        slots.push({ hour, minute, label, totalMinutes: hour * 60 + minute });
    }

    const uniqueSlots = new Map();
    slots.forEach(slot => uniqueSlots.set(slot.label, slot));

    return (uniqueSlots.size ? [...uniqueSlots.values()] : [
        { hour: 5, minute: 0, label: '05:00', totalMinutes: 5 * 60 },
        { hour: 17, minute: 0, label: '17:00', totalMinutes: 17 * 60 }
    ]).sort((a, b) => a.totalMinutes - b.totalMinutes);
}

const newshuntAutoRefresh = {
    checking: false,
    slots: parseNewshuntAutoRefreshSlots(process.env.NEWSHUNT_AUTO_REFRESH_TIMES)
};

function getNewshuntAutoRefreshRunKey(dateKey, slot) {
    return `${dateKey}_${slot.label.replace(':', '')}`;
}

function getNewshuntAutoRefreshRunMap(settings) {
    return isPlainObject(settings && settings._auto_refresh_runs)
        ? { ...settings._auto_refresh_runs }
        : {};
}

function pruneNewshuntAutoRefreshRunMap(runs, todayIST) {
    const cutoff = new Date(`${todayIST}T00:00:00.000Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 14);
    const cutoffDateKey = cutoff.toISOString().slice(0, 10);

    for (const key of Object.keys(runs)) {
        if (key.slice(0, 10) < cutoffDateKey) delete runs[key];
    }

    return runs;
}

async function recordNewshuntAutoRefreshRuns(todayIST, records) {
    const data = await readNewshuntData();
    const runs = pruneNewshuntAutoRefreshRunMap(getNewshuntAutoRefreshRunMap(data.settings), todayIST);
    const recordedAt = new Date().toISOString();

    for (const record of records) {
        runs[record.key] = { slot: record.slot, status: record.status, recordedAt };
    }

    data.settings = data.settings || {};
    data.settings._auto_refresh_runs = runs;
    await writeNewshuntData(data);
}

async function checkNewshuntAutoRefresh() {
    if (newshuntAutoRefresh.checking) return;
    newshuntAutoRefresh.checking = true;

    try {
        if (isAppDisabled('newshunt')) return;
        if (bgJob.active) return;

        const ist = getISTNow();
        const todayIST = ist.toISOString().slice(0, 10);
        const nowMinutes = ist.getHours() * 60 + ist.getMinutes();
        const dueSlots = newshuntAutoRefresh.slots.filter(slot => nowMinutes >= slot.totalMinutes);
        if (dueSlots.length === 0) return;

        const data = await readNewshuntData();
        const runs = getNewshuntAutoRefreshRunMap(data.settings);
        const unrunSlots = dueSlots.filter(slot => !runs[getNewshuntAutoRefreshRunKey(todayIST, slot)]);
        if (unrunSlots.length === 0) return;

        const slotToRun = unrunSlots[unrunSlots.length - 1];
        const started = await runBackgroundJob({ categorizeOnly: false });
        if (!started) return;

        const records = unrunSlots.slice(0, -1).map(slot => ({
            key: getNewshuntAutoRefreshRunKey(todayIST, slot),
            slot: slot.label,
            status: 'skipped'
        }));
        records.push({
            key: getNewshuntAutoRefreshRunKey(todayIST, slotToRun),
            slot: slotToRun.label,
            status: 'started'
        });

        await recordNewshuntAutoRefreshRuns(todayIST, records);
        console.log(`[AutoRefresh] Triggering feed refresh for ${slotToRun.label} IST slot at ${ist.toLocaleTimeString()} IST (${todayIST})`);
    } catch (error) {
        console.error('[AutoRefresh] Check failed:', error.message || error);
    } finally {
        newshuntAutoRefresh.checking = false;
    }
}

// Check every 30 seconds — lightweight, no external cron dependency
setInterval(checkNewshuntAutoRefresh, 30 * 1000);
setTimeout(checkNewshuntAutoRefresh, 10 * 1000);
console.log(`[AutoRefresh] Scheduled feed refresh at ${newshuntAutoRefresh.slots.map(slot => slot.label).join(', ')} IST`);

// POST /api/newshunt/refresh — trigger server-side RSS fetch + background categorization
app.post('/api/newshunt/refresh', async (req, res) => {
    if (isAppDisabled('newshunt')) {
        return res.status(503).json({ error: 'NewsHunt is disabled. Enable it from the dashboard settings.' });
    }
    const categorizeOnly = req.query.categorizeOnly === 'true' || (req.body && req.body.categorizeOnly === true);
    if (bgJob.active) return res.json({ status: 'already_running', job: Object.assign({}, bgJob) });
    await runBackgroundJob({ categorizeOnly });
    res.json({ status: 'started', job: Object.assign({}, bgJob) });
});

// GET /api/newshunt/job-status — poll background job progress
app.get('/api/newshunt/job-status', (req, res) => {
    res.json(Object.assign({}, bgJob));
});


app.post('/api/newshunt/sideload', async (req, res) => {
    try {
        const payload = req.body;
        // Basic validation: ensure it looks like a backup object
        if (!payload || typeof payload !== 'object' || (!payload.settings && !payload.feeds && !payload.articles)) {
            return res.status(400).json({ error: 'Invalid backup file format' });
        }

        // The file structure from our export matches what the server wants, 
        // with the exception that our export's articles is an array instead of a guid map.
        // We will normalize it here just in case.
        const serverData = { settings: {}, feeds: [], articles: {} };

        if (payload.settings && typeof payload.settings === 'object') {
            serverData.settings = payload.settings;
        }

        if (Array.isArray(payload.feeds)) {
            serverData.feeds = payload.feeds;
        }

        if (Array.isArray(payload.articles)) {
            for (const article of payload.articles) {
                if (article.guid) {
                    serverData.articles[article.guid] = article;
                }
            }
        } else if (payload.articles && typeof payload.articles === 'object') {
            // In case it's already a map
            serverData.articles = payload.articles;
        }

        const cleanup = cleanupNewshuntArticles(serverData);
        const savedData = await writeNewshuntData(serverData);
        const normalized = normalizeNewshuntData(savedData);
        res.json({
            ok: true, message: 'Server data replaced successfully', counts: {
                settings: Object.keys(normalized.settings).length,
                feeds: normalized.feeds.length,
                articles: Object.keys(normalized.articles).length,
                deleted: cleanup.deletedCount
            }
        });
    } catch (error) {
        console.error('Error in POST /api/newshunt/sideload:', error);
        res.status(500).json({ error: 'Failed to process sideload payload' });
    }
});

// GET /api/newshunt/sync — pull all synced state
app.get('/api/newshunt/sync', async (req, res) => {
    try {
        let data = await readNewshuntData();
        const cleanup = cleanupNewshuntArticles(data);
        if (cleanup.deletedCount > 0 || cleanup.normalizedDateCount > 0) {
            data = normalizeNewshuntData(await writeNewshuntData(data));
        }
        res.json(data);
    } catch (error) {
        console.error('Error in GET /api/newshunt/sync:', error);
        res.status(500).json({ error: 'Failed to read sync data' });
    }
});

// POST /api/newshunt/sync — push full sync (merge)
app.post('/api/newshunt/sync', async (req, res) => {
    try {
        const { articles: clientArticles, feeds: clientFeeds, settings: clientSettings } = req.body;
        const serverData = await readNewshuntData();

        if (clientSettings !== undefined) {
            const autoRefreshRuns = getNewshuntAutoRefreshRunMap(serverData.settings);
            serverData.settings = normalizeNewshuntSettings(clientSettings);
            if (Object.keys(autoRefreshRuns).length > 0 && !serverData.settings._auto_refresh_runs) {
                serverData.settings._auto_refresh_runs = autoRefreshRuns;
            }
        }

        if (clientFeeds !== undefined) {
            serverData.feeds = normalizeNewshuntFeeds(clientFeeds);
        }

        if (clientArticles !== undefined) {
            serverData.articles = normalizeNewshuntArticles(clientArticles);
        }

        cleanupNewshuntArticles(serverData);
        const savedData = await writeNewshuntData(serverData);
        res.json(normalizeNewshuntData(savedData));
    } catch (error) {
        console.error('Error in POST /api/newshunt/sync:', error);
        res.status(500).json({ error: 'Failed to save sync data' });
    }
});

// POST /api/newshunt/settings — save individual settings to server
app.post('/api/newshunt/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'key is required' });

        await applyNewshuntUpdate({
            $set: { [`settings.${key}`]: value }
        });

        res.json({ ok: true });
    } catch (error) {
        console.error('Error in POST /api/newshunt/settings:', error);
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

// POST /api/newshunt/mark-read — quick single-article mark-read
app.post('/api/newshunt/mark-read', async (req, res) => {
    try {
        const { guid } = req.body;
        if (!guid) return res.status(400).json({ error: 'guid is required' });

        await applyNewshuntUpdate({
            $set: {
                [`articles.${guid}.guid`]: guid,
                [`articles.${guid}.isRead`]: true,
                [`articles.${guid}.readAt`]: Date.now()
            }
        });
        res.json({ ok: true });
    } catch (error) {
        console.error('Error in POST /api/newshunt/mark-read:', error);
        res.status(500).json({ error: 'Failed to mark article read' });
    }
});

// POST /api/newshunt/feeds — save feed subscriptions
app.post('/api/newshunt/feeds', async (req, res) => {
    try {
        const { feeds } = req.body;
        const normalizedFeeds = normalizeNewshuntFeeds(feeds);
        await applyNewshuntUpdate({
            $set: { feeds: normalizedFeeds }
        });
        res.json({ ok: true, count: normalizedFeeds.length });
    } catch (error) {
        console.error('Error in POST /api/newshunt/feeds:', error);
        res.status(500).json({ error: 'Failed to save feeds' });
    }
});

// POST /api/newshunt/article — add or modify a single article
app.post('/api/newshunt/article', async (req, res) => {
    try {
        const { article } = req.body;
        if (!article || !article.guid) return res.status(400).json({ error: 'article and article.guid required' });
        const normalizedArticle = normalizeNewshuntArticleDateFields(article, { defaultDateAdded: true });

        await applyNewshuntUpdate({
            $set: { [`articles.${article.guid}`]: normalizedArticle }
        });
        res.json({ ok: true });
    } catch (error) {
        console.error('Error in POST /api/newshunt/article:', error);
        res.status(500).json({ error: 'Failed to save article' });
    }
});

// POST /api/newshunt/articles/batch — batch add multiple articles
app.post('/api/newshunt/articles/batch', async (req, res) => {
    try {
        const { articles } = req.body; // array
        if (!Array.isArray(articles)) return res.status(400).json({ error: 'articles array required' });

        const articleUpdates = {};
        for (const article of articles) {
            if (article && article.guid) {
                articleUpdates[`articles.${article.guid}`] = normalizeNewshuntArticleDateFields(article, { defaultDateAdded: true });
            }
        }

        if (Object.keys(articleUpdates).length > 0) {
            await applyNewshuntUpdate({
                $set: articleUpdates
            });
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Error in POST /api/newshunt/articles/batch:', error);
        res.status(500).json({ error: 'Failed to save articles batch' });
    }
});

// DELETE /api/newshunt/articles/feed — delete articles from a specific feed
app.delete('/api/newshunt/articles/feed', async (req, res) => {
    try {
        const { feedUrl } = req.body;
        if (!feedUrl) return res.status(400).json({ error: 'feedUrl required' });
        
        const data = await readNewshuntData();
        for (const guid in data.articles) {
            if (data.articles[guid].feedUrl === feedUrl) {
                delete data.articles[guid];
            }
        }
        await writeNewshuntData(data);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error in DELETE /api/newshunt/articles/feed:', error);
        res.status(500).json({ error: 'Failed to delete feed articles' });
    }
});

// POST /api/newshunt/articles/purge — delete old articles
app.post('/api/newshunt/articles/purge', async (req, res) => {
    try {
        const { maxAgeDays } = req.body;
        const days = Math.max(1, Number(maxAgeDays) || NEWSHUNT_RETENTION_DAYS);
        
        const data = await readNewshuntData();
        const cleanup = cleanupNewshuntArticles(data, days);
        await writeNewshuntData(data);
        res.json({
            ok: true,
            deletedCount: cleanup.deletedCount,
            oldArticleCount: cleanup.oldArticleCount,
            invalidDateCount: cleanup.invalidDateCount,
            normalizedDateCount: cleanup.normalizedDateCount,
            contentDeletedCount: cleanup.contentDeletedCount
        });
    } catch (error) {
        console.error('Error in POST /api/newshunt/articles/purge:', error);
        res.status(500).json({ error: 'Failed to purge articles' });
    }
});

// POST /api/newshunt/chat — add chat message
app.post('/api/newshunt/chat', async (req, res) => {
    try {
        const { articleGuid, role, content = '', reasoning = '' } = req.body;
        if (!articleGuid || !role || (!content && !reasoning)) return res.status(400).json({ error: 'Missing chat params' });
        const newMessage = {
            id: Date.now() + Math.random().toString(36).substring(7),
            articleGuid,
            role,
            content,
            ...(reasoning ? { reasoning } : {}),
            timestamp: Date.now()
        };

        await applyNewshuntUpdate({
            $push: { chatHistory: newMessage }
        });
        res.json({ ok: true, id: newMessage.id });
    } catch (error) {
        console.error('Error in POST /api/newshunt/chat:', error);
        res.status(500).json({ error: 'Failed to add chat message' });
    }
});

// POST /api/newshunt/article-content — update article content map
app.post('/api/newshunt/article-content', async (req, res) => {
    try {
        const { guid, content } = req.body;
        if (!guid) return res.status(400).json({ error: 'guid is required' });

        if (content === null || content === undefined || content === '') {
            await applyNewshuntUpdate({
                $unset: { [`articleContent.${guid}`]: '' }
            });
        } else {
            await applyNewshuntUpdate({
                $set: { [`articleContent.${guid}`]: content }
            });
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Error in POST /api/newshunt/article-content:', error);
        res.status(500).json({ error: 'Failed to save article content' });
    }
});

// POST /api/newshunt/article-content/clear
app.post('/api/newshunt/article-content/clear', async (req, res) => {
    try {
        await applyNewshuntUpdate({
            $set: { articleContent: {} }
        });
        res.json({ ok: true });
    } catch (error) {
        console.error('Error clearing article content:', error);
        res.status(500).json({ error: 'Failed to clear content' });
    }
});

// DELETE /api/newshunt/clear-all
app.delete('/api/newshunt/clear-all', async (req, res) => {
    try {
        await NewsHuntData.deleteMany({});
        res.json({ ok: true });
    } catch (error) {
        console.error('Error in DELETE /api/newshunt/clear-all:', error);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

// --- APIs (Quick Notes with MongoDB) ---

const QUICKNOTE_COLORS = new Set(['linen', 'sunbeam', 'blush', 'mint', 'sky', 'lavender']);

const sanitizeQuickNotePayload = (input = {}, fallback = {}) => {
    const titleSource = typeof input.title === 'string' ? input.title : (fallback.title || '');
    const contentSource = typeof input.content === 'string' ? input.content : (fallback.content || '');
    const colorSource = typeof input.color === 'string' ? input.color : (fallback.color || 'linen');
    const pinnedSource = typeof input.pinned === 'boolean' ? input.pinned : Boolean(fallback.pinned);
    const isEncryptedSource = typeof input.isEncrypted === 'boolean' ? input.isEncrypted : Boolean(fallback.isEncrypted);

    return {
        title: titleSource.replace(/\s+/g, ' ').trim().slice(0, 120),
        content: contentSource.replace(/\r\n/g, '\n').slice(0, 15000).trimEnd(),
        color: QUICKNOTE_COLORS.has(colorSource) ? colorSource : 'linen',
        pinned: pinnedSource,
        isEncrypted: isEncryptedSource
    };
};

app.get('/api/quicknotes', async (req, res) => {
    try {
        const notes = await QuickNote.find({}).sort({ pinned: -1, updatedAt: -1, createdAt: -1 });
        res.json(notes);
    } catch (e) {
        console.error('API Error in GET /api/quicknotes:', e);
        res.status(500).json({ error: 'Failed to load notes' });
    }
});

app.post('/api/quicknotes', async (req, res) => {
    try {
        const payload = sanitizeQuickNotePayload(req.body);
        if (!payload.title && !payload.content) {
            return res.status(400).json({ error: 'A note needs a title or content' });
        }

        const note = await QuickNote.create(payload);
        res.status(201).json(note);
    } catch (e) {
        console.error('API Error in POST /api/quicknotes:', e);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

app.patch('/api/quicknotes/:id', async (req, res) => {
    try {
        const existingNote = await QuickNote.findById(req.params.id);
        if (!existingNote) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const payload = sanitizeQuickNotePayload(req.body, existingNote.toObject());
        existingNote.set(payload);
        await existingNote.save();

        res.json(existingNote);
    } catch (e) {
        console.error('API Error in PATCH /api/quicknotes/:id:', e);
        res.status(500).json({ error: 'Failed to update note' });
    }
});

app.delete('/api/quicknotes/:id', async (req, res) => {
    try {
        const deleted = await QuickNote.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json({ ok: true });
    } catch (e) {
        console.error('API Error in DELETE /api/quicknotes/:id:', e);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

app.delete('/api/quicknotes', async (req, res) => {
    try {
        await QuickNote.deleteMany({});
        res.json({ ok: true });
    } catch (e) {
        console.error('API Error in DELETE /api/quicknotes:', e);
        res.status(500).json({ error: 'Failed to clear notes' });
    }
});


// ===============================================
// === YOUTUBE DOWNLOADER API (LOCAL ytdlp) ======
// ===============================================

const downloads = new Map();
const videoInfoCache = new Map();
const ytdownloaderSettings = {
    proxy: null,
    cookiesText: null,
    cookiesPath: null
};
const videosDir = path.join(__dirname, 'public', 'videos');
const videoExtensions = new Set(['.mp4', '.webm', '.mkv']);
const thumbnailExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const sidecarExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.info.json'];
const VIDEO_INFO_CACHE_TTL_MS = 30 * 60 * 1000;

const sendApiError = (res, status, message, code = undefined, hint = undefined) => {
    const payload = { ok: false, error: message };
    if (code) payload.code = code;
    if (hint) payload.hint = hint;
    return res.status(status).json(payload);
};

const isSafeVideoFileName = (value) => {
    if (typeof value !== 'string' || value.trim() === '') return false;
    if (value.includes('\0')) return false;
    if (value.includes('/') || value.includes('\\')) return false;
    return path.basename(value) === value;
};

const ensureVideosDir = async () => {
    await fsPromises.mkdir(videosDir, { recursive: true });
};

const updateRuntimeCookies = (cookiesText) => {
    const trimmed = typeof cookiesText === 'string' ? cookiesText.trim() : '';
    if (!trimmed) {
        ytdownloaderSettings.cookiesText = null;
        ytdownloaderSettings.cookiesPath = null;
        return { hasCookies: false };
    }

    const cookiesDir = path.join(os.tmpdir(), 'render-dashboard-app');
    const cookiesPath = path.join(cookiesDir, 'runtime_youtube_cookies.txt');
    fs.mkdirSync(cookiesDir, { recursive: true });
    fs.writeFileSync(cookiesPath, trimmed, { encoding: 'utf8' });

    ytdownloaderSettings.cookiesText = trimmed;
    ytdownloaderSettings.cookiesPath = cookiesPath;
    return { hasCookies: true };
};

const cleanYoutubeUrl = (url) => {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) {
            if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
                const videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0];
                if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
            }
            if (parsed.pathname === '/watch') {
                const videoId = parsed.searchParams.get('v');
                if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
            }
            if (parsed.pathname.startsWith('/embed/')) {
                const videoId = parsed.pathname.split('/embed/')[1]?.split('/')[0];
                if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
            }
            if (parsed.pathname.startsWith('/shorts/')) {
                const videoId = parsed.pathname.split('/shorts/')[1]?.split('/')[0];
                if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
            }
        }
    } catch {
        return url;
    }
    return url;
};

const getYtDlpOptionsArgs = () => {
    const args = ['--no-warnings', '--newline', '--impersonate', 'chrome', '--js-runtimes', 'node'];
    if (ytdownloaderSettings.proxy) {
        args.push('--proxy', ytdownloaderSettings.proxy);
    }
    if (ytdownloaderSettings.cookiesPath) {
        args.push('--cookies', ytdownloaderSettings.cookiesPath);
    }
    return args;
};

const cleanupVideoInfoCache = () => {
    const now = Date.now();
    for (const [url, entry] of videoInfoCache.entries()) {
        if (!entry?.timestamp || now - entry.timestamp > VIDEO_INFO_CACHE_TTL_MS) {
            videoInfoCache.delete(url);
        }
    }
};

const cacheVideoInfo = (url, formats) => {
    cleanupVideoInfoCache();
    videoInfoCache.set(url, {
        timestamp: Date.now(),
        formats: Array.isArray(formats) ? formats : []
    });
};

const getCachedFormatsForUrl = (url) => {
    cleanupVideoInfoCache();
    const entry = videoInfoCache.get(url);
    if (!entry) return [];
    return Array.isArray(entry.formats) ? entry.formats : [];
};

const getYtDlpCandidates = () => {
    const candidates = [];
    const addCandidate = (command, prefix = []) => {
        const safeCommand = typeof command === 'string' ? command.trim() : '';
        if (!safeCommand) return;
        candidates.push({ command: safeCommand, prefix });
    };

    addCandidate(process.env.YTDLP_PATH, []);
    addCandidate('yt-dlp', []);
    addCandidate('yt-dlp.exe', []);
    addCandidate(process.env.PYTHON_PATH, ['-m', 'yt_dlp']);
    addCandidate('python', ['-m', 'yt_dlp']);
    addCandidate('py', ['-m', 'yt_dlp']);

    const seen = new Set();
    return candidates.filter((candidate) => {
        const key = `${candidate.command}::${candidate.prefix.join(' ')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const getFfmpegCandidates = () => {
    const candidates = [];
    const addCandidate = (command, prefix = []) => {
        const safeCommand = typeof command === 'string' ? command.trim() : '';
        if (!safeCommand) return;
        candidates.push({ command: safeCommand, prefix });
    };

    addCandidate(process.env.FFMPEG_PATH, []);
    addCandidate('ffmpeg', []);
    addCandidate('ffmpeg.exe', []);
    
    // Fallback: Check common winget install path for yt-dlp.FFmpeg
    const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : '');
    if (localAppData) {
        addCandidate(path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-N-124279-g0f6ba39122-win64-gpl', 'bin', 'ffmpeg.exe'), []);
    }

    const seen = new Set();
    return candidates.filter((candidate) => {
        const key = `${candidate.command}::${candidate.prefix.join(' ')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const runCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd: options.cwd || __dirname,
        env: process.env,
        shell: false
    });

    let stdout = '';
    let stderr = '';
    let timer = null;

    if (options.timeoutMs) {
        timer = setTimeout(() => {
            child.kill('SIGTERM');
        }, options.timeoutMs);
    }

    child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        if (options.onStdout) options.onStdout(text);
    });
    child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        if (options.onStderr) options.onStderr(text);
    });

    child.on('error', (error) => {
        if (timer) clearTimeout(timer);
        reject(error);
    });

    child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        if (code === 0) {
            resolve({ stdout, stderr });
            return;
        }
        const err = new Error(`Command failed: ${command} exited with code ${code}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        reject(err);
    });
});

const runYtDlp = async (args, options = {}) => {
    const candidates = getYtDlpCandidates();
    let lastNotFoundError = null;

    for (const candidate of candidates) {
        try {
            return await runCommand(candidate.command, [...candidate.prefix, ...args], options);
        } catch (error) {
            if (error?.code === 'ENOENT') {
                lastNotFoundError = error;
                continue;
            }
            throw error;
        }
    }

    const notFoundError = new Error('yt-dlp executable was not found. Install yt-dlp (or set YTDLP_PATH), or install Python yt-dlp and ensure `python -m yt_dlp` works.');
    notFoundError.code = 'YTDLP_NOT_FOUND';
    notFoundError.cause = lastNotFoundError;
    throw notFoundError;
};

const runFfmpeg = async (args, options = {}) => {
    const candidates = getFfmpegCandidates();
    let lastNotFoundError = null;

    for (const candidate of candidates) {
        try {
            return await runCommand(candidate.command, [...candidate.prefix, ...args], options);
        } catch (error) {
            if (error?.code === 'ENOENT') {
                lastNotFoundError = error;
                continue;
            }
            throw error;
        }
    }

    const notFoundError = new Error('ffmpeg executable was not found. Install ffmpeg (or set FFMPEG_PATH).');
    notFoundError.code = 'FFMPEG_NOT_FOUND';
    notFoundError.cause = lastNotFoundError;
    throw notFoundError;
};

const dependencyStatus = {
    ytDlp: {
        ok: false,
        checkedAt: null,
        command: null,
        error: null
    },
    ffmpeg: {
        ok: false,
        checkedAt: null,
        command: null,
        error: null
    }
};

const markDependency = (name, patch) => {
    dependencyStatus[name] = {
        ...dependencyStatus[name],
        ...patch,
        checkedAt: Date.now()
    };
};

const probeYtDlp = async () => {
    const candidates = getYtDlpCandidates();
    let lastError = null;
    for (const candidate of candidates) {
        try {
            await runCommand(candidate.command, [...candidate.prefix, '--version'], { timeoutMs: 15000 });
            markDependency('ytDlp', { ok: true, command: `${candidate.command} ${candidate.prefix.join(' ')}`.trim(), error: null });
            return dependencyStatus.ytDlp;
        } catch (error) {
            lastError = error;
            if (error?.code === 'ENOENT') continue;
        }
    }
    markDependency('ytDlp', {
        ok: false,
        command: null,
        error: (lastError?.stderr || lastError?.stdout || lastError?.message || 'yt-dlp not available').slice(0, 300)
    });
    return dependencyStatus.ytDlp;
};

const probeFfmpeg = async () => {
    const candidates = getFfmpegCandidates();
    let lastError = null;
    for (const candidate of candidates) {
        try {
            await runCommand(candidate.command, [...candidate.prefix, '-version'], { timeoutMs: 15000 });
            markDependency('ffmpeg', { ok: true, command: `${candidate.command} ${candidate.prefix.join(' ')}`.trim(), error: null });
            return dependencyStatus.ffmpeg;
        } catch (error) {
            lastError = error;
            if (error?.code === 'ENOENT') continue;
        }
    }
    markDependency('ffmpeg', {
        ok: false,
        command: null,
        error: (lastError?.stderr || lastError?.stdout || lastError?.message || 'ffmpeg not available').slice(0, 300)
    });
    return dependencyStatus.ffmpeg;
};

const ensureYtDlpAvailable = async () => {
    const status = await probeYtDlp();
    if (!status.ok) {
        const err = new Error('yt-dlp dependency is missing');
        err.code = 'YTDLP_MISSING';
        err.hint = 'Install yt-dlp in build step, or set YTDLP_PATH, or ensure `python -m yt_dlp --version` works.';
        throw err;
    }
    return status;
};

const ensureFfmpegAvailable = async () => {
    const status = await probeFfmpeg();
    if (!status.ok) {
        const err = new Error('ffmpeg dependency is missing');
        err.code = 'FFMPEG_MISSING';
        err.hint = 'Install ffmpeg in Render build step, or set FFMPEG_PATH to a valid binary.';
        throw err;
    }
    return status;
};

const extractFormats = (info) => {
    const byHeight = new Map();
    for (const format of info.formats || []) {
        const height = Number(format.height);
        if (!Number.isFinite(height) || height <= 0) continue;

        const formatId = `${format.format_id || ''}`;
        const ext = (format.ext || '').toLowerCase();
        const note = (format.format_note || '').toLowerCase();
        const protocol = (format.protocol || '').toLowerCase();
        const vcodec = format.vcodec || 'none';
        const acodec = format.acodec || 'none';

        const isStoryboard = formatId.startsWith('sb') || ext === 'mhtml' || note.includes('storyboard') || protocol === 'mhtml';
        const isVideo = vcodec !== 'none';
        if (!isVideo || isStoryboard) continue;

        const hasAudio = acodec !== 'none';
        const score =
            (hasAudio ? 100 : 0) +
            (ext === 'mp4' ? 10 : 0) +
            ((format.filesize || format.filesize_approx || 0) > 0 ? 1 : 0);

        const candidate = {
            format_id: format.format_id,
            quality: `${height}p`,
            height,
            filesize: format.filesize || format.filesize_approx || 0,
            has_audio: hasAudio,
            format_note: format.format_note || '',
            ext: format.ext || 'mp4',
            vcodec: format.vcodec || 'unknown',
            acodec: format.acodec || 'unknown',
            _score: score
        };

        const prev = byHeight.get(height);
        if (!prev || candidate._score > prev._score) {
            byHeight.set(height, candidate);
        }
    }
    const formats = [...byHeight.values()]
        .sort((a, b) => b.height - a.height)
        .map((format) => {
            const { _score, ...safe } = format;
            return safe;
        });

    formats.unshift({
        format_id: 'best',
        quality: 'Best Available',
        height: null,
        filesize: 0,
        has_audio: true,
        format_note: 'Automatic best quality',
        ext: 'mp4',
        vcodec: 'best',
        acodec: 'best'
    });
    return formats;
};

const parseProgressLine = (line) => {
    const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (!match) return null;
    const progress = Math.max(0, Math.min(100, Math.round(Number(match[1]))));
    const speedMatch = line.match(/at\s+([^\s]+)\s+/);
    const etaMatch = line.match(/ETA\s+([0-9:]+)/);
    const speedText = speedMatch ? ` | ${speedMatch[1]}` : '';
    const etaText = etaMatch ? ` | ETA ${etaMatch[1]}` : '';
    return {
        progress,
        message: `Downloading... ${progress}%${speedText}${etaText}`
    };
};

const createDownload = (cleanUrl) => {
    const downloadId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    downloads.set(downloadId, {
        id: downloadId,
        url: cleanUrl,
        status: 'starting',
        progress: 0,
        message: 'Starting download...',
        filename: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: null,
        error: null
    });
    return downloadId;
};

const updateDownload = (downloadId, patch) => {
    const current = downloads.get(downloadId);
    if (!current) return;
    downloads.set(downloadId, {
        ...current,
        ...patch,
        updatedAt: Date.now()
    });
};

const runDownloadJob = async (downloadId, cleanUrl, formatId) => {
    await ensureVideosDir();
    const outputTemplate = path.join(videosDir, '%(title)s.%(ext)s');
    const commonArgs = getYtDlpOptionsArgs();
    const startedAt = Date.now();
    let lastPrintedPath = null;
    let buffer = '';
    const cachedFormats = getCachedFormatsForUrl(cleanUrl);
    const selectedFormat = cachedFormats.find((f) => `${f.format_id}` === `${formatId}`);
    const selectedHeight = selectedFormat?.height || null;

    const buildArgs = (formatExpr) => ([
        ...commonArgs,
        '--write-thumbnail',
        '--write-info-json',
        '--merge-output-format',
        'mp4',
        '--print',
        'after_move:filepath',
        '-f',
        formatExpr,
        '-o',
        outputTemplate,
        cleanUrl
    ]);

    try {
        updateDownload(downloadId, { status: 'downloading', message: 'Downloading...', progress: 1, error: null });
        const attempts = [];
        attempts.push(formatId === 'best' ? 'bestvideo+bestaudio/best' : `${formatId}+bestaudio/best`);
        if (selectedHeight && Number.isFinite(Number(selectedHeight))) {
            attempts.push(`bestvideo[height<=${selectedHeight}]+bestaudio/best[height<=${selectedHeight}]/best`);
        }
        attempts.push('bestvideo+bestaudio/best');
        const uniqueAttempts = [...new Set(attempts)];

        let success = false;
        let lastError = null;
        for (let i = 0; i < uniqueAttempts.length; i++) {
            const formatExpr = uniqueAttempts[i];
            if (i > 0) {
                updateDownload(downloadId, {
                    status: 'processing',
                    message: 'Selected quality unavailable. Retrying with compatible format...',
                    progress: Math.max(downloads.get(downloadId)?.progress || 1, 5)
                });
            }

            try {
                await runYtDlp(buildArgs(formatExpr), {
                    timeoutMs: 60 * 60 * 1000,
                    onStdout: (chunk) => {
                        buffer += chunk;
                        const lines = buffer.split(/\r?\n/);
                        buffer = lines.pop() || '';
                        for (const line of lines) {
                            const progressData = parseProgressLine(line);
                            if (progressData) {
                                updateDownload(downloadId, {
                                    status: 'downloading',
                                    progress: progressData.progress,
                                    message: progressData.message
                                });
                                continue;
                            }
                            const trimmed = line.trim();
                            if (trimmed && !trimmed.startsWith('[') && trimmed.toLowerCase().includes('.mp4')) {
                                lastPrintedPath = trimmed;
                            }
                        }
                    },
                    onStderr: (chunk) => {
                        const text = chunk.trim();
                        if (text) {
                            updateDownload(downloadId, { status: 'processing', message: text.slice(-220), progress: 99 });
                        }
                    }
                });
                success = true;
                break;
            } catch (error) {
                lastError = error;
                const errorText = `${error?.stderr || ''} ${error?.stdout || ''} ${error?.message || ''}`;
                const isFormatUnavailable = /Requested format is not available/i.test(errorText);
                if (!isFormatUnavailable || i === uniqueAttempts.length - 1) {
                    throw error;
                }
            }
        }
        if (!success && lastError) throw lastError;

        let finalFileName = '';
        if (lastPrintedPath) {
            finalFileName = path.basename(lastPrintedPath);
        } else {
            const entries = await fsPromises.readdir(videosDir, { withFileTypes: true });
            const candidates = [];
            for (const entry of entries) {
                if (!entry.isFile()) continue;
                const ext = path.extname(entry.name).toLowerCase();
                if (ext !== '.mp4') continue;
                const fullPath = path.join(videosDir, entry.name);
                const stat = await fsPromises.stat(fullPath);
                if (stat.mtimeMs >= startedAt - 5000) {
                    candidates.push({ name: entry.name, mtimeMs: stat.mtimeMs });
                }
            }
            candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
            if (candidates.length > 0) {
                finalFileName = candidates[0].name;
            }
        }

        updateDownload(downloadId, {
            status: 'completed',
            progress: 100,
            filename: finalFileName,
            message: 'Download complete!',
            completedAt: Date.now(),
            error: null
        });
    } catch (error) {
        let errorMessage = (error.stderr || error.stdout || error.message || 'Download failed').slice(0, 500);
        if (errorMessage.includes('Sign in to confirm') || errorMessage.includes('not a bot')) {
            errorMessage = 'YouTube is asking for authentication. Open Settings, paste/upload fresh cookies.txt, save, then retry.';
        } else if (/Requested format is not available/i.test(errorMessage)) {
            errorMessage = 'Selected quality is currently unavailable. Please click Fetch Info again and retry.';
        }
        updateDownload(downloadId, {
            status: 'error',
            progress: 100,
            message: errorMessage,
            completedAt: Date.now(),
            error: errorMessage
        });
    }
};

app.get('/api/video-info', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
        return sendApiError(res, 400, 'URL is required');
    }

    const cleanUrl = cleanYoutubeUrl(rawUrl);
    const args = [
        ...getYtDlpOptionsArgs(),
        '--dump-json',
        '--skip-download',
        cleanUrl
    ];

    try {
        await ensureYtDlpAvailable();
        const { stdout } = await runYtDlp(args, { timeoutMs: 120000 });
        const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'));
        if (!jsonLine) {
            return sendApiError(res, 400, 'Failed to fetch video info.');
        }
        const info = JSON.parse(jsonLine);
        const formats = extractFormats(info);
        cacheVideoInfo(cleanUrl, formats);

        return res.json({
            title: info.title || 'Unknown',
            thumbnail: info.thumbnail || '',
            duration: info.duration || 0,
            uploader: info.uploader || 'Unknown',
            formats,
            url: cleanUrl
        });
    } catch (error) {
        if (error?.code === 'YTDLP_MISSING') {
            return sendApiError(res, 500, 'yt-dlp is not available on this server.', 'YTDLP_MISSING', error.hint);
        }
        const message = (error.stderr || error.stdout || error.message || 'Failed to fetch video info').slice(0, 400);
        return sendApiError(res, 400, message);
    }
});

app.post('/api/download', async (req, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const quality = typeof req.body?.quality === 'string' && req.body.quality.trim() ? req.body.quality.trim() : 'best';
    if (!rawUrl) {
        return sendApiError(res, 400, 'URL is required');
    }

    try {
        await ensureYtDlpAvailable();
        await ensureFfmpegAvailable();
    } catch (error) {
        if (error?.code === 'YTDLP_MISSING') {
            return sendApiError(res, 500, 'yt-dlp is not available on this server.', 'YTDLP_MISSING', error.hint);
        }
        if (error?.code === 'FFMPEG_MISSING') {
            return sendApiError(res, 500, 'ffmpeg is required for strict merge mode but is not available.', 'FFMPEG_MISSING', error.hint);
        }
        return sendApiError(res, 500, 'Dependency validation failed.');
    }

    const cleanUrl = cleanYoutubeUrl(rawUrl);
    const downloadId = createDownload(cleanUrl);
    runDownloadJob(downloadId, cleanUrl, quality)
        .catch((error) => {
            const message = error?.message || 'Unexpected downloader error';
            updateDownload(downloadId, { status: 'error', progress: 100, message, completedAt: Date.now(), error: message });
        });

    return res.status(202).json({
        download_id: downloadId,
        message: 'Download started'
    });
});

app.get('/api/dependencies', async (req, res) => {
    await Promise.all([probeYtDlp(), probeFfmpeg()]);
    return res.json({
        ok: dependencyStatus.ytDlp.ok && dependencyStatus.ffmpeg.ok,
        yt_dlp: dependencyStatus.ytDlp,
        ffmpeg: dependencyStatus.ffmpeg
    });
});

app.get('/api/download-progress/:downloadId', (req, res) => {
    const download = downloads.get(req.params.downloadId);
    if (!download) {
        return res.json({
            status: 'not_found',
            progress: 0,
            message: 'Download not found'
        });
    }
    return res.json(download);
});

app.get('/api/library', async (req, res) => {
    try {
        await ensureVideosDir();
        const entries = await fsPromises.readdir(videosDir, { withFileTypes: true });
        const files = [];

        for (const entry of entries) {
            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!videoExtensions.has(ext)) continue;

            const fullPath = path.join(videosDir, entry.name);
            const stat = await fsPromises.stat(fullPath);
            const baseName = path.parse(entry.name).name;
            let thumbnail = null;
            for (const thumbExt of thumbnailExtensions) {
                const thumbName = `${baseName}${thumbExt}`;
                if (fs.existsSync(path.join(videosDir, thumbName))) {
                    thumbnail = `/public/videos/${encodeURIComponent(thumbName)}`;
                    break;
                }
            }

            files.push({
                filename: entry.name,
                size: stat.size,
                date: Math.floor(stat.mtimeMs / 1000),
                url: `/api/video/${encodeURIComponent(entry.name)}`,
                thumbnail
            });
        }

        files.sort((a, b) => b.date - a.date);
        return res.json(files);
    } catch (error) {
        console.error('Error reading video library:', error);
        return sendApiError(res, 500, 'Failed to load library');
    }
});

app.get('/api/video/:filename', async (req, res) => {
    const fileName = req.params.filename;
    if (!isSafeVideoFileName(fileName)) {
        return sendApiError(res, 400, 'Invalid filename');
    }

    const filePath = path.join(videosDir, fileName);
    try {
        await fsPromises.access(filePath, fs.constants.F_OK);
        return res.sendFile(filePath);
    } catch {
        return sendApiError(res, 404, 'Video not found');
    }
});

app.delete('/api/video/:filename', async (req, res) => {
    const fileName = req.params.filename;
    if (!isSafeVideoFileName(fileName)) {
        return sendApiError(res, 400, 'Invalid filename');
    }

    await ensureVideosDir();
    const baseName = path.parse(fileName).name;
    let deleted = false;

    const allCandidates = new Set([fileName, ...sidecarExtensions.map((ext) => `${baseName}${ext}`)]);
    for (const candidate of allCandidates) {
        const candidatePath = path.join(videosDir, candidate);
        try {
            await fsPromises.unlink(candidatePath);
            deleted = true;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error deleting file:', candidatePath, error);
                return sendApiError(res, 500, 'Failed to delete video');
            }
        }
    }

    if (!deleted) {
        return sendApiError(res, 404, 'Video not found');
    }
    return res.json({ ok: true, message: 'Video deleted' });
});

app.get('/api/settings', (req, res) => {
    return res.json({
        proxy: ytdownloaderSettings.proxy,
        hasCookies: Boolean(ytdownloaderSettings.cookiesPath)
    });
});

app.post('/api/settings/proxy', (req, res) => {
    const proxy = typeof req.body?.proxy === 'string' ? req.body.proxy.trim() : '';
    ytdownloaderSettings.proxy = proxy || null;
    if (ytdownloaderSettings.proxy) {
        return res.json({ ok: true, message: 'Proxy set successfully', proxy: ytdownloaderSettings.proxy });
    }
    return res.json({ ok: true, message: 'Proxy cleared' });
});

app.post('/api/settings/cookies-text', (req, res) => {
    const cookiesText = typeof req.body?.cookiesText === 'string' ? req.body.cookiesText : '';
    if (cookiesText.length > 1_500_000) {
        return sendApiError(res, 400, 'Cookies text is too large.');
    }

    const result = updateRuntimeCookies(cookiesText);
    if (result.hasCookies) {
        return res.json({ ok: true, message: 'Cookies saved successfully.', hasCookies: true });
    }
    return res.json({ ok: true, message: 'Cookies cleared.', hasCookies: false });
});

Promise.all([probeYtDlp(), probeFfmpeg()])
    .then(() => {
        if (!dependencyStatus.ytDlp.ok) {
            console.warn(`[YT Downloader] yt-dlp probe failed: ${dependencyStatus.ytDlp.error || 'unknown error'}`);
        }
        if (!dependencyStatus.ffmpeg.ok) {
            console.warn(`[YT Downloader] ffmpeg probe failed: ${dependencyStatus.ffmpeg.error || 'unknown error'}`);
        }
    })
    .catch((error) => {
        console.warn('[YT Downloader] dependency probe failed unexpectedly:', error.message || error);
    });

// --- Server Start ---
const server = app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    // Load dashboard settings cache from MongoDB, then start conditional services
    await loadDashboardSettings();
    console.log('[Dashboard] Settings loaded. Disabled apps:', [..._disabledAppsCache]);
    checkNewshuntAutoRefresh();
    await startDietPlanIfEnabled();
    await startJupyterIfEnabled();
});

// WebSocket upgrade forwarding for JupyterLab interactive kernels & terminals
server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/jupyter')) {
        jupyterProxy.upgrade(req, socket, head);
    }
});

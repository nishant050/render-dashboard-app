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
const AdmZip = require('adm-zip');
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const { createProxyMiddleware } = require('http-proxy-middleware');

// --- MongoDB Configuration ---
const MONGO_URI = 'mongodb://admin:admin123@ac-wnbtpbs-shard-00-00.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-01.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-02.42f6xm7.mongodb.net:27017/render-dashboard?ssl=true&replicaSet=atlas-usm1o0-shard-0&authSource=admin&retryWrites=true&w=majority&appName=diet-plan';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB (render-dashboard)'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Schemas & Models ---

// Chemistry Schedule
const chemistryScheduleSchema = new mongoose.Schema({
    id: Number,
    dates: String,
    topics: String
});
const ChemistrySchedule = mongoose.model('ChemistrySchedule', chemistryScheduleSchema);

const chemistryProgressSchema = new mongoose.Schema({
    data: Object // Map of id -> status
}, { timestamps: true });
const ChemistryProgress = mongoose.model('ChemistryProgress', chemistryProgressSchema);

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

const fileHubEntrySchema = new mongoose.Schema({
    path: { type: String, required: true, unique: true },
    parentPath: { type: String, default: '' },
    name: { type: String, required: true },
    isDirectory: { type: Boolean, default: false },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    content: { type: Buffer, default: null }
}, { timestamps: true });
const FileHubEntry = mongoose.model('FileHubEntry', fileHubEntrySchema);

// Scrape.do API key - set via SCRAPE_DO_API_KEY environment variable
// Default to user-provided key if not set, will fall back to manual links
const SCRAPE_DO_API_KEY = process.env.SCRAPE_DO_API_KEY || '942211ddfd1b40c5aaac053e55d17fb2bacb64a543d';

const app = express();
const PORT = process.env.PORT || 3000;

// --- Finance App Password Protection ---
const FINANCE_PASSWORD = 'admin123';
const financeAuth = new Map(); // sessionId -> true (authenticated)

// Generate a simple session token
const generateSessionToken = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Finance authentication middleware - protects /finance and /api/finance routes
const requireFinanceAuth = (req, res, next) => {
    const sessionToken = req.headers['x-finance-session'] || req.query.session;

    if (financeAuth.has(sessionToken)) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required', code: 'FINANCE_AUTH_REQUIRED' });
    }
};

// Middleware to parse JSON bodies
app.use(express.json({ limit: '25mb' }));

// --- DietPlan Proxy & Process Setup ---
const pythonCmd = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
const dietPlanProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--port', '8005', '--host', '127.0.0.1', '--root-path', '/dietplan'], {
    cwd: path.join(__dirname, 'apps', 'DietPlan'),
    env: process.env
});
dietPlanProcess.stdout.on('data', d => console.log(`DietPlan: ${d}`));
dietPlanProcess.stderr.on('data', d => console.error(`DietPlan Error: ${d}`));

app.use('/dietplan', createProxyMiddleware({
    target: 'http://127.0.0.1:8005',
    changeOrigin: true,
    pathRewrite: {
        '^/dietplan': ''
    }
}));

// --- Finance Login API ---
app.post('/api/finance-login', (req, res) => {
    const { password } = req.body;

    if (password === FINANCE_PASSWORD) {
        const sessionToken = generateSessionToken();
        financeAuth.set(sessionToken, true);
        res.json({ success: true, session: sessionToken });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// --- Finance Auth Check API ---
app.get('/api/finance-auth-check', (req, res) => {
    const sessionToken = req.headers['x-finance-session'] || req.query.session;

    if (financeAuth.has(sessionToken)) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

// --- Finance API Routes (Protected) ---
const financeRoutes = require('./apps/finance/server/routes');
app.use('/api/finance', requireFinanceAuth, financeRoutes);

// --- Finance App Static Files (Protected) ---
// Custom middleware to protect static files under /finance
const protectFinanceStatic = (req, res, next) => {
    const sessionToken = req.headers['x-finance-session'] || req.query.session;

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
const upload = multer({ storage: multer.memoryStorage() });

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
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }
};

const saveFileHubFile = async ({ filePath, name, buffer, mimeType }) => {
    const normalizedPath = normalizeFileHubPath(filePath);
    await ensureFileHubFolderExists(getFileHubParentPath(normalizedPath));

    return FileHubEntry.findOneAndUpdate(
        { path: normalizedPath },
        {
            $set: {
                path: normalizedPath,
                parentPath: getFileHubParentPath(normalizedPath),
                name,
                isDirectory: false,
                mimeType: mimeType || getFileHubMimeType(name),
                size: buffer.length,
                content: buffer
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
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

        await saveFileHubFile({
            filePath,
            name: req.file.originalname,
            buffer: req.file.buffer,
            mimeType: req.file.mimetype || getFileHubMimeType(req.file.originalname)
        });

        res.json({ message: `File '${req.file.originalname}' uploaded successfully!` });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).send('Server error while uploading file.');
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

// 10. FILE CONTENT AND ZIP DOWNLOAD
const sendFileHubEntryContent = (entry, res) => {
    const content = entry.content || Buffer.alloc(0);
    res.set('Content-Type', entry.mimeType || getFileHubMimeType(entry.name));
    res.set('Content-Length', entry.size || content.length);
    res.set('Cache-Control', 'no-store');
    res.send(content);
};

app.head('/api/file-content', async (req, res) => {
    try {
        const filePath = normalizeFileHubPath(req.query.path);
        const entry = await FileHubEntry.findOne({ path: filePath, isDirectory: false });

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

        sendFileHubEntryContent(entry, res);
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

        files.forEach(file => {
            const relativePath = currentPath && file.path.startsWith(`${currentPath}/`)
                ? file.path.slice(currentPath.length + 1)
                : file.name;
            zip.addFile(relativePath || file.name, file.content || Buffer.alloc(0));
        });

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

        const zip = new AdmZip(zipEntry.content);
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
    const data = await LearnInvestingState.findOne();
    if (!data) return { profiles: {}, currentProfileId: null };
    return normalizeLearnInvestingState(typeof data.toObject === 'function' ? data.toObject() : data);
};

const writeLearnInvestingState = async (state) => {
    const normalized = normalizeLearnInvestingState(state);
    const existing = await LearnInvestingState.findOne();

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
        const saved = await writeLearnInvestingState(req.body || {});
        res.json(normalizeLearnInvestingState(typeof saved.toObject === 'function' ? saved.toObject() : saved));
    } catch (error) {
        console.error('Error saving learn-investing state:', error);
        res.status(500).json({ error: 'Failed to save learn-investing state' });
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


// --- API Routes (Chemistry Schedule) ---
const chemistrySchedulePath = path.join(__dirname, 'news_settings_chemistry_schedule.json');
const chemistryProgressPath = path.join(__dirname, 'news_settings_chemistry_progress.json');

const defaultChemistrySchedule = [
    { id: 1, dates: "March 1", topics: "Basic concept of chemistry + Thermodynamics" },
    { id: 2, dates: "March 2", topics: "Basic concept of chemistry + Thermodynamics" },
    { id: 3, dates: "March 3", topics: "Revision + Full length paper (Sunday)" },
    { id: 4, dates: "March 4", topics: "Electrochemistry + Solution" },
    { id: 5, dates: "March 5", topics: "Electrochemistry + Solution" },
    { id: 6, dates: "March 6", topics: "Revision" },
    { id: 7, dates: "March 7", topics: "Chemical Bonding + Structure of atom" },
    { id: 8, dates: "March 8", topics: "Chemical Bonding + Structure of atom + Revision + Full length paper (Mar 8 Sunday)" },
    { id: 9, dates: "March 9", topics: "Chemical kinetics + Aldehyde ketone" },
    { id: 10, dates: "March 10", topics: "Chemical kinetics + Aldehyde ketone + Chemo -> So Revision (Side Note)" },
    { id: 11, dates: "March 11", topics: "Chemical kinetics + Aldehyde ketone" },
    { id: 12, dates: "March 12", topics: "Periodicity classification of elements + Aliphatic Hydrocarbon" },
    { id: 13, dates: "March 13", topics: "Periodicity classification of elements + Aliphatic Hydrocarbon" },
    { id: 14, dates: "March 14", topics: "Revision" },
    { id: 15, dates: "March 15", topics: "d & f block + Biomolecules" },
    { id: 16, dates: "March 16", topics: "d & f block + Biomolecules" },
    { id: 17, dates: "March 17", topics: "Revision + Full length paper (Sunday)" },
    { id: 18, dates: "March 18", topics: "Coordination chemistry + Amines" },
    { id: 19, dates: "March 19", topics: "Coordination chemistry + Amines" },
    { id: 20, dates: "March 20", topics: "Revision" },
    { id: 21, dates: "March 21", topics: "Alcohol, phenol and ethers + Haloalkanes, Haloarenes" },
    { id: 22, dates: "March 22", topics: "Alcohol, phenol and ethers + Haloalkanes, Haloarenes" },
    { id: 23, dates: "March 23", topics: "Revision + Full length paper" },
    { id: 24, dates: "March 24", topics: "Principles, techniques + Equilibrium + Redox Rxn [less Important]" },
    { id: 25, dates: "March 25", topics: "Principles, techniques + Equilibrium + Redox Rxn [less Important]" },
    { id: 26, dates: "March 26", topics: "Principles, techniques + Equilibrium + Redox Rxn + Revision + Full length paper [less Important]" }
];

app.get('/api/chemistry/schedule', async (req, res) => {
    try {
        let schedule = await ChemistrySchedule.find().sort({ id: 1 });
        if (schedule.length === 0) {
            // Seed from file if exists, or use default
            console.log('Seeding Chemistry Schedule from JSON...');
            let initialData = defaultChemistrySchedule;
            if (fs.existsSync(chemistrySchedulePath)) {
                initialData = JSON.parse(await fsPromises.readFile(chemistrySchedulePath, 'utf-8'));
            }
            await ChemistrySchedule.insertMany(initialData);
            schedule = await ChemistrySchedule.find().sort({ id: 1 });
        }
        res.json(schedule);
    } catch (error) {
        console.error('Error reading chemistry schedule:', error);
        res.status(500).json({ error: 'Failed to load schedule' });
    }
});

app.post('/api/chemistry/schedule', async (req, res) => {
    try {
        const schedule = req.body;
        if (!Array.isArray(schedule)) return res.status(400).json({ error: 'Schedule must be an array' });

        // Replace all
        await ChemistrySchedule.deleteMany({});
        await ChemistrySchedule.insertMany(schedule);

        res.json({ message: 'Schedule updated successfully' });
    } catch (error) {
        console.error('Error saving chemistry schedule:', error);
        res.status(500).json({ error: 'Failed to save schedule' });
    }
});

app.get('/api/chemistry/progress', async (req, res) => {
    try {
        let progressDoc = await ChemistryProgress.findOne().sort({ createdAt: -1 });
        if (!progressDoc) {
            if (fs.existsSync(chemistryProgressPath)) {
                const data = JSON.parse(await fsPromises.readFile(chemistryProgressPath, 'utf-8'));
                progressDoc = await ChemistryProgress.create({ data });
            } else {
                progressDoc = { data: {} };
            }
        }
        res.json(progressDoc.data || {});
    } catch (error) {
        console.error('Error reading chemistry progress:', error);
        res.status(500).json({ error: 'Failed to load progress' });
    }
});

app.post('/api/chemistry/progress', async (req, res) => {
    try {
        const progressData = req.body;
        // Update or create the latest progress doc
        const lastDoc = await ChemistryProgress.findOne().sort({ createdAt: -1 });
        if (lastDoc) {
            lastDoc.data = progressData;
            await lastDoc.save();
        } else {
            await ChemistryProgress.create({ data: progressData });
        }
        res.json({ message: 'Progress updated successfully' });
    } catch (error) {
        console.error('Error saving chemistry progress:', error);
        res.status(500).json({ error: 'Failed to save progress' });
    }
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

        normalized[normalizedGuid] = {
            ...article,
            guid: normalizedGuid
        };
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
    let data = await NewsHuntData.findOne();

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
    const existing = await NewsHuntData.findOne();

    if (existing) {
        existing.settings = normalized.settings;
        existing.feeds = normalized.feeds;
        existing.articles = normalized.articles;
        existing.chatHistory = normalized.chatHistory;
        existing.articleContent = normalized.articleContent;
        existing.markModified('settings');
        existing.markModified('feeds');
        existing.markModified('articles');
        existing.markModified('chatHistory');
        existing.markModified('articleContent');
        await existing.save();
        return existing;
    }

    return NewsHuntData.create(normalized);
};

// GET /api/newshunt/ai-config — provide API keys from environment variables
app.get('/api/newshunt/ai-config', (req, res) => {
    const config = {};
    if (process.env.GROQ_API_KEY) config.groq = process.env.GROQ_API_KEY;
    if (process.env.OPENROUTER_API_KEY) config.openrouter = process.env.OPENROUTER_API_KEY;
    if (process.env.GEMINI_API_KEY) config.gemini = process.env.GEMINI_API_KEY;
    res.json(config);
});

// POST /api/newshunt/sideload — Completely replace server data with an imported JSON file
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

        const savedData = await writeNewshuntData(serverData);
        const normalized = normalizeNewshuntData(savedData);
        res.json({
            ok: true, message: 'Server data replaced successfully', counts: {
                settings: Object.keys(normalized.settings).length,
                feeds: normalized.feeds.length,
                articles: Object.keys(normalized.articles).length
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
        const data = await readNewshuntData();
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
            serverData.settings = normalizeNewshuntSettings(clientSettings);
        }

        if (clientFeeds !== undefined) {
            serverData.feeds = normalizeNewshuntFeeds(clientFeeds);
        }

        if (clientArticles !== undefined) {
            serverData.articles = normalizeNewshuntArticles(clientArticles);
        }

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

        const existing = await NewsHuntData.findOne();
        if (existing) {
            // Atomic update to avoid race condition during burst saves
            await NewsHuntData.updateOne(
                { _id: existing._id },
                { $set: { [`settings.${key}`]: value } }
            );
        } else {
            // Fallback if no document exists yet
            const defaultData = NEWSHUNT_DEFAULT_STATE;
            defaultData.settings[key] = value;
            await NewsHuntData.create(defaultData);
        }

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

        const data = await readNewshuntData();
        const article = data.articles[guid];
        if (!article) {
            data.articles[guid] = { guid, isRead: true, readAt: Date.now() };
        } else {
            article.isRead = true;
            article.readAt = article.readAt || Date.now();
            data.articles[guid] = article;
        }
        await writeNewshuntData(data);
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
        const data = await readNewshuntData();
        data.feeds = normalizeNewshuntFeeds(feeds);
        await writeNewshuntData(data);
        res.json({ ok: true, count: data.feeds.length });
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
        
        const data = await readNewshuntData();
        data.articles[article.guid] = article; // Insert or overwrite
        await writeNewshuntData(data);
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
        
        const data = await readNewshuntData();
        for (const article of articles) {
            if (article && article.guid) {
                data.articles[article.guid] = article;
            }
        }
        await writeNewshuntData(data);
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
        const days = Number(maxAgeDays) || 3;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const data = await readNewshuntData();
        let deletedCount = 0;
        
        for (const guid in data.articles) {
            const article = data.articles[guid];
            const articleDate = new Date(article.pubDate || article.dateAdded || 0).getTime();
            if (articleDate < cutoff) {
                delete data.articles[guid];
                if (data.articleContent[guid]) delete data.articleContent[guid];
                deletedCount++;
            }
        }
        await writeNewshuntData(data);
        res.json({ ok: true, deletedCount });
    } catch (error) {
        console.error('Error in POST /api/newshunt/articles/purge:', error);
        res.status(500).json({ error: 'Failed to purge articles' });
    }
});

// POST /api/newshunt/chat — add chat message
app.post('/api/newshunt/chat', async (req, res) => {
    try {
        const { articleGuid, role, content } = req.body;
        if (!articleGuid || !role || !content) return res.status(400).json({ error: 'Missing chat params' });
        
        const data = await readNewshuntData();
        const newMessage = {
            id: Date.now() + Math.random().toString(36).substring(7),
            articleGuid,
            role,
            content,
            timestamp: Date.now()
        };
        data.chatHistory.push(newMessage);
        await writeNewshuntData(data);
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
        if (!guid || !content) return res.status(400).json({ error: 'guid and content required' });
        
        const data = await readNewshuntData();
        data.articleContent[guid] = content;
        await writeNewshuntData(data);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error in POST /api/newshunt/article-content:', error);
        res.status(500).json({ error: 'Failed to save article content' });
    }
});

// POST /api/newshunt/article-content/clear
app.post('/api/newshunt/article-content/clear', async (req, res) => {
    try {
        const data = await readNewshuntData();
        data.articleContent = {};
        await writeNewshuntData(data);
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
        const notes = await QuickNote.find().sort({ pinned: -1, updatedAt: -1, createdAt: -1 });
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
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

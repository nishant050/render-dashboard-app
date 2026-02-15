const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const Groq = require('groq-sdk');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
// Read GROQ API key from environment. Support both `GROQ_API_KEY`
// and `REDACTED_GROQ_API_KEY` (in case you added that name on Render).
const groqApiKey = process.env.GROQ_API_KEY || process.env.REDACTED_GROQ_API_KEY;
if (!groqApiKey) {
    console.warn('Warning: GROQ API key not found in environment variables. Set GROQ_API_KEY on Render.');
}
const groq = new Groq({ apiKey: groqApiKey });

// Middleware to parse JSON bodies
app.use(express.json());

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
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const subfolder = req.body.path || '';
        const fullPath = path.join(uploadsDir, subfolder);
        fs.mkdirSync(fullPath, { recursive: true });
        cb(null, fullPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });


// --- Newspaper Scraper Setup ---
// CORRECTED: Removed hardcoded logo URLs. The path will be generated automatically.
const NEWSPAPERS_CONFIG = [
    { name: "Hindustan Times", url: "https://epaperwave.com/hindustan-times-epaper-pdf-today/" },
    { name: "The Times of India", url: "https://epaperwave.com/the-times-of-india-epaper-pdf-download/" },
    { name: "The Mint", url: "https://epaperwave.com/download-the-mint-epaper-pdf-for-free-today/" },
    { name: "Dainik Bhaskar", url: "https://epaperwave.com/dainik-bhaskar-epaper-today-pdf/" },
    { name: "Punjab Kesari", url: "https://epaperwave.com/free-punjab-kesari-epaper-pdf-download-now/" }
];
let newspaperCache = { data: null, lastFetched: 0 };


// --- API Routes ---

// 1. LIST contents of a directory
app.get('/api/files', async (req, res) => {
    try {
        const directoryPath = req.query.path ? path.join(uploadsDir, req.query.path) : uploadsDir;
        if (!directoryPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }
        const items = await fsPromises.readdir(directoryPath, { withFileTypes: true });
        const files = items.map(item => ({
            name: item.name,
            isDirectory: item.isDirectory(),
        }));
        res.json(files);
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).send('Server error while listing files.');
    }
});

// 2. UPLOAD a file
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.json({ message: `File '${req.file.originalname}' uploaded successfully!` });
});

// 3. CREATE a new folder
app.post('/api/folders', async (req, res) => {
    try {
        const { name, path: currentPath } = req.body;
        if (!name) {
            return res.status(400).send('Folder name is required.');
        }
        const newFolderPath = path.join(uploadsDir, currentPath || '', name);
        if (!newFolderPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }
        await fsPromises.mkdir(newFolderPath);
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
        const itemPath = path.join(uploadsDir, currentPath || '', name);
        if (!itemPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }
        const stats = await fsPromises.stat(itemPath);
        if (stats.isDirectory()) {
            await fsPromises.rm(itemPath, { recursive: true, force: true });
        } else {
            await fsPromises.unlink(itemPath);
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
        const oldPath = path.join(uploadsDir, currentPath || '', oldName);
        const newPath = path.join(uploadsDir, currentPath || '', newName);
        if (!oldPath.startsWith(uploadsDir) || !newPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }
        await fsPromises.rename(oldPath, newPath);
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
        const newFilePath = path.join(uploadsDir, currentPath || '', finalFilename);
        if (!newFilePath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }
        await fsPromises.writeFile(newFilePath, content || '');
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
        const fullSourcePath = path.join(uploadsDir, sourcePath);
        const fullTargetPath = path.join(uploadsDir, targetPath);
        if (!fullSourcePath.startsWith(uploadsDir) || !fullTargetPath.startsWith(uploadsDir)) {
            return res.status(403).send('Forbidden');
        }
        await fsPromises.mkdir(path.dirname(fullTargetPath), { recursive: true });
        await fsPromises.rename(fullSourcePath, fullTargetPath);
        res.json({ message: `Moved '${sourcePath}' to '${targetPath}' successfully!` });
    } catch (error) {
        console.error('Error moving item:', error);
        res.status(500).send('Server error while moving item.');
    }
});

// 8. CLEAR ALL files and folders
app.delete('/api/clear-all', async (req, res) => {
    try {
        const entries = await fsPromises.readdir(uploadsDir);
        for (const entry of entries) {
            const entryPath = path.join(uploadsDir, entry);
            const stats = await fsPromises.stat(entryPath);
            if (stats.isDirectory()) {
                await fsPromises.rm(entryPath, { recursive: true, force: true });
            } else {
                await fsPromises.unlink(entryPath);
            }
        }
        res.json({ message: 'All files and folders have been cleared.' });
    } catch (error) {
        console.error('Error clearing storage:', error);
        res.status(500).send('Server error while clearing storage.');
    }
});


// 9. SCRAPE for latest newspapers
app.get('/api/newspapers', async (req, res) => {
    const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

    if (Date.now() - newspaperCache.lastFetched < CACHE_DURATION && newspaperCache.data) {
        return res.json(newspaperCache.data);
    }

    console.log('Cache stale or empty. Scraping for new e-papers...');

    const scrapeNewspaper = async (newspaperInfo, targetDate) => {
        const dateStr = targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        try {
            const { data } = await axios.get(newspaperInfo.url);
            const $ = cheerio.load(data);
            let foundLink = null;

            $('p.has-text-align-center').each((i, el) => {
                if ($(el).text().trim().startsWith(dateStr)) {
                    const linkTag = $(el).find('a');
                    if (linkTag.length) {
                        foundLink = linkTag.attr('href');
                        return false;
                    }
                }
            });
            
            // CORRECTED: Automatically generate the local logo path
            const logoFileName = newspaperInfo.name.toLowerCase().replace(/ /g, '-') + '.png';
            return { 
                ...newspaperInfo, 
                link: foundLink,
                logo: `/assets/${logoFileName}` // Use local path
            };
        } catch (error) {
            console.error(`Failed to scrape ${newspaperInfo.name}:`, error.message);
            const logoFileName = newspaperInfo.name.toLowerCase().replace(/ /g, '-') + '.png';
            return { ...newspaperInfo, link: null, logo: `/assets/${logoFileName}` };
        }
    };

    const findPapersForDate = async (date) => {
        return Promise.all(NEWSPAPERS_CONFIG.map(config => scrapeNewspaper(config, date)));
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

    const finalData = {
        date: displayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        papers: results.filter(p => p.link)
    };

    newspaperCache = { data: finalData, lastFetched: Date.now() };
    res.json(finalData);
});


// --- API Routes (News Agent - MULTI-SECTION) ---
const settingsFilePath = path.join(__dirname, 'news_settings.json');
const NEWS_MODEL_ALIASES = {
    'compound-beta': 'groq/compound',
    'compound-beta-mini': 'groq/compound-mini',
    'llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
};
const DEFAULT_NEWS_MODEL = 'groq/compound-mini';

const normalizeSection = (section = {}) => ({
    id: section.id ? String(section.id) : Date.now().toString(),
    title: (section.title || 'Untitled section').trim(),
    topic: (section.topic || '').trim(),
    sites: (section.sites || '').trim(),
    model: NEWS_MODEL_ALIASES[section.model] || section.model || DEFAULT_NEWS_MODEL,
});

// Helper to read/write settings
const readSettings = async () => {
    const raw = JSON.parse(await fsPromises.readFile(settingsFilePath, 'utf-8'));
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeSection);
};
const writeSettings = async (data) => await fsPromises.writeFile(settingsFilePath, JSON.stringify(data, null, 2), 'utf-8');

// 12. GET ALL NEWS SECTIONS
app.get('/api/news-sections', async (req, res) => {
    try {
        const sections = await readSettings();
        res.json(sections);
    } catch (error) { res.status(500).send("Could not load sections."); }
});

// 13. ADD A NEWS SECTION
app.post('/api/news-sections', async (req, res) => {
    try {
        const { title, topic, sites, model } = req.body;
        if (!title || !topic || !sites || !model) return res.status(400).send("All fields are required.");
        
        const sections = await readSettings();
        const newSection = normalizeSection({ id: Date.now().toString(), title, topic, sites, model });
        sections.push(newSection);
        await writeSettings(sections);
        res.status(201).json(newSection);
    } catch (error) { res.status(500).send("Could not save new section."); }
});

// 14. UPDATE A NEWS SECTION
app.put('/api/news-sections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, topic, sites, model } = req.body;
        let sections = await readSettings();
        const index = sections.findIndex(s => s.id === id);
        if (index === -1) return res.status(404).send("Section not found.");

        sections[index] = normalizeSection({ id, title, topic, sites, model });
        await writeSettings(sections);
        res.json(sections[index]);
    } catch (error) { res.status(500).send("Could not update section."); }
});

// 15. DELETE A NEWS SECTION
app.delete('/api/news-sections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let sections = await readSettings();
        const filteredSections = sections.filter(s => s.id !== id);
        if (sections.length === filteredSections.length) return res.status(404).send("Section not found.");

        await writeSettings(filteredSections);
        res.status(204).send();
    } catch (error) { res.status(500).send("Could not delete section."); }
});

// 16. SUMMARIZE ALL SECTIONS (PARALLEL)
app.get('/api/summarize-all', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const processSection = async (section) => {
        try {
            const { id, title, topic, sites, model } = section;
            sendEvent({ type: 'status', sectionId: id, message: `🔍 Initializing "${title}"...` });
            const siteList = sites.split(',').map(s => s.trim()).filter(s => s);
            if (siteList.length === 0) throw new Error("No valid sites in settings.");

            const userPrompt = `
                Your response MUST be a single, valid JSON object and nothing else. Do not include any introductory text, closing remarks, or any other content outside of the JSON object.

                You are an expert news analyst. Your task is to provide a comprehensive summary of the latest news on the topic: "${topic}".
                You MUST restrict your web search to ONLY the following websites: ${siteList.join(', ')}.

                Follow these steps precisely:
                1. Perform web searches across the specified sites to gather relevant articles.
                2. From the articles, identify and extract the URLs of 1 to 3 of the most relevant, high-quality images that visually represent the news.
                3. Synthesize the text information into a cohesive news article in Markdown format. The article must have a headline (e.g., "# Headline"), an introduction, and several key bullet points (e.g., "* Point 1").
                
                Your final output must be a single JSON object structured exactly like this example:
                {
                  "summary": "# Example Headline\\n\\nThis is the introductory paragraph.\\n\\n* This is the first key point.\\n* This is the second key point.",
                  "images": [
                    "https://example.com/image1.jpg",
                    "https://example.com/image2.png"
                  ]
                }
            `;

            sendEvent({ type: 'status', sectionId: id, message: `Searching across ${siteList.length} sites...` });
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: userPrompt }], model, search_settings: { include_domains: siteList }
            });
            
            const responseContent = completion.choices?.[0]?.message?.content || '';
            sendEvent({ type: 'status', sectionId: id, message: `✅ Search complete. Parsing summary...` });

            let parsedResponse;
            try {
                const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("No valid JSON object found in the model's response.");
                parsedResponse = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                parsedResponse = {
                    summary: `The model returned a response that could not be parsed as JSON.\n\nRaw response excerpt:\n\n\`\`\`\n${responseContent.slice(0, 1200)}\n\`\`\``,
                    images: []
                };
            }
            
            sendEvent({ type: 'result', sectionId: id, data: parsedResponse });

        } catch (error) {
            console.error(`Error processing section ${section.id}:`, error);
            sendEvent({ type: 'error', sectionId: section.id, message: error.message });
        }
    };

    try {
        const sections = await readSettings();
        await Promise.all(sections.map(section => processSection(section)));
    } catch (e) {
        sendEvent({ type: 'error', sectionId: 'global', message: "Failed to read settings file." });
    } finally {
        sendEvent({ type: 'done' });
        res.end();
    }
});

// Proxy endpoint: POST /api/groq-chat
// Accepts { model, messages, temperature, search_settings } and returns
// the Groq chat completion. Keeps the API key on the server.
app.post('/api/groq-chat', async (req, res) => {
    try {
        if (!groqApiKey) return res.status(500).json({ error: 'GROQ API key not configured on server.' });

        const { model = 'groq/compound', messages, temperature = 0.1, search_settings } = req.body;
        if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array is required' });

        const completion = await groq.chat.completions.create({ model, messages, temperature, search_settings });
        res.json(completion);
    } catch (err) {
        console.error('Error in /api/groq-chat:', err?.response?.data || err.message || err);
        res.status(500).json({ error: err.message || 'Groq request failed' });
    }
});

// ===============================================
// === YOUTUBE DOWNLOADER API (LOCAL ytdlp) ======
// ===============================================

const downloads = new Map();
const ytdownloaderSettings = {
    proxy: null,
    cookies: null
};
const videosDir = path.join(__dirname, 'public', 'videos');
const videoExtensions = new Set(['.mp4', '.webm', '.mkv']);
const thumbnailExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const sidecarExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.info.json'];

const sendApiError = (res, status, message) => res.status(status).json({ ok: false, error: message });

const isSafeVideoFileName = (value) => {
    if (typeof value !== 'string' || value.trim() === '') return false;
    if (value.includes('\0')) return false;
    if (value.includes('/') || value.includes('\\')) return false;
    return path.basename(value) === value;
};

const ensureVideosDir = async () => {
    await fsPromises.mkdir(videosDir, { recursive: true });
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
    const args = ['--no-warnings', '--newline'];
    if (ytdownloaderSettings.proxy) {
        args.push('--proxy', ytdownloaderSettings.proxy);
    }
    if (ytdownloaderSettings.cookies) {
        args.push('--cookies-from-browser', ytdownloaderSettings.cookies);
    }
    return args;
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

const extractFormats = (info) => {
    const formats = [];
    const seenHeights = new Set();
    for (const format of info.formats || []) {
        const height = format.height;
        if (!height || seenHeights.has(height)) continue;
        seenHeights.add(height);
        formats.push({
            format_id: format.format_id,
            quality: `${height}p`,
            height,
            filesize: format.filesize || 0,
            has_audio: format.acodec !== 'none' && format.acodec != null,
            format_note: format.format_note || '',
            ext: format.ext || 'mp4',
            vcodec: format.vcodec || 'unknown',
            acodec: format.acodec || 'unknown'
        });
    }
    formats.sort((a, b) => b.height - a.height);
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
    const formatExpr = formatId === 'best' ? 'bestvideo+bestaudio/best' : `${formatId}+bestaudio/best`;
    const commonArgs = getYtDlpOptionsArgs();
    const startedAt = Date.now();
    let lastPrintedPath = null;
    let buffer = '';

    const args = [
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
    ];

    try {
        updateDownload(downloadId, { status: 'downloading', message: 'Downloading...', progress: 1, error: null });
        await runYtDlp(args, {
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
        const errorMessage = (error.stderr || error.stdout || error.message || 'Download failed').slice(0, 500);
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
        const { stdout } = await runYtDlp(args, { timeoutMs: 120000 });
        const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'));
        if (!jsonLine) {
            return sendApiError(res, 400, 'Failed to fetch video info.');
        }
        const info = JSON.parse(jsonLine);

        return res.json({
            title: info.title || 'Unknown',
            thumbnail: info.thumbnail || '',
            duration: info.duration || 0,
            uploader: info.uploader || 'Unknown',
            formats: extractFormats(info),
            url: cleanUrl
        });
    } catch (error) {
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
        cookies: ytdownloaderSettings.cookies
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

app.post('/api/settings/cookies', (req, res) => {
    const browser = typeof req.body?.browser === 'string' ? req.body.browser.trim() : '';
    ytdownloaderSettings.cookies = browser || null;
    if (ytdownloaderSettings.cookies) {
        return res.json({ ok: true, message: `Cookies from ${ytdownloaderSettings.cookies} will be used`, browser: ytdownloaderSettings.cookies });
    }
    return res.json({ ok: true, message: 'Cookies cleared' });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

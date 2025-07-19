const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// --- Static File Serving ---
// Serve the main front-end, apps, and uploads
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve the new assets folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));


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


// --- Groq News Agent Dependencies ---
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- API Routes (News Agent) ---

// 12. SUMMARIZE NEWS using Groq Agentic Tooling
app.get('/api/summarize-news', async (req, res) => {
    const { topic, sites } = req.query;

    if (!topic || !sites) {
        return res.status(400).send('Topic and sites are required.');
    }

    const siteList = sites.split(',').map(s => s.trim()).filter(s => s);
    if (siteList.length === 0) {
        return res.status(400).send('At least one valid site is required.');
    }

    // Set up headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        sendEvent({ type: 'status', message: `🔍 Initializing news agent for topic: "${topic}"...` });

        const userPrompt = `
            Please act as an expert news analyst. Your task is to provide a concise, well-structured summary of the latest news regarding the topic: "${topic}".
            You MUST restrict your search to the following websites: ${siteList.join(', ')}.
            First, perform a web search across these sites to gather all relevant articles and information.
            After gathering the information, synthesize it into a single, cohesive news article.
            The article should have a clear headline, a brief introductory paragraph, and several key bullet points summarizing the main findings.
            Conclude with a short sentence on the overall sentiment or outlook.
            Do not mention your process; only output the final news article.
        `;

        sendEvent({ type: 'status', message: `Searching across ${siteList.length} specified site(s)...` });

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: userPrompt }],
            model: "compound-beta", // Use the powerful agentic model
            search_settings: {
                include_domains: siteList // Restrict search to these domains
            }
        });
        
        const summary = completion.choices[0].message.content;
        const executedTools = completion.choices[0].message.executed_tools;

        sendEvent({ type: 'status', message: '✅ Search complete. Generating summary...' });
        sendEvent({ type: 'tools', data: executedTools });
        sendEvent({ type: 'summary', data: summary });
        sendEvent({ type: 'done' });

    } catch (error) {
        console.error('Groq API Error:', error);
        sendEvent({ type: 'error', message: 'Failed to get summary from Groq API.' });
    } finally {
        res.end();
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

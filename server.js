const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const Groq = require('groq-sdk');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

// Helper to read/write settings
const readSettings = async () => JSON.parse(await fsPromises.readFile(settingsFilePath, 'utf-8'));
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
        const newSection = { id: Date.now().toString(), title, topic, sites, model };
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

        sections[index] = { id, title, topic, sites, model };
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
            
            const responseContent = completion.choices[0].message.content;
            sendEvent({ type: 'status', sectionId: id, message: `✅ Search complete. Parsing summary...` });

            let parsedResponse;
            try {
                const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("No valid JSON object found in the model's response.");
                parsedResponse = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                parsedResponse = { summary: "The model returned a response that could not be automatically parsed.", images: [] };
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

// ===============================================
// === YOUTUBE DOWNLOADER API - MISSION CONTROL ===
// ===============================================

// In-memory store for download jobs. In a real production app, use a database like Redis.
const jobs = {};

// 1. Endpoint for your WEBSITE to START a new download job
app.post('/api/ytdownloader/start-download', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ message: 'URL is required' });
    }

    // Generate a unique ID for this job
    const jobId = crypto.randomBytes(12).toString('hex');
    
    // Store the initial state of the job
    jobs[jobId] = {
        id: jobId,
        url: url,
        status: 'Queued',
        progress: 0,
        message: 'Workflow is being triggered...',
        timestamp: Date.now()
    };

    // Use the GitHub API to trigger the 'repository_dispatch' event in your workflow
    try {
        await axios.post(
            // This is the GitHub API endpoint for triggering a workflow
            `https://api.github.com/repos/${process.env.GITHUB_USER}/${process.env.GITHUB_REPO}/dispatches`,
            // This is the payload we send. The workflow will receive it.
            {
                event_type: 'trigger-youtube-download', // A custom name for this trigger
                client_payload: {
                    jobId: jobId,
                    videoUrl: url
                }
            },
            // These are the required headers, including your secret Personal Access Token (PAT)
            {
                headers: {
                    'Authorization': `token ${process.env.GITHUB_PAT}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        console.log(`Job ${jobId} triggered successfully for URL: ${url}`);
        // Send the Job ID back to the website so it can start asking for status updates
        res.status(202).json({ jobId: jobId });

    } catch (error) {
        console.error('Error triggering GitHub Action:', error.response ? error.response.data : error.message);
        jobs[jobId].status = 'Failed';
        jobs[jobId].message = 'Error triggering the download workflow.';
        res.status(500).json({ message: 'Failed to start download workflow.' });
    }
});

// 2. Endpoint for the GITHUB ACTION to POST progress updates
app.post('/api/ytdownloader/update-progress', (req, res) => {
    const { jobId, message, progress, finalFile, secret } = req.body;

    // A simple security check to ensure updates are coming from our GitHub Action
    if (secret !== process.env.PROGRESS_UPDATE_SECRET) {
        return res.status(403).send('Forbidden: Invalid secret.');
    }
    
    const job = jobs[jobId];
    if (job) {
        job.message = message;
        job.progress = progress;
        if (progress === 100) {
            job.status = (message.startsWith("An error occurred")) ? 'Failed' : 'Complete';
            job.finalFile = finalFile; // Store the final video filename and path
        } else {
            job.status = 'Processing';
        }
        console.log(`Progress for Job ${jobId}: ${progress}% - ${message}`);
        res.status(200).send('Progress updated.');
    } else {
        res.status(404).send('Job not found.');
    }
});

// 3. Endpoint for your WEBSITE to GET the status of a job
app.get('/api/ytdownloader/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobs[jobId];

    if (job) {
        res.json(job);
    } else {
        res.status(404).json({ message: 'Job not found.' });
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

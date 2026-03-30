const puppeteer = require('puppeteer');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const CrawlerTask = mongoose.model('CrawlerTask');
const CrawlerRun = mongoose.model('CrawlerRun');

function isThinkingPart(part) {
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

function extractOpenAIContentParts(value) {
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

        if (isThinkingPart(part)) reasoning += text;
        else content += text;
    }

    return { content, reasoning };
}

function normalizeAIMessage(message = {}) {
    const contentParts = extractOpenAIContentParts(message.content);
    return {
        ...message,
        content: contentParts.content
    };
}

let cachedSharedApiSettings = null;
let cachedSharedApiSettingsAt = 0;

function normalizeCrawlerModelSelection(modelString = '') {
    let provider = String(modelString || '').trim();
    let actualModel = String(modelString || '').trim();

    if (actualModel.includes('|')) {
        [provider, actualModel] = actualModel.split('|');
    } else {
        if (actualModel === 'groq') {
            provider = 'groq';
            actualModel = 'llama-3.3-70b-versatile';
        } else if (actualModel === 'gemini') {
            provider = 'openrouter';
            actualModel = 'google/gemini-2.5-flash';
        } else if (actualModel === 'openrouter') {
            provider = 'openrouter';
            actualModel = 'anthropic/claude-3.5-sonnet:beta';
        } else {
            provider = 'groq';
        }
    }

    const normalizedModel = actualModel.toLowerCase().replace(/[\s_]+/g, '-');
    if (provider === 'cerebras' && ['glm-4.7', 'glm4.7', 'z-ai/glm4.7', 'zai-glm-4.7'].includes(normalizedModel)) {
        actualModel = 'zai-glm-4.7';
    }
    if (provider === 'nvidia' && ['glm-4.7', 'glm4.7', 'z-ai/glm4.7', 'zai-glm-4.7'].includes(normalizedModel)) {
        actualModel = 'z-ai/glm4.7';
    }

    return { provider, actualModel };
}

async function getSharedApiSettings() {
    const now = Date.now();
    if (cachedSharedApiSettings && (now - cachedSharedApiSettingsAt) < 30000) {
        return cachedSharedApiSettings;
    }

    try {
        const db = mongoose.connection.db;
        const newshuntDoc = await db.collection('newshuntdatas').findOne({});
        cachedSharedApiSettings = newshuntDoc?.settings || {};
        cachedSharedApiSettingsAt = now;
        return cachedSharedApiSettings;
    } catch (error) {
        return {};
    }
}

async function getProviderApiKey(provider) {
    const envKeyMap = {
        groq: process.env.GROQ_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        cerebras: process.env.CEREBRAS_API_KEY,
        nvidia: process.env.NVIDIA_API_KEY,
        mistral: process.env.MISTRAL_API_KEY,
        gemini: process.env.GEMINI_API_KEY
    };

    if (envKeyMap[provider]) return envKeyMap[provider];

    const sharedSettings = await getSharedApiSettings();
    return sharedSettings[`api_key_${provider}`] || sharedSettings.ai_api_key || '';
}

async function callAIWithFallback(messages, primaryModel, fallbackModel, tools, log, label = 'AI') {
    try {
        log(`\x1b[90m[${label}]\x1b[0m Thinking with primary model (${primaryModel})...`);
        return await callAI(messages, primaryModel, tools);
    } catch (primaryError) {
        console.warn(`\x1b[31m[${label} Error]\x1b[0m ${primaryError.message}`);
        if (!fallbackModel || fallbackModel === primaryModel) {
            throw primaryError;
        }

        log(`\x1b[33m[${label} Fallback]\x1b[0m Swapping to ${fallbackModel}...`);
        return await callAI(messages, fallbackModel, tools);
    }
}

async function buildRecoverySummary(task, visitedUrls, pageSnapshots, primaryModel, fallbackModel, log) {
    const snapshotEntries = Array.from(pageSnapshots.entries());
    if (snapshotEntries.length === 0) {
        return null;
    }

    const collectedContext = snapshotEntries.map(([url, text], index) => {
        return `## Page ${index + 1}\nURL: ${url}\n${String(text || '').slice(0, 12000)}`;
    }).join('\n\n');

    const recoveryMessages = [
        {
            role: 'system',
            content: 'You are a precise web research assistant. Produce a concise but complete markdown summary from the collected crawler notes. Do not mention missing tools or agent loops. If some details are uncertain, say so briefly.'
        },
        {
            role: 'user',
            content: `Task: ${task.name}\nGoal: ${task.goal}\nVisited URLs:\n${visitedUrls.join('\n')}\n\nCollected page notes:\n${collectedContext}\n\nWrite the final markdown summary that the crawler should have finalized with.`
        }
    ];

    const response = await callAIWithFallback(recoveryMessages, primaryModel, fallbackModel, null, log, 'Recovery AI');
    return response?.content || response || null;
}

function getCrawlerRemoteBrowserEndpoints() {
    const endpoints = [];

    if (process.env.CRAWLER_BROWSER_WS_ENDPOINT) {
        endpoints.push({
            label: 'Configured remote browser',
            wsEndpoint: process.env.CRAWLER_BROWSER_WS_ENDPOINT
        });
    }

    if (process.env.BROWSER_WS_ENDPOINT && process.env.BROWSER_WS_ENDPOINT !== process.env.CRAWLER_BROWSER_WS_ENDPOINT) {
        endpoints.push({
            label: 'Shared remote browser',
            wsEndpoint: process.env.BROWSER_WS_ENDPOINT
        });
    }

    if (process.env.ZENROWS_API_KEY) {
        endpoints.push({
            label: 'ZenRows browser',
            wsEndpoint: `wss://browser.zenrows.com?apikey=${process.env.ZENROWS_API_KEY}&proxy_region=${process.env.ZENROWS_PROXY_REGION || 'global'}`
        });
    }

    return endpoints;
}

function formatBrowserConnectError(error) {
    const message = error?.message || String(error);
    if (message.includes('Unexpected server response: 400')) {
        return `${message}. The remote browser rejected the websocket handshake. Check the browser endpoint, API key, and service quota/access.`;
    }
    return message;
}

function getLocalBrowserExecutableCandidates() {
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_BIN,
        process.env.EDGE_BIN,
        process.env.GOOGLE_CHROME_BIN
    ].filter(Boolean);

    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA;
        candidates.push(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
        );
        if (localAppData) {
            candidates.push(
                path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
            );
        }
    } else if (process.platform === 'darwin') {
        candidates.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        );
    } else {
        candidates.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/microsoft-edge'
        );
    }

    return [...new Set(candidates)];
}

function resolveLocalBrowserExecutablePath() {
    for (const candidate of getLocalBrowserExecutableCandidates()) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

async function launchCrawlerBrowser(log) {
    const remoteEndpoints = getCrawlerRemoteBrowserEndpoints();
    const errors = [];

    for (const endpoint of remoteEndpoints) {
        try {
            log(`\x1b[90m[Browser]\x1b[0m Connecting via ${endpoint.label}...`);
            const browser = await puppeteer.connect({
                browserWSEndpoint: endpoint.wsEndpoint,
                protocolTimeout: 60000
            });
            return { browser, mode: endpoint.label };
        } catch (error) {
            const formatted = formatBrowserConnectError(error);
            errors.push(`${endpoint.label}: ${formatted}`);
            log(`\x1b[33m[Browser Warning]\x1b[0m ${endpoint.label} failed: ${formatted}`);
        }
    }

    try {
        log(`\x1b[90m[Browser]\x1b[0m Launching local Chromium fallback...`);
        const executablePath = resolveLocalBrowserExecutablePath();
        if (executablePath) {
            log(`\x1b[90m[Browser]\x1b[0m Using local browser at ${executablePath}`);
        }

        const browser = await puppeteer.launch({
            headless: true,
            protocolTimeout: 60000,
            ...(executablePath ? { executablePath } : {}),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        return { browser, mode: 'Local Chromium' };
    } catch (error) {
        const formatted = formatBrowserConnectError(error);
        const installHint = resolveLocalBrowserExecutablePath()
            ? formatted
            : `${formatted}. Set PUPPETEER_EXECUTABLE_PATH/CHROME_BIN/EDGE_BIN or install a supported browser.`;
        errors.push(`Local Chromium: ${installHint}`);
        throw new Error(`Unable to start crawler browser. ${errors.join(' | ')}`);
    }
}

// --- Helper to call AI Models ---
async function callAI(messages, modelString, tools = null) {
    const { provider, actualModel } = normalizeCrawlerModelSelection(modelString);

    let apiKey = '';
    let baseURL = '';
    const headers = { 'Content-Type': 'application/json' };

    switch (provider) {
        case 'groq':
            apiKey = await getProviderApiKey('groq');
            baseURL = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'openrouter':
            apiKey = await getProviderApiKey('openrouter');
            baseURL = 'https://openrouter.ai/api/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['HTTP-Referer'] = 'http://localhost:3000';
            headers['X-Title'] = 'Dashboard Crawler';
            break;
        case 'cerebras':
            apiKey = await getProviderApiKey('cerebras');
            baseURL = 'https://api.cerebras.ai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'nvidia':
            apiKey = await getProviderApiKey('nvidia');
            baseURL = 'https://integrate.api.nvidia.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'mistral':
            apiKey = await getProviderApiKey('mistral');
            baseURL = 'https://api.mistral.ai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'gemini':
            apiKey = await getProviderApiKey('gemini');
            baseURL = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        default:
            throw new Error(`Unknown provider ${provider}`);
    }

    if (!apiKey) throw new Error(`Missing API Key for provider ${provider}`);

    const payload = {
        model: actualModel,
        messages: messages,
        temperature: 0.1,
        max_tokens: 4000
    };

    if (tools) {
        payload.tools = tools;
        payload.tool_choice = 'auto';
    }

    const response = await axios.post(baseURL, payload, { headers, timeout: 60000 });
    return normalizeAIMessage(response.data.choices[0].message || {});
}

// --- The Agent Tool Schema ---
const CRAWLER_TOOLS = [
    {
        type: "function",
        function: {
            name: "get_page_content",
            description: "Extracts the text content from the current webpage.",
            parameters: { type: "object", properties: {}, required: [] }
        }
    },
    {
        type: "function",
        function: {
            name: "click",
            description: "Clicks on an element matching the given CSS selector, and waits for navigation.",
            parameters: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "The CSS selector of the link or button to click." }
                },
                required: ["selector"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "goto_url",
            description: "Navigates the browser to another URL (e.g. to switch context to the next URL on your target list).",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "The full URL to navigate to." }
                },
                required: ["url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "save_attachment",
            description: "Saves a relevant attachment URL (PDF, image, document) to the run record.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "A readable name for the file." },
                    url: { type: "string", description: "The direct URL to the file." }
                },
                required: ["name", "url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "finalize",
            description: "Ends the scraping task and provides the final formatted summary addressing the goal.",
            parameters: {
                type: "object",
                properties: {
                    summary_markdown: { type: "string", description: "The final extracted data, formatted in Markdown." }
                },
                required: ["summary_markdown"]
            }
        }
    }
];

// --- Single Autonomous Run ---
async function executeCrawlerRun(runId) {
    const run = await CrawlerRun.findById(runId).populate('taskId');
    if (!run || !run.taskId) return;

    const task = run.taskId;
    const pageSnapshots = new Map();
    const toolFailureCounts = new Map();
    const MAX_REPEAT_FAILURES_BEFORE_RECOVERY = 5;

    let browser = null;
    let log = console.log;
    try {
        log = (msg) => {
            console.log(msg);
            const plain = typeof msg === 'string' ? msg.replace(/\x1b\[[0-9;]*m/g, '') : msg;
            CrawlerRun.findByIdAndUpdate(run._id, { $push: { activityLog: `[${new Date().toLocaleTimeString()}] ${plain}` } }).catch(()=>{});
        };

        log(`\n\x1b[1;36m[Crawler 🕷️]\x1b[0m \x1b[33mStarting run ${run._id}\x1b[0m`);
        log(`\x1b[36m[Task]\x1b[0m "${task.name}"`);
        
        const targetUrls = task.startUrls && task.startUrls.length > 0 ? task.startUrls : (task.startUrl ? [task.startUrl] : []);
        log(`\x1b[36m[Target URLs]\x1b[0m ${targetUrls.length}`);
        
        if (targetUrls.length === 0) throw new Error("No start URLs provided for this task.");

        const browserSession = await launchCrawlerBrowser(log);
        browser = browserSession.browser;
        log(`\x1b[90m[Browser]\x1b[0m Ready via ${browserSession.mode}.`);
        
        const page = await browser.newPage();
        log(`\x1b[90m[Browser]\x1b[0m Navigating to ${targetUrls[0]}...`);
        await page.goto(targetUrls[0], { waitUntil: 'networkidle2', timeout: 60000 });
        
        run.visitedUrls.push(page.url());
        await run.save();

        let messages = [
            {
                role: 'system',
                content: `You are an autonomous web extraction agent. Your goal is: ${task.goal}\n\nYou MUST process information from ALL of the following URLs:\n${targetUrls.join('\n')}\n\nYou are currently at URL: ${page.url()}\nUse your tools to extract page content, click to navigate, save relevant attachments, or use goto_url to switch to the next URL in the list. Finally, call 'finalize' when the goal is met across all targets.`
            }
        ];

        let isFinished = false;
        let loopCount = 0;
        const MAX_LOOPS = 25;

        while (!isFinished && loopCount < MAX_LOOPS) {
            loopCount++;
            log(`\n\x1b[35m[Engine]\x1b[0m Loop ${loopCount}/${MAX_LOOPS}`);

            const aiMessage = await callAIWithFallback(messages, task.primaryModel, task.fallbackModel, CRAWLER_TOOLS, log, 'AI');

            messages.push(aiMessage);

            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                for (const toolCall of aiMessage.tool_calls) {
                    const funcName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    let toolResponse = "";
                    const toolSignature = `${funcName}:${JSON.stringify(args)}`;

                    log(`\x1b[92m[Agent => Tool]\x1b[0m \x1b[32m${funcName}\x1b[0m (${JSON.stringify(args).substring(0, 100)}...)`);

                    try {
                        if (funcName === 'get_page_content') {
                            const text = await page.evaluate(() => document.body.innerText);
                            toolResponse = text.substring(0, 40000); 
                            pageSnapshots.set(page.url(), text.substring(0, 15000));
                            toolFailureCounts.clear();
                            log(`\x1b[90m[Tool]\x1b[0m Extracted ${toolResponse.length} characters.`);
                        } 
                        else if (funcName === 'click') {
                            await Promise.all([
                                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
                                page.click(args.selector)
                            ]);
                            toolResponse = `Navigated. New URL: ${page.url()}. Run get_page_content.`;
                            toolFailureCounts.clear();
                            log(`\x1b[90m[Tool]\x1b[0m Navigated to ${page.url()}`);
                            
                            if (!run.visitedUrls.includes(page.url())) {
                                run.visitedUrls.push(page.url());
                                await run.save();
                            }
                        }
                        else if (funcName === 'goto_url') {
                            await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 60000 });
                            toolResponse = `Navigated to: ${page.url()}. Run get_page_content.`;
                            toolFailureCounts.clear();
                            log(`\x1b[90m[Tool]\x1b[0m Switched to ${page.url()}`);
                            
                            if (!run.visitedUrls.includes(page.url())) {
                                run.visitedUrls.push(page.url());
                                await run.save();
                            }
                        }
                        else if (funcName === 'save_attachment') {
                            const uploadsDir = path.join(process.cwd(), 'uploads', 'crawler');
                            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                            
                            const safeName = args.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
                            const fileName = `${Date.now()}_${safeName}`;
                            const filePath = path.join(uploadsDir, fileName);
                            const relativeUrl = `/uploads/crawler/${fileName}`;

                            log(`\x1b[90m[Tool]\x1b[0m Downloading attachment ${args.url}`);
                            const fileRes = await axios.get(args.url, { responseType: 'stream' });
                            const writer = fs.createWriteStream(filePath);
                            fileRes.data.pipe(writer);
                            
                            await new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });

                            run.attachments.push({ name: args.name, url: relativeUrl });
                            await run.save();
                            toolResponse = `Attachment saved as ${relativeUrl}`;
                            toolFailureCounts.clear();
                            log(`\x1b[90m[Tool]\x1b[0m Attachment saved.`);
                        }
                        else if (funcName === 'finalize') {
                            run.finalSummary = args.summary_markdown;
                            run.status = 'success';
                            run.endTime = new Date();
                            await run.save();
                            isFinished = true;
                            toolResponse = "Finalized.";
                            log(`\x1b[92m[Success]\x1b[0m Crawler run complete.`);
                            break; 
                        }
                    } catch (toolErr) {
                        const failureCount = (toolFailureCounts.get(toolSignature) || 0) + 1;
                        toolFailureCounts.set(toolSignature, failureCount);
                        toolResponse = `Error executing tool: ${toolErr.message}. This exact action has failed ${failureCount} time(s). Do not repeat the same action if it keeps failing. Choose another approach or finalize with the information already collected.`;
                        log(`\x1b[31m[Tool Error]\x1b[0m ${toolErr.message}`);

                        if (failureCount >= 3) {
                            messages.push({
                                role: 'user',
                                content: `The exact tool action ${toolSignature} has already failed ${failureCount} times. Stop retrying it. If you have enough information, call finalize now with the best available summary.`
                            });
                        }

                        if (failureCount >= MAX_REPEAT_FAILURES_BEFORE_RECOVERY && pageSnapshots.size > 0) {
                            log(`\x1b[33m[Recovery]\x1b[0m Repeated tool failure detected. Generating summary from collected pages...`);
                            const recoveredSummary = await buildRecoverySummary(task, run.visitedUrls || [], pageSnapshots, task.primaryModel, task.fallbackModel, log);
                            if (recoveredSummary) {
                                run.finalSummary = recoveredSummary;
                                run.status = 'success';
                                run.endTime = new Date();
                                await run.save();
                                isFinished = true;
                                toolResponse = 'Recovery summary generated after repeated tool failures.';
                                log(`\x1b[92m[Recovery]\x1b[0m Summary generated and run finalized.`);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    name: funcName,
                                    content: toolResponse
                                });
                                break;
                            }
                        }
                    }

                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: funcName,
                        content: toolResponse
                    });
                }
            } else {
                log(`\x1b[33m[Agent Warning]\x1b[0m Wandering... no tool calls made.`);
                messages.push({
                    role: 'user',
                    content: "Please use the 'finalize' tool to save the results, or another tool if you still need information."
                });
            }
        }

        if (!isFinished) {
            log(`\x1b[31m[Timeout]\x1b[0m Max loops reached without finalize.`);
            const recoveredSummary = await buildRecoverySummary(task, run.visitedUrls || [], pageSnapshots, task.primaryModel, task.fallbackModel, log);
            if (recoveredSummary) {
                run.finalSummary = recoveredSummary;
                run.status = 'success';
                log(`\x1b[92m[Recovery]\x1b[0m Timeout summary generated from collected pages.`);
            } else {
                run.status = 'failed';
                run.error = 'Max loops reached without finalize tool call.';
            }
        }
    } catch (err) {
        console.error(`\x1b[31m[Crawler Fatal Error]\x1b[0m`, err);
        run.status = 'failed';
        run.error = err.message || JSON.stringify(err);
    } finally {
        run.endTime = new Date();
        await run.save();
        if (browser) await browser.close();
        log(`\x1b[90m[Crawler Shutdown]\x1b[0m Resources cleaned up.`);
    }
}

// --- Background Worker Loop ---
let isWorkerRunning = false;

async function crawlerWorkerLoop() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    try {
        const now = new Date();
        const dueTasks = await CrawlerTask.find({ 
            isActive: true, 
            nextRunAt: { $lte: now } 
        });

        for (const task of dueTasks) {
            task.nextRunAt = new Date(now.getTime() + task.frequencyMinutes * 60000);
            await task.save();

            const run = new CrawlerRun({ taskId: task._id });
            await run.save();

            executeCrawlerRun(run._id);
        }
    } catch (err) {
        console.error('\x1b[31m[CrawlerWorker]\x1b[0m Error checking tasks:', err);
    } finally {
        isWorkerRunning = false;
    }
}

function startBackgroundWorker() {
    setInterval(crawlerWorkerLoop, 60000);
    console.log('\x1b[32m[Startup]\x1b[0m Background crawler started (60s tick).');
}

module.exports = {
    startBackgroundWorker,
    executeCrawlerRun
};

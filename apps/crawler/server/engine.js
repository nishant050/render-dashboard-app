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

// --- Helper to call AI Models ---
async function callAI(messages, modelString, tools = null) {
    let provider = modelString;
    let actualModel = modelString;
    
    if (modelString.includes('|')) {
        [provider, actualModel] = modelString.split('|');
    } else {
        if (modelString === 'groq') { provider = 'groq'; actualModel = 'llama-3.3-70b-versatile'; }
        else if (modelString === 'gemini') { provider = 'openrouter'; actualModel = 'google/gemini-2.5-flash'; }
        else if (modelString === 'openrouter') { provider = 'openrouter'; actualModel = 'anthropic/claude-3.5-sonnet:beta'; }
        else provider = 'groq';
    }

    let apiKey = '';
    let baseURL = '';
    const headers = { 'Content-Type': 'application/json' };

    switch (provider) {
        case 'groq':
            apiKey = process.env.GROQ_API_KEY;
            baseURL = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'openrouter':
            apiKey = process.env.OPENROUTER_API_KEY;
            baseURL = 'https://openrouter.ai/api/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['HTTP-Referer'] = 'http://localhost:3000';
            headers['X-Title'] = 'Dashboard Crawler';
            break;
        case 'nvidia':
            apiKey = process.env.NVIDIA_API_KEY;
            baseURL = 'https://integrate.api.nvidia.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'mistral':
            apiKey = process.env.MISTRAL_API_KEY;
            baseURL = 'https://api.mistral.ai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'gemini':
            apiKey = process.env.GEMINI_API_KEY;
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
    const zenrowsKey = process.env.ZENROWS_API_KEY;
    
    if (!zenrowsKey) {
        run.status = 'failed';
        run.error = 'ZENROWS_API_KEY is missing from environment.';
        return await run.save();
    }

    let browser = null;
    try {
        const log = (msg) => {
            console.log(msg);
            const plain = typeof msg === 'string' ? msg.replace(/\x1b\[[0-9;]*m/g, '') : msg;
            CrawlerRun.findByIdAndUpdate(run._id, { $push: { activityLog: `[${new Date().toLocaleTimeString()}] ${plain}` } }).catch(()=>{});
        };

        log(`\n\x1b[1;36m[Crawler 🕷️]\x1b[0m \x1b[33mStarting run ${run._id}\x1b[0m`);
        log(`\x1b[36m[Task]\x1b[0m "${task.name}"`);
        
        const targetUrls = task.startUrls && task.startUrls.length > 0 ? task.startUrls : (task.startUrl ? [task.startUrl] : []);
        log(`\x1b[36m[Target URLs]\x1b[0m ${targetUrls.length}`);
        
        if (targetUrls.length === 0) throw new Error("No start URLs provided for this task.");

        log(`\x1b[90m[Browser]\x1b[0m Connecting...`);
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://browser.zenrows.com?apikey=${zenrowsKey}&proxy_region=global`
        });
        
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

            let aiMessage;
            try {
                log(`\x1b[90m[AI]\x1b[0m Thinking with primary model (${task.primaryModel})...`);
                aiMessage = await callAI(messages, task.primaryModel, CRAWLER_TOOLS);
            } catch (aiErr) {
                console.warn(`\x1b[31m[AI Error]\x1b[0m ${aiErr.message}`);
                log(`\x1b[33m[AI Fallback]\x1b[0m Swapping to ${task.fallbackModel}...`);
                aiMessage = await callAI(messages, task.fallbackModel, CRAWLER_TOOLS);
            }

            messages.push(aiMessage);

            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                for (const toolCall of aiMessage.tool_calls) {
                    const funcName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    let toolResponse = "";

                    log(`\x1b[92m[Agent => Tool]\x1b[0m \x1b[32m${funcName}\x1b[0m (${JSON.stringify(args).substring(0, 100)}...)`);

                    try {
                        if (funcName === 'get_page_content') {
                            const text = await page.evaluate(() => document.body.innerText);
                            toolResponse = text.substring(0, 40000); 
                            log(`\x1b[90m[Tool]\x1b[0m Extracted ${toolResponse.length} characters.`);
                        } 
                        else if (funcName === 'click') {
                            await Promise.all([
                                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
                                page.click(args.selector)
                            ]);
                            toolResponse = `Navigated. New URL: ${page.url()}. Run get_page_content.`;
                            log(`\x1b[90m[Tool]\x1b[0m Navigated to ${page.url()}`);
                            
                            if (!run.visitedUrls.includes(page.url())) {
                                run.visitedUrls.push(page.url());
                                await run.save();
                            }
                        }
                        else if (funcName === 'goto_url') {
                            await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 60000 });
                            toolResponse = `Navigated to: ${page.url()}. Run get_page_content.`;
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
                        toolResponse = `Error executing tool: ${toolErr.message}`;
                        log(`\x1b[31m[Tool Error]\x1b[0m ${toolErr.message}`);
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
            run.status = 'failed';
            run.error = 'Max loops reached without finalize tool call.';
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

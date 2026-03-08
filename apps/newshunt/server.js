const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3456;
const ROOT = __dirname;

// MIME types
const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

function serveStatic(req, res) {
    let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });
}

function proxyFetch(targetUrl) {
    return new Promise((resolve, reject) => {
        const lib = targetUrl.startsWith('https') ? https : http;
        const req = lib.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 15000
        }, (response) => {
            // Handle redirects
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
}

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);

    // CORS proxy endpoint
    if (parsed.pathname === '/proxy') {
        const target = parsed.query.url;
        if (!target) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
            return;
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');

        try {
            const body = await proxyFetch(target);
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(body);
        } catch (err) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Static files
    serveStatic(req, res);
});

server.listen(PORT, () => {
    console.log('');
    console.log('  ============================');
    console.log('   NewsHunt - Smart News Reader');
    console.log('  ============================');
    console.log('');
    console.log(`  App:   http://localhost:${PORT}`);
    console.log(`  Proxy: http://localhost:${PORT}/proxy?url=...`);
    console.log('');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
});

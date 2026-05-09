const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf-8');

const shareApiCode = `
// --- App Sharing API & Middleware ---
const crypto = require('crypto');

app.get('/share/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await SharedSession.findOne({ sessionId, isActive: true });
        if (!session) {
            return res.status(404).send('Invalid or expired share link.');
        }
        res.cookie('guestSession', sessionId, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
        });
        res.redirect('/apps/' + session.appName + '/index.html');
    } catch (e) {
        console.error(e);
        res.status(500).send('Server Error');
    }
});

const getCookieValue = (req, cookieName) => {
    const cookies = req.headers.cookie;
    if (!cookies) return null;
    const cookie = cookies.split(';').map(c => c.trim()).find(c => c.startsWith(cookieName + '='));
    return cookie ? cookie.substring(cookieName.length + 1) : null;
};

const guestSessionMiddleware = async (req, res, next) => {
    try {
        const sessionId = getCookieValue(req, 'guestSession');
        if (sessionId) {
            const session = await SharedSession.findOne({ sessionId, isActive: true });
            if (session) {
                req.guestSession = session;
                // Restrict access
                if (req.path.startsWith('/apps/') && !req.path.startsWith('/apps/' + session.appName)) {
                     return res.status(403).send('You do not have access to this app. Please use your generated share link.');
                }
                if (req.path === '/' || req.path === '/index.html') {
                     return res.redirect('/apps/' + session.appName + '/index.html');
                }
            } else {
                res.clearCookie('guestSession');
            }
        }
    } catch (e) {
        console.error('Guest Session Middleware Error:', e);
    }
    next();
};

app.use(guestSessionMiddleware);

app.post('/api/share', async (req, res) => {
    try {
        const { appName } = req.body;
        if (!appName) return res.status(400).json({ error: 'appName is required' });
        const sessionId = crypto.randomUUID();
        await SharedSession.create({ sessionId, appName });
        res.json({ success: true, link: '/share/' + sessionId, sessionId });
    } catch (e) {
        console.error('Error in POST /api/share:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/share', async (req, res) => {
    try {
        const sessions = await SharedSession.find().sort({ createdAt: -1 });
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/share/:sessionId', async (req, res) => {
    try {
        await SharedSession.findOneAndUpdate({ sessionId: req.params.sessionId }, { isActive: false });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

`;

const targetAnchor = "app.use(express.urlencoded({ extended: true, limit: '25mb' }));";

if (code.includes('guestSessionMiddleware')) {
    console.log('Middleware already injected.');
} else {
    code = code.replace(targetAnchor, targetAnchor + '\n\n' + shareApiCode);
    fs.writeFileSync('server.js', code);
    console.log('Successfully patched server.js with Share APIs.');
}

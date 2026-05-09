const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf-8');

// QuickNote Find
code = code.replace(
    /const notes = await QuickNote\.find\(\)\.sort\(\{ pinned: -1, updatedAt: -1, createdAt: -1 \}\);/,
    'const sessionId = req.guestSession ? req.guestSession.sessionId : "admin";\n        const notes = await QuickNote.find({ sessionId }).sort({ pinned: -1, updatedAt: -1, createdAt: -1 });'
);

// QuickNote Create
code = code.replace(
    /const payload = sanitizeQuickNotePayload\(req\.body\);/,
    'const sessionId = req.guestSession ? req.guestSession.sessionId : "admin";\n        const payload = sanitizeQuickNotePayload(req.body);\n        payload.sessionId = sessionId;'
);

// QuickNote PATCH
code = code.replace(
    /const existingNote = await QuickNote\.findById\(req\.params\.id\);/,
    'const sessionId = req.guestSession ? req.guestSession.sessionId : "admin";\n        const existingNote = await QuickNote.findOne({ _id: req.params.id, sessionId });'
);

// QuickNote DELETE /:id
code = code.replace(
    /const deleted = await QuickNote\.findByIdAndDelete\(req\.params\.id\);/,
    'const sessionId = req.guestSession ? req.guestSession.sessionId : "admin";\n        const deleted = await QuickNote.findOneAndDelete({ _id: req.params.id, sessionId });'
);

// QuickNote DELETE All
code = code.replace(
    /await QuickNote\.deleteMany\(\{\}\);/,
    'const sessionId = req.guestSession ? req.guestSession.sessionId : "admin";\n        await QuickNote.deleteMany({ sessionId });'
);

fs.writeFileSync('server.js', code);
console.log('Patched server.js QuickNote');

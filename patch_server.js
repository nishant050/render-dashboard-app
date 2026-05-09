const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf-8');

// Patch newshunt helper methods
code = code.replace(
    /const ensureNewshuntDocument = async \(\) => {/g,
    'const ensureNewshuntDocument = async (sessionId = "admin") => {'
);
code = code.replace(
    /let data = await NewsHuntData\.findOne\(\);/,
    'let data = await NewsHuntData.findOne({ sessionId });'
);
code = code.replace(
    /if \(fs\.existsSync\(NEWSHUNT_DATA_PATH\)\) {/,
    'if (fs.existsSync(NEWSHUNT_DATA_PATH) && sessionId === "admin") {'
);
code = code.replace(
    /data = await NewsHuntData\.create\(seedData\);/,
    'seedData.sessionId = sessionId;\n        data = await NewsHuntData.create(seedData);'
);

code = code.replace(
    /const readNewshuntData = async \(\) => {/g,
    'const readNewshuntData = async (sessionId = "admin") => {'
);
code = code.replace(
    /const data = await ensureNewshuntDocument\(\);/g,
    'const data = await ensureNewshuntDocument(sessionId);'
);

code = code.replace(
    /const writeNewshuntData = async \(data\) => {/g,
    'const writeNewshuntData = async (data, sessionId = "admin") => {'
);
code = code.replace(
    /const result = await NewsHuntData\.findOneAndUpdate\(\s*\{\},\s*\{/g,
    'const result = await NewsHuntData.findOneAndUpdate(\n        { sessionId },\n        {'
);

code = code.replace(
    /const applyNewshuntUpdate = async \(update = \{\}\) => {/g,
    'const applyNewshuntUpdate = async (update = {}, sessionId = "admin") => {'
);
code = code.replace(
    /await ensureNewshuntDocument\(\);/g,
    'await ensureNewshuntDocument(sessionId);'
);
code = code.replace(
    /return NewsHuntData\.updateOne\(\s*\{\},\s*update\s*\);/g,
    'return NewsHuntData.updateOne(\n        { sessionId },\n        update\n    );'
);

// Add sessionId to endpoints
code = code.replace(
    /app\.(get|post|delete)\('\/api\/newshunt\/(.*?)',\s*async\s*\(req,\s*res\)\s*=>\s*\{/g,
    match => match + '\n    const sessionId = req.guestSession ? req.guestSession.sessionId : "admin";'
);

// Update calls in endpoints
code = code.replace(/await readNewshuntData\(\)/g, 'await readNewshuntData(sessionId)');
code = code.replace(/await writeNewshuntData\((.*?)\)/g, 'await writeNewshuntData($1, sessionId)');
code = code.replace(/await applyNewshuntUpdate\((.*?)\)/g, 'await applyNewshuntUpdate($1, sessionId)');
code = code.replace(/await NewsHuntData\.deleteMany\(\{\}\)/g, 'await NewsHuntData.deleteMany({ sessionId })');

fs.writeFileSync('server.js', code);
console.log('Patched server.js newshunt');

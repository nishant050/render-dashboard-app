const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Attempt to load .env from repo root
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    try {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
            if (match && process.env[match[1]] === undefined) {
                let val = match[2] || '';
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                process.env[match[1]] = val;
            }
        });
    } catch (_) {}
}

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('Error: MONGO_URI environment variable is required.');
    console.error('Please set MONGO_URI in your environment or in the .env file.');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const names = collections.map(c => c.name);
        
        if (names.includes('chemistryschedules')) {
            await db.collection('chemistryschedules').drop();
            console.log('Dropped: chemistryschedules');
        } else {
            console.log('Already gone: chemistryschedules');
        }

        if (names.includes('chemistryprogresses')) {
            await db.collection('chemistryprogresses').drop();
            console.log('Dropped: chemistryprogresses');
        } else {
            console.log('Already gone: chemistryprogresses');
        }

        console.log('Done.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });

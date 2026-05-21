const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://admin:admin123@ac-wnbtpbs-shard-00-00.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-01.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-02.42f6xm7.mongodb.net:27017/render-dashboard?ssl=true&replicaSet=atlas-usm1o0-shard-0&authSource=admin&retryWrites=true&w=majority&appName=diet-plan';

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

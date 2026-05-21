const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://admin:admin123@ac-wnbtpbs-shard-00-00.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-01.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-02.42f6xm7.mongodb.net:27017/render-dashboard?ssl=true&replicaSet=atlas-usm1o0-shard-0&authSource=admin&retryWrites=true&w=majority&appName=diet-plan';

async function run() {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Unset/remove `sessionId` field on all documents in `quicknotes`, `chemistryschedules`, `chemistryprogresses`
    const multiDocCollections = ['quicknotes', 'chemistryschedules', 'chemistryprogresses'];
    for (const colName of multiDocCollections) {
        console.log(`\nProcessing multi-document collection: ${colName}`);
        const countBefore = await db.collection(colName).countDocuments();
        console.log(`Total documents before: ${countBefore}`);

        // Update all documents to unset sessionId
        const updateResult = await db.collection(colName).updateMany(
            {},
            { $unset: { sessionId: "" } }
        );
        console.log(`Unset sessionId on ${updateResult.modifiedCount} documents.`);

        const countAfter = await db.collection(colName).countDocuments();
        console.log(`Total documents after: ${countAfter}`);
    }

    // 2. For single-document collections (newshuntdatas, learninvestingstates, fretboardtrainerstates),
    //    delete any documents where sessionId is defined (e.g. 'admin' or UUIDs) and unset sessionId on the original document.
    const singleDocCollections = ['newshuntdatas', 'learninvestingstates', 'fretboardtrainerstates'];
    for (const colName of singleDocCollections) {
        console.log(`\nProcessing single-document collection: ${colName}`);
        
        // Print all docs for diagnostic purposes
        const docs = await db.collection(colName).find({}).toArray();
        console.log(`Found ${docs.length} documents:`);
        docs.forEach(doc => {
            console.log(`- _id: ${doc._id}, sessionId: ${doc.sessionId}`);
        });

        // Delete documents where sessionId is explicitly set (not null, not undefined)
        const deleteResult = await db.collection(colName).deleteMany({
            sessionId: { $exists: true, $ne: null }
        });
        console.log(`Deleted ${deleteResult.deletedCount} documents with explicit sessionId.`);

        // Clean up remaining documents by unsetting sessionId
        const updateResult = await db.collection(colName).updateMany(
            {},
            { $unset: { sessionId: "" } }
        );
        console.log(`Unset sessionId on ${updateResult.modifiedCount} remaining documents.`);

        const countAfter = await db.collection(colName).countDocuments();
        console.log(`Total documents remaining: ${countAfter}`);
    }

    // 3. Drop sharedsessions collection
    console.log('\nProcessing sharedsessions collection...');
    try {
        const collections = await db.listCollections({ name: 'sharedsessions' }).toArray();
        if (collections.length > 0) {
            await db.collection('sharedsessions').drop();
            console.log('Successfully dropped sharedsessions collection.');
        } else {
            console.log('sharedsessions collection does not exist.');
        }
    } catch (err) {
        console.error('Error dropping sharedsessions collection:', err.message);
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});

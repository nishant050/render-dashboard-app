const mongoose = require('mongoose');
const axios = require('axios');

const MONGO_URI = 'mongodb://admin:admin123@ac-wnbtpbs-shard-00-00.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-01.42f6xm7.mongodb.net:27017,ac-wnbtpbs-shard-00-02.42f6xm7.mongodb.net:27017/render-dashboard?ssl=true&replicaSet=atlas-usm1o0-shard-0&authSource=admin&retryWrites=true&w=majority&appName=diet-plan';

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    const db = mongoose.connection.db;
    const doc = await db.collection('newshuntdatas').findOne({});
    if (!doc || !doc.settings) {
        console.log('No settings found');
        process.exit(1);
    }
    const apiKey = doc.settings.api_key_nvidia;
    if (!apiKey) {
        console.log('No NVIDIA key in DB');
        process.exit(1);
    }

    console.log('Found key, testing standard model...');
    try {
        const payload = {
            model: 'meta/llama-3.1-70b-instruct',
            messages: [{ role: 'system', content: 'You are an AI' }, { role: 'user', content: 'Say hi' }],
            temperature: 0.5,
            max_tokens: 100,
            chat_template_kwargs: { enable_thinking: true, clear_thinking: false }
        };

        const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('SUCCESS standard model:', response.data.choices[0].message.content);
    } catch (e) {
        console.log('ERROR standard model:', e.response?.status, e.response?.data || e.message);
    }

    console.log('\nTesting reasoning model glm4.7...');
    try {
        const payload2 = {
            model: 'z-ai/glm4.7',
            messages: [{ role: 'system', content: 'You are an AI' }, { role: 'user', content: 'Say hi' }],
            temperature: 0.5,
            max_tokens: 1000,
            chat_template_kwargs: { enable_thinking: true, clear_thinking: false }
        };

        const response2 = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', payload2, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('SUCCESS glm4.7:', response2.data.choices[0].message.content);
    } catch (e) {
        console.log('ERROR glm4.7:', e.response?.status, e.response?.data || e.message);
    }

    process.exit(0);
}

run().catch(console.error);

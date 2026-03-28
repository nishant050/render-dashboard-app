// ============================================
// NewsHunt — AI Integration (Groq & OpenRouter)
// ============================================

const AI = {
    PROVIDERS: {
        groq: {
            name: 'Groq',
            baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
            defaultModel: 'llama-3.3-70b-versatile'
        },
        openrouter: {
            name: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
            defaultModel: 'google/gemini-2.0-flash-001'
        },
        gemini: {
            name: 'Google Gemini',
            // Base URL will be constructed dynamically with the model name and API key
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            defaultModel: 'gemini-3.1-flash-lite-preview'
        },
        mistral: {
            name: 'Mistral',
            baseUrl: 'https://api.mistral.ai/v1/chat/completions',
            defaultModel: 'mistral-small-2603'
        }
    },

    // Get current provider config from settings
    async getConfig() {
        // Prefer the explicit default model object (set via Settings UI)
        const defaultModel = await db.getSetting('ai_default_model');
        
        let provider, model, apiKey;
        
        if (defaultModel && defaultModel.provider && defaultModel.model) {
            provider = defaultModel.provider;
            model = defaultModel.model;
            // Get the provider-specific key first, fall back to legacy ai_api_key
            apiKey = await db.getSetting(`api_key_${provider}`) || await db.getSetting('ai_api_key') || '';
        } else {
            // Fall back to legacy flat settings
            provider = await db.getSetting('ai_provider') || 'groq';
            model = await db.getSetting('ai_model') || this.PROVIDERS[provider]?.defaultModel || '';
            apiKey = await db.getSetting('ai_api_key') || '';
        }

        return {
            provider,
            apiKey,
            model,
            baseUrl: this.PROVIDERS[provider]?.baseUrl || ''
        };
    },

    // Check if AI is configured
    async isConfigured() {
        const config = await this.getConfig();
        return !!(config.apiKey && config.model);
    },

    // ==========================================
    // GEMINI SPECIFIC HELPERS
    // ==========================================
    _formatGeminiMessages(messages) {
        let systemInstruction = null;
        const contents = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction = { parts: [{ text: msg.content }] };
            } else {
                // Gemini uses 'user' and 'model' (instead of 'assistant')
                const role = msg.role === 'assistant' ? 'model' : 'user';
                contents.push({
                    role: role,
                    parts: [{ text: msg.content }]
                });
            }
        }
        return { contents, systemInstruction };
    },

    async _callGemini(config, messages, options) {
        const url = `${config.baseUrl}/${config.model}:generateContent?key=${config.apiKey}`;

        const { contents, systemInstruction } = this._formatGeminiMessages(messages);

        const body = {
            contents,
            systemInstruction,
            generationConfig: {
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.max_tokens ?? 8192,
            }
        };

        if (options.response_format?.type === 'json_object') {
            body.generationConfig.responseMimeType = "application/json";
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Gemini API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },

    async _callGeminiStreaming(config, messages, onChunk, options) {
        const url = `${config.baseUrl}/${config.model}:streamGenerateContent?key=${config.apiKey}`;

        const { contents, systemInstruction } = this._formatGeminiMessages(messages);

        const body = {
            contents,
            systemInstruction,
            generationConfig: {
                temperature: options.temperature ?? 0.5,
                maxOutputTokens: options.max_tokens ?? 8192,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Gemini API Error: ${response.status}`);
        }

        // Gemini streaming returns an array of JSON objects, usually sent in chunks
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Try to parse complete JSON arrays from the buffer
            // Gemini streams look like: [\n{...},\n{...}\n]
            try {
                // A very simple hack to extract the text from the raw buffer string
                // since parsing the incomplete JSON array stream natively is complex.
                // We'll look for "text": "..." within the buffer.
                // This is a naive but effective approach for a simple client.

                // Let's use a regex to find all "text" values in this chunk
                const textRegex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
                let match;
                let chunkText = '';

                while ((match = textRegex.exec(buffer)) !== null) {
                    // Unescape the JSON string
                    try {
                        const parsedStr = JSON.parse(`"${match[1]}"`);
                        chunkText += parsedStr;
                    } catch (e) { }
                }

                if (chunkText) {
                    fullContent += chunkText;
                    onChunk(chunkText, fullContent);
                }

                // Keep the last bit of the buffer in case a string was cut off
                const lastBrace = buffer.lastIndexOf('}');
                if (lastBrace > -1) {
                    buffer = buffer.substring(lastBrace + 1);
                }

            } catch (e) {
                // Ignore parsing errors on incomplete chunks
            }
        }

        // If the regex stream parsing failed, fallback to the final parsed response
        if (!fullContent) {
            try {
                const fullParse = JSON.parse(buffer);
                fullContent = fullParse.map(c => c.candidates?.[0]?.content?.parts?.[0]?.text || '').join('');
                if (fullContent) onChunk(fullContent, fullContent);
            } catch (e) { }
        }

        return fullContent;
    },

    // ==========================================
    // MISTRAL SPECIFIC HELPERS
    // ==========================================
    _formatMistralMessages(messages) {
        return messages.map(msg => {
            if (msg.role === 'system') {
                return {
                    role: 'system',
                    content: [
                        {
                            type: 'text',
                            text: '# HOW YOU SHOULD THINK AND ANSWER\n\nFirst draft your thinking process (inner monologue) until you arrive at a response. Format your response using Markdown, and use LaTeX for any mathematical equations. Write both your thoughts and the response in the same language as the input.\n\nYour thinking process must follow the template below:'
                        },
                        {
                            type: 'thinking',
                            thinking: [
                                {
                                    type: 'text',
                                    text: 'Your thoughts or/and draft, like working through an exercise on scratch paper. Be as casual and as long as you want until you are confident to generate the response to the user.'
                                }
                            ]
                        },
                        {
                            type: 'text',
                            text: msg.content
                        }
                    ]
                };
            }
            return msg;
        });
    },

    // ==========================================
    // MAIN CALL METHODS
    // ==========================================

    // Make a non-streaming API call
    async call(messages, options = {}) {
        const config = await this.getConfig();
        if (!config.apiKey) throw new Error('API key not configured. Please go to Settings.');

        if (config.provider === 'gemini') {
            return this._callGemini(config, messages, options);
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        // ... [OpenRouter Logic]
        if (config.provider === 'openrouter') {
            headers['HTTP-Referer'] = window.location.href;
            headers['X-Title'] = 'NewsHunt';
        }

        let formattedMessages = messages;
        if (config.provider === 'mistral') {
            formattedMessages = this._formatMistralMessages(messages);
        }

        const body = {
            model: config.model,
            messages: formattedMessages,
            temperature: options.temperature ?? 0.3,
            max_tokens: options.max_tokens ?? 4096,
            ...(options.response_format && { response_format: options.response_format })
        };

        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    },

    // Make a streaming API call
    async callStreaming(messages, onChunk, options = {}) {
        const config = await this.getConfig();
        if (!config.apiKey) throw new Error('API key not configured. Please go to Settings.');

        if (config.provider === 'gemini') {
            return this._callGeminiStreaming(config, messages, onChunk, options);
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        if (config.provider === 'openrouter') {
            headers['HTTP-Referer'] = window.location.href;
            headers['X-Title'] = 'NewsHunt';
        }

        let formattedMessages = messages;
        if (config.provider === 'mistral') {
            formattedMessages = this._formatMistralMessages(messages);
        }

        const body = {
            model: config.model,
            messages: formattedMessages,
            temperature: options.temperature ?? 0.5,
            max_tokens: options.max_tokens ?? 8192,
            stream: true
        };

        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const data = trimmed.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        fullContent += delta;
                        onChunk(delta, fullContent);
                    }
                } catch (e) {
                    // Skip malformed chunks
                }
            }
        }

        return fullContent;
    },

    // ==========================================
    // TEXT-TO-SPEECH (GROQ ORPHEUS)
    // ==========================================
    async generateSpeech(text, voice = 'hannah') {
        const apiKey = await db.getSetting('api_key_groq') || await db.getSetting('ai_api_key');
        if (!apiKey) throw new Error('Groq API key not configured for TTS. Please add a Groq key in Settings.');

        const body = {
            model: 'canopylabs/orpheus-v1-english',
            voice: voice,
            input: text,
            response_format: 'wav'
        };

        const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `TTS API Error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    }
};

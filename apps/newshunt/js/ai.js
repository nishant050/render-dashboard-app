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
        nvidia: {
            name: 'NVIDIA',
            baseUrl: '/api/ai/nvidia-proxy',
            defaultModel: 'z-ai/glm4.7'
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

    // Task types that can have individual model assignments
    TASK_TYPES: {
        categorize: { label: 'Categorize & Rate', icon: '⭐', desc: 'Star-rating articles' },
        group:      { label: 'Group & Tag', icon: '🏷️', desc: 'Grouping duplicates, assigning topics' },
        reader:     { label: 'Reader (Rewrite)', icon: '📖', desc: 'AI article rewriting & explanations' },
        chat:       { label: 'Chat', icon: '💬', desc: 'Chatting about articles' },
        summarize:  { label: 'Summarize', icon: '📝', desc: 'Topic & group summaries' }
    },

    // Get current provider config from settings
    // Accepts an optional `task` to use a task-specific model override
    async getConfig(task) {
        // 1. Check for task-specific model assignment
        if (task) {
            const taskModel = await db.getSetting(`task_model_${task}`);
            if (taskModel && taskModel.provider && taskModel.model) {
                const apiKey = await db.getSetting(`api_key_${taskModel.provider}`) || await db.getSetting('ai_api_key') || '';
                return {
                    provider: taskModel.provider,
                    apiKey,
                    model: taskModel.model,
                    baseUrl: this.PROVIDERS[taskModel.provider]?.baseUrl || ''
                };
            }
        }

        // 2. Prefer the explicit default model object (set via Settings UI)
        const defaultModel = await db.getSetting('ai_default_model');
        
        let provider, model, apiKey;
        
        if (defaultModel && defaultModel.provider && defaultModel.model) {
            provider = defaultModel.provider;
            model = defaultModel.model;
            apiKey = await db.getSetting(`api_key_${provider}`) || await db.getSetting('ai_api_key') || '';
        } else {
            // 3. Fall back to legacy flat settings
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

    _isThinkingPart(part) {
        if (!part || typeof part !== 'object') return false;
        const type = String(part.type || '').toLowerCase();
        const role = String(part.role || '').toLowerCase();
        return part.thought === true
            || type === 'reasoning'
            || type === 'reasoning_content'
            || type === 'thinking'
            || type === 'thought'
            || role === 'thought';
    },

    _extractOpenAIContentParts(value) {
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

            if (this._isThinkingPart(part)) {
                reasoning += text;
            } else {
                content += text;
            }
        }

        return { content, reasoning };
    },

    _flattenOpenAIText(value) {
        const parts = this._extractOpenAIContentParts(value);
        return `${parts.content}${parts.reasoning}`;
    },

    _extractOpenAIMessageParts(message = {}) {
        const contentParts = this._extractOpenAIContentParts(message.content);
        const reasoning = [
            this._flattenOpenAIText(message.reasoning_content),
            this._flattenOpenAIText(message.reasoning),
            contentParts.reasoning
        ].filter(Boolean).join('');

        return {
            content: contentParts.content,
            reasoning
        };
    },

    _extractGeminiParts(parts = []) {
        let content = '';
        let reasoning = '';

        for (const part of parts) {
            if (!part || typeof part !== 'object') continue;
            const text = typeof part.text === 'string' ? part.text : '';
            if (!text) continue;

            if (this._isThinkingPart(part)) {
                reasoning += text;
            } else {
                content += text;
            }
        }

        return { content, reasoning };
    },

    _extractGeminiCandidateParts(payload = {}) {
        const candidate = payload?.candidates?.[0] || {};
        return this._extractGeminiParts(candidate?.content?.parts || []);
    },

    _extractJsonObjects(buffer) {
        const objects = [];
        let start = -1;
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < buffer.length; i++) {
            const ch = buffer[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (ch === '\\' && inString) {
                escaped = true;
                continue;
            }

            if (ch === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (ch === '{') {
                if (depth === 0) start = i;
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0 && start !== -1) {
                    objects.push(buffer.slice(start, i + 1));
                    start = -1;
                }
            }
        }

        return {
            objects,
            remainder: depth > 0 && start !== -1 ? buffer.slice(start) : ''
        };
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
        return this._extractGeminiCandidateParts(data).content;
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
        let fullReasoning = '';
        let buffer = '';

        const emitGeminiPayload = (payload) => {
            const { content, reasoning } = this._extractGeminiCandidateParts(payload);

            if (reasoning) {
                fullReasoning += reasoning;
                options.onReasoningChunk?.(reasoning, fullReasoning);
            }

            if (content) {
                fullContent += content;
                onChunk(content, fullContent);
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const { objects, remainder } = this._extractJsonObjects(buffer);
            buffer = remainder;

            for (const objectText of objects) {
                try {
                    emitGeminiPayload(JSON.parse(objectText));
                } catch (e) {
                    // Ignore malformed chunks
                }
            }
        }

        if (buffer.trim()) {
            try {
                const fullParse = JSON.parse(buffer);
                const payloads = Array.isArray(fullParse) ? fullParse : [fullParse];
                payloads.forEach(emitGeminiPayload);
            } catch (e) { }
        }

        return fullContent;
    },

    // ==========================================
    // MISTRAL SPECIFIC HELPERS
    // ==========================================
    _formatMistralMessages(messages) {
        return messages;
    },

    // ==========================================
    // MAIN CALL METHODS
    // ==========================================

    // Make a non-streaming API call
    async call(messages, options = {}) {
        const config = await this.getConfig(options.task);
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

        if (config.provider === 'nvidia') {
            body.chat_template_kwargs = {
                enable_thinking: true,
                clear_thinking: false
            };
        }

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
        return this._extractOpenAIMessageParts(data.choices?.[0]?.message || {}).content;
    },

    // Make a streaming API call
    async callStreaming(messages, onChunk, options = {}) {
        const config = await this.getConfig(options.task);
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

        if (config.provider === 'nvidia') {
            body.chat_template_kwargs = {
                enable_thinking: true,
                clear_thinking: false
            };
        }

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
        let fullReasoning = '';
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
                    const { content, reasoning } = this._extractOpenAIMessageParts(parsed.choices?.[0]?.delta || {});
                    if (reasoning) {
                        fullReasoning += reasoning;
                        options.onReasoningChunk?.(reasoning, fullReasoning);
                    }
                    if (content) {
                        fullContent += content;
                        onChunk(content, fullContent);
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

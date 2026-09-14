// ============================================
// NewsHunt - AI Integration
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
        cerebras: {
            name: 'Cerebras',
            baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
            defaultModel: 'llama3.1-8b'
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

    normalizeModelId(provider, model) {
        const raw = String(model || '').trim();
        if (!raw) return raw;

        const normalized = raw.toLowerCase().replace(/[\s_]+/g, '-');

        if (provider === 'cerebras') {
            if (['glm-4.7', 'glm4.7', 'z-ai/glm4.7', 'zai-glm-4.7'].includes(normalized)) {
                return 'zai-glm-4.7';
            }
        }

        if (provider === 'nvidia') {
            if (['glm-4.7', 'glm4.7', 'zai-glm-4.7', 'z-ai/glm4.7'].includes(normalized)) {
                return 'z-ai/glm4.7';
            }
        }

        return raw;
    },

    // Task types that can have individual model assignments
    TASK_TYPES: {
        categorize: { label: 'Categorize & Rate', icon: '⭐', desc: 'Star-rating articles' },
        group:      { label: 'Group & Tag', icon: '🏷️', desc: 'Grouping duplicates, assigning topics' },
        reader:     { label: 'Reader (Rewrite)', icon: '📖', desc: 'AI article rewriting & explanations' },
        chat:       { label: 'Chat', icon: '💬', desc: 'Chatting about articles' },
        summarize:  { label: 'Summarize', icon: '📝', desc: 'Topic & group summaries' }
    },

    async _buildConfigFromSelection(selection) {
        if (!selection?.provider || !selection?.model) return null;
        const provider = selection.provider;
        if (!this.PROVIDERS[provider]) return null;

        const apiKey = await db.getSetting(`api_key_${provider}`) || await db.getSetting('ai_api_key') || '';
        if (!apiKey) return null;

        return {
            provider,
            apiKey,
            model: this.normalizeModelId(provider, selection.model),
            baseUrl: this.PROVIDERS[provider]?.baseUrl || ''
        };
    },

    // Get current provider config from settings
    // Accepts an optional `task` to use a task-specific model override
    async getConfig(task) {
        // 1. Check for task-specific model assignment
        if (task) {
            const taskModel = await db.getSetting(`task_model_${task}`);
            const taskConfig = await this._buildConfigFromSelection(taskModel);
            if (taskConfig) {
                return taskConfig;
            }
        }

        // 2. Prefer the explicit default model object (set via Settings UI)
        const defaultModel = await db.getSetting('ai_default_model');
        
        let provider, model, apiKey;
        
        if (defaultModel && defaultModel.provider && defaultModel.model) {
            const defaultConfig = await this._buildConfigFromSelection(defaultModel);
            if (defaultConfig) {
                return defaultConfig;
            }
            provider = defaultModel.provider;
            model = this.normalizeModelId(provider, defaultModel.model);
            apiKey = await db.getSetting(`api_key_${provider}`) || await db.getSetting('ai_api_key') || '';
        } else {
            // 3. Fall back to legacy flat settings
            provider = await db.getSetting('ai_provider') || 'groq';
            model = this.normalizeModelId(provider, await db.getSetting('ai_model') || this.PROVIDERS[provider]?.defaultModel || '');
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

    _mergeSystemIntoUserMessages(messages) {
        const systemText = messages
            .filter(msg => msg?.role === 'system' && msg.content)
            .map(msg => String(msg.content).trim())
            .filter(Boolean)
            .join('\n\n');

        if (!systemText) return messages;

        const nonSystemMessages = messages
            .filter(msg => msg?.role !== 'system')
            .map(msg => ({ ...msg }));

        const mergedInstruction = `Follow these instructions carefully:\n${systemText}`;
        const firstUserIndex = nonSystemMessages.findIndex(msg => msg?.role === 'user');

        if (firstUserIndex >= 0) {
            nonSystemMessages[firstUserIndex].content = `${mergedInstruction}\n\n${nonSystemMessages[firstUserIndex].content || ''}`.trim();
            return nonSystemMessages;
        }

        return [{ role: 'user', content: mergedInstruction }, ...nonSystemMessages];
    },

    _buildCompatibilityVariants(messages, options = {}) {
        const variants = [];
        const seen = new Set();

        const pushVariant = (variantMessages, variantOptions = {}) => {
            const key = JSON.stringify({
                messages: variantMessages,
                response_format: variantOptions.response_format || null
            });
            if (seen.has(key)) return;
            seen.add(key);
            variants.push({
                messages: variantMessages,
                options: {
                    ...options,
                    ...variantOptions
                }
            });
        };

        pushVariant(messages, {});
        if (options.response_format) {
            pushVariant(messages, { response_format: undefined });
        }

        const mergedMessages = this._mergeSystemIntoUserMessages(messages);
        if (mergedMessages !== messages) {
            pushVariant(mergedMessages, {});
            if (options.response_format) {
                pushVariant(mergedMessages, { response_format: undefined });
            }
        }

        return variants;
    },

    async _readErrorResponse(response, label = 'API Error') {
        let errorText = '';
        try {
            const errorJson = await response.json();
            errorText = errorJson?.error?.message || errorJson?.message || JSON.stringify(errorJson);
        } catch {
            errorText = await response.text().catch(() => '');
        }

        return errorText || `${label}: ${response.status}`;
    },

    _formatOpenAIHeaders(config) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        if (config.provider === 'openrouter') {
            headers['HTTP-Referer'] = window.location.href;
            headers['X-Title'] = 'NewsHunt';
        }

        return headers;
    },

    _buildOpenAIBody(config, messages, options = {}, stream = false) {
        let formattedMessages = messages;
        if (config.provider === 'mistral') {
            formattedMessages = this._formatMistralMessages(messages);
        }

        return {
            model: config.model,
            messages: formattedMessages,
            temperature: options.temperature ?? (stream ? 0.5 : 0.3),
            max_tokens: options.max_tokens ?? (stream ? 8192 : 4096),
            ...(stream ? { stream: true } : {}),
            ...(options.response_format ? { response_format: options.response_format } : {})
        };
    },

    async _callOpenAINonStreamingAttempt(config, messages, options = {}) {
        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers: this._formatOpenAIHeaders(config),
            body: JSON.stringify(this._buildOpenAIBody(config, messages, options, false))
        });

        if (!response.ok) {
            throw new Error(await this._readErrorResponse(response));
        }

        const data = await response.json();
        return this._extractOpenAIMessageParts(data.choices?.[0]?.message || {});
    },

    async _callOpenAIStreamingAttempt(config, messages, onChunk, options = {}) {
        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers: this._formatOpenAIHeaders(config),
            body: JSON.stringify(this._buildOpenAIBody(config, messages, options, true))
        });

        if (!response.ok) {
            throw new Error(await this._readErrorResponse(response));
        }

        const reader = response.body?.getReader?.();
        if (!reader) {
            throw new Error('Streaming not supported by this response.');
        }

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

        return {
            content: fullContent,
            reasoning: fullReasoning
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

        const variants = this._buildCompatibilityVariants(messages, options);
        let lastError = null;

        for (const variant of variants) {
            try {
                const result = await this._callOpenAINonStreamingAttempt(config, variant.messages, variant.options);
                return result.content;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('AI request failed.');
    },

    // Make a streaming API call
    async callStreaming(messages, onChunk, options = {}) {
        const config = await this.getConfig(options.task);
        if (!config.apiKey) throw new Error('API key not configured. Please go to Settings.');

        if (config.provider === 'gemini') {
            return this._callGeminiStreaming(config, messages, onChunk, options);
        }

        const variants = this._buildCompatibilityVariants(messages, options);
        let lastError = null;

        for (const variant of variants) {
            try {
                const streamed = await this._callOpenAIStreamingAttempt(config, variant.messages, onChunk, variant.options);
                if (streamed.content || streamed.reasoning) {
                    if (!streamed.content) {
                        const fallback = await this._callOpenAINonStreamingAttempt(config, variant.messages, variant.options);
                        if (fallback.reasoning) options.onReasoningChunk?.(fallback.reasoning, fallback.reasoning);
                        if (fallback.content) onChunk(fallback.content, fallback.content);
                        return fallback.content;
                    }
                    return streamed.content;
                }
            } catch (error) {
                lastError = error;
            }
        }

        for (const variant of variants) {
            try {
                const fallback = await this._callOpenAINonStreamingAttempt(config, variant.messages, variant.options);
                if (fallback.reasoning) options.onReasoningChunk?.(fallback.reasoning, fallback.reasoning);
                if (fallback.content) onChunk(fallback.content, fallback.content);
                return fallback.content;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('AI request failed.');
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

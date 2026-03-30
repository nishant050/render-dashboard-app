const App = {
    settings: {},
    chatHistory: [],
    selectedModelId: null,

    isThinkingPart(part) {
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

    extractOpenAIContentParts(value) {
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

            if (this.isThinkingPart(part)) reasoning += text;
            else content += text;
        }

        return { content, reasoning };
    },

    flattenOpenAIText(value) {
        const parts = this.extractOpenAIContentParts(value);
        return `${parts.content}${parts.reasoning}`;
    },

    extractOpenAIMessageParts(message = {}) {
        const contentParts = this.extractOpenAIContentParts(message.content);
        return {
            content: contentParts.content,
            reasoning: [
                this.flattenOpenAIText(message.reasoning_content),
                this.flattenOpenAIText(message.reasoning),
                contentParts.reasoning
            ].filter(Boolean).join('')
        };
    },

    extractGeminiParts(parts = []) {
        let content = '';
        let reasoning = '';

        for (const part of parts) {
            if (!part || typeof part !== 'object') continue;
            const text = typeof part.text === 'string' ? part.text : '';
            if (!text) continue;

            if (this.isThinkingPart(part)) reasoning += text;
            else content += text;
        }

        return { content, reasoning };
    },

    extractJsonObjects(buffer) {
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

    init() {
        this.fetchGlobalConfig();
        
        // Setup marked compiler if available
        if (window.marked) {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
        }

        // Add provider select change listener to pre-fill known keys
        document.getElementById('key-provider').addEventListener('change', (e) => {
            const pv = e.target.value;
            const k = this.settings[`api_key_${pv}`] || '';
            document.getElementById('key-input').value = k;
        });
    },

    // --- State Management ---
    async fetchGlobalConfig() {
        try {
            const [syncRes, envRes] = await Promise.all([
                fetch('/api/newshunt/sync'),
                fetch('/api/newshunt/ai-config').catch(() => null)
            ]);

            if (!syncRes.ok) throw new Error("Failed to load global config");
            const data = await syncRes.json();
            const envKeys = envRes && envRes.ok ? await envRes.json() : {};
            
            this.settings = data.settings || {};
            if (!this.settings.ai_models) this.settings.ai_models = [];

            // Backfill missing model ids so older shared configs still work in the selector.
            this.settings.ai_models = this.settings.ai_models.map((model, idx) => ({
                ...model,
                id: model.id || `legacy_${model.provider || 'model'}_${idx}_${Date.now()}`
            }));

            // Mirror NewsHunt behavior: use env keys as fallback without overwriting explicit saved keys.
            if (envKeys.groq && !this.settings.api_key_groq) this.settings.api_key_groq = envKeys.groq;
            if (envKeys.openrouter && !this.settings.api_key_openrouter) this.settings.api_key_openrouter = envKeys.openrouter;
            if (envKeys.nvidia && !this.settings.api_key_nvidia) this.settings.api_key_nvidia = envKeys.nvidia;
            if (envKeys.gemini && !this.settings.api_key_gemini) this.settings.api_key_gemini = envKeys.gemini;
            if (envKeys.mistral && !this.settings.api_key_mistral) this.settings.api_key_mistral = envKeys.mistral;
            
            this.renderModels();
            
            // Set initial API key input to whatever is selected
            const pv = document.getElementById('key-provider').value;
            document.getElementById('key-input').value = this.settings[`api_key_${pv}`] || '';
            
            console.log("Central settings loaded:", this.settings);
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async pushDbSetting(key, value) {
        try {
            const res = await fetch('/api/newshunt/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            if (!res.ok) throw new Error("Failed to sync DB " + key);
        } catch (err) {
            this.showToast('Network sync error: ' + err.message, 'error');
            throw err;
        }
    },

    // --- Key Management ---
    async saveKey() {
        const provider = document.getElementById('key-provider').value;
        const keyVal = document.getElementById('key-input').value.trim();
        
        if (!keyVal) return this.showToast('API key cannot be empty.', 'error');
        
        try {
            const settingKey = `api_key_${provider}`;
            await this.pushDbSetting(settingKey, keyVal);
            this.settings[settingKey] = keyVal;
            this.showToast(`Saved ${provider.toUpperCase()} API Key universally!`, 'success');
        } catch (err) {
            console.error(err);
        }
    },

    // --- Model Management ---
    renderModels() {
        const list = document.getElementById('models-list');
        const select = document.getElementById('chat-model-select');
        
        const models = this.settings.ai_models || [];
        
        let html = '';
        let optionsHtml = '<option value="">-- Start by Selecting a Target --</option>';
        
        models.forEach((m, idx) => {
            html += `
                <div class="model-card">
                    <div class="model-card__info">
                        <div class="model-card__name">${this.escapeHtml(m.label || m.model)}</div>
                        <div class="model-card__provider">
                            <span class="provider-badge">${m.provider}</span> ${this.escapeHtml(m.model)}
                        </div>
                    </div>
                    <button class="btn btn-danger" style="padding:0.3rem;" onclick="App.deleteModel(${idx})" title="Remove">🗑️</button>
                </div>
            `;
            
            const isSel = this.selectedModelId === m.id ? 'selected' : '';
            optionsHtml += `<option value="${m.id}" ${isSel}>${this.escapeHtml(m.label || m.model)} (${m.provider})</option>`;
        });
        
        list.innerHTML = html || '<div style="color:var(--text-secondary); font-size:0.85rem; padding:1rem; text-align:center;">No custom models exist.</div>';
        select.innerHTML = optionsHtml;
    },

    async addModel() {
        const provider = document.getElementById('new-model-provider').value;
        const modelStr = document.getElementById('new-model-id').value.trim();
        const labelStr = document.getElementById('new-model-label').value.trim();
        
        if (!modelStr) return this.showToast('Model ID is required.', 'error');
        
        const models = this.settings.ai_models || [];
        const newModel = {
            id: 'm_' + Date.now() + Math.random().toString(36).substr(2, 5),
            provider: provider,
            model: modelStr,
            label: labelStr || modelStr
        };
        
        models.push(newModel);
        
        try {
            await this.pushDbSetting('ai_models', models);
            this.settings.ai_models = models;
            this.renderModels();
            this.closeModals();
            this.showToast(`Model ${newModel.label} available across all apps.`, 'success');
        } catch (e) {
            console.error(e);
        }
    },

    async deleteModel(index) {
        if (!confirm('Globally remove this model from all applications?')) return;
        
        const models = this.settings.ai_models || [];
        const removed = models.splice(index, 1)[0];
        
        if (this.selectedModelId === removed.id) this.selectedModelId = null;
        
        try {
            await this.pushDbSetting('ai_models', models);
            this.settings.ai_models = models;
            this.renderModels();
            this.showToast(`Deleted ${removed.label}.`, 'success');
        } catch (e) {
            console.error(e);
        }
    },

    // --- Chat Logic ---
    selectChatModel(id) {
        this.selectedModelId = id;
    },
    
    handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    },
    
    async sendMessage() {
        const input = document.getElementById('chat-input');
        const txt = input.value.trim();
        if (!txt) return;
        if (!this.selectedModelId) return this.showToast('Please select a Target Model first!', 'error');
        
        const modelDef = (this.settings.ai_models || []).find(m => m.id === this.selectedModelId);
        if (!modelDef) return this.showToast('Model definition lost.', 'error');
        
        const apiKey = this.settings[`api_key_${modelDef.provider}`];
        if (!apiKey) return this.showToast(`No Universal API Key found for provider: ${modelDef.provider}`, 'error');

        // Add to UI as user
        this.chatHistory.push({ role: 'user', content: txt });
        input.value = '';
        this.renderChatWindow();
        
        // Create bot placeholder
        const botIdx = this.chatHistory.length;
        this.chatHistory.push({ role: 'assistant', content: '', reasoning: '' });
        this.renderChatWindow();
        
        await this.streamChat(modelDef, apiKey, txt, botIdx);
    },

    async streamChat(modelDef, apiKey, prompt, botIdx) {
        const baseUrlMap = {
            groq: 'https://api.groq.com/openai/v1/chat/completions',
            openrouter: 'https://openrouter.ai/api/v1/chat/completions',
            nvidia: '/api/ai/nvidia-proxy',
            mistral: 'https://api.mistral.ai/v1/chat/completions',
        };

        const isGemini = modelDef.provider === 'gemini';
        let url = baseUrlMap[modelDef.provider];
        let headers = { 'Content-Type': 'application/json' };
        let body = {};

        if (isGemini) {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${modelDef.model}:streamGenerateContent?key=${apiKey}`;
            const history = this.chatHistory.slice(0, botIdx).filter(m => m.content).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
            body = { contents: history };
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
            if (modelDef.provider === 'openrouter') {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = 'Render Dashboard API Test';
            }
            
            const messages = this.chatHistory.slice(0, botIdx).filter(m => m.content).map(m => ({
                role: m.role,
                content: m.content
            }));
            
            body = {
                model: modelDef.model,
                messages: messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 4096
            };
            
            if (modelDef.provider === 'nvidia') {
                body.chat_template_kwargs = { enable_thinking: true, clear_thinking: false };
            }
        }

        try {
            const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            
            if (!response.ok) {
                const errTxt = await response.text();
                this.chatHistory[botIdx].content = `**API Error ${response.status}:**\n\`\`\`json\n${errTxt}\n\`\`\``;
                this.renderChatWindow();
                return;
            }

            if (isGemini) {
                await this.handleGeminiStream(response, botIdx);
            } else {
                await this.handleOpenAIStream(response, botIdx);
            }

            const finalMessage = this.chatHistory[botIdx];
            if (!finalMessage.content.trim()) {
                finalMessage.content = finalMessage.reasoning.trim()
                    ? '_This model returned hidden reasoning but no final answer text._'
                    : '_No visible text was returned by the model. Check the API key, model id, or provider response format._';
                this.renderChatWindow();
            }
        } catch (e) {
            this.chatHistory[botIdx].content = `**Network Error:** ${e.message}`;
            this.renderChatWindow();
        }
    },

    async handleOpenAIStream(response, botIdx) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;
                
                try {
                    const parsed = JSON.parse(trimmed.substring(6));
                    const { content: deltaText, reasoning: deltaReasoning } = this.extractOpenAIMessageParts(parsed.choices?.[0]?.delta || {});
                    
                    if (deltaReasoning) this.chatHistory[botIdx].reasoning += deltaReasoning;
                    if (deltaText) this.chatHistory[botIdx].content += deltaText;
                    
                    if (deltaReasoning || deltaText) this.renderChatWindow();
                } catch (e) {} // incomplete chunks
            }
        }
    },
    
    async handleGeminiStream(response, botIdx) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const { objects, remainder } = this.extractJsonObjects(buffer);
            buffer = remainder;

            for (const objectText of objects) {
                try {
                    const parsed = JSON.parse(objectText);
                    const parts = this.extractGeminiParts(parsed?.candidates?.[0]?.content?.parts || []);
                    if (parts.reasoning) this.chatHistory[botIdx].reasoning += parts.reasoning;
                    if (parts.content) this.chatHistory[botIdx].content += parts.content;
                    if (parts.reasoning || parts.content) this.renderChatWindow();
                } catch (e) {}
            }
        }
        
        try {
            const parsed = JSON.parse(buffer);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            if (arr.length > 0) {
                let fullContent = '';
                let fullReasoning = '';
                arr.forEach(c => {
                    const parts = this.extractGeminiParts(c?.candidates?.[0]?.content?.parts || []);
                    fullContent += parts.content;
                    fullReasoning += parts.reasoning;
                });
                if (fullContent) this.chatHistory[botIdx].content += fullContent;
                if (fullReasoning) this.chatHistory[botIdx].reasoning += fullReasoning;
                this.renderChatWindow();
            }
        }catch(e){}
    },

    renderChatWindow() {
        const win = document.getElementById('chat-window');
        let html = '';
        
        for (const msg of this.chatHistory) {
            html += `<div class="chat-message ${msg.role === 'user' ? 'user' : 'bot'}">`;
            html += `<div class="chat-role-label">${msg.role === 'user' ? 'You' : 'Assistant'}</div>`;
            
            html += `<div class="chat-bubble">`;
            if (msg.reasoning) {
                html += `
                    <details class="thinking-content">
                        <summary>Show model thinking</summary>
                        <div class="thinking-content__body markdown-body">${this.renderMarkdown(msg.reasoning)}</div>
                    </details>
                `;
            }
            
            const rawContent = msg.content || (msg.role === 'assistant' ? '...' : '');
            if (window.marked && msg.role === 'assistant' && msg.content) {
                html += `<div class="markdown-body">${this.renderMarkdown(rawContent)}</div>`;
            } else {
                html += this.escapeHtml(rawContent).replace(/\n/g, '<br>');
            }
            html += `</div></div>`;
        }
        
        win.innerHTML = html;
        win.scrollTop = win.scrollHeight;
    },

    clearChat() {
        this.chatHistory = [];
        this.renderChatWindow();
    },

    renderMarkdown(text) {
        const markdown = (text || '').toString();
        if (window.marked) {
            return marked.parse(markdown);
        }
        return this.escapeHtml(markdown).replace(/\n/g, '<br>');
    },

    // --- UI Helpers ---
    openModelModal() { document.getElementById('add-model-modal').classList.add('active'); },
    closeModals() { document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active')); },
    
    escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;");
    },
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '8px';
        toast.style.background = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
        toast.style.color = '#fff';
        toast.style.fontSize = '0.9rem';
        toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        toast.style.transition = 'opacity 0.3s';
        toast.innerText = message;
        
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => toast.style.opacity = '0', 2500);
        setTimeout(() => toast.remove(), 2800);
    }
};

window.onload = () => App.init();

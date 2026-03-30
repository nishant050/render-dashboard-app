const App = {
    settings: {},
    chatHistory: [],
    selectedModelId: null,

    init() {
        this.fetchGlobalConfig();
        
        // Setup marked compiler if available
        if (window.marked) {
            marked.setOptions({ breaks: true, gfm: true });
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
            const res = await fetch('/api/newshunt/sync');
            if (!res.ok) throw new Error("Failed to load global config");
            const data = await res.json();
            
            this.settings = data.settings || {};
            if (!this.settings.ai_models) this.settings.ai_models = [];
            
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
            const lines = buffer.split('\\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;
                
                try {
                    const parsed = JSON.parse(trimmed.substring(6));
                    const deltaText = parsed.choices?.[0]?.delta?.content || '';
                    const deltaReasoning = parsed.choices?.[0]?.delta?.reasoning_content || '';
                    
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
            try {
                // Gemini returns JSON array streams in a weird chunked bracket format,
                // but we can parse incrementally by hunting for "text"
                const textMatches = [...buffer.matchAll(/"text"\s*:\s*"([^"]+)"/g)];
                if (textMatches.length > 0) {
                     // Unescape string properly
                     const rawTexts = textMatches.map(m => m[1]
                         .replace(/\\\\n/g, '\\n')
                         .replace(/\\\\"/g, '"')
                         .replace(/\\\\t/g, '\\t'));
                     
                     this.chatHistory[botIdx].content = rawTexts.join('');
                     this.renderChatWindow();
                }
            } catch(e){}
        }
        
        // Final fallback block parsing for valid JSON stream if chunks were split poorly
        try {
            const arr = JSON.parse(buffer);
            if (Array.isArray(arr)) {
                let full = '';
                arr.forEach(c => {
                    full += c.candidates?.[0]?.content?.parts?.[0]?.text || '';
                });
                if(full) this.chatHistory[botIdx].content = full;
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
                html += `<div class="thinking-content">${this.escapeHtml(msg.reasoning)}</div>`;
            }
            
            const rawContent = msg.content || (msg.role === 'assistant' ? '...' : '');
            if (window.marked && msg.role === 'assistant' && msg.content) {
                html += marked.parse(rawContent);
            } else {
                html += this.escapeHtml(rawContent).replace(/\\n/g, '<br>');
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

// ============================================
// NewsHunt — Settings Manager (Multi-Page)
// ============================================

const Settings = {
  currentPage: 'api',

  // Settings sub-pages
  pages: [
    { id: 'api', label: 'API Keys & Models', icon: '🔑' },
    { id: 'feeds', label: 'RSS Feeds', icon: '📡' },
    { id: 'interests', label: 'Interests & Ranking', icon: '🎯' },
    { id: 'reader', label: 'Reader Preferences', icon: '📖' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'data', label: 'Data Management', icon: '🗄️' }
  ],

  // Main render method
  async render() {
    const view = document.getElementById('settings-view');
    view.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-header__title">Settings</h1>
          <p class="section-header__subtitle">Configure your NewsHunt experience</p>
        </div>
      </div>
      <div class="settings-layout">
        <div class="settings-tabs" id="settings-tabs"></div>
        <div class="settings-page-content" id="settings-page-content"></div>
      </div>
    `;

    this._renderTabs();
    await this._renderPage(this.currentPage);
  },

  _renderTabs() {
    const tabsEl = document.getElementById('settings-tabs');
    tabsEl.innerHTML = this.pages.map(p => `
      <button class="settings-tab ${this.currentPage === p.id ? 'settings-tab--active' : ''}"
              data-page="${p.id}" onclick="Settings.switchPage('${p.id}')">
        <span class="settings-tab__icon">${p.icon}</span>
        <span class="settings-tab__label">${p.label}</span>
      </button>
    `).join('');
  },

  async switchPage(pageId) {
    this.currentPage = pageId;
    this._renderTabs();
    await this._renderPage(pageId);
  },

  async _renderPage(pageId) {
    const content = document.getElementById('settings-page-content');
    switch (pageId) {
      case 'api': await this._renderAPIPage(content); break;
      case 'feeds': await this._renderFeedsPage(content); break;
      case 'interests': await this._renderInterestsPage(content); break;
      case 'reader': await this._renderReaderPage(content); break;
      case 'appearance': await this._renderAppearancePage(content); break;
      case 'data': await this._renderDataPage(content); break;
    }
  },

  // ============================================
  // API Keys & Models Page
  // ============================================
  async _renderAPIPage(container) {
    const settings = await db.getAllSettings();
    const models = settings.ai_models || [];
    const defaultModel = settings.ai_default_model || null;

    container.innerHTML = `
      <div class="settings-page-header">
        <h2>🔑 API Keys & Models</h2>
        <p>Connect your AI providers and manage models. Keys are stored locally in your browser only.</p>
      </div>

      <div class="settings-card">
        <h3 class="settings-card__title">Add Provider</h3>
        <div class="settings-form-grid">
          <div class="input-group">
            <label class="input-group__label">Provider</label>
            <select class="input" id="add-provider">
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Google Gemini</option>
              <option value="mistral">Mistral</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-group__label">API Key</label>
            <input type="password" class="input" id="add-api-key" placeholder="Enter your API key">
          </div>
        </div>
        <button class="btn btn--primary" onclick="Settings.saveAPIKey()" style="margin-top: var(--space-4)">
          💾 Save API Key
        </button>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">Saved API Keys</h3>
        <div id="saved-keys-list" class="api-keys-list">
          ${await this._renderSavedKeys(settings)}
        </div>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">Add Model</h3>
        <p class="settings-card__desc">Add AI models you want to use. You can add multiple models and switch between them.</p>
        <div class="settings-form-grid" style="margin-top: var(--space-3)">
          <div class="input-group">
            <label class="input-group__label">Provider</label>
            <select class="input" id="model-provider">
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Google Gemini</option>
              <option value="mistral">Mistral</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-group__label">Model Name</label>
            <input type="text" class="input" id="model-name" placeholder="e.g., llama-3.3-70b-versatile">
            <span class="input-group__help" id="model-suggestions">Groq: llama-3.3-70b-versatile &bull; OpenRouter: gemini-2.0-flash &bull; Gemini: gemini-3.1-flash-lite-preview &bull; Mistral: mistral-small-2603</span>
          </div>
          <div class="input-group">
            <label class="input-group__label">Display Label (optional)</label>
            <input type="text" class="input" id="model-label" placeholder="e.g., My Fast Model">
          </div>
        </div>
        <button class="btn btn--primary" onclick="Settings.addModel()" style="margin-top: var(--space-4)">
          ➕ Add Model
        </button>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">Your Models</h3>
        <p class="settings-card__desc">Click the star ★ to set a model as default.</p>
        <div id="models-list" class="models-list">
          ${this._renderModelsList(models, defaultModel)}
        </div>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">Test Connection</h3>
        <button class="btn btn--secondary" onclick="Settings.testAI()">🧪 Test Default Model</button>
      </div>
    `;
  },

  async _renderSavedKeys(settings) {
    const groqKey = settings.api_key_groq;
    const openrouterKey = settings.api_key_openrouter;
    const geminiKey = settings.api_key_gemini;
    const mistralKey = settings.api_key_mistral;

    if (!groqKey && !openrouterKey && !geminiKey && !mistralKey) {
      return '<p class="text-muted">No API keys saved yet.</p>';
    }

    let html = '';
    if (groqKey) {
      html += `
        <div class="api-key-item">
          <div class="api-key-item__info">
            <span class="api-key-item__provider">Groq</span>
            <span class="api-key-item__masked">••••••••${groqKey.slice(-6)}</span>
          </div>
          <button class="btn btn--ghost btn--sm" onclick="Settings.removeAPIKey('groq')">🗑️</button>
        </div>`;
    }
    if (openrouterKey) {
      html += `
        <div class="api-key-item">
          <div class="api-key-item__info">
            <span class="api-key-item__provider">OpenRouter</span>
            <span class="api-key-item__masked">••••••••${openrouterKey.slice(-6)}</span>
          </div>
          <button class="btn btn--ghost btn--sm" onclick="Settings.removeAPIKey('openrouter')">🗑️</button>
        </div>`;
    }
    if (geminiKey) {
      html += `
        <div class="api-key-item">
          <div class="api-key-item__info">
            <span class="api-key-item__provider">Google Gemini</span>
            <span class="api-key-item__masked">••••••••${geminiKey.slice(-6)}</span>
          </div>
          <button class="btn btn--ghost btn--sm" onclick="Settings.removeAPIKey('gemini')">🗑️</button>
        </div>`;
    }
    if (mistralKey) {
      html += `
        <div class="api-key-item">
          <div class="api-key-item__info">
            <span class="api-key-item__provider">Mistral</span>
            <span class="api-key-item__masked">••••••••${mistralKey.slice(-6)}</span>
          </div>
          <button class="btn btn--ghost btn--sm" onclick="Settings.removeAPIKey('mistral')">🗑️</button>
        </div>`;
    }
    return html;
  },

  _renderModelsList(models, defaultModel) {
    if (!models || models.length === 0) {
      return '<p class="text-muted">No models added yet. Add a model above to get started.</p>';
    }

    return models.map((m, i) => {
      const isDefault = defaultModel && defaultModel.id === m.id;
      return `
        <div class="model-item ${isDefault ? 'model-item--default' : ''}">
          <div class="model-item__info">
            <span class="model-item__name">${Utils.escapeHtml(m.label || m.model)}</span>
            <span class="model-item__details">${Utils.escapeHtml(m.provider)} / ${Utils.escapeHtml(m.model)}</span>
          </div>
          <div class="model-item__actions">
            ${isDefault ? '<span class="model-item__default-badge">⭐ Default</span>' : `<button class="btn btn--ghost btn--sm" onclick="Settings.setDefaultModel(${i})">★ Set Default</button>`}
            <button class="btn btn--ghost btn--sm" onclick="Settings.removeModel(${i})">🗑️</button>
          </div>
        </div>`;
    }).join('');
  },

  async saveAPIKey() {
    const provider = document.getElementById('add-provider').value;
    const apiKey = document.getElementById('add-api-key').value.trim();
    if (!apiKey) {
      Components.showToast('Please enter an API key', 'warning');
      return;
    }
    await db.setSetting(`api_key_${provider}`, apiKey);
    // Also set the legacy keys for backward compat
    await db.setSetting('ai_provider', provider);
    await db.setSetting('ai_api_key', apiKey);

    let providerName = 'Groq';
    if (provider === 'openrouter') providerName = 'OpenRouter';
    if (provider === 'gemini') providerName = 'Google Gemini';
    if (provider === 'mistral') providerName = 'Mistral';

    Components.showToast(`${providerName} API key saved!`, 'success');
    await this._renderPage('api');
  },

  async removeAPIKey(provider) {
    await db.setSetting(`api_key_${provider}`, null);
    Components.showToast('API key removed', 'success');
    await this._renderPage('api');
  },

  async addModel() {
    const provider = document.getElementById('model-provider').value;
    const model = document.getElementById('model-name').value.trim();
    const label = document.getElementById('model-label').value.trim();
    if (!model) {
      Components.showToast('Please enter a model name', 'warning');
      return;
    }

    const models = (await db.getSetting('ai_models')) || [];
    const newModel = {
      id: Utils.hashString(provider + model + Date.now()),
      provider,
      model,
      label: label || model
    };
    models.push(newModel);
    await db.setSetting('ai_models', models);
    db.syncSetting('ai_models', models);

    // Auto-set as default if first model
    if (models.length === 1) {
      await db.setSetting('ai_default_model', newModel);
      db.syncSetting('ai_default_model', newModel);
      await this._syncDefaultToLegacy(newModel);
    }

    Components.showToast(`Model "${newModel.label}" added!`, 'success');
    await this._renderPage('api');
  },

  async setDefaultModel(index) {
    const models = (await db.getSetting('ai_models')) || [];
    if (models[index]) {
      await db.setSetting('ai_default_model', models[index]);
      db.syncSetting('ai_default_model', models[index]);
      await this._syncDefaultToLegacy(models[index]);
      Components.showToast(`"${models[index].label}" set as default`, 'success');
      await this._renderPage('api');
    }
  },

  async _syncDefaultToLegacy(model) {
    const apiKey = await db.getSetting(`api_key_${model.provider}`);
    await db.setSetting('ai_provider', model.provider);
    db.syncSetting('ai_provider', model.provider);
    await db.setSetting('ai_model', model.model);
    db.syncSetting('ai_model', model.model);
    if (apiKey) {
      await db.setSetting('ai_api_key', apiKey);
      db.syncSetting('ai_api_key', apiKey);
    }
  },

  async removeModel(index) {
    const models = (await db.getSetting('ai_models')) || [];
    const defaultModel = await db.getSetting('ai_default_model');
    const removed = models.splice(index, 1)[0];
    await db.setSetting('ai_models', models);
    db.syncSetting('ai_models', models);

    if (defaultModel && defaultModel.id === removed.id) {
      const newDefault = models[0] || null;
      await db.setSetting('ai_default_model', newDefault);
      db.syncSetting('ai_default_model', newDefault);
      if (newDefault) await this._syncDefaultToLegacy(newDefault);
    }
    Components.showToast('Model removed', 'success');
    await this._renderPage('api');
  },

  async testAI() {
    try {
      Components.showToast('Testing connection...', 'info');
      const response = await AI.call([
        { role: 'user', content: 'Respond with exactly: "NewsHunt connected successfully! 🎉"' }
      ], { max_tokens: 50 });
      Components.showToast(response, 'success', 5000);
    } catch (error) {
      Components.showToast(`Connection failed: ${error.message}`, 'error', 6000);
    }
  },

  // ============================================
  // RSS Feeds Page
  // ============================================
  async _renderFeedsPage(container) {
    const feeds = await db.getAllFeeds();

    container.innerHTML = `
      <div class="settings-page-header">
        <h2>📡 RSS Feeds</h2>
        <p>Add your favorite news sources. We'll fetch and categorize articles for you.</p>
      </div>

      <div class="settings-card">
        <h3 class="settings-card__title">Add New Feed</h3>
        <div class="feed-add-form">
          <div class="feed-add-input">
            <span class="feed-add-input__icon">🔗</span>
            <input type="url" class="input" id="setting-feed-url"
                   placeholder="Paste RSS feed URL (e.g., https://feeds.bbci.co.uk/news/rss.xml)">
          </div>
          <button class="btn btn--primary btn--lg" onclick="Settings.addFeed()">
            ➕ Add Feed
          </button>
        </div>
        <div class="feed-suggestions">
          <span class="feed-suggestions__label">Quick add:</span>
          <button class="feed-suggestion-chip" onclick="Settings.quickAddFeed('https://feeds.bbci.co.uk/news/rss.xml', 'BBC News')">BBC News</button>
          <button class="feed-suggestion-chip" onclick="Settings.quickAddFeed('https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'NY Times')">NY Times</button>
          <button class="feed-suggestion-chip" onclick="Settings.quickAddFeed('https://feeds.feedburner.com/TechCrunch/', 'TechCrunch')">TechCrunch</button>
          <button class="feed-suggestion-chip" onclick="Settings.quickAddFeed('https://www.theverge.com/rss/index.xml', 'The Verge')">The Verge</button>
          <button class="feed-suggestion-chip" onclick="Settings.quickAddFeed('https://hnrss.org/frontpage', 'Hacker News')">Hacker News</button>
          <button class="feed-suggestion-chip" onclick="Settings.quickAddFeed('https://www.reddit.com/r/worldnews/.rss', 'Reddit WorldNews')">Reddit WorldNews</button>
        </div>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <div class="settings-card__title-row">
          <h3 class="settings-card__title">Your Feeds (${feeds.length})</h3>
          ${feeds.length > 0 ? '<button class="btn btn--ghost btn--sm" onclick="App.refreshFeeds()">🔄 Refresh All</button>' : ''}
        </div>
        <div id="feeds-list" class="feeds-list-pretty">
          ${feeds.length === 0
        ? `<div class="empty-state" style="padding: var(--space-8)">
                <div class="empty-state__icon">📡</div>
                <h3 class="empty-state__title">No feeds yet</h3>
                <p class="empty-state__desc">Add a feed URL above or use the quick-add suggestions</p>
              </div>`
        : feeds.map(f => `
              <div class="feed-card" data-url="${Utils.escapeHtml(f.url)}">
                <div class="feed-card__icon">📰</div>
                <div class="feed-card__info">
                  <span class="feed-card__name">${Utils.escapeHtml(f.name || Utils.extractDomain(f.url))}</span>
                  <span class="feed-card__url">${Utils.escapeHtml(f.url)}</span>
                </div>
                <div class="feed-card__actions">
                  <button class="btn btn--ghost btn--sm" onclick="Settings.removeFeed('${Utils.escapeHtml(f.url)}')" title="Remove">🗑️</button>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  },

  async addFeed() {
    const input = document.getElementById('setting-feed-url');
    const url = input.value.trim();
    if (!url) { Components.showToast('Please enter a feed URL', 'warning'); return; }
    try { new URL(url); } catch { Components.showToast('Please enter a valid URL', 'error'); return; }

    await db.addFeed(url, Utils.extractDomain(url));
    await db.syncFeeds();
    input.value = '';
    Components.showToast('Feed added! Go to Feed to refresh.', 'success');
    await this._renderPage('feeds');
  },

  async quickAddFeed(url, name) {
    await db.addFeed(url, name);
    await db.syncFeeds();
    Components.showToast(`${name} added!`, 'success');
    await this._renderPage('feeds');
  },

  async removeFeed(url) {
    Components.showModal('Remove Feed?', `
      <p class="text-muted">
        Are you sure you want to remove this feed and all its articles?<br><br>
        <code style="word-break:break-all; font-size: var(--text-xs)">${Utils.escapeHtml(url)}</code>
      </p>
    `, [
      { label: 'Cancel', class: 'btn--secondary' },
      {
        label: 'Remove',
        class: 'btn--danger',
        action: async () => {
          await db.removeFeed(url);
          await db.deleteArticlesByFeed(url);
          await db.syncFeeds();
          Components.showToast('Feed removed', 'success');
          await this._renderPage('feeds');
        }
      }
    ]);
  },

  // ============================================
  // Interests & Ranking Page
  // ============================================
  async _renderInterestsPage(container) {
    const settings = await db.getAllSettings();

    container.innerHTML = `
      <div class="settings-page-header">
        <h2>🎯 Interests & Ranking</h2>
        <p>Tell us what you care about. The AI will prioritize articles based on your interests and deprioritize topics you want to avoid.</p>
      </div>

      <div class="settings-card">
        <h3 class="settings-card__title">📈 Topics I'm Interested In</h3>
        <p class="settings-card__desc">Articles matching these topics will get higher star ratings. Be specific — e.g., "AI developments", "personal finance tips", "startup funding", "travel destinations".</p>
        <div id="interests-tags-wrapper" style="margin-top: var(--space-3)"></div>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">🚫 Topics to Avoid</h3>
        <p class="settings-card__desc">Articles matching these topics will be rated 1 star. E.g., "celebrity gossip", "crime reports", "sports scores".</p>
        <div id="avoid-tags-wrapper" style="margin-top: var(--space-3)"></div>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">🧠 Custom Instructions</h3>
        <p class="settings-card__desc">Give the AI additional context about what kind of reader you are and what provides value to you.</p>
        <textarea class="input" id="custom-instructions" rows="4" placeholder="E.g., I'm a software engineer interested in career growth. I want to be informed about world events that affect markets, new technologies, and opportunities...">${Utils.escapeHtml(settings.custom_instructions || '')}</textarea>
      </div>

      <div class="settings-action-bar" style="margin-top: var(--space-6)">
        <button class="btn btn--primary btn--lg" onclick="Settings.savePreferences()">💾 Save Preferences</button>
        <button class="btn btn--danger btn--lg" onclick="Settings.reRankArticles()">🔄 Re-Rank All Articles</button>
      </div>
    `;

    const interests = settings.interests || [];
    const avoid = settings.avoid_topics || [];

    document.getElementById('interests-tags-wrapper').appendChild(
      Components.createTagInput('interests-tags', interests, 'Type an interest and press Enter...')
    );
    document.getElementById('avoid-tags-wrapper').appendChild(
      Components.createTagInput('avoid-tags', avoid, 'Type a topic to avoid and press Enter...')
    );
  },

  async savePreferences() {
    const interests = Components.getTagValues('interests-tags');
    const avoid = Components.getTagValues('avoid-tags');
    const customInstructions = document.getElementById('custom-instructions')?.value?.trim() || '';

    await db.setSetting('interests', interests);
    db.syncSetting('interests', interests);
    await db.setSetting('avoid_topics', avoid);
    db.syncSetting('avoid_topics', avoid);
    await db.setSetting('custom_instructions', customInstructions);
    db.syncSetting('custom_instructions', customInstructions);

    Components.showToast('Preferences saved! Click "Re-Rank" to apply to existing articles.', 'success');
  },

  async reRankArticles() {
    const configured = await AI.isConfigured();
    if (!configured) { Components.showToast('Please configure AI settings first', 'warning'); return; }

    Components.showModal('Re-Rank All Articles?', `
      <p class="text-muted">This will clear all existing ratings and re-categorize all unread articles using the AI with your updated preferences.<br><br>This may take a while and will use API tokens.</p>
    `, [
      { label: 'Cancel', class: 'btn--secondary' },
      {
        label: '🔄 Re-Rank Now',
        class: 'btn--primary',
        action: async () => {
          Components.showToast('Re-ranking started...', 'info');
          try {
            const result = await Categorizer.reRankAll((progress) => {
              Components.showToast(`Batch ${progress.batch}/${progress.totalBatches} done`, 'info', 2000);
            });
            Components.showToast(`Re-ranked ${result.categorized} articles`, 'success');
            App.refreshFeedView();
          } catch (error) {
            Components.showToast(`Re-ranking error: ${error.message}`, 'error');
          }
        }
      }
    ]);
  },

  // ============================================
  // Reader Preferences Page
  // ============================================
  async _renderReaderPage(container) {
    const settings = await db.getAllSettings();
    const readerPrefs = settings.reader_prefs || {};

    container.innerHTML = `
      <div class="settings-page-header">
        <h2>📖 Reader Preferences</h2>
        <p>Customize how articles look when you read them.</p>
      </div>

      <div class="settings-card">
        <h3 class="settings-card__title">Typography</h3>
        <div class="reader-pref-row">
          <label class="input-group__label">Font Family</label>
          <select class="input" id="reader-font" onchange="Settings.previewReaderFont()">
            <option value="serif" ${readerPrefs.font === 'serif' || !readerPrefs.font ? 'selected' : ''}>Serif (Merriweather)</option>
            <option value="sans" ${readerPrefs.font === 'sans' ? 'selected' : ''}>Sans-serif (Inter)</option>
            <option value="mono" ${readerPrefs.font === 'mono' ? 'selected' : ''}>Monospace (JetBrains Mono)</option>
          </select>
        </div>

        <div class="reader-pref-row">
          <label class="input-group__label">Font Size</label>
          <div class="range-with-value">
            <input type="range" class="range-input" id="reader-font-size" min="14" max="24" step="1"
                   value="${readerPrefs.fontSize || 18}" oninput="Settings.updateRangeLabel('reader-font-size')">
            <span class="range-value" id="reader-font-size-value">${readerPrefs.fontSize || 18}px</span>
          </div>
        </div>

        <div class="reader-pref-row">
          <label class="input-group__label">Line Height</label>
          <div class="range-with-value">
            <input type="range" class="range-input" id="reader-line-height" min="1.4" max="2.2" step="0.1"
                   value="${readerPrefs.lineHeight || 1.85}" oninput="Settings.updateRangeLabel('reader-line-height')">
            <span class="range-value" id="reader-line-height-value">${readerPrefs.lineHeight || 1.85}</span>
          </div>
        </div>

        <div class="reader-pref-row">
          <label class="input-group__label">Content Width</label>
          <select class="input" id="reader-width">
            <option value="narrow" ${readerPrefs.width === 'narrow' ? 'selected' : ''}>Narrow (600px)</option>
            <option value="normal" ${readerPrefs.width === 'normal' || !readerPrefs.width ? 'selected' : ''}>Normal (720px)</option>
            <option value="wide" ${readerPrefs.width === 'wide' ? 'selected' : ''}>Wide (900px)</option>
          </select>
        </div>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">AI Rewrite Style</h3>
        <div class="reader-pref-row">
          <label class="input-group__label">Explanation Depth</label>
          <select class="input" id="reader-depth">
            <option value="brief" ${readerPrefs.depth === 'brief' ? 'selected' : ''}>Brief — quick summary</option>
            <option value="standard" ${readerPrefs.depth === 'standard' || !readerPrefs.depth ? 'selected' : ''}>Standard — balanced</option>
            <option value="detailed" ${readerPrefs.depth === 'detailed' ? 'selected' : ''}>Detailed — in-depth analysis</option>
          </select>
        </div>

        <div class="reader-pref-row">
          <label class="input-group__label">Language Level</label>
          <select class="input" id="reader-language">
            <option value="simple" ${readerPrefs.language === 'simple' ? 'selected' : ''}>Simple — easy to understand</option>
            <option value="standard" ${readerPrefs.language === 'standard' || !readerPrefs.language ? 'selected' : ''}>Standard — general audience</option>
            <option value="expert" ${readerPrefs.language === 'expert' ? 'selected' : ''}>Expert — technical language</option>
          </select>
        </div>

        <div class="reader-pref-row">
          <label class="toggle">
            <input type="checkbox" class="toggle__input" id="reader-auto-explain" ${readerPrefs.autoExplain !== false ? 'checked' : ''}>
            <span class="toggle__slider"></span>
            <span class="toggle__label">Auto-explain difficult terms</span>
          </label>
        </div>

        <div class="reader-pref-row">
          <label class="toggle">
            <input type="checkbox" class="toggle__input" id="reader-show-charts" ${readerPrefs.showCharts !== false ? 'checked' : ''}>
            <span class="toggle__slider"></span>
            <span class="toggle__label">Show charts & visual aids when available</span>
          </label>
        </div>

        <div class="reader-pref-row">
          <label class="toggle">
            <input type="checkbox" class="toggle__input" id="reader-key-facts" ${readerPrefs.keyFacts !== false ? 'checked' : ''}>
            <span class="toggle__slider"></span>
            <span class="toggle__label">Highlight key facts & takeaways</span>
          </label>
        </div>
      </div>

      <div class="input-group" style="margin-top: var(--space-4)">
        <label class="input-group__label">✍️ Custom AI Prompt (Optional)</label>
        <p class="input-group__hint" style="color: var(--color-text-secondary); font-size: 0.85rem; margin-bottom: var(--space-2)">Add your own instructions for how the AI should rewrite articles. This is appended to the default prompt.</p>
        <textarea class="input" id="reader-custom-prompt" rows="4" 
          placeholder="e.g. Always explain concepts with real-world analogies. Focus on practical implications. Write in a conversational tone.">${Utils.escapeHtml(readerPrefs.customPrompt || '')}</textarea>
      </div>

      <div class="settings-action-bar" style="margin-top: var(--space-6)">
        <button class="btn btn--primary btn--lg" onclick="Settings.saveReaderPrefs()">💾 Save Reader Preferences</button>
      </div>
    `;
  },

  updateRangeLabel(inputId) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(inputId + '-value');
    if (input && label) {
      label.textContent = inputId.includes('font-size') ? input.value + 'px' : input.value;
    }
  },

  async saveReaderPrefs() {
    const prefs = {
      font: document.getElementById('reader-font').value,
      fontSize: parseInt(document.getElementById('reader-font-size').value),
      lineHeight: parseFloat(document.getElementById('reader-line-height').value),
      width: document.getElementById('reader-width').value,
      depth: document.getElementById('reader-depth').value,
      language: document.getElementById('reader-language').value,
      autoExplain: document.getElementById('reader-auto-explain').checked,
      showCharts: document.getElementById('reader-show-charts').checked,
      keyFacts: document.getElementById('reader-key-facts').checked,
      customPrompt: document.getElementById('reader-custom-prompt')?.value?.trim() || ''
    };
    await db.setSetting('reader_prefs', prefs);
    db.syncSetting('reader_prefs', prefs);
    Components.showToast('Reader preferences saved!', 'success');
  },

  // ============================================
  // Appearance Page
  // ============================================
  async _renderAppearancePage(container) {
    container.innerHTML = `
      <div class="settings-page-header">
        <h2>🎨 Appearance</h2>
        <p>Customize the look and feel of NewsHunt.</p>
      </div>

      <div class="settings-card">
        <h3 class="settings-card__title">Theme</h3>
        <div class="theme-picker">
          <button class="theme-option ${document.documentElement.dataset.theme !== 'light' ? 'theme-option--active' : ''}" onclick="Settings.setTheme('dark')">
            <span class="theme-option__preview theme-option__preview--dark"></span>
            <span>🌙 Dark</span>
          </button>
          <button class="theme-option ${document.documentElement.dataset.theme === 'light' ? 'theme-option--active' : ''}" onclick="Settings.setTheme('light')">
            <span class="theme-option__preview theme-option__preview--light"></span>
            <span>☀️ Light</span>
          </button>
        </div>
      </div>
    `;
  },

  setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    db.setSetting('theme', theme);
    db.syncSetting('theme', theme);
    this._renderPage('appearance');
    Components.showToast(`Switched to ${theme} mode`, 'success');
  },

  // ============================================
  // Data Management Page
  // ============================================
  async _renderDataPage(container) {
    const articles = await db.getAllArticles();
    const readCount = articles.filter(a => a.isRead).length;
    const unreadCount = articles.filter(a => !a.isRead).length;
    const feeds = await db.getAllFeeds();

    container.innerHTML = `
      <div class="settings-page-header">
        <h2>🗄️ Data Management</h2>
        <p>Manage your local data and storage.</p>
      </div>

      <div class="settings-card">
        <h3 class="settings-card__title">Storage Stats</h3>
        <div class="stats-bar" style="margin-top: var(--space-3)">
          <div class="stat-item"><span class="stat-item__value">${feeds.length}</span><span class="stat-item__label">Feeds</span></div>
          <div class="stat-item"><span class="stat-item__value">${articles.length}</span><span class="stat-item__label">Total Articles</span></div>
          <div class="stat-item"><span class="stat-item__value">${unreadCount}</span><span class="stat-item__label">Unread</span></div>
          <div class="stat-item"><span class="stat-item__value">${readCount}</span><span class="stat-item__label">Read</span></div>
        </div>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">📦 Export / Import</h3>
        <p class="text-muted" style="margin: var(--space-2) 0 var(--space-4)">Export all your data (settings, feeds, articles, preferences) as a JSON file so you can back it up or transfer to another device.</p>
        <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
          <button class="btn btn--primary" onclick="Settings.exportAllData()">📤 Export All Data</button>
          <label class="btn btn--secondary" style="cursor: pointer">
            📥 Import Data
            <input type="file" accept=".json" style="display:none" onchange="Settings.importData(this.files[0])">
          </label>
        </div>
      </div>

      <div class="settings-card" style="margin-top: var(--space-6)">
        <h3 class="settings-card__title">Actions</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-3)">
          <button class="btn btn--secondary" onclick="Settings.clearReadArticles()">📚 Clear Read History</button>
          <button class="btn btn--secondary" onclick="Settings.clearArticleCache()">🧹 Clear AI Content Cache</button>
          <button class="btn btn--danger" onclick="Settings.clearAllData()">🗑️ Clear All Data</button>
        </div>
      </div>
    `;
  },

  async clearReadArticles() {
    Components.showModal('Clear Read History?', '<p class="text-muted">This will mark all read articles as unread.</p>', [
      { label: 'Cancel', class: 'btn--secondary' },
      {
        label: 'Clear', class: 'btn--danger',
        action: async () => {
          const articles = await db.getReadArticles();
          for (const a of articles) { a.isRead = false; a.readAt = null; await db.addArticle(a); }
          await db.syncToServer();
          Components.showToast('Read history cleared', 'success');
        }
      }
    ]);
  },

  async clearArticleCache() {
    await db.clearArticleContent();
    Components.showToast('AI content cache cleared', 'success');
  },

  async clearAllData() {
    Components.showModal('Clear ALL Data?', `
      <p style="color: var(--color-error); font-weight: var(--font-weight-semibold);">⚠️ This action cannot be undone!</p>
      <p class="text-muted" style="margin-top: var(--space-2);">This will delete all feeds, articles, ratings, chat history, and settings.</p>
    `, [
      { label: 'Cancel', class: 'btn--secondary' },
      {
        label: '🗑️ Delete Everything', class: 'btn--danger',
        action: async () => {
          await db.clearAllData({ skipSync: true });
          await db.syncToServer();
          window.location.reload();
        }
      }
    ]);
  },

  async exportAllData() {
    try {
      const settings = await db.getAllSettings();
      const feeds = await db.getAllFeeds();
      const articles = await db.getAllArticles();

      const exportData = {
        _meta: {
          app: 'NewsHunt',
          version: '1.0',
          exportedAt: new Date().toISOString(),
          articleCount: articles.length,
          feedCount: feeds.length
        },
        settings,
        feeds,
        articles
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newshunt-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      Components.showToast(`Exported ${articles.length} articles, ${feeds.length} feeds, and all settings`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      Components.showToast('Failed to export data: ' + error.message, 'error');
    }
  },

  async importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.settings && !data.feeds && !data.articles) {
        Components.showToast('Invalid backup file — no settings, feeds, or articles found.', 'error');
        return;
      }

      const counts = [];
      if (data.feeds) counts.push(`${data.feeds.length} feeds`);
      if (data.articles) counts.push(`${data.articles.length} articles`);
      if (data.settings) counts.push('all settings');

      Components.showModal('Import Data?', `
        <p>This will import: <strong>${counts.join(', ')}</strong></p>
        <p class="text-muted" style="margin-top: var(--space-2);">Existing data will be merged — nothing will be deleted.</p>
      `, [
        { label: 'Cancel', class: 'btn--secondary' },
        {
          label: '📥 Import', class: 'btn--primary',
          action: async () => {
            // Import settings
            if (data.settings && typeof data.settings === 'object') {
              for (const [key, value] of Object.entries(data.settings)) {
                await db.setSetting(key, value);
              }
            }

            // Import feeds (add missing)
            if (Array.isArray(data.feeds)) {
              const existing = await db.getAllFeeds();
              const existingUrls = new Set(existing.map(f => f.url));
              for (const feed of data.feeds) {
                if (!existingUrls.has(feed.url)) {
                  await db.addFeed(feed.url, feed.name || '');
                }
              }
            }

            // Import articles (add missing)
            if (Array.isArray(data.articles)) {
              for (const article of data.articles) {
                const existing = await db.getArticle(article.guid);
                if (!existing) {
                  await db.addArticle(article);
                } else {
                  // Merge: keep read state and stars if newer
                  let changed = false;
                  if (article.isRead && !existing.isRead) { existing.isRead = true; existing.readAt = article.readAt; changed = true; }
                  if (article.ratedAt && (!existing.ratedAt || article.ratedAt > existing.ratedAt)) {
                    existing.stars = article.stars; existing.ratingReason = article.ratingReason; existing.ratedAt = article.ratedAt; changed = true;
                  }
                  if (changed) await db.addArticle(existing);
                }
              }
            }

            await db.syncToServer();
            Components.showToast('Data imported successfully! Reloading...', 'success');
            setTimeout(() => window.location.reload(), 1500);
          }
        }
      ]);
    } catch (error) {
      console.error('Import error:', error);
      Components.showToast('Failed to import: ' + error.message, 'error');
    }
  }
};

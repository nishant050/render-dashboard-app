// ============================================
// NewsHunt - Cloud Data Layer
// ============================================

const SERVER_POLL_INTERVAL_MS = 15000;

class NewsHuntDB {
  constructor() {
    this.data = {
      settings: {},
      feeds: [],
      articles: {},
      chatHistory: [],
      articleContent: {}
    };
    this.isApplyingServerState = false;
    this.pollTimer = null;
    this.initPromise = null;
    this.serverPullPauseCount = 0;
    this.eventListeners = []; // in case we want reactivity, though original didn't have events in DB
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.syncFromServer({ force: true }).then(() => {
        this.pollTimer = setInterval(() => this.syncFromServer(), SERVER_POLL_INTERVAL_MS);
        return true;
    });
    return this.initPromise;
  }

  // ============================================
  // Feeds
  // ============================================
  async addFeed(url, name = '', options = {}) {
    const feed = { url, name, addedAt: Date.now() };
    const idx = this.data.feeds.findIndex(f => f.url === url);
    if (idx >= 0) this.data.feeds[idx] = feed;
    else this.data.feeds.push(feed);
    
    if (!options.skipSync) await this._pushFeeds();
    return feed;
  }

  async removeFeed(url, options = {}) {
    this.data.feeds = this.data.feeds.filter(f => f.url !== url);
    if (!options.skipSync) await this._pushFeeds();
    return url;
  }

  async getAllFeeds() {
    return this.data.feeds;
  }

  async _pushFeeds() {
    return fetch('/api/newshunt/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeds: this.data.feeds })
    }).catch(e => console.warn('Sync failed', e));
  }

  // ============================================
  // Articles
  // ============================================
  async addArticle(article, options = {}) {
    this.data.articles[article.guid] = article;
    if (!options.skipSync) {
        fetch('/api/newshunt/article', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article })
        }).catch(e => console.warn('Sync failed', e));
    }
  }

  async addArticles(articles, options = {}) {
    if (!Array.isArray(articles) || articles.length === 0) return;
    
    // batch locally
    articles.forEach(article => {
        if (article.guid) this.data.articles[article.guid] = article;
    });
    
    if (!options.skipSync) {
        fetch('/api/newshunt/articles/batch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles })
        }).catch(e => console.warn('Sync failed', e));
    }
  }

  async getArticle(guid) {
    return this.data.articles[guid] || null;
  }

  async getAllArticles() {
    return Object.values(this.data.articles);
  }

  async getUnreadArticles() {
    return this.getAllArticles().then(articles => articles.filter(a => !a.isRead));
  }

  async getReadArticles() {
    return this.getAllArticles().then(articles => articles.filter(a => a.isRead));
  }

  async getArticlesByStars(stars) {
    return this.getAllArticles().then(articles => articles.filter(a => a.stars === stars && !a.isRead));
  }

  async getUncategorizedArticles() {
    return this.getAllArticles().then(articles => articles.filter(a => a.stars === undefined || a.stars === null));
  }

  async markRead(guid, options = {}) {
    const article = await this.getArticle(guid);
    if (!article) return null;

    article.isRead = true;
    article.readAt = Date.now();
    
    if (!options.skipSync) {
        fetch('/api/newshunt/mark-read', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guid })
        }).catch(e => console.warn('Sync failed', e));
    }
    return article;
  }

  async updateArticleStars(guid, stars, reason, options = {}) {
    const article = await this.getArticle(guid);
    if (!article) return null;

    article.stars = stars;
    article.ratingReason = reason;
    article.ratedAt = Date.now();
    
    if (!options.skipSync) {
        fetch('/api/newshunt/article', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article })
        }).catch(e => console.warn('Sync failed', e));
    }
    return article;
  }

  async resetAllRatings(options = {}) {
    const toUpdate = [];
    Object.values(this.data.articles).forEach(article => {
        article.stars = null;
        article.ratingReason = null;
        article.ratedAt = null;
        toUpdate.push(article);
    });
    
    if (!options.skipSync) {
        fetch('/api/newshunt/articles/batch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles: toUpdate })
        }).catch(e => console.warn('Sync failed', e));
    }
  }

  async deleteArticlesByFeed(feedUrl, options = {}) {
    for (const guid in this.data.articles) {
        if (this.data.articles[guid].feedUrl === feedUrl) {
            delete this.data.articles[guid];
        }
    }
    
    if (!options.skipSync) {
        fetch('/api/newshunt/articles/feed', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedUrl })
        }).catch(e => console.warn('Sync failed', e));
    }
  }

  async purgeOldArticles(maxAgeDays = 3, options = {}) {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    for (const guid in this.data.articles) {
        const article = this.data.articles[guid];
        const articleDate = new Date(article.pubDate || article.dateAdded || 0).getTime();
        if (articleDate < cutoff) {
            delete this.data.articles[guid];
            if (this.data.articleContent[guid]) delete this.data.articleContent[guid];
            deletedCount++;
        }
    }
    
    if (!options.skipSync && deletedCount > 0) {
        fetch('/api/newshunt/articles/purge', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxAgeDays })
        }).catch(e => console.warn('Sync failed', e));
    }
    return deletedCount;
  }

  // ============================================
  // Settings
  // ============================================
  async setSetting(key, value, options = {}) {
    this.data.settings[key] = value;
    if (!options.skipSync) {
        await this.syncSetting(key, value);
    }
  }

  async getSetting(key) {
    return this.data.settings[key] !== undefined ? this.data.settings[key] : null;
  }

  async getAllSettings() {
    return { ...this.data.settings };
  }

  async syncSetting(key, value) {
    const response = await fetch('/api/newshunt/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Failed to save setting "${key}"`);
    }

    return response.json();
  }

  // ============================================
  // Chat History
  // ============================================
  async addChatMessage(articleGuid, role, content, meta = {}) {
    const reasoning = typeof meta.reasoning === 'string' ? meta.reasoning : '';
    const newMessage = {
        articleGuid,
        role,
        content,
        ...(reasoning ? { reasoning } : {}),
        timestamp: Date.now(),
        id: Date.now() + Math.random().toString(36).substring(7)
    };
    this.data.chatHistory.push(newMessage);
    
    return fetch('/api/newshunt/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleGuid, role, content, reasoning })
    }).then(res => res.json()).then(data => {
        if (data.id) newMessage.id = data.id;
        return newMessage;
    }).catch(e => { console.warn('Sync failed', e); return newMessage; });
  }

  async getChatHistory(articleGuid) {
    return this.data.chatHistory.filter(msg => msg.articleGuid === articleGuid)
                                .sort((a,b) => a.timestamp - b.timestamp);
  }

  // ============================================
  // Article Content Cache
  // ============================================
  async saveArticleContent(guid, content) {
    this.data.articleContent[guid] = content;
    return fetch('/api/newshunt/article-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guid, content })
    }).catch(e => console.warn('Sync failed', e));
  }

  async getArticleContent(guid) {
    return this.data.articleContent[guid] || null;
  }

  async clearArticleContent() {
    this.data.articleContent = {};
    return fetch('/api/newshunt/article-content/clear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
    }).catch(e => console.warn('Sync failed', e));
  }

  // ============================================
  // Article Grouping and Topics
  // ============================================
  async updateArticleGroup(guid, groupId, isPrimary, groupLabel, relatedCount, options = {}) {
    const article = await this.getArticle(guid);
    if (!article) return null;

    article.groupId = groupId;
    article.isGroupPrimary = isPrimary;
    article.groupLabel = groupLabel;
    article.relatedCount = relatedCount || 0;

    if (!options.skipSync) {
        fetch('/api/newshunt/article', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article })
        }).catch(e => console.warn('Sync failed', e));
    }
    return article;
  }

  async updateArticleTopics(guid, topics, options = {}) {
    const article = await this.getArticle(guid);
    if (!article) return null;

    article.topics = topics;

    if (!options.skipSync) {
        fetch('/api/newshunt/article', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article })
        }).catch(e => console.warn('Sync failed', e));
    }
    return article;
  }

  async getAllTopics() {
    const articles = await this.getAllArticles();
    const topicMap = {};

    articles.forEach(article => {
      if (!article.topics || article.topics.length === 0) return;

      article.topics.forEach(topic => {
        if (!topicMap[topic]) topicMap[topic] = { name: topic, count: 0, articles: [] };
        topicMap[topic].count++;
        topicMap[topic].articles.push(article);
      });
    });

    return Object.values(topicMap).sort((a, b) => b.count - a.count);
  }

  async getArticlesByTopic(topicName) {
    const articles = await this.getAllArticles();
    return articles.filter(article => article.topics && article.topics.includes(topicName));
  }

  async getGroupedArticles(groupId) {
    const articles = await this.getAllArticles();
    return articles.filter(article => article.groupId === groupId && !article.isGroupPrimary);
  }

  async clearAllData(options = {}) {
    this.data = { settings: {}, feeds: [], articles: {}, chatHistory: [], articleContent: {} };
    if (!options.skipSync) {
        fetch('/api/newshunt/clear-all', { method: 'DELETE' }).catch(e => console.warn('Sync failed', e));
    }
  }

  // ============================================
  // Server Sync
  // ============================================
  async loadEnvApiKeys() {
    try {
      const response = await fetch('/api/newshunt/ai-config');
      if (!response.ok) return;
      const envKeys = await response.json();

      // Store env keys in provider-specific slots (in-memory only)
      if (envKeys.groq) await this.setSetting('api_key_groq', envKeys.groq, { skipSync: true });
      if (envKeys.openrouter) await this.setSetting('api_key_openrouter', envKeys.openrouter, { skipSync: true });
      if (envKeys.cerebras) await this.setSetting('api_key_cerebras', envKeys.cerebras, { skipSync: true });
      if (envKeys.nvidia) await this.setSetting('api_key_nvidia', envKeys.nvidia, { skipSync: true });
      if (envKeys.gemini) await this.setSetting('api_key_gemini', envKeys.gemini, { skipSync: true });
      if (envKeys.mistral) await this.setSetting('api_key_mistral', envKeys.mistral, { skipSync: true });

      // Only set legacy ai_provider/ai_api_key if the user has NEVER configured any provider
      const currentProvider = await this.getSetting('ai_provider');
      if (!currentProvider) {
        // Pick the first available env key as default
        const firstProvider = envKeys.groq ? 'groq' : envKeys.openrouter ? 'openrouter' : envKeys.cerebras ? 'cerebras' : envKeys.nvidia ? 'nvidia' : envKeys.gemini ? 'gemini' : envKeys.mistral ? 'mistral' : null;
        if (firstProvider) {
          await this.setSetting('ai_provider', firstProvider, { skipSync: true });
          await this.setSetting('ai_api_key', envKeys[firstProvider], { skipSync: true });
          await this.setSetting('ai_model', AI.PROVIDERS[firstProvider]?.defaultModel || '', { skipSync: true });
        }
      } else {
        // Provider is already set by user, just ensure ai_api_key matches
        // First check provider-specific stored key, then fall back to env
        const storedKey = await this.getSetting(`api_key_${currentProvider}`);
        if (storedKey) {
          await this.setSetting('ai_api_key', storedKey, { skipSync: true });
        }
      }

      console.log('[Sync] Loaded API keys from server env vars');
    } catch (error) {
      console.warn('[Sync] Failed to load env API keys:', error.message);
    }
  }

  pauseServerPulls() {
    this.serverPullPauseCount += 1;
  }

  async resumeServerPulls(options = {}) {
    this.serverPullPauseCount = Math.max(0, this.serverPullPauseCount - 1);
    if (options.immediate && this.serverPullPauseCount === 0) {
      return this.syncFromServer({ force: true });
    }
    return true;
  }

  async syncFromServer(options = {}) {
    if (!options.force && this.serverPullPauseCount > 0) {
      return false;
    }

    try {
      this.isApplyingServerState = true;
      const response = await fetch('/api/newshunt/sync');
      if (!response.ok) return false;

      const serverData = await response.json();
      
      this.data.settings = serverData.settings || {};
      this.data.feeds = Array.isArray(serverData.feeds) ? serverData.feeds : [];
      this.data.articles = serverData.articles || {};
      this.data.chatHistory = Array.isArray(serverData.chatHistory) ? serverData.chatHistory : [];
      this.data.articleContent = serverData.articleContent || {};

      console.log('[Sync] Pulled complete state from server');
      
      // Dispatch an event so the UI knows updates arrived
      document.dispatchEvent(new CustomEvent('newshuntDataUpdated'));
      
      return true;
    } catch (error) {
      console.warn('[Sync] Failed to pull from server (offline?):', error.message);
      return false;
    } finally {
      this.isApplyingServerState = false;
    }
  }

  async syncToServer() {
     // Bulk sync is no longer the primary way we persist, it's done fine-grained.
     // But we will keep this in case the app forces a full sync somewhere.
     try {
       const response = await fetch('/api/newshunt/sync', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(this.data)
       });
       return response.ok;
     } catch (e) {
       console.warn('Full sync to server failed', e);
       return false;
     }
  }

  async markReadAndSync(guid) {
    await this.markRead(guid);
    return true;
  }

  async syncFeeds() {
    await this._pushFeeds();
    return true;
  }
}

// Global instance
const db = new NewsHuntDB();

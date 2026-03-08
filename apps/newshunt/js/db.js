// ============================================
// NewsHunt — IndexedDB Data Layer
// ============================================

const DB_NAME = 'newshunt_db';
const DB_VERSION = 1;

class NewsHuntDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Feeds store
        if (!db.objectStoreNames.contains('feeds')) {
          db.createObjectStore('feeds', { keyPath: 'url' });
        }

        // Articles store
        if (!db.objectStoreNames.contains('articles')) {
          const articleStore = db.createObjectStore('articles', { keyPath: 'guid' });
          articleStore.createIndex('feedUrl', 'feedUrl', { unique: false });
          articleStore.createIndex('stars', 'stars', { unique: false });
          articleStore.createIndex('isRead', 'isRead', { unique: false });
          articleStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Chat history store
        if (!db.objectStoreNames.contains('chat_history')) {
          const chatStore = db.createObjectStore('chat_history', { keyPath: 'id', autoIncrement: true });
          chatStore.createIndex('articleGuid', 'articleGuid', { unique: false });
        }

        // AI-rewritten content cache
        if (!db.objectStoreNames.contains('article_content')) {
          db.createObjectStore('article_content', { keyPath: 'guid' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // --- Generic helpers ---
  _tx(storeName, mode = 'readonly') {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  _request(store, method, ...args) {
    return new Promise((resolve, reject) => {
      const request = store[method](...args);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Feeds
  // ============================================
  async addFeed(url, name = '') {
    const store = this._tx('feeds', 'readwrite');
    return this._request(store, 'put', { url, name, addedAt: Date.now() });
  }

  async removeFeed(url) {
    const store = this._tx('feeds', 'readwrite');
    return this._request(store, 'delete', url);
  }

  async getAllFeeds() {
    const store = this._tx('feeds');
    return this._request(store, 'getAll');
  }

  // ============================================
  // Articles
  // ============================================
  async addArticle(article) {
    const store = this._tx('articles', 'readwrite');
    return this._request(store, 'put', article);
  }

  async addArticles(articles) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('articles', 'readwrite');
      const store = tx.objectStore('articles');
      articles.forEach(a => store.put(a));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getArticle(guid) {
    const store = this._tx('articles');
    return this._request(store, 'get', guid);
  }

  async getAllArticles() {
    const store = this._tx('articles');
    return this._request(store, 'getAll');
  }

  async getUnreadArticles() {
    const articles = await this.getAllArticles();
    return articles.filter(a => !a.isRead);
  }

  async getReadArticles() {
    const articles = await this.getAllArticles();
    return articles.filter(a => a.isRead);
  }

  async getArticlesByStars(stars) {
    const articles = await this.getAllArticles();
    return articles.filter(a => a.stars === stars && !a.isRead);
  }

  async getUncategorizedArticles() {
    const articles = await this.getAllArticles();
    return articles.filter(a => a.stars === undefined || a.stars === null);
  }

  async markRead(guid) {
    const article = await this.getArticle(guid);
    if (article) {
      article.isRead = true;
      article.readAt = Date.now();
      const store = this._tx('articles', 'readwrite');
      return this._request(store, 'put', article);
    }
  }

  async updateArticleStars(guid, stars, reason) {
    const article = await this.getArticle(guid);
    if (article) {
      article.stars = stars;
      article.ratingReason = reason;
      article.ratedAt = Date.now();
      const store = this._tx('articles', 'readwrite');
      return this._request(store, 'put', article);
    }
  }

  async resetAllRatings() {
    const articles = await this.getAllArticles();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('articles', 'readwrite');
      const store = tx.objectStore('articles');
      articles.forEach(a => {
        a.stars = null;
        a.ratingReason = null;
        a.ratedAt = null;
        store.put(a);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteArticlesByFeed(feedUrl) {
    const articles = await this.getAllArticles();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('articles', 'readwrite');
      const store = tx.objectStore('articles');
      articles.filter(a => a.feedUrl === feedUrl).forEach(a => store.delete(a.guid));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Auto-purge articles older than maxAgeDays
  async purgeOldArticles(maxAgeDays = 3) {
    const articles = await this.getAllArticles();
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const old = articles.filter(a => {
      const date = new Date(a.pubDate || a.dateAdded || 0).getTime();
      return date < cutoff;
    });

    if (old.length === 0) return 0;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['articles', 'article_content'], 'readwrite');
      const articleStore = tx.objectStore('articles');
      const contentStore = tx.objectStore('article_content');
      old.forEach(a => {
        articleStore.delete(a.guid);
        contentStore.delete(a.guid);
      });
      tx.oncomplete = () => resolve(old.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  // ============================================
  // Settings
  // ============================================
  async setSetting(key, value) {
    const store = this._tx('settings', 'readwrite');
    return this._request(store, 'put', { key, value });
  }

  async getSetting(key) {
    const store = this._tx('settings');
    const result = await this._request(store, 'get', key);
    return result ? result.value : null;
  }

  async getAllSettings() {
    const store = this._tx('settings');
    const items = await this._request(store, 'getAll');
    const settings = {};
    items.forEach(item => { settings[item.key] = item.value; });
    return settings;
  }

  // ============================================
  // Chat History
  // ============================================
  async addChatMessage(articleGuid, role, content) {
    const store = this._tx('chat_history', 'readwrite');
    return this._request(store, 'add', {
      articleGuid,
      role,
      content,
      timestamp: Date.now()
    });
  }

  async getChatHistory(articleGuid) {
    const store = this._tx('chat_history');
    const index = store.index('articleGuid');
    return this._request(index, 'getAll', articleGuid);
  }

  // ============================================
  // Article Content Cache
  // ============================================
  async saveArticleContent(guid, content) {
    const store = this._tx('article_content', 'readwrite');
    return this._request(store, 'put', { guid, content, savedAt: Date.now() });
  }

  async getArticleContent(guid) {
    const store = this._tx('article_content');
    const result = await this._request(store, 'get', guid);
    return result ? result.content : null;
  }

  // ============================================
  // Article Grouping & Topics
  // ============================================
  async updateArticleGroup(guid, groupId, isPrimary, groupLabel, relatedCount) {
    const article = await this.getArticle(guid);
    if (article) {
      article.groupId = groupId;
      article.isGroupPrimary = isPrimary;
      article.groupLabel = groupLabel;
      article.relatedCount = relatedCount || 0;
      const store = this._tx('articles', 'readwrite');
      return this._request(store, 'put', article);
    }
  }

  async updateArticleTopics(guid, topics) {
    const article = await this.getArticle(guid);
    if (article) {
      article.topics = topics;
      const store = this._tx('articles', 'readwrite');
      return this._request(store, 'put', article);
    }
  }

  async getAllTopics() {
    const articles = await this.getAllArticles();
    const topicMap = {};
    articles.forEach(a => {
      if (a.topics && a.topics.length > 0) {
        a.topics.forEach(t => {
          if (!topicMap[t]) topicMap[t] = { name: t, count: 0, articles: [] };
          topicMap[t].count++;
          topicMap[t].articles.push(a);
        });
      }
    });
    return Object.values(topicMap).sort((a, b) => b.count - a.count);
  }

  async getArticlesByTopic(topicName) {
    const articles = await this.getAllArticles();
    return articles.filter(a => a.topics && a.topics.includes(topicName));
  }

  async getGroupedArticles(groupId) {
    const articles = await this.getAllArticles();
    return articles.filter(a => a.groupId === groupId && !a.isGroupPrimary);
  }

  // ============================================
  // Server Sync
  // ============================================

  /**
   * Load API keys from server environment variables (Render secrets).
   * These are set once on Render and available on every device.
   */
  async loadEnvApiKeys() {
    try {
      const response = await fetch('/api/newshunt/ai-config');
      if (!response.ok) return;
      const envKeys = await response.json();

      // Store env keys locally so AI module can use them
      if (envKeys.groq) {
        await this.setSetting('api_key_groq', envKeys.groq);
        // Set as active if no provider configured yet
        const currentProvider = await this.getSetting('ai_provider');
        if (!currentProvider) {
          await this.setSetting('ai_provider', 'groq');
          await this.setSetting('ai_api_key', envKeys.groq);
        }
      }
      if (envKeys.openrouter) {
        await this.setSetting('api_key_openrouter', envKeys.openrouter);
      }
      if (envKeys.gemini) {
        await this.setSetting('api_key_gemini', envKeys.gemini);
        const currentProvider = await this.getSetting('ai_provider');
        if (!currentProvider) {
          await this.setSetting('ai_provider', 'gemini');
          await this.setSetting('ai_api_key', envKeys.gemini);
        }
      }

      // Make sure the active provider's key is set
      const provider = await this.getSetting('ai_provider');
      if (provider && envKeys[provider]) {
        await this.setSetting('ai_api_key', envKeys[provider]);
      }

      console.log('[Sync] Loaded API keys from server env vars');
    } catch (error) {
      console.warn('[Sync] Failed to load env API keys:', error.message);
    }
  }

  /**
   * Pull state from server and merge into local IndexedDB.
   * Server is the SOURCE OF TRUTH for all settings.
   */
  async syncFromServer() {
    try {
      const response = await fetch('/api/newshunt/sync');
      if (!response.ok) return;
      const serverData = await response.json();

      // Merge article state
      if (serverData.articles && typeof serverData.articles === 'object') {
        const localArticles = await this.getAllArticles();
        const localMap = new Map(localArticles.map(a => [a.guid, a]));

        for (const [guid, serverState] of Object.entries(serverData.articles)) {
          const local = localMap.get(guid);
          if (local) {
            let changed = false;
            if (serverState.isRead && !local.isRead) {
              local.isRead = true;
              local.readAt = serverState.readAt || Date.now();
              changed = true;
            }
            if (serverState.ratedAt && (!local.ratedAt || serverState.ratedAt > local.ratedAt)) {
              local.stars = serverState.stars;
              local.ratingReason = serverState.ratingReason;
              local.ratedAt = serverState.ratedAt;
              changed = true;
            }
            if (changed) {
              const store = this._tx('articles', 'readwrite');
              await this._request(store, 'put', local);
            }
          }
        }
      }

      // Merge feeds (server → local, add missing ones)
      if (Array.isArray(serverData.feeds) && serverData.feeds.length > 0) {
        const localFeeds = await this.getAllFeeds();
        const localUrls = new Set(localFeeds.map(f => f.url));
        for (const feed of serverData.feeds) {
          if (!localUrls.has(feed.url)) {
            await this.addFeed(feed.url, feed.name || '');
          }
        }
      }

      // Settings: server OVERRIDES local (server is source of truth)
      if (serverData.settings && typeof serverData.settings === 'object') {
        for (const [key, value] of Object.entries(serverData.settings)) {
          await this.setSetting(key, value);
        }
      }

      console.log('[Sync] Pulled state from server');
    } catch (error) {
      console.warn('[Sync] Failed to pull from server (offline?):', error.message);
    }
  }

  /**
   * Push local article state, feeds, and ALL settings to server.
   */
  async syncToServer() {
    try {
      const articles = await this.getAllArticles();
      const articleMap = {};
      for (const a of articles) {
        articleMap[a.guid] = {
          isRead: !!a.isRead,
          readAt: a.readAt || null,
          stars: a.stars ?? null,
          ratingReason: a.ratingReason || null,
          ratedAt: a.ratedAt || null
        };
      }

      const feeds = await this.getAllFeeds();
      const allSettings = await this.getAllSettings();

      await fetch('/api/newshunt/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: articleMap, feeds, settings: allSettings })
      });

      console.log('[Sync] Pushed state to server');
    } catch (error) {
      console.warn('[Sync] Failed to push to server (offline?):', error.message);
    }
  }

  /**
   * Push a single setting to the server immediately.
   */
  async syncSetting(key, value) {
    fetch('/api/newshunt/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    }).catch(err => console.warn('[Sync] Setting sync failed:', err.message));
  }

  /**
   * Mark read locally AND fire a quick server call.
   */
  async markReadAndSync(guid) {
    await this.markRead(guid);
    fetch('/api/newshunt/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guid })
    }).catch(err => console.warn('[Sync] mark-read failed:', err.message));
  }

  /**
   * Save feed list to server.
   */
  async syncFeeds() {
    try {
      const feeds = await this.getAllFeeds();
      await fetch('/api/newshunt/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeds })
      });
    } catch (error) {
      console.warn('[Sync] Failed to sync feeds:', error.message);
    }
  }
}

// Global instance
const db = new NewsHuntDB();


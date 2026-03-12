// ============================================
// NewsHunt - IndexedDB Data Layer
// ============================================

const DB_NAME = 'newshunt_db';
const DB_VERSION = 1;
const SERVER_SYNC_DEBOUNCE_MS = 500;

class NewsHuntDB {
  constructor() {
    this.db = null;
    this.isApplyingServerState = false;
    this.syncTimer = null;
    this.syncInFlight = null;
    this.pendingSync = false;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('feeds')) {
          db.createObjectStore('feeds', { keyPath: 'url' });
        }

        if (!db.objectStoreNames.contains('articles')) {
          const articleStore = db.createObjectStore('articles', { keyPath: 'guid' });
          articleStore.createIndex('feedUrl', 'feedUrl', { unique: false });
          articleStore.createIndex('stars', 'stars', { unique: false });
          articleStore.createIndex('isRead', 'isRead', { unique: false });
          articleStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('chat_history')) {
          const chatStore = db.createObjectStore('chat_history', { keyPath: 'id', autoIncrement: true });
          chatStore.createIndex('articleGuid', 'articleGuid', { unique: false });
        }

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

  _queueServerSync(delay = SERVER_SYNC_DEBOUNCE_MS) {
    if (this.isApplyingServerState) return;

    this.pendingSync = true;
    if (this.syncTimer) clearTimeout(this.syncTimer);

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.syncToServer();
    }, delay);
  }

  async _replaceStore(storeName, records) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      store.clear();
      records.forEach(record => store.put(record));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error(`Failed to replace ${storeName}`));
    });
  }

  async _clearStore(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error(`Failed to clear ${storeName}`));
    });
  }

  async _buildSyncPayload() {
    const articles = await this.getAllArticles();
    const feeds = await this.getAllFeeds();
    const settings = await this.getAllSettings();
    const articleMap = {};

    articles.forEach(article => {
      if (article?.guid) {
        articleMap[article.guid] = article;
      }
    });

    return { articles: articleMap, feeds, settings };
  }

  // ============================================
  // Feeds
  // ============================================
  async addFeed(url, name = '', options = {}) {
    const store = this._tx('feeds', 'readwrite');
    const result = await this._request(store, 'put', { url, name, addedAt: Date.now() });
    if (!options.skipSync) this._queueServerSync();
    return result;
  }

  async removeFeed(url, options = {}) {
    const store = this._tx('feeds', 'readwrite');
    const result = await this._request(store, 'delete', url);
    if (!options.skipSync) this._queueServerSync();
    return result;
  }

  async getAllFeeds() {
    const store = this._tx('feeds');
    return this._request(store, 'getAll');
  }

  // ============================================
  // Articles
  // ============================================
  async addArticle(article, options = {}) {
    const store = this._tx('articles', 'readwrite');
    const result = await this._request(store, 'put', article);
    if (!options.skipSync) this._queueServerSync();
    return result;
  }

  async addArticles(articles, options = {}) {
    if (!Array.isArray(articles) || articles.length === 0) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('articles', 'readwrite');
      const store = tx.objectStore('articles');
      articles.forEach(article => store.put(article));
      tx.oncomplete = () => {
        if (!options.skipSync) this._queueServerSync();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Failed to add articles'));
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
    return articles.filter(article => !article.isRead);
  }

  async getReadArticles() {
    const articles = await this.getAllArticles();
    return articles.filter(article => article.isRead);
  }

  async getArticlesByStars(stars) {
    const articles = await this.getAllArticles();
    return articles.filter(article => article.stars === stars && !article.isRead);
  }

  async getUncategorizedArticles() {
    const articles = await this.getAllArticles();
    return articles.filter(article => article.stars === undefined || article.stars === null);
  }

  async markRead(guid, options = {}) {
    const article = await this.getArticle(guid);
    if (!article) return null;

    article.isRead = true;
    article.readAt = Date.now();
    const store = this._tx('articles', 'readwrite');
    const result = await this._request(store, 'put', article);
    if (!options.skipSync) this._queueServerSync();
    return result;
  }

  async updateArticleStars(guid, stars, reason, options = {}) {
    const article = await this.getArticle(guid);
    if (!article) return null;

    article.stars = stars;
    article.ratingReason = reason;
    article.ratedAt = Date.now();
    const store = this._tx('articles', 'readwrite');
    const result = await this._request(store, 'put', article);
    if (!options.skipSync) this._queueServerSync();
    return result;
  }

  async resetAllRatings(options = {}) {
    const articles = await this.getAllArticles();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('articles', 'readwrite');
      const store = tx.objectStore('articles');

      articles.forEach(article => {
        article.stars = null;
        article.ratingReason = null;
        article.ratedAt = null;
        store.put(article);
      });

      tx.oncomplete = () => {
        if (!options.skipSync) this._queueServerSync();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Failed to reset ratings'));
    });
  }

  async deleteArticlesByFeed(feedUrl, options = {}) {
    const articles = await this.getAllArticles();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('articles', 'readwrite');
      const store = tx.objectStore('articles');

      articles
        .filter(article => article.feedUrl === feedUrl)
        .forEach(article => store.delete(article.guid));

      tx.oncomplete = () => {
        if (!options.skipSync) this._queueServerSync();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Failed to delete feed articles'));
    });
  }

  async purgeOldArticles(maxAgeDays = 3, options = {}) {
    const articles = await this.getAllArticles();
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const oldArticles = articles.filter(article => {
      const articleDate = new Date(article.pubDate || article.dateAdded || 0).getTime();
      return articleDate < cutoff;
    });

    if (oldArticles.length === 0) return 0;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['articles', 'article_content'], 'readwrite');
      const articleStore = tx.objectStore('articles');
      const contentStore = tx.objectStore('article_content');

      oldArticles.forEach(article => {
        articleStore.delete(article.guid);
        contentStore.delete(article.guid);
      });

      tx.oncomplete = () => {
        if (!options.skipSync) this._queueServerSync();
        resolve(oldArticles.length);
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Failed to purge old articles'));
    });
  }

  // ============================================
  // Settings
  // ============================================
  async setSetting(key, value, options = {}) {
    const store = this._tx('settings', 'readwrite');
    const result = await this._request(store, 'put', { key, value });
    if (!options.skipSync) this._queueServerSync();
    return result;
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
    items.forEach(item => {
      settings[item.key] = item.value;
    });
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

  async clearArticleContent() {
    await this._clearStore('article_content');
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

    const store = this._tx('articles', 'readwrite');
    const result = await this._request(store, 'put', article);
    if (!options.skipSync) this._queueServerSync();
    return result;
  }

  async updateArticleTopics(guid, topics, options = {}) {
    const article = await this.getArticle(guid);
    if (!article) return null;

    article.topics = topics;

    const store = this._tx('articles', 'readwrite');
    const result = await this._request(store, 'put', article);
    if (!options.skipSync) this._queueServerSync();
    return result;
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
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['feeds', 'articles', 'settings', 'chat_history', 'article_content'], 'readwrite');
      ['feeds', 'articles', 'settings', 'chat_history', 'article_content'].forEach(storeName => {
        tx.objectStore(storeName).clear();
      });

      tx.oncomplete = () => {
        if (!options.skipSync) this._queueServerSync();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Failed to clear local data'));
    });
  }

  // ============================================
  // Server Sync
  // ============================================
  async loadEnvApiKeys() {
    try {
      const response = await fetch('/api/newshunt/ai-config');
      if (!response.ok) return;
      const envKeys = await response.json();

      if (envKeys.groq) {
        await this.setSetting('api_key_groq', envKeys.groq, { skipSync: true });
        const currentProvider = await this.getSetting('ai_provider');
        if (!currentProvider) {
          await this.setSetting('ai_provider', 'groq', { skipSync: true });
          await this.setSetting('ai_api_key', envKeys.groq, { skipSync: true });
        }
      }

      if (envKeys.openrouter) {
        await this.setSetting('api_key_openrouter', envKeys.openrouter, { skipSync: true });
      }

      if (envKeys.gemini) {
        await this.setSetting('api_key_gemini', envKeys.gemini, { skipSync: true });
        const currentProvider = await this.getSetting('ai_provider');
        if (!currentProvider) {
          await this.setSetting('ai_provider', 'gemini', { skipSync: true });
          await this.setSetting('ai_api_key', envKeys.gemini, { skipSync: true });
        }
      }

      const provider = await this.getSetting('ai_provider');
      if (provider && envKeys[provider]) {
        await this.setSetting('ai_api_key', envKeys[provider], { skipSync: true });
      }

      console.log('[Sync] Loaded API keys from server env vars');
    } catch (error) {
      console.warn('[Sync] Failed to load env API keys:', error.message);
    }
  }

  async syncFromServer() {
    try {
      const response = await fetch('/api/newshunt/sync');
      if (!response.ok) return false;

      const serverData = await response.json();
      const settings = serverData.settings && typeof serverData.settings === 'object'
        ? Object.entries(serverData.settings).map(([key, value]) => ({ key, value }))
        : [];
      const feeds = Array.isArray(serverData.feeds) ? serverData.feeds : [];
      const articles = serverData.articles && typeof serverData.articles === 'object'
        ? Object.entries(serverData.articles).map(([guid, article]) => ({
          ...article,
          guid: article.guid || guid,
          dateAdded: article.dateAdded || new Date().toISOString()
        }))
        : [];

      this.isApplyingServerState = true;
      await this._replaceStore('settings', settings);
      await this._replaceStore('feeds', feeds);
      await this._replaceStore('articles', articles);

      console.log('[Sync] Pulled complete state from server');
      return true;
    } catch (error) {
      console.warn('[Sync] Failed to pull from server (offline?):', error.message);
      return false;
    } finally {
      this.isApplyingServerState = false;
    }
  }

  async syncToServer() {
    if (this.isApplyingServerState) return false;

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.syncInFlight) {
      this.pendingSync = true;
      return this.syncInFlight;
    }

    this.pendingSync = false;

    const syncJob = (async () => {
      const payload = await this._buildSyncPayload();
      const response = await fetch('/api/newshunt/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      console.log('[Sync] Pushed complete state to server');
      return true;
    })();

    this.syncInFlight = syncJob;

    try {
      return await syncJob;
    } catch (error) {
      console.warn('[Sync] Failed to push to server (offline?):', error.message);
      this.pendingSync = true;
      if (!this.syncTimer) this._queueServerSync(5000);
      return false;
    } finally {
      this.syncInFlight = null;
      if (this.pendingSync && !this.syncTimer && !this.isApplyingServerState) {
        this._queueServerSync();
      }
    }
  }

  async syncSetting(key, value) {
    try {
      const response = await fetch('/api/newshunt/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error) {
      console.warn('[Sync] Setting sync failed:', error.message);
      this._queueServerSync();
    }
  }

  async markReadAndSync(guid) {
    await this.markRead(guid, { skipSync: true });
    this.syncToServer();
    return true;
  }

  async syncFeeds() {
    return this.syncToServer();
  }
}

// Global instance
const db = new NewsHuntDB();

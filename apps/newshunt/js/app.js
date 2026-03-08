// ============================================
// NewsHunt — Main Application Controller
// ============================================

const App = {
    currentView: 'feed',
    currentFilter: '5',
    searchQuery: '',
    isRefreshing: false,

    // Initialize the application
    async init() {
        // Initialize database
        await db.init();

        // Sync state from server (cross-device persistence)
        await db.syncFromServer();

        // Load API keys from server environment variables (Render secrets)
        await db.loadEnvApiKeys();

        // Auto-purge articles older than 3 days
        const purged = await db.purgeOldArticles(3);
        if (purged > 0) console.log(`Auto-purged ${purged} old articles (>3 days)`);

        // Load theme
        const theme = await db.getSetting('theme');
        if (theme) document.documentElement.dataset.theme = theme;

        // Set up navigation
        this._setupNavigation();

        // Load initial view
        await this.navigate('feed');

        // Update stats
        await this._updateStats();
    },

    // Navigation setup
    _setupNavigation() {
        document.querySelectorAll('[data-view]').forEach(el => {
            el.addEventListener('click', () => {
                const view = el.dataset.view;
                this.navigate(view);
            });
        });
    },

    // Navigate to a view
    async navigate(viewName) {
        // Close chat panel if open
        Chat.close();

        // Remove reader floating nav if it exists
        Reader._removeFloatingNav();

        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));

        // Show target view
        const viewEl = document.getElementById(`${viewName}-view`);
        if (viewEl) {
            viewEl.classList.add('view--active');
        }

        // Update nav active state
        document.querySelectorAll('[data-view]').forEach(el => {
            el.classList.toggle('sidebar__nav-item--active', el.dataset.view === viewName);
        });

        this.currentView = viewName;

        // Render view content
        switch (viewName) {
            case 'feed':
                await this.renderFeedView();
                break;
            case 'read':
                await this.renderReadView();
                break;
            case 'topics':
                await this.renderTopicsView();
                break;
            case 'settings':
                await Settings.render();
                break;
        }

        // Close mobile sidebar
        document.querySelector('.sidebar')?.classList.remove('sidebar--open');
    },

    // Render the Feed view (main view with unread articles)
    async renderFeedView() {
        const view = document.getElementById('feed-view');
        const articles = await db.getUnreadArticles();
        const feeds = await db.getAllFeeds();

        // Sort articles: starred first (5 -> 1), then by date
        articles.sort((a, b) => {
            if (a.stars !== b.stars) return (b.stars || 0) - (a.stars || 0);
            return new Date(b.pubDate || b.dateAdded) - new Date(a.pubDate || a.dateAdded);
        });

        // Filter out grouped duplicates (exact same story)
        const deduped = articles.filter(a => {
            if (!a.groupId) return true;
            return a.isGroupPrimary;
        });

        // Filter by star rating
        let filtered = deduped;

        // Apply search filter FIRST if there's a query
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(a => {
                const title = (a.title || '').toLowerCase();
                const desc = (a.description || '').toLowerCase();
                const source = (a.feedTitle || '').toLowerCase();
                const reason = (a.ratingReason || '').toLowerCase();
                const topics = (a.topics || []).join(' ').toLowerCase();
                return title.includes(q) || desc.includes(q) || source.includes(q) || reason.includes(q) || topics.includes(q);
            });
        } else if (this.currentFilter === 'uncategorized') {
            filtered = deduped.filter(a => !a.stars);
        } else if (this.currentFilter !== 'all') {
            const starVal = parseInt(this.currentFilter);
            if (!isNaN(starVal)) {
                filtered = deduped.filter(a => a.stars === starVal);
            }
        }

        // STRICT TOPIC DEDUPLICATION:
        // Ensure the feed shows only completely distinct topics.
        // Because the array is already sorted by importance (stars -> date),
        // the first article we see for a topic is the "most important".
        const seenTopics = new Set();
        const strictFiltered = [];

        for (const article of filtered) {
            if (!article.topics || article.topics.length === 0) {
                strictFiltered.push(article);
                continue;
            }

            // Check if any of this article's topic tags have already been shown
            const hasSeenTopic = article.topics.some(t => seenTopics.has(t));

            if (!hasSeenTopic) {
                strictFiltered.push(article);
                // Mark these topics as seen so subsequent articles with these topics are hidden side
                article.topics.forEach(t => seenTopics.add(t));
            }
        }

        // Use the strictly deduplicated list for rendering
        filtered = strictFiltered;

        // Count per star (Use the original deduped list for the tabs so counts reflect total unread)
        const counts = { all: deduped.length, uncategorized: 0 };
        for (let i = 1; i <= 5; i++) counts[i] = 0;
        deduped.forEach(a => {
            if (a.stars) counts[a.stars]++;
            else counts.uncategorized++;
        });

        view.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'feed-header';
        header.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-header__title">Your Feed</h1>
          <p class="section-header__subtitle">${articles.length} articles to read</p>
        </div>
      </div>
      <div class="feed-search">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="feed-search-input" 
            placeholder="Search articles by title, topic, source..." 
            value="${Utils.escapeHtml(this.searchQuery)}" 
            oninput="App.onSearchInput(this.value)">
          ${this.searchQuery ? '<button class="search-clear" onclick="App.clearSearch()">✕</button>' : ''}
        </div>
      </div>
      <div class="stats-bar">
        ${[5, 4, 3, 2, 1].map(s => `
          <div class="stat-item" style="cursor:pointer" onclick="App.currentFilter='${s}';App.renderFeedView()">
            <span class="stat-item__value" style="color: var(--color-star-${s})">${counts[s] || 0}</span>
            <span class="stat-item__label">${'★'.repeat(s)} Stars</span>
          </div>
        `).join('')}
      </div>
      <div class="feed-actions">
        <button class="btn btn--primary" onclick="App.refreshFeeds()" id="refresh-btn">
          ${this.isRefreshing ? '<span class="spinner"></span>' : '🔄'} Refresh Feeds
        </button>
        <button class="btn btn--secondary" onclick="App.categorizeNew()">🏷️ Categorize New</button>
      </div>
    `;
        view.appendChild(header);

        // Star filter tabs
        const tabs = Components.createStarTabs(this.currentFilter, (filter) => {
            this.currentFilter = filter;
            this.renderFeedView();
        });
        view.appendChild(tabs);

        // Articles or empty state
        if (filtered.length === 0) {
            if (feeds.length === 0) {
                const goSettings = document.createElement('button');
                goSettings.className = 'btn btn--primary';
                goSettings.textContent = 'Add RSS Feeds';
                goSettings.onclick = () => this.navigate('settings');
                view.appendChild(Components.createEmptyState('📡', 'No Feeds Added', 'Go to Settings to add RSS feed URLs', goSettings));
            } else if (articles.length === 0) {
                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'btn btn--primary';
                refreshBtn.textContent = 'Refresh Feeds';
                refreshBtn.onclick = () => this.refreshFeeds();
                view.appendChild(Components.createEmptyState('📰', 'No Articles Yet', 'Click Refresh to fetch articles from your feeds', refreshBtn));
            } else {
                view.appendChild(Components.createEmptyState('🔍', 'No Articles Match', `No ${this.currentFilter === 'uncategorized' ? 'uncategorized' : this.currentFilter + '★'} articles found`));
            }
        } else {
            const grid = document.createElement('div');
            grid.className = 'article-grid';
            grid.style.marginTop = 'var(--space-4)';
            filtered.forEach(article => {
                const card = Components.createArticleCard(article);
                // Show related count badge if this is a group primary
                if (article.isGroupPrimary && article.relatedCount > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'article-card__group-badge';
                    badge.textContent = `+${article.relatedCount} related`;
                    badge.title = article.groupLabel || 'Similar articles grouped';
                    badge.onclick = (e) => { e.stopPropagation(); App.showGroupedArticles(article.guid, article.groupLabel); };
                    card.querySelector('.article-card__meta')?.appendChild(badge);
                }
                // Show topic tags
                if (article.topics && article.topics.length > 0) {
                    const tagsEl = document.createElement('div');
                    tagsEl.className = 'article-card__topics';
                    article.topics.forEach(t => {
                        const tag = document.createElement('span');
                        tag.className = 'topic-tag topic-tag--small';
                        tag.textContent = t;
                        tag.onclick = (e) => { e.stopPropagation(); App.navigate('topics'); setTimeout(() => App.filterByTopic(t), 100); };
                        tagsEl.appendChild(tag);
                    });
                    card.appendChild(tagsEl);
                }
                grid.appendChild(card);
            });
            view.appendChild(grid);
        }

        this.currentFeedList = filtered; // Save for Reader navigation
        await this._updateStats();
    },

    // Render the Read view (already read articles)
    async renderReadView() {
        const view = document.getElementById('read-view');
        const articles = await db.getReadArticles();

        // Sort by read time (most recent first)
        articles.sort((a, b) => (b.readAt || 0) - (a.readAt || 0));

        view.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-header__title">Read Articles</h1>
          <p class="section-header__subtitle">${articles.length} articles you've read</p>
        </div>
      </div>
    `;

        if (articles.length === 0) {
            view.appendChild(Components.createEmptyState('📚', 'No Read Articles', 'Articles you open from your feed will appear here'));
        } else {
            const grid = document.createElement('div');
            grid.className = 'article-grid';
            articles.forEach(article => {
                grid.appendChild(Components.createArticleCard(article));
            });
            view.appendChild(grid);
        }
    },

    // Refresh feeds: fetch new articles
    async refreshFeeds() {
        if (this.isRefreshing) return;

        const feeds = await db.getAllFeeds();
        if (feeds.length === 0) {
            Components.showToast('No feeds configured. Go to Settings to add feeds.', 'warning');
            return;
        }

        this.isRefreshing = true;
        const btn = document.getElementById('refresh-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Refreshing...';
        }

        Components.showToast(`Fetching ${feeds.length} feeds...`, 'info');

        try {
            const { newArticles, totalFetched, errors } = await RSS.fetchAllFeeds(feeds);

            // Save new articles to DB
            if (newArticles.length > 0) {
                await db.addArticles(newArticles);
                Components.showToast(`Found ${newArticles.length} new articles!`, 'success');
            } else {
                Components.showToast('No new articles found', 'info');
            }

            // Purge stale articles (>3 days old)
            const purged = await db.purgeOldArticles(3);
            if (purged > 0) Components.showToast(`Cleaned up ${purged} old articles`, 'info');

            if (errors.length > 0) {
                errors.forEach(err => {
                    Components.showToast(`Feed error (${Utils.extractDomain(err.url)}): ${err.error}`, 'warning', 6000);
                });
            }

            // Refresh the view
            await this.renderFeedView();

            // Push state to server for cross-device sync
            db.syncToServer();

        } catch (error) {
            Components.showToast(`Error refreshing feeds: ${error.message}`, 'error');
        } finally {
            this.isRefreshing = false;
            const btn2 = document.getElementById('refresh-btn');
            if (btn2) {
                btn2.disabled = false;
                btn2.innerHTML = '🔄 Refresh Feeds';
            }
        }
    },

    // Categorize uncategorized articles
    async categorizeNew() {
        const configured = await AI.isConfigured();
        if (!configured) {
            Components.showToast('Please configure AI settings first', 'warning');
            this.navigate('settings');
            return;
        }

        const uncategorized = await db.getUncategorizedArticles();
        if (uncategorized.length === 0) {
            Components.showToast('All articles are already categorized!', 'info');
            return;
        }

        Components.showToast(`Categorizing ${uncategorized.length} articles...`, 'info');

        try {
            // PASS 1: Star ratings
            const result = await Categorizer.categorizeAll((progress) => {
                if (progress.error) {
                    Components.showToast(`Rating batch ${progress.batch} error: ${progress.error}`, 'warning', 3000);
                }
            });

            Components.showToast(`Rated ${result.categorized} articles. Now grouping & tagging...`, 'success');
            await this.renderFeedView();

            // PASS 2: Group similar stories + assign topics
            const groupResult = await Categorizer.groupAndTag((progress) => {
                if (progress.error) {
                    Components.showToast(`Grouping batch ${progress.batch} error: ${progress.error}`, 'warning', 3000);
                }
            });

            Components.showToast(`Done! Grouped ${groupResult.grouped} duplicates, tagged ${groupResult.tagged} articles`, 'success');
            await this.renderFeedView();

        } catch (error) {
            Components.showToast(`Categorization error: ${error.message}`, 'error');
        }
    },

    // Open the reader for an article
    async openReader(guid) {
        // Show reader view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
        document.getElementById('reader-view').classList.add('view--active');

        // Update nav
        document.querySelectorAll('[data-view]').forEach(el => {
            el.classList.remove('sidebar__nav-item--active');
        });

        this.currentView = 'reader';
        await Reader.open(guid);
    },

    // Manually flag an article as irrelevant (1 star)
    async flagArticle(guid) {
        try {
            await db.updateArticleStars(guid, 1, 'Manually flagged as irrelevant by user.');
            // Sync to server
            db.syncToServer();
            Components.showToast('Article flagged as irrelevant (Moved to 1-star)', 'info');
            if (this.currentView === 'feed') {
                this.renderFeedView();
            }
        } catch (error) {
            console.error('Error flagging article:', error);
            Components.showToast('Failed to flag article', 'error');
        }
    },

    // Refresh the feed view silently
    async refreshFeedView() {
        if (this.currentView === 'feed') {
            await this.renderFeedView();
        }
    },

    // Update navigation badges
    async _updateStats() {
        const unread = await db.getUnreadArticles();
        const read = await db.getReadArticles();

        Components.updateNavBadge('feed', unread.length);
        Components.updateNavBadge('read', read.length);
    },

    // ============================================
    // Topics View
    // ============================================
    topicFilter: null,

    async renderTopicsView() {
        const view = document.getElementById('topics-view');
        const topics = await db.getAllTopics();

        view.innerHTML = `
          <div class="section-header">
            <div>
              <h1 class="section-header__title">🏷️ Topics</h1>
              <p class="section-header__subtitle">${topics.length} topics discovered</p>
            </div>
          </div>
        `;

        if (topics.length === 0) {
            view.appendChild(Components.createEmptyState('🏷️', 'No Topics Yet', 'Categorize your articles first — topics are assigned automatically during categorization.'));
            return;
        }

        // Topic cloud
        const cloud = document.createElement('div');
        cloud.className = 'topics-cloud';
        topics.forEach(topic => {
            const chip = document.createElement('button');
            chip.className = 'topic-chip' + (this.topicFilter === topic.name ? ' topic-chip--active' : '');
            chip.innerHTML = `<span class="topic-chip__name">${topic.name}</span><span class="topic-chip__count">${topic.count}</span>`;
            chip.onclick = () => this.filterByTopic(topic.name);
            cloud.appendChild(chip);
        });

        // Reset button
        if (this.topicFilter) {
            const resetBtn = document.createElement('button');
            resetBtn.className = 'topic-chip topic-chip--reset';
            resetBtn.textContent = '✕ Clear filter';
            resetBtn.onclick = () => { this.topicFilter = null; this.renderTopicsView(); };
            cloud.prepend(resetBtn);
        }

        view.appendChild(cloud);

        // Show filtered articles if a topic is selected
        if (this.topicFilter) {
            const articles = await db.getArticlesByTopic(this.topicFilter);
            articles.sort((a, b) => (b.stars || 0) - (a.stars || 0));

            const heading = document.createElement('h2');
            heading.className = 'topics-filter-heading';
            heading.textContent = `${this.topicFilter} — ${articles.length} articles`;
            view.appendChild(heading);

            const grid = document.createElement('div');
            grid.className = 'article-grid';
            articles.forEach(article => {
                grid.appendChild(Components.createArticleCard(article));
            });
            view.appendChild(grid);
        }
    },

    filterByTopic(topicName) {
        this.topicFilter = topicName;
        if (this.currentView === 'topics') {
            this.renderTopicsView();
        } else {
            this.navigate('topics');
        }
    },

    // Show grouped/related articles in a modal-like view
    async showGroupedArticles(primaryGuid, groupLabel) {
        const related = await db.getGroupedArticles(primaryGuid);
        if (related.length === 0) {
            Components.showToast('No related articles found', 'info');
            return;
        }

        // Create a modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'modal-content';
        modal.innerHTML = `
          <div class="modal-header">
            <h2>📰 ${groupLabel || 'Related Articles'}</h2>
            <button class="btn btn--ghost" onclick="this.closest('.modal-overlay').remove()">✕</button>
          </div>
          <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">${related.length} similar article${related.length > 1 ? 's' : ''} grouped together</p>
        `;

        const grid = document.createElement('div');
        grid.className = 'article-grid';
        related.forEach(article => {
            grid.appendChild(Components.createArticleCard(article));
        });
        modal.appendChild(grid);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    },

    // Search handler (debounced)
    _searchTimer: null,
    onSearchInput(value) {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
            this.searchQuery = value.trim();
            this.renderFeedView().then(() => {
                // Re-focus the input and restore cursor position
                const input = document.getElementById('feed-search-input');
                if (input) {
                    input.focus();
                    input.selectionStart = input.selectionEnd = input.value.length;
                }
            });
        }, 250);
    },

    clearSearch() {
        this.searchQuery = '';
        this.renderFeedView();
    },

    // Toggle mobile sidebar
    toggleSidebar() {
        document.querySelector('.sidebar')?.classList.toggle('sidebar--open');
    }
};

// ============================================
// Initialize on DOM ready
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    App.init().catch(err => {
        console.error('App init error:', err);
        Components.showToast('Failed to initialize app', 'error');
    });
});

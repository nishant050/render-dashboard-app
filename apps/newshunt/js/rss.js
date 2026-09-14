// ============================================
// NewsHunt — RSS Feed Fetcher & Parser
// ============================================

// Local proxy — runs alongside the app via server.js
async function fetchViaProxy(targetUrl) {
    const proxyUrl = '/proxy?url=' + encodeURIComponent(targetUrl);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || `Proxy error: HTTP ${response.status}`);
    }
    return await response.text();
}

const RSS = {
    // Fetch and parse a single RSS feed
    async fetchFeed(feedUrl) {
        try {
            const xmlText = await fetchViaProxy(feedUrl);

            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');

            // Check for parse errors
            const parseError = doc.querySelector('parsererror');
            if (parseError) throw new Error('Invalid RSS XML');

            // Detect feed type (RSS 2.0 vs Atom)
            const isAtom = doc.querySelector('feed');
            const feedTitle = isAtom
                ? (doc.querySelector('feed > title')?.textContent || '')
                : (doc.querySelector('channel > title')?.textContent || '');

            const items = isAtom
                ? this._parseAtom(doc, feedUrl, feedTitle)
                : this._parseRSS(doc, feedUrl, feedTitle);

            return { items, feedTitle, feedUrl };
        } catch (error) {
            console.error(`Error fetching feed ${feedUrl}:`, error);
            return { items: [], feedTitle: '', feedUrl, error: error.message };
        }
    },

    // Parse RSS 2.0
    _parseRSS(doc, feedUrl, feedTitle) {
        const items = [];
        doc.querySelectorAll('item').forEach(item => {
            const title = item.querySelector('title')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const description = Utils.stripHtml(
                item.querySelector('description')?.textContent ||
                item.querySelector('content\\:encoded, encoded')?.textContent || ''
            );
            const pubDate = Utils.normalizeDateString(item.querySelector('pubDate')?.textContent || '');
            const guid = item.querySelector('guid')?.textContent || link || Utils.hashString(title + link);
            const creator = item.querySelector('dc\\:creator, creator')?.textContent || '';
            const categories = [];
            item.querySelectorAll('category').forEach(cat => {
                categories.push(cat.textContent);
            });

            // Try to extract image
            let image = '';
            const enclosure = item.querySelector('enclosure[type^="image"]');
            if (enclosure) {
                image = enclosure.getAttribute('url') || '';
            }
            const mediaThumbnail = item.querySelector('media\\:thumbnail, thumbnail');
            if (!image && mediaThumbnail) {
                image = mediaThumbnail.getAttribute('url') || '';
            }
            const mediaContent = item.querySelector('media\\:content[medium="image"], content[medium="image"]');
            if (!image && mediaContent) {
                image = mediaContent.getAttribute('url') || '';
            }

            items.push({
                guid: Utils.hashString(guid),
                title: title.trim(),
                link: link.trim(),
                description: Utils.truncate(description, 500),
                pubDate,
                feedUrl,
                feedTitle,
                creator,
                categories,
                image,
                dateAdded: Date.now(),
                isRead: false,
                stars: null,
                ratingReason: null
            });
        });
        return items;
    },

    // Parse Atom
    _parseAtom(doc, feedUrl, feedTitle) {
        const items = [];
        doc.querySelectorAll('entry').forEach(entry => {
            const title = entry.querySelector('title')?.textContent || '';
            const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
            const link = linkEl?.getAttribute('href') || '';
            const summary = Utils.stripHtml(
                entry.querySelector('summary')?.textContent ||
                entry.querySelector('content')?.textContent || ''
            );
            const published = Utils.normalizeDateString(entry.querySelector('published')?.textContent ||
                entry.querySelector('updated')?.textContent || '');
            const id = entry.querySelector('id')?.textContent || link;
            const author = entry.querySelector('author > name')?.textContent || '';
            const categories = [];
            entry.querySelectorAll('category').forEach(cat => {
                categories.push(cat.getAttribute('term') || cat.textContent);
            });

            items.push({
                guid: Utils.hashString(id || title + link),
                title: title.trim(),
                link: link.trim(),
                description: Utils.truncate(summary, 500),
                pubDate: published,
                feedUrl,
                feedTitle,
                creator: author,
                categories,
                image: '',
                dateAdded: Date.now(),
                isRead: false,
                stars: null,
                ratingReason: null
            });
        });
        return items;
    },

    // Fetch all feeds and return only new articles
    async fetchAllFeeds(feeds) {
        const allItems = [];
        const errors = [];

        const results = await Promise.allSettled(
            feeds.map(feed => this.fetchFeed(feed.url))
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                if (result.value.error) {
                    errors.push({ url: result.value.feedUrl, error: result.value.error });
                }
                allItems.push(...result.value.items);
            }
        }

        // Deduplicate by guid
        const uniqueMap = new Map();
        allItems.forEach(item => {
            if (!uniqueMap.has(item.guid)) {
                uniqueMap.set(item.guid, item);
            }
        });

        // Filter out articles already in DB
        const existingArticles = await db.getAllArticles();
        const existingGuids = new Set(existingArticles.map(a => a.guid));
        const newArticles = [...uniqueMap.values()].filter(a => !existingGuids.has(a.guid));

        return { newArticles, totalFetched: uniqueMap.size, errors };
    },

    // Fetch article content from its original URL
    async fetchArticleContent(url) {
        try {
            const htmlText = await fetchViaProxy(url);

            // Extract main text content from HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');

            // Remove scripts, styles, nav, footer, etc.
            doc.querySelectorAll('script, style, nav, footer, header, aside, iframe, form, .ad, .ads, .advertisement, .sidebar, .menu, .nav, .footer, .header, .comment, .comments').forEach(el => el.remove());

            // Try to find article content
            const article = doc.querySelector('article') ||
                doc.querySelector('[role="main"]') ||
                doc.querySelector('.article-body') ||
                doc.querySelector('.post-content') ||
                doc.querySelector('.entry-content') ||
                doc.querySelector('.article-content') ||
                doc.querySelector('main') ||
                doc.body;

            if (article) {
                // Extract text content with some structure
                const paragraphs = [];
                article.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption').forEach(el => {
                    const text = el.textContent.trim();
                    if (text.length > 20) {
                        const tag = el.tagName.toLowerCase();
                        if (tag.startsWith('h')) {
                            paragraphs.push(`\n## ${text}\n`);
                        } else if (tag === 'blockquote') {
                            paragraphs.push(`> ${text}`);
                        } else if (tag === 'li') {
                            paragraphs.push(`- ${text}`);
                        } else {
                            paragraphs.push(text);
                        }
                    }
                });
                return paragraphs.join('\n\n');
            }

            return doc.body?.textContent?.trim() || '';
        } catch (error) {
            console.error('Error fetching article content:', error);
            return null;
        }
    }
};

// ============================================
// NewsHunt — Utility Functions
// ============================================

const Utils = {
    // Generate a stable GUID from a string (URL)
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return 'nh_' + Math.abs(hash).toString(36);
    },

    parseTimestamp(value) {
        if (value === null || value === undefined || value === '') return null;

        if (value instanceof Date) {
            const time = value.getTime();
            return Number.isFinite(time) ? time : null;
        }

        if (typeof value === 'number') {
            if (!Number.isFinite(value) || value <= 0) return null;
            return value < 10000000000 ? value * 1000 : value;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed || /^invalid date$/i.test(trimmed)) return null;

            if (/^\d+(\.\d+)?$/.test(trimmed)) {
                return this.parseTimestamp(Number(trimmed));
            }

            const parsed = Date.parse(trimmed);
            return Number.isFinite(parsed) ? parsed : null;
        }

        return null;
    },

    normalizeDateString(value) {
        const timestamp = this.parseTimestamp(value);
        return timestamp ? new Date(timestamp).toISOString() : '';
    },

    getArticleTimestamp(article) {
        if (!article) return null;
        return this.parseTimestamp(article.pubDate) || this.parseTimestamp(article.dateAdded);
    },

    formatArticleDate(article) {
        const timestamp = this.getArticleTimestamp(article);
        return timestamp ? this.formatDate(timestamp) : 'Unknown date';
    },

    // Format date relative to now
    formatDate(dateStr) {
        const timestamp = this.parseTimestamp(dateStr);
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMs >= 0) {
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
        }

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    },

    // Truncate text
    truncate(text, maxLength = 150) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '…';
    },

    // Strip HTML tags
    stripHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    },

    // Debounce
    debounce(fn, ms = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    },

    // Throttle
    throttle(fn, ms = 300) {
        let lastCall = 0;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall >= ms) {
                lastCall = now;
                fn(...args);
            }
        };
    },

    // Escape HTML for safe rendering
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Render markdown using marked.js
    renderMarkdown(md) {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
            // marked v12+ uses marked.parse with HTML allowed by default
            return marked.parse(md);
        }
        // Fallback: just wrap in <p>
        return `<p>${Utils.escapeHtml(md)}</p>`;
    },

    // Post-process rendered HTML to add classes and charts
    postProcessContent(container) {
        // Add classes to blockquotes containing key markers
        container.querySelectorAll('blockquote').forEach(bq => {
            const text = bq.textContent;
            if (text.includes('🔑') || text.includes('Key Fact')) {
                bq.classList.add('callout-key-fact');
            } else if (text.includes('📌') || text.includes('Remember')) {
                bq.classList.add('callout-remember');
            } else if (text.includes('📖') || text.includes('Term') || text.includes('Definition')) {
                bq.classList.add('callout-term');
            }
        });

        // Process Chart.js code blocks
        container.querySelectorAll('pre code').forEach(codeBlock => {
            const code = codeBlock.textContent.trim();
            if (code.startsWith('{') && code.includes('"type"') && (code.includes('"data"') || code.includes('"labels"'))) {
                try {
                    const config = JSON.parse(code);
                    if (config.type && config.data) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'reader__chart-container';
                        const canvas = document.createElement('canvas');
                        wrapper.appendChild(canvas);
                        codeBlock.closest('pre').replaceWith(wrapper);
                        new Chart(canvas, config);
                    }
                } catch (e) {
                    // Not a chart config, leave as code block
                }
            }
        });
    },

    // Generate stars display
    starsHtml(count) {
        return '★'.repeat(count) + '☆'.repeat(5 - count);
    },

    // Sleep for async flows
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Extract domain from URL
    extractDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    }
};

// ============================================
// NewsHunt - Sidebar Activity Terminal
// ============================================

const NewsTerminal = {
    STORAGE_KEY: 'newshunt_terminal_state_v1',
    MAX_ENTRIES: 400,
    state: {
        entries: [],
        isOpen: true,
        isExpanded: false,
        autoScroll: true,
        scrollTop: 0
    },
    elements: {},
    originalConsole: {},
    isConsolePatched: false,
    isErrorHooksPatched: false,

    init() {
        if (this.elements.root) return;

        this._restoreState();
        this._renderShell();
        this._bindEvents();
        this._renderEntries();
        this._patchConsole();
        this._bindGlobalErrorHooks();
        this.info('Activity terminal ready');
    },

    info(message, details) {
        this.log('info', message, details);
    },

    success(message, details) {
        this.log('success', message, details);
    },

    warn(message, details) {
        this.log('warning', message, details);
    },

    error(message, details) {
        this.log('error', message, details);
    },

    log(level, message, details) {
        const entry = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            level: this._normalizeLevel(level),
            message: this._stringifyMessage(message),
            details: this._stringifyDetails(details),
            timestamp: new Date().toISOString()
        };

        this.state.entries.push(entry);
        if (this.state.entries.length > this.MAX_ENTRIES) {
            this.state.entries = this.state.entries.slice(-this.MAX_ENTRIES);
        }

        this._persistState();
        this._renderEntries();
    },

    open() {
        if (!this.elements.root) return;
        this.state.isOpen = true;
        this.elements.root.classList.remove('sidebar-terminal--closed');
        this.elements.launcher.hidden = true;
        this._persistState();
        this._restoreScroll();
    },

    close() {
        if (!this.elements.root) return;
        this._captureScroll();
        this.state.isOpen = false;
        this.elements.root.classList.add('sidebar-terminal--closed');
        this.elements.launcher.hidden = false;
        this._persistState();
    },

    toggleExpanded() {
        if (!this.elements.root) return;
        this._captureScroll();
        this.state.isExpanded = !this.state.isExpanded;
        this.elements.root.classList.toggle('sidebar-terminal--expanded', this.state.isExpanded);
        this.elements.expand.textContent = this.state.isExpanded ? 'Collapse' : 'Expand';
        this._persistState();
        this._restoreScroll();
    },

    clear() {
        this.state.entries = [];
        this.state.autoScroll = true;
        this.state.scrollTop = 0;
        this._persistState();
        this._renderEntries();
    },

    _renderShell() {
        const sidebar = document.getElementById('sidebar');
        const footer = sidebar?.querySelector('.sidebar__footer');
        if (!sidebar || !footer) return;

        const wrapper = document.createElement('section');
        wrapper.className = 'sidebar-terminal-wrap';
        wrapper.innerHTML = `
            <div class="sidebar-terminal${this.state.isOpen ? '' : ' sidebar-terminal--closed'}${this.state.isExpanded ? ' sidebar-terminal--expanded' : ''}" id="sidebar-terminal">
                <div class="sidebar-terminal__header">
                    <div class="sidebar-terminal__heading">
                        <span class="sidebar-terminal__status-dot"></span>
                        <span>Background Activity</span>
                    </div>
                    <div class="sidebar-terminal__actions">
                        <button class="sidebar-terminal__action" type="button" data-terminal-action="clear">Clear</button>
                        <button class="sidebar-terminal__action" type="button" data-terminal-action="expand">${this.state.isExpanded ? 'Collapse' : 'Expand'}</button>
                        <button class="sidebar-terminal__action" type="button" data-terminal-action="close">Close</button>
                    </div>
                </div>
                <div class="sidebar-terminal__body" id="sidebar-terminal-body" aria-live="polite"></div>
            </div>
            <button class="sidebar-terminal__launcher" id="sidebar-terminal-launcher" type="button"${this.state.isOpen ? ' hidden' : ''}>
                Show Background Activity
            </button>
        `;

        sidebar.insertBefore(wrapper, footer);

        this.elements.root = document.getElementById('sidebar-terminal');
        this.elements.body = document.getElementById('sidebar-terminal-body');
        this.elements.launcher = document.getElementById('sidebar-terminal-launcher');
        this.elements.expand = this.elements.root.querySelector('[data-terminal-action="expand"]');
    },

    _bindEvents() {
        this.elements.root?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-terminal-action]');
            if (!button) return;

            const action = button.dataset.terminalAction;
            if (action === 'clear') this.clear();
            if (action === 'expand') this.toggleExpanded();
            if (action === 'close') this.close();
        });

        this.elements.launcher?.addEventListener('click', () => this.open());

        this.elements.body?.addEventListener('scroll', () => {
            const body = this.elements.body;
            const distanceFromBottom = body.scrollHeight - body.scrollTop - body.clientHeight;
            this.state.autoScroll = distanceFromBottom < 24;
            this.state.scrollTop = body.scrollTop;
            this._persistState();
        });
    },

    _renderEntries() {
        if (!this.elements.body) return;

        const body = this.elements.body;
        const previousScrollTop = this.state.scrollTop;
        const shouldStickToBottom = this.state.autoScroll;

        if (this.state.entries.length === 0) {
            body.innerHTML = `
                <div class="sidebar-terminal__empty">
                    Background activity, batch progress, and errors will appear here.
                </div>
            `;
        } else {
            body.innerHTML = this.state.entries.map(entry => `
                <article class="sidebar-terminal__entry sidebar-terminal__entry--${entry.level}">
                    <div class="sidebar-terminal__entry-meta">
                        <span class="sidebar-terminal__entry-level">${entry.level.toUpperCase()}</span>
                        <time class="sidebar-terminal__entry-time">${this._formatTime(entry.timestamp)}</time>
                    </div>
                    <div class="sidebar-terminal__entry-message">${this._escapeHtml(entry.message)}</div>
                    ${entry.details ? `<pre class="sidebar-terminal__entry-details">${this._escapeHtml(entry.details)}</pre>` : ''}
                </article>
            `).join('');
        }

        if (shouldStickToBottom) {
            body.scrollTop = body.scrollHeight;
            this.state.scrollTop = body.scrollTop;
        } else {
            body.scrollTop = previousScrollTop;
        }
    },

    _captureScroll() {
        if (!this.elements.body) return;
        this.state.scrollTop = this.elements.body.scrollTop;
        const distanceFromBottom = this.elements.body.scrollHeight - this.elements.body.scrollTop - this.elements.body.clientHeight;
        this.state.autoScroll = distanceFromBottom < 24;
    },

    _restoreScroll() {
        if (!this.elements.body) return;
        requestAnimationFrame(() => {
            if (this.state.autoScroll) {
                this.elements.body.scrollTop = this.elements.body.scrollHeight;
            } else {
                this.elements.body.scrollTop = this.state.scrollTop;
            }
        });
    },

    _persistState() {
        try {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        } catch (_) {
            // Ignore storage issues.
        }
    },

    _restoreState() {
        try {
            const raw = sessionStorage.getItem(this.STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.entries)) this.state.entries = parsed.entries.slice(-this.MAX_ENTRIES);
            if (typeof parsed.isOpen === 'boolean') this.state.isOpen = parsed.isOpen;
            if (typeof parsed.isExpanded === 'boolean') this.state.isExpanded = parsed.isExpanded;
            if (typeof parsed.autoScroll === 'boolean') this.state.autoScroll = parsed.autoScroll;
            if (typeof parsed.scrollTop === 'number') this.state.scrollTop = parsed.scrollTop;
        } catch (_) {
            // Ignore invalid storage state.
        }
    },

    _patchConsole() {
        if (this.isConsolePatched) return;

        ['log', 'info', 'warn', 'error'].forEach(method => {
            this.originalConsole[method] = console[method].bind(console);
            console[method] = (...args) => {
                this.originalConsole[method](...args);
                const parsed = this._formatConsoleArgs(args);
                this.log(method, parsed.message, parsed.details);
            };
        });

        this.isConsolePatched = true;
    },

    _bindGlobalErrorHooks() {
        if (this.isErrorHooksPatched) return;

        window.addEventListener('error', (event) => {
            const details = event.error?.stack || event.filename || '';
            this.error(event.message || 'Unhandled window error', details);
        });

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason instanceof Error
                ? (event.reason.stack || event.reason.message)
                : this._stringifyDetails(event.reason);
            this.error('Unhandled promise rejection', reason);
        });

        this.isErrorHooksPatched = true;
    },

    _formatConsoleArgs(args) {
        const parts = [];
        const details = [];

        args.forEach(arg => {
            if (arg instanceof Error) {
                parts.push(arg.message || arg.name || 'Error');
                if (arg.stack) details.push(arg.stack);
                return;
            }

            if (typeof arg === 'string') {
                parts.push(arg);
                return;
            }

            if (arg && typeof arg === 'object') {
                const serialized = this._safeSerialize(arg);
                if (parts.length === 0 && serialized.length <= 140) {
                    parts.push(serialized);
                } else {
                    details.push(serialized);
                }
                return;
            }

            parts.push(String(arg));
        });

        return {
            message: parts.join(' ').trim() || 'Console output',
            details: details.join('\n\n') || null
        };
    },

    _normalizeLevel(level) {
        if (level === 'warn') return 'warning';
        if (level === 'log') return 'info';
        return ['info', 'success', 'warning', 'error'].includes(level) ? level : 'info';
    },

    _stringifyMessage(message) {
        if (message instanceof Error) return message.message || 'Error';
        if (typeof message === 'string') return message;
        if (message == null) return 'No message';
        return this._safeSerialize(message);
    },

    _stringifyDetails(details) {
        if (!details) return '';
        if (details instanceof Error) return details.stack || details.message || 'Error details';
        if (typeof details === 'string') return details;
        return this._safeSerialize(details);
    },

    _safeSerialize(value) {
        try {
            return JSON.stringify(value, null, 2);
        } catch (_) {
            return String(value);
        }
    },

    _formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    _escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

window.NewsTerminal = NewsTerminal;

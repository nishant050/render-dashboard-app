document.addEventListener('DOMContentLoaded', () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const addTabBtn = document.getElementById('add-tab-btn');

    let tabs = [];
    let activeTabId = null;
    let loadingInterval = null;

    // Create the first tab on startup
    createTab('about:newtab');

    // Add Tab Button Click Listener
    addTabBtn.addEventListener('click', () => {
        createTab('about:newtab');
    });

    // Address Bar Text Selection on Click
    urlInput.addEventListener('focus', () => {
        setTimeout(() => {
            urlInput.select();
        }, 0);
    });

    urlForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let inputUrl = urlInput.value.trim();
        if (!inputUrl) return;
        
        let parsedUrl = inputUrl;
        if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
            // Check if it's a domain/IP or search query
            const urlPattern = /^(localhost(:\d+)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?|[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-\.]+(\/[^\s]*)?)$/;
            if (urlPattern.test(inputUrl)) {
                parsedUrl = 'https://' + inputUrl;
            } else {
                parsedUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(inputUrl);
            }
        }
        
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
            navigateTab(activeTab, parsedUrl);
        }
    });

    backBtn.addEventListener('click', () => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab && tab.historyIndex > 0) {
            tab.historyIndex--;
            navigateTab(tab, tab.history[tab.historyIndex]);
        }
    });

    forwardBtn.addEventListener('click', () => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab && tab.historyIndex < tab.history.length - 1) {
            tab.historyIndex++;
            navigateTab(tab, tab.history[tab.historyIndex]);
        }
    });

    refreshBtn.addEventListener('click', () => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) {
            if (tab.url === 'about:newtab') {
                // Refreshing newtab just does nothing or re-triggers its load state
            } else {
                const iframe = document.getElementById('iframe-' + tab.id);
                showLoading();
                iframe.src = `/api/proxy?url=${encodeURIComponent(tab.url)}`;
            }
        }
    });

    // Listen to Quick Links on New Tab Page
    document.getElementById('browser-content').addEventListener('click', (e) => {
        const item = e.target.closest('.quick-link-item');
        if (item) {
            e.preventDefault();
            const targetUrl = item.getAttribute('data-url');
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab && targetUrl) {
                navigateTab(activeTab, targetUrl);
            }
        }
    });

    // Listen for navigation messages sent from our injected proxy scripts in iframes
    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        
        // Find which tab this window belongs to
        const sendingTab = tabs.find(t => {
            const iframe = document.getElementById('iframe-' + t.id);
            return iframe && iframe.contentWindow === event.source;
        });

        if (!sendingTab) return;

        if (event.data?.type === 'proxy:navigation' && typeof event.data.url === 'string') {
            const navUrl = event.data.url;
            syncTabNavigation(sendingTab, navUrl);
        }
    });

    function createTab(url) {
        const tabId = 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Create tab content wrapper in DOM
        const wrapper = document.createElement('div');
        wrapper.className = 'tab-content-wrapper';
        wrapper.id = 'wrapper-' + tabId;
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.style.display = 'none';

        // Create Iframe element
        const iframe = document.createElement('iframe');
        iframe.id = 'iframe-' + tabId;
        iframe.sandbox = "allow-same-origin allow-scripts allow-forms allow-popups";
        iframe.allow = "camera; microphone; geolocation; fullscreen";
        
        // Create local New Tab view
        const newTabPage = document.createElement('div');
        newTabPage.className = 'new-tab-page';
        newTabPage.innerHTML = `
            <div class="new-tab-content">
                <div class="new-tab-logo">🌐</div>
                <h1 class="new-tab-title">Proxy Browser</h1>
                <div class="quick-links">
                    <a class="quick-link-item" data-url="https://youtube.com/?themeRefresh=1">
                        <div class="quick-link-icon">🎬</div>
                        <div class="quick-link-name">YouTube</div>
                    </a>
                    <a class="quick-link-item" data-url="https://duckduckgo.com">
                        <div class="quick-link-icon">🔍</div>
                        <div class="quick-link-name">DuckDuckGo</div>
                    </a>
                    <a class="quick-link-item" data-url="https://wikipedia.org">
                        <div class="quick-link-icon">📚</div>
                        <div class="quick-link-name">Wikipedia</div>
                    </a>
                    <a class="quick-link-item" data-url="https://github.com">
                        <div class="quick-link-icon">🐙</div>
                        <div class="quick-link-name">GitHub</div>
                    </a>
                </div>
            </div>
        `;

        wrapper.appendChild(iframe);
        wrapper.appendChild(newTabPage);
        document.getElementById('browser-content').appendChild(wrapper);

        const tab = {
            id: tabId,
            url: url,
            title: url === 'about:newtab' ? 'New Tab' : 'Loading...',
            history: [url],
            historyIndex: 0
        };

        tabs.push(tab);

        // Setup onload events
        setupIframeListeners(tab, iframe);

        // Load the URL
        navigateTab(tab, url);

        // Switch to the newly created tab
        switchTab(tabId);
    }

    function switchTab(tabId) {
        activeTabId = tabId;
        
        // Hide all wrappers, show active wrapper
        tabs.forEach(t => {
            const wrapper = document.getElementById('wrapper-' + t.id);
            if (wrapper) {
                wrapper.style.display = (t.id === tabId) ? 'block' : 'none';
            }
        });

        updateUI();
    }

    function closeTab(tabId) {
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        // Remove DOM element
        const wrapper = document.getElementById('wrapper-' + tabId);
        if (wrapper) wrapper.remove();

        const closedActive = (activeTabId === tabId);
        tabs.splice(tabIndex, 1);

        if (tabs.length === 0) {
            createTab('about:newtab');
            return;
        }

        if (closedActive) {
            // Activate the adjacent tab (left if available, else first)
            const nextActiveIndex = Math.max(0, tabIndex - 1);
            switchTab(tabs[nextActiveIndex].id);
        } else {
            renderTabsList();
        }
    }

    function navigateTab(tab, url) {
        tab.url = url;
        
        const wrapper = document.getElementById('wrapper-' + tab.id);
        if (!wrapper) return;

        const iframe = document.getElementById('iframe-' + tab.id);
        const newTabPage = wrapper.querySelector('.new-tab-page');
        
        if (url === 'about:newtab') {
            iframe.style.display = 'none';
            newTabPage.style.display = 'flex';
            iframe.src = 'about:blank';
            tab.title = 'New Tab';
            updateTabDOM(tab);
            if (tab.id === activeTabId) {
                updateUI();
            }
        } else {
            iframe.style.display = 'block';
            newTabPage.style.display = 'none';
            
            showLoading();
            
            // Set iframe src to proxied URL
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
            iframe.src = proxyUrl;
            
            // Guess title
            try {
                tab.title = new URL(url).hostname;
            } catch (e) {
                tab.title = url;
            }
            updateTabDOM(tab);
            if (tab.id === activeTabId) {
                updateUI();
            }
        }
    }

    function setupIframeListeners(tab, iframe) {
        iframe.addEventListener('load', () => {
            hideLoading();
            
            const iframeUrl = readTargetUrlFromIframe(iframe);
            if (iframeUrl && tab.url !== iframeUrl) {
                tab.url = iframeUrl;
                if (tab.history[tab.historyIndex] !== iframeUrl) {
                    tab.history = tab.history.slice(0, tab.historyIndex + 1);
                    tab.history.push(iframeUrl);
                    tab.historyIndex = tab.history.length - 1;
                }
            }
            
            try {
                if (iframe.contentWindow && iframe.contentWindow.document) {
                    const title = iframe.contentWindow.document.title;
                    if (title) {
                        tab.title = title;
                    }
                }
            } catch (e) {}
            
            if (tab.id === activeTabId) {
                updateUI();
            } else {
                renderTabsList();
            }
        });
    }

    function readTargetUrlFromIframe(iframe) {
        try {
            const iframeLocation = iframe.contentWindow.location;
            if (iframeLocation.pathname !== '/api/proxy') {
                return null;
            }
            const searchParams = new URLSearchParams(iframeLocation.search);
            const targetUrl = searchParams.get('url');
            if (!targetUrl) {
                return null;
            }

            const resolvedUrl = new URL(targetUrl);
            searchParams.forEach((value, key) => {
                if (key !== 'url') {
                    resolvedUrl.searchParams.append(key, value);
                }
            });

            return resolvedUrl.toString();
        } catch (error) {
            return null;
        }
    }

    function syncTabNavigation(tab, url) {
        if (tab.url === url) return;
        
        tab.url = url;
        
        if (tab.history[tab.historyIndex] !== url) {
            tab.history = tab.history.slice(0, tab.historyIndex + 1);
            tab.history.push(url);
            tab.historyIndex = tab.history.length - 1;
        }
        
        if (tab.id === activeTabId) {
            updateUI();
        } else {
            updateTabDOM(tab);
        }
    }

    function updateUI() {
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;
        
        if (tab.url === 'about:newtab') {
            urlInput.value = '';
            urlInput.placeholder = 'Search with DuckDuckGo or enter URL';
        } else {
            urlInput.value = tab.url;
        }
        
        backBtn.disabled = tab.historyIndex <= 0;
        forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
        
        renderTabsList();
    }

    function updateTabDOM(tab) {
        // Re-render tab headers list
        renderTabsList();
    }

    function renderTabsList() {
        const tabsList = document.getElementById('tabs-list');
        tabsList.innerHTML = '';
        
        tabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
            
            const favEl = document.createElement('div');
            favEl.className = 'tab-favicon';
            if (tab.url === 'about:newtab') {
                favEl.textContent = '🌐';
            } else {
                try {
                    const host = new URL(tab.url).hostname;
                    favEl.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${host}&sz=32" onerror="this.innerHTML='🌐'">`;
                } catch (e) {
                    favEl.textContent = '🌐';
                }
            }
            
            const titleEl = document.createElement('span');
            titleEl.className = 'tab-title';
            titleEl.textContent = tab.title || 'New Tab';
            titleEl.title = tab.url;
            
            const closeEl = document.createElement('span');
            closeEl.className = 'tab-close';
            closeEl.innerHTML = '&times;';
            closeEl.title = 'Close Tab';
            
            closeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(tab.id);
            });
            
            tabEl.appendChild(favEl);
            tabEl.appendChild(titleEl);
            tabEl.appendChild(closeEl);
            
            tabEl.addEventListener('click', () => {
                switchTab(tab.id);
            });
            
            tabsList.appendChild(tabEl);
        });
    }

    function showLoading() {
        const bar = document.getElementById('loading-bar');
        bar.classList.add('active');
        bar.style.width = '0%';
        
        if (loadingInterval) clearInterval(loadingInterval);
        
        let progress = 0;
        loadingInterval = setInterval(() => {
            if (progress < 80) {
                progress += Math.random() * 15;
                bar.style.width = progress + '%';
            }
        }, 150);
    }
    
    function hideLoading() {
        const bar = document.getElementById('loading-bar');
        if (loadingInterval) clearInterval(loadingInterval);
        bar.style.width = '100%';
        setTimeout(() => {
            bar.classList.remove('active');
            setTimeout(() => {
                bar.style.width = '0%';
            }, 300);
        }, 200);
    }

    // Periodically sync titles for active pages in case they load via SPA routing
    setInterval(() => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.url !== 'about:newtab') {
            const iframe = document.getElementById('iframe-' + activeTab.id);
            try {
                if (iframe && iframe.contentWindow && iframe.contentWindow.document) {
                    const title = iframe.contentWindow.document.title;
                    if (title && title !== activeTab.title) {
                        activeTab.title = title;
                        renderTabsList();
                    }
                }
            } catch (e) {}
        }
    }, 1000);
});

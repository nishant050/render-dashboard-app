document.addEventListener('DOMContentLoaded', () => {
    const PROXY_EVENT = 'proxy:navigation';
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const browserView = document.getElementById('browser-view');
    const backBtn = document.getElementById('back-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const loadingOverlay = document.getElementById('loading');

    let history = [];
    let currentHistoryIndex = -1;
    let lastObservedProxyLocation = '';

    // Default startup URL
    const initialUrl = 'https://duckduckgo.com';
    urlInput.value = initialUrl;
    loadUrl(initialUrl);

    urlForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let url = urlInput.value.trim();
        if (!url) return;
        
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                url = 'https://duckduckgo.com/?q=' + encodeURIComponent(url);
            }
        }
        
        loadUrl(url, true);
    });

    backBtn.addEventListener('click', () => {
        if (currentHistoryIndex > 0) {
            currentHistoryIndex--;
            loadUrl(history[currentHistoryIndex], false);
        }
    });

    refreshBtn.addEventListener('click', () => {
        if (currentHistoryIndex >= 0) {
            loadUrl(history[currentHistoryIndex], false);
        }
    });

    function loadUrl(url, pushToHistory = true) {
        urlInput.value = url;
        loadingOverlay.classList.add('active');
        lastObservedProxyLocation = '';
        
        // Route through backend proxy API
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        browserView.src = proxyUrl;
        
        if (pushToHistory) {
            syncHistory(url, 'push');
        }
    }

    function syncHistory(url, mode = 'push') {
        if (!url) return;

        urlInput.value = url;

        if (mode === 'skip') {
            return;
        }

        if (mode === 'replace' && currentHistoryIndex >= 0) {
            history[currentHistoryIndex] = url;
            return;
        }

        if (history[currentHistoryIndex] === url) {
            return;
        }

        history = history.slice(0, currentHistoryIndex + 1);
        history.push(url);
        currentHistoryIndex++;
    }

    function shouldReplaceCurrentHistory(url) {
        if (currentHistoryIndex < 0 || !history[currentHistoryIndex]) {
            return false;
        }

        try {
            const currentUrl = new URL(history[currentHistoryIndex]);
            const nextUrl = new URL(url);
            return currentUrl.origin === nextUrl.origin && currentUrl.pathname === nextUrl.pathname;
        } catch (error) {
            return false;
        }
    }

    function readTargetUrlFromIframe() {
        try {
            const iframeLocation = browserView.contentWindow.location;
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

    function readIframeLocationHref() {
        try {
            return browserView.contentWindow.location.href;
        } catch (error) {
            return null;
        }
    }

    function syncFromIframe() {
        const currentProxyUrl = readTargetUrlFromIframe();
        if (!currentProxyUrl) {
            return;
        }

        syncHistory(currentProxyUrl, shouldReplaceCurrentHistory(currentProxyUrl) ? 'replace' : 'push');
    }

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.source !== browserView.contentWindow) return;
        if (event.data?.type !== PROXY_EVENT || typeof event.data.url !== 'string') return;

        loadingOverlay.classList.remove('active');
        syncHistory(event.data.url, 'push');
    });

    browserView.addEventListener('load', () => {
        loadingOverlay.classList.remove('active');
        lastObservedProxyLocation = readIframeLocationHref() || lastObservedProxyLocation;
        syncFromIframe();
    });

    window.setInterval(() => {
        const iframeLocationHref = readIframeLocationHref();
        if (!iframeLocationHref || iframeLocationHref === lastObservedProxyLocation) {
            return;
        }

        lastObservedProxyLocation = iframeLocationHref;
        loadingOverlay.classList.remove('active');
        syncFromIframe();
    }, 250);
});

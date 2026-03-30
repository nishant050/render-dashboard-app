document.addEventListener('DOMContentLoaded', () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const browserView = document.getElementById('browser-view');
    const backBtn = document.getElementById('back-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const loadingOverlay = document.getElementById('loading');

    let history = [];
    let currentHistoryIndex = -1;

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
        
        // Route through backend proxy API
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        browserView.src = proxyUrl;
        
        if (pushToHistory) {
            // Trim forward history if we navigated back then went to new page
            history = history.slice(0, currentHistoryIndex + 1);
            history.push(url);
            currentHistoryIndex++;
        }
    }

    browserView.addEventListener('load', () => {
        loadingOverlay.classList.remove('active');
        
        // Due to proxy routing logic, we try to detect if iframe internally navigated
        // Because of same-origin policy, we CAN read the iframe url since it resolves to our /api/proxy
        try {
            const iframeLocation = browserView.contentWindow.location;
            const searchParams = new URLSearchParams(iframeLocation.search);
            const currentProxyUrl = searchParams.get('url');
            if (currentProxyUrl && currentProxyUrl !== urlInput.value) {
                urlInput.value = currentProxyUrl;
                
                // Add to history silently
                if (history[currentHistoryIndex] !== currentProxyUrl) {
                    history = history.slice(0, currentHistoryIndex + 1);
                    history.push(currentProxyUrl);
                    currentHistoryIndex++;
                }
            }
        } catch(e) {
             console.log("Iframe read restricted (expected for some strict CORS boundaries)");
        }
    });
});

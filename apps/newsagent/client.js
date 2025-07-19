document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const articleView = document.getElementById('article-view');
    const settingsView = document.getElementById('settings-view');
    const settingsBtn = document.getElementById('settings-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const topicInput = document.getElementById('topic-input');
    const sitesInput = document.getElementById('sites-input');
    const modelSelect = document.getElementById('model-select');
    const progressLog = document.getElementById('progress-log');
    const summaryOutput = document.getElementById('summary-output');
    const imageGallery = document.getElementById('image-gallery');

    let eventSource;

    // --- Core Functions ---
    const generateNews = () => {
        // Reset UI for new generation
        progressLog.textContent = '';
        summaryOutput.innerHTML = '<div class="placeholder"><h2>Generating News...</h2><p>The AI agent is reading the latest articles for you.</p></div>';
        imageGallery.innerHTML = '';
        
        if (eventSource) eventSource.close();

        eventSource = new EventSource('/api/summarize-news');

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'status') {
                progressLog.textContent += data.message + '\n';
            } else if (data.type === 'images') {
                imageGallery.innerHTML = ''; // Clear before adding new images
                data.data.forEach(src => {
                    const img = document.createElement('img');
                    img.src = src;
                    img.onerror = () => img.style.display = 'none'; // Hide broken images
                    imageGallery.appendChild(img);
                });
            } else if (data.type === 'summary') {
                summaryOutput.innerHTML = marked.parse(data.data); // Use Marked.js to parse markdown
            } else if (data.type === 'done') {
                progressLog.textContent += '\n✅ Process complete.';
                eventSource.close();
            } else if (data.type === 'error') {
                progressLog.textContent += `\n❌ Error: ${data.message}`;
                summaryOutput.innerHTML = `<p style="color: red;">An error occurred: ${data.message}</p>`;
                eventSource.close();
            }
        };

        eventSource.onerror = () => {
            progressLog.textContent += '\n❌ Connection to server lost.';
            eventSource.close();
        };
    };

    const loadSettings = async () => {
        try {
            const response = await fetch('/api/news-settings');
            const settings = await response.json();
            topicInput.value = settings.topic;
            sitesInput.value = settings.sites;
            modelSelect.value = settings.model;
            return true;
        } catch (error) {
            console.error('Failed to load settings:', error);
            // If settings fail to load, show the settings page by default
            showSettingsView();
            return false;
        }
    };

    const saveSettings = async () => {
        const settings = {
            topic: topicInput.value.trim(),
            sites: sitesInput.value.trim(),
            model: modelSelect.value,
        };
        try {
            await fetch('/api/news-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Error: Could not save settings.');
            return false;
        }
    };

    // --- View Management ---
    const showArticleView = () => {
        articleView.style.display = 'flex';
        settingsView.style.display = 'none';
    };
    const showSettingsView = () => {
        articleView.style.display = 'none';
        settingsView.style.display = 'block';
    };

    // --- Event Listeners ---
    settingsBtn.addEventListener('click', showSettingsView);
    refreshBtn.addEventListener('click', () => {
        showArticleView();
        generateNews();
    });

    saveSettingsBtn.addEventListener('click', async () => {
        const success = await saveSettings();
        if (success) {
            showArticleView();
            generateNews();
        }
    });

    // --- Initial Load ---
    const initialize = async () => {
        const settingsLoaded = await loadSettings();
        if (settingsLoaded) {
            showArticleView();
            generateNews();
        }
    };

    initialize();
});
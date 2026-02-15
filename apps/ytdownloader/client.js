// State management
let currentVideoInfo = null;
let currentDownloadId = null;
let progressPollInterval = null;

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const videoUrlInput = document.getElementById('video-url');
const pasteBtn = document.getElementById('paste-btn');
const fetchBtn = document.getElementById('fetch-btn');
const videoPreview = document.getElementById('video-preview');
const previewThumb = document.getElementById('preview-thumb');
const previewDuration = document.getElementById('preview-duration');
const previewTitle = document.getElementById('preview-title');
const previewUploader = document.getElementById('preview-uploader');
const qualitySection = document.getElementById('quality-section');
const qualitySelect = document.getElementById('quality-select');
const downloadSectionControls = document.getElementById('download-section-controls');
const downloadBtn = document.getElementById('download-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const progressPercent = document.getElementById('progress-percent');
const progressMessage = document.getElementById('progress-message');
const videoGrid = document.getElementById('video-grid');
const emptyLibrary = document.getElementById('empty-library');
const refreshLibraryBtn = document.getElementById('refresh-library');
const playerModal = document.getElementById('player-modal');
const videoPlayer = document.getElementById('video-player');
const modalVideoTitle = document.getElementById('modal-video-title');
const closeModalBtn = document.getElementById('close-modal');
const modalOverlay = document.querySelector('.modal-overlay');
const toastContainer = document.getElementById('toast-container');

// Tab Navigation
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active content
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-section`).classList.add('active');

        // Refresh library when switching to it
        if (tabId === 'library') {
            loadLibrary();
        }
    });
});

// Paste from clipboard
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        videoUrlInput.value = text.trim();
        showToast('Pasted from clipboard', 'success');
    } catch (err) {
        showToast('Unable to access clipboard. Please paste manually (Ctrl+V)', 'error');
    }
});

// Enter key to fetch video info
videoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchBtn.click();
    }
});

// Fetch Video Info
fetchBtn.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
        showToast('Please enter a YouTube URL', 'error');
        return;
    }

    setFetchingState(true);
    try {
        const response = await fetch(`/api/video-info?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (response.ok) {
            currentVideoInfo = data;
            displayVideoPreview(data);
            populateQualitySelect(data.formats);
            showToast('Video information loaded!', 'success');
        } else {
            throw new Error(data.error || 'Failed to fetch video info');
        }
    } catch (error) {
        showToast(error.message, 'error');
        resetPreview();
    } finally {
        setFetchingState(false);
    }
});

// Display Video Preview
function displayVideoPreview(info) {
    previewThumb.src = info.thumbnail;
    previewTitle.textContent = info.title;
    previewUploader.textContent = info.uploader;

    // Format duration
    if (info.duration) {
        const minutes = Math.floor(info.duration / 60);
        const seconds = info.duration % 60;
        previewDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        previewDuration.style.display = 'block';
    } else {
        previewDuration.style.display = 'none';
    }

    videoPreview.classList.remove('hidden');
    qualitySection.classList.remove('hidden');
    downloadSectionControls.classList.remove('hidden');
}

// Populate Quality Select
function populateQualitySelect(formats) {
    qualitySelect.innerHTML = '';
    formats.forEach(format => {
        const option = document.createElement('option');
        option.value = format.format_id;
        option.textContent = format.quality;

        // Add audio indicator
        if (!format.has_audio) {
            option.textContent += ' (video only - audio will be merged)';
        }

        qualitySelect.appendChild(option);
    });
}

// Start Download
downloadBtn.addEventListener('click', async () => {
    if (!currentVideoInfo) {
        showToast('Please fetch video info first', 'error');
        return;
    }

    const quality = qualitySelect.value;
    currentDownloadId = Date.now().toString();

    // Show progress section
    videoPreview.classList.add('hidden');
    qualitySection.classList.add('hidden');
    downloadSectionControls.classList.add('hidden');
    progressSection.classList.remove('hidden');
    updateProgress(0, 'starting', 'Starting download...');

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: currentVideoInfo.url,
                quality: quality
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to start download');
        }

        // Start polling for progress
        startProgressPolling(data.download_id);

    } catch (error) {
        showToast(error.message, 'error');
        resetDownloadSection();
    }
});

// Progress Polling
function startProgressPolling(downloadId) {
    progressPollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/download-progress/${downloadId}`);
            const data = await response.json();

            updateProgress(
                data.progress || 0,
                data.status,
                data.message || '',
                data.filename
            );

            if (data.status === 'completed' || data.status === 'error') {
                clearInterval(progressPollInterval);
                progressPollInterval = null;

                if (data.status === 'completed') {
                    showToast('Download complete!', 'success');
                    setTimeout(() => {
                        resetDownloadSection();
                        loadLibrary();
                    }, 1500);
                } else {
                    showToast(data.message || 'Download failed', 'error');
                    setTimeout(() => resetDownloadSection(), 3000);
                }
            }
        } catch (error) {
            console.error('Progress poll error:', error);
        }
    }, 1000);
}

function updateProgress(percent, status, message, filename = '') {
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${Math.round(percent)}%`;
    progressStatus.textContent = status === 'processing' ? 'Processing video...' :
                                  status === 'downloading' ? 'Downloading...' :
                                  status === 'error' ? 'Error' : status;
    progressMessage.textContent = message;
}

function resetDownloadSection() {
    progressSection.classList.add('hidden');
    if (currentVideoInfo) {
        videoPreview.classList.remove('hidden');
        qualitySection.classList.remove('hidden');
        downloadSectionControls.classList.remove('hidden');
    }
}

function resetPreview() {
    currentVideoInfo = null;
    videoPreview.classList.add('hidden');
    qualitySection.classList.add('hidden');
    downloadSectionControls.classList.add('hidden');
    videoUrlInput.value = '';
}

function setFetchingState(isFetching) {
    const btnText = fetchBtn.querySelector('.btn-text');
    const btnLoader = fetchBtn.querySelector('.btn-loader');

    if (isFetching) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        fetchBtn.disabled = true;
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        fetchBtn.disabled = false;
    }
}

// Library Management
async function loadLibrary() {
    try {
        const response = await fetch('/api/library');
        const videos = await response.json();

        if (videos.length === 0) {
            videoGrid.innerHTML = '';
            emptyLibrary.classList.remove('hidden');
            return;
        }

        emptyLibrary.classList.add('hidden');
        videoGrid.innerHTML = '';

        videos.forEach(video => {
            const card = createVideoCard(video);
            videoGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load library:', error);
        showToast('Failed to load library', 'error');
    }
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';

    const filename = video.filename;
    const title = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const sizeMB = (video.size / (1024 * 1024)).toFixed(1);
    const date = new Date(video.date * 1000).toLocaleDateString();

    // Use thumbnail if available, otherwise use placeholder
    const thumbnailSrc = video.thumbnail || '/apps/ytdownloader/placeholder.svg';

    card.innerHTML = `
        <div class="card-thumbnail">
            <img src="${thumbnailSrc}" alt="${title}" loading="lazy" onerror="this.src='/api/video/${encodeURIComponent(filename)}'">
            <div class="play-overlay">
                <div class="play-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                </div>
            </div>
        </div>
        <div class="card-info">
            <h4 class="card-title">${title}</h4>
            <div class="card-meta">
                <span>${sizeMB} MB</span>
                <button class="delete-btn" data-filename="${encodeURIComponent(filename)}">Delete</button>
            </div>
        </div>
    `;

    // Play video on click
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-btn')) {
            openPlayer(video.url, title);
        }
    });

    // Delete video
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this video?')) {
            try {
                const response = await fetch(`/api/video/${encodeURIComponent(filename)}`, { method: 'DELETE' });
                if (response.ok) {
                    showToast('Video deleted', 'success');
                    card.remove();
                    if (videoGrid.children.length === 0) {
                        emptyLibrary.classList.remove('hidden');
                    }
                } else {
                    throw new Error('Failed to delete');
                }
            } catch (error) {
                showToast('Failed to delete video', 'error');
            }
        }
    });

    return card;
}

// Video Player
function openPlayer(videoUrl, title) {
    videoPlayer.src = videoUrl;
    modalVideoTitle.textContent = title;
    playerModal.classList.remove('hidden');
    videoPlayer.play();
}

function closePlayer() {
    videoPlayer.pause();
    videoPlayer.src = '';
    playerModal.classList.add('hidden');
}

closeModalBtn.addEventListener('click', closePlayer);
modalOverlay.addEventListener('click', closePlayer);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !playerModal.classList.contains('hidden')) {
        closePlayer();
    }
});

// Refresh Library
refreshLibraryBtn.addEventListener('click', () => {
    loadLibrary();
    showToast('Library refreshed', 'info');
});

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    switch (type) {
        case 'success':
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
            break;
        case 'error':
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
            break;
        default:
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `${icon}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.5s ease-out reverse';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Settings Modal
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const proxyUrlInput = document.getElementById('proxy-url');
const cookiesBrowserSelect = document.getElementById('cookies-browser');
const saveProxyBtn = document.getElementById('save-proxy');
const clearProxyBtn = document.getElementById('clear-proxy');
const saveCookiesBtn = document.getElementById('save-cookies');
const clearCookiesBtn = document.getElementById('clear-cookies');

// Open settings modal
settingsBtn.addEventListener('click', async () => {
    // Load current settings
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        
        proxyUrlInput.value = settings.proxy || '';
        cookiesBrowserSelect.value = settings.cookies || '';
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    
    settingsModal.classList.remove('hidden');
});

// Close settings modal
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

// Save proxy
saveProxyBtn.addEventListener('click', async () => {
    const proxy = proxyUrlInput.value.trim();
    try {
        const response = await fetch('/api/settings/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proxy })
        });
        const data = await response.json();
        showToast(data.message, 'success');
        settingsModal.classList.add('hidden');
    } catch (error) {
        showToast('Failed to save proxy', 'error');
    }
});

// Clear proxy
clearProxyBtn.addEventListener('click', async () => {
    proxyUrlInput.value = '';
    try {
        const response = await fetch('/api/settings/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proxy: '' })
        });
        const data = await response.json();
        showToast(data.message, 'success');
    } catch (error) {
        showToast('Failed to clear proxy', 'error');
    }
});

// Save cookies (browser)
saveCookiesBtn.addEventListener('click', async () => {
    const browser = cookiesBrowserSelect.value;
    try {
        const response = await fetch('/api/settings/cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ browser })
        });
        const data = await response.json();
        showToast(data.message, 'success');
        settingsModal.classList.add('hidden');
    } catch (error) {
        showToast('Failed to save cookies', 'error');
    }
});

// Clear cookies
clearCookiesBtn.addEventListener('click', async () => {
    cookiesBrowserSelect.value = '';
    try {
        const response = await fetch('/api/settings/cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ browser: '' })
        });
        const data = await response.json();
        showToast(data.message, 'success');
    } catch (error) {
        showToast('Failed to clear cookies', 'error');
    }
});

// Close modal on overlay click
settingsModal.querySelector('.modal-overlay').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
});

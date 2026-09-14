let jupyterState = {
    running: false,
    starting: false,
    token: '',
    port: 8888,
    rootDir: '',
    url: '/jupyter/lab'
};

let pollInterval = null;
let isFirstLoad = true;

const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const startupOverlay = document.getElementById('startup-overlay');
const startupHeading = document.getElementById('startup-heading');
const startupSubtext = document.getElementById('startup-subtext');
const serverRootVal = document.getElementById('server-root-val');
const jupyterFrame = document.getElementById('jupyter-frame');
const btnFullscreen = document.getElementById('btn-fullscreen');

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function updateStatusUI(running, starting, message) {
    statusBadge.className = 'status-badge';
    if (running) {
        statusBadge.classList.add('status-online');
        statusText.textContent = 'Live (Online)';
    } else if (starting) {
        statusBadge.classList.add('status-starting');
        statusText.textContent = message || 'Starting...';
    } else {
        statusBadge.classList.add('status-offline');
        statusText.textContent = 'Offline';
    }
}

async function checkStatus() {
    try {
        const res = await fetch('/api/jupyter/status');
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        jupyterState = data;

        if (data.rootDir) {
            serverRootVal.textContent = data.rootDir;
            serverRootVal.title = data.rootDir;
        }

        const directLabUrl = `/jupyter/lab?token=${encodeURIComponent(data.token || '')}`;
        btnFullscreen.href = directLabUrl;

        if (data.running) {
            updateStatusUI(true, false);
            
            if (isFirstLoad || !jupyterFrame.src || jupyterFrame.src === 'about:blank') {
                isFirstLoad = false;
                startupHeading.textContent = 'Ready! Loading Interface...';
                jupyterFrame.src = directLabUrl;
                
                // Hide overlay after brief delay for smooth appearance
                setTimeout(() => {
                    startupOverlay.classList.add('hidden');
                }, 700);
            } else {
                startupOverlay.classList.add('hidden');
            }
        } else {
            updateStatusUI(false, true, data.starting ? 'Initializing...' : 'Waiting...');
            startupOverlay.classList.remove('hidden');
            startupHeading.textContent = data.starting ? 'Starting Jupyter Lab...' : 'Jupyter Server Offline';
            startupSubtext.textContent = data.starting 
                ? 'Python process is spinning up. Stand by...' 
                : 'Server is currently offline. You can trigger a start or restart.';
        }
    } catch (err) {
        console.warn('[Jupyter Client] Error checking status:', err.message);
        updateStatusUI(false, false);
    }
}

function startPolling() {
    checkStatus();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(checkStatus, 3000);
}

function forceCheckStatus() {
    showToast('Checking Jupyter server status...');
    checkStatus();
}

async function restartJupyterServer() {
    showToast('Restarting Jupyter Lab server...');
    updateStatusUI(false, true, 'Restarting...');
    startupOverlay.classList.remove('hidden');
    startupHeading.textContent = 'Restarting Jupyter Lab...';
    startupSubtext.textContent = 'Stopping and restarting Python subprocess with persistent kernels...';
    isFirstLoad = true;

    try {
        const res = await fetch('/api/jupyter/restart', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
            showToast('Restart signal sent. Initializing...');
        } else {
            showToast('Restart failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        showToast('Error requesting restart: ' + err.message);
    }

    setTimeout(checkStatus, 1500);
}

function copyDirectUrl() {
    const fullUrl = window.location.origin + `/jupyter/lab?token=${encodeURIComponent(jupyterState.token || '')}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullUrl).then(() => {
            showToast('JupyterLab link with auth token copied to clipboard!');
        }).catch(() => {
            prompt('Copy this Jupyter URL:', fullUrl);
        });
    } else {
        prompt('Copy this Jupyter URL:', fullUrl);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    startPolling();
});

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('download-form');
    const urlInput = document.getElementById('youtube-url');
    const progressContainer = document.getElementById('progress-container');
    const completedContainer = document.getElementById('video-list-container');
    const activePolls = new Map();
    const terminalStatuses = new Set(['Complete', 'Failed']);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = urlInput.value.trim();
        if (!url) return;

        try {
            const response = await fetch('/api/ytdownloader/start-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            if (!response.ok) {
                let payload = null;
                try {
                    payload = await response.json();
                } catch {
                    payload = null;
                }
                throw new Error(payload?.error || payload?.message || 'Failed to start download process.');
            }
            const { jobId } = await response.json();
            urlInput.value = '';
            addProgressCard(jobId, url);
            pollJobStatus(jobId);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    function pollJobStatus(jobId) {
        const intervalId = setInterval(async () => {
            try {
                const response = await fetch(`/api/ytdownloader/status/${jobId}`);
                if (!response.ok) throw new Error('Job not found.');
                const job = await response.json();
                updateProgressCard(job);

                if (terminalStatuses.has(job.status)) {
                    clearInterval(intervalId);
                    activePolls.delete(jobId);
                    const progressCard = document.getElementById(`job-${jobId}`);
                    if (progressCard) {
                        if (job.status === 'Complete' && job.finalFile) {
                            progressCard.remove();
                            addCompletedVideoCard(job.finalFile, completedContainer, true);
                        } else {
                            progressCard.classList.add('failed-job');
                        }
                    }
                }
            } catch (error) {
                clearInterval(intervalId);
                activePolls.delete(jobId);
            }
        }, 3000); // Poll every 3 seconds
        activePolls.set(jobId, intervalId);
    }

    function addProgressCard(jobId, url) {
        const card = document.createElement('div');
        card.className = 'progress-card';
        card.id = `job-${jobId}`;
        card.innerHTML = `
            <div class="card-content">
                <h3>Processing Request...</h3>
                <p class="author" style="word-break: break-all;">${url}</p>
                <div class="progress-bar">
                    <div class="progress-bar-inner" style="width: 0%;">0%</div>
                </div>
                <p class="progress-message">Queued</p>
            </div>`;
        progressContainer.prepend(card);
    }

    function updateProgressCard(job) {
        const card = document.getElementById(`job-${job.id}`);
        if (!card) return;
        const progressBar = card.querySelector('.progress-bar-inner');
        const messageEl = card.querySelector('.progress-message');
        progressBar.style.width = `${job.progress}%`;
        progressBar.textContent = `${job.progress}%`;
        messageEl.textContent = job.message;
    }

    function addCompletedVideoCard(video, container, isNew = false) {
        if (!video || !video.videoFile || !video.audioFile) return;
        const card = document.createElement('div');
        card.className = 'video-card';
        card.dataset.videoFile = video.videoFile;
        card.dataset.audioFile = video.audioFile;
        card.innerHTML = `
            <video controls preload="metadata" poster="/assets/video-placeholder.png">
                <source src="/${video.videoPath}" type="video/mp4">
            </video>
            <div class="card-content">
                <h3>${video.title}</h3>
                <p class="author">By: ${video.author}</p>
                <div class="download-links">
                    <a href="/${video.videoPath}" download="${video.videoFile}">Download Video</a>
                    <a href="/${video.audioPath}" download="${video.audioFile}">Download Audio</a>
                    <button type="button" class="danger-button delete-video-btn">Delete</button>
                </div>
            </div>`;

        const deleteButton = card.querySelector('.delete-video-btn');
        deleteButton.addEventListener('click', async () => {
            const confirmed = window.confirm('Delete this video and audio from server storage?');
            if (!confirmed) return;

            deleteButton.disabled = true;
            deleteButton.textContent = 'Deleting...';
            try {
                const response = await fetch('/api/ytdownloader/delete-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        videoFile: video.videoFile,
                        audioFile: video.audioFile,
                    }),
                });

                let payload = null;
                try {
                    payload = await response.json();
                } catch {
                    payload = null;
                }

                if (!response.ok || !payload?.ok) {
                    const message = payload?.error || 'Failed to delete video from server.';
                    throw new Error(message);
                }

                card.remove();
                if (!payload.repoDeleteTriggered && payload.warning) {
                    alert(payload.warning);
                }
            } catch (error) {
                alert(`Delete failed: ${error.message}`);
                deleteButton.disabled = false;
                deleteButton.textContent = 'Delete';
            }
        });

        if (isNew) {
            container.prepend(card);
        } else {
            container.appendChild(card);
        }
    }

    async function loadCompletedVideos() {
        try {
            const response = await fetch('/public/videos.json');
            if (!response.ok) return;
            const videos = await response.json();
            if (!Array.isArray(videos)) return;
            videos.forEach(video => addCompletedVideoCard(video, completedContainer));
        } catch (error) {
            console.log('Could not load previous videos. This is okay on first run.');
        }
    }

    loadCompletedVideos();
});

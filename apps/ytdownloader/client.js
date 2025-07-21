document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('download-form');
    const urlInput = document.getElementById('youtube-url');
    const progressContainer = document.getElementById('progress-container');
    const completedContainer = document.getElementById('video-list-container');
    const activePolls = new Map();

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
            if (!response.ok) throw new Error('Failed to start download process.');
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

                if (job.progress === 100) {
                    clearInterval(intervalId);
                    activePolls.delete(jobId);
                    const progressCard = document.getElementById(`job-${jobId}`);
                    if (progressCard) {
                        if (job.status === 'Complete') {
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
        const card = document.createElement('div');
        card.className = 'video-card';
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
                </div>
            </div>`;
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
            videos.forEach(video => addCompletedVideoCard(video, completedContainer));
        } catch (error) {
            console.log('Could not load previous videos. This is okay on first run.');
        }
    }

    loadCompletedVideos();
});
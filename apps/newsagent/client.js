document.addEventListener('DOMContentLoaded', () => {
    const topicInput = document.getElementById('topic-input');
    const sitesInput = document.getElementById('sites-input');
    const summarizeBtn = document.getElementById('summarize-btn');
    const resultsContainer = document.getElementById('results-container');
    const progressLog = document.getElementById('progress-log');
    const summaryOutput = document.getElementById('summary-output');

    let eventSource;

    summarizeBtn.addEventListener('click', () => {
        const topic = topicInput.value.trim();
        const sites = sitesInput.value.trim();

        if (!topic || !sites) {
            alert('Please provide both a topic and at least one website.');
            return;
        }

        // Reset UI
        resultsContainer.style.display = 'block';
        progressLog.textContent = '';
        summaryOutput.innerHTML = 'Thinking...';
        summarizeBtn.disabled = true;
        summarizeBtn.textContent = 'Processing...';

        // Close any existing connection
        if (eventSource) {
            eventSource.close();
        }

        // Start new SSE connection
        const url = `/api/summarize-news?topic=${encodeURIComponent(topic)}&sites=${encodeURIComponent(sites)}`;
        eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'status') {
                progressLog.textContent += data.message + '\n';
            } else if (data.type === 'tools') {
                progressLog.textContent += `\nTools Used:\n${JSON.stringify(data.data, null, 2)}\n\n`;
            } else if (data.type === 'summary') {
                // A simple markdown-to-html converter
                let html = data.data
                    .replace(/^# (.*$)/g, '<h4>$1</h4>') // H1 -> H4
                    .replace(/^\* (.*$)/g, '<ul><li>$1</li></ul>') // Bullets
                    .replace(/<\/ul>\s?<ul>/g, ''); // Merge consecutive lists
                summaryOutput.innerHTML = html;
            } else if (data.type === 'done') {
                progressLog.textContent += '✅ Process complete.';
                eventSource.close();
                summarizeBtn.disabled = false;
                summarizeBtn.textContent = 'Summarize News';
            } else if (data.type === 'error') {
                 progressLog.textContent += `\n❌ Error: ${data.message}`;
                 summaryOutput.innerHTML = `<p style="color: red;">${data.message}</p>`;
                 eventSource.close();
                 summarizeBtn.disabled = false;
                 summarizeBtn.textContent = 'Summarize News';
            }
        };

        eventSource.onerror = () => {
            progressLog.textContent += '\n❌ Connection to server lost.';
            eventSource.close();
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = 'Summarize News';
        };
    });
});
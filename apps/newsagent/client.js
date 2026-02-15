document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('main-container');
    const settingsBtn = document.getElementById('settings-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusPill = document.getElementById('status-pill');
    const lastUpdatedEl = document.getElementById('last-updated');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const sectionsList = document.getElementById('sections-list');
    const sectionForm = document.getElementById('section-form');
    const sectionIdInput = document.getElementById('section-id');
    const sectionTitleInput = document.getElementById('section-title');
    const sectionTopicInput = document.getElementById('section-topic');
    const sectionSitesInput = document.getElementById('section-sites');
    const sectionModelSelect = document.getElementById('section-model');
    const clearFormBtn = document.getElementById('clear-form-btn');

    let eventSource;
    let isStreaming = false;

    const MODEL_OPTIONS = [
        { value: 'groq/compound', label: 'Groq Compound (Balanced)' },
        { value: 'groq/compound-mini', label: 'Groq Compound Mini (Fast)' },
        { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    ];

    const setDashboardStatus = (state, label) => {
        statusPill.className = `status-pill ${state}`;
        statusPill.textContent = label;
    };

    const updateLastUpdated = () => {
        lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;
    };

    const closeEventSource = () => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        isStreaming = false;
        stopBtn.disabled = true;
    };

    const handleApiResponse = async (response) => {
        const bodyText = await response.text();
        if (!response.ok) {
            throw new Error(bodyText || `Request failed (${response.status})`);
        }

        if (!bodyText) return null;
        try {
            return JSON.parse(bodyText);
        } catch {
            throw new Error('Server returned invalid JSON.');
        }
    };

    const api = {
        getSections: async () => {
            const response = await fetch('/api/news-sections');
            const data = await handleApiResponse(response);
            return Array.isArray(data) ? data : [];
        },
        addSection: async (data) => {
            const response = await fetch('/api/news-sections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return handleApiResponse(response);
        },
        updateSection: async (id, data) => {
            const response = await fetch(`/api/news-sections/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return handleApiResponse(response);
        },
        deleteSection: async (id) => {
            const response = await fetch(`/api/news-sections/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const bodyText = await response.text();
                throw new Error(bodyText || 'Could not delete section.');
            }
        },
    };

    const renderSectionsSkeleton = (sections) => {
        mainContainer.innerHTML = '';
        sections.forEach((section) => {
            const sectionEl = document.createElement('article');
            sectionEl.className = 'news-section';
            sectionEl.id = `section-${section.id}`;
            sectionEl.innerHTML = `
                <div class="section-header">
                    <div>
                        <h2>${section.title}</h2>
                        <span class="model-tag">${section.model || 'default model'}</span>
                    </div>
                    <button class="copy-btn" data-copy-id="${section.id}">Copy Summary</button>
                </div>
                <div class="section-content">
                    <div class="image-gallery"></div>
                    <div class="summary-output">
                        <div class="placeholder"><p>Initializing agent...</p></div>
                    </div>
                </div>
                <div class="progress-box">
                    <pre></pre>
                </div>
            `;

            const copyBtn = sectionEl.querySelector('.copy-btn');
            copyBtn.addEventListener('click', async () => {
                const summaryText = sectionEl.querySelector('.summary-output')?.innerText?.trim();
                if (!summaryText) return;
                await navigator.clipboard.writeText(summaryText);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy Summary';
                }, 1200);
            });

            mainContainer.appendChild(sectionEl);
        });
    };

    const generateAllNews = async () => {
        try {
            const sections = await api.getSections();
            if (sections.length === 0) {
                closeEventSource();
                setDashboardStatus('idle', 'Idle');
                mainContainer.innerHTML = '<div class="placeholder"><h2>No news sections configured.</h2><p>Click the "Manage Sections" button to add your first news feed.</p></div>';
                return;
            }

            renderSectionsSkeleton(sections);

            closeEventSource();
            eventSource = new EventSource('/api/summarize-all');
            isStreaming = true;
            stopBtn.disabled = false;
            setDashboardStatus('loading', 'Running');

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'done') {
                    closeEventSource();
                    updateLastUpdated();
                    setDashboardStatus('success', 'Completed');
                    return;
                }

                const sectionEl = document.getElementById(`section-${data.sectionId}`);
                if (!sectionEl) return;

                const logEl = sectionEl.querySelector('.progress-box pre');
                const summaryEl = sectionEl.querySelector('.summary-output');
                const galleryEl = sectionEl.querySelector('.image-gallery');

                switch (data.type) {
                    case 'status':
                        logEl.textContent += `${data.message}\n`;
                        break;
                    case 'result':
                        galleryEl.innerHTML = (data.data.images || [])
                            .map((src) => `<img src="${src}" loading="lazy" onerror="this.remove()">`)
                            .join('');
                        summaryEl.innerHTML = marked.parse(data.data.summary || 'No summary generated.');
                        logEl.textContent += '✅ Summary received.\n';
                        break;
                    case 'error':
                        setDashboardStatus('error', 'Completed with errors');
                        logEl.textContent += `❌ Error: ${data.message}\n`;
                        summaryEl.innerHTML = '<p class="error-text">An error occurred while generating this section.</p>';
                        break;
                    default:
                        break;
                }
            };

            eventSource.onerror = () => {
                if (!isStreaming) return;
                closeEventSource();
                setDashboardStatus('error', 'Connection lost');
            };
        } catch (error) {
            closeEventSource();
            setDashboardStatus('error', 'Error');
            mainContainer.innerHTML = `<div class="placeholder"><h2>Error</h2><p>${error.message}</p></div>`;
        }
    };

    const populateSettingsForm = (section) => {
        sectionIdInput.value = section.id;
        sectionTitleInput.value = section.title;
        sectionTopicInput.value = section.topic;
        sectionSitesInput.value = section.sites;
        sectionModelSelect.value = section.model;
    };

    const clearSettingsForm = () => {
        sectionIdInput.value = '';
        sectionForm.reset();
        sectionModelSelect.value = MODEL_OPTIONS[0].value;
    };

    const renderModelOptions = () => {
        sectionModelSelect.innerHTML = MODEL_OPTIONS.map(({ value, label }) => `<option value="${value}">${label}</option>`).join('');
    };

    const renderSettingsList = async () => {
        const sections = await api.getSections();
        sectionsList.innerHTML = '';

        sections.forEach((section) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'section-item';
            itemEl.innerHTML = `
                <span class="section-title">${section.title}</span>
                <div class="actions">
                    <button data-action="edit">Edit</button>
                    <button data-action="delete">Delete</button>
                </div>
            `;

            itemEl.querySelector('[data-action="edit"]').onclick = () => populateSettingsForm(section);
            itemEl.querySelector('[data-action="delete"]').onclick = async () => {
                if (confirm(`Are you sure you want to delete "${section.title}"?`)) {
                    await api.deleteSection(section.id);
                    await renderSettingsList();
                }
            };
            sectionsList.appendChild(itemEl);
        });

        if (sections.length === 0) {
            sectionsList.innerHTML = '<p class="placeholder small">No sections yet.</p>';
        }
    };

    sectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = sectionIdInput.value;
        const data = {
            title: sectionTitleInput.value.trim(),
            topic: sectionTopicInput.value.trim(),
            sites: sectionSitesInput.value.trim(),
            model: sectionModelSelect.value,
        };

        try {
            if (id) {
                await api.updateSection(id, data);
            } else {
                await api.addSection(data);
            }
            clearSettingsForm();
            await renderSettingsList();
        } catch (error) {
            alert(error.message);
        }
    });

    settingsBtn.addEventListener('click', async () => {
        await renderSettingsList();
        settingsModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
        generateAllNews();
    });

    refreshBtn.addEventListener('click', generateAllNews);
    stopBtn.addEventListener('click', () => {
        closeEventSource();
        setDashboardStatus('idle', 'Stopped');
    });
    clearFormBtn.addEventListener('click', clearSettingsForm);

    renderModelOptions();
    clearSettingsForm();
    generateAllNews();
});

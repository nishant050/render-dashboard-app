document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('main-container');
    const settingsBtn = document.getElementById('settings-btn');
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

    const api = {
        getSections: () => fetch('/api/news-sections').then(res => res.json()),
        addSection: (data) => fetch('/api/news-sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
        updateSection: (id, data) => fetch(`/api/news-sections/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
        deleteSection: (id) => fetch(`/api/news-sections/${id}`, { method: 'DELETE' }),
    };

    const renderSectionsSkeleton = (sections) => {
        mainContainer.innerHTML = '';
        sections.forEach(section => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'news-section';
            sectionEl.id = `section-${section.id}`;
            sectionEl.innerHTML = `
                <div class="section-header"><h2>${section.title}</h2></div>
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
            mainContainer.appendChild(sectionEl);
        });
    };

    const generateAllNews = async () => {
        try {
            const sections = await api.getSections();
            if (sections.length === 0) {
                mainContainer.innerHTML = '<div class="placeholder"><h2>No news sections configured.</h2><p>Click the "Manage Sections" button to add your first news feed.</p></div>';
                return;
            }
            renderSectionsSkeleton(sections);

            if (eventSource) eventSource.close();
            eventSource = new EventSource('/api/summarize-all');

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                const sectionEl = document.getElementById(`section-${data.sectionId}`);
                if (!sectionEl && data.type !== 'done') return;

                const logEl = sectionEl.querySelector('.progress-box pre');
                const summaryEl = sectionEl.querySelector('.summary-output');
                const galleryEl = sectionEl.querySelector('.image-gallery');

                switch (data.type) {
                    case 'status':
                        logEl.textContent += data.message + '\n';
                        break;
                    case 'result':
                        galleryEl.innerHTML = (data.data.images || []).map(src => `<img src="${src}" onerror="this.style.display='none'">`).join('');
                        summaryEl.innerHTML = marked.parse(data.data.summary || "No summary generated.");
                        logEl.textContent += '✅ Summary received.\n';
                        break;
                    case 'error':
                        logEl.textContent += `❌ Error: ${data.message}\n`;
                        summaryEl.innerHTML = `<p style="color: red;">An error occurred.</p>`;
                        break;
                    case 'done':
                        eventSource.close();
                        break;
                }
            };
            eventSource.onerror = () => { eventSource.close(); };
        } catch (e) {
            mainContainer.innerHTML = '<div class="placeholder"><h2>Error</h2><p>Could not load news sections. Please check server logs.</p></div>';
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
    };

    const renderSettingsList = async () => {
        const sections = await api.getSections();
        sectionsList.innerHTML = '';
        sections.forEach(section => {
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
                    renderSettingsList();
                }
            };
            sectionsList.appendChild(itemEl);
        });
    };

    sectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = sectionIdInput.value;
        const data = {
            title: sectionTitleInput.value,
            topic: sectionTopicInput.value,
            sites: sectionSitesInput.value,
            model: sectionModelSelect.value,
        };
        if (id) {
            await api.updateSection(id, data);
        } else {
            await api.addSection(data);
        }
        clearSettingsForm();
        renderSettingsList();
    });

    settingsBtn.addEventListener('click', () => {
        renderSettingsList();
        settingsModal.style.display = 'flex';
    });
    closeModalBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
        generateAllNews(); // Refresh main view after closing settings
    });
    clearFormBtn.addEventListener('click', clearSettingsForm);

    generateAllNews(); // Initial load
});
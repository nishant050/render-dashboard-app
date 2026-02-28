const defaultChemistrySchedule = [
    { id: 1, dates: "March 1", topics: "Basic concept of chemistry + Thermodynamics" },
    { id: 2, dates: "March 2", topics: "Basic concept of chemistry + Thermodynamics" },
    { id: 3, dates: "March 3", topics: "Revision + Full length paper (Sunday)" },
    { id: 4, dates: "March 4", topics: "Electrochemistry + Solution" },
    { id: 5, dates: "March 5", topics: "Electrochemistry + Solution" },
    { id: 6, dates: "March 6", topics: "Revision" },
    { id: 7, dates: "March 7", topics: "Chemical Bonding + Structure of atom" },
    { id: 8, dates: "March 8", topics: "Chemical Bonding + Structure of atom + Revision + Full length paper (Mar 8 Sunday)" },
    { id: 9, dates: "March 9", topics: "Chemical kinetics + Aldehyde ketone" },
    { id: 10, dates: "March 10", topics: "Chemical kinetics + Aldehyde ketone + Chemo -> So Revision (Side Note)" },
    { id: 11, dates: "March 11", topics: "Chemical kinetics + Aldehyde ketone" },
    { id: 12, dates: "March 12", topics: "Periodicity classification of elements + Aliphatic Hydrocarbon" },
    { id: 13, dates: "March 13", topics: "Periodicity classification of elements + Aliphatic Hydrocarbon" },
    { id: 14, dates: "March 14", topics: "Revision" },
    { id: 15, dates: "March 15", topics: "d & f block + Biomolecules" },
    { id: 16, dates: "March 16", topics: "d & f block + Biomolecules" },
    { id: 17, dates: "March 17", topics: "Revision + Full length paper (Sunday)" },
    { id: 18, dates: "March 18", topics: "Coordination chemistry + Amines" },
    { id: 19, dates: "March 19", topics: "Coordination chemistry + Amines" },
    { id: 20, dates: "March 20", topics: "Revision" },
    { id: 21, dates: "March 21", topics: "Alcohol, phenol and ethers + Haloalkanes, Haloarenes" },
    { id: 22, dates: "March 22", topics: "Alcohol, phenol and ethers + Haloalkanes, Haloarenes" },
    { id: 23, dates: "March 23", topics: "Revision + Full length paper" },
    { id: 24, dates: "March 24", topics: "Principles, techniques + Equilibrium + Redox Rxn [less Important]" },
    { id: 25, dates: "March 25", topics: "Principles, techniques + Equilibrium + Redox Rxn [less Important]" },
    { id: 26, dates: "March 26", topics: "Principles, techniques + Equilibrium + Redox Rxn + Revision + Full length paper [less Important]" }
];

let scheduleData = [...defaultChemistrySchedule];
let savedProgress = {};

document.addEventListener('DOMContentLoaded', async () => {
    const scheduleList = document.getElementById('schedule-list');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-percentage');
    const resetBtn = document.getElementById('reset-btn');

    // Settings elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const settingsScheduleList = document.getElementById('settings-schedule-list');

    // Fetch initial data
    await fetchSchedule();
    await fetchProgress();

    function renderSchedule() {
        scheduleList.innerHTML = '';
        scheduleData.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `schedule-item ${savedProgress[item.id] ? 'completed' : ''}`;
            li.style.animationDelay = `${index * 0.05}s`;

            li.innerHTML = `
                <div class="checkbox"></div>
                <div class="item-content">
                    <span class="item-dates">${item.dates}</span>
                    <span class="item-topics">${item.topics}</span>
                </div>
            `;

            li.addEventListener('click', async () => {
                const isCompleted = li.classList.toggle('completed');
                savedProgress[item.id] = isCompleted;
                updateProgressUI();
                await saveProgress();
            });

            scheduleList.appendChild(li);
        });
        updateProgressUI();
    }

    function updateProgressUI() {
        const total = scheduleData.length;
        const completed = Object.values(savedProgress).filter(v => v).length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;

        if (percentage === 100 && total > 0) {
            progressBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
        } else {
            progressBar.style.background = 'linear-gradient(90deg, var(--accent-color), var(--success-color))';
        }
    }

    // --- API Calls ---
    async function fetchSchedule() {
        try {
            const res = await fetch('/api/chemistry/schedule');
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    scheduleData = data;
                }
            } else {
                console.warn("API returned error, using fallback schedule.");
            }
        } catch (err) {
            console.error("Failed to fetch schedule, using fallback:", err);
        }
    }

    async function fetchProgress() {
        try {
            const res = await fetch('/api/chemistry/progress');
            if (res.ok) {
                savedProgress = await res.json();
            }
        } catch (err) {
            console.error("Failed to fetch progress:", err);
        }
    }

    async function saveProgress() {
        try {
            await fetch('/api/chemistry/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(savedProgress)
            });
        } catch (err) {
            console.error("Failed to save progress:", err);
        }
    }

    async function saveSchedule(newSchedule) {
        try {
            await fetch('/api/chemistry/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSchedule)
            });
            scheduleData = newSchedule;
        } catch (err) {
            console.error("Failed to save schedule:", err);
        }
    }

    // --- Reset ---
    resetBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all progress? This will affect all devices.')) {
            savedProgress = {};
            await saveProgress();
            document.querySelectorAll('.schedule-item').forEach(li => li.classList.remove('completed'));
            updateProgressUI();
        }
    });

    // --- Settings Modal Logic ---
    function openSettings() {
        settingsScheduleList.innerHTML = '';
        scheduleData.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'settings-item';
            div.innerHTML = `
                <label>${item.dates}</label>
                <input type="text" data-id="${item.id}" value="${item.topics}">
            `;
            settingsScheduleList.appendChild(div);
        });
        settingsModal.classList.add('show');
    }

    function closeSettings() {
        settingsModal.classList.remove('show');
    }

    settingsBtn.addEventListener('click', openSettings);
    closeModalBtn.addEventListener('click', closeSettings);

    // Close on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
    });

    saveSettingsBtn.addEventListener('click', async () => {
        const inputs = settingsScheduleList.querySelectorAll('input');
        const newSchedule = scheduleData.map(item => {
            const input = Array.from(inputs).find(i => parseInt(i.dataset.id) === item.id);
            return {
                ...item,
                topics: input ? input.value : item.topics
            };
        });

        saveSettingsBtn.textContent = 'Saving...';
        saveSettingsBtn.disabled = true;

        await saveSchedule(newSchedule);
        renderSchedule(); // re-render the main UI

        saveSettingsBtn.textContent = 'Save Changes';
        saveSettingsBtn.disabled = false;
        closeSettings();
    });

    // Initial render
    renderSchedule();
});

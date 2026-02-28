const scheduleData = [
    { id: 1, dates: "March 1-2", topics: "Basic concept of chemistry + Thermodynamics" },
    { id: 2, dates: "March 3", topics: "Revision + Full length paper (Sunday)" },
    { id: 3, dates: "March 4-5", topics: "Electrochemistry + Solution" },
    { id: 4, dates: "March 6", topics: "Revision" },
    { id: 5, dates: "March 7-8", topics: "Chemical Bonding + Structure of atom + Revision + Full length paper (Mar 8 Sunday)" },
    { id: 6, dates: "March 9-11", topics: "Chemical kinetics + Aldehyde ketone" },
    { id: 7, dates: "March 10", topics: "Chemo -> So Revision (Side Note)" },
    { id: 8, dates: "March 12-13", topics: "Periodicity classification of elements + Aliphatic Hydrocarbon" },
    { id: 9, dates: "March 14", topics: "Revision" },
    { id: 10, dates: "March 15-16", topics: "d & f block + Biomolecules" },
    { id: 11, dates: "March 17", topics: "Revision + Full length paper (Sunday)" },
    { id: 12, dates: "March 18-19", topics: "Coordination chemistry + Amines" },
    { id: 13, dates: "March 20", topics: "Revision" },
    { id: 14, dates: "March 21-22", topics: "Alcohol, phenol and ethers + Haloalkanes, Haloarenes" },
    { id: 15, dates: "March 23", topics: "Revision + Full length paper" },
    { id: 16, dates: "March 24-26", topics: "Principles, techniques + Equilibrium + Redox Rxn + Revision + Full length paper [less Important]" }
];

document.addEventListener('DOMContentLoaded', () => {
    const scheduleList = document.getElementById('schedule-list');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-percentage');
    const resetBtn = document.getElementById('reset-btn');

    // Load saved progress from localStorage
    let savedProgress = JSON.parse(localStorage.getItem('chemistryScheduleProgress')) || {};

    // Generate list items
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

        li.addEventListener('click', () => {
            const isCompleted = li.classList.toggle('completed');
            savedProgress[item.id] = isCompleted;
            updateProgress();
            saveProgress();
        });

        scheduleList.appendChild(li);
    });

    function updateProgress() {
        const total = scheduleData.length;
        const completed = Object.values(savedProgress).filter(v => v).length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;

        if (percentage === 100) {
            progressBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
        } else {
            progressBar.style.background = 'linear-gradient(90deg, var(--accent-color), var(--success-color))';
        }
    }

    function saveProgress() {
        localStorage.setItem('chemistryScheduleProgress', JSON.stringify(savedProgress));
    }

    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all progress?')) {
            savedProgress = {};
            saveProgress();
            document.querySelectorAll('.schedule-item').forEach(li => li.classList.remove('completed'));
            updateProgress();
        }
    });

    // Initial update
    updateProgress();
});

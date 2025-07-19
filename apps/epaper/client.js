document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('newspaper-grid');
    const loader = document.getElementById('loader');
    const paperDateEl = document.getElementById('paper-date');

    try {
        const response = await fetch('/api/newspapers');
        if (!response.ok) {
            throw new Error('Failed to fetch newspapers.');
        }
        const data = await response.json();

        loader.style.display = 'none';
        paperDateEl.textContent = `Showing papers for: ${data.date}`;

        if (data.papers.length === 0) {
            grid.innerHTML = '<p>No newspapers could be found for today or yesterday.</p>';
            return;
        }

        data.papers.forEach(paper => {
            const card = document.createElement('a');
            card.className = 'paper-card';
            card.href = paper.link;
            card.target = '_blank'; // Open in new tab
            card.rel = 'noopener noreferrer';

            card.innerHTML = `
                <img src="${paper.logo}" alt="${paper.name} Logo">
                <div class="paper-name">${paper.name}</div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        loader.style.display = 'none';
        grid.innerHTML = `<p>Error loading newspapers. Please try again later.</p>`;
        console.error(error);
    }
});
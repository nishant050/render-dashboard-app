const API_BASE = '/api/crawler';

const App = {
    tasks: [],
    runs: [],

    init() {
        this.loadTasks();
        this.loadStorage();
        
        // Setup marked options for safe markdown rendering
        if (window.marked) {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
        }
    },

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.sidebar__nav-item').forEach(el => el.classList.remove('sidebar__nav-item--active'));
        
        const viewMap = {
            'tasks': 'tasks-view',
            'runs': 'runs-view',
            'run-detail': 'run-detail-view'
        };
        
        document.getElementById(viewMap[viewId]).style.display = 'block';
        
        // Active states
        if (viewId === 'tasks' || viewId === 'runs') {
             let btn = document.querySelector(`.sidebar__nav-item[onclick="App.switchView('${viewId}')"]`);
             if(btn) btn.classList.add('sidebar__nav-item--active');
        }

        if (viewId === 'tasks') this.loadTasks();
        if (viewId === 'runs') this.loadRuns();
    },

    // --- Data Fetching ---
    async loadTasks() {
        try {
            const res = await fetch(`${API_BASE}/tasks`);
            this.tasks = await res.json();
            this.renderTasks();
            this.updateTasksFilter();
        } catch (err) {
            console.error('Failed to load tasks', err);
        }
    },

    async loadRuns() {
        try {
            const filterMap = document.getElementById('task-filter').value;
            let url = `${API_BASE}/runs/${filterMap}`;
            if (!filterMap) {
                // To fetch all runs we would need an endpoint. For now, if no filter, try fetching all runs by omitting taskId...
                // But our API endpoint requires taskId. Let's adjust backend or fetch the first task runs.
                if (this.tasks.length > 0) {
                    document.getElementById('task-filter').value = this.tasks[0]._id;
                    url = `${API_BASE}/runs/${this.tasks[0]._id}`;
                } else {
                    this.renderRuns([]);
                    return;
                }
            }
            
            const res = await fetch(url);
            this.runs = await res.json();
            this.renderRuns();
        } catch (err) {
            console.error('Failed to load runs', err);
        }
    },

    async viewRun(id) {
        try {
            const res = await fetch(`${API_BASE}/runs/detail/${id}`);
            const run = await res.json();
            
            const task = this.tasks.find(t => t._id === run.taskId) || { name: 'Unknown Task' };
            
            document.getElementById('detail-task-name').innerText = task.name;
            document.getElementById('detail-status').innerText = run.status.toUpperCase();
            document.getElementById('detail-status').className = `badge status-${run.status}`;
            
            document.getElementById('detail-start').innerText = new Date(run.startTime).toLocaleString();
            document.getElementById('detail-end').innerText = run.endTime ? new Date(run.endTime).toLocaleString() : 'In Progress';
            document.getElementById('detail-urls-count').innerText = run.visitedUrls?.length || 0;
            
            // Markdown rendering
            const summaryBox = document.getElementById('detail-summary');
            if (run.finalSummary && window.marked) {
                summaryBox.innerHTML = marked.parse(run.finalSummary);
            } else if (run.error) {
                summaryBox.innerHTML = `<div style="color:var(--error); white-space:pre-wrap;">${run.error}</div>`;
            } else {
                summaryBox.innerHTML = '<i>No summary generated yet.</i>';
            }

            // URLs
            const ul = document.getElementById('detail-urls');
            ul.innerHTML = (run.visitedUrls || []).map(u => `<li><a href="${u}" target="_blank" style="color:inherit">${u}</a></li>`).join('');

            // Attachments
            const att = document.getElementById('detail-attachments');
            if (run.attachments && run.attachments.length > 0) {
                att.innerHTML = run.attachments.map(a => `<a href="${a.url}" target="_blank">📄 ${a.name}</a>`).join('');
            } else {
                att.innerHTML = '<i>No attachments found.</i>';
            }

            this.switchView('run-detail');
        } catch(err) {
            alert('Error loading run details: ' + err.message);
        }
    },

    // --- UI Rendering ---
    renderTasks() {
        const list = document.getElementById('tasks-list');
        list.innerHTML = this.tasks.map(t => `
            <div class="card" onclick="App.editTask('${t._id}')">
                <div class="card-meta">
                     <span class="badge ${t.isActive ? 'status-active' : 'status-paused'}">${t.isActive ? 'ACTIVE' : 'PAUSED'}</span>
                     <span>${t.primaryModel}</span>
                </div>
                <div class="card-title">${t.name}</div>
                <div style="font-size:0.875rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${t.startUrl}
                </div>
                <div style="font-size:0.8rem; margin-top:0.5rem; color:var(--text-muted);">
                    Next Run: ${new Date(t.nextRunAt).toLocaleString()}<br>
                    Every ${t.frequencyMinutes} mins
                </div>
            </div>
        `).join('');
    },

    renderRuns() {
        const list = document.getElementById('runs-list');
        if (!this.runs || this.runs.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted)">No runs recorded for this task yet.</p>';
            return;
        }

        list.innerHTML = this.runs.map(r => `
            <div class="card" onclick="App.viewRun('${r._id}')">
                <div class="card-meta">
                     <span class="badge status-${r.status}">${r.status.toUpperCase()}</span>
                     <span>${new Date(r.startTime).toLocaleString()}</span>
                </div>
                <div style="margin-top:0.5rem; display:flex; gap:1rem; color:var(--text-muted); font-size: 0.875rem;">
                    <span>🔗 ${r.visitedUrls?.length || 0} pages</span>
                    <span>📎 ${r.attachments?.length || 0} files</span>
                </div>
                <div style="margin-top:1rem; font-size: 0.8rem; height: 40px; overflow:hidden; text-overflow:ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--text-muted);">
                    ${r.status === 'success' ? (r.finalSummary ? r.finalSummary.replace(/<[^>]*>?/gm, '') : 'Finalized.') : (r.error || 'Processing...')}
                </div>
            </div>
        `).join('');
    },

    updateTasksFilter() {
        const select = document.getElementById('task-filter');
        select.innerHTML = '<option value="">Select a Task</option>' + this.tasks.map(t => `<option value="${t._id}">${t.name}</option>`).join('');
    },

    // --- Storage ---
    async loadStorage() {
        try {
            const res = await fetch(`${API_BASE}/storage/info`);
            const data = await res.json();
            const mb = (data.totalSizeBytes / (1024 * 1024)).toFixed(2);
            document.getElementById('storage-size').innerText = `${mb} MB (${data.fileCount} files)`;
        } catch (err) {
            console.error('Failed to load storage', err);
        }
    },

    async clearStorage() {
        if (!confirm('Are you sure you want to delete all downloaded attachment files? This cannot be undone.')) return;
        try {
            const res = await fetch(`${API_BASE}/storage/clear`, { method: 'DELETE' });
            const result = await res.json();
            alert(result.message);
            this.loadStorage();
            if (document.getElementById('runs-view').style.display === 'block') {
                this.loadRuns();
            }
        } catch(err) {
            alert('Failed to clear storage: ' + err.message);
        }
    },

    // --- Task Modal ---
    openTaskModal() {
        document.getElementById('task-id').value = '';
        document.getElementById('task-form').reset();
        document.getElementById('task-freq-val').value = 1;
        document.getElementById('task-freq-unit').value = 'days';
        document.getElementById('modal-title').innerText = 'Create New Task';
        document.getElementById('task-modal').classList.add('active');
    },

    editTask(id) {
        const task = this.tasks.find(t => t._id === id);
        if (!task) return;
        
        document.getElementById('task-id').value = task._id;
        document.getElementById('task-name').value = task.name;
        document.getElementById('task-url').value = task.startUrl;
        document.getElementById('task-goal').value = task.goal;
        
        // Convert frequencyMinutes back to unit based
        let val = task.frequencyMinutes;
        let unit = 'minutes';
        if (val >= 43200 && val % 43200 === 0) { val /= 43200; unit = 'months'; }
        else if (val >= 1440 && val % 1440 === 0) { val /= 1440; unit = 'days'; }
        else if (val >= 60 && val % 60 === 0) { val /= 60; unit = 'hours'; }

        document.getElementById('task-freq-val').value = val;
        document.getElementById('task-freq-unit').value = unit;
        
        document.getElementById('task-primary-model').value = task.primaryModel;
        document.getElementById('task-fallback-model').value = task.fallbackModel;

        document.getElementById('modal-title').innerText = 'Edit Task';
        document.getElementById('task-modal').classList.add('active');
    },

    closeTaskModal() {
        document.getElementById('task-modal').classList.remove('active');
    },

    async saveTask(e) {
        e.preventDefault();
        
        const id = document.getElementById('task-id').value;
        const freqVal = parseInt(document.getElementById('task-freq-val').value);
        const freqUnit = document.getElementById('task-freq-unit').value;
        
        let freqMinutes = freqVal;
        if (freqUnit === 'hours') freqMinutes *= 60;
        if (freqUnit === 'days') freqMinutes *= 1440;
        if (freqUnit === 'months') freqMinutes *= 43200;

        const payload = {
            name: document.getElementById('task-name').value,
            startUrl: document.getElementById('task-url').value,
            goal: document.getElementById('task-goal').value,
            frequencyMinutes: freqMinutes,
            primaryModel: document.getElementById('task-primary-model').value,
            fallbackModel: document.getElementById('task-fallback-model').value,
            isActive: true
        };

        try {
            let method = id ? 'PUT' : 'POST';
            let url = id ? `${API_BASE}/tasks/${id}` : `${API_BASE}/tasks`;

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(await res.text());

            this.closeTaskModal();
            this.loadTasks();
        } catch(err) {
            alert('Error saving task: ' + err.message);
        }
    }
};

window.onload = () => App.init();

const API_BASE = '/api/crawler';

const App = {
    tasks: [],
    runs: [],
    currentPollTimeout: null,
    currentRunId: null,

    init() {
        this.loadTasks();
        this.loadStorage();
        this.loadModels();
        
        // Setup marked options for safe markdown rendering
        if (window.marked) {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
        }
    },

    switchView(viewId) {
        if (viewId !== 'run-detail' && this.currentPollTimeout) {
            clearTimeout(this.currentPollTimeout);
            this.currentPollTimeout = null;
        }
        if (viewId !== 'run-detail') {
            this.currentRunId = null;
        }
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
            const url = filterMap ? `${API_BASE}/runs/${filterMap}` : `${API_BASE}/runs`;
            
            const res = await fetch(url);
            if (!res.ok) throw new Error(await res.text());
            this.runs = await res.json();
            this.renderRuns();
        } catch (err) {
            console.error('Failed to load runs', err);
        }
    },

    async viewRun(id) {
        try {
            this.currentRunId = id;
            const res = await fetch(`${API_BASE}/runs/detail/${id}`);
            const run = await res.json();
            
            const task = this.tasks.find(t => t._id === run.taskId) || { name: 'Unknown Task' };
            
            document.getElementById('detail-task-name').innerText = task.name;
            document.getElementById('detail-status').innerText = run.status.toUpperCase();
            document.getElementById('detail-status').className = `badge status-${run.status}`;
            const stopBtn = document.getElementById('detail-stop-btn');
            if (stopBtn) {
                stopBtn.style.display = run.status === 'running' ? 'inline-flex' : 'none';
                stopBtn.disabled = false;
                stopBtn.innerText = 'Stop & Summarize';
            }
            
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

            // Activity Console
            const consoleBox = document.getElementById('detail-activity-log');
            if (run.activityLog && run.activityLog.length > 0) {
                consoleBox.innerText = run.activityLog.join('\n');
            } else {
                consoleBox.innerText = '> Waiting for agent startup...';
            }
            // Auto scroll to bottom only if already active view to reduce jitter
            if (document.getElementById('run-detail-view').style.display !== 'none') {
                 consoleBox.scrollTop = consoleBox.scrollHeight;
            } else {
                 setTimeout(() => consoleBox.scrollTop = consoleBox.scrollHeight, 50);
            }

            this.switchView('run-detail');

            if (this.currentPollTimeout) {
                clearTimeout(this.currentPollTimeout);
                this.currentPollTimeout = null;
            }

            if (run.status === 'running' && this.currentRunId === run._id) {
                this.currentPollTimeout = setTimeout(async () => {
                    await this.viewRun(run._id);
                    if (document.getElementById('runs-view').style.display !== 'none') {
                        this.loadRuns();
                    }
                }, 3000);
            } else {
                this.loadRuns();
            }
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
                     <span style="display:flex; align-items:center; gap:0.5rem">
                         <span style="font-size:0.8rem">${t.primaryModel}</span>
                         <button class="btn btn-sm btn-primary" style="padding: 0.1rem 0.5rem; font-size: 0.75rem;" onclick="App.runTaskNow('${t._id}', event)">▶ RUN</button>
                     </span>
                </div>
                <div class="card-title">${t.name}</div>
                <div style="font-size:0.875rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${(t.startUrls || []).length} Target URLs
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
                     <span style="display:flex; align-items:center; gap:0.5rem">
                         <span>${new Date(r.startTime).toLocaleString()}</span>
                         <button class="btn btn-sm btn-secondary" style="padding: 0.1rem 0.4rem; font-size: 0.75rem; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25);" onclick="App.deleteRun('${r._id}', event)">🗑️</button>
                     </span>
                </div>
                <div style="margin-top:0.5rem; display:flex; gap:1rem; color:var(--text-muted); font-size: 0.875rem;">
                    <span>🔗 ${r.visitedUrls?.length || 0} pages</span>
                    <span>📎 ${r.attachments?.length || 0} files</span>
                </div>
                <div style="margin-top:1rem; font-size: 0.8rem; height: 40px; overflow:hidden; text-overflow:ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--text-muted);">
                    ${r.finalSummary ? r.finalSummary.replace(/<[^>]*>?/gm, '') : (r.status === 'running' ? 'Processing...' : (r.error || 'No summary available.'))}
                </div>
            </div>
        `).join('');
    },

    updateTasksFilter() {
        const select = document.getElementById('task-filter');
        const currentValue = select.value;
        select.innerHTML = '<option value="">All Tasks</option>' + this.tasks.map(t => `<option value="${t._id}">${t.name}</option>`).join('');
        select.value = currentValue;
    },

    async runTaskNow(taskId, e) {
        if (e) e.stopPropagation();
        if (!confirm('Execute this target task immediately?')) return;
        try {
            const res = await fetch(`${API_BASE}/tasks/${taskId}/run`, { method: 'POST' });
            if (!res.ok) throw new Error(await res.text());
            const run = await res.json();
            // Trigger UI View
            this.viewRun(run._id);
        } catch(err) {
            alert('Failed to execute task: ' + err.message);
        }
    },

    async stopCurrentRun() {
        if (!this.currentRunId) return;
        if (!confirm('Stop this running task and finalize a summary from the progress so far?')) return;

        const stopBtn = document.getElementById('detail-stop-btn');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.innerText = 'Stopping...';
        }

        try {
            const res = await fetch(`${API_BASE}/runs/${this.currentRunId}/stop`, { method: 'POST' });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(result.error || 'Failed to stop run');
            }

            await this.viewRun(this.currentRunId);
        } catch (err) {
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.innerText = 'Stop & Summarize';
            }
            alert('Failed to stop run: ' + err.message);
        }
    },

    async deleteRun(runId, event) {
        if (event) event.stopPropagation();
        
        const run = this.runs.find(r => r._id === runId);
        const isRunning = run && run.status === 'running';
        const confirmMsg = isRunning 
            ? 'This crawl is currently running. Stop and delete it?' 
            : 'Delete this run from history?';
            
        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`${API_BASE}/runs/${runId}`, { method: 'DELETE' });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || 'Failed to delete run');

            await this.loadRuns();
        } catch (err) {
            alert('Failed to delete run: ' + err.message);
        }
    },

    async deleteCurrentRun() {
        if (!this.currentRunId) return;
        
        const detailStatus = document.getElementById('detail-status').innerText;
        const isRunning = detailStatus === 'RUNNING';
        const confirmMsg = isRunning
            ? 'This crawl is currently running. Stop and delete it?'
            : 'Delete this run from history?';

        if (!confirm(confirmMsg)) return;

        const delBtn = document.getElementById('detail-delete-btn');
        if (delBtn) {
            delBtn.disabled = true;
            delBtn.innerText = 'Deleting...';
        }

        try {
            const res = await fetch(`${API_BASE}/runs/${this.currentRunId}`, { method: 'DELETE' });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || 'Failed to delete run');

            this.switchView('runs');
        } catch (err) {
            if (delBtn) {
                delBtn.disabled = false;
                delBtn.innerText = '🗑️ Delete Run';
            }
            alert('Failed to delete run: ' + err.message);
        }
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

    async clearHistory() {
        const selectedTaskId = document.getElementById('task-filter').value;
        const scope = selectedTaskId ? 'the selected task' : 'all tasks';
        if (!confirm(`Delete finished run history for ${scope}? Running jobs will be kept.`)) return;

        try {
            const url = selectedTaskId
                ? `${API_BASE}/runs?taskId=${encodeURIComponent(selectedTaskId)}`
                : `${API_BASE}/runs`;
            const res = await fetch(url, { method: 'DELETE' });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || 'Failed to clear history');

            alert(`${result.message} Deleted ${result.deletedCount || 0} run${result.deletedCount === 1 ? '' : 's'}.`);
            await this.loadRuns();
        } catch(err) {
            alert('Failed to clear history: ' + err.message);
        }
    },

    async loadModels() {
        try {
            const res = await fetch(`${API_BASE}/models`);
            let customModels = await res.json();
            
            if (!customModels || customModels.length === 0) {
                customModels = [
                    { provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Groq (Llama 3.3 70B)' },
                    { provider: 'openrouter', model: 'google/gemini-2.0-flash-001', label: 'OpenRouter (Gemini 2.0 Flash)' },
                    { provider: 'nvidia', model: 'z-ai/glm4.7', label: 'NVIDIA (GLM 4.7)' },
                    { provider: 'gemini', model: 'gemini-3.1-flash-lite-preview', label: 'Google Gemini (3.1 Flash Lite)' },
                    { provider: 'mistral', model: 'mistral-small-2603', label: 'Mistral (Small)' }
                ];
            }
            
            this.aiModels = customModels;
            this.updateModelSelects();
        } catch (err) {
            console.error('Failed to load shared models', err);
        }
    },

    updateModelSelects() {
        const primary = document.getElementById('task-primary-model');
        const fallback = document.getElementById('task-fallback-model');
        if (!primary || !fallback) return;

        const escapeHtml = (unsafe) => {
            return (unsafe||'').toString()
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;");
        };

        const optionsHtml = this.aiModels.map(m => 
            `<option value="${m.provider}|${m.model}">${escapeHtml(m.label || m.model)} (${m.provider})</option>`
        ).join('');

        const currentPrimaryVal = primary.value;
        const currentFallbackVal = fallback.value;

        primary.innerHTML = optionsHtml;
        fallback.innerHTML = optionsHtml;

        if (currentPrimaryVal) primary.value = currentPrimaryVal;
        if (currentFallbackVal) fallback.value = currentFallbackVal;
    },

    // --- Task Modal ---
    openTaskModal() {
        const delBtn = document.getElementById('btn-delete-task');
        if (delBtn) delBtn.style.display = 'none';
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
        
        const delBtn = document.getElementById('btn-delete-task');
        if (delBtn) delBtn.style.display = 'inline-flex';
        
        document.getElementById('task-id').value = task._id;
        document.getElementById('task-name').value = task.name;
        document.getElementById('task-urls').value = (task.startUrls || []).join('\n');
        document.getElementById('task-goal').value = task.goal;
        
        // Convert frequencyMinutes back to unit based
        let val = task.frequencyMinutes;
        let unit = 'minutes';
        if (val >= 43200 && val % 43200 === 0) { val /= 43200; unit = 'months'; }
        else if (val >= 1440 && val % 1440 === 0) { val /= 1440; unit = 'days'; }
        else if (val >= 60 && val % 60 === 0) { val /= 60; unit = 'hours'; }

        document.getElementById('task-freq-val').value = val;
        document.getElementById('task-freq-unit').value = unit;
        
        const checkAndAddMissing = (selectElement, val) => {
            if (!val) return;
            let exists = Array.from(selectElement.options).some(opt => opt.value === val);
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = val + ' (Deleted)';
                selectElement.add(opt);
            }
            selectElement.value = val;
        };

        checkAndAddMissing(document.getElementById('task-primary-model'), task.primaryModel);
        checkAndAddMissing(document.getElementById('task-fallback-model'), task.fallbackModel);

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
            startUrls: document.getElementById('task-urls').value.split('\n').map(u => u.trim()).filter(u => u),
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
    },

    async deleteTask() {
        const id = document.getElementById('task-id').value;
        if (!id) return;
        if (!confirm('Are you sure you want to delete this crawler task? All run history associated with this task will be permanently deleted, and any currently running crawls will be stopped.')) return;

        try {
            const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || 'Failed to delete task');

            this.closeTaskModal();
            this.loadTasks();
        } catch (err) {
            alert('Failed to delete task: ' + err.message);
        }
    }
};

window.onload = () => App.init();

async function saveNotes(notes) {
    // This is no longer used for bulk saving in the new API
    // but we keep the signature if needed for migration
}

async function loadNotes() {
    try {
        const response = await fetch('/api/quicknotes');
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Failed to load notes:', e);
        return [];
    }
}

async function renderNotes() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '<div class="note-card">Loading notes...</div>';
    
    const notes = await loadNotes();
    list.innerHTML = '';
    
    if (!notes.length) {
        list.innerHTML = '<div class="note-card">No notes yet — write something!</div>';
        return;
    }
    
    notes.forEach((n) => {
        const el = document.createElement('div');
        el.className = 'note-card';
        const meta = document.createElement('div');
        meta.className = 'note-meta';
        const title = document.createElement('strong');
        title.textContent = n.title || 'Untitled';
        const ts = document.createElement('span');
        ts.textContent = new Date(n.createdAt).toLocaleString();
        meta.appendChild(title);
        meta.appendChild(ts);

        const content = document.createElement('div');
        content.style.marginTop = '0.5rem';
        content.textContent = n.content;

        const actions = document.createElement('div');
        actions.style.marginTop = '0.5rem';
        const del = document.createElement('button');
        del.textContent = 'Delete';
        del.onclick = () => deleteNote(n._id);
        actions.appendChild(del);

        el.appendChild(meta);
        el.appendChild(content);
        el.appendChild(actions);
        list.appendChild(el);
    });
}

async function addNote(title, content) {
    try {
        await fetch('/api/quicknotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        await renderNotes();
    } catch (e) {
        alert('Failed to add note');
    }
}

async function deleteNote(id) {
    if (!id) return;
    try {
        await fetch(`/api/quicknotes/${id}`, { method: 'DELETE' });
        await renderNotes();
    } catch (e) {
        alert('Failed to delete note');
    }
}

async function clearAll() {
    if (!confirm('Clear all notes?')) return;
    try {
        await fetch('/api/quicknotes', { method: 'DELETE' });
        await renderNotes();
    } catch (e) {
        alert('Failed to clear notes');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-note-btn');
    const newBtn = document.getElementById('new-note-btn');
    const clearBtn = document.getElementById('clear-all-btn');

    saveBtn.addEventListener('click', async () => {
        const title = document.getElementById('note-title').value.trim();
        const content = document.getElementById('note-content').value.trim();
        if (!content) return alert('Please enter some content for the note.');
        
        saveBtn.disabled = true;
        await addNote(title, content);
        saveBtn.disabled = false;
        
        document.getElementById('note-content').value = '';
        document.getElementById('note-title').value = '';
    });

    newBtn.addEventListener('click', () => {
        document.getElementById('note-content').value = '';
        document.getElementById('note-title').value = '';
    });

    clearBtn.addEventListener('click', clearAll);

    renderNotes();
});

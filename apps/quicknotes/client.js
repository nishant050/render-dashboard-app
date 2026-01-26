const STORAGE_KEY = 'quicknotes_v1';

function saveNotes(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function loadNotes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY) || '[]';
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

function renderNotes() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    const notes = loadNotes().slice().reverse();
    if (!notes.length) {
        list.innerHTML = '<div class="note-card">No notes yet — write something!</div>';
        return;
    }
    notes.forEach((n, idx) => {
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
        del.onclick = () => deleteNote(notes.length - 1 - idx);
        actions.appendChild(del);

        el.appendChild(meta);
        el.appendChild(content);
        el.appendChild(actions);
        list.appendChild(el);
    });
}

function addNote(title, content) {
    const notes = loadNotes();
    notes.push({ title, content, createdAt: Date.now() });
    saveNotes(notes);
    renderNotes();
}

function deleteNote(index) {
    const notes = loadNotes();
    if (index < 0 || index >= notes.length) return;
    notes.splice(index, 1);
    saveNotes(notes);
    renderNotes();
}

function clearAll() {
    if (!confirm('Clear all notes?')) return;
    saveNotes([]);
    renderNotes();
}

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-note-btn');
    const newBtn = document.getElementById('new-note-btn');
    const clearBtn = document.getElementById('clear-all-btn');

    saveBtn.addEventListener('click', () => {
        const title = document.getElementById('note-title').value.trim();
        const content = document.getElementById('note-content').value.trim();
        if (!content) return alert('Please enter some content for the note.');
        addNote(title, content);
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

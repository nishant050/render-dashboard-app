const SAVE_DELAY = 420;

const NOTE_COLORS = [
    { id: 'linen', label: 'Warm paper', swatch: '#f7e7bf' },
    { id: 'sunbeam', label: 'Sunbeam', swatch: '#ffd966' },
    { id: 'blush', label: 'Blush', swatch: '#f7b2c3' },
    { id: 'mint', label: 'Mint', swatch: '#9fdfb2' },
    { id: 'sky', label: 'Sky', swatch: '#9ccbf7' },
    { id: 'lavender', label: 'Lavender', swatch: '#c7aff8' }
];

const COLOR_MAP = Object.fromEntries(NOTE_COLORS.map((color) => [color.id, color]));

const ICONS = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3a1 1 0 0 1 1 1v2.09l3.12 3.12a1 1 0 0 1-.71 1.7H13v4.67l1.7 1.71A1 1 0 0 1 14 19H10a1 1 0 0 1-.71-1.71L11 15.58V10.9H6.59a1 1 0 0 1-.71-1.7L9 6.09V4a1 1 0 0 1 1-1z"></path></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18.3 5.71-6.29 6.3-6.3-6.3-1.41 1.42 6.3 6.29-6.3 6.3 1.41 1.41 6.3-6.3 6.29 6.3 1.42-1.41-6.3-6.3 6.3-6.29z"></path></svg>',
    duplicate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H10V7h9z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l-1 14H7zm9-3 1 2h4v2H4V6h4l1-2z"></path></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path></svg>'
};

const state = {
    loading: true,
    error: '',
    query: '',
    notes: [],
    composer: createComposerState(),
    editor: createEditorState()
};

const dom = {};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch((error) => {
        console.error('Quicknotes initialization failed:', error);
        setBoardStatus('Unable to load notes');
    });
});

function createComposerState() {
    return {
        id: null,
        title: '',
        content: '',
        color: 'linen',
        pinned: false,
        isEncrypted: false,
        password: null,
        expanded: false,
        status: 'Start typing to create a note',
        timer: null,
        revision: 0,
        syncedRevision: 0,
        processing: false,
        activePromise: null
    };
}

function createEditorState() {
    return {
        open: false,
        id: null,
        title: '',
        content: '',
        color: 'linen',
        pinned: false,
        isEncrypted: false,
        password: null,
        updatedAt: '',
        status: 'Saved',
        timer: null,
        revision: 0,
        syncedRevision: 0,
        processing: false,
        activePromise: null
    };
}

async function initializeApp() {
    cacheDom();
    hydrateStaticButtons();
    renderComposerPalette();
    renderEditorPalette();
    renderComposer();
    renderEditor();
    bindEvents();
    await refreshNotes();
}

function cacheDom() {
    dom.searchInput = document.getElementById('search-input');
    dom.boardStatus = document.getElementById('board-status');
    dom.clearAllBtn = document.getElementById('clear-all-btn');

    dom.emptyState = document.getElementById('empty-state');
    dom.pinnedSection = document.getElementById('pinned-section');
    dom.otherSection = document.getElementById('other-section');
    dom.pinnedSectionCount = document.getElementById('pinned-section-count');
    dom.otherSectionCount = document.getElementById('other-section-count');
    dom.pinnedNotes = document.getElementById('pinned-notes');
    dom.otherNotes = document.getElementById('other-notes');

    dom.composerShell = document.getElementById('composer-shell');
    dom.composerTitle = document.getElementById('composer-title');
    dom.composerContent = document.getElementById('composer-content');
    dom.composerStatus = document.getElementById('composer-status');
    dom.composerColorLabel = document.getElementById('composer-color-label');
    dom.composerColors = document.getElementById('composer-colors');
    dom.composerLockBtn = document.getElementById('composer-lock-btn');
    dom.composerPinBtn = document.getElementById('composer-pin-btn');

    dom.editorOverlay = document.getElementById('editor-overlay');
    dom.editorCard = document.getElementById('editor-card');
    dom.editorCloseBtn = document.getElementById('editor-close-btn');
    dom.editorTitle = document.getElementById('editor-title');
    dom.editorContent = document.getElementById('editor-content');
    dom.editorColors = document.getElementById('editor-colors');
    dom.editorLockBtn = document.getElementById('editor-lock-btn');
    dom.editorPinBtn = document.getElementById('editor-pin-btn');
    dom.editorDuplicateBtn = document.getElementById('editor-duplicate-btn');
    dom.editorDeleteBtn = document.getElementById('editor-delete-btn');
    dom.editorStatus = document.getElementById('editor-status');
    dom.editorTimestamp = document.getElementById('editor-timestamp');

    dom.passwordModal = document.getElementById('password-modal');
    dom.passwordModalTitle = document.getElementById('password-modal-title');
    dom.passwordModalInput = document.getElementById('password-modal-input');
    dom.passwordModalError = document.getElementById('password-modal-error');
    dom.passwordModalForm = document.getElementById('password-modal-form');
    dom.passwordModalCancel = document.getElementById('password-modal-cancel');
}

function hydrateStaticButtons() {
    dom.composerLockBtn.innerHTML = ICONS.lock;
    dom.composerPinBtn.innerHTML = ICONS.pin;
    dom.editorCloseBtn.innerHTML = ICONS.close;
}

function bindEvents() {
    dom.searchInput.addEventListener('input', (event) => {
        state.query = event.target.value.trim().toLowerCase();
        renderBoard();
    });

    dom.clearAllBtn.addEventListener('click', handleClearAll);

    dom.composerShell.addEventListener('focusin', expandComposer);
    dom.composerTitle.addEventListener('input', handleComposerInput);
    dom.composerContent.addEventListener('input', handleComposerInput);
    dom.composerPinBtn.addEventListener('click', () => {
        state.composer.pinned = !state.composer.pinned;
        markComposerDirty(true);
    });

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleGlobalKeyDown);

    dom.editorOverlay.addEventListener('click', (event) => {
        if (event.target === dom.editorOverlay) {
            closeEditor();
        }
    });

    dom.editorCloseBtn.addEventListener('click', closeEditor);
    dom.editorTitle.addEventListener('input', handleEditorInput);
    dom.editorContent.addEventListener('input', handleEditorInput);
    dom.editorPinBtn.addEventListener('click', () => {
        state.editor.pinned = !state.editor.pinned;
        markEditorDirty(true);
    });
    dom.editorDuplicateBtn.addEventListener('click', handleDuplicateFromEditor);
    dom.editorDeleteBtn.addEventListener('click', handleDeleteFromEditor);

    dom.composerLockBtn.addEventListener('click', handleComposerLock);
    dom.editorLockBtn.addEventListener('click', handleEditorLock);

    dom.passwordModalForm.addEventListener('submit', handlePasswordSubmit);
    dom.passwordModalCancel.addEventListener('click', hidePasswordModal);
}

let passwordModalCallback = null;

function showPasswordModal(resolveCallback, isUnlock = false) {
    passwordModalCallback = resolveCallback;
    dom.passwordModalTitle.textContent = isUnlock ? "Unlock Note" : "Set Password";
    document.getElementById('password-modal-message').textContent = isUnlock ? "Enter the password to unlock this note." : "Enter a password to encrypt this note.";
    dom.passwordModalInput.value = '';
    dom.passwordModalError.hidden = true;
    dom.passwordModal.hidden = false;
    window.requestAnimationFrame(() => dom.passwordModalInput.focus());
}

function hidePasswordModal() {
    dom.passwordModal.hidden = true;
    if (passwordModalCallback) {
        passwordModalCallback(null);
        passwordModalCallback = null;
    }
}

function handlePasswordSubmit(e) {
    e.preventDefault();
    const pwd = dom.passwordModalInput.value;
    if (pwd && passwordModalCallback) {
        passwordModalCallback(pwd);
        passwordModalCallback = null; // Do not hide yet, wait for validation when unlocking
    }
}

function handleComposerLock() {
    if (state.composer.isEncrypted) {
        state.composer.isEncrypted = false;
        state.composer.password = null;
        markComposerDirty(true);
    } else {
        showPasswordModal((pwd) => {
            if (pwd) {
                state.composer.isEncrypted = true;
                state.composer.password = pwd;
                markComposerDirty(true);
                dom.passwordModal.hidden = true;
            }
        });
    }
}

function handleEditorLock() {
    if (state.editor.isEncrypted) {
        state.editor.isEncrypted = false;
        state.editor.password = null;
        markEditorDirty(true);
    } else {
        showPasswordModal((pwd) => {
            if (pwd) {
                state.editor.isEncrypted = true;
                state.editor.password = pwd;
                markEditorDirty(true);
                dom.passwordModal.hidden = true;
            }
        });
    }
}

function handlePointerDown(event) {
    const clickedInsideComposer = dom.composerShell.contains(event.target);
    if (state.composer.expanded && !clickedInsideComposer && !state.editor.open) {
        closeComposer();
    }
}

function handleGlobalKeyDown(event) {
    if (event.key === 'Escape') {
        if (state.editor.open) {
            closeEditor();
            return;
        }

        if (state.composer.expanded) {
            closeComposer();
        }
    }
}

async function refreshNotes() {
    state.loading = true;
    state.error = '';
    setBoardStatus('Loading notes...');
    renderBoard();

    try {
        const notes = await loadNotes();
        state.notes = sortNotes(notes.map(normalizeNote));
        if (state.editor.open) {
            syncEditorFromLatestState();
        }
    } catch (error) {
        console.error('Failed to refresh notes:', error);
        state.error = 'Unable to load notes right now';
    } finally {
        state.loading = false;
        renderBoard();
    }
}

function handleComposerInput() {
    state.composer.title = dom.composerTitle.value;
    state.composer.content = dom.composerContent.value;
    expandComposer();
    markComposerDirty(false);
}

function handleEditorInput() {
    state.editor.title = dom.editorTitle.value;
    state.editor.content = dom.editorContent.value;
    markEditorDirty(false);
}

function expandComposer() {
    if (!state.composer.expanded) {
        state.composer.expanded = true;
        renderComposer();
    }
}

async function closeComposer() {
    clearTimeout(state.composer.timer);

    if (!state.composer.expanded) {
        return;
    }

    const payload = getComposerPayload();
    if (!payload.title && !payload.content) {
        if (state.composer.id) {
            await removeNote(state.composer.id);
        }
        resetComposer();
        return;
    }

    const saved = await flushComposer();
    resetComposer();
}

function resetComposer() {
    clearTimeout(state.composer.timer);
    state.composer = createComposerState();
    renderComposerPalette();
    renderComposer();
}

function renderComposer() {
    dom.composerShell.classList.toggle('is-expanded', state.composer.expanded);
    dom.composerShell.classList.toggle('is-compact', !state.composer.expanded);
    dom.composerShell.dataset.color = state.composer.color;
    dom.composerLockBtn.classList.toggle('is-active', state.composer.isEncrypted);
    dom.composerLockBtn.title = state.composer.isEncrypted ? 'Remove password' : 'Set password';
    dom.composerPinBtn.classList.toggle('is-active', state.composer.pinned);
    dom.composerStatus.textContent = state.composer.status;
    dom.composerColorLabel.textContent = COLOR_MAP[state.composer.color].label;
    setInputValue(dom.composerTitle, state.composer.title);
    setInputValue(dom.composerContent, state.composer.content);
    dom.composerContent.placeholder = state.composer.expanded ? 'Take a note...' : 'Take a note...';
    autoResizeTextarea(dom.composerContent, state.composer.expanded ? 240 : 72);
}

function renderComposerPalette() {
    renderPalette(dom.composerColors, state.composer.color, (colorId) => {
        state.composer.color = colorId;
        markComposerDirty(true);
    });
}

function markComposerDirty(saveImmediately) {
    state.composer.revision += 1;
    state.composer.status = state.composer.id ? 'Saving changes...' : 'Saving note...';
    renderComposer();
    renderComposerPalette();
    scheduleComposerSave(saveImmediately);
}

function scheduleComposerSave(saveImmediately) {
    clearTimeout(state.composer.timer);

    const payload = getComposerPayload();
    if (!payload.title && !payload.content && !state.composer.id) {
        state.composer.status = 'Start typing to create a note';
        renderComposer();
        return;
    }

    const delay = saveImmediately ? 10 : SAVE_DELAY;
    state.composer.timer = setTimeout(() => {
        processComposerQueue();
    }, delay);
}

async function flushComposer() {
    clearTimeout(state.composer.timer);
    if (state.composer.processing) {
        await state.composer.activePromise;
    }

    if (state.composer.syncedRevision >= state.composer.revision && state.composer.id) {
        return true;
    }

    return processComposerQueue(true);
}

async function processComposerQueue(force = false) {
    if (state.composer.processing) {
        return state.composer.activePromise;
    }

    state.composer.processing = true;
    state.composer.activePromise = (async () => {
        let saved = true;

        while (state.composer.syncedRevision < state.composer.revision || force) {
            force = false;

            const payload = getComposerPayload();
            const revision = state.composer.revision;

            if (payload.isEncrypted && payload.password) {
                payload.content = await encryptData(payload.content || '', payload.password);
            }
            
            // Ensure password never leaves the browser
            delete payload.password;

            if (!payload.title && !payload.content && !state.composer.id) {
                state.composer.syncedRevision = revision;
                break;
            }

            state.composer.status = state.composer.id ? 'Saving changes...' : 'Creating note...';
            renderComposer();

            try {
                const note = state.composer.id
                    ? await updateNote(state.composer.id, payload)
                    : await createNote(payload);

                state.composer.id = note._id;
                state.composer.syncedRevision = revision;
                state.composer.status = 'Saved just now';
                upsertNote(note);
            } catch (error) {
                saved = false;
                state.composer.status = error.message || 'Unable to save note';
                renderComposer();
                break;
            }
        }

        state.composer.processing = false;
        state.composer.activePromise = null;
        renderComposer();
        return saved;
    })();

    return state.composer.activePromise;
}

function getComposerPayload() {
    return {
        title: state.composer.title,
        content: state.composer.content,
        color: state.composer.color,
        pinned: state.composer.pinned,
        isEncrypted: state.composer.isEncrypted,
        password: state.composer.password
    };
}

function renderEditorPalette() {
    renderPalette(dom.editorColors, state.editor.color, (colorId) => {
        state.editor.color = colorId;
        markEditorDirty(true);
    });
}

function renderEditor() {
    dom.editorOverlay.hidden = !state.editor.open;
    document.body.classList.toggle('editor-open', state.editor.open);

    if (!state.editor.open) {
        return;
    }

    dom.editorCard.dataset.color = state.editor.color;
    dom.editorStatus.textContent = state.editor.status;
    dom.editorTimestamp.textContent = state.editor.updatedAt ? `Updated ${formatDateTime(state.editor.updatedAt)}` : '';
    dom.editorLockBtn.classList.toggle('is-active', state.editor.isEncrypted);
    dom.editorLockBtn.textContent = state.editor.isEncrypted ? 'Locked' : 'Lock';
    dom.editorPinBtn.classList.toggle('is-active', state.editor.pinned);
    dom.editorPinBtn.textContent = state.editor.pinned ? 'Pinned' : 'Pin';
    setInputValue(dom.editorTitle, state.editor.title);
    setInputValue(dom.editorContent, state.editor.content);
    autoResizeTextarea(dom.editorContent, 520);
}

function markEditorDirty(saveImmediately) {
    state.editor.revision += 1;
    state.editor.status = 'Saving changes...';
    renderEditor();
    renderEditorPalette();
    scheduleEditorSave(saveImmediately);
}

function scheduleEditorSave(saveImmediately) {
    clearTimeout(state.editor.timer);
    if (!state.editor.open || !state.editor.id) {
        return;
    }

    const delay = saveImmediately ? 10 : SAVE_DELAY;
    state.editor.timer = setTimeout(() => {
        processEditorQueue();
    }, delay);
}

async function processEditorQueue(force = false) {
    if (state.editor.processing) {
        return state.editor.activePromise;
    }

    state.editor.processing = true;
    state.editor.activePromise = (async () => {
        let saved = true;

        while ((state.editor.syncedRevision < state.editor.revision || force) && state.editor.id) {
            force = false;
            const revision = state.editor.revision;
            const payload = getEditorPayload();
            if (payload.isEncrypted && payload.password) {
                payload.content = await encryptData(payload.content || '', payload.password);
            }
            
            // Ensure password never leaves the browser
            delete payload.password;

            try {
                const note = await updateNote(state.editor.id, payload);
                state.editor.syncedRevision = revision;
                state.editor.updatedAt = note.updatedAt;
                state.editor.status = 'Saved';
                upsertNote(note);
            } catch (error) {
                saved = false;
                state.editor.status = error.message || 'Unable to save note';
                renderEditor();
                break;
            }
        }

        state.editor.processing = false;
        state.editor.activePromise = null;
        renderEditor();
        return saved;
    })();

    return state.editor.activePromise;
}

async function closeEditor() {
    clearTimeout(state.editor.timer);
    if (!state.editor.open) {
        return;
    }

    const payload = getEditorPayload();
    if (!payload.title && !payload.content) {
        await removeNote(state.editor.id);
        resetEditor();
        return;
    }

    if (state.editor.processing) {
        await state.editor.activePromise;
    }

    const saved = state.editor.syncedRevision >= state.editor.revision
        ? true
        : await processEditorQueue(true);

    resetEditor();
}

function resetEditor() {
    clearTimeout(state.editor.timer);
    state.editor = createEditorState();
    renderEditorPalette();
    renderEditor();
}

function getEditorPayload() {
    return {
        title: state.editor.title,
        content: state.editor.content,
        color: state.editor.color,
        pinned: state.editor.pinned,
        isEncrypted: state.editor.isEncrypted,
        password: state.editor.password
    };
}

function openEditor(noteId) {
    const note = state.notes.find((entry) => entry._id === noteId);
    if (!note) {
        return;
    }

    if (note.isEncrypted) {
        showPasswordModal(async (pwd) => {
            if (!pwd) return;
            try {
                const plaintext = await decryptData(note.content, pwd);
                dom.passwordModal.hidden = true;
                completeOpenEditor(note, plaintext, pwd);
            } catch (err) {
                dom.passwordModalError.textContent = "Incorrect password.";
                dom.passwordModalError.hidden = false;
            }
        }, true);
    } else {
        completeOpenEditor(note, note.content, null);
    }
}

function completeOpenEditor(note, content, password) {
    state.editor = {
        ...createEditorState(),
        open: true,
        id: note._id,
        title: note.title,
        content: content,
        color: note.color,
        pinned: note.pinned,
        isEncrypted: note.isEncrypted,
        password: password,
        updatedAt: note.updatedAt
    };

    renderEditorPalette();
    renderEditor();
    window.requestAnimationFrame(() => {
        dom.editorContent.focus();
        dom.editorContent.setSelectionRange(dom.editorContent.value.length, dom.editorContent.value.length);
    });
}

function syncEditorFromLatestState() {
    const note = state.notes.find((entry) => entry._id === state.editor.id);
    if (!note) {
        resetEditor();
        return;
    }

    if (state.editor.processing || state.editor.syncedRevision < state.editor.revision) {
        state.editor.updatedAt = note.updatedAt;
        renderEditor();
        return;
    }

    state.editor.title = note.title;
    if (!note.isEncrypted || !state.editor.isEncrypted) {
        state.editor.content = note.content;
    }
    state.editor.color = note.color;
    state.editor.pinned = note.pinned;
    state.editor.isEncrypted = note.isEncrypted;
    state.editor.updatedAt = note.updatedAt;
    renderEditorPalette();
    renderEditor();
}

async function handleClearAll() {
    if (!state.notes.length) {
        return;
    }

    const confirmed = window.confirm('Clear every note from the board?');
    if (!confirmed) {
        return;
    }

    try {
        clearTimeout(state.composer.timer);
        clearTimeout(state.editor.timer);

        if (state.composer.processing) {
            await state.composer.activePromise;
        }

        if (state.editor.processing) {
            await state.editor.activePromise;
        }

        await apiRequest('/api/quicknotes', { method: 'DELETE' });
        state.notes = [];
        resetComposer();
        resetEditor();
        renderBoard();
    } catch (error) {
        setBoardStatus(error.message || 'Unable to clear notes');
    }
}

async function handleDuplicateFromEditor() {
    if (!state.editor.id) {
        return;
    }

    const payload = getEditorPayload();
    if (payload.isEncrypted && payload.password) {
        payload.content = await encryptData(payload.content || '', payload.password);
    }
    
    // Ensure password never leaves the browser on duplicate
    delete payload.password;
    
    await duplicateNote(payload);
}

async function handleDeleteFromEditor() {
    if (!state.editor.id) {
        return;
    }

    await removeNote(state.editor.id);
    resetEditor();
}

function renderBoard() {
    const filteredNotes = getFilteredNotes();
    const pinned = filteredNotes.filter((note) => note.pinned);
    const others = filteredNotes.filter((note) => !note.pinned);


    dom.pinnedSectionCount.textContent = String(pinned.length);
    dom.otherSectionCount.textContent = String(others.length);
    dom.clearAllBtn.hidden = state.notes.length === 0;

    dom.emptyState.hidden = state.loading || state.notes.length > 0 || Boolean(state.query);
    dom.pinnedSection.hidden = pinned.length === 0 || state.loading;
    dom.otherSection.hidden = others.length === 0 || state.loading;

    renderBoardColumn(dom.pinnedNotes, pinned);
    renderBoardColumn(dom.otherNotes, others);

    if (state.loading) {
        dom.emptyState.hidden = true;
        dom.pinnedSection.hidden = false;
        dom.otherSection.hidden = false;
        renderLoadingState(dom.pinnedNotes);
        renderLoadingState(dom.otherNotes);
    } else if (!filteredNotes.length) {
        if (state.query) {
            dom.emptyState.hidden = false;
            dom.emptyState.querySelector('h2').textContent = 'No matches found';
            dom.emptyState.querySelector('p').textContent = `Try a different search than "${state.query}".`;
        } else if (!state.notes.length) {
            dom.emptyState.hidden = false;
            dom.emptyState.querySelector('h2').textContent = 'No notes yet';
            dom.emptyState.querySelector('p').textContent = 'Start typing in the composer above and your first note will appear instantly.';
        }
        dom.pinnedSection.hidden = true;
        dom.otherSection.hidden = true;
    }

    if (state.error) {
        setBoardStatus(state.error);
    } else if (state.loading) {
        setBoardStatus('Loading notes...');
    } else if (state.query) {
        setBoardStatus(`${filteredNotes.length} matches`);
    } else {
        setBoardStatus(`${state.notes.length} notes in sync`);
    }
}

function renderBoardColumn(container, notes) {
    container.innerHTML = '';

    notes.forEach((note) => {
        container.appendChild(buildNoteCard(note));
    });
}

function renderLoadingState(container) {
    container.innerHTML = '';
    for (let index = 0; index < 2; index += 1) {
        const card = document.createElement('article');
        card.className = 'note-card';
        card.dataset.color = NOTE_COLORS[index % NOTE_COLORS.length].id;
        card.innerHTML = `
            <div class="note-top">
                <div>
                    <h3 class="note-title">Loading note...</h3>
                </div>
            </div>
            <p class="note-content">Please wait while the board loads.</p>
        `;
        container.appendChild(card);
    }
}

function buildNoteCard(note) {
    const article = document.createElement('article');
    article.className = 'note-card';
    article.dataset.color = note.color;
    article.addEventListener('click', () => openEditor(note._id));

    const header = document.createElement('div');
    header.className = 'note-top';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'note-title';
    title.textContent = note.title || 'Untitled';
    titleWrap.appendChild(title);

    const pinIndicator = document.createElement('button');
    pinIndicator.className = `note-action${note.pinned ? ' is-active' : ''}`;
    pinIndicator.type = 'button';
    pinIndicator.title = note.pinned ? 'Unpin note' : 'Pin note';
    pinIndicator.innerHTML = ICONS.pin;
    pinIndicator.addEventListener('click', (event) => {
        event.stopPropagation();
        togglePin(note);
    });

    header.appendChild(titleWrap);
    header.appendChild(pinIndicator);

    const content = document.createElement('p');
    content.className = 'note-content';
    if (note.isEncrypted) {
        content.classList.add('is-locked');
        content.innerHTML = `${ICONS.lock} Encrypted note`;
    } else {
        content.textContent = note.content || 'Open to start writing more.';
        if (!note.content) {
            content.classList.add('is-empty');
        }
    }

    const footer = document.createElement('div');
    footer.className = 'note-footer';

    const meta = document.createElement('span');
    meta.className = 'note-meta';
    meta.textContent = `Updated ${formatDateTime(note.updatedAt || note.createdAt)}`;

    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const swatches = document.createElement('div');
    swatches.className = 'note-swatches';
    NOTE_COLORS.forEach((color) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `palette-btn${color.id === note.color ? ' is-active' : ''}`;
        chip.style.background = color.swatch;
        chip.title = color.label;
        chip.addEventListener('click', (event) => {
            event.stopPropagation();
            quickPatchNote(note._id, { color: color.id });
        });
        swatches.appendChild(chip);
    });

    const duplicateBtn = document.createElement('button');
    duplicateBtn.type = 'button';
    duplicateBtn.className = 'note-action';
    duplicateBtn.title = 'Duplicate note';
    duplicateBtn.innerHTML = ICONS.duplicate;
    duplicateBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await duplicateNote(note);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'note-action note-action-danger';
    deleteBtn.title = 'Delete note';
    deleteBtn.innerHTML = ICONS.trash;
    deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await removeNote(note._id);
    });

    actions.appendChild(swatches);
    actions.appendChild(duplicateBtn);
    actions.appendChild(deleteBtn);

    footer.appendChild(meta);
    footer.appendChild(actions);

    article.appendChild(header);
    article.appendChild(content);
    article.appendChild(footer);

    return article;
}

function renderPalette(container, activeColorId, onSelect) {
    container.innerHTML = '';

    NOTE_COLORS.forEach((color) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `palette-btn${color.id === activeColorId ? ' is-active' : ''}`;
        button.style.background = color.swatch;
        button.title = color.label;
        button.addEventListener('click', () => onSelect(color.id));
        container.appendChild(button);
    });
}

function getFilteredNotes() {
    if (!state.query) {
        return state.notes;
    }

    return state.notes.filter((note) => {
        const haystack = `${note.title} ${note.content}`.toLowerCase();
        return haystack.includes(state.query);
    });
}

function normalizeNote(note) {
    return {
        _id: note._id,
        title: typeof note.title === 'string' ? note.title : '',
        content: typeof note.content === 'string' ? note.content : '',
        color: COLOR_MAP[note.color] ? note.color : 'linen',
        pinned: Boolean(note.pinned),
        isEncrypted: Boolean(note.isEncrypted),
        createdAt: note.createdAt || new Date().toISOString(),
        updatedAt: note.updatedAt || note.createdAt || new Date().toISOString()
    };
}

function sortNotes(notes) {
    return [...notes].sort((left, right) => {
        if (left.pinned !== right.pinned) {
            return Number(right.pinned) - Number(left.pinned);
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

function upsertNote(note) {
    const normalized = normalizeNote(note);
    const next = state.notes.filter((entry) => entry._id !== normalized._id);
    next.push(normalized);
    state.notes = sortNotes(next);

    if (state.editor.open && state.editor.id === normalized._id) {
        syncEditorFromLatestState();
    }

    renderBoard();
}

async function quickPatchNote(id, changes) {
    const existing = state.notes.find((note) => note._id === id);
    if (!existing) {
        return;
    }

    const optimistic = normalizeNote({
        ...existing,
        ...changes,
        updatedAt: new Date().toISOString()
    });
    upsertNote(optimistic);

    try {
        const saved = await updateNote(id, {
            title: optimistic.title,
            content: optimistic.content,
            color: optimistic.color,
            pinned: optimistic.pinned
        });
        upsertNote(saved);
    } catch (error) {
        upsertNote(existing);
        setBoardStatus(error.message || 'Unable to update note');
    }
}

function togglePin(note) {
    quickPatchNote(note._id, { pinned: !note.pinned });
}

async function duplicateNote(note) {
    try {
        const created = await createNote({
            title: note.title,
            content: note.content,
            color: note.color,
            pinned: note.pinned
        });
        upsertNote(created);
        setBoardStatus('Duplicate created');
    } catch (error) {
        setBoardStatus(error.message || 'Unable to duplicate note');
    }
}

async function removeNote(id) {
    if (!id) {
        return;
    }

    const previousNotes = state.notes;
    state.notes = state.notes.filter((note) => note._id !== id);
    renderBoard();

    try {
        await apiRequest(`/api/quicknotes/${id}`, { method: 'DELETE' });
    } catch (error) {
        state.notes = previousNotes;
        renderBoard();
        setBoardStatus(error.message || 'Unable to delete note');
        return;
    }

    if (state.editor.id === id) {
        resetEditor();
    }
}

function setInputValue(element, value) {
    if (element.value !== value) {
        element.value = value;
    }
}

function autoResizeTextarea(element, maxHeight) {
    element.style.height = '0px';
    const nextHeight = Math.min(element.scrollHeight, maxHeight);
    element.style.height = `${Math.max(nextHeight, 28)}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function setBoardStatus(message) {
    dom.boardStatus.textContent = message;
}

function formatDateTime(value) {
    const date = new Date(value);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    const formatter = new Intl.DateTimeFormat(undefined, sameDay
        ? { hour: 'numeric', minute: '2-digit' }
        : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    return sameDay ? `today at ${formatter.format(date)}` : formatter.format(date);
}

async function loadNotes() {
    return apiRequest('/api/quicknotes');
}

async function createNote(payload) {
    return apiRequest('/api/quicknotes', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

async function updateNote(id, payload) {
    return apiRequest(`/api/quicknotes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    });
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function readErrorMessage(response) {
    try {
        const payload = await response.json();
        return payload.error || 'Request failed';
    } catch (error) {
        return 'Request failed';
    }
}

// --- Crypto Utilities ---
async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return window.crypto.subtle.deriveKey({
        name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256'
    }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function encryptData(text, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const enc = new TextEncoder();
    
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, enc.encode(text)
    );
    
    return JSON.stringify({
        s: bufferToBase64(salt),
        i: bufferToBase64(iv),
        c: bufferToBase64(ciphertext)
    });
}

async function decryptData(encryptedJson, password) {
    try {
        const data = JSON.parse(encryptedJson);
        if (!data.s || !data.i || !data.c) throw new Error('Invalid format');
        const salt = base64ToBuffer(data.s);
        const iv = base64ToBuffer(data.i);
        const ciphertext = base64ToBuffer(data.c);
        
        const key = await deriveKey(password, salt);
        const dec = new TextDecoder();
        
        const plainBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv }, key, ciphertext
        );
        return dec.decode(plainBuffer);
    } catch (e) {
        throw new Error('Incorrect password');
    }
}


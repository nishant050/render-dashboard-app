document.addEventListener('DOMContentLoaded', () => {
    // State
    let pages = [];
    let isEditing = false;
    let editingPath = null;
    
    // Elements
    const pagesList = document.getElementById('pages-list');
    const btnCreate = document.getElementById('btn-create');
    const modal = document.getElementById('editor-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnSave = document.getElementById('btn-save');
    const modalTitle = document.getElementById('modal-title');
    const inputPath = document.getElementById('page-path');
    const inputTitle = document.getElementById('page-title');
    const fileUpload = document.getElementById('file-upload');
    const livePreview = document.getElementById('live-preview');
    const modalError = document.getElementById('modal-error');
    const toast = document.getElementById('toast');
    
    // Initialize Ace Editor
    ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.24.1/');
    const editor = ace.edit("ace-editor");
    editor.setTheme("ace/theme/tomorrow_night_eighties");
    editor.session.setMode("ace/mode/html");
    editor.setOptions({
        fontSize: "14px",
        showPrintMargin: false,
        wrap: true,
        useWorker: false
    });

    // Live Preview Update
    let previewTimeout;
    editor.session.on('change', () => {
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(() => {
            const html = editor.getValue();
            updateLivePreview(html);
        }, 500);
    });

    function updateLivePreview(html) {
        const doc = livePreview.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
    }

    // Load Pages
    async function fetchPages() {
        try {
            const res = await fetch('/api/hosthtml/pages');
            if (!res.ok) throw new Error('Failed to fetch pages');
            pages = await res.json();
            renderPages();
        } catch (error) {
            showToast(error.message, true);
            pagesList.innerHTML = '<div class="error-msg">Failed to load pages. Make sure the backend is running.</div>';
        }
    }

    function renderPages() {
        if (pages.length === 0) {
            pagesList.innerHTML = '<div class="info-alert" style="grid-column: 1 / -1;">No pages hosted yet. Click "+ New Page" to create one.</div>';
            return;
        }

        pagesList.innerHTML = pages.map(page => `
            <div class="page-card">
                <div class="page-card-header">
                    <h3>${escapeHtml(page.title)}</h3>
                </div>
                <a href="/p/${escapeHtml(page.path)}" target="_blank" class="page-path">/p/${escapeHtml(page.path)} ↗</a>
                <div class="page-stats">
                    👁️ ${page.views} views • Updated: ${new Date(page.updatedAt).toLocaleDateString()}
                </div>
                <div class="page-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editPage('${escapeHtml(page.path)}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePage('${escapeHtml(page.path)}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // Modal Logic
    function openModal(editMode = false, path = '') {
        isEditing = editMode;
        editingPath = path;
        modalError.textContent = '';
        
        if (editMode) {
            modalTitle.textContent = 'Edit Page';
            inputPath.value = path;
            inputPath.disabled = true; // Cannot change path once created
            
            // Fetch full content
            fetch(`/api/hosthtml/pages/${path}`)
                .then(res => res.json())
                .then(data => {
                    inputTitle.value = data.title;
                    editor.setValue(data.content, -1);
                    updateLivePreview(data.content);
                })
                .catch(err => showToast('Failed to load page content', true));
        } else {
            modalTitle.textContent = 'Create New Page';
            inputPath.value = '';
            inputPath.disabled = false;
            inputTitle.value = '';
            editor.setValue('<!DOCTYPE html>\n<html>\n<head>\n  <title>New Page</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>', -1);
            updateLivePreview(editor.getValue());
        }
        
        modal.classList.remove('hidden');
    }

    function closeModal() {
        modal.classList.add('hidden');
    }

    btnCreate.addEventListener('click', () => openModal(false));
    btnCloseModal.addEventListener('click', closeModal);
    
    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // File Upload Logic
    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            editor.setValue(content, -1);
            if (!inputTitle.value) {
                // Auto-fill title with filename (without extension)
                inputTitle.value = file.name.replace('.html', '');
            }
        };
        reader.onerror = () => {
            modalError.textContent = "Error reading file.";
        };
        reader.readAsText(file);
        
        // Reset file input so same file can be selected again if needed
        fileUpload.value = '';
    });

    // Save Logic
    btnSave.addEventListener('click', async () => {
        const path = inputPath.value.trim();
        const title = inputTitle.value.trim();
        const content = editor.getValue();
        
        if (!path || !title || !content) {
            modalError.textContent = 'All fields are required.';
            return;
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(path)) {
            modalError.textContent = 'Path can only contain letters, numbers, hyphens, and underscores.';
            return;
        }

        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';
        modalError.textContent = '';
        
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `/api/hosthtml/pages/${editingPath}` : `/api/hosthtml/pages`;
        
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, title, content })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Failed to save page');
            }
            
            showToast(isEditing ? 'Page updated successfully!' : 'Page created successfully!');
            closeModal();
            fetchPages();
        } catch (error) {
            modalError.textContent = error.message;
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Save Page';
        }
    });

    // Global Functions (attached to window for inline onclick in renderPages)
    window.editPage = (path) => {
        openModal(true, path);
    };

    window.deletePage = async (path) => {
        if (!confirm(`Are you sure you want to delete /p/${path}?`)) return;
        
        try {
            const res = await fetch(`/api/hosthtml/pages/${path}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete');
            }
            showToast('Page deleted successfully');
            fetchPages();
        } catch (error) {
            showToast(error.message, true);
        }
    };

    // Utils
    function escapeHtml(unsafe) {
        return (unsafe || '').replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showToast(message, isError = false) {
        toast.textContent = message;
        toast.className = `toast ${isError ? 'error' : ''}`;
        
        // Force reflow
        void toast.offsetWidth;
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    // Initial Load
    fetchPages();
});
